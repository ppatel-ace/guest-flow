import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import postgres from "postgres";
import nodemailer from "nodemailer";
import crypto from "crypto";

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3100", 10);
const JWT_SECRET = process.env.SSO_JWT_SECRET || "";
const APP_DOMAIN = process.env.APP_DOMAIN || "aceelectronics.com";
const DATABASE_URL = process.env.DATABASE_URL || "";
const JWT_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours
const REFRESH_THRESHOLD_SECONDS = 2 * 60 * 60; // refresh when < 2 hours remain

// SMTP config (optional — enables email-based password reset)
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_FROM = process.env.SMTP_FROM || `noreply@${APP_DOMAIN}`;
const SSO_BASE_URL = process.env.SSO_BASE_URL || `http://localhost:${PORT}`;

// SMTP OAuth 2.0 / XOAUTH2 (GCC High — client credentials flow)
// When these are set they take priority over SMTP_USER / SMTP_PASS.
const SMTP_OAUTH_CLIENT_ID     = process.env.SMTP_OAUTH_CLIENT_ID     || "";
const SMTP_OAUTH_CLIENT_SECRET = process.env.SMTP_OAUTH_CLIENT_SECRET || "";
const SMTP_OAUTH_TENANT_ID     = process.env.SMTP_OAUTH_TENANT_ID     || "";
const SMTP_OAUTH_SCOPE         = process.env.SMTP_OAUTH_SCOPE         || "https://outlook.office365.us/.default";
// Basic-auth fallback (used only when OAuth vars are not set)
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

// ─── Microsoft Entra ID — GCC High ────────────────────────────────────────────
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || "443420ec-3e93-4fe2-b233-ee23866d66b1";
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || "6ab850db-8359-47f8-9e46-ddb57a3f87bd";
// Redirect URI that is registered in portal.azure.us
const AZURE_REDIRECT_URI =
  process.env.AZURE_REDIRECT_URI || `${SSO_BASE_URL}/auth/microsoft/callback`;
const MS_AUTHORITY = `https://login.microsoftonline.us/${AZURE_TENANT_ID}`;
const MS_AUTHORIZE_URL = `${MS_AUTHORITY}/oauth2/v2.0/authorize`;
const MS_TOKEN_URL = `${MS_AUTHORITY}/oauth2/v2.0/token`;

if (!JWT_SECRET) {
  console.error("ERROR: SSO_JWT_SECRET environment variable is required");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}

// ─── Database ─────────────────────────────────────────────────────────────────

const parsed = new URL(DATABASE_URL);
const isLocal =
  parsed.hostname === "localhost" ||
  parsed.hostname === "127.0.0.1" ||
  parsed.hostname === "helium";
const sslmodeParam = parsed.searchParams.get("sslmode");
const noSsl = sslmodeParam === "disable" || isLocal;
parsed.searchParams.delete("sslmode");

const sql = postgres(parsed.toString(), {
  ssl: noSsl ? false : { rejectUnauthorized: false },
  max: 5,
});

// ─── Schema ───────────────────────────────────────────────────────────────────

async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS sso_users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      password_hash TEXT,
      active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Idempotent migrations — safe to run on every start
  await sql`
    ALTER TABLE sso_users
      ADD COLUMN IF NOT EXISTS reset_token        TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expiry  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_admin            BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS auth_provider       TEXT NOT NULL DEFAULT 'local'
  `;

  // Allow password_hash to be NULL for Microsoft-only users
  await sql`
    ALTER TABLE sso_users ALTER COLUMN password_hash DROP NOT NULL
  `.catch(() => { /* already nullable */ });

  console.log("[db] sso_users table ready");

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME || "Admin";

  if (adminEmail && adminPassword) {
    const [existing] = await sql`SELECT id FROM sso_users LIMIT 1`;
    if (!existing) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await sql`
        INSERT INTO sso_users (email, name, password_hash, is_admin)
        VALUES (${adminEmail}, ${adminName}, ${hash}, TRUE)
        ON CONFLICT (email) DO NOTHING
      `;
      console.log(`[db] seeded initial admin user: ${adminEmail}`);
    }
  }

  // Bootstrap: if no admin exists at all, promote the oldest user to admin
  // so existing deployments don't get locked out after this migration.
  const [anyAdmin] = await sql`SELECT id FROM sso_users WHERE is_admin = TRUE LIMIT 1`;
  if (!anyAdmin) {
    await sql`
      UPDATE sso_users SET is_admin = TRUE
      WHERE id = (SELECT id FROM sso_users ORDER BY created_at ASC LIMIT 1)
    `;
    console.log("[db] bootstrapped first user as admin (no admin existed)");
  }
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY_SECONDS });
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function needsRefresh(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) return false;
    const secondsRemaining = decoded.exp - Math.floor(Date.now() / 1000);
    return secondsRemaining < REFRESH_THRESHOLD_SECONDS;
  } catch {
    return false;
  }
}

// ─── Microsoft PKCE helpers ───────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function setAuthCookie(res: Response, token: string): void {
  const isLocalDomain = APP_DOMAIN === "localhost" || APP_DOMAIN === "127.0.0.1";
  res.cookie("ace_sso", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: JWT_EXPIRY_SECONDS * 1000,
    ...(isLocalDomain ? {} : { domain: `.${APP_DOMAIN}` }),
  });
}

// ─── Auth middleware ───────────────────────────────────────────────────────────

// requireAdminAuth verifies the ace_sso cookie AND that the user has is_admin=TRUE
// in the database.  The DB check is intentional: it makes admin revocation take
// effect immediately without waiting for token expiry.
async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.ace_sso;
  if (!token) {
    res.redirect(`/?redirect_uri=${encodeURIComponent(req.originalUrl)}`);
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.clearCookie("ace_sso");
    res.redirect(`/?redirect_uri=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  // Verify admin privilege from the DB (not just the JWT)
  try {
    const [user] = await sql<{ is_admin: boolean; active: boolean }[]>`
      SELECT is_admin, active FROM sso_users WHERE id = ${payload.sub}
    `;
    if (!user || !user.active || !user.is_admin) {
      res.status(403).setHeader("Content-Type", "text/html");
      res.send(forbiddenPage());
      return;
    }
  } catch (err) {
    console.error("[requireAdminAuth]", err);
    res.status(500).send("Internal server error");
    return;
  }

  // Transparently refresh near-expiry tokens
  if (needsRefresh(token)) {
    const newToken = signToken({ sub: payload.sub, email: payload.email, name: payload.name });
    setAuthCookie(res, newToken);
  }
  (req as any).adminUser = payload;
  next();
}

function forbiddenPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Access Denied — ACE</title>
  <style>
    body { font-family: -apple-system, sans-serif; background:#0f172a; color:#e2e8f0;
           display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .box { background:#1e293b; border:1px solid #334155; border-radius:.75rem;
           padding:2.5rem; text-align:center; max-width:400px; }
    h1 { font-size:1.25rem; font-weight:700; color:#f1f5f9; margin-bottom:.5rem; }
    p  { font-size:.875rem; color:#64748b; }
    a  { color:#60a5fa; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Access Denied</h1>
    <p>Your account does not have admin privileges.<br/>
       Contact an administrator to request access.</p>
    <p style="margin-top:1.5rem"><a href="/">Back to sign in</a></p>
  </div>
</body>
</html>`;
}

// ─── SMTP / email helpers ─────────────────────────────────────────────────────

function smtpConfigured(): boolean {
  const hasOAuth = !!(SMTP_HOST && SMTP_FROM && SMTP_OAUTH_CLIENT_ID && SMTP_OAUTH_CLIENT_SECRET && SMTP_OAUTH_TENANT_ID);
  const hasBasic = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
  return hasOAuth || hasBasic;
}

// Fetch a short-lived access token from Entra ID using client credentials.
// The token is valid for ~1 hour; we fetch a fresh one per email send so we
// never have to manage token expiry ourselves.
async function fetchSmtpAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.us/${SMTP_OAUTH_TENANT_ID}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     SMTP_OAUTH_CLIENT_ID,
      client_secret: SMTP_OAUTH_CLIENT_SECRET,
      scope:         SMTP_OAUTH_SCOPE,
    }).toString(),
  });
  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`SMTP OAuth token fetch failed: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

async function sendPasswordResetEmail(toEmail: string, toName: string, token: string): Promise<void> {
  if (!smtpConfigured()) throw new Error("SMTP not configured");

  let transporter: ReturnType<typeof nodemailer.createTransport>;

  if (SMTP_OAUTH_CLIENT_ID && SMTP_OAUTH_CLIENT_SECRET && SMTP_OAUTH_TENANT_ID) {
    // OAuth 2.0 / XOAUTH2 path (GCC High — client credentials)
    const accessToken = await fetchSmtpAccessToken();
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // STARTTLS
      auth: {
        type: "OAuth2",
        user: SMTP_FROM,
        accessToken,
      },
    });
  } else {
    // Basic-auth fallback
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  const resetUrl = `${SSO_BASE_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: SMTP_FROM,
    to: toEmail,
    subject: "ACE Electronics — Password Reset",
    text: `Hi ${toName},\n\nClick the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\n— ACE Electronics`,
    html: `<p>Hi ${toName},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p><p>— ACE Electronics</p>`,
  });
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function adminShell(opts: { title: string; adminName: string; body: string; flash?: { type: "success" | "error"; message: string } }): string {
  const flash = opts.flash
    ? `<div class="flash flash-${opts.flash.type}">${escHtml(opts.flash.message)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(opts.title)} — ACE Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
    }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Top nav ── */
    .nav {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 0 1.5rem;
      height: 56px;
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    .nav-brand {
      display: flex; align-items: center; gap: 0.6rem;
      font-size: 1rem; font-weight: 700; color: #f1f5f9;
      text-decoration: none;
    }
    .nav-brand:hover { text-decoration: none; }
    .nav-logo {
      width: 32px; height: 32px;
      background: #1d4ed8;
      border-radius: 0.4rem;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-weight: 800; color: #fff;
    }
    .nav-links { display: flex; gap: 1rem; flex: 1; }
    .nav-link {
      font-size: 0.875rem; color: #94a3b8; padding: 0.25rem 0.5rem;
      border-radius: 0.375rem; transition: color 0.15s, background 0.15s;
    }
    .nav-link:hover, .nav-link.active { color: #f1f5f9; background: #334155; text-decoration: none; }
    .nav-user {
      font-size: 0.8rem; color: #64748b; margin-left: auto;
      display: flex; align-items: center; gap: 0.75rem;
    }
    .nav-user a { color: #64748b; font-size: 0.8rem; }
    .nav-user a:hover { color: #94a3b8; }

    /* ── Main ── */
    .main { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
    h1 { font-size: 1.5rem; font-weight: 700; color: #f1f5f9; margin-bottom: 0.25rem; }
    .page-sub { font-size: 0.875rem; color: #64748b; margin-bottom: 1.75rem; }

    /* ── Flash ── */
    .flash {
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      margin-bottom: 1.25rem;
    }
    .flash-success { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.25); color: #86efac; }
    .flash-error   { background: rgba(239,68,68,0.12);  border: 1px solid rgba(239,68,68,0.25);  color: #fca5a5; }

    /* ── Card ── */
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card-title { font-size: 1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 1rem; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    thead th {
      text-align: left; font-size: 0.75rem; font-weight: 600;
      color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
      padding: 0 0.75rem 0.75rem;
      border-bottom: 1px solid #334155;
    }
    tbody tr { border-bottom: 1px solid #1e293b; }
    tbody tr:last-child { border-bottom: none; }
    tbody td { padding: 0.85rem 0.75rem; color: #cbd5e1; vertical-align: middle; }
    .badge {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em;
    }
    .badge-active   { background: rgba(34,197,94,0.15);  color: #86efac; }
    .badge-inactive { background: rgba(100,116,139,0.2); color: #94a3b8; }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    /* ── Buttons ── */
    .btn {
      padding: 0.4rem 0.85rem;
      border: none; border-radius: 0.4rem;
      font-size: 0.8rem; font-weight: 500;
      cursor: pointer; transition: opacity 0.15s;
      display: inline-flex; align-items: center; gap: 0.3rem;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary  { background: #1d4ed8; color: #fff; }
    .btn-danger   { background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
    .btn-success  { background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.25); }
    .btn-ghost    { background: #334155; color: #cbd5e1; }
    .btn-sm       { padding: 0.3rem 0.65rem; font-size: 0.75rem; }

    /* ── Forms ── */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 0.35rem; }
    .field-full { grid-column: 1 / -1; }
    label { font-size: 0.8rem; font-weight: 500; color: #94a3b8; }
    input[type=text], input[type=email], input[type=password] {
      padding: 0.55rem 0.75rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.4rem;
      color: #f1f5f9;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: #3b82f6; }
    .form-actions { margin-top: 1rem; }

    /* ── Modal overlay (CSS-only) ── */
    .modal-backdrop {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.6); z-index: 50;
      align-items: center; justify-content: center; padding: 1rem;
    }
    .modal-backdrop:target { display: flex; }
    .modal {
      background: #1e293b; border: 1px solid #334155;
      border-radius: 0.75rem; padding: 1.5rem;
      width: 100%; max-width: 400px;
      position: relative;
    }
    .modal-title { font-size: 1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 1rem; }
    .modal-close {
      position: absolute; top: 1rem; right: 1rem;
      color: #64748b; text-decoration: none; font-size: 1.2rem; line-height: 1;
    }
    .modal-close:hover { color: #94a3b8; text-decoration: none; }
    .modal-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.85rem; }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/admin/users" class="nav-brand">
      <div class="nav-logo">AE</div>
      ACE Admin
    </a>
    <div class="nav-links">
      <a href="/admin/users" class="nav-link active">Users</a>
    </div>
    <div class="nav-user">
      <span>${escHtml(opts.adminName)}</span>
      <a href="/api/auth/logout?redirect_uri=/admin/users">Sign out</a>
    </div>
  </nav>
  <main class="main">
    ${flash}
    ${opts.body}
  </main>
</body>
</html>`;
}

// ─── Login page HTML ──────────────────────────────────────────────────────────

function loginPage(opts: { redirectUri: string; error?: string }): string {
  const escaped = opts.redirectUri.replace(/"/g, "&quot;");
  const msHref = `/auth/microsoft?redirect_uri=${encodeURIComponent(opts.redirectUri)}`;
  const error = opts.error
    ? `<div class="error">${opts.error}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ACE Sign In</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 1rem;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }
    .logo-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .logo-icon {
      width: 52px; height: 52px;
      background: #1d4ed8;
      border-radius: 0.75rem;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; font-weight: 800; color: #fff;
    }
    .logo-text { font-size: 1.25rem; font-weight: 700; color: #f1f5f9; }
    .logo-sub { font-size: 0.8rem; color: #64748b; margin-top: -0.25rem; }
    label {
      display: block;
      font-size: 0.82rem;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 0.4rem;
    }
    input {
      width: 100%;
      padding: 0.65rem 0.85rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      color: #f1f5f9;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.15s;
      margin-bottom: 1rem;
    }
    input:focus { border-color: #3b82f6; }
    .btn-primary {
      display: block;
      width: 100%;
      padding: 0.75rem;
      background: #1d4ed8;
      color: #fff;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      margin-top: 0.5rem;
      text-align: center;
      text-decoration: none;
    }
    .btn-primary:hover { background: #1e40af; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-microsoft {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      width: 100%;
      padding: 0.75rem;
      background: #2f2f2f;
      color: #fff;
      border: 1px solid #555;
      border-radius: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
      margin-bottom: 1.25rem;
    }
    .btn-microsoft:hover { background: #3d3d3d; }
    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.25rem 0;
      color: #475569;
      font-size: 0.8rem;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #334155;
    }
    .error {
      background: rgba(239,68,68,0.15);
      border: 1px solid rgba(239,68,68,0.3);
      color: #fca5a5;
      padding: 0.65rem 0.85rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      margin-bottom: 1.25rem;
    }
    .footer {
      text-align: center;
      margin-top: 1.75rem;
      font-size: 0.75rem;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-wrap">
      <div class="logo-icon">AE</div>
      <div class="logo-text">ACE Electronics</div>
      <div class="logo-sub">Sign in to continue</div>
    </div>
    ${error}
    <a href="${msHref}" class="btn-microsoft">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 21">
        <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
        <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
        <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
      </svg>
      Sign in with Microsoft
    </a>
    <div class="divider">or sign in with email</div>
    <form method="POST" action="/api/auth/login">
      <input type="hidden" name="redirect_uri" value="${escaped}" />
      <div>
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" placeholder="you@aceelectronics.com" required autocomplete="email" />
      </div>
      <div>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" placeholder="••••••••" required autocomplete="current-password" />
      </div>
      <button type="submit" id="btn" class="btn-primary">Sign In</button>
    </form>
    <div class="footer">ACE Electronics &mdash; Internal use only</div>
  </div>
  <script>
    document.querySelector('form').addEventListener('submit', function() {
      document.getElementById('btn').disabled = true;
      document.getElementById('btn').textContent = 'Signing in\u2026';
    });
  </script>
</body>
</html>`;
}

// ─── redirect_uri validation ──────────────────────────────────────────────────
// Only allow redirects to trusted origins: *.APP_DOMAIN, localhost, 127.0.0.1
// This prevents open-redirect attacks if this service is reachable externally.

function isTrustedRedirectUri(uri: string): boolean {
  if (!uri || uri === "/") return true;
  // Relative paths (no scheme) are always safe
  if (!uri.startsWith("http://") && !uri.startsWith("https://")) return true;
  try {
    const { hostname } = new URL(uri);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    // Allow exact match or any subdomain of APP_DOMAIN
    if (
      hostname === APP_DOMAIN ||
      hostname.endsWith(`.${APP_DOMAIN}`)
    ) return true;
    return false;
  } catch {
    return false;
  }
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ── Microsoft login — start PKCE flow ─────────────────────────────────────────
app.get("/auth/microsoft", (req: Request, res: Response) => {
  const redirectUri = (req.query.redirect_uri as string) || "/";
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");

  // Store verifier + state + original redirect_uri in a short-lived cookie
  res.cookie("ms_pkce", JSON.stringify({ codeVerifier, state, redirectUri }), {
    httpOnly: true,
    maxAge: 10 * 60 * 1000, // 10 minutes
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    response_type: "code",
    redirect_uri: AZURE_REDIRECT_URI,
    scope: "openid profile email",
    response_mode: "query",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  res.redirect(`${MS_AUTHORIZE_URL}?${params.toString()}`);
});

// ── Microsoft login — callback ─────────────────────────────────────────────────
app.get("/auth/microsoft/callback", async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string>;

  const pkceRaw = req.cookies?.ms_pkce;
  res.clearCookie("ms_pkce");

  if (error || !code) {
    console.error("[microsoft] auth error:", error, error_description);
    const msg = encodeURIComponent(error_description || "Microsoft login failed. Please try again.");
    return res.redirect(`/?error=${msg}`);
  }

  let pkce: { codeVerifier: string; state: string; redirectUri: string } | null = null;
  try {
    pkce = JSON.parse(pkceRaw || "");
  } catch {
    return res.redirect("/?error=Session+expired.+Please+try+again.");
  }

  if (!pkce || pkce.state !== state) {
    return res.redirect("/?error=Invalid+state.+Please+try+again.");
  }

  // Exchange auth code for tokens (no client_secret — PKCE public client)
  let idToken: string;
  try {
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: AZURE_CLIENT_ID,
        code,
        redirect_uri: AZURE_REDIRECT_URI,
        code_verifier: pkce.codeVerifier,
      }).toString(),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.id_token) {
      console.error("[microsoft] token exchange failed:", tokenData);
      return res.redirect("/?error=Microsoft+authentication+failed.");
    }
    idToken = tokenData.id_token;
  } catch (err) {
    console.error("[microsoft] token exchange network error:", err);
    return res.redirect("/?error=Could+not+reach+Microsoft.+Please+try+again.");
  }

  // Decode ID token claims — token arrived from Microsoft directly over HTTPS
  let claims: Record<string, any>;
  try {
    const payload = idToken.split(".")[1];
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return res.redirect("/?error=Invalid+token+received+from+Microsoft.");
  }

  const email = (claims.email || claims.preferred_username || "").toLowerCase().trim();
  const name =
    claims.name ||
    [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
    email;

  if (!email) {
    return res.redirect("/?error=No+email+returned+from+Microsoft.");
  }

  // Find or auto-create user
  try {
    let [user] = await sql<{ id: string; email: string; name: string; active: boolean }[]>`
      SELECT id, email, name, active FROM sso_users WHERE email = ${email}
    `;

    if (!user) {
      [user] = await sql<{ id: string; email: string; name: string; active: boolean }[]>`
        INSERT INTO sso_users (email, name, auth_provider)
        VALUES (${email}, ${name}, 'microsoft')
        RETURNING id, email, name, active
      `;
      console.log(`[microsoft] auto-created user: ${email}`);
    } else if (!user.active) {
      return res.redirect("/?error=Your+account+has+been+deactivated.");
    }

    const token = signToken({ sub: user.id, email: user.email, name: user.name });
    setAuthCookie(res, token);
    console.log(`[microsoft] signed in: ${email}`);

    // For absolute redirect URIs (cross-origin apps) use token-in-URL flow
    const dest = pkce.redirectUri;
    if (dest.startsWith("http://") || dest.startsWith("https://")) {
      const sep = dest.includes("?") ? "&" : "?";
      return res.redirect(`${dest}${sep}ace_token=${encodeURIComponent(token)}`);
    }
    return res.redirect(dest || "/");
  } catch (err) {
    console.error("[microsoft] user upsert error:", err);
    return res.redirect("/?error=Login+failed.+Please+try+again.");
  }
});

// ── Login page ────────────────────────────────────────────────────────────────
app.get("/", (req: Request, res: Response) => {
  const raw = (req.query.redirect_uri as string) || "/";
  const redirectUri = isTrustedRedirectUri(raw) ? raw : "/";
  // If already authenticated, send directly to redirect_uri (refresh if near expiry)
  const token = req.cookies?.ace_sso;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      if (needsRefresh(token)) {
        const newToken = signToken({ sub: payload.sub, email: payload.email, name: payload.name });
        setAuthCookie(res, newToken);
      }
      return res.redirect(redirectUri);
    }
  }
  res.setHeader("Content-Type", "text/html");
  res.send(loginPage({ redirectUri }));
});

// ── Login submit ──────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password, redirect_uri } = req.body as {
    email?: string;
    password?: string;
    redirect_uri?: string;
  };
  const raw = redirect_uri || "/";
  const redirectUri = isTrustedRedirectUri(raw) ? raw : "/";

  if (!email || !password) {
    res.setHeader("Content-Type", "text/html");
    return res.status(400).send(
      loginPage({ redirectUri, error: "Email and password are required." })
    );
  }

  try {
    const [user] = await sql<{ id: string; email: string; name: string; password_hash: string; active: boolean }[]>`
      SELECT id, email, name, password_hash, active
      FROM sso_users
      WHERE email = ${email.toLowerCase().trim()}
    `;

    if (!user || !user.active) {
      res.setHeader("Content-Type", "text/html");
      return res.status(401).send(
        loginPage({ redirectUri, error: "Invalid email or password." })
      );
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.setHeader("Content-Type", "text/html");
      return res.status(401).send(
        loginPage({ redirectUri, error: "Invalid email or password." })
      );
    }

    const token = signToken({ sub: user.id, email: user.email, name: user.name });
    setAuthCookie(res, token);
    // For absolute redirect URIs (cross-origin apps), append the token in the
    // URL so the receiving app can set its own local cookie.  This works even
    // when the SSO service is reachable only by IP:port instead of a domain.
    if (redirectUri.startsWith("http://") || redirectUri.startsWith("https://")) {
      const sep = redirectUri.includes("?") ? "&" : "?";
      return res.redirect(`${redirectUri}${sep}ace_token=${encodeURIComponent(token)}`);
    }
    return res.redirect(redirectUri);
  } catch (err) {
    console.error("[login]", err);
    res.setHeader("Content-Type", "text/html");
    res.status(500).send(
      loginPage({ redirectUri, error: "An unexpected error occurred. Please try again." })
    );
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
app.get("/api/auth/logout", (req: Request, res: Response) => {
  const redirectUri = (req.query.redirect_uri as string) || "/";
  const isLocalDomain =
    APP_DOMAIN === "localhost" || APP_DOMAIN === "127.0.0.1";

  res.clearCookie("ace_sso", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(isLocalDomain ? {} : { domain: `.${APP_DOMAIN}` }),
  });
  res.redirect(`/?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// ── Token validation (called by other apps) ───────────────────────────────────
app.get("/api/auth/validate", (req: Request, res: Response) => {
  const token =
    req.cookies?.ace_sso ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ valid: false, error: "No token" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ valid: false, error: "Invalid or expired token" });
  }

  // Transparently refresh the cookie when within 2 hours of expiry
  if (needsRefresh(token)) {
    const newToken = signToken({ sub: payload.sub, email: payload.email, name: payload.name });
    setAuthCookie(res, newToken);
  }

  res.json({
    valid: true,
    user: { id: payload.sub, email: payload.email, name: payload.name },
  });
});

// ─── Admin: User management ───────────────────────────────────────────────────

interface SsoUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
  is_admin: boolean;
  created_at: Date;
}

// GET /admin/users — list all users
app.get("/admin/users", requireAdminAuth, async (req: Request, res: Response) => {
  const adminUser = (req as any).adminUser as JwtPayload;

  // Flash message from query string (set after redirects)
  const rawFlashType = req.query.flash as string | undefined;
  const rawFlashMsg = req.query.msg as string | undefined;
  const VALID_FLASH_TYPES = ["success", "error"] as const;
  type FlashType = (typeof VALID_FLASH_TYPES)[number];
  const flashType: FlashType | undefined = VALID_FLASH_TYPES.includes(rawFlashType as FlashType)
    ? (rawFlashType as FlashType)
    : undefined;
  // Express already URL-decodes req.query values; use rawFlashMsg directly.
  const flash = flashType && rawFlashMsg
    ? { type: flashType, message: rawFlashMsg }
    : undefined;

  try {
    const users = await sql<SsoUser[]>`
      SELECT id, email, name, active, is_admin, created_at
      FROM sso_users
      ORDER BY created_at ASC
    `;

    const adminCount = users.filter((u) => u.is_admin).length;

    const rows = users.map((u) => {
      const statusBadge = u.active
        ? `<span class="badge badge-active">● Active</span>`
        : `<span class="badge badge-inactive">○ Inactive</span>`;

      const adminBadge = u.is_admin
        ? `<span class="badge badge-admin" style="background:rgba(99,102,241,0.15);color:#a5b4fc;margin-left:.35rem">Admin</span>`
        : "";

      const toggleLabel = u.active ? "Deactivate" : "Activate";
      const toggleClass = u.active ? "btn btn-sm btn-danger" : "btn btn-sm btn-success";

      const adminToggleLabel = u.is_admin ? "Revoke Admin" : "Make Admin";
      // Prevent revoking the last admin
      const canRevokeAdmin = !(u.is_admin && adminCount <= 1);
      const adminToggle = canRevokeAdmin
        ? `<form method="POST" action="/admin/users/${u.id}/toggle-admin" style="display:inline">
             <button type="submit" class="btn btn-sm btn-ghost">${adminToggleLabel}</button>
           </form>`
        : `<span class="btn btn-sm btn-ghost" style="opacity:.4;cursor:not-allowed" title="Cannot remove the last admin">Revoke Admin</span>`;

      const emailAction = smtpConfigured()
        ? `<form method="POST" action="/admin/users/${u.id}/send-reset" style="display:inline">
             <button type="submit" class="btn btn-sm btn-ghost">Email Reset</button>
           </form>`
        : "";

      return `<tr>
        <td>${escHtml(u.name)}${adminBadge}</td>
        <td style="color:#94a3b8">${escHtml(u.email)}</td>
        <td>${statusBadge}</td>
        <td style="color:#64748b;font-size:0.8rem">${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          <div class="actions">
            <a href="#reset-modal-${u.id}" class="btn btn-sm btn-ghost">Set Password</a>
            ${emailAction}
            ${adminToggle}
            <form method="POST" action="/admin/users/${u.id}/toggle" style="display:inline">
              <button type="submit" class="${toggleClass}">${toggleLabel}</button>
            </form>
          </div>
        </td>
      </tr>`;
    }).join("");

    const modals = users.map((u) => `
      <div id="reset-modal-${u.id}" class="modal-backdrop">
        <div class="modal">
          <a href="#" class="modal-close" aria-label="Close">&times;</a>
          <div class="modal-title">Set Password — ${escHtml(u.name)}</div>
          <form method="POST" action="/admin/users/${u.id}/reset-password">
            <div class="modal-field">
              <label for="pw-${u.id}">New password</label>
              <input id="pw-${u.id}" name="password" type="password" placeholder="Minimum 8 characters" required minlength="8" autocomplete="new-password" />
            </div>
            <div class="modal-field">
              <label for="pw2-${u.id}">Confirm password</label>
              <input id="pw2-${u.id}" name="password_confirm" type="password" placeholder="Repeat password" required minlength="8" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%">Update Password</button>
          </form>
        </div>
      </div>`).join("");

    const body = `
      <h1>User Management</h1>
      <p class="page-sub">Manage SSO accounts for all ACE Electronics internal tools.</p>

      <div class="card">
        <div class="card-title">All Users (${users.length})</div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:2rem">No users yet.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">Add New User</div>
        <form method="POST" action="/admin/users">
          <div class="form-grid">
            <div class="field">
              <label for="new-name">Full name</label>
              <input id="new-name" name="name" type="text" placeholder="Jane Smith" required />
            </div>
            <div class="field">
              <label for="new-email">Email address</label>
              <input id="new-email" name="email" type="email" placeholder="jane@aceelectronics.com" required />
            </div>
            <div class="field">
              <label for="new-password">Password</label>
              <input id="new-password" name="password" type="password" placeholder="Minimum 8 characters" required minlength="8" autocomplete="new-password" />
            </div>
            <div class="field">
              <label for="new-password2">Confirm password</label>
              <input id="new-password2" name="password_confirm" type="password" placeholder="Repeat password" required minlength="8" autocomplete="new-password" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Create User</button>
          </div>
        </form>
      </div>
      ${modals}
    `;

    res.setHeader("Content-Type", "text/html");
    res.send(adminShell({ title: "User Management", adminName: adminUser.name, body, flash }));
  } catch (err) {
    console.error("[admin/users]", err);
    res.status(500).send("Internal server error");
  }
});

// POST /admin/users — create new user
app.post("/admin/users", requireAdminAuth, async (req: Request, res: Response) => {
  const { name, email, password, password_confirm } = req.body as {
    name?: string; email?: string; password?: string; password_confirm?: string;
  };

  const redirect = (type: "success" | "error", msg: string) =>
    res.redirect(`/admin/users?flash=${type}&msg=${encodeURIComponent(msg)}`);

  if (!name?.trim() || !email?.trim() || !password) {
    return redirect("error", "Name, email, and password are all required.");
  }
  if (password !== password_confirm) {
    return redirect("error", "Passwords do not match.");
  }
  if (password.length < 8) {
    return redirect("error", "Password must be at least 8 characters.");
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    await sql`
      INSERT INTO sso_users (email, name, password_hash)
      VALUES (${email.toLowerCase().trim()}, ${name.trim()}, ${hash})
    `;
    redirect("success", `User "${name.trim()}" created successfully.`);
  } catch (err: any) {
    if (err?.code === "23505") {
      redirect("error", "A user with that email already exists.");
    } else {
      console.error("[admin/users POST]", err);
      redirect("error", "Failed to create user. Please try again.");
    }
  }
});

// POST /admin/users/:id/toggle — activate / deactivate
app.post("/admin/users/:id/toggle", requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminUser = (req as any).adminUser as JwtPayload;

  const redirect = (type: "success" | "error", msg: string) =>
    res.redirect(`/admin/users?flash=${type}&msg=${encodeURIComponent(msg)}`);

  try {
    const [user] = await sql<{ id: string; email: string; active: boolean }[]>`
      SELECT id, email, active FROM sso_users WHERE id = ${id}
    `;
    if (!user) return redirect("error", "User not found.");

    // Prevent an admin from deactivating their own account
    if (user.id === adminUser.sub && user.active) {
      return redirect("error", "You cannot deactivate your own account.");
    }

    const newActive = !user.active;
    await sql`UPDATE sso_users SET active = ${newActive} WHERE id = ${id}`;
    redirect("success", `User ${newActive ? "activated" : "deactivated"} successfully.`);
  } catch (err) {
    console.error("[admin/users/toggle]", err);
    redirect("error", "Failed to update user status.");
  }
});

// POST /admin/users/:id/toggle-admin — grant or revoke admin privilege
app.post("/admin/users/:id/toggle-admin", requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminUser = (req as any).adminUser as JwtPayload;

  const redirect = (type: "success" | "error", msg: string) =>
    res.redirect(`/admin/users?flash=${type}&msg=${encodeURIComponent(msg)}`);

  try {
    const [user] = await sql<{ id: string; name: string; is_admin: boolean }[]>`
      SELECT id, name, is_admin FROM sso_users WHERE id = ${id}
    `;
    if (!user) return redirect("error", "User not found.");

    // Prevent removing admin from yourself
    if (user.id === adminUser.sub && user.is_admin) {
      return redirect("error", "You cannot revoke your own admin privileges.");
    }

    // Guard against removing the last admin
    if (user.is_admin) {
      const [{ count }] = await sql<{ count: string }[]>`
        SELECT COUNT(*) as count FROM sso_users WHERE is_admin = TRUE
      `;
      if (parseInt(count, 10) <= 1) {
        return redirect("error", "Cannot remove the last admin. Promote another user first.");
      }
    }

    const newAdmin = !user.is_admin;
    await sql`UPDATE sso_users SET is_admin = ${newAdmin} WHERE id = ${id}`;
    redirect("success", `Admin privileges ${newAdmin ? "granted to" : "revoked from"} ${user.name}.`);
  } catch (err) {
    console.error("[admin/users/toggle-admin]", err);
    redirect("error", "Failed to update admin status.");
  }
});

// POST /admin/users/:id/reset-password — set a new password directly
app.post("/admin/users/:id/reset-password", requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password, password_confirm } = req.body as { password?: string; password_confirm?: string };

  const redirect = (type: "success" | "error", msg: string) =>
    res.redirect(`/admin/users?flash=${type}&msg=${encodeURIComponent(msg)}`);

  if (!password) return redirect("error", "Password is required.");
  if (password !== password_confirm) return redirect("error", "Passwords do not match.");
  if (password.length < 8) return redirect("error", "Password must be at least 8 characters.");

  try {
    const [user] = await sql<{ id: string }[]>`SELECT id FROM sso_users WHERE id = ${id}`;
    if (!user) return redirect("error", "User not found.");

    const hash = await bcrypt.hash(password, 12);
    await sql`UPDATE sso_users SET password_hash = ${hash} WHERE id = ${id}`;
    redirect("success", "Password updated successfully.");
  } catch (err) {
    console.error("[admin/users/reset-password]", err);
    redirect("error", "Failed to update password.");
  }
});

// POST /admin/users/:id/send-reset — send password reset email (requires SMTP)
app.post("/admin/users/:id/send-reset", requireAdminAuth, async (req: Request, res: Response) => {
  const { id } = req.params;

  const redirect = (type: "success" | "error", msg: string) =>
    res.redirect(`/admin/users?flash=${type}&msg=${encodeURIComponent(msg)}`);

  if (!smtpConfigured()) {
    return redirect("error", "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email resets.");
  }

  try {
    const [user] = await sql<{ id: string; email: string; name: string }[]>`
      SELECT id, email, name FROM sso_users WHERE id = ${id}
    `;
    if (!user) return redirect("error", "User not found.");

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sql`
      UPDATE sso_users
      SET reset_token = ${token}, reset_token_expiry = ${expiry}
      WHERE id = ${id}
    `;

    await sendPasswordResetEmail(user.email, user.name, token);
    redirect("success", `Password reset email sent to ${user.email}.`);
  } catch (err) {
    console.error("[admin/users/send-reset]", err);
    redirect("error", "Failed to send reset email. Check SMTP configuration.");
  }
});

// GET /reset-password — password reset form (linked from email)
app.get("/reset-password", async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.setHeader("Content-Type", "text/html");
    return res.status(400).send(resetPasswordPage({ error: "Missing reset token." }));
  }

  try {
    const [user] = await sql<{ id: string; reset_token_expiry: Date }[]>`
      SELECT id, reset_token_expiry
      FROM sso_users
      WHERE reset_token = ${token}
        AND reset_token_expiry > now()
    `;
    if (!user) {
      res.setHeader("Content-Type", "text/html");
      return res.status(400).send(resetPasswordPage({ error: "This reset link is invalid or has expired." }));
    }
    res.setHeader("Content-Type", "text/html");
    res.send(resetPasswordPage({ token }));
  } catch (err) {
    console.error("[reset-password GET]", err);
    res.status(500).setHeader("Content-Type", "text/html");
    res.send(resetPasswordPage({ error: "An unexpected error occurred." }));
  }
});

// POST /reset-password — handle form submission
app.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password, password_confirm } = req.body as {
    token?: string; password?: string; password_confirm?: string;
  };

  if (!token) {
    res.setHeader("Content-Type", "text/html");
    return res.status(400).send(resetPasswordPage({ error: "Missing reset token." }));
  }

  if (!password || password !== password_confirm) {
    res.setHeader("Content-Type", "text/html");
    return res.send(resetPasswordPage({ token, error: "Passwords do not match." }));
  }

  if (password.length < 8) {
    res.setHeader("Content-Type", "text/html");
    return res.send(resetPasswordPage({ token, error: "Password must be at least 8 characters." }));
  }

  try {
    const [user] = await sql<{ id: string }[]>`
      SELECT id FROM sso_users
      WHERE reset_token = ${token}
        AND reset_token_expiry > now()
    `;
    if (!user) {
      res.setHeader("Content-Type", "text/html");
      return res.status(400).send(resetPasswordPage({ error: "This reset link is invalid or has expired." }));
    }

    const hash = await bcrypt.hash(password, 12);
    await sql`
      UPDATE sso_users
      SET password_hash = ${hash}, reset_token = NULL, reset_token_expiry = NULL
      WHERE id = ${user.id}
    `;

    res.setHeader("Content-Type", "text/html");
    res.send(resetPasswordPage({ success: true }));
  } catch (err) {
    console.error("[reset-password POST]", err);
    res.setHeader("Content-Type", "text/html");
    res.status(500).send(resetPasswordPage({ error: "An unexpected error occurred." }));
  }
});

function resetPasswordPage(opts: { token?: string; error?: string; success?: boolean }): string {
  const tokenField = opts.token
    ? `<input type="hidden" name="token" value="${escHtml(opts.token)}" />`
    : "";
  const feedback = opts.error
    ? `<div class="msg msg-error">${escHtml(opts.error)}</div>`
    : opts.success
    ? `<div class="msg msg-success">Your password has been updated. <a href="/">Sign in</a></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Password — ACE</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .card {
      background: #1e293b; border: 1px solid #334155; border-radius: 1rem;
      padding: 2.5rem; width: 100%; max-width: 400px;
    }
    .title { font-size: 1.25rem; font-weight: 700; color: #f1f5f9; margin-bottom: 0.25rem; }
    .sub { font-size: 0.8rem; color: #64748b; margin-bottom: 1.75rem; }
    label { display: block; font-size: 0.82rem; font-weight: 500; color: #94a3b8; margin-bottom: 0.4rem; }
    input {
      width: 100%; padding: 0.65rem 0.85rem;
      background: #0f172a; border: 1px solid #334155; border-radius: 0.5rem;
      color: #f1f5f9; font-size: 0.95rem; outline: none; margin-bottom: 1rem;
    }
    input:focus { border-color: #3b82f6; }
    button {
      width: 100%; padding: 0.75rem; background: #1d4ed8; color: #fff;
      border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 600;
      cursor: pointer; margin-top: 0.5rem;
    }
    button:hover { background: #1e40af; }
    .msg { padding: 0.65rem 0.85rem; border-radius: 0.5rem; font-size: 0.875rem; margin-bottom: 1.25rem; }
    .msg-error   { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
    .msg-success { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.25); color: #86efac; }
    a { color: #60a5fa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Reset your password</div>
    <div class="sub">Enter a new password for your account.</div>
    ${feedback}
    ${opts.success ? "" : `
    <form method="POST" action="/reset-password">
      ${tokenField}
      <div>
        <label>New password</label>
        <input name="password" type="password" placeholder="Minimum 8 characters" required minlength="8" autocomplete="new-password" />
      </div>
      <div>
        <label>Confirm password</label>
        <input name="password_confirm" type="password" placeholder="Repeat password" required minlength="8" autocomplete="new-password" />
      </div>
      <button type="submit">Update Password</button>
    </form>`}
  </div>
</body>
</html>`;
}

// ─── Start ────────────────────────────────────────────────────────────────────

(async () => {
  await initDb();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ace-auth] SSO service running on port ${PORT}`);
  });
})();

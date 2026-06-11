import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import postgres from "postgres";

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3100", 10);
const JWT_SECRET = process.env.SSO_JWT_SECRET || "";
const APP_DOMAIN = process.env.APP_DOMAIN || "aceelectronics.com";
const DATABASE_URL = process.env.DATABASE_URL || "";
const JWT_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours
const REFRESH_THRESHOLD_SECONDS = 2 * 60 * 60; // refresh when < 2 hours remain

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
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log("[db] sso_users table ready");

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME || "Admin";

  if (adminEmail && adminPassword) {
    const [existing] = await sql`SELECT id FROM sso_users LIMIT 1`;
    if (!existing) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await sql`
        INSERT INTO sso_users (email, name, password_hash)
        VALUES (${adminEmail}, ${adminName}, ${hash})
        ON CONFLICT (email) DO NOTHING
      `;
      console.log(`[db] seeded initial admin user: ${adminEmail}`);
    }
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

// ─── Login page HTML ──────────────────────────────────────────────────────────

function loginPage(opts: { redirectUri: string; error?: string }): string {
  const escaped = opts.redirectUri.replace(/"/g, "&quot;");
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
    button {
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
    }
    button:hover { background: #1e40af; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
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
      <button type="submit" id="btn">Sign In</button>
    </form>
    <div class="footer">ACE Electronics &mdash; Internal use only</div>
  </div>
  <script>
    document.querySelector('form').addEventListener('submit', function() {
      document.getElementById('btn').disabled = true;
      document.getElementById('btn').textContent = 'Signing in…';
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

// ─── Start ────────────────────────────────────────────────────────────────────

(async () => {
  await initDb();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ace-auth] SSO service running on port ${PORT}`);
  });
})();

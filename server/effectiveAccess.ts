/** Live registry app access — shared pattern across ACE SSO apps. */
import type { Response } from "express";
import jwt from "jsonwebtoken";
import pg from "pg";
import type { Pool as PgPool } from "pg";
const { Pool } = pg;

export type AceAppSlug =
  | "hub"
  | "guestflow"
  | "jobtrack"
  | "estimatepro"
  | "inventory"
  | "support"
  | "crm";

export interface AceSsoJwtPayload {
  sub: string;
  email: string;
  name: string;
  employeeId?: string;
  groups?: string[];
  apps?: string[];
}

const SSO_JWT_EXPIRY_SECONDS = 8 * 60 * 60;

let pool: PgPool | null = null;

function resolveIamDbSsl(databaseUrl: string): boolean | { rejectUnauthorized: boolean } {
  const parsed = new URL(databaseUrl);
  const hostname = parsed.hostname.toLowerCase();
  const sslmode = parsed.searchParams.get("sslmode");
  const isSupabase =
    hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");
  const isLocal =
    hostname === "localhost" ||
    hostname === "helium" ||
    hostname === "127.0.0.1" ||
    !hostname.includes(".");

  if (sslmode === "disable") return false;
  if (sslmode === "require") return { rejectUnauthorized: false };
  if (sslmode === "verify-full" || sslmode === "verify-ca") return { rejectUnauthorized: true };
  if (isLocal) return false;
  if (isSupabase) return { rejectUnauthorized: true };
  // Internal ACE / Docker Postgres hosts typically have no TLS listener.
  return false;
}

function getPool(): PgPool | null {
  if (pool) return pool;
  const raw =
    process.env.JOBTRACK_DATABASE_URL ||
    process.env.PRODUCTION_DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!raw) return null;
  const parsed = new URL(raw);
  parsed.searchParams.delete("sslmode");
  const connectionString = parsed.toString();
  pool = new Pool({
    connectionString,
    max: 2,
    ssl: resolveIamDbSsl(raw),
  });
  return pool;
}

function appsFromRegistry(
  row: {
    access_hub?: boolean | null;
    access_jobtrack?: boolean | null;
    access_inventory?: boolean | null;
    access_estimate?: boolean | null;
    access_guestflow?: boolean | null;
    access_support?: boolean | null;
  } | null,
  isAdmin: boolean,
): AceAppSlug[] {
  const apps: AceAppSlug[] = [];
  if (!row) return isAdmin ? ["hub", "crm"] : [];
  if (row.access_hub) apps.push("hub", "crm");
  if (row.access_jobtrack) apps.push("jobtrack");
  if (row.access_estimate) apps.push("estimatepro");
  if (row.access_inventory) apps.push("inventory");
  if (row.access_guestflow) apps.push("guestflow");
  if (row.access_support) apps.push("support");
  if (isAdmin && !apps.includes("hub")) apps.push("hub", "crm");
  return apps;
}

function cookieDomainOptions(): { domain?: string } {
  const domain = process.env.APP_DOMAIN;
  const isLocal = !domain || domain === "localhost" || domain === "127.0.0.1";
  return isLocal ? {} : { domain: `.${domain}` };
}

function setAceSsoCookie(res: Response, token: string): void {
  res.cookie("ace_sso", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SSO_JWT_EXPIRY_SECONDS * 1000,
    ...cookieDomainOptions(),
  });
}

function appsEqual(a: string[] | undefined, b: string[]): boolean {
  return [...(a ?? [])].sort().join(",") === [...b].sort().join(",");
}

export async function refreshAceSsoFromRegistry(
  res: Response,
  payload: AceSsoJwtPayload,
): Promise<AceSsoJwtPayload> {
  const p = getPool();
  if (!p) {
    console.warn(
      "[effectiveAccess] JOBTRACK_DATABASE_URL (or PRODUCTION_DATABASE_URL) not configured — SSO app access cannot be refreshed from registry",
    );
    return payload;
  }

  try {
    const ssoRes = await p.query<{ is_admin: boolean; active: boolean }>(
      "SELECT is_admin, active FROM sso_users WHERE id = $1::uuid",
      [payload.sub],
    );
    const sso = ssoRes.rows[0];
    if (!sso?.active) return { ...payload, apps: [] };

    const regRes = await p.query<{
      employee_id: string | null;
      access_hub: boolean | null;
      access_jobtrack: boolean | null;
      access_inventory: boolean | null;
      access_estimate: boolean | null;
      access_guestflow: boolean | null;
      access_support: boolean | null;
    }>(
      `SELECT employee_id, access_hub, access_jobtrack, access_inventory,
              access_estimate, access_guestflow, access_support
       FROM ace_user_registry
       WHERE sso_user_id = $1::uuid OR lower(employee_email) = lower($2)
       ORDER BY CASE WHEN sso_user_id = $1::uuid THEN 0 ELSE 1 END`,
      [payload.sub, payload.email],
    );
    const rows = regRes.rows;
    const registry =
      rows.length === 0
        ? null
        : {
            employee_id: rows[0]?.employee_id ?? null,
            access_hub: rows.some((r) => r.access_hub === true),
            access_jobtrack: rows.some((r) => r.access_jobtrack === true),
            access_inventory: rows.some((r) => r.access_inventory === true),
            access_estimate: rows.some((r) => r.access_estimate === true),
            access_guestflow: rows.some((r) => r.access_guestflow === true),
            access_support: rows.some((r) => r.access_support === true),
          };
    const effectiveApps = appsFromRegistry(registry, sso.is_admin);
    console.log(
      `[effectiveAccess] ${payload.email} registry refresh → apps=${effectiveApps.join(",") || "(none)"} guestflow=${registry?.access_guestflow === true}`,
    );
    const updated: AceSsoJwtPayload = {
      ...payload,
      apps: effectiveApps,
      employeeId: registry?.employee_id ?? payload.employeeId,
    };

    if (!appsEqual(payload.apps, effectiveApps)) {
      const secret = process.env.SSO_JWT_SECRET;
      if (secret) {
        const token = jwt.sign(
          {
            sub: updated.sub,
            email: updated.email,
            name: updated.name,
            employeeId: updated.employeeId,
            groups: updated.groups,
            apps: effectiveApps,
          },
          secret,
          { expiresIn: SSO_JWT_EXPIRY_SECONDS },
        );
        setAceSsoCookie(res, token);
      }
    }
    return updated;
  } catch (err) {
    console.error("[effectiveAccess] registry refresh failed:", err);
    return payload;
  }
}

export function hasAppAccess(
  payload: Pick<AceSsoJwtPayload, "apps"> | null | undefined,
  app: AceAppSlug,
): boolean {
  if (!payload) return false;
  if (app === "crm") return payload.apps?.includes("crm") ?? payload.apps?.includes("hub") ?? false;
  return payload.apps?.includes(app) ?? false;
}

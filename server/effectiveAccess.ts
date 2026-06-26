/** Live registry app access — shared pattern across ACE SSO apps. */
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";

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

let pool: Pool | null = null;

function getPool(): Pool | null {
  if (pool) return pool;
  const url =
    process.env.JOBTRACK_DATABASE_URL ||
    process.env.PRODUCTION_DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!url) return null;
  pool = new Pool({ connectionString: url, max: 2 });
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
  if (!p) return payload;

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
       ORDER BY CASE WHEN sso_user_id = $1::uuid THEN 0 ELSE 1 END
       LIMIT 1`,
      [payload.sub, payload.email],
    );
    const registry = regRes.rows[0] ?? null;
    const effectiveApps = appsFromRegistry(registry, sso.is_admin);
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

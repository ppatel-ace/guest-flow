/**
 * ACE SSO middleware — shared pattern for all ACE apps.
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const AZURE_APP_GROUPS = {
  guestflow: "88897cdd-bc61-4051-b67e-6daf5f7fc7e8",
  jobtrack: "bc5af5fb-4e3d-4e6c-be07-c7bcff91e2ed",
  estimatepro: "e8309095-39bf-4354-ae42-5808685b0c94",
} as const;

export type AceAppSlug = keyof typeof AZURE_APP_GROUPS | "hub" | "inventory" | "support" | "crm";

export interface AceSsoJwtPayload {
  sub: string;
  email: string;
  name: string;
  employeeId?: string;
  groups?: string[];
  apps?: string[];
}

export const SSO_JWT_EXPIRY_SECONDS = 8 * 60 * 60;
export const SSO_REFRESH_THRESHOLD_SECONDS = 2 * 60 * 60;

export function verifyAceSsoToken(token: string): AceSsoJwtPayload | null {
  const secret = process.env.SSO_JWT_SECRET;
  if (!secret || !token) return null;
  try {
    return jwt.verify(token, secret) as AceSsoJwtPayload;
  } catch {
    return null;
  }
}

export function hasAppAccess(
  payload: Pick<AceSsoJwtPayload, "groups" | "apps"> | null | undefined,
  app: AceAppSlug,
): boolean {
  if (!payload) return false;
  if (app === "hub") return true;
  if (process.env.SSO_ENFORCE_GROUPS !== "true") return true;
  if (payload.apps?.includes(app)) return true;
  const groups = (payload.groups ?? []).map((g) => g.toLowerCase());
  if (app === "guestflow") return groups.includes(AZURE_APP_GROUPS.guestflow);
  if (app === "jobtrack") return groups.includes(AZURE_APP_GROUPS.jobtrack);
  if (app === "estimatepro") return groups.includes(AZURE_APP_GROUPS.estimatepro);
  if (app === "inventory") {
    return (
      groups.includes(AZURE_APP_GROUPS.jobtrack) ||
      groups.includes(AZURE_APP_GROUPS.estimatepro)
    );
  }
  if (app === "support") return groups.length > 0;
  return false;
}

export function refreshSsoTokenIfNeeded(
  token: string,
  payload: AceSsoJwtPayload,
  res: Response,
): void {
  try {
    const secret = process.env.SSO_JWT_SECRET;
    if (!secret) return;
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) return;
    if (decoded.exp - Math.floor(Date.now() / 1000) >= SSO_REFRESH_THRESHOLD_SECONDS) return;
    const newToken = jwt.sign(
      {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        employeeId: payload.employeeId,
        groups: payload.groups,
        apps: payload.apps,
      },
      secret,
      { expiresIn: SSO_JWT_EXPIRY_SECONDS },
    );
    const domain = process.env.APP_DOMAIN;
    const isLocal = !domain || domain === "localhost" || domain === "127.0.0.1";
    res.cookie("ace_sso", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      ...(isLocal ? {} : { domain: `.${domain}` }),
    });
  } catch {
    /* ignore */
  }
}

export type AceAuthRequest = Request & { aceSsoUser?: AceSsoJwtPayload & { id: string } };

export function tryAceSsoFromRequest(req: AceAuthRequest, res: Response): AceSsoJwtPayload | null {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.ace_sso;
  if (!token) return null;
  const payload = verifyAceSsoToken(token);
  if (!payload) return null;
  req.aceSsoUser = { ...payload, id: payload.sub };
  refreshSsoTokenIfNeeded(token, payload, res);
  return payload;
}

export function registerAceSsoRoutes(app: import("express").Express, appSlug: AceAppSlug): void {
  app.get(["/api/auth/sso/callback", "/ace-admin/api/auth/sso/callback"], (req, res) => {
    const rawToken = req.query.ace_token as string | undefined;
    const nextPath = (req.query.next as string) || "/";
    const safeNext = nextPath.startsWith("/") ? (nextPath === "/ace-admin" ? "/" : nextPath) : "/";
    if (!rawToken) return res.redirect(safeNext);
    const token = decodeURIComponent(rawToken);
    if (!verifyAceSsoToken(token)) return res.redirect("/");
    const domain = process.env.APP_DOMAIN;
    const isLocal = !domain || domain === "localhost" || domain === "127.0.0.1";
    res.cookie("ace_sso", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      ...(isLocal ? {} : { domain: `.${domain}` }),
    });
    res.redirect(safeNext);
  });

  app.get("/api/auth/sso/session", (req: AceAuthRequest, res) => {
    const payload = tryAceSsoFromRequest(req, res);
    if (payload && hasAppAccess(payload, appSlug)) {
      return res.json({
        authenticated: true,
        via: "sso",
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          groups: payload.groups ?? [],
          apps: payload.apps ?? [],
        },
      });
    }
    const ssoBase = process.env.SSO_LOGIN_URL;
    if (ssoBase) {
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      return res.json({
        authenticated: false,
        ssoLoginUrl: `${ssoBase}?redirect_uri=${encodeURIComponent(`${appUrl}/api/auth/sso/callback?next=/`)}`,
      });
    }
    res.json({ authenticated: false });
  });
}

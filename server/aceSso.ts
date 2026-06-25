/**
 * ACE SSO middleware — GuestFlow
 */
import type { Express, Request, Response } from "express";
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

export type AceAuthRequest = Request & {
  user?: { id: string; email: string; name: string };
  aceSsoUser?: AceSsoJwtPayload & { id: string };
};

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

function cookieDomainOptions(): { domain?: string } {
  const domain = process.env.APP_DOMAIN;
  const isLocal = !domain || domain === "localhost" || domain === "127.0.0.1";
  return isLocal ? {} : { domain: `.${domain}` };
}

export function setAceSsoCookie(res: Response, token: string): void {
  res.cookie("ace_sso", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SSO_JWT_EXPIRY_SECONDS * 1000,
    ...cookieDomainOptions(),
  });
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
    setAceSsoCookie(res, newToken);
  } catch {
    /* ignore */
  }
}

export function tryAceSsoFromRequest(req: AceAuthRequest, res: Response): AceSsoJwtPayload | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifyAceSsoToken(authHeader.slice(7));
    if (payload) {
      req.aceSsoUser = { ...payload, id: payload.sub };
      return payload;
    }
  }

  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.ace_sso;
  if (!cookieToken) return null;
  const payload = verifyAceSsoToken(cookieToken);
  if (!payload) return null;
  req.aceSsoUser = { ...payload, id: payload.sub };
  refreshSsoTokenIfNeeded(cookieToken, payload, res);
  return payload;
}

export function buildGuestFlowCallbackUrl(appUrl: string, next = "/ace-admin"): string {
  return `${appUrl.replace(/\/$/, "")}/api/auth/callback?next=${encodeURIComponent(next)}`;
}

export function registerAceSsoRoutes(app: Express, appSlug: AceAppSlug): void {
  const defaultNext = appSlug === "guestflow" ? "/ace-admin" : "/";

  app.get("/api/auth/callback", (req, res) => {
    const rawToken = req.query.ace_token as string | undefined;
    const nextPath = (req.query.next as string) || defaultNext;
    const safeNext = nextPath.startsWith("/") ? nextPath : defaultNext;

    const queryToken = rawToken ? decodeURIComponent(rawToken) : undefined;
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.ace_sso;

    if (queryToken) {
      const payload = verifyAceSsoToken(queryToken);
      if (!payload) {
        return res.redirect(`${defaultNext}?error=sso_invalid`);
      }
      if (process.env.SSO_ENFORCE_GROUPS === "true" && !hasAppAccess(payload, appSlug)) {
        return res.redirect(
          `${defaultNext}?error=${encodeURIComponent("You do not have access to GuestFlow. Join sg_Guestflow in Azure AD.")}`,
        );
      }
      setAceSsoCookie(res, queryToken);
      return res.redirect(safeNext);
    }

    if (cookieToken && verifyAceSsoToken(cookieToken)) {
      return res.redirect(safeNext);
    }

    return res.redirect(safeNext);
  });
}

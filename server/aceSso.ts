/**
 * ACE SSO middleware — GuestFlow
 */
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { hasAppAccess as hasRegistryAppAccess, refreshAceSsoFromRegistry } from "./effectiveAccess";
import { clearAceSsoCookie } from "./guestAuth";

export { clearAceSsoCookie };

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
  return hasRegistryAppAccess(payload, app);
}

export { refreshAceSsoFromRegistry };

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

export function signAceSsoToken(payload: AceSsoJwtPayload): string | null {
  const secret = process.env.SSO_JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(
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
    const newToken = signAceSsoToken(payload);
    if (newToken) setAceSsoCookie(res, newToken);
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

export function buildGuestFlowCallbackUrl(appUrl: string, next = "/"): string {
  return `${appUrl.replace(/\/$/, "")}/api/auth/callback?next=${encodeURIComponent(next)}`;
}

export function registerAceSsoRoutes(app: Express, appSlug: AceAppSlug): void {
  const defaultNext = "/";

  app.get(["/api/auth/callback", "/ace-admin/api/auth/callback"], async (req, res) => {
    const rawToken = req.query.ace_token as string | undefined;
    const nextPath = (req.query.next as string) || defaultNext;
    const safeNext = nextPath.startsWith("/") ? (nextPath === "/ace-admin" ? "/" : nextPath) : defaultNext;

    const queryToken = rawToken ? decodeURIComponent(rawToken) : undefined;
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.ace_sso;
    const tokenToVerify = queryToken ?? cookieToken;

    if (!tokenToVerify) {
      return res.redirect(safeNext);
    }

    const rawPayload = verifyAceSsoToken(tokenToVerify);
    if (!rawPayload) {
      clearAceSsoCookie(res);
      return res.redirect(`${defaultNext}?error=sso_invalid`);
    }

    const payload = await refreshAceSsoFromRegistry(res, rawPayload);
    if (!hasAppAccess(payload, appSlug)) {
      clearAceSsoCookie(res);
      return res.redirect(
        `/access-denied?error=NO_ACCESS&message=${encodeURIComponent(
          "You do not have access to this application. Contact your administrator.",
        )}`,
      );
    }

    const signed = signAceSsoToken(payload) ?? tokenToVerify;
    setAceSsoCookie(res, signed);
    return res.redirect(safeNext);
  });
}

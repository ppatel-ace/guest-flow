/**
 * ACE SSO middleware — GuestFlow
 */
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { hasAppAccess as hasRegistryAppAccess, refreshAceSsoFromRegistry } from "./effectiveAccess";

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

export function clearAceSsoCookie(res: Response): void {
  res.clearCookie("ace_sso", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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
  const defaultNext = "/ace-admin";

  app.get("/api/auth/callback", async (req, res) => {
    const rawToken = req.query.ace_token as string | undefined;
    const nextPath = (req.query.next as string) || defaultNext;
    const safeNext = nextPath.startsWith("/") ? nextPath : defaultNext;

    const queryToken = rawToken ? decodeURIComponent(rawToken) : undefined;
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.ace_sso;
    const token = queryToken || cookieToken;

    if (!token) {
      return res.redirect(safeNext);
    }

    const rawPayload = verifyAceSsoToken(token);
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

    const secret = process.env.SSO_JWT_SECRET;
    if (secret) {
      const freshToken = jwt.sign(
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
      setAceSsoCookie(res, freshToken);
    } else if (queryToken) {
      setAceSsoCookie(res, queryToken);
    }

    return res.redirect(safeNext);
  });

  app.get("/api/auth/sso/session", async (req: AceAuthRequest, res) => {
    const raw = tryAceSsoFromRequest(req, res);
    if (!raw) {
      const ssoBase = process.env.SSO_LOGIN_URL;
      if (ssoBase) {
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        const callbackUrl = `${appUrl}/api/auth/callback?next=${encodeURIComponent(defaultNext)}`;
        return res.json({
          authenticated: false,
          ssoLoginUrl: `${ssoBase}?redirect_uri=${encodeURIComponent(callbackUrl)}`,
        });
      }
      return res.json({ authenticated: false });
    }

    const payload = await refreshAceSsoFromRegistry(res, raw);
    if (hasAppAccess(payload, appSlug)) {
      return res.json({ authenticated: true, via: "sso", user: payload });
    }

    clearAceSsoCookie(res);
    const ssoBase = process.env.SSO_LOGIN_URL;
    if (ssoBase) {
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const callbackUrl = `${appUrl}/api/auth/callback?next=${encodeURIComponent(defaultNext)}`;
      return res.json({
        authenticated: false,
        reason: "no_access",
        ssoLoginUrl: `${ssoBase}?redirect_uri=${encodeURIComponent(callbackUrl)}`,
      });
    }
    res.json({ authenticated: false });
  });
}

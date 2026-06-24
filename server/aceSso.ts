import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";

export const SSO_JWT_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours

export interface AceSsoPayload {
  sub: string;
  email: string;
  name: string;
  groups?: string[];
  apps?: string[];
  iat?: number;
  exp?: number;
}

export interface AceAuthRequest extends Request {
  user?: { id?: string; email: string; name: string };
}

export function verifyAceSsoToken(token: string): AceSsoPayload | null {
  const secret = process.env.SSO_JWT_SECRET;
  if (!secret) {
    // No secret configured — decode without verification (local dev only)
    try {
      const decoded = jwt.decode(token) as AceSsoPayload | null;
      if (!decoded?.sub || !decoded?.email) return null;
      return decoded;
    } catch {
      return null;
    }
  }
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as AceSsoPayload;
    if (!payload?.sub || !payload?.email) return null;
    return payload;
  } catch {
    return null;
  }
}

export function tryAceSsoFromRequest(
  req: AceAuthRequest,
  _res: Response,
): AceSsoPayload | null {
  // 1. Bearer token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return verifyAceSsoToken(authHeader.slice(7));
  }
  // 2. ace_sso httpOnly cookie (set by /api/auth/callback)
  const cookieToken = (req as any).cookies?.ace_sso;
  if (cookieToken) {
    return verifyAceSsoToken(cookieToken);
  }
  return null;
}

export function hasAppAccess(payload: AceSsoPayload, appName: string): boolean {
  // If no apps/groups restrictions, everyone with a valid token has access
  if (!payload.apps && !payload.groups) return true;
  if (payload.apps?.includes(appName)) return true;
  // Azure AD group convention: sg_<AppName> (case-insensitive)
  const groupPattern = new RegExp(`^sg_${appName}$`, "i");
  return payload.groups?.some((g) => groupPattern.test(g)) ?? false;
}

// The Microsoft PKCE OAuth flow lives on the dedicated ACE SSO service
// (sso.aceelectronics.com). GuestFlow only receives the signed ace_token
// via redirect and stores it as a cookie — no OAuth routes needed here.
export function registerAceSsoRoutes(_app: Express, _appName: string): void {
  // no-op — SSO initiation is handled externally
}

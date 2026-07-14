import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SSO_JWT_EXPIRY_SECONDS = 8 * 60 * 60;
const SSO_REFRESH_THRESHOLD_SECONDS = 2 * 60 * 60;

interface SsoPayload {
  sub: string;
  email: string;
  name: string;
  exp?: number;
}

function verifyAceSsoToken(token: string): SsoPayload | null {
  const secret = process.env.SSO_JWT_SECRET;
  if (!secret || !token) return null;
  try {
    return jwt.verify(token, secret) as SsoPayload;
  } catch {
    return null;
  }
}

function refreshSsoTokenIfNeeded(
  token: string,
  payload: SsoPayload,
  res: Response
): void {
  try {
    const secret = process.env.SSO_JWT_SECRET;
    if (!secret) return;
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) return;
    const secondsRemaining = decoded.exp - Math.floor(Date.now() / 1000);
    if (secondsRemaining >= SSO_REFRESH_THRESHOLD_SECONDS) return;

    const newToken = jwt.sign(
      { sub: payload.sub, email: payload.email, name: payload.name },
      secret,
      { expiresIn: SSO_JWT_EXPIRY_SECONDS }
    );

    const domain = process.env.APP_DOMAIN;
    const isLocalDomain = !domain || domain === "localhost" || domain === "127.0.0.1";
    res.cookie("ace_sso", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SSO_JWT_EXPIRY_SECONDS * 1000,
      ...(isLocalDomain ? {} : { domain: `.${domain}` }),
    });
  } catch {
    // Non-critical — session continues with the existing token if refresh fails
  }
}

// Authentication middleware — checks the ace_sso JWT cookie first (SSO path),
// then falls back to the legacy express-session flag for local dev/backward compat.
export const requireAuth = (req: Request & { user?: any }, res: Response, next: NextFunction): void => {
  const ssoToken = (req as any).cookies?.ace_sso;
  if (ssoToken) {
    const payload = verifyAceSsoToken(ssoToken);
    if (payload) {
      (req as any).user = { id: payload.sub, email: payload.email, name: payload.name };
      refreshSsoTokenIfNeeded(ssoToken, payload, res);
      return next();
    }
  }
  // Fallback: legacy session auth (used in local dev when SSO_JWT_SECRET is not set)
  if ((req as any).session?.authenticated) {
    (req as any).user = { email: "admin", name: "Admin" };
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};

// Returns an object suitable for a GET /api/session response.
// Pass the current app's URL (e.g. req.protocol + '://' + req.get('host') + '/admin')
// so the SSO redirect_uri is correct.
export function getSessionResponse(req: Request, currentAppUrl: string): object {
  const ssoToken = (req as any).cookies?.ace_sso;
  if (ssoToken) {
    const payload = verifyAceSsoToken(ssoToken);
    if (payload) {
      return { authenticated: true, user: { email: payload.email, name: payload.name } };
    }
  }
  // Fallback: legacy session
  if ((req as any).session?.authenticated) {
    return { authenticated: true, user: { email: "admin", name: "Admin" } };
  }
  // Not authenticated — include ssoLoginUrl when SSO is configured
  const ssoBase = process.env.SSO_LOGIN_URL;
  if (ssoBase) {
    return {
      authenticated: false,
      ssoLoginUrl: `${ssoBase}?redirect_uri=${encodeURIComponent(currentAppUrl)}`,
    };
  }
  return { authenticated: false };
}

// Call this from POST /api/logout to clear the domain-wide ace_sso cookie.
// Also destroys the express session if present.
export function handleLogout(req: Request, res: Response, redirectUrl?: string): void {
  const domain = process.env.APP_DOMAIN;
  const isLocalDomain = !domain || domain === "localhost" || domain === "127.0.0.1";
  res.clearCookie("ace_sso", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(isLocalDomain ? {} : { domain: `.${domain}` }),
  });

  const finish = () => {
    const ssoBase = process.env.SSO_LOGIN_URL;
    if (ssoBase && redirectUrl) {
      const ssoServiceUrl = new URL(ssoBase).origin;
      res.json({
        success: true,
        ssoLogoutUrl: `${ssoServiceUrl}/api/auth/logout?redirect_uri=${encodeURIComponent(redirectUrl)}`,
      });
    } else {
      res.json({ success: true });
    }
  };

  if ((req as any).session?.destroy) {
    (req as any).session.destroy(() => finish());
  } else {
    finish();
  }
}

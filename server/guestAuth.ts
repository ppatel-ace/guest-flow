import type { Request, Response } from "express";

export function clearAceSsoCookie(res: Response): void {
  const domain = process.env.APP_DOMAIN;
  const isLocal = !domain || domain === "localhost" || domain === "127.0.0.1";
  res.clearCookie("ace_sso", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(isLocal ? {} : { domain: `.${domain}` }),
  });
}

export function buildGuestFlowSsoLoginUrl(req: Request, next = "/"): string | null {
  const ssoBase = process.env.SSO_LOGIN_URL?.trim();
  if (!ssoBase) return null;
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const safeNext = next.startsWith("/") ? next : "/";
  const callbackUrl = `${appUrl.replace(/\/$/, "")}/api/auth/callback?next=${encodeURIComponent(safeNext)}`;
  const loginUrl = new URL(ssoBase);
  loginUrl.searchParams.set("redirect_uri", callbackUrl);
  return loginUrl.toString();
}

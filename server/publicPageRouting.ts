import type { RequestHandler } from "express";

/** Preserve the original path/query; browsers retain the QR fragment across this redirect. */
export const normalizeAceHostname: RequestHandler = (req, res, next) => {
  const host = req.hostname;
  const isAceHost = host === "aceelectronics.com" || host.endsWith(".aceelectronics.com");
  if (isAceHost && host !== "guestflow.aceelectronics.com") {
    return res.redirect(301, `https://guestflow.aceelectronics.com${req.originalUrl}`);
  }
  next();
};

const PUBLIC_PAGES = ["/guest-check-in", "/scan", "/kiosk", "/rsvp-arrival"];

/** Install only in production. RSVP entry must reach the client before its generic fallback. */
export const guardProductionPublicPages: RequestHandler = (req, res, next) => {
  if (req.hostname === "guestflow.aceelectronics.com" ||
      req.path.startsWith("/api/") || /\.\w+$/.test(req.path) ||
      PUBLIC_PAGES.some((path) => req.path === path || req.path.startsWith(path + "/"))) {
    return next();
  }
  return res.redirect(302, "/guest-check-in");
};

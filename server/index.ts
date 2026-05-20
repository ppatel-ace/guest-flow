import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from "./migrate";

// Extend Express session
declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
  }
}

const app = express();
// Trust the first proxy hop so req.ip reflects the real client IP from X-Forwarded-For.
// Required for correct per-client rate limiting behind Replit's reverse proxy.
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Ensure SESSION_SECRET is set
if (!process.env.SESSION_SECRET) {
  console.error("ERROR: SESSION_SECRET environment variable is required");
  process.exit(1);
}

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Unconditional guard: /login is permanently retired — redirect to guest check-in
  // in all environments so the URL is never exposed even in development.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/login" || req.path === "/login/") {
      return res.redirect(302, "/guest-check-in");
    }
    return next();
  });

  // Production guard: only expose public-facing pages on the deployed URL.
  // All admin routes (dashboard, invitations, etc.) redirect to the guest
  // check-in page. API calls and static assets are passed through as-is
  // (admin API endpoints are already protected by requireAuth).
  // The admin login form lives at /ace-admin (not /login).
  if (process.env.NODE_ENV === "production") {
    const PUBLIC_PAGES = ["/guest-check-in", "/scan", "/kiosk"];
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Always pass through API calls and static assets (files with extensions)
      if (req.path.startsWith("/api/") || /\.\w+$/.test(req.path)) {
        return next();
      }
      // Allow the two public pages (guest check-in and scan)
      if (PUBLIC_PAGES.some(p => req.path === p || req.path.startsWith(p + "/"))) {
        return next();
      }
      // Everything else (/, /customers, /export, etc.) → guest check-in
      return res.redirect(302, "/guest-check-in");
    });
  }

  // Warn in production when bot-protection secrets are absent — checks silently degrade without them
  if (process.env.NODE_ENV === "production") {
    if (!process.env.TURNSTILE_SECRET_KEY) {
      console.warn("WARN: TURNSTILE_SECRET_KEY is not set — Cloudflare Turnstile verification is DISABLED");
    }
    if (!process.env.FINGERPRINT_HMAC_SECRET) {
      console.warn("WARN: FINGERPRINT_HMAC_SECRET is not set — timing token enforcement is DISABLED");
    }
  }

  await runMigrations();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

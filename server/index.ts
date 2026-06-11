import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool: PgPool } = pkg;
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from "./migrate";
import { checkConnection } from "./db";

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
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Ensure SESSION_SECRET is set
if (!process.env.SESSION_SECRET) {
  console.error("ERROR: SESSION_SECRET environment variable is required");
  process.exit(1);
}

// Build a pg.Pool for the session store.
// Strip sslmode from the connection string so the pg driver's URL parser cannot
// override the explicit ssl object we pass — that's the only reliable way to
// control rejectUnauthorized when using a connectionString.
function buildSessionPool(): InstanceType<typeof PgPool> | undefined {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return undefined;
  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "helium";
    const sslmodeParam = parsed.searchParams.get("sslmode");
    const noSsl = sslmodeParam === "disable" || isLocal;

    // Remove sslmode so pg's URL parser doesn't set its own TLS options.
    parsed.searchParams.delete("sslmode");
    const cleanUrl = parsed.toString();

    const ssl: boolean | object = noSsl ? false : { rejectUnauthorized: false };
    return new PgPool({ connectionString: cleanUrl, ssl: ssl as any, max: 2 });
  } catch {
    return undefined;
  }
}

const PgSession = pgSimple(session);
const sessionPool = buildSessionPool();

// Session middleware — use PostgreSQL store when DATABASE_URL is available so
// sessions survive server restarts; fall back to MemoryStore in dev without a DB.
app.use(session({
  store: sessionPool
    ? new PgSession({ pool: sessionPool, tableName: "session", createTableIfMissing: true })
    : undefined,
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
  // Hostname normalisation: any *.aceelectronics.com host that isn't the canonical
  // guestflow.aceelectronics.com gets a permanent 301 to the same path/query on
  // guestflow.aceelectronics.com.  localhost and Replit dev domains are unaffected
  // because they don't match the aceelectronics.com suffix check.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.hostname; // strips port, lower-cased by Express
    const isAceHost = host === "aceelectronics.com" || host.endsWith(".aceelectronics.com");
    const isCanonical = host === "guestflow.aceelectronics.com";
    if (isAceHost && !isCanonical) {
      return res.redirect(301, `https://guestflow.aceelectronics.com${req.originalUrl}`);
    }
    return next();
  });

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
      // guestflow.aceelectronics.com is an internal-only admin domain — skip the guard entirely
      const host = req.hostname || "";
      if (host === "guestflow.aceelectronics.com") {
        return next();
      }
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

  await checkConnection();
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

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertFormFieldSchema, insertLeadSchema, insertDocumentSchema } from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";
import rateLimit from "express-rate-limit";
import { createHmac } from "crypto";

// ─── Bot-protection helpers ────────────────────────────────────────────────────

const HMAC_SECRET = process.env.FINGERPRINT_HMAC_SECRET ?? "dev-fallback-change-in-prod";

function makeTimingToken(): string {
  const ts = Date.now();
  const sig = createHmac("sha256", HMAC_SECRET).update(String(ts)).digest("hex");
  return `${ts}.${sig}`;
}

function validateTimingToken(token: string): { ok: boolean; reason?: string } {
  const parts = token?.split(".");
  if (!parts || parts.length !== 2) return { ok: false, reason: "malformed" };
  const [tsStr, sig] = parts;
  const expected = createHmac("sha256", HMAC_SECRET).update(tsStr).digest("hex");
  if (sig !== expected) return { ok: false, reason: "invalid signature" };
  const age = Date.now() - Number(tsStr);
  if (age < 2000) return { ok: false, reason: "too fast" };
  if (age > 30 * 60 * 1000) return { ok: false, reason: "expired" };
  return { ok: true };
}

const HEADLESS_UA_PATTERNS = [
  "headlesschrome", "puppeteer", "playwright", "selenium", "phantomjs",
  "python-requests", "python-urllib", "curl/", "wget/", "httpie",
  "go-http-client", "java/", "apache-httpclient",
];

function isHeadlessUA(ua: string | undefined): boolean {
  if (!ua) return true;
  const lower = ua.toLowerCase();
  return HEADLESS_UA_PATTERNS.some((p) => lower.includes(p));
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // skip verification in dev when key not set
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// ─── Bot-block in-memory counters (resets daily, no DB required) ──────────────

type BlockReason = "honeypot" | "ua" | "timing" | "turnstile" | "rateLimit";

interface BlockEvent {
  timestamp: number;
  reason: BlockReason;
  maskedIp: string;
}

function maskIp(ip: string | undefined): string {
  if (!ip) return "unknown";
  const v4 = ip.split(".");
  if (v4.length === 4) return `${v4[0]}.${v4[1]}.x.x`;
  const colon = ip.indexOf(":");
  return colon !== -1 ? ip.slice(0, colon) + ":xxxx:…" : ip.slice(0, 8) + "…";
}

let _blockDay = new Date().toISOString().slice(0, 10);
// Uncapped per-reason totals — never lose a count due to log rotation
let _blockCounts: Record<BlockReason, number> = { honeypot: 0, ua: 0, timing: 0, turnstile: 0, rateLimit: 0 };
// Capped recent-event log for the dashboard table (last 100 entries)
let _blockLog: BlockEvent[] = [];

function recordBlock(reason: BlockReason, ip: string | undefined) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _blockDay) {
    _blockLog = [];
    _blockCounts = { honeypot: 0, ua: 0, timing: 0, turnstile: 0, rateLimit: 0 };
    _blockDay = today;
  }
  _blockCounts[reason]++;
  _blockLog.push({ timestamp: Date.now(), reason, maskedIp: maskIp(ip) });
  if (_blockLog.length > 100) _blockLog = _blockLog.slice(-100);
}

function getBotStats() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _blockDay) {
    _blockLog = [];
    _blockCounts = { honeypot: 0, ua: 0, timing: 0, turnstile: 0, rateLimit: 0 };
    _blockDay = today;
  }
  const total = Object.values(_blockCounts).reduce((s, n) => s + n, 0);
  return {
    date: today,
    total,
    counts: { ..._blockCounts },
    recentLog: [..._blockLog].reverse().slice(0, 20),
  };
}

// Rate limiters for the legacy guest-register endpoint and the atomic guest-checkin endpoint.

const guestRegisterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    recordBlock("rateLimit", req.ip);
    res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
  },
});

// Single limiter for the atomic guest check-in endpoint
const guestCheckinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    recordBlock("rateLimit", req.ip);
    res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
  },
});

// Authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (req.session?.authenticated) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Simple hardcoded authentication
      if (username === "admin" && password === "admin") {
        req.session.authenticated = true;
        res.json({ success: true, user: { username: "admin" } });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/session", (req, res) => {
    if (req.session?.authenticated) {
      res.json({ authenticated: true, user: { username: "admin" } });
    } else {
      res.json({ authenticated: false });
    }
  });
  
  // Generate QR code (public - no auth required)
  // Uses error correction level H (highest) so logo overlay doesn't break scanning
  app.get("/api/generate-qr", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      const qrCode = await QRCode.toDataURL(url, { width: 400, errorCorrectionLevel: 'H' });
      res.json({ qrCode });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // Get all customers (public - allows viewing without login)
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Search customers (public - used by standalone check-in page)
  app.get("/api/customers/search", async (req, res) => {
    try {
      const term = req.query.term as string;
      if (!term) {
        return res.status(400).json({ error: "Search term is required" });
      }
      const customers = await storage.searchCustomers(term);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to search customers" });
    }
  });

  // Get customer by ID (public - used by standalone check-in page)
  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Create customer (public - allows CSV/Excel import without login)
  app.post("/api/customers", async (req, res) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(data);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      console.error("Failed to create customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  // Update customer (protected)
  app.put("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const data = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, data);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Delete customer (protected)
  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // Send invitation (protected)
  app.post("/api/customers/:id/invite", requireAuth, async (req, res) => {
    try {
      const customer = await storage.sendInvitation(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });

  // Check-in customer (public - used by standalone check-in page)
  app.post("/api/customers/:id/check-in", async (req, res) => {
    try {
      const customer = await storage.checkInCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to check-in customer" });
    }
  });

  // Check-in by QR code
  app.post("/api/check-in/qr", async (req, res) => {
    try {
      const { qrCode } = req.body;
      if (!qrCode) {
        return res.status(400).json({ error: "QR code is required" });
      }
      
      const customer = await storage.getCustomerByQRCode(qrCode);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const checkedIn = await storage.checkInCustomer(customer.id);
      res.json(checkedIn);
    } catch (error) {
      res.status(500).json({ error: "Failed to check-in customer" });
    }
  });

  // Check-in by phone
  app.post("/api/check-in/phone", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      const customer = await storage.getCustomerByPhone(phone);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const checkedIn = await storage.checkInCustomer(customer.id);
      res.json(checkedIn);
    } catch (error) {
      res.status(500).json({ error: "Failed to check-in customer" });
    }
  });

  // Check-in by email
  app.post("/api/check-in/email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }
      
      const normalizedEmail = email.trim().toLowerCase();
      const customer = await storage.getCustomerByEmail(normalizedEmail);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const checkedIn = await storage.checkInCustomer(customer.id);
      res.json(checkedIn);
    } catch (error) {
      res.status(500).json({ error: "Failed to check-in customer" });
    }
  });


  // Get all form fields (public - needed by guest check-in form)
  app.get("/api/form-fields", async (req, res) => {
    try {
      const fields = await storage.getFormFields();
      res.json(fields);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch form fields" });
    }
  });

  // Create form field (protected)
  app.post("/api/form-fields", requireAuth, async (req, res) => {
    try {
      const data = insertFormFieldSchema.parse(req.body);
      const field = await storage.createFormField(data);
      res.status(201).json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid field data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create form field" });
    }
  });

  // Reorder form fields (protected) — must come before /:id route
  app.put("/api/form-fields/reorder", requireAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "ids must be an array" });
      }
      await storage.reorderFormFields(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder form fields" });
    }
  });

  // Update form field (protected)
  app.put("/api/form-fields/:id", requireAuth, async (req, res) => {
    try {
      const data = insertFormFieldSchema.partial().parse(req.body);
      const field = await storage.updateFormField(req.params.id, data);
      if (!field) {
        return res.status(404).json({ error: "Form field not found" });
      }
      res.json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid field data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update form field" });
    }
  });

  // Delete form field (protected)
  app.delete("/api/form-fields/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteFormField(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Form field not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete form field" });
    }
  });

  // Import customers (bulk create) (protected)
  app.post("/api/customers/import", requireAuth, async (req, res) => {
    try {
      const { customers: customersData } = req.body;
      if (!Array.isArray(customersData)) {
        return res.status(400).json({ error: "Invalid data format" });
      }

      const results = [];
      for (const data of customersData) {
        try {
          const validated = insertCustomerSchema.parse(data);
          const customer = await storage.createCustomer(validated);
          results.push(customer);
        } catch (error) {
          console.error("Failed to import customer:", error);
        }
      }

      res.status(201).json({ imported: results.length, customers: results });
    } catch (error) {
      res.status(500).json({ error: "Failed to import customers" });
    }
  });

  // Visitor analytics (protected)
  app.get("/api/analytics/visitors", requireAuth, async (req, res) => {
    try {
      const { start, end, bucket = "day" } = req.query as Record<string, string>;
      if (!start || !end) return res.status(400).json({ error: "start and end are required" });
      const validBuckets = ["day", "week", "month"];
      if (!validBuckets.includes(bucket)) return res.status(400).json({ error: "Invalid bucket" });
      const startDate = new Date(start);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      const data = await storage.getVisitorAnalytics(startDate, endDate, bucket as "day" | "week" | "month");
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Get monthly check-in statistics (public - allows viewing stats without login)
  app.get("/api/stats/monthly-checkins", async (req, res) => {
    try {
      const stats = await storage.getMonthlyCheckIns();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch monthly check-in stats" });
    }
  });

  // Database setup endpoints (protected)
  app.post("/api/setup/init-schema", requireAuth, async (req, res) => {
    try {
      await storage.initSchema();
      res.json({ message: "Database schema initialized successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to initialize schema" });
    }
  });

  app.post("/api/setup/import-sql", requireAuth, async (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql || typeof sql !== 'string') {
        return res.status(400).json({ error: "SQL data is required" });
      }
      const result = await storage.importFromSQL(sql);
      const message = result.inserted > 0 
        ? `Successfully imported ${result.inserted} customers${result.skipped > 0 ? `, ${result.skipped} duplicates skipped` : ''}`
        : `All ${result.skipped} customers already exist (duplicates skipped)`;
      res.json({ 
        message,
        inserted: result.inserted,
        skipped: result.skipped
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to import data" });
    }
  });

  // CAPTCHA mode endpoint (public, no-cache) — tells the frontend whether to show visible widget
  app.get("/api/captcha-mode", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      let mode: "invisible" | "visible" = "visible";
      try {
        const settings = await storage.getPageSettings("guest_checkin_page");
        const start = settings.captchaBypassStart;
        const end = settings.captchaBypassEnd;
        if (start && end) {
          const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
          if (today >= start && today <= end) mode = "invisible";
        }
      } catch {
        // if settings not found, default to visible
      }
      res.json({ mode, token: makeTimingToken() });
    } catch (error) {
      res.status(500).json({ error: "Failed to determine CAPTCHA mode" });
    }
  });

  // Security status (protected) — returns which bot-protection secrets are active, no values exposed
  app.get("/api/admin/security-status", requireAuth, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      turnstile: !!process.env.TURNSTILE_SECRET_KEY && !!process.env.VITE_TURNSTILE_SITE_KEY,
      hmacTiming: !!process.env.FINGERPRINT_HMAC_SECRET,
      rateLimit: true, // always active, no key required
    });
  });

  // Bot-protection stats (protected) — in-memory counters, reset daily
  app.get("/api/admin/bot-stats", requireAuth, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(getBotStats());
  });

  // Get page settings (public)
  app.get("/api/page-settings/:key", async (req, res) => {
    try {
      const settings = await storage.getPageSettings(req.params.key);
      res.json(settings);
    } catch (error: any) {
      res.status(404).json({ error: error.message || "Page settings not found" });
    }
  });

  // Update page settings (protected)
  app.put("/api/page-settings/:key", requireAuth, async (req, res) => {
    try {
      const { title, description, successMessage, successTitle, eventName, eventDate, eventLocation, captchaBypassStart, captchaBypassEnd } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: "title and description are required" });
      }
      const settings = await storage.upsertPageSettings(req.params.key, {
        title,
        description,
        successMessage: successMessage || null,
        successTitle: successTitle || null,
        eventName: eventName || null,
        eventDate: eventDate || null,
        eventLocation: eventLocation || null,
        captchaBypassStart: captchaBypassStart || null,
        captchaBypassEnd: captchaBypassEnd || null,
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update page settings" });
    }
  });

  // Get all leads (protected)
  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      const allLeads = await storage.getAllLeads();
      res.json(allLeads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Update a lead (protected)
  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = insertLeadSchema.partial();
      const data = updateSchema.parse(req.body);
      const updated = await storage.updateLead(id, data);
      if (!updated) return res.status(404).json({ error: "Lead not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Delete a lead (protected)
  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deletedLead = await storage.deleteLead(id);
      if (!deletedLead) return res.status(404).json({ error: "Lead not found" });
      if (deletedLead.customerId) {
        await storage.deleteCustomer(deletedLead.customerId);
      }
      res.json({ deleted: true, id });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // Guest registration (rate limited)
  // Atomic public guest check-in: runs all bot checks once, then creates lead + customer.
  // Single endpoint eliminates Turnstile token reuse (tokens are single-use).
  app.post("/api/guest-checkin", guestCheckinLimiter, async (req, res) => {
    try {
      const { _hp, _ft, "cf-turnstile-response": cfToken, ...body } = req.body;

      // 1. Honeypot — fake success, zero DB work
      if (_hp) {
        recordBlock("honeypot", req.ip);
        return res.status(201).json({ id: "ok" });
      }
      // 2. Headless UA
      if (isHeadlessUA(req.headers["user-agent"])) {
        recordBlock("ua", req.ip);
        return res.status(403).json({ error: "Request blocked." });
      }
      // 3. Timing token (required when secret is configured)
      if (process.env.FINGERPRINT_HMAC_SECRET) {
        if (!_ft) {
          recordBlock("timing", req.ip);
          return res.status(403).json({ error: "Submission rejected. Please reload the page and try again." });
        }
        const check = validateTimingToken(_ft as string);
        if (!check.ok) {
          recordBlock("timing", req.ip);
          return res.status(403).json({ error: "Submission rejected. Please reload the page and try again." });
        }
      }
      // 4. Cloudflare Turnstile — verified exactly once per submission
      //    Both keys must be present for enforcement (site key drives the widget;
      //    secret key drives server verification — partial config is treated as inactive)
      if (process.env.TURNSTILE_SECRET_KEY && process.env.VITE_TURNSTILE_SITE_KEY) {
        if (!cfToken) {
          recordBlock("turnstile", req.ip);
          return res.status(403).json({ error: "CAPTCHA verification required." });
        }
        const ip = req.ip ?? "unknown";
        const valid = await verifyTurnstile(cfToken as string, ip);
        if (!valid) {
          recordBlock("turnstile", req.ip);
          return res.status(403).json({ error: "CAPTCHA verification failed. Please try again." });
        }
      }

      // ── DB writes (only reached by legitimate users) ─────────────────────────
      // 1. Lead record
      const leadData = insertLeadSchema.parse({
        title: body.title ?? null,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phoneNumber: body.phoneNumber,
        company: body.company ?? null,
        acePoc: body.acePoc ?? null,
        eventName: body.eventName ?? null,
        photoData: body.photoData ?? null,
        plusOneCount: body.plusOneCount ?? 0,
        documentsAgreed: body.documentsAgreed ?? null,
      });
      await storage.createLead(leadData);

      // 2. Customer create + check-in (fall back to email look-up if already registered)
      const fullName = `${leadData.firstName} ${leadData.lastName}`.trim();
      let customer = null;
      try {
        const customerData = insertCustomerSchema.parse({
          name: fullName,
          email: body.email,
          phone: body.phoneNumber || undefined,
          status: "checked-in",
        });
        const created = await storage.createCustomer(customerData);
        customer = await storage.checkInCustomer(created.id);
      } catch {
        // Customer may already exist — look up and check in by email
        const existing = await storage.getCustomerByEmail(body.email);
        if (existing) {
          customer = await storage.checkInCustomer(existing.id);
        }
      }

      res.status(201).json(customer ?? { name: fullName });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  // Legacy guest-register endpoint — kept for backward compatibility (e.g. existing QR flows).
  // The primary check-in form now uses /api/guest-checkin which verifies Turnstile.
  // Turnstile is intentionally absent here: the token was already consumed by /api/guest-checkin
  // when called via the normal form flow, and re-verifying a single-use token always fails.
  // Honeypot + UA + timing together defend this path against automated abuse.
  app.post("/api/guest-register", guestRegisterLimiter, async (req, res) => {
    try {
      // ── Bot protection checks ───────────────────────────────────────────────
      // 1. Honeypot
      if (req.body._hp) {
        recordBlock("honeypot", req.ip);
        return res.status(201).json({ id: "ok" });
      }
      // 2. Headless UA
      if (isHeadlessUA(req.headers["user-agent"])) {
        recordBlock("ua", req.ip);
        return res.status(403).json({ error: "Request blocked." });
      }
      // 3. Timing token (required when secret is configured)
      const timingToken = req.body._ft as string | undefined;
      if (process.env.FINGERPRINT_HMAC_SECRET) {
        if (!timingToken) {
          recordBlock("timing", req.ip);
          return res.status(403).json({ error: "Submission rejected. Please reload the page and try again." });
        }
        const check = validateTimingToken(timingToken);
        if (!check.ok) {
          recordBlock("timing", req.ip);
          return res.status(403).json({ error: "Submission rejected. Please reload the page and try again." });
        }
      }
      // Note: Turnstile is NOT verified on this legacy path. The primary check-in
      // flow uses /api/guest-checkin which verifies Turnstile exactly once atomically.
      // Honeypot, UA, and timing together prevent direct-call bypass here.
      // ─────────────────────────────────────────────────────────────────────────

      const { metadata, _hp, _ft, "cf-turnstile-response": _cftr, ...rest } = req.body;
      const data = insertCustomerSchema.parse(rest);
      const customerData = {
        ...data,
        metadata: metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : undefined,
      };
      const customer = await storage.createCustomer(customerData);
      const checkedIn = await storage.checkInCustomer(customer.id);
      res.status(201).json(checkedIn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to register and check in" });
    }
  });


  // ── CRM routes (protected) ────────────────────────────────────────────────

  app.get("/api/crm/companies", requireAuth, async (req, res) => {
    try {
      const data = await storage.getAllCompanies();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/crm/companies/:id", requireAuth, async (req, res) => {
    try {
      const data = await storage.getCompanyById(req.params.id);
      if (!data) return res.status(404).json({ error: "Company not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  app.get("/api/crm/contacts", requireAuth, async (req, res) => {
    try {
      const data = await storage.getAllContacts();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.get("/api/crm/contacts/:id", requireAuth, async (req, res) => {
    try {
      const data = await storage.getContactById(req.params.id);
      if (!data) return res.status(404).json({ error: "Contact not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contact" });
    }
  });

  // ── Documents endpoints ──────────────────────────────────────────────────────

  // Get documents — public only for ?enabled=true (kiosk); full list requires auth
  app.get("/api/documents", async (req, res) => {
    try {
      const enabledOnly = req.query.enabled === "true";
      if (!enabledOnly && !(req as any).session?.authenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const docs = enabledOnly ? await storage.getEnabledDocuments() : await storage.getAllDocuments();
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Create document (protected)
  app.post("/api/documents", requireAuth, async (req, res) => {
    try {
      const data = insertDocumentSchema.parse(req.body);
      const doc = await storage.createDocument(data);
      res.status(201).json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // Reorder documents (protected) — must come before /:id route
  app.put("/api/documents/reorder", requireAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "ids must be an array" });
      }
      await storage.reorderDocuments(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder documents" });
    }
  });

  // Update document (protected)
  app.put("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const data = insertDocumentSchema.partial().parse(req.body);
      const doc = await storage.updateDocument(req.params.id, data);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  // Delete document (protected)
  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteDocument(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // ── Kiosk check-in settings ───────────────────────────────────────────────────

  // Get kiosk settings (public - for kiosk page)
  app.get("/api/kiosk/settings", async (req, res) => {
    try {
      const settings = await storage.getKioskSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kiosk settings" });
    }
  });

  // Update kiosk settings (protected)
  app.put("/api/kiosk/settings", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        photoEnabled: z.boolean().optional(),
        plusOneEnabled: z.boolean().optional(),
        kioskTimeoutSeconds: z.number().int().min(5).max(300).optional(),
      });
      const data = schema.parse(req.body);
      const settings = await storage.updateKioskSettings(data);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update kiosk settings" });
    }
  });

  // ── Kiosk device registry ─────────────────────────────────────────────────────

  // Register a device (public - called on first kiosk load)
  app.post("/api/kiosk/register", async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId || typeof deviceId !== "string") {
        return res.status(400).json({ error: "deviceId is required" });
      }
      const ua = req.headers["user-agent"];
      const ip = req.ip;
      const device = await storage.registerKioskDevice(deviceId, ua, ip);
      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to register device" });
    }
  });

  // Heartbeat (public - called every 30s by kiosk)
  app.post("/api/kiosk/heartbeat", async (req, res) => {
    try {
      const { deviceId, status } = req.body;
      if (!deviceId || typeof deviceId !== "string") {
        return res.status(400).json({ error: "deviceId is required" });
      }
      const validStatus = ["idle", "active"].includes(status) ? status : "idle";
      const device = await storage.heartbeatKioskDevice(deviceId, validStatus);
      if (!device) {
        // Device not found — re-register it
        const ua = req.headers["user-agent"];
        const ip = req.ip;
        const registered = await storage.registerKioskDevice(deviceId, ua, ip);
        return res.json(registered);
      }
      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to send heartbeat" });
    }
  });

  // List devices (protected)
  app.get("/api/kiosk/devices", requireAuth, async (req, res) => {
    try {
      const devices = await storage.getAllKioskDevices();
      // Compute status: offline if lastSeen > 2 minutes ago
      const now = Date.now();
      const enriched = devices.map((d) => {
        const lastSeenMs = new Date(d.lastSeen).getTime();
        const diffMs = now - lastSeenMs;
        let computedStatus = d.status;
        if (diffMs > 2 * 60 * 1000) computedStatus = "offline";
        return { ...d, computedStatus };
      });
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  // Rename device (protected)
  app.put("/api/kiosk/devices/:id", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      const device = await storage.updateKioskDevice(req.params.id, { name: name ?? null });
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to update device" });
    }
  });

  // Delete device (protected)
  app.delete("/api/kiosk/devices/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteKioskDevice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device" });
    }
  });

  // ── Kiosk check-in submission (public, bypasses bot-protection) ──────────────
  // This endpoint is for kiosk devices only. Anti-bot tokens (_hp, _ft, Turnstile)
  // are not applicable on a supervised iPad at reception. Rate-limited per IP.
  const kioskCheckinLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: "Too many requests. Please wait a moment." });
    },
  });

  app.post("/api/kiosk/checkin", kioskCheckinLimiter, async (req, res) => {
    try {
      const body = req.body;
      const leadData = insertLeadSchema.parse({
        title: body.title ?? null,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phoneNumber: body.phoneNumber,
        company: body.company ?? null,
        acePoc: body.acePoc ?? null,
        eventName: null,
        photoData: body.photoData ?? null,
        plusOneCount: body.plusOneCount ?? 0,
        documentsAgreed: body.documentsAgreed ?? null,
      });
      await storage.createLead(leadData);

      const fullName = `${leadData.firstName} ${leadData.lastName}`.trim();
      let customer = null;
      try {
        const customerData = insertCustomerSchema.parse({
          name: fullName,
          email: body.email,
          phone: body.phoneNumber || undefined,
          status: "checked-in",
        });
        const created = await storage.createCustomer(customerData);
        customer = await storage.checkInCustomer(created.id);
      } catch {
        const existing = await storage.getCustomerByEmail(body.email);
        if (existing) {
          customer = await storage.checkInCustomer(existing.id);
        }
      }

      res.status(201).json(customer ?? { name: fullName });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  // Custom domain root redirect: registration.aceelectronics.com → /guest-check-in
  app.get("/", (req, res, next) => {
    const host = req.hostname || "";
    if (host.includes("registration.aceelectronics.com")) {
      return res.redirect(302, "/guest-check-in");
    }
    next();
  });

  const httpServer = createServer(app);
  return httpServer;
}

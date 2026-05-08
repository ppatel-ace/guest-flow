import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertFormFieldSchema, insertLeadSchema } from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";

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

  // Guest registration and check-in (public)
  app.post("/api/guest-register", async (req, res) => {
    try {
      const { metadata, ...rest } = req.body;
      const data = insertCustomerSchema.parse(rest);
      
      // Attach extra field data as JSON string
      const customerData = {
        ...data,
        metadata: metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : undefined,
      };
      
      // Create the customer
      const customer = await storage.createCustomer(customerData);
      
      // Automatically check them in
      const checkedIn = await storage.checkInCustomer(customer.id);
      
      res.status(201).json(checkedIn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to register and check in" });
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
      const { title, description, successMessage, successTitle, eventName, eventDate, eventLocation } = req.body;
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

  // Create a lead (public - called from guest check-in form)
  app.post("/api/leads", async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);
      // Auto-attach the current event name from page settings
      if (!data.eventName) {
        try {
          const pageSettings = await storage.getPageSettings("guest_checkin_page");
          if (pageSettings?.eventName) {
            data.eventName = pageSettings.eventName;
          }
        } catch {
          // If we can't get page settings, proceed without event name
        }
      }
      const lead = await storage.createLead(data);
      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid lead data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save lead" });
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

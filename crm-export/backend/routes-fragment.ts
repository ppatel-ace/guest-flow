// ─────────────────────────────────────────────────────────────────────────────
// CRM ROUTES FRAGMENT — paste into your server/routes.ts (inside registerRoutes)
// Replace `requireAuth` with your own authentication middleware if named differently.
// ─────────────────────────────────────────────────────────────────────────────

/*
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
*/

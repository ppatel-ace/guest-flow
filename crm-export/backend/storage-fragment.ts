// ─────────────────────────────────────────────────────────────────────────────
// CRM STORAGE FRAGMENT — paste these interfaces and methods into your storage.ts
// ─────────────────────────────────────────────────────────────────────────────

// 1. Add these interfaces near the top of storage.ts (alongside your existing ones):

export interface CompanyWithStats {
  id: string;
  name: string;
  createdAt: Date;
  contactCount: number;
  visitCount: number;
  lastEventName: string | null;
  lastVisitedAt: Date | null;
}

export interface ContactWithStats {
  id: string;
  companyId: string | null;
  companyName: string | null;
  title: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  acePoc: string | null;
  createdAt: Date;
  visitCount: number;
  lastEventName: string | null;
  lastVisitedAt: Date | null;
}

export interface VisitDetail {
  id: string;
  eventName: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  acePoc: string | null;
  visitedAt: Date;
}

export interface ContactDetail {
  id: string;
  companyId: string | null;
  companyName: string | null;
  title: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  acePoc: string | null;
  createdAt: Date;
  visits: VisitDetail[];
}

export interface AcePocFrequency {
  acePoc: string;
  count: number;
}

export interface CompanyDetail {
  id: string;
  name: string;
  createdAt: Date;
  contacts: ContactDetail[];
  acePocFrequency: AcePocFrequency[];
  totalVisits: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Add these methods to your IStorage interface:
// ─────────────────────────────────────────────────────────────────────────────

//   findContactByEmail(email: string): Promise<Contact | undefined>;
//   upsertCompanyByName(name: string): Promise<Company>;
//   upsertContactByEmail(data: InsertContact): Promise<Contact>;
//   createVisit(data: InsertVisit): Promise<Visit>;
//   getAllCompanies(): Promise<CompanyWithStats[]>;
//   getCompanyById(id: string): Promise<CompanyDetail | undefined>;
//   getAllContacts(): Promise<ContactWithStats[]>;
//   getContactById(id: string): Promise<ContactDetail | undefined>;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Add these method implementations to your DatabaseStorage class:
//    (assumes you import: companies, contacts, visits, Company, Contact, Visit,
//     InsertContact, InsertVisit from your schema, and eq, sql, asc, desc from drizzle-orm)
// ─────────────────────────────────────────────────────────────────────────────

/*
  async findContactByEmail(email: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.email, email.trim().toLowerCase()));
    return contact || undefined;
  }

  async upsertCompanyByName(name: string): Promise<Company> {
    const normalized = name.trim();
    const [existing] = await db
      .select()
      .from(companies)
      .where(sql`LOWER(${companies.name}) = LOWER(${normalized})`);
    if (existing) return existing;
    const [created] = await db.insert(companies).values({ name: normalized }).returning();
    return created;
  }

  async upsertContactByEmail(data: InsertContact): Promise<Contact> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const [existing] = await db.select().from(contacts).where(eq(contacts.email, normalizedEmail));

    if (existing) {
      const updateData: Partial<InsertContact> = {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || existing.phone,
        title: data.title || existing.title,
        acePoc: data.acePoc || existing.acePoc,
      };
      if (!existing.companyId && data.companyId) {
        updateData.companyId = data.companyId;
      }
      const [updated] = await db.update(contacts).set(updateData).where(eq(contacts.id, existing.id)).returning();
      return updated;
    }

    const [created] = await db.insert(contacts).values({ ...data, email: normalizedEmail }).returning();
    return created;
  }

  async createVisit(data: InsertVisit): Promise<Visit> {
    const [visit] = await db.insert(visits).values(data).returning();
    return visit;
  }

  async getAllCompanies(): Promise<CompanyWithStats[]> {
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        createdAt: companies.createdAt,
        contactCount: sql<number>`COUNT(DISTINCT ${contacts.id})::int`,
        visitCount: sql<number>`COUNT(DISTINCT ${visits.id})::int`,
        lastEventName: sql<string | null>`(
          SELECT event_name FROM visits WHERE company_id = ${companies.id}
          ORDER BY visited_at DESC LIMIT 1
        )`,
        lastVisitedAt: sql<Date | null>`MAX(${visits.visitedAt})`,
      })
      .from(companies)
      .leftJoin(contacts, eq(contacts.companyId, companies.id))
      .leftJoin(visits, eq(visits.companyId, companies.id))
      .groupBy(companies.id, companies.name, companies.createdAt)
      .orderBy(desc(sql`COUNT(DISTINCT ${visits.id})`));
    return rows as CompanyWithStats[];
  }

  async getCompanyById(id: string): Promise<CompanyDetail | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) return undefined;

    const companyContacts = await db.select().from(contacts).where(eq(contacts.companyId, id)).orderBy(asc(contacts.firstName));

    const contactDetails: ContactDetail[] = await Promise.all(
      companyContacts.map(async (c) => {
        const contactVisits = await db.select().from(visits).where(eq(visits.contactId, c.id)).orderBy(desc(visits.visitedAt));
        return {
          ...c,
          companyName: company.name,
          visits: contactVisits.map(v => ({ id: v.id, eventName: v.eventName, eventDate: v.eventDate, eventLocation: v.eventLocation, acePoc: v.acePoc, visitedAt: v.visitedAt })),
        };
      })
    );

    const allVisits = await db.select({ acePoc: visits.acePoc }).from(visits).where(eq(visits.companyId, id));
    const pocMap = new Map<string, number>();
    for (const v of allVisits) {
      if (v.acePoc) pocMap.set(v.acePoc, (pocMap.get(v.acePoc) ?? 0) + 1);
    }
    const acePocFrequency = Array.from(pocMap.entries()).map(([acePoc, count]) => ({ acePoc, count })).sort((a, b) => b.count - a.count);
    const totalVisits = contactDetails.reduce((sum, c) => sum + c.visits.length, 0);

    return { id: company.id, name: company.name, createdAt: company.createdAt, contacts: contactDetails, acePocFrequency, totalVisits };
  }

  async getAllContacts(): Promise<ContactWithStats[]> {
    const rows = await db
      .select({
        id: contacts.id,
        companyId: contacts.companyId,
        companyName: companies.name,
        title: contacts.title,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        acePoc: contacts.acePoc,
        createdAt: contacts.createdAt,
        visitCount: sql<number>`COUNT(DISTINCT ${visits.id})::int`,
        lastEventName: sql<string | null>`(
          SELECT event_name FROM visits WHERE contact_id = ${contacts.id}
          ORDER BY visited_at DESC LIMIT 1
        )`,
        lastVisitedAt: sql<Date | null>`MAX(${visits.visitedAt})`,
      })
      .from(contacts)
      .leftJoin(companies, eq(companies.id, contacts.companyId))
      .leftJoin(visits, eq(visits.contactId, contacts.id))
      .groupBy(contacts.id, companies.name)
      .orderBy(desc(sql`MAX(${visits.visitedAt})`));
    return rows as ContactWithStats[];
  }

  async getContactById(id: string): Promise<ContactDetail | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    if (!contact) return undefined;

    let companyName: string | null = null;
    if (contact.companyId) {
      const [company] = await db.select().from(companies).where(eq(companies.id, contact.companyId));
      companyName = company?.name ?? null;
    }

    const contactVisits = await db.select().from(visits).where(eq(visits.contactId, id)).orderBy(desc(visits.visitedAt));

    return {
      ...contact,
      companyName,
      visits: contactVisits.map(v => ({ id: v.id, eventName: v.eventName, eventDate: v.eventDate, eventLocation: v.eventLocation, acePoc: v.acePoc, visitedAt: v.visitedAt })),
    };
  }
*/

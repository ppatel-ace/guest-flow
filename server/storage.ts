import {
  customers, pageSettings, formFields, leads, companies, contacts, visits,
  documents, kioskDevices, visitors, visitorNotes, visitorMergeEvents,
  type Customer, type InsertCustomer,
  type PageSettings, type InsertPageSettings,
  type FormField, type InsertFormField,
  type Lead, type InsertLead,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type Visit, type InsertVisit,
  type Document, type InsertDocument,
  type KioskDevice, type InsertKioskDevice,
  type Visitor, type InsertVisitor,
  type VisitorNote,
  type VisitorMergeEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, or, ilike, sql, asc, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface MonthlyCheckIn {
  month: string;
  count: number;
  walkIns: number;
}

export interface VisitorAnalyticsPeriod {
  period: string;
  visitors: number;
  invites: number;
}

export interface VisitorAnalyticsResult {
  periods: VisitorAnalyticsPeriod[];
  hourly: { hour: number; label: string; count: number }[];
  avgVisitDurationMinutes: number | null;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
}

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

export interface KioskCheckinSettings {
  photoEnabled: boolean;
  plusOneEnabled: boolean;
  kioskTimeoutSeconds: number;
}

const PAGE_DEFAULTS: Record<string, Omit<InsertPageSettings, 'key'>> = {
  scan_page: {
    title: "Welcome!",
    description: "Please scan the QR code with your phone to check in",
    successMessage: null,
    successTitle: null,
    eventName: null,
    eventDate: null,
    eventLocation: null,
    captchaBypassStart: null,
    captchaBypassEnd: null,
    photoEnabled: false,
    plusOneEnabled: false,
    kioskTimeoutSeconds: 30,
  },
  guest_checkin_page: {
    title: "Check-In",
    description: "Enter your phone number or email address to check in",
    successMessage: "You have been successfully checked in",
    successTitle: "Welcome!",
    eventName: null,
    eventDate: null,
    eventLocation: null,
    captchaBypassStart: null,
    captchaBypassEnd: null,
    photoEnabled: false,
    plusOneEnabled: false,
    kioskTimeoutSeconds: 30,
  },
  kiosk_settings: {
    title: "Kiosk",
    description: "Tablet kiosk check-in",
    successMessage: "Thank you for checking in!",
    successTitle: "Welcome!",
    eventName: null,
    eventDate: null,
    eventLocation: null,
    captchaBypassStart: null,
    captchaBypassEnd: null,
    photoEnabled: false,
    plusOneEnabled: false,
    kioskTimeoutSeconds: 30,
  },
};

export interface IStorage {
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomerByQRCode(qrCode: string): Promise<Customer | undefined>;
  getAllCustomers(): Promise<Customer[]>;
  searchCustomers(term: string): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
  updateCustomerStatus(id: string, status: 'pending' | 'confirmed' | 'checked-in'): Promise<Customer | undefined>;
  checkInCustomer(id: string): Promise<Customer | undefined>;
  sendInvitation(id: string): Promise<Customer | undefined>;
  getMonthlyCheckIns(): Promise<MonthlyCheckIn[]>;
  getVisitorAnalytics(start: Date, end: Date, bucket: 'day' | 'week' | 'month'): Promise<VisitorAnalyticsResult>;
  initSchema(): Promise<void>;
  importFromSQL(sql: string): Promise<ImportResult>;
  getPageSettings(key: string): Promise<PageSettings>;
  upsertPageSettings(key: string, data: Omit<InsertPageSettings, 'key'>): Promise<PageSettings>;
  getFormFields(): Promise<FormField[]>;
  createFormField(data: InsertFormField): Promise<FormField>;
  updateFormField(id: string, data: Partial<InsertFormField>): Promise<FormField | undefined>;
  deleteFormField(id: string): Promise<boolean>;
  reorderFormFields(ids: string[]): Promise<void>;
  getAllLeads(): Promise<Lead[]>;
  createLead(data: InsertLead): Promise<Lead>;
  updateLead(id: string, data: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<Lead | undefined>;
  // Documents
  getAllDocuments(): Promise<Document[]>;
  getEnabledDocuments(): Promise<Document[]>;
  createDocument(data: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  reorderDocuments(ids: string[]): Promise<void>;
  // Kiosk settings
  getKioskSettings(): Promise<KioskCheckinSettings>;
  updateKioskSettings(data: Partial<KioskCheckinSettings>): Promise<KioskCheckinSettings>;
  // Kiosk devices
  registerKioskDevice(deviceId: string, userAgent: string | undefined, ipAddress: string | undefined): Promise<KioskDevice>;
  heartbeatKioskDevice(deviceId: string, status: string): Promise<KioskDevice | undefined>;
  getAllKioskDevices(): Promise<KioskDevice[]>;
  updateKioskDevice(id: string, data: { name?: string }): Promise<KioskDevice | undefined>;
  deleteKioskDevice(id: string): Promise<boolean>;
  // CRM
  findContactByEmail(email: string): Promise<Contact | undefined>;
  upsertCompanyByName(name: string): Promise<Company>;
  upsertContactByEmail(data: InsertContact): Promise<Contact>;
  createVisit(data: InsertVisit): Promise<Visit>;
  getAllCompanies(): Promise<CompanyWithStats[]>;
  getCompanyById(id: string): Promise<CompanyDetail | undefined>;
  getAllContacts(): Promise<ContactWithStats[]>;
  getContactById(id: string): Promise<ContactDetail | undefined>;
  // Visitors (kiosk / Envoy walk-ins)
  lookupVisitorByEmail(email: string): Promise<{ fullName: string; email: string | null; phoneNumber: string | null; company: string | null; acePoc: string | null } | null>;
  createVisitor(data: InsertVisitor): Promise<Visitor>;
  getAllVisitors(): Promise<Visitor[]>;
  bulkImportVisitors(rows: InsertVisitor[]): Promise<{ inserted: number; skipped: number }>;
  getVisitorProfile(email?: string, name?: string): Promise<{
    stats: { totalVisits: number; firstVisited: Date | null; lastVisited: Date | null; avgDurationMinutes: number | null };
    visits: Visitor[];
  }>;
  getVisitorNotes(lookupKey: string): Promise<VisitorNote | undefined>;
  upsertVisitorNotes(lookupKey: string, notes: string): Promise<VisitorNote>;
  mergeVisitorContacts(primaryKey: string, secondaryKey: string): Promise<{ merged: number }>;
  getVisitorMergeEvents(lookupKey: string): Promise<VisitorMergeEvent[]>;
  updateVisitorsByKey(lookupKey: string, data: { fullName?: string; email?: string | null; company?: string | null }): Promise<{ updated: number }>;
  deleteVisitorsByKey(lookupKey: string): Promise<{ deleted: number }>;
}

export class DatabaseStorage implements IStorage {
  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone));
    return customer || undefined;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const [customer] = await db.select().from(customers).where(eq(customers.email, normalizedEmail));
    return customer || undefined;
  }

  async getCustomerByQRCode(qrCode: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.qrCode, qrCode));
    return customer || undefined;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(sql`LOWER(${customers.name})`);
  }

  async searchCustomers(term: string): Promise<Customer[]> {
    return await db.select().from(customers).where(
      or(
        ilike(customers.name, `%${term}%`),
        ilike(customers.email, `%${term}%`),
        ilike(customers.phone, `%${term}%`)
      )
    );
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const qrCode = `QR_${randomUUID()}`;
    const normalizedData = {
      ...insertCustomer,
      email: insertCustomer.email.trim().toLowerCase(),
      qrCode
    };
    const [customer] = await db.insert(customers).values(normalizedData).returning();
    return customer;
  }

  async updateCustomerStatus(id: string, status: 'pending' | 'confirmed' | 'checked-in'): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set({ status }).where(eq(customers.id, id)).returning();
    return customer || undefined;
  }

  async checkInCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set({ status: 'checked-in', checkedInAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  async sendInvitation(id: string): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set({ invitedAt: new Date(), status: 'confirmed' })
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const updateData: any = { ...customerData };
    if (customerData.email) updateData.email = customerData.email.trim().toLowerCase();
    const [customer] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return customer || undefined;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  async getVisitorAnalytics(start: Date, end: Date, bucket: 'day' | 'week' | 'month'): Promise<VisitorAnalyticsResult> {
    const b = bucket;
    const bucketLiteral = sql.raw(`'${b}'`);
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    const [visitorRows, inviteRows, hourlyRows, durationRows] = await Promise.all([
      db.select({
        period: sql<string>`TO_CHAR(DATE_TRUNC(${bucketLiteral}, ${visitors.signedInAt}), 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
      }).from(visitors)
        .where(sql`${visitors.signedInAt} >= ${startStr}::timestamptz AND ${visitors.signedInAt} <= ${endStr}::timestamptz`)
        .groupBy(sql`DATE_TRUNC(${bucketLiteral}, ${visitors.signedInAt})`),

      db.select({
        period: sql<string>`TO_CHAR(DATE_TRUNC(${bucketLiteral}, ${customers.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
      }).from(customers)
        .where(sql`${customers.createdAt} >= ${startStr}::timestamptz AND ${customers.createdAt} <= ${endStr}::timestamptz`)
        .groupBy(sql`DATE_TRUNC(${bucketLiteral}, ${customers.createdAt})`),

      db.select({
        hour: sql<number>`EXTRACT(HOUR FROM ${visitors.signedInAt})::int`,
        count: sql<number>`COUNT(*)::int`,
      }).from(visitors)
        .where(sql`${visitors.signedInAt} >= ${startStr}::timestamptz AND ${visitors.signedInAt} <= ${endStr}::timestamptz`)
        .groupBy(sql`EXTRACT(HOUR FROM ${visitors.signedInAt})`),

      db.select({
        avgMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${visitors.signedOutAt} - ${visitors.signedInAt})) / 60.0)`,
      }).from(visitors)
        .where(sql`${visitors.signedOutAt} IS NOT NULL AND ${visitors.signedInAt} >= ${startStr}::timestamptz AND ${visitors.signedInAt} <= ${endStr}::timestamptz`),
    ]);

    const periodsMap = new Map<string, { visitors: number; invites: number }>();
    visitorRows.forEach(r => {
      if (r.period) {
        const e = periodsMap.get(r.period) ?? { visitors: 0, invites: 0 };
        e.visitors = r.count;
        periodsMap.set(r.period, e);
      }
    });
    inviteRows.forEach(r => {
      if (r.period) {
        const e = periodsMap.get(r.period) ?? { visitors: 0, invites: 0 };
        e.invites = r.count;
        periodsMap.set(r.period, e);
      }
    });

    const hourlyMap = new Map(hourlyRows.map(r => [r.hour, r.count]));
    const hourly = Array.from({ length: 11 }, (_, i) => {
      const h = i + 8;
      const label = h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`;
      return { hour: h, label, count: hourlyMap.get(h) ?? 0 };
    });

    const rawAvg = durationRows[0]?.avgMinutes;
    const avgVisitDurationMinutes = (rawAvg != null && !isNaN(Number(rawAvg)))
      ? Math.round(Number(rawAvg))
      : null;

    return {
      periods: Array.from(periodsMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, data]) => ({ period, ...data })),
      hourly,
      avgVisitDurationMinutes,
    };
  }

  async getMonthlyCheckIns(): Promise<MonthlyCheckIn[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString();

    const [checkInResults, walkInResults] = await Promise.all([
      db.select({
        month: sql<string>`TO_CHAR(${customers.checkedInAt}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(customers)
      .where(sql`${customers.checkedInAt} IS NOT NULL AND ${customers.checkedInAt} >= ${twelveMonthsAgoStr}::timestamptz`)
      .groupBy(sql`TO_CHAR(${customers.checkedInAt}, 'YYYY-MM')`),

      db.select({
        month: sql<string>`TO_CHAR(${visitors.signedInAt}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(visitors)
      .where(sql`${visitors.signedInAt} >= ${twelveMonthsAgoStr}::timestamptz`)
      .groupBy(sql`TO_CHAR(${visitors.signedInAt}, 'YYYY-MM')`),
    ]);

    const checkInsMap = new Map<string, number>();
    const walkInsMap = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      checkInsMap.set(monthKey, 0);
      walkInsMap.set(monthKey, 0);
    }
    checkInResults.forEach(r => { if (r.month) checkInsMap.set(r.month, r.count); });
    walkInResults.forEach(r => { if (r.month) walkInsMap.set(r.month, r.count); });

    return Array.from(checkInsMap.keys()).map(month => ({
      month,
      count: checkInsMap.get(month) ?? 0,
      walkIns: walkInsMap.get(month) ?? 0,
    }));
  }

  async initSchema(): Promise<void> {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE customer_status AS ENUM ('pending', 'confirmed', 'checked-in');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      CREATE TABLE IF NOT EXISTS customers (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        phone text,
        status customer_status NOT NULL DEFAULT 'pending',
        qr_code text NOT NULL UNIQUE,
        invited_at timestamp,
        checked_in_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
  }

  async importFromSQL(sqlStatements: string): Promise<ImportResult> {
    const statements = sqlStatements
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.toUpperCase().startsWith('INSERT'));

    if (statements.length === 0) {
      throw new Error('No valid INSERT statements found in SQL data');
    }

    let inserted = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
        inserted++;
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error';
        const isDuplicate = errorMsg.toLowerCase().includes('duplicate') ||
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('already exists');
        if (isDuplicate) {
          skipped++;
        } else {
          throw new Error(`Import failed: ${errorMsg}. Successfully imported ${inserted} customers before failure.`);
        }
      }
    }

    console.log(`Import completed: ${inserted} inserted, ${skipped} duplicates skipped`);
    return { inserted, skipped };
  }

  async getPageSettings(key: string): Promise<PageSettings> {
    const [row] = await db.select().from(pageSettings).where(eq(pageSettings.key, key));
    if (row) return row;
    const defaults = PAGE_DEFAULTS[key];
    if (!defaults) throw new Error(`Unknown page settings key: ${key}`);
    return { key, ...defaults, updatedAt: new Date() } as PageSettings;
  }

  async upsertPageSettings(key: string, data: Omit<InsertPageSettings, 'key'>): Promise<PageSettings> {
    const [row] = await db
      .insert(pageSettings)
      .values({ key, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pageSettings.key,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async getFormFields(): Promise<FormField[]> {
    return await db.select().from(formFields).orderBy(asc(formFields.sortOrder), asc(formFields.createdAt));
  }

  async createFormField(data: InsertFormField): Promise<FormField> {
    const existing = await this.getFormFields();
    const nextOrder = existing.length;
    const [field] = await db.insert(formFields).values({ ...data, sortOrder: nextOrder }).returning();
    return field;
  }

  async updateFormField(id: string, data: Partial<InsertFormField>): Promise<FormField | undefined> {
    const [field] = await db.update(formFields).set(data).where(eq(formFields.id, id)).returning();
    return field || undefined;
  }

  async deleteFormField(id: string): Promise<boolean> {
    const result = await db.delete(formFields).where(eq(formFields.id, id)).returning();
    return result.length > 0;
  }

  async reorderFormFields(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db.update(formFields).set({ sortOrder: i }).where(eq(formFields.id, ids[i]));
    }
  }

  async getAllLeads(): Promise<Lead[]> {
    return await db.select().from(leads).orderBy(sql`${leads.submittedAt} DESC`);
  }

  async createLead(data: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(data).returning();
    return lead;
  }

  async updateLead(id: string, data: Partial<InsertLead>): Promise<Lead | undefined> {
    const [lead] = await db.update(leads).set(data).where(eq(leads.id, id)).returning();
    return lead || undefined;
  }

  async deleteLead(id: string): Promise<Lead | undefined> {
    const [deleted] = await db.delete(leads).where(eq(leads.id, id)).returning();
    return deleted || undefined;
  }

  // ─── Documents ───────────────────────────────────────────────────────────────

  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents).orderBy(asc(documents.sortOrder), asc(documents.createdAt));
  }

  async getEnabledDocuments(): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.enabled, true))
      .orderBy(asc(documents.sortOrder), asc(documents.createdAt));
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const existing = await this.getAllDocuments();
    const nextOrder = existing.length;
    const [doc] = await db.insert(documents).values({ ...data, sortOrder: nextOrder }).returning();
    return doc;
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const [doc] = await db.update(documents).set(data).where(eq(documents.id, id)).returning();
    return doc || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }

  async reorderDocuments(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db.update(documents).set({ sortOrder: i }).where(eq(documents.id, ids[i]));
    }
  }

  // ─── Kiosk settings ──────────────────────────────────────────────────────────

  async getKioskSettings(): Promise<KioskCheckinSettings> {
    const row = await this.getPageSettings('kiosk_settings');
    return {
      photoEnabled: row.photoEnabled ?? false,
      plusOneEnabled: row.plusOneEnabled ?? false,
      kioskTimeoutSeconds: row.kioskTimeoutSeconds ?? 30,
    };
  }

  async updateKioskSettings(data: Partial<KioskCheckinSettings>): Promise<KioskCheckinSettings> {
    const existing = await this.getKioskSettings();
    const merged = { ...existing, ...data };
    const defaults = PAGE_DEFAULTS['kiosk_settings'];
    await this.upsertPageSettings('kiosk_settings', {
      ...defaults,
      photoEnabled: merged.photoEnabled,
      plusOneEnabled: merged.plusOneEnabled,
      kioskTimeoutSeconds: merged.kioskTimeoutSeconds,
    });
    return merged;
  }

  // ─── Kiosk devices ────────────────────────────────────────────────────────────

  async registerKioskDevice(deviceId: string, userAgent: string | undefined, ipAddress: string | undefined): Promise<KioskDevice> {
    const [existing] = await db.select().from(kioskDevices).where(eq(kioskDevices.deviceId, deviceId));
    if (existing) {
      const [updated] = await db
        .update(kioskDevices)
        .set({ lastSeen: new Date(), userAgent: userAgent ?? existing.userAgent, ipAddress: ipAddress ?? existing.ipAddress })
        .where(eq(kioskDevices.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(kioskDevices).values({
      deviceId,
      name: null,
      status: 'idle',
      lastSeen: new Date(),
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    }).returning();
    return created;
  }

  async heartbeatKioskDevice(deviceId: string, status: string): Promise<KioskDevice | undefined> {
    const [device] = await db.select().from(kioskDevices).where(eq(kioskDevices.deviceId, deviceId));
    if (!device) return undefined;
    const [updated] = await db
      .update(kioskDevices)
      .set({ lastSeen: new Date(), status })
      .where(eq(kioskDevices.id, device.id))
      .returning();
    return updated || undefined;
  }

  async getAllKioskDevices(): Promise<KioskDevice[]> {
    return await db.select().from(kioskDevices).orderBy(desc(kioskDevices.lastSeen));
  }

  async updateKioskDevice(id: string, data: { name?: string }): Promise<KioskDevice | undefined> {
    const [updated] = await db.update(kioskDevices).set(data).where(eq(kioskDevices.id, id)).returning();
    return updated || undefined;
  }

  async deleteKioskDevice(id: string): Promise<boolean> {
    const result = await db.delete(kioskDevices).where(eq(kioskDevices.id, id)).returning();
    return result.length > 0;
  }

  // ─── CRM ────────────────────────────────────────────────────────────────────

  async findContactByEmail(email: string): Promise<Contact | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const [contact] = await db.select().from(contacts).where(eq(contacts.email, normalizedEmail));
    return contact ?? undefined;
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
    const [existing] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.email, normalizedEmail));

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
      const [updated] = await db
        .update(contacts)
        .set(updateData)
        .where(eq(contacts.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(contacts)
      .values({ ...data, email: normalizedEmail })
      .returning();
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

    const companyContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.companyId, id))
      .orderBy(asc(contacts.firstName));

    const contactDetails: ContactDetail[] = await Promise.all(
      companyContacts.map(async (c) => {
        const contactVisits = await db
          .select()
          .from(visits)
          .where(eq(visits.contactId, c.id))
          .orderBy(desc(visits.visitedAt));

        return {
          ...c,
          companyName: company.name,
          visits: contactVisits.map(v => ({
            id: v.id,
            eventName: v.eventName,
            eventDate: v.eventDate,
            eventLocation: v.eventLocation,
            acePoc: v.acePoc,
            visitedAt: v.visitedAt,
          })),
        };
      })
    );

    const allVisits = await db
      .select({ acePoc: visits.acePoc })
      .from(visits)
      .where(eq(visits.companyId, id));

    const pocMap = new Map<string, number>();
    for (const v of allVisits) {
      if (v.acePoc) pocMap.set(v.acePoc, (pocMap.get(v.acePoc) ?? 0) + 1);
    }
    const acePocFrequency: AcePocFrequency[] = Array.from(pocMap.entries())
      .map(([acePoc, count]) => ({ acePoc, count }))
      .sort((a, b) => b.count - a.count);

    const totalVisits = contactDetails.reduce((sum, c) => sum + c.visits.length, 0);

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      contacts: contactDetails,
      acePocFrequency,
      totalVisits,
    };
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

    const contactVisits = await db
      .select()
      .from(visits)
      .where(eq(visits.contactId, id))
      .orderBy(desc(visits.visitedAt));

    return {
      ...contact,
      companyName,
      visits: contactVisits.map(v => ({
        id: v.id,
        eventName: v.eventName,
        eventDate: v.eventDate,
        eventLocation: v.eventLocation,
        acePoc: v.acePoc,
        visitedAt: v.visitedAt,
      })),
    };
  }

  // ─── Visitors (kiosk / Envoy walk-ins) ───────────────────────────────────────

  async lookupVisitorByEmail(email: string): Promise<{ fullName: string; email: string | null; phoneNumber: string | null; company: string | null; acePoc: string | null } | null> {
    const normalized = email.trim().toLowerCase();
    const [row] = await db
      .select()
      .from(visitors)
      .where(sql`LOWER(${visitors.email}) = ${normalized}`)
      .orderBy(desc(visitors.signedInAt))
      .limit(1);
    if (!row) return null;
    return {
      fullName: row.fullName,
      email: row.email,
      phoneNumber: row.phoneNumber ?? null,
      company: row.company,
      acePoc: row.acePoc,
    };
  }

  async createVisitor(data: InsertVisitor): Promise<Visitor> {
    const [visitor] = await db.insert(visitors).values(data).returning();
    return visitor;
  }

  async getAllVisitors(): Promise<Visitor[]> {
    return await db.select().from(visitors).orderBy(desc(visitors.signedInAt));
  }

  async getVisitorProfile(email?: string, name?: string): Promise<{
    stats: { totalVisits: number; firstVisited: Date | null; lastVisited: Date | null; avgDurationMinutes: number | null };
    visits: Visitor[];
  }> {
    let rows: Visitor[] = [];
    if (email) {
      rows = await db.select().from(visitors)
        .where(sql`LOWER(${visitors.email}) = LOWER(${email})`)
        .orderBy(desc(visitors.signedInAt));
    } else if (name) {
      rows = await db.select().from(visitors)
        .where(sql`LOWER(${visitors.fullName}) = LOWER(${name})`)
        .orderBy(desc(visitors.signedInAt));
    }
    if (rows.length === 0) {
      return { stats: { totalVisits: 0, firstVisited: null, lastVisited: null, avgDurationMinutes: null }, visits: [] };
    }
    const sorted = [...rows].sort((a, b) => new Date(a.signedInAt).getTime() - new Date(b.signedInAt).getTime());
    const firstVisited = sorted[0].signedInAt;
    const lastVisited = sorted[sorted.length - 1].signedInAt;
    const withDuration = rows.filter(r => r.signedOutAt);
    const avgDurationMinutes = withDuration.length > 0
      ? Math.round(withDuration.reduce((sum, r) => {
          return sum + (new Date(r.signedOutAt!).getTime() - new Date(r.signedInAt).getTime()) / 60000;
        }, 0) / withDuration.length)
      : null;
    return {
      stats: { totalVisits: rows.length, firstVisited, lastVisited, avgDurationMinutes },
      visits: rows,
    };
  }

  async getVisitorNotes(lookupKey: string): Promise<VisitorNote | undefined> {
    const [row] = await db.select().from(visitorNotes).where(eq(visitorNotes.lookupKey, lookupKey));
    return row;
  }

  async upsertVisitorNotes(lookupKey: string, notes: string): Promise<VisitorNote> {
    const existing = await this.getVisitorNotes(lookupKey);
    if (existing) {
      const [updated] = await db.update(visitorNotes)
        .set({ notes, updatedAt: new Date() })
        .where(eq(visitorNotes.lookupKey, lookupKey))
        .returning();
      return updated;
    }
    const [inserted] = await db.insert(visitorNotes)
      .values({ lookupKey, notes, updatedAt: new Date() })
      .returning();
    return inserted;
  }

  async mergeVisitorContacts(primaryKey: string, secondaryKey: string): Promise<{ merged: number }> {
    // Find primary's most recent visitor row to get the canonical identity
    const primaryRows = primaryKey.includes('@')
      ? await db.select().from(visitors).where(sql`LOWER(${visitors.email}) = ${primaryKey}`).orderBy(desc(visitors.signedInAt))
      : await db.select().from(visitors).where(sql`LOWER(${visitors.fullName}) = ${primaryKey}`).orderBy(desc(visitors.signedInAt));

    if (primaryRows.length === 0) throw new Error('Primary contact not found');
    const primaryRep = primaryRows[0];

    // Capture secondary identity BEFORE updating rows (for audit record)
    const secondaryRows = secondaryKey.includes('@')
      ? await db.select().from(visitors).where(sql`LOWER(${visitors.email}) = ${secondaryKey}`).orderBy(desc(visitors.signedInAt))
      : await db.select().from(visitors).where(sql`LOWER(${visitors.fullName}) = ${secondaryKey}`).orderBy(desc(visitors.signedInAt));
    const secondaryRep = secondaryRows[0] ?? null;

    // Update all secondary visitor rows to use the primary's identity
    let updatedRows: { id: string }[] = [];
    if (secondaryKey.includes('@')) {
      updatedRows = await db.update(visitors)
        .set({ fullName: primaryRep.fullName, email: primaryRep.email, company: primaryRep.company })
        .where(sql`LOWER(${visitors.email}) = ${secondaryKey}`)
        .returning({ id: visitors.id });
    } else {
      updatedRows = await db.update(visitors)
        .set({ fullName: primaryRep.fullName, email: primaryRep.email, company: primaryRep.company })
        .where(sql`LOWER(${visitors.fullName}) = ${secondaryKey}`)
        .returning({ id: visitors.id });
    }

    // Merge internal notes: append secondary's notes onto primary's, then clear secondary
    const [primaryNotes, secondaryNotes] = await Promise.all([
      this.getVisitorNotes(primaryKey),
      this.getVisitorNotes(secondaryKey),
    ]);
    if (secondaryNotes && secondaryNotes.notes.trim()) {
      const combined = primaryNotes?.notes.trim()
        ? `${primaryNotes.notes}\n\n---\n\n${secondaryNotes.notes}`
        : secondaryNotes.notes;
      await this.upsertVisitorNotes(primaryKey, combined);
      await this.upsertVisitorNotes(secondaryKey, '');
    }

    // Write merge audit record
    if (secondaryRep) {
      await db.insert(visitorMergeEvents).values({
        primaryKey,
        secondaryName: secondaryRep.fullName,
        secondaryEmail: secondaryRep.email ?? null,
        visitsMoved: updatedRows.length,
        mergedAt: new Date(),
      });
    }

    return { merged: updatedRows.length };
  }

  async getVisitorMergeEvents(lookupKey: string): Promise<VisitorMergeEvent[]> {
    return await db
      .select()
      .from(visitorMergeEvents)
      .where(eq(visitorMergeEvents.primaryKey, lookupKey))
      .orderBy(desc(visitorMergeEvents.mergedAt));
  }

  async updateVisitorsByKey(lookupKey: string, data: { fullName?: string; email?: string | null; company?: string | null }): Promise<{ updated: number }> {
    const isEmail = lookupKey.includes('@');
    let rows: { id: string }[];
    if (isEmail) {
      rows = await db.update(visitors)
        .set(data)
        .where(sql`LOWER(${visitors.email}) = ${lookupKey.toLowerCase()}`)
        .returning({ id: visitors.id });
    } else {
      rows = await db.update(visitors)
        .set(data)
        .where(sql`LOWER(${visitors.fullName}) = ${lookupKey.toLowerCase()}`)
        .returning({ id: visitors.id });
    }
    return { updated: rows.length };
  }

  async deleteVisitorsByKey(lookupKey: string): Promise<{ deleted: number }> {
    const isEmail = lookupKey.includes('@');
    let rows: { id: string }[];
    if (isEmail) {
      rows = await db.delete(visitors)
        .where(sql`LOWER(${visitors.email}) = ${lookupKey.toLowerCase()}`)
        .returning({ id: visitors.id });
    } else {
      rows = await db.delete(visitors)
        .where(sql`LOWER(${visitors.fullName}) = ${lookupKey.toLowerCase()}`)
        .returning({ id: visitors.id });
    }
    return { deleted: rows.length };
  }

  async bulkImportVisitors(rows: InsertVisitor[]): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;
    for (const row of rows) {
      // Deduplicate by (fullName, date of signedInAt)
      const signedInDate = row.signedInAt ? new Date(row.signedInAt) : new Date();
      const dateStr = signedInDate.toISOString().slice(0, 10);
      const [existing] = await db
        .select({ id: visitors.id })
        .from(visitors)
        .where(
          sql`LOWER(${visitors.fullName}) = LOWER(${row.fullName}) AND DATE(${visitors.signedInAt}) = ${dateStr}::date`
        );
      if (existing) {
        skipped++;
      } else {
        await db.insert(visitors).values(row);
        inserted++;
      }
    }
    return { inserted, skipped };
  }

}

export const storage = new DatabaseStorage();

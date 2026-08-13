import {
  customers, pageSettings, formFields, leads, companies, contacts, visits,
  documents, kioskDevices, printers, printJobs, visitors, visitorNotes, visitorMergeEvents, acePocs,
  type Customer, type InsertCustomer,
  type PageSettings, type InsertPageSettings,
  type FormField, type InsertFormField,
  type Lead, type InsertLead,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type Visit, type InsertVisit,
  type Document, type InsertDocument,
  type KioskDevice, type InsertKioskDevice,
  type Printer, type InsertPrinter,
  type PrintJob, type InsertPrintJob,
  type Visitor, type InsertVisitor,
  type VisitorNote,
  type VisitorMergeEvent,
  type AcePoc,
  type RecentCheckIn,
} from "@shared/schema";
import { db } from "./db";
import { syncCompanyToAceCrm, syncContactToAceCrm, syncVisitToAceCrm } from "./aceCrmSync";
import { eq, or, ilike, sql, asc, desc, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface MonthlyCheckIn {
  month: string;
  /** @deprecated use location breakdown fields */
  count: number;
  /** @deprecated use location breakdown fields */
  walkIns: number;
  newJersey: number;
  maryland: number;
  michigan: number;
}

export type LocationCountKey = "newJersey" | "maryland" | "michigan";

export interface VisitorAnalyticsPeriod {
  period: string;
  newJersey: number;
  maryland: number;
  michigan: number;
  /** Total visitors for the period (all locations including unknown). */
  total: number;
}

export interface VisitorAnalyticsHourly {
  hour: number;
  label: string;
  newJersey: number;
  maryland: number;
  michigan: number;
  count: number;
}

export interface VisitorAnalyticsResult {
  periods: VisitorAnalyticsPeriod[];
  hourly: VisitorAnalyticsHourly[];
  avgVisitDurationMinutes: number | null;
  byLocation: {
    newJersey: number;
    maryland: number;
    michigan: number;
    total: number;
  };
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
  labelPrinterEnabled: boolean;
  wifiCouponEnabled: boolean;
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
    labelPrinterEnabled: false,
    wifiCouponEnabled: false,
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
    labelPrinterEnabled: false,
    wifiCouponEnabled: false,
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
    labelPrinterEnabled: false,
    wifiCouponEnabled: false,
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
  getRecentCheckIns(limit?: number): Promise<RecentCheckIn[]>;
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
  registerKioskDevice(deviceId: string, userAgent: string | undefined, ipAddress: string | undefined, deviceType?: string, osVersion?: string, appVersion?: string, nativeDeviceName?: string): Promise<{ device: KioskDevice; isNew: boolean }>;
  heartbeatKioskDevice(deviceId: string, status: string, ipAddress?: string, appVersion?: string, deviceType?: string, osVersion?: string, nativeDeviceName?: string): Promise<KioskDevice | undefined>;
  getAllKioskDevices(): Promise<KioskDevice[]>;
  updateKioskDevice(id: string, data: { name?: string | null; defaultLocation?: string | null; locationSource?: string | null }): Promise<KioskDevice | undefined>;
  deleteKioskDevice(id: string): Promise<boolean>;
  deleteUnnamedKioskDevices(): Promise<number>;
  deleteAllKioskDevices(): Promise<number>;
  // Printers
  getAllPrinters(): Promise<Printer[]>;
  createPrinter(data: InsertPrinter): Promise<Printer>;
  updatePrinter(id: string, data: Partial<InsertPrinter> & { status?: string | null }): Promise<Printer | undefined>;
  deletePrinter(id: string): Promise<boolean>;
  createPrintJob(data: InsertPrintJob): Promise<PrintJob>;
  getPendingPrintJobs(limit?: number): Promise<PrintJob[]>;
  markPrintJobStatus(id: string, status: string, attempts?: number, lastError?: string | null): Promise<PrintJob | undefined>;
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
  searchVisitorEmails(q: string): Promise<Array<{ email: string; name: string; company: string | null }>>;
  updateVisitorById(id: string, data: {
    fullName?: string;
    email?: string | null;
    phoneNumber?: string | null;
    company?: string | null;
    acePoc?: string | null;
    location?: string | null;
    purpose?: string | null;
    usCitizen?: string | null;
  }): Promise<Visitor | undefined>;
  createVisitor(data: InsertVisitor): Promise<Visitor>;
  autoCheckoutStaleVisitors(hours: number): Promise<number>;
  getAllVisitors(): Promise<Visitor[]>;
  getAutoCheckoutHours(): Promise<number>;
  setAutoCheckoutHours(hours: number): Promise<number>;
  bulkImportVisitors(rows: InsertVisitor[]): Promise<{ inserted: number; skipped: number; backfilled: number }>;
  countVisitorsMissingUsCitizen(): Promise<number>;
  getVisitorProfile(email?: string, name?: string): Promise<{
    stats: { totalVisits: number; firstVisited: Date | null; lastVisited: Date | null; avgDurationMinutes: number | null };
    visits: Visitor[];
  }>;
  getVisitorNotes(lookupKey: string): Promise<VisitorNote | undefined>;
  upsertVisitorNotes(lookupKey: string, notes: string): Promise<VisitorNote>;
  mergeVisitorContacts(primaryKey: string, secondaryKey: string): Promise<{ merged: number }>;
  getVisitorMergeEvents(lookupKey: string): Promise<VisitorMergeEvent[]>;
  updateVisitorsByKey(lookupKey: string, data: { fullName?: string; email?: string | null; company?: string | null; phoneNumber?: string | null }): Promise<{ updated: number }>;
  deleteVisitorsByKey(lookupKey: string): Promise<{ deleted: number }>;
  // ACE POC roster
  listAcePocs(location?: string | null): Promise<AcePoc[]>;
  createAcePoc(name: string, locations: string[]): Promise<AcePoc>;
  deleteAcePoc(id: string): Promise<boolean>;
  updateAcePocEmails(id: string, emails: string[]): Promise<AcePoc | undefined>;
  updateAcePocLocations(id: string, locations: string[]): Promise<AcePoc | undefined>;
  getAcePocByName(name: string): Promise<AcePoc | undefined>;
  // Global / per-location notification emails (page_settings keys)
  getNotificationEmails(): Promise<string[]>;
  setNotificationEmails(emails: string[]): Promise<void>;
  getNotificationEmailsByKey(key: string): Promise<string[]>;
  setNotificationEmailsByKey(key: string, title: string, emails: string[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private legacyVisitorCopyAttempted = false;

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

    // Canonicalise free-text location to NJ / MD / MI buckets
    const locationBucket = sql<string>`CASE
      WHEN LOWER(TRIM(COALESCE(${visitors.location}, ''))) IN ('new jersey', 'nj', 'n.j.') THEN 'newJersey'
      WHEN LOWER(TRIM(COALESCE(${visitors.location}, ''))) IN ('maryland', 'md', 'm.d.') THEN 'maryland'
      WHEN LOWER(TRIM(COALESCE(${visitors.location}, ''))) IN ('michigan', 'mi', 'm.i.') THEN 'michigan'
      ELSE 'other'
    END`;

    const [visitorRows, hourlyRows, durationRows] = await Promise.all([
      db.select({
        period: sql<string>`TO_CHAR(DATE_TRUNC(${bucketLiteral}, ${visitors.signedInAt}), 'YYYY-MM-DD')`,
        locationKey: locationBucket,
        count: sql<number>`COUNT(*)::int`,
      }).from(visitors)
        .where(sql`${visitors.signedInAt} >= ${startStr}::timestamptz AND ${visitors.signedInAt} <= ${endStr}::timestamptz`)
        .groupBy(sql`DATE_TRUNC(${bucketLiteral}, ${visitors.signedInAt})`, locationBucket),

      db.select({
        hour: sql<number>`EXTRACT(HOUR FROM ${visitors.signedInAt})::int`,
        locationKey: locationBucket,
        count: sql<number>`COUNT(*)::int`,
      }).from(visitors)
        .where(sql`${visitors.signedInAt} >= ${startStr}::timestamptz AND ${visitors.signedInAt} <= ${endStr}::timestamptz`)
        .groupBy(sql`EXTRACT(HOUR FROM ${visitors.signedInAt})`, locationBucket),

      db.select({
        avgMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${visitors.signedOutAt} - ${visitors.signedInAt})) / 60.0)`,
      }).from(visitors)
        .where(sql`${visitors.signedOutAt} IS NOT NULL AND ${visitors.signedInAt} >= ${startStr}::timestamptz AND ${visitors.signedInAt} <= ${endStr}::timestamptz`),
    ]);

    const emptyLoc = () => ({ newJersey: 0, maryland: 0, michigan: 0, other: 0 });

    const periodsMap = new Map<string, ReturnType<typeof emptyLoc>>();
    for (const r of visitorRows) {
      if (!r.period) continue;
      const e = periodsMap.get(r.period) ?? emptyLoc();
      const key = (r.locationKey as keyof ReturnType<typeof emptyLoc>) || "other";
      if (key in e) e[key] += r.count;
      else e.other += r.count;
      periodsMap.set(r.period, e);
    }

    const hourlyLocMap = new Map<number, ReturnType<typeof emptyLoc>>();
    for (const r of hourlyRows) {
      const e = hourlyLocMap.get(r.hour) ?? emptyLoc();
      const key = (r.locationKey as keyof ReturnType<typeof emptyLoc>) || "other";
      if (key in e) e[key] += r.count;
      else e.other += r.count;
      hourlyLocMap.set(r.hour, e);
    }

    const hourly = Array.from({ length: 11 }, (_, i) => {
      const h = i + 8;
      const label = h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`;
      const loc = hourlyLocMap.get(h) ?? emptyLoc();
      const count = loc.newJersey + loc.maryland + loc.michigan + loc.other;
      return {
        hour: h,
        label,
        newJersey: loc.newJersey,
        maryland: loc.maryland,
        michigan: loc.michigan,
        count,
      };
    });

    const rawAvg = durationRows[0]?.avgMinutes;
    const avgVisitDurationMinutes = (rawAvg != null && !isNaN(Number(rawAvg)))
      ? Math.round(Number(rawAvg))
      : null;

    const periods = Array.from(periodsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({
        period,
        newJersey: data.newJersey,
        maryland: data.maryland,
        michigan: data.michigan,
        total: data.newJersey + data.maryland + data.michigan + data.other,
      }));

    const byLocation = periods.reduce(
      (acc, p) => {
        acc.newJersey += p.newJersey;
        acc.maryland += p.maryland;
        acc.michigan += p.michigan;
        acc.total += p.total;
        return acc;
      },
      { newJersey: 0, maryland: 0, michigan: 0, total: 0 }
    );

    return {
      periods,
      hourly,
      avgVisitDurationMinutes,
      byLocation,
    };
  }

  async getMonthlyCheckIns(): Promise<MonthlyCheckIn[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString();

    const locationBucket = sql<string>`CASE
      WHEN LOWER(TRIM(COALESCE(${visitors.location}, ''))) IN ('new jersey', 'nj', 'n.j.') THEN 'newJersey'
      WHEN LOWER(TRIM(COALESCE(${visitors.location}, ''))) IN ('maryland', 'md', 'm.d.') THEN 'maryland'
      WHEN LOWER(TRIM(COALESCE(${visitors.location}, ''))) IN ('michigan', 'mi', 'm.i.') THEN 'michigan'
      ELSE 'other'
    END`;

    const [qrResults, walkInByLocation] = await Promise.all([
      db.select({
        month: sql<string>`TO_CHAR(${customers.checkedInAt}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(customers)
      .where(sql`${customers.checkedInAt} IS NOT NULL AND ${customers.checkedInAt} >= ${twelveMonthsAgoStr}::timestamptz`)
      .groupBy(sql`TO_CHAR(${customers.checkedInAt}, 'YYYY-MM')`),

      db.select({
        month: sql<string>`TO_CHAR(${visitors.signedInAt}, 'YYYY-MM')`,
        locationKey: locationBucket,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(visitors)
      .where(sql`${visitors.signedInAt} >= ${twelveMonthsAgoStr}::timestamptz`)
      .groupBy(sql`TO_CHAR(${visitors.signedInAt}, 'YYYY-MM')`, locationBucket),
    ]);

    type LocMonth = { newJersey: number; maryland: number; michigan: number; other: number; qr: number };
    const monthMap = new Map<string, LocMonth>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(monthKey, { newJersey: 0, maryland: 0, michigan: 0, other: 0, qr: 0 });
    }
    qrResults.forEach((r) => {
      if (!r.month) return;
      const e = monthMap.get(r.month) ?? { newJersey: 0, maryland: 0, michigan: 0, other: 0, qr: 0 };
      e.qr = r.count;
      monthMap.set(r.month, e);
    });
    walkInByLocation.forEach((r) => {
      if (!r.month) return;
      const e = monthMap.get(r.month) ?? { newJersey: 0, maryland: 0, michigan: 0, other: 0, qr: 0 };
      const key = r.locationKey as keyof LocMonth;
      if (key === "newJersey" || key === "maryland" || key === "michigan" || key === "other") {
        e[key] += r.count;
      } else {
        e.other += r.count;
      }
      monthMap.set(r.month, e);
    });

    return Array.from(monthMap.keys()).map((month) => {
      const e = monthMap.get(month)!;
      const walkIns = e.newJersey + e.maryland + e.michigan + e.other;
      return {
        month,
        count: e.qr,
        walkIns,
        newJersey: e.newJersey,
        maryland: e.maryland,
        michigan: e.michigan,
      };
    });
  }

  async getRecentCheckIns(limit = 10): Promise<RecentCheckIn[]> {
    const result = await db.execute(sql`
      SELECT full_name, email, company, location, checked_in_at, source
      FROM (
        SELECT c.name AS full_name, c.email AS email, NULL::text AS company,
               NULL::text AS location, c.checked_in_at AS checked_in_at, 'invite' AS source
        FROM gf_customers c
        WHERE c.checked_in_at IS NOT NULL
        UNION ALL
        SELECT v.full_name AS full_name, v.email AS email, v.company AS company,
               v.location AS location, v.signed_in_at AS checked_in_at,
               COALESCE(v.source, 'kiosk') AS source
        FROM gf_visitors v
        UNION ALL
        SELECT LTRIM(CONCAT_WS(' ', l.first_name, l.last_name)) AS full_name,
               l.email AS email, l.company AS company, l.location AS location,
               l.submitted_at AS checked_in_at, 'form' AS source
        FROM gf_leads l
      ) t
      ORDER BY t.checked_in_at DESC
      LIMIT ${limit}
    `);
    const raw: any = result as any;
    const rows: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    return rows.map((row) => ({
      fullName: row.full_name,
      email: row.email ?? null,
      company: row.company ?? null,
      location: row.location ?? null,
      checkedInAt: new Date(row.checked_in_at),
      source: row.source,
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
    if (Object.keys(data).length === 0) return undefined;
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
      labelPrinterEnabled: row.labelPrinterEnabled ?? false,
      wifiCouponEnabled: row.wifiCouponEnabled ?? false,
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
      labelPrinterEnabled: merged.labelPrinterEnabled,
      wifiCouponEnabled: merged.wifiCouponEnabled,
    });
    return merged;
  }

  // ─── Kiosk devices ────────────────────────────────────────────────────────────

  async registerKioskDevice(deviceId: string, userAgent: string | undefined, ipAddress: string | undefined, deviceType?: string, osVersion?: string, appVersion?: string, nativeDeviceName?: string): Promise<{ device: KioskDevice; isNew: boolean }> {
    const [existing] = await db.select().from(kioskDevices).where(eq(kioskDevices.deviceId, deviceId));
    if (existing) {
      const [updated] = await db
        .update(kioskDevices)
        .set({
          lastSeen: new Date(),
          userAgent: userAgent ?? existing.userAgent,
          ipAddress: ipAddress ?? existing.ipAddress,
          deviceType: deviceType ?? existing.deviceType,
          osVersion: osVersion ?? existing.osVersion,
          appVersion: appVersion ?? existing.appVersion,
          nativeDeviceName: nativeDeviceName ?? existing.nativeDeviceName,
        })
        .where(eq(kioskDevices.id, existing.id))
        .returning();
      return { device: updated, isNew: false };
    }
    const [created] = await db.insert(kioskDevices).values({
      deviceId,
      name: nativeDeviceName ?? null,
      status: 'idle',
      lastSeen: new Date(),
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      deviceType: deviceType ?? null,
      osVersion: osVersion ?? null,
      appVersion: appVersion ?? null,
      nativeDeviceName: nativeDeviceName ?? null,
    }).returning();
    return { device: created, isNew: true };
  }

  async heartbeatKioskDevice(deviceId: string, status: string, ipAddress?: string, appVersion?: string, deviceType?: string, osVersion?: string, nativeDeviceName?: string): Promise<KioskDevice | undefined> {
    const [device] = await db.select().from(kioskDevices).where(eq(kioskDevices.deviceId, deviceId));
    if (!device) return undefined;
    const updateData: Record<string, unknown> = { lastSeen: new Date(), status };
    if (ipAddress) updateData.ipAddress = ipAddress;
    if (appVersion) updateData.appVersion = appVersion;
    if (deviceType) updateData.deviceType = deviceType;
    if (osVersion) updateData.osVersion = osVersion;
    if (nativeDeviceName) updateData.nativeDeviceName = nativeDeviceName;
    const [updated] = await db
      .update(kioskDevices)
      .set(updateData)
      .where(eq(kioskDevices.id, device.id))
      .returning();
    return updated || undefined;
  }

  async getAllKioskDevices(): Promise<KioskDevice[]> {
    return await db.select().from(kioskDevices).orderBy(desc(kioskDevices.lastSeen));
  }

  async updateKioskDevice(id: string, data: { name?: string | null; defaultLocation?: string | null; locationSource?: string | null }): Promise<KioskDevice | undefined> {
    const [updated] = await db.update(kioskDevices).set(data).where(eq(kioskDevices.id, id)).returning();
    return updated || undefined;
  }

  async deleteKioskDevice(id: string): Promise<boolean> {
    const result = await db.delete(kioskDevices).where(eq(kioskDevices.id, id)).returning();
    return result.length > 0;
  }

  async deleteUnnamedKioskDevices(): Promise<number> {
    // Delete unnamed devices that haven't sent a heartbeat in the last 5 minutes (clearly offline)
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const result = await db.delete(kioskDevices).where(
      and(isNull(kioskDevices.name), sql`${kioskDevices.lastSeen} < ${cutoff}`)
    ).returning();
    return result.length;
  }

  async deleteAllKioskDevices(): Promise<number> {
    const result = await db.delete(kioskDevices).returning();
    return result.length;
  }

  // ─── Printers ────────────────────────────────────────────────────────────────

  async getAllPrinters(): Promise<Printer[]> {
    return await db.select().from(printers).orderBy(asc(printers.createdAt));
  }

  async createPrinter(data: InsertPrinter): Promise<Printer> {
    const [printer] = await db.insert(printers).values(data).returning();
    return printer;
  }

  async updatePrinter(id: string, data: Partial<InsertPrinter> & { status?: string | null }): Promise<Printer | undefined> {
    const updateData: any = { ...data };
    // allow nullable status updates
    if (typeof data.status === 'undefined') delete updateData.status;
    const [printer] = await db.update(printers).set(updateData).where(eq(printers.id, id)).returning();
    return printer || undefined;
  }

  async deletePrinter(id: string): Promise<boolean> {
    const result = await db.delete(printers).where(eq(printers.id, id)).returning();
    return result.length > 0;
  }

  async createPrintJob(data: InsertPrintJob): Promise<PrintJob> {
    const [job] = await db.insert(printJobs).values(data).returning();
    return job;
  }

  async getPendingPrintJobs(limit = 10): Promise<PrintJob[]> {
    return await db.select().from(printJobs).where(eq(printJobs.status, 'pending')).orderBy(asc(printJobs.createdAt)).limit(limit);
  }

  async markPrintJobStatus(id: string, status: string, attempts = 0, lastError: string | null = null): Promise<PrintJob | undefined> {
    const [job] = await db.update(printJobs).set({ status, attempts, lastError, updatedAt: new Date() }).where(eq(printJobs.id, id)).returning();
    return job || undefined;
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
    void syncCompanyToAceCrm(normalized, created.id);
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
    void syncContactToAceCrm({
      sourceId: created.id,
      companyName: data.companyId ? undefined : null,
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.email,
      phone: created.phone,
      title: created.title,
      acePoc: created.acePoc,
    });
    return created;
  }

  async createVisit(data: InsertVisit): Promise<Visit> {
    const [visit] = await db.insert(visits).values(data).returning();
    if (visit.contactId) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, visit.contactId));
      if (contact?.email) {
        void syncVisitToAceCrm({
          sourceId: visit.id,
          contactEmail: contact.email,
          eventName: visit.eventName,
          eventDate: visit.eventDate,
          eventLocation: visit.eventLocation,
          acePoc: visit.acePoc,
          customFields: visit.customFields,
          visitedAt: visit.visitedAt ?? new Date(),
        });
      }
    }
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
          SELECT event_name FROM gf_visits WHERE company_id = ${companies.id}
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
          SELECT event_name FROM gf_visits WHERE contact_id = ${contacts.id}
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

  async searchVisitorEmails(q: string): Promise<Array<{ email: string; name: string; company: string | null }>> {
    const term = q.trim().toLowerCase();
    if (term.length < 3) return [];
    const like = `${term}%`;
    const rows = await db
      .select({
        email: visitors.email,
        fullName: visitors.fullName,
        company: visitors.company,
        signedInAt: visitors.signedInAt,
      })
      .from(visitors)
      .where(and(
        sql`${visitors.email} IS NOT NULL`,
        sql`TRIM(${visitors.email}) <> ''`,
        sql`LOWER(${visitors.email}) LIKE ${like}`,
      ))
      .orderBy(desc(visitors.signedInAt))
      .limit(40);
    const seen = new Set<string>();
    const out: Array<{ email: string; name: string; company: string | null }> = [];
    for (const row of rows) {
      const email = (row.email || "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push({ email, name: row.fullName, company: row.company ?? null });
      if (out.length >= 8) break;
    }
    return out;
  }

  async updateVisitorById(id: string, data: {
    fullName?: string;
    email?: string | null;
    phoneNumber?: string | null;
    company?: string | null;
    acePoc?: string | null;
    location?: string | null;
    purpose?: string | null;
    usCitizen?: string | null;
  }): Promise<Visitor | undefined> {
    if (Object.keys(data).length === 0) return undefined;
    const [row] = await db.update(visitors).set(data).where(eq(visitors.id, id)).returning();
    return row;
  }

  async createVisitor(data: InsertVisitor): Promise<Visitor> {
    const [visitor] = await db.insert(visitors).values(data).returning();
    return visitor;
  }

  /**
   * Auto sign-out visitors still open past the configured duration.
   * signed_out_at is set to signed_in_at + hours so Duration is exact (not wall-clock job lag).
   */
  async autoCheckoutStaleVisitors(hours: number): Promise<number> {
    const safeHours = Math.max(1, Math.min(24 * 7, Math.floor(hours)));
    const result = await db.execute(sql`
      UPDATE gf_visitors
      SET signed_out_at = signed_in_at + make_interval(hours => ${safeHours})
      WHERE signed_out_at IS NULL
        AND signed_in_at <= now() - make_interval(hours => ${safeHours})
      RETURNING id
    `);
    const rows = Array.isArray(result)
      ? result
      : (result as { rows?: unknown[] }).rows ?? [];
    return rows.length;
  }

  async getAllVisitors(): Promise<Visitor[]> {
    try {
      const rows = await this.readVisitorListFromGf();
      if (rows.length > 0) return rows;
      await this.copyLegacyVisitorsIfEmpty();
      const afterCopy = await this.readVisitorListFromGf().catch(() => [] as Visitor[]);
      if (afterCopy.length > 0) return afterCopy;
    } catch (err) {
      console.error("[getAllVisitors] gf_visitors read failed:", err);
    }
    const legacy = await this.readVisitorListFromLegacyTable();
    if (legacy.length > 0) {
      console.warn(`[getAllVisitors] serving ${legacy.length} rows from legacy visitors table`);
    }
    return legacy;
  }

  private async copyLegacyVisitorsIfEmpty(): Promise<void> {
    if (this.legacyVisitorCopyAttempted) return;
    this.legacyVisitorCopyAttempted = true;
    try {
      await db.execute(sql`
        INSERT INTO gf_visitors (
          id, full_name, email, company, ace_poc, signed_in_at, signed_out_at,
          us_citizen, purpose, location, source, notes, photo_data, documents_agreed, created_at
        )
        SELECT
          id, full_name, email, company, ace_poc, signed_in_at, signed_out_at,
          us_citizen, purpose, location, COALESCE(NULLIF(source, ''), 'kiosk'),
          notes, photo_data, documents_agreed, COALESCE(created_at, now())
        FROM visitors
        ON CONFLICT (id) DO NOTHING
      `);
      console.log("[getAllVisitors] copied rows from legacy visitors into gf_visitors");
    } catch (err) {
      console.warn("[getAllVisitors] inline legacy copy skipped:", err);
    }
  }

  /** List payload omits photo_data blobs so Visitor Log / Contacts can load. */
  private async readVisitorListFromGf(): Promise<Visitor[]> {
    const base = {
      id: visitors.id,
      fullName: visitors.fullName,
      email: visitors.email,
      company: visitors.company,
      acePoc: visitors.acePoc,
      signedInAt: visitors.signedInAt,
      signedOutAt: visitors.signedOutAt,
      usCitizen: visitors.usCitizen,
      purpose: visitors.purpose,
      location: visitors.location,
      source: visitors.source,
      notes: visitors.notes,
      documentsAgreed: visitors.documentsAgreed,
      createdAt: visitors.createdAt,
    };
    try {
      const rows = await db
        .select({ ...base, phoneNumber: visitors.phoneNumber })
        .from(visitors)
        .orderBy(desc(visitors.signedInAt));
      return rows.map((r) => ({ ...r, photoData: null }));
    } catch (err) {
      console.error("[getAllVisitors] retry without phone_number:", err);
      const rows = await db.select(base).from(visitors).orderBy(desc(visitors.signedInAt));
      return rows.map((r) => ({ ...r, phoneNumber: null, photoData: null }));
    }
  }

  private async readVisitorListFromLegacyTable(): Promise<Visitor[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM visitors ORDER BY signed_in_at DESC NULLS LAST
      `);
      const raw: any[] = Array.isArray(result) ? result : (result as { rows?: any[] }).rows ?? [];
      return raw.map((row) => {
        const signedOut = row.signed_out_at ?? row.signedOutAt ?? null;
        const created = row.created_at ?? row.createdAt ?? null;
        return {
          id: String(row.id),
          fullName: String(row.full_name ?? row.fullName ?? ""),
          email: row.email ?? null,
          phoneNumber: row.phone_number ?? row.phoneNumber ?? null,
          company: row.company ?? null,
          acePoc: row.ace_poc ?? row.acePoc ?? null,
          signedInAt: new Date(row.signed_in_at ?? row.signedInAt),
          signedOutAt: signedOut ? new Date(signedOut) : null,
          usCitizen: row.us_citizen ?? row.usCitizen ?? null,
          purpose: row.purpose ?? null,
          location: row.location ?? null,
          source: row.source || "kiosk",
          notes: row.notes ?? null,
          photoData: null,
          documentsAgreed: row.documents_agreed ?? row.documentsAgreed ?? null,
          createdAt: created ? new Date(created) : new Date(),
        };
      });
    } catch (err) {
      console.warn("[getAllVisitors] legacy visitors table unavailable:", err);
      return [];
    }
  }

  async getAutoCheckoutHours(): Promise<number> {
    const [row] = await db
      .select()
      .from(pageSettings)
      .where(eq(pageSettings.key, "visitor_log_settings"));
    if (!row?.description) return 3;
    try {
      const parsed = JSON.parse(row.description) as { autoCheckoutHours?: number };
      const hours = Number(parsed.autoCheckoutHours);
      if (Number.isFinite(hours) && hours >= 1 && hours <= 168) return Math.floor(hours);
    } catch {
      // fall through
    }
    return 3;
  }

  async setAutoCheckoutHours(hours: number): Promise<number> {
    const safeHours = Math.max(1, Math.min(168, Math.floor(hours)));
    await this.upsertPageSettings("visitor_log_settings", {
      title: "Visitor Log Settings",
      description: JSON.stringify({ autoCheckoutHours: safeHours }),
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
      labelPrinterEnabled: false,
      wifiCouponEnabled: false,
    });
    return safeHours;
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
    let updatedRows: unknown[] = [];
    if (secondaryKey.includes('@')) {
      updatedRows = await db.update(visitors)
        .set({ fullName: primaryRep.fullName, email: primaryRep.email, company: primaryRep.company })
        .where(sql`LOWER(${visitors.email}) = ${secondaryKey}`)
        .returning();
    } else {
      updatedRows = await db.update(visitors)
        .set({ fullName: primaryRep.fullName, email: primaryRep.email, company: primaryRep.company })
        .where(sql`LOWER(${visitors.fullName}) = ${secondaryKey}`)
        .returning();
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

  async updateVisitorsByKey(lookupKey: string, data: { fullName?: string; email?: string | null; company?: string | null; phoneNumber?: string | null }): Promise<{ updated: number }> {
    const isEmail = lookupKey.includes('@');
    let rows: unknown[];
    if (isEmail) {
      rows = await db.update(visitors)
        .set(data)
        .where(sql`LOWER(${visitors.email}) = ${lookupKey.toLowerCase()}`)
        .returning();
    } else {
      rows = await db.update(visitors)
        .set(data)
        .where(sql`LOWER(${visitors.fullName}) = ${lookupKey.toLowerCase()}`)
        .returning();
    }
    return { updated: rows.length };
  }

  async deleteVisitorsByKey(lookupKey: string): Promise<{ deleted: number }> {
    const isEmail = lookupKey.includes('@');
    let rows: unknown[];

    await db.delete(visitorNotes)
      .where(sql`LOWER(${visitorNotes.lookupKey}) = ${lookupKey.toLowerCase()}`);

    await db.delete(visitorMergeEvents)
      .where(sql`LOWER(${visitorMergeEvents.primaryKey}) = ${lookupKey.toLowerCase()}`);

    if (isEmail) {
      rows = await db.delete(visitors)
        .where(sql`LOWER(${visitors.email}) = ${lookupKey.toLowerCase()}`)
        .returning();
    } else {
      rows = await db.delete(visitors)
        .where(sql`LOWER(${visitors.fullName}) = ${lookupKey.toLowerCase()}`)
        .returning();
    }
    return { deleted: rows.length };
  }

  async bulkImportVisitors(rows: InsertVisitor[]): Promise<{ inserted: number; skipped: number; backfilled: number }> {
    let inserted = 0;
    let skipped = 0;
    let backfilled = 0;
    for (const row of rows) {
      // Deduplicate by (fullName, date of signedInAt)
      const signedInDate = row.signedInAt ? new Date(row.signedInAt) : new Date();
      const dateStr = signedInDate.toISOString().slice(0, 10);
      const [existing] = await db
        .select({
          id: visitors.id,
          usCitizen: visitors.usCitizen,
          purpose: visitors.purpose,
          location: visitors.location,
          acePoc: visitors.acePoc,
          company: visitors.company,
        })
        .from(visitors)
        .where(
          sql`LOWER(${visitors.fullName}) = LOWER(${row.fullName}) AND DATE(${visitors.signedInAt}) = ${dateStr}::date`
        );
      if (existing) {
        // Backfill any nullable Envoy fields that are missing on the existing record
        const patch: Partial<typeof row> = {};
        if (!existing.usCitizen && row.usCitizen) patch.usCitizen = row.usCitizen;
        if (!existing.purpose && row.purpose) patch.purpose = row.purpose;
        if (!existing.location && row.location) patch.location = row.location;
        if (!existing.acePoc && row.acePoc) patch.acePoc = row.acePoc;
        if (!existing.company && row.company) patch.company = row.company;
        if (Object.keys(patch).length > 0) {
          await db
            .update(visitors)
            .set(patch)
            .where(eq(visitors.id, existing.id));
          backfilled++;
        } else {
          skipped++;
        }
      } else {
        await db.insert(visitors).values(row);
        inserted++;
      }
    }
    return { inserted, skipped, backfilled };
  }

  async countVisitorsMissingUsCitizen(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(visitors)
      .where(sql`${visitors.source} = 'envoy' AND (${visitors.usCitizen} IS NULL OR ${visitors.usCitizen} = '')`);
    return Number(row?.count ?? 0);
  }

  // ─── ACE POC roster ──────────────────────────────────────────────────────────

  async listAcePocs(location?: string | null): Promise<AcePoc[]> {
    if (location) {
      return await db
        .select()
        .from(acePocs)
        .where(sql`${location} = ANY(${acePocs.locations})`)
        .orderBy(asc(acePocs.name));
    }
    return await db.select().from(acePocs).orderBy(asc(acePocs.name));
  }

  async createAcePoc(name: string, locations: string[]): Promise<AcePoc> {
    const [row] = await db
      .insert(acePocs)
      .values({ name: name.trim(), locations })
      .returning();
    return row;
  }

  async deleteAcePoc(id: string): Promise<boolean> {
    const result = await db.delete(acePocs).where(eq(acePocs.id, id)).returning();
    return result.length > 0;
  }

  async updateAcePocEmails(id: string, emails: string[]): Promise<AcePoc | undefined> {
    const [row] = await db
      .update(acePocs)
      .set({ emails })
      .where(eq(acePocs.id, id))
      .returning();
    return row || undefined;
  }

  async updateAcePocLocations(id: string, locations: string[]): Promise<AcePoc | undefined> {
    const [row] = await db
      .update(acePocs)
      .set({ locations })
      .where(eq(acePocs.id, id))
      .returning();
    return row || undefined;
  }

  async getAcePocByName(name: string): Promise<AcePoc | undefined> {
    const [row] = await db.select().from(acePocs).where(eq(acePocs.name, name));
    return row || undefined;
  }

  // ─── Global notification emails ───────────────────────────────────────────────

  async getNotificationEmailsByKey(key: string): Promise<string[]> {
    const [row] = await db
      .select()
      .from(pageSettings)
      .where(eq(pageSettings.key, key));
    if (!row) return [];
    try {
      return JSON.parse(row.description) as string[];
    } catch {
      return [];
    }
  }

  async setNotificationEmailsByKey(key: string, title: string, emails: string[]): Promise<void> {
    await this.upsertPageSettings(key, {
      title,
      description: JSON.stringify(emails),
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
      labelPrinterEnabled: false,
      wifiCouponEnabled: false,
    });
  }

  async getNotificationEmails(): Promise<string[]> {
    return this.getNotificationEmailsByKey("notification_emails");
  }

  async setNotificationEmails(emails: string[]): Promise<void> {
    await this.setNotificationEmailsByKey("notification_emails", "Notification Emails", emails);
  }

}

export const storage = new DatabaseStorage();

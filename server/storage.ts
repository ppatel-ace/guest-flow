import { customers, pageSettings, formFields, leads, type Customer, type InsertCustomer, type PageSettings, type InsertPageSettings, type FormField, type InsertFormField, type Lead, type InsertLead } from "@shared/schema";
import { db } from "./db";
import { eq, or, ilike, sql, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface MonthlyCheckIn {
  month: string;
  count: number;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
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
  },
  guest_checkin_page: {
    title: "Check-In",
    description: "Enter your phone number or email address to check in",
    successMessage: "You have been successfully checked in",
    successTitle: "Welcome!",
    eventName: null,
    eventDate: null,
    eventLocation: null,
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
    const [customer] = await db
      .insert(customers)
      .values(normalizedData)
      .returning();
    return customer;
  }

  async updateCustomerStatus(id: string, status: 'pending' | 'confirmed' | 'checked-in'): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set({ status })
      .where(eq(customers.id, id))
      .returning();
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
    if (customerData.email) {
      updateData.email = customerData.email.trim().toLowerCase();
    }
    const [customer] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  async getMonthlyCheckIns(): Promise<MonthlyCheckIn[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const results = await db
      .select({
        month: sql<string>`TO_CHAR(${customers.checkedInAt}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(customers)
      .where(sql`${customers.checkedInAt} IS NOT NULL AND ${customers.checkedInAt} >= ${twelveMonthsAgo}`)
      .groupBy(sql`TO_CHAR(${customers.checkedInAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${customers.checkedInAt}, 'YYYY-MM')`);

    const monthsMap = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(monthKey, 0);
    }
    results.forEach(result => {
      if (result.month) monthsMap.set(result.month, result.count);
    });
    return Array.from(monthsMap.entries()).map(([month, count]) => ({ month, count }));
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
    const [field] = await db
      .insert(formFields)
      .values({ ...data, sortOrder: nextOrder })
      .returning();
    return field;
  }

  async updateFormField(id: string, data: Partial<InsertFormField>): Promise<FormField | undefined> {
    const [field] = await db
      .update(formFields)
      .set(data)
      .where(eq(formFields.id, id))
      .returning();
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
}

export const storage = new DatabaseStorage();

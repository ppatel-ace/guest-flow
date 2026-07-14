// ─────────────────────────────────────────────────────────────────────────────
// CRM SCHEMA FRAGMENT — paste into your shared/schema.ts
// Requires: drizzle-orm/pg-core, drizzle-zod, zod
// These tables are written by GuestFlow and shared via the Supabase database.
// ─────────────────────────────────────────────────────────────────────────────

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("gf_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export const contacts = pgTable("gf_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  title: text("title"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  acePoc: text("ace_poc"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const visits = pgTable("gf_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  companyId: varchar("company_id").references(() => companies.id),
  eventName: text("event_name"),
  eventDate: text("event_date"),
  eventLocation: text("event_location"),
  acePoc: text("ace_poc"),
  visitedAt: timestamp("visited_at").notNull().default(sql`now()`),
  customFields: text("custom_fields"),
});

export const insertVisitSchema = createInsertSchema(visits).omit({
  id: true,
  visitedAt: true,
});

export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visits.$inferSelect;

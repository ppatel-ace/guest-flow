import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const customerStatusEnum = pgEnum('customer_status', ['pending', 'confirmed', 'checked-in']);

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  status: customerStatusEnum("status").notNull().default('pending'),
  qrCode: text("qr_code").notNull().unique(),
  invitedAt: timestamp("invited_at"),
  checkedInAt: timestamp("checked_in_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  metadata: text("metadata"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  qrCode: true,
  createdAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const pageSettings = pgTable("page_settings", {
  key: varchar("key").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  successMessage: text("success_message"),
  successTitle: text("success_title"),
  eventName: text("event_name"),
  eventDate: text("event_date"),
  eventLocation: text("event_location"),
  captchaBypassStart: text("captcha_bypass_start"),
  captchaBypassEnd: text("captcha_bypass_end"),
  photoEnabled: boolean("photo_enabled").default(false),
  plusOneEnabled: boolean("plus_one_enabled").default(false),
  kioskTimeoutSeconds: integer("kiosk_timeout_seconds").default(30),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertPageSettingsSchema = createInsertSchema(pageSettings).omit({
  updatedAt: true,
});

export type InsertPageSettings = z.infer<typeof insertPageSettingsSchema>;
export type PageSettings = typeof pageSettings.$inferSelect;

export const formFields = pgTable("form_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull().default('text'),
  placeholder: text("placeholder"),
  required: boolean("required").notNull().default(false),
  options: text("options"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertFormFieldSchema = createInsertSchema(formFields).omit({
  id: true,
  createdAt: true,
});

export type InsertFormField = z.infer<typeof insertFormFieldSchema>;
export type FormField = typeof formFields.$inferSelect;

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phoneNumber: text("phone_number").notNull(),
  company: text("company"),
  acePoc: text("ace_poc"),
  eventName: text("event_name"),
  submittedAt: timestamp("submitted_at").notNull().default(sql`now()`),
  customerId: varchar("customer_id"),
  photoData: text("photo_data"),
  plusOneCount: integer("plus_one_count").default(0),
  documentsAgreed: text("documents_agreed"),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  submittedAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// ─── Documents table ──────────────────────────────────────────────────────────

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ─── Kiosk devices table ──────────────────────────────────────────────────────

export const kioskDevices = pgTable("kiosk_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().unique(),
  name: text("name"),
  status: text("status").notNull().default('idle'),
  lastSeen: timestamp("last_seen").notNull().default(sql`now()`),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertKioskDeviceSchema = createInsertSchema(kioskDevices).omit({
  id: true,
  createdAt: true,
});

export type InsertKioskDevice = z.infer<typeof insertKioskDeviceSchema>;
export type KioskDevice = typeof kioskDevices.$inferSelect;

// ─── CRM tables ───────────────────────────────────────────────────────────────

export const companies = pgTable("companies", {
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

export const contacts = pgTable("contacts", {
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

export const visits = pgTable("visits", {
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

// ─── Visitors table (kiosk / Envoy walk-ins) ──────────────────────────────────

export const visitors = pgTable("visitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email"),
  company: text("company"),
  acePoc: text("ace_poc"),
  signedInAt: timestamp("signed_in_at").notNull().default(sql`now()`),
  signedOutAt: timestamp("signed_out_at"),
  usCitizen: text("us_citizen"),
  purpose: text("purpose"),
  location: text("location"),
  source: text("source").notNull().default("kiosk"),
  notes: text("notes"),
  photoData: text("photo_data"),
  documentsAgreed: text("documents_agreed"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertVisitorSchema = createInsertSchema(visitors).omit({
  id: true,
  createdAt: true,
});

export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitors.$inferSelect;

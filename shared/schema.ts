import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const customerStatusEnum = pgEnum('customer_status', ['pending', 'confirmed', 'checked-in']);

export const customers = pgTable("gf_customers", {
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

export const pageSettings = pgTable("gf_page_settings", {
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
  labelPrinterEnabled: boolean("label_printer_enabled").default(false),
  wifiCouponEnabled: boolean("wifi_coupon_enabled").default(false),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertPageSettingsSchema = createInsertSchema(pageSettings).omit({
  updatedAt: true,
});

export type InsertPageSettings = z.infer<typeof insertPageSettingsSchema>;
export type PageSettings = typeof pageSettings.$inferSelect;

export const formFields = pgTable("gf_form_fields", {
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

export const leads = pgTable("gf_leads", {
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
  location: text("location"),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  submittedAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// ─── Documents table ──────────────────────────────────────────────────────────

export const documents = pgTable("gf_documents", {
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

export const kioskDevices = pgTable("gf_kiosk_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().unique(),
  name: text("name"),
  status: text("status").notNull().default('idle'),
  lastSeen: timestamp("last_seen").notNull().default(sql`now()`),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  defaultLocation: text("default_location"),
  locationSource: text("location_source"),
  deviceType: text("device_type"),
  osVersion: text("os_version"),
  appVersion: text("app_version"),
  nativeDeviceName: text("native_device_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertKioskDeviceSchema = createInsertSchema(kioskDevices).omit({
  id: true,
  createdAt: true,
});

export type InsertKioskDevice = z.infer<typeof insertKioskDeviceSchema>;
export type KioskDevice = typeof kioskDevices.$inferSelect;

// ─── Printers table ───────────────────────────────────────────────────────────

export const printers = pgTable("gf_printers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  model: text("model").notNull(),
  connectionType: text("connection_type").notNull().default('wifi'),
  ipAddress: text("ip_address"),
  port: integer("port"),
  status: text("status").notNull().default('offline'),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPrinterSchema = createInsertSchema(printers).omit({
  id: true,
  createdAt: true,
});

export type InsertPrinter = z.infer<typeof insertPrinterSchema>;
export type Printer = typeof printers.$inferSelect;

export const printJobs = pgTable("gf_print_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  printerId: varchar("printer_id").notNull(),
  labelText: text("label_text").notNull(),
  status: text("status").notNull().default('pending'),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertPrintJobSchema = createInsertSchema(printJobs).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertPrintJob = z.infer<typeof insertPrintJobSchema>;
export type PrintJob = typeof printJobs.$inferSelect;

// ─── CRM tables ───────────────────────────────────────────────────────────────

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

// ─── Visitors table (kiosk / Envoy walk-ins) ──────────────────────────────────

export const visitors = pgTable("gf_visitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phoneNumber: text("phone_number"),
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

// ─── Visitor notes (internal staff notes per visitor profile) ─────────────────

export const visitorNotes = pgTable("gf_visitor_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lookupKey: text("lookup_key").notNull().unique(),
  notes: text("notes").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export type VisitorNote = typeof visitorNotes.$inferSelect;

// ─── Visitor merge events (audit trail) ───────────────────────────────────────

export const visitorMergeEvents = pgTable("gf_visitor_merge_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryKey: text("primary_key").notNull(),
  secondaryName: text("secondary_name").notNull(),
  secondaryEmail: text("secondary_email"),
  visitsMoved: integer("visits_moved").notNull(),
  mergedAt: timestamp("merged_at").notNull().default(sql`now()`),
});

export type VisitorMergeEvent = typeof visitorMergeEvents.$inferSelect;

// ─── ACE POC roster ───────────────────────────────────────────────────────────

export const acePocs = pgTable("gf_ace_pocs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  emails: text("emails").array().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAcePocSchema = createInsertSchema(acePocs).omit({
  id: true,
  createdAt: true,
});

export type InsertAcePoc = z.infer<typeof insertAcePocSchema>;
export type AcePoc = typeof acePocs.$inferSelect;

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
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
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertPageSettingsSchema = createInsertSchema(pageSettings).omit({
  updatedAt: true,
});

export type InsertPageSettings = z.infer<typeof insertPageSettingsSchema>;
export type PageSettings = typeof pageSettings.$inferSelect;

import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Runs idempotent schema migrations at startup to ensure the database is
 * always in sync with the Drizzle schema, regardless of which database
 * (local PGHOST or remote DATABASE_URL) the server connects to.
 *
 * Each statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so re-runs are safe.
 */
export async function runMigrations(): Promise<void> {
  try {
    // Add columns to page_settings that were added in later schema versions
    await db.execute(sql`
      ALTER TABLE page_settings
        ADD COLUMN IF NOT EXISTS captcha_bypass_start text,
        ADD COLUMN IF NOT EXISTS captcha_bypass_end text,
        ADD COLUMN IF NOT EXISTS photo_enabled boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS plus_one_enabled boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS kiosk_timeout_seconds integer DEFAULT 30;
    `);

    // Add new columns to leads if they don't exist
    await db.execute(sql`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS photo_data text,
        ADD COLUMN IF NOT EXISTS plus_one_count integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS documents_agreed text;
    `);

    // Create documents table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS documents (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        content text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // Create kiosk_devices table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kiosk_devices (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id text NOT NULL UNIQUE,
        name text,
        status text NOT NULL DEFAULT 'idle',
        last_seen timestamp NOT NULL DEFAULT now(),
        user_agent text,
        ip_address text,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // Create CRM: companies table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS companies (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // Create CRM: contacts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS contacts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id varchar REFERENCES companies(id),
        title text,
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text NOT NULL UNIQUE,
        phone text,
        ace_poc text,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // Create CRM: visits table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS visits (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id varchar NOT NULL REFERENCES contacts(id),
        company_id varchar REFERENCES companies(id),
        event_name text,
        event_date text,
        event_location text,
        ace_poc text,
        visited_at timestamp NOT NULL DEFAULT now(),
        custom_fields text
      );
    `);

    console.log("[migrate] Schema is up to date");
  } catch (error) {
    console.error("[migrate] Migration failed:", error);
    throw error;
  }
}

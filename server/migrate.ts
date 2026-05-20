import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  try {
    // Add new columns to page_settings if they don't exist
    await db.execute(sql`
      ALTER TABLE page_settings
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

    console.log("[migrate] Schema migrations applied successfully");
  } catch (error) {
    console.error("[migrate] Migration error:", error);
    throw error;
  }
}

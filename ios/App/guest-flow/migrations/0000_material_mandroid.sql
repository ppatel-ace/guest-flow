DO $$ BEGIN
  CREATE TYPE "public"."customer_status" AS ENUM('pending', 'confirmed', 'checked-in');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "company_id" varchar,
        "title" text,
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text,
        "ace_poc" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text,
        "status" "customer_status" DEFAULT 'pending' NOT NULL,
        "qr_code" text NOT NULL,
        "invited_at" timestamp,
        "checked_in_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "metadata" text,
        CONSTRAINT "customers_email_unique" UNIQUE("email"),
        CONSTRAINT "customers_qr_code_unique" UNIQUE("qr_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "content" text NOT NULL,
        "enabled" boolean DEFAULT true NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_fields" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "label" text NOT NULL,
        "field_type" text DEFAULT 'text' NOT NULL,
        "placeholder" text,
        "required" boolean DEFAULT false NOT NULL,
        "options" text,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kiosk_devices" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "device_id" text NOT NULL,
        "name" text,
        "status" text DEFAULT 'idle' NOT NULL,
        "last_seen" timestamp DEFAULT now() NOT NULL,
        "user_agent" text,
        "ip_address" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "kiosk_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text,
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "email" text NOT NULL,
        "phone_number" text NOT NULL,
        "company" text,
        "ace_poc" text,
        "event_name" text,
        "submitted_at" timestamp DEFAULT now() NOT NULL,
        "customer_id" varchar,
        "photo_data" text,
        "plus_one_count" integer DEFAULT 0,
        "documents_agreed" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_settings" (
        "key" varchar PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "success_message" text,
        "success_title" text,
        "event_name" text,
        "event_date" text,
        "event_location" text,
        "captcha_bypass_start" text,
        "captcha_bypass_end" text,
        "photo_enabled" boolean DEFAULT false,
        "plus_one_enabled" boolean DEFAULT false,
        "kiosk_timeout_seconds" integer DEFAULT 30,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visits" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "contact_id" varchar NOT NULL,
        "company_id" varchar,
        "event_name" text,
        "event_date" text,
        "event_location" text,
        "ace_poc" text,
        "visited_at" timestamp DEFAULT now() NOT NULL,
        "custom_fields" text
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "visits" ADD CONSTRAINT "visits_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "visits" ADD CONSTRAINT "visits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

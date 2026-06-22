CREATE TABLE IF NOT EXISTS "visitors" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "email" text,
  "company" text,
  "ace_poc" text,
  "signed_in_at" timestamp DEFAULT now() NOT NULL,
  "signed_out_at" timestamp,
  "us_citizen" text,
  "purpose" text,
  "location" text,
  "source" text DEFAULT 'kiosk' NOT NULL,
  "notes" text,
  "photo_data" text,
  "documents_agreed" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "visitor_merge_events" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "primary_key" text NOT NULL,
        "secondary_name" text NOT NULL,
        "secondary_email" text,
        "visits_moved" integer NOT NULL,
        "merged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visitor_notes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "lookup_key" text NOT NULL,
        "notes" text DEFAULT '' NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "visitor_notes_lookup_key_unique" UNIQUE("lookup_key")
);
--> statement-breakpoint
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

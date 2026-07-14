CREATE TABLE IF NOT EXISTS "visitor_notes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lookup_key" text NOT NULL,
  "notes" text NOT NULL DEFAULT '',
  "updated_at" timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitor_notes_lookup_key_unique'
  ) THEN
    ALTER TABLE "visitor_notes" ADD CONSTRAINT "visitor_notes_lookup_key_unique" UNIQUE("lookup_key");
  END IF;
END$$;

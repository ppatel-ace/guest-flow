CREATE TABLE IF NOT EXISTS "ace_pocs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ace_pocs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "ace_pocs" ("name") VALUES
  ('Jerry Parker'),
  ('Larry Pomasan'),
  ('Nish Patel'),
  ('Craig Frost'),
  ('Ashley Morris'),
  ('Sanjay Parimi')
ON CONFLICT ("name") DO NOTHING;

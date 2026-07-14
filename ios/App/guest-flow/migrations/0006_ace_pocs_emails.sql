ALTER TABLE "ace_pocs" ADD COLUMN IF NOT EXISTS "emails" text[] DEFAULT '{}'::text[];

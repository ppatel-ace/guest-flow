-- Add office locations for ACE POCs (which check-in sites they appear on).
ALTER TABLE "gf_ace_pocs" ADD COLUMN IF NOT EXISTS "locations" text[] NOT NULL DEFAULT '{}';

-- Existing POCs appear at every office until reassigned in admin.
UPDATE "gf_ace_pocs"
SET "locations" = ARRAY['New Jersey', 'Maryland', 'Michigan']::text[]
WHERE "locations" IS NULL OR cardinality("locations") = 0;

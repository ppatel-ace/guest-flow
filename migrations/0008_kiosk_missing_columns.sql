ALTER TABLE "kiosk_devices" ADD COLUMN IF NOT EXISTS "default_location" text;
ALTER TABLE "kiosk_devices" ADD COLUMN IF NOT EXISTS "location_source" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "location" text;

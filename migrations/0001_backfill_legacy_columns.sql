ALTER TABLE "page_settings" ADD COLUMN IF NOT EXISTS "captcha_bypass_start" text;
--> statement-breakpoint
ALTER TABLE "page_settings" ADD COLUMN IF NOT EXISTS "captcha_bypass_end" text;
--> statement-breakpoint
ALTER TABLE "page_settings" ADD COLUMN IF NOT EXISTS "photo_enabled" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "page_settings" ADD COLUMN IF NOT EXISTS "plus_one_enabled" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "page_settings" ADD COLUMN IF NOT EXISTS "kiosk_timeout_seconds" integer DEFAULT 30;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "photo_data" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "plus_one_count" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "documents_agreed" text;

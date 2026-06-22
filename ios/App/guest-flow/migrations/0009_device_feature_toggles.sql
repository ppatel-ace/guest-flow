ALTER TABLE "page_settings" ADD COLUMN IF NOT EXISTS "label_printer_enabled" boolean DEFAULT false;
ALTER TABLE "page_settings" ADD COLUMN IF NOT EXISTS "wifi_coupon_enabled" boolean DEFAULT false;

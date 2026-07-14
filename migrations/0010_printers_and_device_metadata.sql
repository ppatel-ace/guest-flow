ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS device_type text;
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS os_version text;
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS app_version text;

CREATE TABLE IF NOT EXISTS printers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  model text NOT NULL,
  connection_type text NOT NULL DEFAULT 'wifi',
  status text NOT NULL DEFAULT 'offline',
  created_at timestamp NOT NULL DEFAULT now()
);

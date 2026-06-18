-- Add ip_address and port to printers, and a print_jobs table for queued print jobs

ALTER TABLE printers ADD COLUMN ip_address text;
ALTER TABLE printers ADD COLUMN port integer;

CREATE TABLE IF NOT EXISTS print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id varchar NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  label_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);

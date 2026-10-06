CREATE TABLE IF NOT EXISTS gf_rsvp_attendees (
  id varchar PRIMARY KEY,
  event_key text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text NOT NULL,
  source_category text NOT NULL DEFAULT '',
  plus_one_count integer NOT NULL DEFAULT 0 CHECK (plus_one_count >= 0),
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

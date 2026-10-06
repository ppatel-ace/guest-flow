CREATE TABLE IF NOT EXISTS gf_rsvp_reference_sets (
  event_key text PRIMARY KEY,
  visits integer NOT NULL,
  names integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS gf_rsvp_reference_identities (
  event_key text NOT NULL,
  normalized_name text NOT NULL,
  email text NOT NULL,
  company text,
  PRIMARY KEY (event_key, normalized_name)
);
--> statement-breakpoint
ALTER TABLE gf_rsvp_reference_sets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE gf_rsvp_reference_identities ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE gf_rsvp_guest_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE gf_rsvp_guest_tickets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE gf_rsvp_guest_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON gf_rsvp_reference_sets, gf_rsvp_reference_identities,
  gf_rsvp_guest_events, gf_rsvp_guest_tickets, gf_rsvp_guest_requests FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON gf_rsvp_reference_sets, gf_rsvp_reference_identities, gf_rsvp_guest_events, gf_rsvp_guest_tickets, gf_rsvp_guest_requests FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON gf_rsvp_reference_sets, gf_rsvp_reference_identities, gf_rsvp_guest_events, gf_rsvp_guest_tickets, gf_rsvp_guest_requests FROM authenticated';
  END IF;
END $$;

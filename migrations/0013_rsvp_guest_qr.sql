CREATE TABLE IF NOT EXISTS gf_rsvp_guest_events (
  event_key text PRIMARY KEY,
  token text NOT NULL UNIQUE,
  location text NOT NULL,
  guest_base_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS gf_rsvp_guest_requests (
  request_id varchar PRIMARY KEY,
  event_key text NOT NULL,
  attendee_id varchar NOT NULL REFERENCES gf_rsvp_attendees(id),
  result jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS gf_rsvp_guest_tickets (
  id varchar PRIMARY KEY,
  event_key text NOT NULL,
  attendee_id varchar NOT NULL REFERENCES gf_rsvp_attendees(id),
  expected_revision integer NOT NULL,
  location text NOT NULL,
  expires_at timestamptz NOT NULL,
  completed_result jsonb
);

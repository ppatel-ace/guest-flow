ALTER TABLE gf_rsvp_attendees
  ADD COLUMN IF NOT EXISTS attendance_revision integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS gf_rsvp_check_in_corrections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id varchar NOT NULL REFERENCES gf_rsvp_attendees(id),
  prior_arrival_at timestamptz NOT NULL,
  prior_revision integer NOT NULL,
  corrected_by text NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now()
);

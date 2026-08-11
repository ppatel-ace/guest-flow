import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  OFFICE_LOCATIONS,
  type OfficeLocation,
  normalizeOfficeLocation,
} from "@shared/locations";

/**
 * Centralized notification recipients for GuestFlow.
 *
 * Always-notify (all sites) and per-office lists live in public.ace_email_recipients
 * (app_slug 'guestflow'). GuestFlow's DATABASE_URL points at that same database.
 *
 * Backward compatibility: when a canonical row does not yet exist we fall back
 * to legacy page_settings keys. Per-host (POC) routing stays in GuestFlow.
 *
 * Transactional auth emails (embedded SSO password reset) are NOT routed here.
 */

const APP_SLUG = "guestflow";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GLOBAL_EMAIL_TYPE = "checkin_notification";
const GLOBAL_LABEL = "Visitor Check-In Notification";
const GLOBAL_LEGACY_KEY = "notification_emails";

const LOCATION_META: Record<
  OfficeLocation,
  { emailType: string; label: string; legacyKey: string }
> = {
  "New Jersey": {
    emailType: "checkin_notification_new_jersey",
    label: "Visitor Check-In — New Jersey",
    legacyKey: "notification_emails_new_jersey",
  },
  Maryland: {
    emailType: "checkin_notification_maryland",
    label: "Visitor Check-In — Maryland",
    legacyKey: "notification_emails_maryland",
  },
  Michigan: {
    emailType: "checkin_notification_michigan",
    label: "Visitor Check-In — Michigan",
    legacyKey: "notification_emails_michigan",
  },
};

let schemaReady: Promise<void> | null = null;

/**
 * Create public.ace_email_recipients if missing (shared Hub SoT) and seed GuestFlow
 * notification types from legacy page_settings so always-notify works even when
 * Platform Hub migrations have not been applied to this database.
 */
export async function ensureEmailRecipientsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.ace_email_recipients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_slug TEXT NOT NULL,
          email_type TEXT NOT NULL,
          label TEXT NOT NULL,
          recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_by TEXT,
          updated_source TEXT NOT NULL DEFAULT 'migration',
          UNIQUE (app_slug, email_type)
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ace_email_recipients_app_idx
          ON public.ace_email_recipients (app_slug, email_type)
      `);

      // Seed from GuestFlow-configured legacy lists when canonical rows are absent
      const seeds: Array<{ emailType: string; label: string; legacyKey: string }> = [
        { emailType: GLOBAL_EMAIL_TYPE, label: GLOBAL_LABEL, legacyKey: GLOBAL_LEGACY_KEY },
        ...OFFICE_LOCATIONS.map((loc) => ({
          emailType: LOCATION_META[loc].emailType,
          label: LOCATION_META[loc].label,
          legacyKey: LOCATION_META[loc].legacyKey,
        })),
      ];
      for (const s of seeds) {
        try {
          const legacy = await storage.getNotificationEmailsByKey(s.legacyKey);
          if (legacy.length === 0) continue;
          const entries = parseRecipients(legacy).map((email) => ({ email, name: email }));
          const json = JSON.stringify(entries);
          await db.execute(sql`
            INSERT INTO public.ace_email_recipients
              (app_slug, email_type, label, recipients, enabled, updated_by, updated_source, updated_at)
            VALUES
              (${APP_SLUG}, ${s.emailType}, ${s.label}, ${json}::jsonb, TRUE, ${"guestflow"}, ${"guestflow-migrate"}, now())
            ON CONFLICT (app_slug, email_type) DO NOTHING
          `);
        } catch (err) {
          console.warn(
            `[emailRecipients] seed ${s.emailType} skipped:`,
            (err as Error).message
          );
        }
      }
      console.log("[emailRecipients] public.ace_email_recipients ready");
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function rowsOf(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

function parseRecipients(value: unknown): string[] {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    let email = "";
    if (typeof item === "string") email = item;
    else if (item && typeof item === "object") email = String((item as { email?: string }).email ?? "");
    email = email.trim().toLowerCase();
    if (!email || seen.has(email) || !EMAIL_RE.test(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

async function getRecipientsForType(
  emailType: string,
  legacyKey: string
): Promise<string[]> {
  let canonical: string[] = [];
  let canonicalDisabled = false;
  try {
    const result = await db.execute(sql`
      SELECT recipients, enabled
      FROM public.ace_email_recipients
      WHERE app_slug = ${APP_SLUG} AND email_type = ${emailType}
      LIMIT 1
    `);
    const rows = rowsOf(result);
    if (rows.length > 0) {
      canonicalDisabled = rows[0].enabled === false;
      if (!canonicalDisabled) {
        canonical = parseRecipients(rows[0].recipients);
      }
    }
  } catch (err) {
    console.warn(
      `[emailRecipients] canonical lookup failed for ${emailType}, using legacy list:`,
      (err as Error).message
    );
  }
  // Explicitly disabled in the Hub means "send to nobody".
  if (canonicalDisabled) return [];
  // Always merge the GuestFlow-configured list with the canonical one so the
  // configured always-notify emails are never lost (e.g. when a canonical row
  // exists with an empty list).
  return mergeInformationalRecipients(
    canonical,
    await storage.getNotificationEmailsByKey(legacyKey)
  );
}

async function mirrorRecipientsToCanonical(
  emailType: string,
  label: string,
  emails: string[]
): Promise<void> {
  const entries = parseRecipients(emails).map((email) => ({ email, name: email }));
  const json = JSON.stringify(entries);
  try {
    await db.execute(sql`
      INSERT INTO public.ace_email_recipients
        (app_slug, email_type, label, recipients, enabled, updated_by, updated_source, updated_at)
      VALUES
        (${APP_SLUG}, ${emailType}, ${label}, ${json}::jsonb, TRUE, ${"guestflow"}, ${"guestflow"}, now())
      ON CONFLICT (app_slug, email_type) DO UPDATE SET
        recipients = EXCLUDED.recipients,
        label = EXCLUDED.label,
        updated_by = EXCLUDED.updated_by,
        updated_source = EXCLUDED.updated_source,
        updated_at = now()
    `);
  } catch (err) {
    console.warn(
      `[emailRecipients] failed to mirror ${emailType} to canonical table:`,
      (err as Error).message
    );
  }
}

/**
 * Returns the Hub-managed global (always-notify) check-in allowlist.
 * - Canonical row present & enabled  → its recipients (may be empty = nobody)
 * - Canonical row present & disabled → [] (send to nobody)
 * - Canonical row absent             → legacy page_settings fallback
 */
export async function getCheckinGlobalRecipients(): Promise<string[]> {
  return getRecipientsForType(GLOBAL_EMAIL_TYPE, GLOBAL_LEGACY_KEY);
}

/**
 * Returns recipients for a check-in office location (empty if unknown / unset).
 */
export async function getCheckinLocationRecipients(
  location: string | null | undefined
): Promise<string[]> {
  const office = normalizeOfficeLocation(location);
  if (!office) return [];
  const meta = LOCATION_META[office];
  return getRecipientsForType(meta.emailType, meta.legacyKey);
}

export type CheckinRecipientLists = {
  global: string[];
  byLocation: Record<OfficeLocation, string[]>;
};

/** All configurable check-in notification lists for the admin UI. */
export async function getAllCheckinRecipientLists(): Promise<CheckinRecipientLists> {
  const global = await getCheckinGlobalRecipients();
  const byLocation = {} as Record<OfficeLocation, string[]>;
  await Promise.all(
    OFFICE_LOCATIONS.map(async (loc) => {
      const meta = LOCATION_META[loc];
      byLocation[loc] = await getRecipientsForType(meta.emailType, meta.legacyKey);
    })
  );
  return { global, byLocation };
}

/**
 * Mirrors a GuestFlow admin edit of the always-notify list back to the canonical
 * table so the ACE Hub reflects the change (updated_source = 'guestflow').
 */
export async function mirrorCheckinRecipientsToCanonical(emails: string[]): Promise<void> {
  await mirrorRecipientsToCanonical(GLOBAL_EMAIL_TYPE, GLOBAL_LABEL, emails);
}

/** Mirrors a per-office recipient list to ace_email_recipients. */
export async function mirrorLocationRecipientsToCanonical(
  location: OfficeLocation,
  emails: string[]
): Promise<void> {
  const meta = LOCATION_META[location];
  await mirrorRecipientsToCanonical(meta.emailType, meta.label, emails);
}

/** Persist always-notify list (legacy + Hub). */
export async function setCheckinGlobalRecipients(emails: string[]): Promise<string[]> {
  const normalised = parseRecipients(emails);
  await storage.setNotificationEmailsByKey(GLOBAL_LEGACY_KEY, "Always-Notify Emails", normalised);
  await mirrorCheckinRecipientsToCanonical(normalised);
  return normalised;
}

/** Persist a location-specific list (legacy + Hub). */
export async function setCheckinLocationRecipients(
  location: OfficeLocation,
  emails: string[]
): Promise<string[]> {
  const meta = LOCATION_META[location];
  const normalised = parseRecipients(emails);
  await storage.setNotificationEmailsByKey(meta.legacyKey, meta.label, normalised);
  await mirrorLocationRecipientsToCanonical(location, normalised);
  return normalised;
}

/** Merge always-notify + location lists without duplicates (order preserved). */
export function mergeInformationalRecipients(
  globalEmails: string[],
  locationEmails: string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...globalEmails, ...locationEmails]) {
    const key = e.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e.trim());
  }
  return out;
}

import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";

/**
 * Centralized notification recipients for GuestFlow.
 *
 * The authoritative global check-in allowlist lives in the shared platform DB
 * table public.ace_email_recipients (managed from the ACE Hub, app_slug
 * 'guestflow', email_type 'checkin_notification'). GuestFlow's DATABASE_URL
 * points at that same database (it already dual-writes ace_crm there), so we
 * read the canonical row directly.
 *
 * Backward compatibility: when the canonical row does not yet exist we fall
 * back to the legacy page_settings.notification_emails list. Per-host (POC)
 * routing stays in GuestFlow and is unaffected.
 *
 * Transactional auth emails (embedded SSO password reset) are NOT routed here.
 */

const APP_SLUG = "guestflow";
const EMAIL_TYPE = "checkin_notification";
const LABEL = "Visitor Check-In Notification";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/**
 * Returns the Hub-managed global check-in notification allowlist.
 * - Canonical row present & enabled  → its recipients (may be empty = nobody)
 * - Canonical row present & disabled → [] (send to nobody)
 * - Canonical row absent             → legacy page_settings fallback
 */
export async function getCheckinGlobalRecipients(): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT recipients, enabled
      FROM public.ace_email_recipients
      WHERE app_slug = ${APP_SLUG} AND email_type = ${EMAIL_TYPE}
      LIMIT 1
    `);
    const rows = rowsOf(result);
    if (rows.length > 0) {
      if (rows[0].enabled === false) return [];
      return parseRecipients(rows[0].recipients);
    }
  } catch (err) {
    console.warn(
      "[emailRecipients] canonical check-in lookup failed, using legacy list:",
      (err as Error).message,
    );
  }
  // Fallback for un-migrated deployments.
  return storage.getNotificationEmails();
}

/**
 * Mirrors a GuestFlow admin edit of the global list back to the canonical
 * table so the ACE Hub reflects the change (updated_source = 'guestflow').
 */
export async function mirrorCheckinRecipientsToCanonical(emails: string[]): Promise<void> {
  const entries = parseRecipients(emails).map((email) => ({ email, name: email }));
  const json = JSON.stringify(entries);
  try {
    await db.execute(sql`
      INSERT INTO public.ace_email_recipients
        (app_slug, email_type, label, recipients, enabled, updated_by, updated_source, updated_at)
      VALUES
        (${APP_SLUG}, ${EMAIL_TYPE}, ${LABEL}, ${json}::jsonb, TRUE, ${"guestflow"}, ${"guestflow"}, now())
      ON CONFLICT (app_slug, email_type) DO UPDATE SET
        recipients = EXCLUDED.recipients,
        updated_by = EXCLUDED.updated_by,
        updated_source = EXCLUDED.updated_source,
        updated_at = now()
    `);
  } catch (err) {
    console.warn(
      "[emailRecipients] failed to mirror check-in recipients to canonical table:",
      (err as Error).message,
    );
  }
}

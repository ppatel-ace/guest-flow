import type { Express } from "express";
import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

function getCrmSql(): ReturnType<typeof postgres> | null {
  const url =
    process.env.ACE_CRM_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!sql) {
    sql = postgres(url, {
      ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return sql;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Guest", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function registerAceCrmSyncOnStartup(_app: Express): void {
  if (!process.env.ACE_CRM_DATABASE_URL?.trim()) {
    console.log("[aceCrmSync] ACE_CRM_DATABASE_URL not set — ace_crm dual-write disabled");
  } else {
    console.log("[aceCrmSync] ace_crm dual-write enabled");
  }
}

export async function syncCompanyToAceCrm(_name: string, _sourceId: string): Promise<void> {
  // Customers live in Salesforce only — GuestFlow company names are stored on contacts.
}

export async function syncContactToAceCrm(data: {
  sourceId: string;
  companyName?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  acePoc?: string | null;
}): Promise<void> {
  const db = getCrmSql();
  if (!db || !data.email) return;
  try {
    const email = data.email.trim().toLowerCase();
    const guestflowCompany = data.companyName?.trim() || null;

    await db`
      ALTER TABLE ace_crm.contacts
      ADD COLUMN IF NOT EXISTS guestflow_company_name TEXT
    `.catch(() => undefined);

    const [updated] = await db<{ id: string }[]>`
      UPDATE ace_crm.contacts SET
        first_name = ${data.firstName},
        last_name = ${data.lastName},
        phone = COALESCE(${data.phone ?? null}, phone),
        title = COALESCE(${data.title ?? null}, title),
        ace_poc = COALESCE(${data.acePoc ?? null}, ace_poc),
        guestflow_company_name = COALESCE(${guestflowCompany}, guestflow_company_name),
        updated_at = now()
      WHERE lower(email) = ${email}
      RETURNING id
    `;
    if (!updated?.id) {
      await db`
        INSERT INTO ace_crm.contacts (
          first_name, last_name, email, phone, title, ace_poc,
          guestflow_company_name, source_system, source_id
        )
        VALUES (
          ${data.firstName},
          ${data.lastName},
          ${email},
          ${data.phone ?? null},
          ${data.title ?? null},
          ${data.acePoc ?? null},
          ${guestflowCompany},
          'guestflow',
          ${data.sourceId}
        )
      `;
    }
  } catch (err) {
    console.warn("[aceCrmSync] contact sync skipped:", (err as Error).message);
  }
}

export async function syncVisitToAceCrm(data: {
  sourceId: string;
  contactEmail: string;
  companyName?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  acePoc?: string | null;
  customFields?: string | null;
  visitedAt?: Date;
}): Promise<void> {
  const db = getCrmSql();
  if (!db) return;
  try {
    const [contact] = await db<{ id: string; company_id: string | null }[]>`
      SELECT id, company_id FROM ace_crm.contacts WHERE lower(email) = lower(${data.contactEmail}) LIMIT 1
    `;
    if (!contact) return;

    const [existing] = await db<{ id: string }[]>`
      SELECT id FROM ace_crm.visits
      WHERE source_system = 'guestflow' AND source_id = ${data.sourceId}
      LIMIT 1
    `;
    if (existing?.id) return;

    let customFields: unknown = null;
    if (data.customFields) {
      try {
        customFields = JSON.parse(data.customFields);
      } catch {
        customFields = null;
      }
    }

    await db`
      INSERT INTO ace_crm.visits (
        contact_id, company_id, event_name, event_location, ace_poc,
        custom_fields, source_system, source_id, visited_at
      )
      VALUES (
        ${contact.id},
        ${contact.company_id},
        ${data.eventName ?? null},
        ${data.eventLocation ?? null},
        ${data.acePoc ?? null},
        ${customFields},
        'guestflow',
        ${data.sourceId},
        ${data.visitedAt ?? new Date()}
      )
    `;
  } catch (err) {
    console.warn("[aceCrmSync] visit sync skipped:", (err as Error).message);
  }
}

export async function syncVisitorToAceCrm(visitor: {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  company?: string | null;
  acePoc?: string | null;
  signedInAt: Date;
  location?: string | null;
}): Promise<void> {
  const { firstName, lastName } = splitFullName(visitor.fullName);
  const email =
    visitor.email?.trim().toLowerCase() || `visitor.${visitor.id}@guestflow.internal`;
  await syncContactToAceCrm({
    sourceId: visitor.id,
    companyName: visitor.company,
    firstName,
    lastName,
    email,
    phone: visitor.phoneNumber,
    acePoc: visitor.acePoc,
  });
  await syncVisitToAceCrm({
    sourceId: `visitor-${visitor.id}`,
    contactEmail: email,
    companyName: visitor.company,
    eventName: visitor.location ? `Kiosk — ${visitor.location}` : "Kiosk check-in",
    eventLocation: visitor.location,
    acePoc: visitor.acePoc,
    visitedAt: visitor.signedInAt,
  });
}

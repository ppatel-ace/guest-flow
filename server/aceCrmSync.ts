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

function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase();
}

async function resolveCrmCompanyId(
  db: ReturnType<typeof postgres>,
  companyName: string | null | undefined,
): Promise<string | null> {
  const normalized = normalizeCompanyName(companyName ?? "");
  if (!normalized) return null;

  const [exact] = await db<{ id: string }[]>`
    SELECT id FROM ace_crm.companies WHERE normalized_name = ${normalized} LIMIT 1
  `;
  if (exact?.id) return exact.id;

  const [alias] = await db<{ company_id: string }[]>`
    SELECT company_id FROM ace_crm.company_aliases WHERE alias_normalized = ${normalized} LIMIT 1
  `.catch(() => [undefined]);
  if (alias?.company_id) return alias.company_id;

  if (normalized.length < 3) return null;

  const [heuristic] = await db<{ id: string }[]>`
    SELECT id FROM ace_crm.companies
    WHERE normalized_name LIKE ${"%" + normalized + "%"}
    ORDER BY
      CASE WHEN source_system = 'salesforce' THEN 0 ELSE 1 END,
      length(name) DESC
    LIMIT 1
  `;
  return heuristic?.id ?? null;
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

export async function syncCompanyToAceCrm(name: string, sourceId: string): Promise<void> {
  const db = getCrmSql();
  if (!db) return;
  const normalized = normalizeCompanyName(name);
  if (!normalized) return;
  try {
    const companyId = await resolveCrmCompanyId(db, name);
    if (companyId) {
      await db`
        INSERT INTO ace_crm.company_aliases (alias_normalized, company_id)
        VALUES (${normalized}, ${companyId}::uuid)
        ON CONFLICT (alias_normalized) DO NOTHING
      `.catch(() => undefined);
      return;
    }
    await db`
      INSERT INTO ace_crm.companies (name, normalized_name, source_system, source_id)
      VALUES (${name.trim()}, ${normalized}, 'guestflow', ${sourceId})
      ON CONFLICT (normalized_name) DO UPDATE SET
        updated_at = now(),
        source_id = COALESCE(ace_crm.companies.source_id, EXCLUDED.source_id)
    `;
  } catch (err) {
    console.warn("[aceCrmSync] company sync skipped:", (err as Error).message);
  }
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
    const companyId = await resolveCrmCompanyId(db, data.companyName);
    const email = data.email.trim().toLowerCase();

    const [updated] = await db<{ id: string }[]>`
      UPDATE ace_crm.contacts SET
        first_name = ${data.firstName},
        last_name = ${data.lastName},
        phone = COALESCE(${data.phone ?? null}, phone),
        title = COALESCE(${data.title ?? null}, title),
        ace_poc = COALESCE(${data.acePoc ?? null}, ace_poc),
        company_id = COALESCE(${companyId}::uuid, company_id),
        updated_at = now()
      WHERE lower(email) = ${email}
      RETURNING id
    `;
    if (!updated?.id) {
      await db`
        INSERT INTO ace_crm.contacts (
          company_id, first_name, last_name, email, phone, title, ace_poc,
          source_system, source_id
        )
        VALUES (
          ${companyId}::uuid,
          ${data.firstName},
          ${data.lastName},
          ${email},
          ${data.phone ?? null},
          ${data.title ?? null},
          ${data.acePoc ?? null},
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

    const companyId =
      contact.company_id ?? (await resolveCrmCompanyId(db, data.companyName));

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
        ${companyId},
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

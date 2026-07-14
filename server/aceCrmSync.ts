import type { Express } from "express";
import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

function getSql(): ReturnType<typeof postgres> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!sql) {
    sql = postgres(url, {
      ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return sql;
}

export async function syncCompanyToAceCrm(name: string, sourceId: string): Promise<void> {
  const db = getSql();
  if (!db) return;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return;
  try {
    const [existing] = await db<{ id: string }[]>`
      SELECT id FROM ace_crm.companies WHERE normalized_name = ${normalized} LIMIT 1
    `;
    if (existing?.id) {
      await db`
        UPDATE ace_crm.companies SET
          updated_at = now(),
          source_id = COALESCE(ace_crm.companies.source_id, ${sourceId})
        WHERE id = ${existing.id}::uuid
      `;
      return;
    }
    await db`
      INSERT INTO ace_crm.companies (name, normalized_name, source_system, source_id)
      VALUES (${name.trim()}, ${normalized}, 'guestflow', ${sourceId})
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
  const db = getSql();
  if (!db || !data.email) return;
  try {
    let companyId: string | null = null;
    if (data.companyName?.trim()) {
      const normalized = data.companyName.trim().toLowerCase();
      const [existing] = await db<{ id: string }[]>`
        SELECT id FROM ace_crm.companies WHERE normalized_name = ${normalized} LIMIT 1
      `;
      if (existing?.id) {
        await db`
          UPDATE ace_crm.companies SET updated_at = now() WHERE id = ${existing.id}::uuid
        `;
        companyId = existing.id;
      } else {
        const [inserted] = await db<{ id: string }[]>`
          INSERT INTO ace_crm.companies (name, normalized_name, source_system, source_id)
          VALUES (${data.companyName.trim()}, ${normalized}, 'guestflow', ${data.sourceId})
          RETURNING id
        `;
        companyId = inserted?.id ?? null;
      }
    }
    await db`
      INSERT INTO ace_crm.contacts (
        company_id, first_name, last_name, email, phone, title, ace_poc,
        source_system, source_id
      )
      VALUES (
        ${companyId}::uuid,
        ${data.firstName},
        ${data.lastName},
        ${data.email},
        ${data.phone ?? null},
        ${data.title ?? null},
        ${data.acePoc ?? null},
        'guestflow',
        ${data.sourceId}
      )
      ON CONFLICT DO NOTHING
    `.catch(async () => {
      await db!`
        UPDATE ace_crm.contacts SET
          first_name = ${data.firstName},
          last_name = ${data.lastName},
          phone = COALESCE(${data.phone ?? null}, phone),
          company_id = COALESCE(${companyId}::uuid, company_id),
          updated_at = now()
        WHERE lower(email) = lower(${data.email})
      `;
    });
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
  const db = getSql();
  if (!db) return;
  try {
    const [contact] = await db<{ id: string; company_id: string | null }[]>`
      SELECT id, company_id FROM ace_crm.contacts WHERE lower(email) = lower(${data.contactEmail}) LIMIT 1
    `;
    if (!contact) return;
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
        ${data.customFields ? JSON.parse(data.customFields) : null},
        'guestflow',
        ${data.sourceId},
        ${data.visitedAt ?? new Date()}
      )
      ON CONFLICT DO NOTHING
    `.catch(() => undefined);
  } catch (err) {
    console.warn("[aceCrmSync] visit sync skipped:", (err as Error).message);
  }
}

export function registerAceCrmSyncOnStartup(_app: Express): void {
  if (!process.env.DATABASE_URL) {
    console.log("[aceCrmSync] DATABASE_URL not set — ace_crm dual-write disabled");
  } else {
    console.log("[aceCrmSync] ace_crm dual-write enabled");
  }
}

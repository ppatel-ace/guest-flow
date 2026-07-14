import type postgres from "postgres";
import { AZURE_APP_GROUPS, normalizeGroupIds } from "./azureGroups";

type Sql = ReturnType<typeof postgres>;

export async function syncRegistryFromAzureGroups(
  sql: Sql,
  opts: {
    ssoUserId: string;
    email: string;
    name: string;
    groups: string[];
  },
): Promise<{ employeeId: string | null }> {
  const groupIds = normalizeGroupIds(opts.groups);
  const accessGuestflow = groupIds.includes(AZURE_APP_GROUPS.guestflow);
  const accessJobtrack = groupIds.includes(AZURE_APP_GROUPS.jobtrack);
  const accessEstimate = groupIds.includes(AZURE_APP_GROUPS.estimatepro);

  const [existing] = await sql<{ employee_id: string | null }[]>`
    SELECT employee_id FROM ace_user_registry
    WHERE lower(employee_email) = lower(${opts.email})
    LIMIT 1
  `.catch(() => []);

  if (existing?.employee_id) {
    await sql`
      UPDATE ace_user_registry SET
        sso_user_id = ${opts.ssoUserId}::uuid,
        access_guestflow = ${accessGuestflow},
        access_jobtrack = COALESCE(access_jobtrack, false) OR ${accessJobtrack},
        access_estimate = COALESCE(access_estimate, false) OR ${accessEstimate},
        updated_at = now()
      WHERE lower(employee_email) = lower(${opts.email})
    `.catch(async () => {
      await sql`
        UPDATE ace_user_registry SET
          access_jobtrack = COALESCE(access_jobtrack, false) OR ${accessJobtrack},
          access_estimate = COALESCE(access_estimate, false) OR ${accessEstimate},
          updated_at = now()
        WHERE lower(employee_email) = lower(${opts.email})
      `;
    });
    return { employeeId: existing.employee_id };
  }

  const nameParts = opts.name.trim().split(/\s+/);
  const firstName = nameParts[0] || opts.email.split("@")[0];
  const lastName = nameParts.slice(1).join(" ") || null;
  const username = opts.email.split("@")[0].toLowerCase();

  const [inserted] = await sql<{ employee_id: string }[]>`
    INSERT INTO ace_user_registry (
      employee_id,
      username,
      first_name,
      last_name,
      employee_name,
      employee_email,
      access_guestflow,
      access_jobtrack,
      access_estimate,
      sso_user_id,
      role
    )
    VALUES (
      'EMP' || lpad((COALESCE(
        (SELECT MAX(CAST(substring(employee_id from 4) AS integer))
         FROM ace_user_registry
         WHERE employee_id ~ '^EMP[0-9]+$'), 0) + 1)::text, 3, '0'),
      ${username},
      ${firstName},
      ${lastName},
      ${opts.name},
      ${opts.email},
      ${accessGuestflow},
      ${accessJobtrack},
      ${accessEstimate},
      ${opts.ssoUserId}::uuid,
      'Office'
    )
    ON CONFLICT (username) DO UPDATE SET
      employee_email = EXCLUDED.employee_email,
      employee_name = EXCLUDED.employee_name,
      access_guestflow = EXCLUDED.access_guestflow,
      access_jobtrack = ace_user_registry.access_jobtrack OR EXCLUDED.access_jobtrack,
      access_estimate = ace_user_registry.access_estimate OR EXCLUDED.access_estimate,
      sso_user_id = EXCLUDED.sso_user_id,
      updated_at = now()
    RETURNING employee_id
  `.catch(() => []);

  return { employeeId: inserted?.employee_id ?? null };
}

export async function ensureRegistryColumns(sql: Sql): Promise<void> {
  await sql`
    ALTER TABLE ace_user_registry
      ADD COLUMN IF NOT EXISTS employee_email TEXT,
      ADD COLUMN IF NOT EXISTS access_guestflow BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS access_estimate BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS access_support BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS access_hub BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS sso_user_id UUID
  `.catch(() => {
    /* table may not exist in dev-only SSO DB */
  });
}

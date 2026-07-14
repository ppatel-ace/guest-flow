export const AZURE_APP_GROUPS = {
  guestflow: (process.env.AZURE_GROUP_GUESTFLOW || "88897cdd-bc61-4051-b67e-6daf5f7fc7e8").toLowerCase(),
  jobtrack: (process.env.AZURE_GROUP_JOBTRACK || "bc5af5fb-4e3d-4e6c-be07-c7bcff91e2ed").toLowerCase(),
  estimatepro: (process.env.AZURE_GROUP_ESTIMATEPRO || "e8309095-39bf-4354-ae42-5808685b0c94").toLowerCase(),
} as const;

export type AceAppSlug =
  | "hub"
  | "guestflow"
  | "jobtrack"
  | "estimatepro"
  | "inventory"
  | "support"
  | "crm";

/** All apps — used when SSO_ENFORCE_GROUPS is not true (pilot / open access). */
export const ALL_APP_SLUGS: AceAppSlug[] = [
  "hub",
  "guestflow",
  "jobtrack",
  "estimatepro",
  "inventory",
  "support",
  "crm",
];

/** Set SSO_ENFORCE_GROUPS=true once Parth has assigned users to sg_* groups. */
export function enforceGroupAccess(): boolean {
  return process.env.SSO_ENFORCE_GROUPS === "true";
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  employeeId?: string;
  groups?: string[];
  apps?: AceAppSlug[];
}

export function normalizeGroupIds(groups: unknown): string[] {
  if (!Array.isArray(groups)) return [];
  return groups.map((g) => String(g).toLowerCase());
}

export function appsFromGroups(groupIds: string[]): AceAppSlug[] {
  if (!enforceGroupAccess()) return [...ALL_APP_SLUGS];

  const ids = groupIds.map((g) => g.toLowerCase());
  const apps: AceAppSlug[] = ["hub"];
  if (ids.includes(AZURE_APP_GROUPS.guestflow)) apps.push("guestflow", "crm");
  if (ids.includes(AZURE_APP_GROUPS.jobtrack)) apps.push("jobtrack", "inventory");
  if (ids.includes(AZURE_APP_GROUPS.estimatepro)) apps.push("estimatepro", "crm");
  return [...new Set(apps)];
}

export function buildJwtPayload(
  user: { id: string; email: string; name: string },
  groups: string[],
  employeeId?: string | null,
): JwtPayload {
  const normalized = normalizeGroupIds(groups);
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    employeeId: employeeId ?? undefined,
    groups: normalized,
    apps: appsFromGroups(normalized),
  };
}

/** Canonical office locations for GuestFlow check-in and notifications. */

export const OFFICE_LOCATIONS = ["New Jersey", "Maryland", "Michigan"] as const;

export type OfficeLocation = (typeof OFFICE_LOCATIONS)[number];

/** US state region codes (geoip-lite) → canonical office name. */
export const REGION_TO_LOCATION: Record<string, OfficeLocation> = {
  NJ: "New Jersey",
  MD: "Maryland",
  MI: "Michigan",
};

export function isOfficeLocation(value: string | null | undefined): value is OfficeLocation {
  if (!value) return false;
  return (OFFICE_LOCATIONS as readonly string[]).includes(value);
}

/** Normalize free-text location to a canonical office name, or null. */
export function normalizeOfficeLocation(
  location: string | null | undefined
): OfficeLocation | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (isOfficeLocation(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower === "nj" || lower === "new jersey" || lower === "n.j.") return "New Jersey";
  if (lower === "md" || lower === "maryland" || lower === "m.d.") return "Maryland";
  if (lower === "mi" || lower === "michigan" || lower === "m.i.") return "Michigan";

  return null;
}

/**
 * Map kiosk / guest form freeform values onto gf_visitors columns.
 * Custom form-field labels from the admin UI are matched by normalized slug.
 */

function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const US_CITIZEN_SLUGS = new Set([
  "are_you_citizen_or_resident_of_usa",
  "are_you_a_us_citizen_or_resident",
  "are_you_us_citizen_or_resident",
  "us_citizen",
  "us_citizen_or_resident",
  "u_s_citizen",
  "u_s_citizen_or_resident",
]);

const PURPOSE_SLUGS = new Set([
  "purpose",
  "purpose_of_visit",
  "visit_purpose",
  "reason_for_visit",
]);

export type CustomFieldValue = {
  id?: string;
  label?: string;
  value?: string | null;
};

function isUsCitizenSlug(slug: string): boolean {
  if (US_CITIZEN_SLUGS.has(slug)) return true;
  return (
    (slug.includes("citizen") || slug.includes("resident")) &&
    (slug.includes("us") || slug.includes("usa") || slug.includes("u_s"))
  );
}

function isPurposeSlug(slug: string): boolean {
  if (PURPOSE_SLUGS.has(slug)) return true;
  return slug.includes("purpose");
}

/**
 * Resolve usCitizen + purpose from explicit body fields and/or custom field answers.
 * Explicit body fields win when non-empty.
 */
export function resolveVisitorExtraFields(input: {
  usCitizen?: string | null;
  purpose?: string | null;
  customFields?: CustomFieldValue[] | null;
}): { usCitizen: string | null; purpose: string | null } {
  let usCitizen = (input.usCitizen ?? "").trim() || null;
  let purpose = (input.purpose ?? "").trim() || null;

  for (const field of input.customFields ?? []) {
    const value = (field.value ?? "").trim();
    if (!value) continue;
    const slug = slugifyLabel(field.label ?? "");
    if (!slug) continue;
    if (!usCitizen && isUsCitizenSlug(slug)) usCitizen = value;
    if (!purpose && isPurposeSlug(slug)) purpose = value;
  }

  return { usCitizen, purpose };
}

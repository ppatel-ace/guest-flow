import nodemailer from "nodemailer";
import { ConfidentialClientApplication } from "@azure/msal-node";

// ─── Required environment variables ──────────────────────────────────────────
// EMAIL_SMTP_HOST     — smtp.office365.us
// EMAIL_SMTP_PORT     — 587
// EMAIL_FROM          — no-reply@aceelectronics.com
// EMAIL_TENANT_ID     — MS365 GCC High Tenant ID
// EMAIL_CLIENT_ID     — OAuth App Client ID
// EMAIL_CLIENT_SECRET — OAuth App Client Secret
// EMAIL_SCOPE         — https://outlook.office365.us/.default

const ACE_DOMAIN = "@aceelectronics.com";

let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication | null {
  const tenantId = process.env.EMAIL_TENANT_ID;
  const clientId = process.env.EMAIL_CLIENT_ID;
  const clientSecret = process.env.EMAIL_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.us/${tenantId}`,
      },
    });
  }
  return msalClient;
}

function validateEmailConfig(): { ok: boolean; missing: string[] } {
  const required = [
    "EMAIL_SMTP_HOST",
    "EMAIL_SMTP_PORT",
    "EMAIL_FROM",
    "EMAIL_TENANT_ID",
    "EMAIL_CLIENT_ID",
    "EMAIL_CLIENT_SECRET",
    "EMAIL_SCOPE",
  ];
  const missing = required.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}

export function logEmailConfigStatus(): void {
  const { ok, missing } = validateEmailConfig();
  if (ok) {
    console.log("[email] MS365 email config loaded — notifications enabled.");
  } else {
    console.warn(
      `[email] Missing env vars: ${missing.join(", ")} — check-in email notifications are disabled.`
    );
  }
}

async function getAccessToken(): Promise<string | null> {
  const client = getMsalClient();
  if (!client) return null;
  const scope = process.env.EMAIL_SCOPE;
  if (!scope) return null;
  try {
    const result = await client.acquireTokenByClientCredential({ scopes: [scope] });
    return result?.accessToken ?? null;
  } catch (err) {
    console.error("[email] Failed to acquire OAuth token:", err);
    return null;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CheckInVisitor {
  fullName: string;
  email: string | null;
  company: string | null;
  usCitizen?: string | null;
  documentsAgreed?: string | null;
}

function formatCheckInTime(now: Date): string {
  return now.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(" at ", " at ").replace(/(\d)(AM|PM)/i, "$1 $2").toLowerCase()
    // e.g. "May 29, 2026 at 8:41 am"
    .replace(/^./, (c) => c.toUpperCase());
}

function buildRow(value: string, label: string): string {
  return `
    <tr>
      <td style="padding: 14px 0; border-bottom: 1px solid #e8e8e8;">
        <div style="font-size: 16px; color: #1a1a1a; font-weight: 400; margin-bottom: 4px;">${escapeHtml(value)}</div>
        <div style="font-size: 11px; color: #999999; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(label)}</div>
      </td>
    </tr>`;
}

export async function sendCheckInNotification(
  visitor: CheckInVisitor,
  pocName: string,
  recipientEmails: string[]
): Promise<void> {
  const { ok, missing } = validateEmailConfig();
  if (!ok) {
    console.warn(`[email] Skipping notification — missing: ${missing.join(", ")}`);
    return;
  }

  const filtered = recipientEmails.filter((e) =>
    e.trim().toLowerCase().endsWith(ACE_DOMAIN)
  );
  if (filtered.length === 0) {
    console.warn("[email] No valid @aceelectronics.com addresses to notify — skipping.");
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    console.warn("[email] Could not obtain OAuth token — skipping notification.");
    return;
  }

  const smtpHost = process.env.EMAIL_SMTP_HOST!;
  const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT!, 10);
  const fromAddress = process.env.EMAIL_FROM!;
  const fromName = process.env.EMAIL_FROM_NAME ?? "ACE Guest Check-In";

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    requireTLS: true,
    auth: {
      type: "OAuth2",
      user: fromAddress,
      accessToken: token,
    },
  });

  const now = new Date();
  const timeStr = formatCheckInTime(now);

  // Build the detail rows
  const rows: string[] = [
    buildRow("Visitor", "Purpose of visit"),
    buildRow(visitor.fullName, "Your full name"),
  ];
  if (visitor.email) rows.push(buildRow(visitor.email, "Your email address"));
  if (visitor.company) rows.push(buildRow(visitor.company, "Organization/Company"));
  rows.push(buildRow(pocName, "Host"));
  if (visitor.usCitizen) rows.push(buildRow(visitor.usCitizen, "Are you US citizen or resident"));
  if (visitor.documentsAgreed) rows.push(buildRow("Signed today", "Signed document"));

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td align="center" style="padding:0 0 24px 0;">
          <h1 style="margin:0 0 10px 0;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.3;text-align:center;">
            ${escapeHtml(visitor.fullName)} is here to see you at Ace Electronics HQ.
          </h1>
          <p style="margin:0;font-size:14px;color:#666666;text-align:center;">
            Signed in at HQ on ${escapeHtml(timeStr)}.
          </p>
        </td></tr>

        <!-- Detail card -->
        <tr><td style="background:#ffffff;border:1px solid #e0e0e0;border-radius:6px;padding:0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows.join("")}
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Plain-text fallback
  const textLines = [
    `${visitor.fullName} is here to see you at Ace Electronics HQ.`,
    `Signed in at HQ on ${timeStr}.`,
    "",
    `Purpose of visit: Visitor`,
    `Full name: ${visitor.fullName}`,
  ];
  if (visitor.email) textLines.push(`Email: ${visitor.email}`);
  if (visitor.company) textLines.push(`Company: ${visitor.company}`);
  textLines.push(`Host: ${pocName}`);
  if (visitor.usCitizen) textLines.push(`US Citizen/Resident: ${visitor.usCitizen}`);
  if (visitor.documentsAgreed) textLines.push(`Signed document: Signed today`);

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: filtered.join(", "),
      subject: `${visitor.fullName} is here to see you at Ace Electronics HQ`,
      text: textLines.join("\n"),
      html,
    });
    console.log(`[email] Notification sent to ${filtered.length} recipient(s) for visitor: ${visitor.fullName}`);
  } catch (err) {
    console.error("[email] Failed to send check-in notification:", err);
  }
}

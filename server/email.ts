import { ConfidentialClientApplication } from "@azure/msal-node";
import { storage } from "./storage";
import {
  getCheckinGlobalRecipients,
  getCheckinLocationRecipients,
  mergeInformationalRecipients,
} from "./emailRecipients";

// ─── Required environment variables ──────────────────────────────────────────
// EMAIL_FROM          — no-reply@aceelectronics.com
// EMAIL_TENANT_ID     — MS365 GCC High Tenant ID
// EMAIL_CLIENT_ID     — OAuth App Client ID
// EMAIL_CLIENT_SECRET — OAuth App Client Secret
// Optional:
// EMAIL_FROM_NAME     — Friendly sender name (default: "ACE Guest Check-In")
//
// Transport: Microsoft Graph API (graph.microsoft.us) — no SMTP config needed.

const ACE_DOMAIN = "@aceelectronics.com";
const GRAPH_SCOPE = "https://graph.microsoft.us/.default";

function graphSendUrl(fromEmail: string): string {
  return `https://graph.microsoft.us/v1.0/users/${encodeURIComponent(fromEmail)}/sendMail`;
}

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
    "EMAIL_FROM",
    "EMAIL_TENANT_ID",
    "EMAIL_CLIENT_ID",
    "EMAIL_CLIENT_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}

export function logEmailConfigStatus(): void {
  const { ok, missing } = validateEmailConfig();
  if (ok) {
    console.log("[email] MS365 Graph email config loaded — notifications enabled.");
  } else {
    console.warn(
      `[email] Missing env vars: ${missing.join(", ")} — check-in email notifications are disabled.`
    );
  }
}

async function getAccessToken(): Promise<string | null> {
  const client = getMsalClient();
  if (!client) return null;
  try {
    const result = await client.acquireTokenByClientCredential({ scopes: [GRAPH_SCOPE] });
    return result?.accessToken ?? null;
  } catch (err) {
    console.error("[email] Failed to acquire Graph OAuth token:", err);
    return null;
  }
}

async function sendViaGraph(
  token: string,
  fromAddress: string,
  toAddresses: string[],
  subject: string,
  html: string
): Promise<void> {
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: toAddresses.map((addr) => ({
        emailAddress: { address: addr.trim() },
      })),
      from: {
        emailAddress: {
          address: fromAddress,
          name: process.env.EMAIL_FROM_NAME ?? "ACE Guest Check-In",
        },
      },
    },
    saveToSentItems: false,
  };

  const res = await fetch(graphSendUrl(fromAddress), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Graph API ${res.status}: ${errText}`);
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
  purpose?: string | null;
  documentsAgreed?: string | null;
  location?: string | null;
}

function formatCheckInTime(now: Date): string {
  return now
    .toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/(\d)(AM|PM)/i, "$1 $2")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function placeLabel(location: string | null | undefined): string {
  const loc = location?.trim();
  return loc || "Ace Electronics";
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

function buildEmailHtml(
  visitor: CheckInVisitor,
  timeStr: string,
  pocName: string | null,
  isPocEmail: boolean
): string {
  const place = placeLabel(visitor.location);
  const headline = isPocEmail
    ? `${escapeHtml(visitor.fullName)} is here to see you.`
    : pocName
    ? `${escapeHtml(visitor.fullName)} is here — visiting ${escapeHtml(pocName)}.`
    : `${escapeHtml(visitor.fullName)} has checked in at ${escapeHtml(place)}.`;

  const rows: string[] = [buildRow(visitor.fullName, "Visitor")];
  if (visitor.location?.trim()) rows.push(buildRow(visitor.location.trim(), "Location"));
  if (visitor.email) rows.push(buildRow(visitor.email, "Email address"));
  if (visitor.company) rows.push(buildRow(visitor.company, "Organization / Company"));
  if (pocName) rows.push(buildRow(isPocEmail ? "You" : pocName, "Here to see"));
  if (visitor.usCitizen) rows.push(buildRow(visitor.usCitizen, "US citizen or resident"));
  if (visitor.purpose) rows.push(buildRow(visitor.purpose, "Purpose of visit"));
  if (visitor.documentsAgreed) rows.push(buildRow("Signed today", "Document"));

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:0 0 24px 0;">
          <h1 style="margin:0 0 10px 0;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.3;text-align:center;">
            ${headline}
          </h1>
          <p style="margin:0;font-size:14px;color:#666666;text-align:center;">
            Checked in at ${escapeHtml(place)} on ${escapeHtml(timeStr)}.
          </p>
        </td></tr>
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
}

/**
 * Fire-and-forget helper used by every check-in path. Resolves the POC,
 * always-notify (global), and location recipients, then sends notifications.
 * Always-notify recipients are notified regardless of location or POC.
 */
export async function notifyCheckIn(
  visitor: CheckInVisitor,
  pocName: string | null,
  location: string | null
): Promise<void> {
  try {
    const [poc, globalEmails, locationEmails] = await Promise.all([
      pocName ? storage.getAcePocByName(pocName) : Promise.resolve(null),
      getCheckinGlobalRecipients(),
      getCheckinLocationRecipients(location),
    ]);
    const pocEmails: string[] = poc?.emails ?? [];
    const informEmails = mergeInformationalRecipients(globalEmails, locationEmails);
    console.log(
      `[email] notifyCheckIn — always-notify: ${globalEmails.length} [${globalEmails.join(", ")}], ` +
        `location (${location ?? "none"}): ${locationEmails.length}, POC: ${pocEmails.length}`
    );
    if (pocEmails.length > 0 || informEmails.length > 0) {
      await sendCheckInNotification(visitor, pocName, pocEmails, informEmails);
    } else {
      console.warn("[email] notifyCheckIn — no recipients resolved (POC + always-notify + location all empty)");
    }
  } catch (err) {
    console.error("[email] check-in notification error:", err);
  }
}

/**
 * Send check-in notifications via Microsoft Graph API.
 *
 * - pocEmails    → receive a personal "is here to see YOU" email
 * - informEmails → always-notify + location recipients (informational template)
 *
 * If an address appears in both lists it only gets the POC email.
 * If pocName is null (no POC selected) both lists receive a generic notification.
 */
export async function sendCheckInNotification(
  visitor: CheckInVisitor,
  pocName: string | null,
  pocEmails: string[],
  informEmails: string[]
): Promise<void> {
  const { ok, missing } = validateEmailConfig();
  if (!ok) {
    console.warn(`[email] Skipping notification — missing: ${missing.join(", ")}`);
    return;
  }

  const fromAddress = process.env.EMAIL_FROM!;
  const place = placeLabel(visitor.location);

  const filteredPoc = pocEmails.filter((e) =>
    e.trim().toLowerCase().endsWith(ACE_DOMAIN)
  );
  const pocSet = new Set(filteredPoc.map((e) => e.trim().toLowerCase()));
  const filteredInform = informEmails.filter(
    (e) =>
      e.trim().toLowerCase().endsWith(ACE_DOMAIN) &&
      !pocSet.has(e.trim().toLowerCase())
  );

  if (filteredPoc.length === 0 && filteredInform.length === 0) {
    console.warn("[email] No valid @aceelectronics.com addresses to notify — skipping.");
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    console.warn("[email] Could not obtain OAuth token — skipping notification.");
    return;
  }

  const now = new Date();
  const timeStr = formatCheckInTime(now);
  let pocOk = 0;
  let pocFail = 0;
  let informOk = 0;
  let informFail = 0;

  // Send one recipient per Graph call so a single bad address cannot fail the batch.
  if (filteredPoc.length > 0) {
    const subject = pocName
      ? `${visitor.fullName} is here to see you${visitor.location?.trim() ? ` (${place})` : ""}`
      : `${visitor.fullName} has checked in at ${place}`;
    const html = buildEmailHtml(visitor, timeStr, pocName, true);
    await Promise.all(
      filteredPoc.map(async (addr) => {
        try {
          await sendViaGraph(token, fromAddress, [addr], subject, html);
          pocOk++;
        } catch (err) {
          pocFail++;
          console.error(`[email] Failed to send POC notification to ${addr}:`, err);
        }
      })
    );
  }

  if (filteredInform.length > 0) {
    const subject = pocName
      ? `${visitor.fullName} is here — visiting ${pocName} (${place})`
      : `${visitor.fullName} has checked in at ${place}`;
    const html = buildEmailHtml(visitor, timeStr, pocName, false);
    console.log(
      `[email] Sending always-notify + location emails to: ${filteredInform.join(", ")}`
    );
    await Promise.all(
      filteredInform.map(async (addr) => {
        try {
          await sendViaGraph(token, fromAddress, [addr], subject, html);
          informOk++;
        } catch (err) {
          informFail++;
          console.error(`[email] Failed to send check-in notification to ${addr}:`, err);
        }
      })
    );
  }

  console.log(
    `[email] Notifications finished — POC ok/fail: ${pocOk}/${pocFail}, inform ok/fail: ${informOk}/${informFail}, location: ${place}, visitor: ${visitor.fullName}`
  );
}

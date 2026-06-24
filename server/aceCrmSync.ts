import type { Express } from "express";

export function registerAceCrmSyncOnStartup(_app: Express): void {
  // ACE CRM sync — not yet configured
}

export async function syncCompanyToAceCrm(
  _name: string,
  _id: string,
): Promise<void> {
  // no-op until ACE CRM integration is configured
}

export async function syncContactToAceCrm(_contact: {
  sourceId: string;
  companyName?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  acePoc?: string | null;
}): Promise<void> {
  // no-op until ACE CRM integration is configured
}

export async function syncVisitToAceCrm(_visit: {
  sourceId: string;
  contactEmail: string;
  eventName?: string | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  acePoc?: string | null;
  customFields?: string | null;
  visitedAt: Date;
}): Promise<void> {
  // no-op until ACE CRM integration is configured
}

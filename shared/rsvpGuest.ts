export type RsvpGuestContext = { eventName: string; location: string };
export type RsvpNameOption = { id: string; fullName: string };
export type RsvpGuestResult =
  | { status: "checked-in" | "already-checked-in"; fullName: string; checkedInAt: string }
  | { status: "form-required"; formUrl: string };
export type RsvpFormContext = RsvpGuestContext & {
  ticketId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  completed: boolean;
};
export type RsvpQrConfig = {
  eventName: string;
  location: string | null;
  guestBaseUrl: string | null;
  enabled: boolean;
  guestUrl: string | null;
  qrCode: string | null;
  referenceSummary: { visits: number; names: number; automaticMatches: number; formRequired: number };
};

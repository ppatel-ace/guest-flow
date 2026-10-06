import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CheckCircle2, ChevronsUpDown, Check, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { trackFeature } from "@/components/AceUsageBeacon";
import { useQuery } from "@tanstack/react-query";
import { Turnstile } from "@marsidev/react-turnstile";
import type { AcePoc, PageSettings } from "@shared/schema";
import { OFFICE_LOCATIONS } from "@shared/locations";
import type { RsvpFormContext } from "@shared/rsvpGuest";

const TITLE_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Other"];

const EMAIL_DOMAINS = ["@gmail.com", "@yahoo.com", "@outlook.com", "@hotmail.com", "@icloud.com"];

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

const LABEL_CLASS = "text-slate-600 text-xs font-semibold uppercase tracking-wider";
const INPUT_CLASS = "bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-colors h-10";

type EmailVisitorMatch = { email: string; name: string; company?: string | null };

function EmailInput({
  value,
  onChange,
  onPickVisitor,
  allowVisitorLookup = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickVisitor?: (match: EmailVisitorMatch) => void;
  allowVisitorLookup?: boolean;
}) {
  const [domainSuggestions, setDomainSuggestions] = useState<string[]>([]);
  const [visitorMatches, setVisitorMatches] = useState<EmailVisitorMatch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (!allowVisitorLookup || q.length < 3) {
      setVisitorMatches([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kiosk/visitor-search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as EmailVisitorMatch[];
        setVisitorMatches(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setShowSuggestions(true);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [value, allowVisitorLookup]);

  const updateDomainHints = (val: string) => {
    const atIdx = val.indexOf("@");
    if (atIdx > 0) {
      const afterAt = val.slice(atIdx + 1).toLowerCase();
      const local = val.slice(0, atIdx);
      const filtered = EMAIL_DOMAINS.filter((d) => d.slice(1).startsWith(afterAt)).map((d) => `${local}${d}`);
      setDomainSuggestions(filtered);
    } else {
      setDomainSuggestions([]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    updateDomainHints(val);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    updateDomainHints(value);
    if (visitorMatches.length > 0 || domainSuggestions.length > 0) setShowSuggestions(true);
  };

  const pickDomain = (s: string) => {
    onChange(s);
    setDomainSuggestions([]);
    setShowSuggestions(false);
  };

  const pickVisitor = (match: EmailVisitorMatch) => {
    onChange(match.email);
    onPickVisitor?.(match);
    setVisitorMatches([]);
    setDomainSuggestions([]);
    setShowSuggestions(false);
  };

  const showDropdown =
    showSuggestions && (visitorMatches.length > 0 || domainSuggestions.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id="guest-email"
        type="email"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder="john@example.com"
        required
        autoComplete="off"
        className={INPUT_CLASS}
        data-testid="input-guest-email"
      />
      {showDropdown && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-md overflow-hidden">
          {visitorMatches.map((m) => (
            <li
              key={m.email}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors text-slate-700"
              onMouseDown={(e) => {
                e.preventDefault();
                pickVisitor(m);
              }}
              data-testid={`suggestion-guest-email-${m.email}`}
            >
              <div className="font-medium">{m.email}</div>
              {(m.name || m.company) && (
                <div className="text-xs text-slate-500">
                  {[m.name, m.company].filter(Boolean).join(" · ")}
                </div>
              )}
            </li>
          ))}
          {domainSuggestions
            .filter((s) => !visitorMatches.some((m) => m.email.toLowerCase() === s.toLowerCase()))
            .map((s) => (
              <li
                key={s}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors text-slate-700"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickDomain(s);
                }}
              >
                {s}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function PocCombobox({
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal h-10 bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
          data-testid="combobox-ace-poc"
        >
          {value || placeholder || "Search by name..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a name to filter..." />
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {options.map((poc) => (
                <CommandItem
                  key={poc}
                  value={poc}
                  onSelect={(selected) => {
                    onChange(selected === value ? "" : selected);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === poc ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {poc}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function GuestCheckIn() {
  const [rsvpTicket] = useState(() => new URLSearchParams(window.location.search).get("rsvp"));
  const [rsvpAlreadyRecorded, setRsvpAlreadyRecorded] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [customerName, setCustomerName] = useState("");
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [company, setCompany] = useState("");
  const [acePoc, setAcePoc] = useState("");
  const [location, setLocation] = useState("");

  const [honeypot, setHoneypot] = useState<string>("");
  const [timingToken, setTimingToken] = useState<string>("");
  const [captchaMode, setCaptchaMode] = useState<"invisible" | "visible" | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const rsvpQuery = useQuery<RsvpFormContext>({
    queryKey: ["rsvp-form-context", rsvpTicket],
    enabled: rsvpTicket !== null,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/rsvp-guest/form-context", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: rsvpTicket }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load your event form.");
      return data;
    },
  });
  const rsvpContext = rsvpQuery.data;
  const backToRsvp = `/rsvp-arrival${window.location.hash}`;
  useEffect(() => {
    if (!rsvpContext) return;
    setFirstName(rsvpContext.firstName);
    setLastName(rsvpContext.lastName);
    setLocation(rsvpContext.location);
    if (rsvpContext.completed) {
      setRsvpAlreadyRecorded(true);
      setCustomerName(rsvpContext.fullName);
      setStep("success");
    }
  }, [rsvpContext]);

  const { data: settings, isLoading: settingsLoading } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/guest_checkin_page"],
  });

  const { data: acePocOptions = [], isLoading: acePocLoading } = useQuery<AcePoc[]>({
    queryKey: ["/api/ace-pocs", { location }],
    queryFn: async () => {
      const res = await fetch(`/api/ace-pocs?location=${encodeURIComponent(location)}`);
      if (!res.ok) throw new Error("Failed to load POCs");
      return res.json();
    },
    enabled: !!location,
  });

  const pocNames = acePocOptions.map((p) => p.name);

  useEffect(() => {
    if (!acePoc || !location) return;
    if (acePocLoading) return;
    if (!pocNames.includes(acePoc)) {
      setAcePoc("");
    }
  }, [acePoc, location, acePocLoading, pocNames.join("|")]);

  useEffect(() => {
    fetch("/api/captcha-mode")
      .then((r) => r.json())
      .then((data: { mode: "invisible" | "visible"; token: string }) => {
        setCaptchaMode(data.mode);
        setTimingToken(data.token);
      })
      .catch(() => {
        setCaptchaMode("visible");
      });
  }, []);

  const pageTitle = rsvpTicket ? "Complete your RSVP check-in" : settings?.title ?? "Guest Check-In";
  const successTitle = rsvpTicket ? (rsvpAlreadyRecorded ? "Arrival already recorded." : "You're checked in.") : settings?.successTitle ?? "You're checked in.";
  const successMessage = rsvpTicket ? "Your RSVP arrival is saved. Thank you for joining us." : settings?.successMessage ?? "Your host has been notified of your arrival.";
  const eventName = rsvpContext?.eventName ?? settings?.eventName;

  const turnstileReady = !TURNSTILE_SITE_KEY || !!turnstileToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (rsvpTicket !== null && !rsvpContext) return;

    if (!location) {
      toast({ title: "Location required", description: "Please select a location before submitting.", variant: "destructive" });
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      toast({ title: "Please wait", description: "Security check not complete yet. Try again in a moment.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    trackFeature("guestflow.checkin.submit", "Guest check-in submit");
    const normalizedEmail = email.trim().toLowerCase();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      const res = await fetch("/api/guest-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: normalizedEmail,
          phoneNumber: phoneNumber.trim(),
          company: company.trim() || null,
          acePoc: acePoc || null,
          location: location || null,
          eventName: eventName || null,
          _hp: honeypot,
          _ft: timingToken,
          "cf-turnstile-response": turnstileToken,
          ...(rsvpTicket !== null ? { rsvpTicket } : {}),
        }),
      });

      if (res.status === 403 || res.status === 429) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        toast({
          title: "Verification failed",
          description: body.error ?? "Please refresh the page and try again.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        toast({ title: "Error", description: body.error ?? "Failed to submit form.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const data: { name?: string; status?: string } = await res.json();
      setRsvpAlreadyRecorded(data.status === "already-checked-in");
      setCustomerName(data.name ?? fullName);
      setStep("success");
    } catch (error) {
      console.error("Submission failed:", error);
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
      setSubmitting(false);
    }
  };

  if (rsvpTicket !== null && !rsvpContext) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-12 flex items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 space-y-5 text-slate-900">
          <img src="/logos/ace-defense-systems-rsvp.jpg" alt="Ace Electronics Defense Systems" className="w-64 max-w-full h-auto" />
          <h1 className="text-2xl font-bold">RSVP check-in</h1>
          {rsvpQuery.isPending ? <p role="status">Loading your event form…</p> : <>
            <p role="alert">{rsvpQuery.error instanceof Error ? rsvpQuery.error.message : "Unable to load your event form."}</p>
            <Button onClick={() => rsvpQuery.refetch()}>Try again</Button>
            <a className="block text-blue-800 underline" href={backToRsvp}>Return to event name search</a>
          </>}
        </div>
      </main>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8"
      style={{
        background: "radial-gradient(circle at 50% 0%, #1E3A5F 0%, #0F172A 70%, #020617 100%)",
        backgroundImage: `
          radial-gradient(circle at 50% 0%, #1E3A5F 0%, #0F172A 70%, #020617 100%),
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 60px 60px, 60px 60px",
      }}
    >
      {/* Header */}
      <div className="w-full max-w-xl flex flex-col items-center mb-8 text-center">
        <a
          href="https://www.aceelectronics.com/"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-logo"
          className="flex flex-col items-center gap-4 no-underline"
        >
          {rsvpTicket ? <div className="rounded-xl bg-white p-4 w-72 max-w-full">
            <img src="/logos/ace-defense-systems-rsvp.jpg" alt="Ace Electronics Defense Systems" className="w-full h-auto" />
          </div> : <><div className="bg-slate-800/50 p-3 rounded-2xl backdrop-blur-sm border border-slate-700/50">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight" data-testid="text-brand">
            Ace Electronics Defense Systems
          </h1></>}
        </a>
        {settingsLoading ? (
          <Skeleton className="h-5 w-48 mt-2 bg-slate-700" />
        ) : eventName ? (
          <p className="text-slate-300 text-base font-semibold mt-2" data-testid="text-event-name">{eventName}</p>
        ) : (
          <p className="text-slate-400 text-lg mt-1">Secure Facility Check-In</p>
        )}
      </div>

      {/* Card */}
      <div className="w-full max-w-xl bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5)" }}>

        {step === "success" && (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900" data-testid="text-welcome-name">
              {successTitle}
            </h2>
            <p className="text-slate-500 text-lg max-w-sm">{successMessage}</p>
            {customerName && (
              <p className="text-xl font-semibold text-slate-800">{customerName}</p>
            )}
            <p className="text-sm text-slate-400 mt-4">Please wait in the reception area.</p>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6">

            {/* Page title + description from settings */}
            {settingsLoading ? (
              <div className="space-y-1">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : (
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-slate-900">{pageTitle}</h2>
                {rsvpContext && <div className="pt-2 text-sm text-slate-600">
                  <p>Your RSVP: <strong>{rsvpContext.fullName}</strong>. Please complete your details to record your arrival.</p>
                  <a className="mt-2 inline-block text-blue-800 underline" href={backToRsvp}>Not your name? Return to search</a>
                </div>}
                {settings?.description && (
                  <p className="text-sm text-slate-500">{settings.description}</p>
                )}
              </div>
            )}

            {/* Honeypot — invisible to real users */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden", opacity: 0 }}>
              <label htmlFor="_hp">Leave this blank</label>
              <input id="_hp" name="_hp" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>

            <div className="space-y-5">
              {/* Title + First + Last */}
              <div className="grid grid-cols-1 md:grid-cols-[110px_1fr_1fr] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title-select" className={LABEL_CLASS}>
                    Title
                  </Label>
                  <Select value={title} onValueChange={setTitle}>
                    <SelectTrigger id="title-select" className={INPUT_CLASS} data-testid="select-title">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="first-name" className={LABEL_CLASS}>
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="first-name"
                    value={firstName}
                    readOnly={!!rsvpContext?.firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    className={INPUT_CLASS}
                    data-testid="input-first-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-name" className={LABEL_CLASS}>
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="last-name"
                    value={lastName}
                    readOnly={!!rsvpContext?.firstName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    className={INPUT_CLASS}
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guest-email" className={LABEL_CLASS}>
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <EmailInput
                    value={email}
                    allowVisitorLookup={rsvpTicket === null}
                    onChange={setEmail}
                    onPickVisitor={(match) => {
                      const parts = (match.name || "").trim().split(/\s+/);
                      if (parts[0]) setFirstName(parts[0]);
                      if (parts.length > 1) setLastName(parts.slice(1).join(" "));
                      if (match.company) setCompany(match.company);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-number" className={LABEL_CLASS}>
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    required
                    className={INPUT_CLASS}
                    data-testid="input-phone-number"
                  />
                </div>
              </div>

              {/* Company + Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company" className={LABEL_CLASS}>
                    Company <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                  </Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className={INPUT_CLASS}
                    data-testid="input-company"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location-select" className={LABEL_CLASS}>
                    Location <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={location}
                    disabled={!!rsvpContext}
                    onValueChange={(v) => {
                      setLocation(v);
                      setAcePoc("");
                    }}
                  >
                    <SelectTrigger id="location-select" className={INPUT_CLASS} data-testid="select-location">
                      <SelectValue placeholder="Select your location" />
                    </SelectTrigger>
                    <SelectContent>
                      {rsvpContext && !(OFFICE_LOCATIONS as readonly string[]).includes(rsvpContext.location) &&
                        <SelectItem value={rsvpContext.location}>{rsvpContext.location}</SelectItem>}
                      {OFFICE_LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ace POC — depends on location */}
              <div className="space-y-2">
                <Label className={LABEL_CLASS}>
                  Ace POC <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                </Label>
                <PocCombobox
                  value={acePoc}
                  onChange={setAcePoc}
                  options={pocNames}
                  disabled={!location || acePocLoading}
                  placeholder={
                    !location
                      ? "Select location first"
                      : acePocLoading
                      ? "Loading…"
                      : "Search by name..."
                  }
                />
              </div>
            </div>

            {/* Turnstile — visible mode */}
            {TURNSTILE_SITE_KEY && captchaMode === "visible" && (
              <div className="flex justify-center" data-testid="turnstile-widget">
                <Turnstile
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setTurnstileToken}
                  onError={() => setTurnstileToken("")}
                  onExpire={() => setTurnstileToken("")}
                  options={{ appearance: "always", theme: "light" }}
                />
              </div>
            )}

            {/* Turnstile — invisible mode */}
            {TURNSTILE_SITE_KEY && captchaMode === "invisible" && (
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                onError={() => setTurnstileToken("")}
                onExpire={() => setTurnstileToken("")}
                options={{ appearance: "execute" }}
              />
            )}

            <div className="pt-2 border-t border-slate-100">
              <Button
                type="submit"
                disabled={submitting || !turnstileReady}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-medium shadow-lg transition-all"
                data-testid="button-submit-lead"
              >
                {submitting ? "Verifying..." : "Complete Check-In"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-slate-500 text-sm flex items-center gap-2">
        <Shield className="w-4 h-4" />
        <span>Confidential &amp; Secured Facility</span>
      </div>
    </div>
  );
}

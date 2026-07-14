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
import { useQuery } from "@tanstack/react-query";
import { Turnstile } from "@marsidev/react-turnstile";
import type { PageSettings } from "@shared/schema";

const TITLE_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Other"];

const ACE_POC_OPTIONS = [
  "Jerry Parker",
  "Larry Pomasan",
  "Nish Patel",
  "Craig Frost",
  "Ashley Morris",
  "Sanjay Parimi",
];

const EMAIL_DOMAINS = ["@gmail.com", "@yahoo.com", "@outlook.com", "@hotmail.com", "@icloud.com"];

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

const LABEL_CLASS = "text-slate-600 text-xs font-semibold uppercase tracking-wider";
const INPUT_CLASS = "bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-colors h-10";

function EmailInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    const atIdx = val.indexOf("@");
    if (atIdx > 0) {
      const afterAt = val.slice(atIdx + 1).toLowerCase();
      const local = val.slice(0, atIdx);
      const filtered = EMAIL_DOMAINS.filter((d) =>
        d.slice(1).startsWith(afterAt)
      ).map((d) => `${local}${d}`);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else if (atIdx === -1 && val.length > 0) {
      setSuggestions(EMAIL_DOMAINS.map((d) => `${val}${d}`));
      setShowSuggestions(false);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleFocus = () => {
    const atIdx = value.indexOf("@");
    if (atIdx > 0) {
      const afterAt = value.slice(atIdx + 1).toLowerCase();
      const local = value.slice(0, atIdx);
      const filtered = EMAIL_DOMAINS.filter((d) =>
        d.slice(1).startsWith(afterAt)
      ).map((d) => `${local}${d}`);
      if (filtered.length > 0) {
        setSuggestions(filtered);
        setShowSuggestions(true);
      }
    }
  };

  const pickSuggestion = (s: string) => {
    onChange(s);
    setSuggestions([]);
    setShowSuggestions(false);
  };

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
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-md overflow-hidden">
          {suggestions.map((s) => (
            <li
              key={s}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors text-slate-700"
              onMouseDown={(e) => {
                e.preventDefault();
                pickSuggestion(s);
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
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10 bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
          data-testid="combobox-ace-poc"
        >
          {value || "Search by name..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a name to filter..." />
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {ACE_POC_OPTIONS.map((poc) => (
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

  const { data: settings, isLoading: settingsLoading } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/guest_checkin_page"],
  });

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

  const pageTitle = settings?.title ?? "Guest Check-In";
  const successTitle = settings?.successTitle ?? "You're checked in.";
  const successMessage = settings?.successMessage ?? "Your host has been notified of your arrival.";
  const eventName = settings?.eventName;

  const turnstileReady = !TURNSTILE_SITE_KEY || !!turnstileToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!location) {
      toast({ title: "Location required", description: "Please select a location before submitting.", variant: "destructive" });
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      toast({ title: "Please wait", description: "Security check not complete yet. Try again in a moment.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
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

      const data: { name?: string } = await res.json();
      setCustomerName(data.name ?? fullName);
      setStep("success");
    } catch (error) {
      console.error("Submission failed:", error);
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
      setSubmitting(false);
    }
  };

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
          <div className="bg-slate-800/50 p-3 rounded-2xl backdrop-blur-sm border border-slate-700/50">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight" data-testid="text-brand">
            Ace Electronics Defense Systems
          </h1>
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
                  <EmailInput value={email} onChange={setEmail} />
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

              {/* Company + Ace POC */}
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
                  <Label className={LABEL_CLASS}>
                    Ace POC <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                  </Label>
                  <PocCombobox value={acePoc} onChange={setAcePoc} />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location-select" className={LABEL_CLASS}>
                  Location <span className="text-red-500">*</span>
                </Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location-select" className={INPUT_CLASS} data-testid="select-location">
                    <SelectValue placeholder="Select your location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New Jersey">New Jersey</SelectItem>
                    <SelectItem value="Michigan">Michigan</SelectItem>
                  </SelectContent>
                </Select>
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

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CheckCircle, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Turnstile } from "@marsidev/react-turnstile";
import logoPath from "@assets/Blue AEDS_1760039355599.png";
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
        data-testid="input-guest-email"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-md overflow-hidden">
          {suggestions.map((s) => (
            <li
              key={s}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors"
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
          className="w-full justify-between font-normal"
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

  // Bot protection state
  const [timingToken, setTimingToken] = useState<string>("");
  const [captchaMode, setCaptchaMode] = useState<"invisible" | "visible" | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/guest_checkin_page"],
  });

  // Fetch CAPTCHA mode and timing token on mount
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

  const pageTitle = settings?.title ?? "Check-In";
  const description = settings?.description ?? "Please fill in your details below";
  const successTitle = settings?.successTitle ?? "Welcome!";
  const successMessage = settings?.successMessage ?? "You have been successfully checked in";
  const eventName = settings?.eventName;

  // Whether Turnstile has produced a token yet (only matters when site key is configured)
  const turnstileReady = !TURNSTILE_SITE_KEY || !!turnstileToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      toast({ title: "Please wait", description: "Security check not complete yet. Try again in a moment.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      const leadRes = await fetch("/api/leads", {
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
          // Bot-protection fields (stripped by server before DB insert)
          _hp: "",                                   // honeypot — intentionally empty for real users
          _ft: timingToken,                          // fingerprint timing token
          "cf-turnstile-response": turnstileToken,  // Cloudflare Turnstile token
        }),
      });

      if (!leadRes.ok) {
        const err = await leadRes.json();
        toast({ title: "Error", description: err.error || "Failed to submit form.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const checkInRes = await fetch("/api/guest-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email: normalizedEmail,
          phone: phoneNumber.trim() || undefined,
          status: "checked-in",
        }),
      });

      if (checkInRes.ok) {
        const customer = await checkInRes.json();
        setCustomerName(customer.name);
      } else {
        const checkInByEmail = await fetch("/api/check-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });
        if (checkInByEmail.ok) {
          const customer = await checkInByEmail.json();
          setCustomerName(customer.name);
        } else {
          setCustomerName(fullName);
        }
      }

      setStep("success");
    } catch (error) {
      console.error("Submission failed:", error);
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center py-6 px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 pt-2">
          <a href="https://www.aceelectronics.com/" target="_blank" rel="noopener noreferrer" data-testid="link-logo">
            <img src={logoPath} alt="Ace Electronics Defense Systems" className="h-20 w-auto" data-testid="img-logo" />
          </a>
          {settingsLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : eventName ? (
            <p className="text-sm font-semibold text-center text-foreground" data-testid="text-event-name">{eventName}</p>
          ) : null}
        </div>

        {step === "form" && (
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              {settingsLoading ? (
                <>
                  <Skeleton className="h-6 w-28 mb-1" />
                  <Skeleton className="h-4 w-56" />
                </>
              ) : (
                <>
                  <CardTitle className="text-xl">{pageTitle}</CardTitle>
                  <CardDescription className="text-sm">{description}</CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Honeypot field — invisible to real users, bots fill it automatically */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden", opacity: 0 }}>
                  <label htmlFor="_hp">Leave this blank</label>
                  <input id="_hp" name="_hp" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="title-select" className="text-sm font-medium">
                    Title <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                  </Label>
                  <Select value={title} onValueChange={setTitle}>
                    <SelectTrigger id="title-select" className="h-10" data-testid="select-title">
                      <SelectValue placeholder="Select title" />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first-name" className="text-sm font-medium">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      required
                      className="h-10"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last-name" className="text-sm font-medium">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      required
                      className="h-10"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="guest-email" className="text-sm font-medium">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <EmailInput value={email} onChange={setEmail} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone-number" className="text-sm font-medium">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    required
                    className="h-10"
                    data-testid="input-phone-number"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-sm font-medium">
                    Company <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                  </Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="h-10"
                    data-testid="input-company"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Ace POC <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                  </Label>
                  <PocCombobox value={acePoc} onChange={setAcePoc} />
                </div>

                {/* Cloudflare Turnstile — renders based on mode once site key is available */}
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

                {/* Invisible Turnstile (event days) — no widget, runs silently */}
                {TURNSTILE_SITE_KEY && captchaMode === "invisible" && (
                  <Turnstile
                    siteKey={TURNSTILE_SITE_KEY}
                    onSuccess={setTurnstileToken}
                    onError={() => setTurnstileToken("")}
                    onExpire={() => setTurnstileToken("")}
                    options={{ appearance: "execute" }}
                  />
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold mt-2"
                  disabled={submitting || !turnstileReady}
                  data-testid="button-submit-lead"
                >
                  {submitting ? "Submitting..." : "Check In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card className="text-center shadow-sm">
            <CardHeader className="pb-4">
              <div className="mx-auto mb-3">
                <CheckCircle className="h-14 w-14 text-green-500" />
              </div>
              <CardTitle className="text-2xl">{successTitle}</CardTitle>
              <CardDescription className="text-base">{successMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold mb-2" data-testid="text-welcome-name">
                {customerName}
              </p>
              <p className="text-sm text-muted-foreground">You're all set. Enjoy your visit!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

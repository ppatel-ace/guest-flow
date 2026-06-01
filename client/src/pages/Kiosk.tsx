import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const logoIdleSrc = "/logos/ace-logo-idle.bmp";
const logoFormSrc = "/logos/ace-logo-form.bmp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Camera, ChevronRight, Users, X, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { FormField, AcePoc } from "@shared/schema";

// ─── Template variable substitution ──────────────────────────────────────────

function substituteDocumentVars(
  content: string,
  visitor: { firstName: string; lastName: string; company: string; email: string }
): string {
  const fullName = `${visitor.firstName} ${visitor.lastName}`.trim();
  return content
    .replace(/\{\{firstName\}\}/g, visitor.firstName)
    .replace(/\{\{lastName\}\}/g, visitor.lastName)
    .replace(/\{\{fullName\}\}/g, fullName)
    .replace(/\{\{company\}\}/g, visitor.company)
    .replace(/\{\{email\}\}/g, visitor.email);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface KioskSettings {
  photoEnabled: boolean;
  plusOneEnabled: boolean;
  kioskTimeoutSeconds: number;
}

interface Document {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  sortOrder: number;
}

interface AcknowledgedDoc {
  documentId: string;
  acknowledgedAt: string;
}

interface VisitorLookupResult {
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  company: string | null;
  acePoc: string | null;
}

type KioskStep = "idle" | "form" | "documents" | "photo" | "thanks";
type FormStage = "email" | "fields";

// ─── Constants ────────────────────────────────────────────────────────────────


const TITLE_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Other"];

// ─── Device heartbeat helpers ─────────────────────────────────────────────────

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem("kioskDeviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("kioskDeviceId", id);
  }
  return id;
}

async function registerDevice(deviceId: string): Promise<string | null> {
  try {
    await fetch("/api/kiosk/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    const infoRes = await fetch(`/api/kiosk/device-info?deviceId=${encodeURIComponent(deviceId)}`);
    if (infoRes.ok) {
      const data = await infoRes.json();
      return data.defaultLocation ?? null;
    }
  } catch {
    // silently ignore
  }
  return null;
}

async function sendHeartbeat(deviceId: string, status: "idle" | "active"): Promise<void> {
  try {
    await fetch("/api/kiosk/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, status }),
    });
  } catch {
    // silently ignore
  }
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fieldVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.07, ease: "easeOut" },
  }),
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

const welcomeBadgeVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Kiosk() {
  const deviceId = useRef<string>(getOrCreateDeviceId());
  const deviceDefaultLocation = useRef<string | null>(null);
  const [step, setStep] = useState<KioskStep>("idle");
  const [visitorName, setVisitorName] = useState("");

  // Two-stage form state
  const [formStage, setFormStage] = useState<FormStage>("email");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [welcomeFirstName, setWelcomeFirstName] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [acePoc, setAcePoc] = useState("");
  const [location, setLocation] = useState("");
  const [plusOneCount, setPlusOneCount] = useState(1);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Documents state
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [acknowledgedDocs, setAcknowledgedDocs] = useState<AcknowledgedDoc[]>([]);

  // Photo state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);

  // Submission state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email autocomplete
  const [emailSuggestions, setEmailSuggestions] = useState<Array<{ email: string; name: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inactivity timer
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Settings & data queries
  const { data: settings } = useQuery<KioskSettings>({
    queryKey: ["/api/kiosk/settings"],
    refetchInterval: 60000,
  });

  const { data: enabledDocs = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents", "enabled"],
    queryFn: async () => {
      const res = await fetch("/api/documents?enabled=true");
      return res.json();
    },
  });

  const { data: customFields = [] } = useQuery<FormField[]>({
    queryKey: ["/api/form-fields"],
  });

  const { data: acePocOptions = [], isLoading: acePocLoading } = useQuery<AcePoc[]>({
    queryKey: ["/api/ace-pocs"],
  });

  const timeoutSecs = settings?.kioskTimeoutSeconds ?? 30;
  const photoEnabled = settings?.photoEnabled ?? false;
  const plusOneEnabled = settings?.plusOneEnabled ?? false;

  // ── Email autocomplete search ─────────────────────────────────────────────────

  useEffect(() => {
    if (formStage !== "email" || email.trim().length < 3) {
      setEmailSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kiosk/visitor-search?q=${encodeURIComponent(email.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setEmailSuggestions(data);
          setShowSuggestions(data.length > 0);
        }
      } catch {
        // silently ignore
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [email, formStage]);

  const handleSuggestionSelect = (suggestion: { email: string; name: string }) => {
    setEmail(suggestion.email);
    setShowSuggestions(false);
    setEmailSuggestions([]);
  };

  // ── Device registration & heartbeat ──────────────────────────────────────────

  useEffect(() => {
    registerDevice(deviceId.current).then((loc) => {
      if (loc) deviceDefaultLocation.current = loc;
    });
    const interval = setInterval(() => {
      sendHeartbeat(deviceId.current, step === "idle" ? "idle" : "active");
    }, 30000);
    return () => clearInterval(interval);
  }, [step]);

  // ── Inactivity timer ─────────────────────────────────────────────────────────

  const resetToIdle = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setShowIdleWarning(false);
    setStep("idle");
    sendHeartbeat(deviceId.current, "idle");
    // stop camera if running
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Reset form
    setFormStage("email");
    setWelcomeFirstName(null);
    setIsLookingUp(false);
    setFormTitle(""); setFirstName(""); setLastName(""); setEmail("");
    setPhone(""); setCompany(""); setAcePoc(""); setLocation(""); setPlusOneCount(1);
    setCustomFieldValues({}); setPhotoData(null); setCameraError(false);
    setCurrentDocIndex(0); setAcknowledgedDocs([]);
    setSubmitError(null); setIsSubmitting(false);
  }, []);

  const startWarningCountdown = useCallback(() => {
    setShowIdleWarning(true);
    setCountdown(10);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          resetToIdle();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [resetToIdle]);

  const resetInactivityTimer = useCallback(() => {
    if (step === "idle") return;
    if (showIdleWarning) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setShowIdleWarning(false);
    }
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(startWarningCountdown, (timeoutSecs - 10) * 1000);
  }, [step, showIdleWarning, timeoutSecs, startWarningCountdown]);

  useEffect(() => {
    if (step === "idle") {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setShowIdleWarning(false);
      return;
    }
    resetInactivityTimer();
    const handler = () => resetInactivityTimer();
    window.addEventListener("touchstart", handler);
    window.addEventListener("click", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [step, resetInactivityTimer]);

  // ── Camera helpers ────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError(true);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (step === "photo" && photoEnabled) {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [step, photoEnabled, startCamera, stopCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const data = canvasRef.current.toDataURL("image/jpeg", 0.7);
    setPhotoData(data);
  };

  // ── Navigation helpers ────────────────────────────────────────────────────────

  const startFlow = () => {
    setStep("form");
    setFormStage("email");
    sendHeartbeat(deviceId.current, "active");
  };

  const determineNextStepAfterForm = () => {
    if (!location) {
      setSubmitError("Please select a location before continuing.");
      return;
    }
    if (enabledDocs.length > 0) {
      setCurrentDocIndex(0);
      setStep("documents");
    } else if (photoEnabled) {
      setStep("photo");
    } else {
      submitCheckin(null, []);
    }
  };

  // ── Two-stage form logic ──────────────────────────────────────────────────────

  const handleEmailContinue = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsLookingUp(true);
    try {
      const res = await fetch(`/api/kiosk/visitor-lookup?email=${encodeURIComponent(trimmedEmail)}`);
      if (res.ok) {
        const data: VisitorLookupResult | null = await res.json();
        if (data) {
          // Returning visitor — pre-fill fields
          const nameParts = data.fullName.trim().split(/\s+/);
          const fn = nameParts[0] ?? "";
          const ln = nameParts.slice(1).join(" ");
          setFirstName(fn);
          setLastName(ln);
          if (data.phoneNumber) setPhone(data.phoneNumber);
          if (data.company) setCompany(data.company);
          if (data.acePoc) setAcePoc(data.acePoc);
          setWelcomeFirstName(fn);
        } else {
          // New visitor — clear any stale pre-fill
          setFirstName("");
          setLastName("");
          setCompany("");
          setAcePoc("");
          setLocation("");
          setPhone("");
          setWelcomeFirstName(null);
        }
      }
    } catch {
      // Lookup failed silently — proceed as new visitor
      setWelcomeFirstName(null);
    } finally {
      setIsLookingUp(false);
      if (deviceDefaultLocation.current) {
        setLocation(deviceDefaultLocation.current);
      }
      setFormStage("fields");
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEmailContinue();
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // If already in fields stage, reset back to email stage
    if (formStage === "fields") {
      setFormStage("email");
      setWelcomeFirstName(null);
      setFirstName("");
      setLastName("");
      setCompany("");
      setAcePoc("");
      setLocation("");
      setPhone("");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    determineNextStepAfterForm();
  };

  const handleDocAgree = () => {
    const doc = enabledDocs[currentDocIndex];
    const newAcked = [
      ...acknowledgedDocs,
      { documentId: doc.id, acknowledgedAt: new Date().toISOString() },
    ];
    setAcknowledgedDocs(newAcked);
    if (currentDocIndex + 1 < enabledDocs.length) {
      setCurrentDocIndex(currentDocIndex + 1);
    } else if (photoEnabled) {
      setStep("photo");
    } else {
      submitCheckin(null, newAcked);
    }
  };

  const handlePhotoNext = () => {
    submitCheckin(photoData, acknowledgedDocs);
  };

  const submitCheckin = async (photo: string | null, acked: AcknowledgedDoc[]) => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/kiosk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phoneNumber: phone.trim(),
          company: company.trim() || null,
          acePoc: acePoc || null,
          location: location || null,
          title: formTitle || null,
          photoData: photo || null,
          plusOneCount: plusOneEnabled ? plusOneCount : 0,
          documentsAgreed: acked.length > 0 ? JSON.stringify(acked) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err?.error ?? "Check-in failed. Please try again.");
        setIsSubmitting(false);
        return;
      }
    } catch {
      setSubmitError("Network error. Please try again.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setVisitorName(fullName);
    setStep("thanks");
    sendHeartbeat(deviceId.current, "active");
    setTimeout(() => resetToIdle(), 5000);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-background flex flex-col select-none"
      style={{ touchAction: "manipulation" }}
    >
      {/* Submission error overlay */}
      {submitError && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4" data-testid="banner-kiosk-error">
          <div className="bg-destructive text-destructive-foreground rounded-xl p-4 flex items-center justify-between gap-4 shadow-lg">
            <p className="text-base font-medium">{submitError}</p>
            <Button size="sm" variant="secondary" onClick={() => setSubmitError(null)} data-testid="button-kiosk-dismiss-error">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Submission in-progress overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-40 bg-background/80 flex items-center justify-center" data-testid="overlay-kiosk-submitting">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-lg font-medium">Checking you in…</p>
          </div>
        </div>
      )}

      {/* Inactivity warning overlay */}
      {showIdleWarning && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); setShowIdleWarning(false); resetInactivityTimer(); }}>
          <div className="bg-background rounded-2xl p-10 text-center shadow-2xl max-w-sm mx-4">
            <p className="text-2xl font-bold mb-2">Still there?</p>
            <p className="text-muted-foreground mb-6">Returning to start in <span className="font-bold text-primary">{countdown}s</span>…</p>
            <Button size="lg" className="w-full text-lg h-14" onClick={(e) => { e.stopPropagation(); if (countdownRef.current) clearInterval(countdownRef.current); setShowIdleWarning(false); resetInactivityTimer(); }} data-testid="button-kiosk-stay">
              I'm still here
            </Button>
          </div>
        </div>
      )}

      {/* ── Idle Screen ── */}
      {step === "idle" && (
        <div
          className="flex-1 flex flex-col items-center justify-center cursor-pointer gap-8 p-8"
          onClick={startFlow}
          data-testid="screen-kiosk-idle"
        >
          <img src={logoIdleSrc} alt="Ace Electronics Inc." className="h-40 w-auto object-contain max-w-xs" data-testid="img-kiosk-logo" />
          <p className="text-2xl font-bold tracking-tight">Ace Electronics Inc.</p>
          <div className="text-center space-y-2">
            <p className="text-3xl font-bold text-foreground">Welcome</p>
            <p className="text-xl text-muted-foreground">Tap anywhere to check in</p>
          </div>
          <div className="w-16 h-1 rounded-full bg-primary animate-pulse" />
        </div>
      )}

      {/* ── Form Step ── */}
      {step === "form" && (
        <div className="flex-1 overflow-auto p-6 md:p-10">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="flex items-center justify-between">
              {/* Logo: container sized to the visual footprint after rotation (240×64px) */}
              <div className="w-60 h-16 overflow-hidden relative shrink-0">
                <img
                  src={logoFormSrc}
                  alt="AE"
                  className="w-16 h-60 object-contain absolute top-1/2 left-1/2"
                  style={{ transform: "translate(-50%, -50%) rotate(-90deg)" }}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={resetToIdle} data-testid="button-kiosk-cancel" className="shrink-0">
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>
            <h1 className="text-2xl font-bold">Sign In</h1>
            <div>
              <p className="text-muted-foreground text-sm">
                {formStage === "email"
                  ? "Enter your email address to get started."
                  : "Please confirm your details below."}
              </p>
            </div>

            {/* ── Stage 1: Email only ── */}
            {formStage === "email" && (
              <div className="space-y-4">
                <motion.div
                  layoutId="kiosk-email-field"
                  className="space-y-1.5"
                >
                  <Label className="text-base">Email <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      className="h-16 text-lg"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      placeholder="your@email.com"
                      autoFocus
                      data-testid="input-kiosk-email"
                    />
                    {showSuggestions && emailSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                        {emailSuggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-muted flex flex-col border-b border-border last:border-0"
                            onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(s); }}
                            data-testid={`suggestion-email-${i}`}
                          >
                            <span className="text-base font-medium">{s.email}</span>
                            {s.name && <span className="text-sm text-muted-foreground">{s.name}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.05 }}
                >
                  <Button
                    className="w-full h-16 text-xl font-bold"
                    onClick={handleEmailContinue}
                    disabled={!email.trim() || isLookingUp}
                    data-testid="button-kiosk-email-continue"
                  >
                    {isLookingUp ? (
                      <>
                        <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" />
                        Looking up…
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            )}

            {/* ── Stage 2: Email + all fields ── */}
            {formStage === "fields" && (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Email field — shared layout animation slides it upward from Stage 1 */}
                <motion.div
                  layoutId="kiosk-email-field"
                  className="space-y-1.5"
                >
                  <Label className="text-base">Email <span className="text-destructive">*</span></Label>
                  <Input
                    className="h-14 text-base"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="your@email.com"
                    required
                    data-testid="input-kiosk-email"
                  />
                </motion.div>

                {/* Welcome back badge */}
                <AnimatePresence>
                  {welcomeFirstName && (
                    <motion.div
                      key="welcome-badge"
                      variants={welcomeBadgeVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5"
                      data-testid="badge-kiosk-welcome-back"
                    >
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm font-medium text-primary">
                        Welcome back, {welcomeFirstName}! Your details have been pre-filled.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Remaining fields — staggered reveal */}
                <motion.div
                  key="field-title"
                  custom={0}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  <Label className="text-base">Title</Label>
                  <Select value={formTitle} onValueChange={setFormTitle}>
                    <SelectTrigger className="h-14 text-base" data-testid="select-kiosk-title">
                      <SelectValue placeholder="Select title (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div
                  key="field-name"
                  custom={1}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="space-y-1.5">
                    <Label className="text-base">First Name <span className="text-destructive">*</span></Label>
                    <Input className="h-14 text-base" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" required data-testid="input-kiosk-first-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-base">Last Name <span className="text-destructive">*</span></Label>
                    <Input className="h-14 text-base" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" required data-testid="input-kiosk-last-name" />
                  </div>
                </motion.div>

                <motion.div
                  key="field-phone"
                  custom={2}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  <Label className="text-base">Phone Number <span className="text-destructive">*</span></Label>
                  <Input className="h-14 text-base" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" required data-testid="input-kiosk-phone" />
                </motion.div>

                <motion.div
                  key="field-company"
                  custom={3}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  <Label className="text-base">Company <span className="text-muted-foreground text-sm font-normal">(Optional)</span></Label>
                  <Input className="h-14 text-base" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" data-testid="input-kiosk-company" />
                </motion.div>

                <motion.div
                  key="field-poc"
                  custom={4}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  <Label className="text-base">Ace POC <span className="text-muted-foreground text-sm font-normal">(Optional)</span></Label>
                  <Select value={acePoc} onValueChange={setAcePoc} disabled={acePocLoading}>
                    <SelectTrigger className="h-14 text-base" data-testid="select-kiosk-ace-poc">
                      <SelectValue placeholder={acePocLoading ? "Loading…" : "Select a POC"} />
                    </SelectTrigger>
                    <SelectContent>
                      {acePocOptions.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </motion.div>

                {!deviceDefaultLocation.current && (
                  <motion.div
                    key="field-location"
                    custom={5}
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-1.5"
                  >
                    <Label className="text-base">Location <span className="text-destructive">*</span></Label>
                    <Select
                      value={location}
                      onValueChange={(v) => { setLocation(v); setSubmitError(null); }}
                    >
                      <SelectTrigger className="h-14 text-base" data-testid="select-kiosk-location">
                        <SelectValue placeholder="Select your location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New Jersey">New Jersey</SelectItem>
                        <SelectItem value="Michigan">Michigan</SelectItem>
                      </SelectContent>
                    </Select>
                  </motion.div>
                )}

                {/* Custom fields */}
                {customFields.map((field, idx) => (
                  <motion.div
                    key={`field-custom-${field.id}`}
                    custom={6 + idx}
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-1.5"
                  >
                    <Label className="text-base">
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                      {!field.required && <span className="text-muted-foreground text-sm font-normal"> (Optional)</span>}
                    </Label>
                    {field.fieldType === "select" ? (
                      <Select value={customFieldValues[field.id] ?? ""} onValueChange={(v) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: v }))}>
                        <SelectTrigger className="h-14 text-base" data-testid={`select-kiosk-custom-${field.id}`}>
                          <SelectValue placeholder={field.placeholder ?? "Select an option"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            try {
                              const opts = JSON.parse(field.options ?? "[]");
                              return opts.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>);
                            } catch {
                              return null;
                            }
                          })()}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="h-14 text-base"
                        type={field.fieldType}
                        value={customFieldValues[field.id] ?? ""}
                        onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={field.placeholder ?? ""}
                        required={field.required}
                        data-testid={`input-kiosk-custom-${field.id}`}
                      />
                    )}
                  </motion.div>
                ))}

                {/* Plus one */}
                {plusOneEnabled && (
                  <motion.div
                    key="field-plusone"
                    custom={6 + customFields.length}
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-1.5"
                  >
                    <Label className="text-base">
                      <Users className="inline h-4 w-4 mr-1.5" />
                      Group size
                    </Label>
                    <Input
                      className="h-14 text-base"
                      type="number"
                      min={1}
                      max={20}
                      value={plusOneCount}
                      onChange={(e) => setPlusOneCount(Number(e.target.value))}
                      data-testid="input-kiosk-plus-one"
                    />
                  </motion.div>
                )}

                <motion.div
                  key="field-submit"
                  custom={7 + customFields.length + (plusOneEnabled ? 1 : 0)}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Button type="submit" className="w-full h-16 text-xl font-bold mt-2" data-testid="button-kiosk-continue">
                    Continue
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Documents Step ── */}
      {step === "documents" && enabledDocs.length > 0 && (
        <div className="flex-1 flex flex-col p-6 md:p-10 max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm font-bold tracking-tight">Ace Electronics Defense Systems</p>
            <span className="text-sm text-muted-foreground">{currentDocIndex + 1} of {enabledDocs.length}</span>
          </div>

          <h2 className="text-2xl font-bold mb-2">{enabledDocs[currentDocIndex].title}</h2>
          <div className="flex-1 overflow-auto border rounded-xl p-5 bg-muted/30 mb-6 text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-document-content">
            {substituteDocumentVars(enabledDocs[currentDocIndex].content, {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              company: company.trim(),
              email: email.trim(),
            })}
          </div>

          <Button
            className="w-full h-16 text-xl font-bold"
            onClick={handleDocAgree}
            data-testid="button-kiosk-agree"
          >
            I Agree
          </Button>
        </div>
      )}

      {/* ── Photo Step ── */}
      {step === "photo" && photoEnabled && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6" data-testid="screen-kiosk-photo">
          <p className="text-sm font-bold tracking-tight">Ace Electronics Defense Systems</p>
          <div>
            <h2 className="text-2xl font-bold text-center">Take a Photo</h2>
            <p className="text-muted-foreground text-center text-sm mt-1">We'll use this for your visitor badge.</p>
          </div>

          {cameraError ? (
            <div className="text-center space-y-4">
              <Camera className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Camera not available</p>
              <Button className="h-14 text-lg px-8" onClick={() => submitCheckin(null, acknowledgedDocs)} data-testid="button-kiosk-skip-photo">
                Skip Photo
              </Button>
            </div>
          ) : photoData ? (
            <div className="space-y-4 flex flex-col items-center">
              <img src={photoData} alt="Captured" className="rounded-2xl shadow-lg max-w-xs w-full" data-testid="img-kiosk-preview" />
              <div className="flex gap-3">
                <Button variant="outline" className="h-12 px-6" onClick={() => setPhotoData(null)} data-testid="button-kiosk-retake">Retake</Button>
                <Button className="h-12 px-8 text-base font-bold" onClick={handlePhotoNext} data-testid="button-kiosk-use-photo">Use Photo</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 flex flex-col items-center">
              <div className="rounded-2xl overflow-hidden shadow-lg w-full max-w-xs aspect-[3/4] bg-muted">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-3">
                <Button variant="outline" className="h-12 px-6" onClick={() => submitCheckin(null, acknowledgedDocs)} data-testid="button-kiosk-skip-photo">
                  Skip
                </Button>
                <Button className="h-14 w-14 rounded-full p-0 text-2xl" onClick={capturePhoto} data-testid="button-kiosk-capture">
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Thank You Step ── */}
      {step === "thanks" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8" data-testid="screen-kiosk-thanks">
          <p className="text-lg font-bold tracking-tight">Ace Electronics Defense Systems</p>
          <CheckCircle className="h-24 w-24 text-green-500" />
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Welcome, {visitorName.split(" ")[0]}!</h2>
            <p className="text-xl text-muted-foreground">You're all checked in. Enjoy your visit!</p>
          </div>
          <p className="text-sm text-muted-foreground">Returning to start in 5 seconds…</p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import type { RsvpGuestContext, RsvpGuestResult, RsvpNameOption } from "@shared/rsvpGuest";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Loader2, Search, ShieldCheck, UserRoundCheck } from "lucide-react";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
type CaptchaMode = { mode: "invisible" | "visible"; token: string };
type ArrivalResult = Extract<RsvpGuestResult, { status: "checked-in" | "already-checked-in" }>;
type Phase = "loading" | "ready" | "invalid" | "unavailable";

async function parseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error || body?.message || fallback;
}

function arrivalTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function RsvpGuest() {
  const token = useRef(new URLSearchParams(window.location.hash.slice(1)).get("event") || "");
  const openedAt = useRef(Date.now());
  const requestIds = useRef(new Map<string, string>());
  const searchController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<number | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>(token.current ? "loading" : "invalid");
  const [context, setContext] = useState<RsvpGuestContext | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaMode | null>(null);
  const [captchaError, setCaptchaError] = useState("");
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [query, setQuery] = useState("");
  const [attendees, setAttendees] = useState<RsvpNameOption[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [submittingId, setSubmittingId] = useState("");
  const [result, setResult] = useState<ArrivalResult | null>(null);
  const [submitError, setSubmitError] = useState("");

  const refreshCaptcha = async () => {
    setCaptchaError("");
    setTurnstileToken("");
    setCaptcha(null);
    try {
      const response = await fetch("/api/captcha-mode", { cache: "no-store" });
      if (!response.ok) throw new Error("Security check could not be refreshed.");
      const value = (await response.json()) as CaptchaMode;
      if (!value.token || !["invisible", "visible"].includes(value.mode)) throw new Error("Security check is unavailable. Reload this page.");
      setCaptcha(value);
      openedAt.current = Date.now();
      setCaptchaRevision((revision) => revision + 1);
    } catch (error) {
      setCaptchaError(error instanceof Error ? error.message : "Security check is unavailable. Reload this page.");
    }
  };

  useEffect(() => {
    if (!token.current) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const [contextResponse] = await Promise.all([
          fetch("/api/rsvp-guest/context", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.current}` },
            body: "{}",
            signal: controller.signal,
          }),
          refreshCaptcha(),
        ]);
        if (contextResponse.status === 401 || contextResponse.status === 403) {
          setSubmitError(await parseError(contextResponse, "Please ask staff for the current event QR."));
          setPhase("invalid");
          return;
        }
        if (!contextResponse.ok) throw new Error(await parseError(contextResponse, "Event details could not be loaded."));
        setContext((await contextResponse.json()) as RsvpGuestContext);
        setPhase("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setSubmitError(error instanceof Error ? error.message : "Could not load this event.");
        setPhase("unavailable");
      }
    };
    void load();
    return () => {
      controller.abort();
      searchController.current?.abort();
      window.clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    searchController.current?.abort();
    window.clearTimeout(debounceTimer.current);
    const term = query.trim();
    setSearchError("");
    setAttendees([]);
    setTruncated(false);
    if (phase !== "ready" || term.length < 2) {
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceTimer.current = window.setTimeout(async () => {
      const controller = new AbortController();
      searchController.current = controller;
      try {
        const response = await fetch(`/api/rsvp-guest/search?q=${encodeURIComponent(term)}`, {
          headers: { Authorization: `Bearer ${token.current}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) {
          setPhase("invalid");
          return;
        }
        if (!response.ok) throw new Error(await parseError(response, "Name search failed. Try again."));
        const data = (await response.json()) as { attendees: RsvpNameOption[]; truncated: boolean };
        setAttendees(Array.isArray(data.attendees) ? data.attendees.slice(0, 20) : []);
        setTruncated(!!data.truncated);
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Name search failed. Try again.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(debounceTimer.current);
      searchController.current?.abort();
    };
  }, [query, phase]);

  const checkIn = async (attendee: RsvpNameOption) => {
    if (submittingId || result || !captcha?.token || captchaError) return;
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setSubmitError("Complete the security check before confirming your arrival.");
      return;
    }
    setSubmitError("");
    setSubmittingId(attendee.id);
    const requestId = requestIds.current.get(attendee.id) || crypto.randomUUID();
    requestIds.current.set(attendee.id, requestId);
    try {
      const remaining = 2000 - (Date.now() - openedAt.current);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      const response = await fetch("/api/rsvp-guest/select", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.current}`,
        },
        body: JSON.stringify({
          attendeeId: attendee.id,
          requestId,
          _hp: "",
          _ft: captcha.token,
          "cf-turnstile-response": turnstileToken,
        }),
      });
      if (response.status === 401) {
        setPhase("invalid");
        return;
      }
      if (!response.ok) throw new Error(await parseError(response, "We could not confirm your arrival. Please try again."));
      const data = (await response.json()) as RsvpGuestResult;
      if (data.status === "form-required") {
        window.location.assign(data.formUrl);
        return;
      }
      setResult(data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We could not confirm your arrival. Please try again.");
      void refreshCaptcha();
    } finally {
      setSubmittingId("");
    }
  };

  const retry = () => {
    setSubmitError("");
    void refreshCaptcha();
  };

  const turnstileReady = !TURNSTILE_SITE_KEY || !!turnstileToken;
  const canCheckIn = !!captcha?.token && !captchaError && turnstileReady && !submittingId;

  return (
    <main className="min-h-[100dvh] bg-[#f1f3f7] px-4 py-6 text-[#17294f] sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-[#dfe4ec]">
            <img src="/logos/ace-defense-systems-rsvp.jpg" alt="Ace Electronics Defense Systems" width={1519} height={486} className="h-auto w-44 max-w-[48vw]" />
          </div>
          <div className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#64738c] sm:flex"><span className="h-2 w-2 rounded-full bg-[#b58a4d]" /> GuestFlow · AUSA</div>
        </header>

        <div className="my-auto grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.84fr)] lg:items-stretch lg:py-14">
          <section className="relative overflow-hidden rounded-2xl bg-[#142c68] p-6 text-white shadow-[0_20px_55px_-35px_rgba(16,36,83,.8)] sm:p-9">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border-[1px] border-white/10" />
            <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[1px] border-white/10" />
            <div className="relative flex h-full flex-col">
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#e7bd79]">Arrival registration</p>
              <h1 className="mt-5 max-w-md text-4xl font-semibold leading-[1.06] tracking-[-.035em] sm:text-[3.25rem]">Welcome.<br />Let’s mark your arrival.</h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#d1daed]">Find your RSVP by name. You will confirm your own arrival before anything is recorded.</p>
              <div className="mt-9 border-t border-white/15 pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#e7bd79]">Today’s event</p>
                {phase === "loading" ? <div aria-label="Loading event details" className="mt-3 h-5 w-48 animate-pulse rounded bg-white/15" /> : (
                  <>
                    <p className="mt-2 text-lg font-medium text-white">{context?.eventName || "AUSA event"}</p>
                    <p className="mt-1 text-sm text-[#c2cee3]">{context?.location || "Event venue"}</p>
                  </>
                )}
              </div>
              <div className="mt-auto hidden items-center gap-2 pt-8 text-xs text-[#bdc9df] sm:flex"><ShieldCheck className="h-4 w-4 text-[#e7bd79]" /> Secure event link · no contact details displayed</div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#dde3ec] bg-[#fffefa] p-5 shadow-[0_18px_50px_-40px_rgba(28,44,78,.55)] sm:p-8">
            {phase === "invalid" ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f7eee0] text-[#8b652b]"><AlertCircle className="h-6 w-6" /></div>
                <h2 className="mt-5 text-xl font-semibold">{token.current ? "This arrival link is unavailable" : "Open the event QR to check in"}</h2>
                <p role="alert" className="mt-2 max-w-sm text-sm leading-6 text-[#65738a]">{submitError || "Please scan the event QR or ask the event team for a current link."}</p>
              </div>
            ) : phase === "unavailable" ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-700"><AlertCircle className="h-6 w-6" /></div>
                <h2 className="mt-5 text-xl font-semibold">Event details could not load</h2>
                <p role="alert" className="mt-2 max-w-sm text-sm leading-6 text-[#65738a]">{submitError || "Check your connection, then reload the event QR."}</p>
                <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-lg bg-[#193878] px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#193878]/40">Reload event link</button>
              </div>
            ) : result ? (
              <div role="status" aria-live="polite" className="flex min-h-[390px] flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-[#a47535]">{result.status === "already-checked-in" ? "Arrival already recorded" : "Arrival confirmed"}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{result.fullName}</h2>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#f1f4f8] px-3 py-2 text-sm text-[#53627a]"><Clock3 className="h-4 w-4" />{arrivalTime(result.checkedInAt)}</div>
                <p className="mt-5 max-w-sm text-sm leading-6 text-[#65738a]">You’re all set. The event team can see that you have arrived.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#a47535]">Find your RSVP</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Search your name</h2>
                  <p className="mt-2 text-sm leading-6 text-[#65738a]">Enter at least two letters. Only names are shown; no contact or attendance details.</p>
                </div>
                <label htmlFor="guest-arrival-search" className="mb-2 block text-sm font-semibold">First or last name</label>
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75839a]" />
                  <input id="guest-arrival-search" type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} disabled={phase !== "ready" || !!submittingId} placeholder="Start typing your name" className="h-12 w-full rounded-lg border border-[#ccd5e2] bg-white pl-10 pr-4 text-sm outline-none transition focus-visible:border-[#193878] focus-visible:ring-2 focus-visible:ring-[#193878]/20 disabled:opacity-60" />
                </div>
                <div className="mt-2 min-h-6 text-xs text-[#68768b]" aria-live="polite">
                  {phase === "loading" ? "Verifying event link…" : query.trim().length < 2 ? "At least 2 characters required" : searching ? "Searching names…" : ""}
                </div>
                {searchError ? <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{searchError}</div> : null}
                {query.trim().length >= 2 && !searching && !searchError && phase === "ready" ? (
                  attendees.length ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-[#718096]">{truncated ? "First 20 matching names" : `${attendees.length} ${attendees.length === 1 ? "match" : "matches"}`}</p>
                      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1" aria-label="Matching RSVP names">
                        {attendees.map((attendee) => (
                          <li key={attendee.id}>
                            <button type="button" onClick={() => void checkIn(attendee)} disabled={!canCheckIn || !!submittingId} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#e0e6ef] bg-white px-3.5 py-2.5 text-left text-sm font-medium text-[#263b61] transition hover:border-[#aebbd0] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#193878] disabled:cursor-not-allowed disabled:opacity-60">
                              <span className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef2f8] text-[#24427e]"><UserRoundCheck className="h-4 w-4" /></span><span className="truncate">{attendee.fullName}</span></span>
                              {submittingId === attendee.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#344f85]">Confirm arrival <ArrowRight className="h-3.5 w-3.5" /></span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs leading-relaxed text-[#68768b]">Choose “Confirm arrival” only for yourself. Selecting a name records your arrival.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#d4dce7] bg-[#f8f9fb] px-4 py-7 text-center">
                      <p className="text-sm font-medium text-[#3d4e6b]">No names found</p>
                      <p className="mt-1 text-xs text-[#77849a]">Check the spelling or try a different part of your name.</p>
                    </div>
                  )
                ) : null}
                {captcha?.mode === "visible" && TURNSTILE_SITE_KEY ? (
                  <div className="mt-5 flex justify-center" data-testid="guest-arrival-turnstile">
                    <Turnstile key={captchaRevision} siteKey={TURNSTILE_SITE_KEY} onSuccess={setTurnstileToken} onError={() => setTurnstileToken("")} onExpire={() => setTurnstileToken("")} options={{ appearance: "always", theme: "light" }} />
                  </div>
                ) : null}
                {captcha?.mode === "invisible" && TURNSTILE_SITE_KEY ? (
                  <div className="sr-only" data-testid="guest-arrival-turnstile">
                    <Turnstile key={captchaRevision} siteKey={TURNSTILE_SITE_KEY} onSuccess={setTurnstileToken} onError={() => setTurnstileToken("")} onExpire={() => setTurnstileToken("")} options={{ appearance: "execute" }} />
                  </div>
                ) : null}
                {captchaError ? <p role="alert" className="mt-4 text-sm text-rose-700">{captchaError}</p> : null}
                {submitError ? (
                  <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
                    <p className="font-semibold">Arrival was not confirmed</p><p className="mt-1 leading-5">{submitError}</p>
                    <button type="button" onClick={retry} className="mt-2 min-h-9 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700">Refresh security check and retry</button>
                  </div>
                ) : null}
                {!captcha || !turnstileReady ? (
                  <p className="mt-4 flex items-center gap-2 text-xs text-[#748198]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Preparing secure arrival confirmation…</p>
                ) : null}
              </>
            )}
          </section>
        </div>
        <footer className="flex items-center justify-center gap-2 pb-2 text-xs text-[#6a7890]"><ShieldCheck className="h-4 w-4 text-[#a47535]" /> Secure RSVP arrival · Ace Electronics Defense Systems</footer>
      </div>
    </main>
  );
}

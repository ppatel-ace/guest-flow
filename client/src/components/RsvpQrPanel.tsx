import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  Save,
} from "lucide-react";
import type { RsvpQrConfig } from "@shared/rsvpGuest";
import { Button } from "@/components/ui/button";

const currentOrigin = () => window.location.origin;

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error || body?.message || fallback;
}

async function printableQr(config: RsvpQrConfig) {
  if (!config.qrCode) return;
  const popup = window.open("", "_blank", "width=720,height=820");
  if (!popup) throw new Error("Allow pop-ups in your browser to print the event QR.");
  popup.opener = null;
  let logoUrl: string;
  try {
    // A proxied about:blank print window may stall on external image requests.
    // Embed the already loaded, same-origin brand image so the printout is self-contained.
    const logo = document.querySelector<HTMLImageElement>('img[alt="Ace Electronics Defense Systems"]');
    if (!logo) throw new Error("The company logo is not ready. Please try printing again.");
    await logo.decode();
    const canvas = document.createElement("canvas");
    canvas.width = logo.naturalWidth;
    canvas.height = logo.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the printout.");
    context.drawImage(logo, 0, 0);
    logoUrl = canvas.toDataURL("image/png");
  } catch (error) {
    popup.close();
    throw error;
  }
  popup.document.write(`<!doctype html><html><head><title>GuestFlow RSVP QR</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body{margin:0;padding:48px 24px;font:16px Arial,sans-serif;color:#10244a;text-align:center}
    img{display:block;width:min(76vw,390px);height:auto;margin:34px auto}
    h1{font-size:25px;margin:0 0 8px}p{color:#52627b;margin:8px 0}
    .mark{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#b3813b}
    @media print{body{padding:24px}}</style></head><body>
    <img src="${logoUrl}" alt="Ace Electronics Defense Systems" style="width:260px;margin:0 auto 24px">
    <div class="mark">GuestFlow · RSVP check-in</div>
    <h1>${escapeHtml(config.eventName)}</h1><p>${escapeHtml(config.location || "")}</p>
    <img src="${config.qrCode}" alt="Guest RSVP arrival QR code">
    <p>Scan to find your name and confirm your arrival.</p>
    <script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

export default function RsvpQrPanel() {
  const [config, setConfig] = useState<RsvpQrConfig | null>(null);
  const [location, setLocation] = useState("");
  const [guestBaseUrl, setGuestBaseUrl] = useState(currentOrigin);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rsvp/qr-config", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, "Could not load RSVP QR settings."));
        return response.json() as Promise<RsvpQrConfig>;
      })
      .then((saved) => {
        setConfig(saved);
        setLocation(saved.location || "");
        setGuestBaseUrl(saved.guestBaseUrl || currentOrigin());
        setEnabled(saved.enabled);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Could not load RSVP QR settings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const baseUrlError = useMemo(() => {
    if (!guestBaseUrl.trim()) return "Enter the published guest page base URL.";
    try {
      const parsed = new URL(guestBaseUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) return "Use a complete http or https URL.";
      return "";
    } catch {
      return "Enter a complete URL, for example https://registration.example.com.";
    }
  }, [guestBaseUrl]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || loading) return;
    setError("");
    setNotice("");
    if (!location.trim()) {
      setError("Add the current event venue. Do not use an office location.");
      return;
    }
    if (baseUrlError) {
      setError(baseUrlError);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/rsvp/qr-config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: location.trim(), guestBaseUrl: guestBaseUrl.trim().replace(/\/+$/, ""), enabled }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not save the guest QR configuration."));
      const saved = (await response.json()) as RsvpQrConfig;
      setConfig(saved);
      setLocation(saved.location || "");
      setGuestBaseUrl(saved.guestBaseUrl || currentOrigin());
      setEnabled(saved.enabled);
      setNotice(saved.enabled ? "Guest arrival QR is ready. Configuration saved." : "Guest arrival QR has been disabled.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the guest QR configuration.");
    } finally {
      setSaving(false);
    }
  };

  const downloadPng = () => {
    if (!config?.qrCode) return;
    const link = document.createElement("a");
    link.href = config.qrCode;
    link.download = "guestflow-rsvp-arrival.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const openGuestLink = () => {
    if (config?.guestUrl) window.open(config.guestUrl, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    if (!config?.guestUrl) return;
    try {
      await navigator.clipboard.writeText(config.guestUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the link. Select and copy it from the field instead.");
    }
  };

  return (
    <section aria-labelledby="rsvp-qr-heading" className="overflow-hidden rounded-2xl border border-[#d6deeb] bg-[#fffefa] shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#e4e8ef] bg-[#f4f6fa] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#152c67] text-white">
            <QrCode className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#a47535]">Guest arrival · AUSA</p>
            <h2 id="rsvp-qr-heading" className="mt-1 text-xl font-semibold tracking-tight text-[#172b57]">Publish the guest QR</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#5e6c82]">Guests scan, find their own name, then choose to confirm arrival.</p>
          </div>
        </div>
        {config?.enabled && config.qrCode ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Live QR
          </span>
        ) : (
          <span className="inline-flex w-fit items-center rounded-full border border-[#d7deea] bg-white px-3 py-1.5 text-xs font-medium text-[#68768b]">Not published</span>
        )}
      </div>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={save} className="space-y-5">
          {loading ? (
            <div role="status" aria-label="Loading QR settings" className="space-y-4">
              <div className="h-4 w-36 animate-pulse rounded bg-[#e9edf3]" />
              <div className="h-11 animate-pulse rounded-lg bg-[#e9edf3]" />
              <div className="h-4 w-52 animate-pulse rounded bg-[#e9edf3]" />
              <div className="h-11 animate-pulse rounded-lg bg-[#e9edf3]" />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="rsvp-event-location" className="mb-1.5 block text-sm font-semibold text-[#24395f]">Current event venue</label>
                <input id="rsvp-event-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Walter E. Washington Convention Center · Hall ..." required maxLength={180} className="h-11 w-full rounded-lg border border-[#ccd5e2] bg-white px-3.5 text-sm text-[#1c2e50] outline-none transition focus-visible:border-[#183574] focus-visible:ring-2 focus-visible:ring-[#183574]/20" />
                <p className="mt-1.5 text-xs text-[#68768b]">Enter the venue for this event. No historic office address is assumed.</p>
              </div>
              <div>
                <label htmlFor="rsvp-guest-base-url" className="mb-1.5 block text-sm font-semibold text-[#24395f]">Published guest page base URL</label>
                <input id="rsvp-guest-base-url" inputMode="url" autoCapitalize="none" value={guestBaseUrl} onChange={(event) => setGuestBaseUrl(event.target.value)} aria-invalid={!!baseUrlError} placeholder="https://registration.example.com" className="h-11 w-full rounded-lg border border-[#ccd5e2] bg-white px-3.5 text-sm text-[#1c2e50] outline-none transition focus-visible:border-[#183574] focus-visible:ring-2 focus-visible:ring-[#183574]/20 aria-[invalid=true]:border-rose-500" />
                <p className="mt-2 rounded-lg border border-[#ead8b8] bg-[#fff9ee] px-3 py-2.5 text-xs leading-relaxed text-[#70562d]">
                  Current address: <span className="font-mono">{currentOrigin()}</span>. A preview or internal-domain QR only reaches that server. Before event day, set the public guest URL and republish.
                </p>
                {baseUrlError ? <p className="mt-1 text-xs text-rose-700">{baseUrlError}</p> : null}
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[#e0e5ed] px-3.5 py-2.5">
                <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-[#193878]" />
                <span className="text-sm font-medium text-[#273b60]">Enable guest self-arrival QR</span>
              </label>
              {error ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
              {notice ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-emerald-800"><Check className="h-4 w-4" />{notice}</p> : null}
              <Button type="submit" disabled={saving || loading || !!baseUrlError || !location.trim()} className="min-h-11 bg-[#193878] px-5 text-white hover:bg-[#11295f]">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : config ? <RefreshCw className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Saving configuration…" : "Save and generate QR"}
              </Button>
              <p className="text-xs leading-relaxed text-[#68768b]">Generating this code saves event settings only. It does not look up or check in any guest.</p>
            </>
          )}
        </form>

        <aside className="rounded-xl border border-[#e0e5ed] bg-[#f8f9fb] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[#25395f]">Arrival code</h3>
          {config?.enabled && config.qrCode ? (
            <>
              <div className="mt-4 grid aspect-square place-items-center rounded-lg border border-[#e1e5eb] bg-white p-4">
                <img src={config.qrCode} alt="Guest RSVP arrival QR code" className="h-full max-h-56 w-full object-contain" />
              </div>
              <p className="mt-3 text-center text-xs text-[#68768b]">{config.eventName}{config.location ? ` · ${config.location}` : ""}</p>
              {config.guestUrl ? (
                <>
                  <div className="mt-3 flex gap-2">
                    <input aria-label="Guest arrival link" readOnly value={config.guestUrl} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-[#d7deea] bg-white px-2.5 py-2 font-mono text-[11px] text-[#40516b]" />
                    <Button type="button" variant="outline" onClick={copyLink} className="shrink-0">{copied ? "Copied" : "Copy"}</Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={downloadPng} className="min-h-10 px-2 text-xs"><Download className="mr-1.5 h-4 w-4" />PNG</Button>
                    <Button type="button" variant="outline" onClick={async () => {
                      try { await printableQr(config); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to print the event QR."); }
                    }} className="min-h-10 px-2 text-xs"><Printer className="mr-1.5 h-4 w-4" />Print</Button>
                    <Button type="button" onClick={openGuestLink} className="col-span-2 min-h-10 bg-[#193878] text-white hover:bg-[#11295f]"><ExternalLink className="mr-2 h-4 w-4" />Open / test guest page</Button>
                  </div>
                </>
              ) : <p role="alert" className="mt-3 text-xs text-rose-700">The server did not return a guest link. Save the configuration again.</p>}
            </>
          ) : (
            <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[#cbd4e1] bg-white px-5 text-center">
              <QrCode className="h-8 w-8 text-[#8290a5]" aria-hidden />
              <p className="mt-3 text-sm font-medium text-[#40516b]">{loading ? "Loading saved configuration" : enabled ? "QR appears after saving" : "Guest QR is disabled"}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#718096]">{loading ? "Retrieving the current event settings." : "Set the event venue and public guest URL, then save to publish."}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

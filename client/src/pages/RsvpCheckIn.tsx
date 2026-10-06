import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRsvpFullscreen } from "@/components/RsvpFullscreen";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Maximize2,
  Minimize2,
  Loader2,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from "lucide-react";

type Attendee = {
  id: string;
  eventKey: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sourceCategory: string;
  plusOneCount: number;
  checkedInAt: string | null;
  attendanceRevision: number;
};

type RsvpResponse = {
  eventName: string;
  attendees: Attendee[];
};

const rosterQueryKey = ["/api/rsvp/attendees"] as const;

function isUnauthorized(error: unknown) {
  return error instanceof Error && /^\s*(401|403)\b/.test(error.message);
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong. Please try again.";
  if (isUnauthorized(error)) return "Your staff session has expired. Sign in again to continue.";
  const message = error.message.replace(/^\d{3}:\s*/, "");
  return message || "Something went wrong. Please try again.";
}

function arrivalTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Arrival time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function initials(attendee: Attendee) {
  return `${attendee.firstName.charAt(0)}${attendee.lastName.charAt(0)}`.toUpperCase();
}

export default function RsvpCheckIn() {
  const { expanded, toggle } = useRsvpFullscreen();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeOption, setActiveOption] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [sessionExpired, setSessionExpired] = useState(false);
  const [notice, setNotice] = useState("");
  const [undoTarget, setUndoTarget] = useState<Attendee | null>(null);
  const [exportScope, setExportScope] = useState<"all" | "arrivals">("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const rosterQuery = useQuery<RsvpResponse>({
    queryKey: rosterQueryKey,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/rsvp/attendees");
      return response.json() as Promise<RsvpResponse>;
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });

  const attendees = useMemo(
    () =>
      [...(rosterQuery.data?.attendees ?? [])].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
      ),
    [rosterQuery.data?.attendees],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const matchingAttendees = useMemo(() => {
    if (!normalizedSearch) return [];
    return attendees.filter((attendee) =>
      `${attendee.firstName} ${attendee.lastName} ${attendee.fullName}`
        .toLocaleLowerCase()
        .includes(normalizedSearch),
    );
  }, [attendees, normalizedSearch]);

  const visibleAttendees = useMemo(() => {
    if (selectedId) return attendees.filter((attendee) => attendee.id === selectedId);
    if (!normalizedSearch) return attendees;
    return attendees.filter((attendee) =>
      `${attendee.firstName} ${attendee.lastName} ${attendee.fullName}`
        .toLocaleLowerCase()
        .includes(normalizedSearch),
    );
  }, [attendees, normalizedSearch, selectedId]);

  const checkedInCount = attendees.filter((attendee) => attendee.checkedInAt).length;
  const authorizationExpired =
    sessionExpired || isUnauthorized(rosterQuery.error);

  const downloadAttendance = async () => {
    if (authorizationExpired || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(`/api/rsvp/attendance.csv?scope=${exportScope}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setSessionExpired(true);
          throw new Error("Your staff session has expired. Sign in again to download attendance.");
        }
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || "Unable to download RSVP attendance. Please try again.");
      }
      if (!response.headers.get("content-type")?.startsWith("text/csv")) {
        throw new Error("The server did not return an attendance CSV. Please try again.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ausa-2026-attendance-${exportScope}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to download RSVP attendance. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const saveAttendance = async (attendee: Attendee, undo = false) => {
    if (authorizationExpired || (!undo && attendee.checkedInAt) || pendingIds.has(attendee.id)) return;
    setPendingIds((current) => new Set(current).add(attendee.id));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[attendee.id];
      return next;
    });
    setNotice("");
    try {
      await queryClient.cancelQueries({ queryKey: rosterQueryKey });
      const response = await apiRequest(
        "POST",
        `/api/rsvp/attendees/${encodeURIComponent(attendee.id)}/${undo ? "undo-check-in" : "check-in"}`,
        undo ? { confirmed: true, expectedRevision: attendee.attendanceRevision } : undefined,
      );
      const updated = (await response.json()) as Attendee;
      queryClient.setQueryData<RsvpResponse>(rosterQueryKey, (current) =>
        current
          ? {
              ...current,
              attendees: current.attendees.map((item) =>
                item.id === updated.id && item.attendanceRevision <= updated.attendanceRevision ? updated : item,
              ),
            }
          : current,
      );
      setNotice(undo ? `Check-in undone for ${updated.fullName}. Original arrival retained in the audit history.` : `${updated.fullName} checked in.`);
      if (undo) setUndoTarget(null);
    } catch (error) {
      if (isUnauthorized(error)) setSessionExpired(true);
      setRowErrors((current) => ({
        ...current,
        [attendee.id]: errorMessage(error),
      }));
      if (error instanceof Error && /^409:/.test(error.message)) setUndoTarget(null);
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(attendee.id);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: rosterQueryKey });
    }
  };

  const chooseAttendee = (attendee: Attendee) => {
    setSearch(attendee.fullName);
    setSelectedId(attendee.id);
    setFocused(false);
    setActiveOption(0);
    inputRef.current?.blur();
  };

  const clearSearch = () => {
    setSearch("");
    setSelectedId(null);
    setActiveOption(0);
    setFocused(true);
    inputRef.current?.focus();
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && matchingAttendees.length) {
      event.preventDefault();
      setFocused(true);
      setActiveOption((index) => (index + 1) % matchingAttendees.length);
    } else if (event.key === "ArrowUp" && matchingAttendees.length) {
      event.preventDefault();
      setFocused(true);
      setActiveOption((index) => (index - 1 + matchingAttendees.length) % matchingAttendees.length);
    } else if (event.key === "Enter" && focused && matchingAttendees[activeOption]) {
      event.preventDefault();
      chooseAttendee(matchingAttendees[activeOption]);
    } else if (event.key === "Escape") {
      setFocused(false);
    }
  };

  const queryUnauthorized = isUnauthorized(rosterQuery.error);
  const initialLoading = rosterQuery.isPending && !rosterQuery.data;
  const initialError = rosterQuery.isError && !rosterQuery.data;
  const dropdownOpen = focused && !!normalizedSearch && !selectedId;

  return (
    <section
      className={expanded
        ? "space-y-5 pb-6"
        : "space-y-6"}
      data-testid="page-rsvp-check-in"
    >
      <AlertDialog
        open={!!undoTarget}
        onOpenChange={(open) => {
          if (!open && undoTarget && !pendingIds.has(undoTarget.id)) setUndoTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoTarget?.fullName} will return to “Not checked in”.
              {undoTarget?.checkedInAt ? ` The arrival at ${arrivalTime(undoTarget.checkedInAt)} will remain in the audit history, along with your staff identity and the correction time.` : ""}
              {" "}This will not change any other visit records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {undoTarget && rowErrors[undoTarget.id] ? (
            <p role="alert" className="text-sm text-destructive">{rowErrors[undoTarget.id]}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!undoTarget && pendingIds.has(undoTarget.id)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!undoTarget || authorizationExpired || pendingIds.has(undoTarget.id)}
              onClick={(event) => {
                event.preventDefault();
                if (undoTarget) void saveAttendance(undoTarget, true);
              }}
            >
              {undoTarget && pendingIds.has(undoTarget.id) ? "Undoing…" : "Confirm undo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {expanded ? (
        <div className="sticky -top-4 z-40 flex min-h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-2 py-2 backdrop-blur-md md:-top-6">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary sm:text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">GuestFlow · Staff desk</span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={toggle}
            aria-label="Exit full screen"
            className="min-h-11 shrink-0 gap-2 px-4"
          >
            <Minimize2 className="h-4 w-4" aria-hidden />
            <span>Exit full screen</span>
          </Button>
        </div>
      ) : null}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 opacity-70 sm:block" aria-hidden>
          <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full border-[36px] border-primary/5" />
          <div className="absolute right-12 top-8 h-28 w-28 rounded-full border border-primary/10" />
          <div className="absolute right-28 top-20 h-2 w-2 rounded-full bg-amber-500/60" />
        </div>
        <div className={`relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between ${expanded ? "lg:gap-10" : ""}`}>
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              GuestFlow · Staff desk
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              RSVP check-in
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {rosterQuery.data?.eventName ?? "AUSA 2026"} <span className="px-1.5 text-border">/</span>
              Find a guest, confirm their arrival.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center gap-3 rounded-xl border border-border/80 bg-background/75 px-4 py-3 ${expanded ? "min-h-[76px]" : ""}`}>
              <div className={`grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary ${expanded ? "sm:h-12 sm:w-12" : ""}`}>
                <UsersRound className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-24">
                <div className={`font-mono text-xl font-semibold leading-none tabular-nums ${expanded ? "sm:text-2xl" : ""}`}>
                  {checkedInCount}<span className="px-1 text-muted-foreground">/</span>{attendees.length || "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">arrived so far</div>
              </div>
            </div>
            {!expanded ? (
              <Button
                type="button"
                variant="outline"
                onClick={toggle}
                aria-label="Full screen"
                className="min-h-11 gap-2"
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
                <span>Full screen</span>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label htmlFor="rsvp-export-scope" className="mb-2 block text-sm font-semibold">Download attendance</label>
            <select
              id="rsvp-export-scope"
              value={exportScope}
              onChange={(event) => setExportScope(event.target.value as "all" | "arrivals")}
              disabled={exporting || authorizationExpired}
              className={`${expanded ? "h-12" : "h-10"} rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60`}
            >
              <option value="all">All attendees</option>
              <option value="arrivals">Arrivals only</option>
            </select>
          </div>
          <Button className={expanded ? "min-h-12" : ""} onClick={downloadAttendance} disabled={exporting || authorizationExpired || initialLoading || initialError} variant="outline">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {exporting ? "Preparing CSV…" : "Download CSV"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Exports saved attendance regardless of name search. First arrivals use UTC. Source plus-one counts are metadata, not checked-in guest counts. Keep the downloaded roster private.
        </p>
        {exportError ? <p role="alert" className="mt-2 text-sm text-destructive">{exportError}</p> : null}
      </div>

      {authorizationExpired ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-foreground">Staff session expired</p>
            <p className="mt-1 text-muted-foreground">Check-in is paused. Sign in again to continue; no further check-in actions will be sent.</p>
          </div>
        </div>
      ) : null}

      {rosterQuery.isError && rosterQuery.data && !queryUnauthorized ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Roster refresh didn’t complete</p>
              <p className="mt-1 text-sm text-muted-foreground">Showing the last loaded roster. Check-ins remain available; try refreshing the roster again.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => rosterQuery.refetch()} disabled={rosterQuery.isFetching}>
            {rosterQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Retry refresh
          </Button>
        </div>
      ) : null}

      {notice ? (
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className={`relative z-10 w-full ${expanded ? "sm:flex-1" : "max-w-2xl"}`}>
          <label htmlFor="rsvp-search" className="mb-2 block text-sm font-semibold">
            Find an attendee
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              id="rsvp-search"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={dropdownOpen}
              aria-controls="rsvp-search-options"
              aria-activedescendant={dropdownOpen && matchingAttendees[activeOption] ? `rsvp-option-${matchingAttendees[activeOption].id}` : undefined}
              autoComplete="off"
              value={search}
              placeholder="Search first or last name"
              disabled={initialLoading || initialError || authorizationExpired}
              onFocus={() => {
                window.clearTimeout(blurTimer.current);
                setFocused(true);
              }}
              onBlur={() => {
                blurTimer.current = window.setTimeout(() => setFocused(false), 120);
              }}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedId(null);
                setActiveOption(0);
                setFocused(true);
              }}
              onKeyDown={handleSearchKeyDown}
              className={`${expanded ? "h-14 text-base" : "h-12 text-sm"} w-full rounded-lg border border-input bg-background pl-10 pr-11 outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60`}
            />
            {search ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search and show all attendees"
                className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            )}
            {dropdownOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                  {matchingAttendees.length
                    ? `${matchingAttendees.length} ${matchingAttendees.length === 1 ? "match" : "matches"} — use ↑ ↓ to browse`
                    : "No attendees match that name"}
                </div>
                {matchingAttendees.length ? (
                  <ul id="rsvp-search-options" role="listbox" aria-label="Matching attendees" className="max-h-72 overflow-y-auto p-1.5">
                    {matchingAttendees.map((attendee, index) => (
                      <li key={attendee.id} role="presentation">
                        <button
                          id={`rsvp-option-${attendee.id}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeOption}
                          onMouseEnter={() => setActiveOption(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseAttendee(attendee)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${index === activeOption ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                        >
                          <span className="font-medium">{attendee.fullName}</span>
                          {attendee.checkedInAt ? <span className="text-xs text-emerald-700 dark:text-emerald-300">Checked in</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div id="rsvp-search-options" role="listbox" aria-label="No matching attendees" className="px-4 py-5 text-sm text-muted-foreground">
                    Try another first or last name.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {rosterQuery.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
          <span>{rosterQuery.isFetching ? "Updating roster…" : "Roster syncs every 5 seconds"}</span>
        </div>
      </div>

      {initialLoading ? (
        <div aria-label="Loading RSVP roster" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card p-4">
              <div className="h-4 w-2/5 rounded bg-muted" />
              <div className="mt-4 h-3 w-1/4 rounded bg-muted" />
              <div className="mt-3 h-8 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : initialError ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Roster unavailable</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {errorMessage(rosterQuery.error)} The attendee list has not loaded, so check-in is unavailable.
          </p>
          <Button className="mt-5" onClick={() => rosterQuery.refetch()} disabled={rosterQuery.isFetching || queryUnauthorized}>
            {rosterQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Try again
          </Button>
        </div>
      ) : visibleAttendees.length ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {selectedId ? "Selected attendee" : normalizedSearch ? "Search results" : "Attendee roster"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedId ? "Clear the search to return to the full roster." : `${visibleAttendees.length} of ${attendees.length} attendees`}
              </p>
            </div>
            {!normalizedSearch ? <span className="hidden rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground sm:inline">A–Z · {attendees.length} names</span> : null}
          </div>
          <div className={`grid gap-3 sm:grid-cols-2 ${expanded ? "xl:grid-cols-3 2xl:grid-cols-4 2xl:gap-4" : "xl:grid-cols-3"}`}>
            {visibleAttendees.map((attendee) => {
              const isSaving = pendingIds.has(attendee.id);
              return (
                <article
                  key={attendee.id}
                  className={`rounded-xl border bg-card p-4 shadow-sm transition-colors ${expanded ? "sm:p-5" : ""} ${attendee.checkedInAt ? "border-emerald-700/20 bg-emerald-700/[0.025]" : "border-border"}`}
                  data-testid={`attendee-${attendee.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold ${attendee.checkedInAt ? "bg-emerald-700/10 text-emerald-800 dark:text-emerald-300" : "bg-primary/8 text-primary"}`}>
                        {initials(attendee)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold leading-tight">{attendee.fullName}</h3>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{attendee.sourceCategory || "RSVP"}</p>
                      </div>
                    </div>
                    {attendee.checkedInAt ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-700/10 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                        <Check className="h-3 w-3" /> Checked In
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/70 pt-3">
                    <div className="min-h-8">
                      {attendee.checkedInAt ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          Arrived {arrivalTime(attendee.checkedInAt)}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {attendee.plusOneCount > 0 ? `+${attendee.plusOneCount} guest${attendee.plusOneCount === 1 ? "" : "s"} expected` : "Individual RSVP"}
                        </div>
                      )}
                      {rowErrors[attendee.id] ? (
                        <p role="alert" className="mt-1 max-w-48 text-xs text-destructive">{rowErrors[attendee.id]}</p>
                      ) : null}
                    </div>
                    {attendee.checkedInAt ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSaving || authorizationExpired}
                        className={expanded ? "min-h-11 px-4" : ""}
                        aria-label={`Undo check-in for ${attendee.fullName}`}
                        data-testid={`button-undo-check-in-${attendee.id}`}
                        onClick={() => {
                          setRowErrors((current) => ({ ...current, [attendee.id]: "" }));
                          setUndoTarget(attendee);
                        }}
                      >
                        Undo check-in
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => saveAttendance(attendee)}
                        disabled={isSaving || authorizationExpired}
                        aria-label={`Check in ${attendee.fullName}`}
                        data-testid={`button-check-in-${attendee.id}`}
                        className={`shrink-0 ${expanded ? "min-h-11 px-4" : ""}`}
                      >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        {isSaving ? "Saving…" : "Check In"}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Search className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-semibold">No attendees found</h2>
          <p className="mt-1 text-sm text-muted-foreground">No names match “{search}”. Clear the search to see everyone.</p>
          <Button variant="outline" className="mt-4" onClick={clearSearch}>Show all attendees</Button>
        </div>
      )}
    </section>
  );
}

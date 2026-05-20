import { useState, useMemo, useCallback, useRef, Fragment } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Upload, Users, UserCheck, Clock, ShieldCheck, Building2,
  ChevronDown, ChevronRight, Search, X, BarChart2, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ── Types ────────────────────────────────────────────────────────────────────

interface EnvoyRow {
  id: string;
  location_name: string;
  signed_in_time_local: string;
  signed_out_time_local: string;
  are_you_us_citizen_or_resident: string;
  host: string;
  "organization/company": string;
  purpose_of_visit: string;
  your_email_address: string;
  your_full_name: string;
}

interface VisitorGroup {
  primary: EnvoyRow;
  companions: EnvoyRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isCompanion(name: string): boolean {
  return /\+\s*\d+\s*$/.test(name.trim());
}

function isCitizen(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === "yes" || v === "citizen" || v === "usa" || v === "y";
}

function parseDuration(inStr: string, outStr: string): string {
  if (!inStr || !outStr) return "—";
  const inT = new Date(inStr).getTime();
  const outT = new Date(outStr).getTime();
  if (isNaN(inT) || isNaN(outT) || outT <= inT) return "—";
  const mins = Math.round((outT - inT) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function weekLabel(dateStr: string): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function monthLabel(dateStr: string): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function groupVisitors(rows: EnvoyRow[]): VisitorGroup[] {
  const primaryRows = rows.filter(r => !isCompanion(r.your_full_name));
  const companionRows = rows.filter(r => isCompanion(r.your_full_name));

  return primaryRows.map(primary => {
    const companions = companionRows.filter(
      c =>
        c.host === primary.host &&
        c.signed_in_time_local === primary.signed_in_time_local
    );
    return { primary, companions };
  });
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({ onData }: { onData: (rows: EnvoyRow[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parse = useCallback((file: File) => {
    Papa.parse<EnvoyRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => onData(results.data),
    });
  }, [onData]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parse(file);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parse(file);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
      }`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      data-testid="upload-zone"
    >
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFile} data-testid="input-csv-file" />
      <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-base font-medium mb-1">Drop your Envoy CSV here</p>
      <p className="text-sm text-muted-foreground">or click to browse — no data is sent to the server</p>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color = "text-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function EnvoyAnalytics() {
  const [rows, setRows] = useState<EnvoyRow[]>([]);
  const [timeMode, setTimeMode] = useState<"week" | "month">("week");
  const [hostFilter, setHostFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const hasData = rows.length > 0;

  const groups = useMemo(() => groupVisitors(rows), [rows]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSignIns = rows.length;
  const primaryCount = groups.length;
  const totalPeople = groups.reduce((acc, g) => acc + 1 + g.companions.length, 0);
  const signedOutCount = rows.filter(r => r.signed_out_time_local?.trim()).length;
  const stillInsideCount = totalSignIns - signedOutCount;
  const citizenCount = rows.filter(r => isCitizen(r.are_you_us_citizen_or_resident)).length;
  const citizenPct = totalSignIns > 0 ? Math.round((citizenCount / totalSignIns) * 100) : 0;

  // ── By-host data ──────────────────────────────────────────────────────────
  const hostData = useMemo(() => {
    const map = new Map<string, number>();
    groups.forEach(g => {
      const h = g.primary.host?.trim() || "Unknown";
      map.set(h, (map.get(h) ?? 0) + 1 + g.companions.length);
    });
    return Array.from(map.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count);
  }, [groups]);

  // ── Timeline data ─────────────────────────────────────────────────────────
  const timelineData = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      if (!r.signed_in_time_local) return;
      const label = timeMode === "week" ? weekLabel(r.signed_in_time_local) : monthLabel(r.signed_in_time_local);
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([period, count]) => ({ period, count }));
  }, [rows, timeMode]);

  // ── Filtered groups ───────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    let g = groups;
    if (hostFilter) g = g.filter(gr => (gr.primary.host?.trim() || "Unknown") === hostFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      g = g.filter(gr =>
        gr.primary.your_full_name?.toLowerCase().includes(q) ||
        gr.primary.your_email_address?.toLowerCase().includes(q) ||
        gr.primary.host?.toLowerCase().includes(q) ||
        gr.primary["organization/company"]?.toLowerCase().includes(q)
      );
    }
    return g;
  }, [groups, hostFilter, search]);

  const totalPages = Math.ceil(filteredGroups.length / PAGE_SIZE);
  const pagedGroups = filteredGroups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportToExcel = useCallback(() => {
    const headers = ["Name", "Email", "Host", "Company", "Sign-in", "Sign-out", "Duration", "US Citizen", "Companion Count", "Type"];
    const sheetRows: (string | number)[][] = [headers];

    groups.forEach(({ primary, companions }) => {
      const signIn = primary.signed_in_time_local
        ? new Date(primary.signed_in_time_local).toLocaleString("en-US")
        : "";
      const signOut = primary.signed_out_time_local?.trim()
        ? new Date(primary.signed_out_time_local).toLocaleString("en-US")
        : "";
      sheetRows.push([
        primary.your_full_name || "",
        primary.your_email_address || "",
        primary.host || "",
        primary["organization/company"] || "",
        signIn,
        signOut,
        parseDuration(primary.signed_in_time_local, primary.signed_out_time_local),
        isCitizen(primary.are_you_us_citizen_or_resident) ? "Yes" : "No",
        companions.length,
        "Primary",
      ]);
      companions.forEach(comp => {
        const cIn = comp.signed_in_time_local
          ? new Date(comp.signed_in_time_local).toLocaleString("en-US")
          : "";
        const cOut = comp.signed_out_time_local?.trim()
          ? new Date(comp.signed_out_time_local).toLocaleString("en-US")
          : "";
        sheetRows.push([
          comp.your_full_name || "",
          "",
          comp.host || "",
          "",
          cIn,
          cOut,
          parseDuration(comp.signed_in_time_local, comp.signed_out_time_local),
          isCitizen(comp.are_you_us_citizen_or_resident) ? "Yes" : "No",
          0,
          "Companion",
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws["!cols"] = [
      { wch: 28 }, { wch: 30 }, { wch: 22 }, { wch: 22 },
      { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visitors");
    const location = rows[0]?.location_name?.replace(/[^a-z0-9]/gi, "_") || "Envoy";
    XLSX.writeFile(wb, `${location}_visitor_log.xlsx`);
  }, [groups, rows]);

  const handleData = useCallback((data: EnvoyRow[]) => {
    setRows(data);
    setSearch("");
    setHostFilter(null);
    setExpanded(new Set());
    setPage(0);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl" data-testid="page-envoy-analytics">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Envoy Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Upload an Envoy visitor export CSV to see facility traffic analytics
          </p>
        </div>
        {hasData && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="button-export-xlsx">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export .xlsx
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRows([])} data-testid="button-clear-data">
              <X className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Upload */}
      {!hasData && <UploadZone onData={handleData} />}

      {/* Re-upload strip when data is loaded */}
      {hasData && (
        <div
          className="flex items-center gap-3 text-sm border rounded-lg px-4 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setRows([])}
          data-testid="button-reupload"
        >
          <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{rows[0]?.location_name || "Envoy data"}</span>
            {" — "}
            {totalSignIns} rows loaded. Click to upload a different file.
          </span>
        </div>
      )}

      {hasData && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={BarChart2} label="Total sign-ins" value={totalSignIns} sub="all rows" />
            <StatCard icon={Users} label="Primary visitors" value={primaryCount} sub="excluding companions" />
            <StatCard icon={Building2} label="Total people" value={totalPeople} sub="incl. companions" />
            <StatCard icon={UserCheck} label="Signed out" value={signedOutCount} sub={`${stillInsideCount} still inside`} />
            <StatCard icon={ShieldCheck} label="US citizens" value={`${citizenPct}%`} sub={`${citizenCount} of ${totalSignIns}`} />
          </div>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Visits over time</CardTitle>
                  <CardDescription className="mt-0.5">Number of sign-ins per {timeMode}</CardDescription>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant={timeMode === "week" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setTimeMode("week")} data-testid="button-timeline-week">
                    Week
                  </Button>
                  <Button size="sm" variant={timeMode === "month" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setTimeMode("month")} data-testid="button-timeline-month">
                    Month
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timelineData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(v: number) => [`${v} sign-ins`, ""]}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {timelineData.map((_, i) => (
                      <Cell key={i} fill="hsl(var(--primary))" fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Visitors by host */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Visitors by host</CardTitle>
                  <CardDescription className="mt-0.5">Click a bar to filter the table below</CardDescription>
                </div>
                {hostFilter && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setHostFilter(null)} data-testid="button-clear-host-filter">
                    <X className="h-3 w-3 mr-1" />
                    Clear filter
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {hostData.map(({ host, count }) => {
                  const pct = Math.round((count / (hostData[0]?.count || 1)) * 100);
                  const active = hostFilter === host;
                  return (
                    <button
                      key={host}
                      className={`w-full text-left group transition-opacity ${hostFilter && !active ? "opacity-40" : ""}`}
                      onClick={() => setHostFilter(active ? null : host)}
                      data-testid={`bar-host-${host.replace(/\s+/g, "-")}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{host}</span>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${active ? "bg-primary" : "bg-primary/60 group-hover:bg-primary/80"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Visitor table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base">Visitor log</CardTitle>
                  <CardDescription className="mt-0.5">
                    {filteredGroups.length} of {groups.length} visitors
                    {hostFilter ? ` hosted by ${hostFilter}` : ""}
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-8 text-sm"
                    placeholder="Name, email, host, company…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    data-testid="input-visitor-table-search"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredGroups.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No visitors match your search.</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6" />
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Sign-in</TableHead>
                        <TableHead>Sign-out</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="text-center">US</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedGroups.map(({ primary, companions }) => {
                        const isOpen = expanded.has(primary.id);
                        const hasCompanions = companions.length > 0;
                        return (
                          <Fragment key={primary.id}>
                            <TableRow
                              className={hasCompanions ? "cursor-pointer hover:bg-muted/30" : ""}
                              onClick={() => hasCompanions && toggleExpand(primary.id)}
                              data-testid={`row-visitor-${primary.id}`}
                            >
                              <TableCell className="pr-0">
                                {hasCompanions ? (
                                  isOpen
                                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : null}
                              </TableCell>
                              <TableCell className="font-medium">
                                <span>{primary.your_full_name}</span>
                                {hasCompanions && (
                                  <Badge variant="secondary" className="ml-2 text-xs">+{companions.length}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {primary.your_email_address || "—"}
                              </TableCell>
                              <TableCell className="text-sm">{primary.host || "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {primary["organization/company"] || "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {primary.signed_in_time_local
                                  ? new Date(primary.signed_in_time_local).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {primary.signed_out_time_local?.trim()
                                  ? new Date(primary.signed_out_time_local).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                                  : <span className="italic text-amber-500 dark:text-amber-400 text-xs">Inside</span>}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {parseDuration(primary.signed_in_time_local, primary.signed_out_time_local)}
                              </TableCell>
                              <TableCell className="text-center">
                                {isCitizen(primary.are_you_us_citizen_or_resident) ? (
                                  <span className="text-green-600 dark:text-green-400 text-xs font-medium">✓</span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                            </TableRow>

                            {isOpen && companions.map(comp => (
                              <TableRow key={comp.id} className="bg-muted/20" data-testid={`row-companion-${comp.id}`}>
                                <TableCell />
                                <TableCell className="pl-6 text-sm text-muted-foreground italic">
                                  {comp.your_full_name}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                  {comp.signed_out_time_local?.trim()
                                    ? new Date(comp.signed_out_time_local).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                                    : <span className="italic text-amber-500 dark:text-amber-400 text-xs">Inside</span>}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {parseDuration(comp.signed_in_time_local, comp.signed_out_time_local)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {isCitizen(comp.are_you_us_citizen_or_resident) ? (
                                    <span className="text-green-600 dark:text-green-400 text-xs font-medium">✓</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                      <span>
                        Page {page + 1} of {totalPages} &mdash; {filteredGroups.length} visitors
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          disabled={page === 0}
                          onClick={() => setPage(p => p - 1)}
                          data-testid="button-page-prev"
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          disabled={page >= totalPages - 1}
                          onClick={() => setPage(p => p + 1)}
                          data-testid="button-page-next"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

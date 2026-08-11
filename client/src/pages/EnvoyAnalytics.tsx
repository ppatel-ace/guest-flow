import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { CalendarDays, Users, UserCheck, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Location chart palette ────────────────────────────────────────────────────

const LOCATION_SERIES = [
  { key: "newJersey" as const, name: "New Jersey", color: "#2563eb" }, // blue
  { key: "michigan" as const, name: "Michigan", color: "#dc2626" }, // red
  { key: "maryland" as const, name: "Maryland", color: "#eab308" }, // yellow
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocationTotals {
  newJersey: number;
  maryland: number;
  michigan: number;
  total: number;
}

interface VisitorAnalyticsPeriod {
  period: string;
  newJersey: number;
  maryland: number;
  michigan: number;
  total: number;
}

interface VisitorAnalyticsHourly {
  hour: number;
  label: string;
  newJersey: number;
  maryland: number;
  michigan: number;
  count: number;
}

interface VisitorAnalyticsResult {
  periods: VisitorAnalyticsPeriod[];
  hourly: VisitorAnalyticsHourly[];
  avgVisitDurationMinutes: number | null;
  byLocation?: LocationTotals;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function autoBucket(start: Date, end: Date): "day" | "week" | "month" {
  const days = (end.getTime() - start.getTime()) / 86400000;
  if (days <= 31) return "day";
  if (days <= 93) return "week";
  return "month";
}

function generateAllPeriods(start: Date, end: Date, bucket: "day" | "week" | "month"): string[] {
  const periods: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  if (bucket === "week") {
    const day = cur.getDay();
    cur.setDate(cur.getDate() - ((day + 6) % 7)); // back to Monday
  } else if (bucket === "month") {
    cur.setDate(1);
  }
  const endMs = end.getTime();
  while (cur.getTime() <= endMs) {
    periods.push(toDateStr(cur));
    if (bucket === "day") cur.setDate(cur.getDate() + 1);
    else if (bucket === "week") cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }
  return periods;
}

function formatPeriodLabel(period: string, bucket: "day" | "week" | "month"): string {
  const d = new Date(period + "T12:00:00");
  if (bucket === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Preset = "7d" | "30d" | "3m" | "1y" | "custom";

function presetDates(p: Preset): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (p === "7d") start.setDate(start.getDate() - 6);
  else if (p === "30d") start.setDate(start.getDate() - 29);
  else if (p === "3m") start.setMonth(start.getMonth() - 3);
  else if (p === "1y") start.setFullYear(start.getFullYear() - 1);
  return { start, end };
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2 bg-muted shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
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

export default function Analytics() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { start, end } = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) {
      const s = new Date(customStart + "T00:00:00");
      const e = new Date(customEnd + "T23:59:59");
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) return { start: s, end: e };
    }
    if (preset === "custom") return presetDates("30d");
    return presetDates(preset);
  }, [preset, customStart, customEnd]);

  const bucket = useMemo(() => autoBucket(start, end), [start, end]);

  const queryUrl = `/api/analytics/visitors?start=${toDateStr(start)}&end=${toDateStr(end)}&bucket=${bucket}`;

  const { data, isLoading } = useQuery<VisitorAnalyticsResult>({
    queryKey: [queryUrl],
  });

  const rawPeriods = data?.periods ?? [];
  const hourlyData = data?.hourly ?? [];

  // Merge server data with all expected periods (fill zeros for empty buckets)
  const chartData = useMemo(() => {
    const serverMap = new Map(rawPeriods.map(p => [p.period, p]));
    return generateAllPeriods(start, end, bucket).map(period => {
      const row = serverMap.get(period);
      return {
        label: formatPeriodLabel(period, bucket),
        newJersey: row?.newJersey ?? 0,
        maryland: row?.maryland ?? 0,
        michigan: row?.michigan ?? 0,
        total: row?.total ?? 0,
      };
    });
  }, [rawPeriods, start, end, bucket]);

  const byLocation = data?.byLocation ?? chartData.reduce(
    (acc, d) => {
      acc.newJersey += d.newJersey;
      acc.maryland += d.maryland;
      acc.michigan += d.michigan;
      acc.total += d.total;
      return acc;
    },
    { newJersey: 0, maryland: 0, michigan: 0, total: 0 }
  );

  const totalVisitors = byLocation.total;
  const periodCount = chartData.length || 1;
  const avgPerPeriod = (totalVisitors / periodCount).toFixed(1);

  const peakMax = Math.max(...hourlyData.map(h => h.count), 1);
  const peakHour = hourlyData.find(h => h.count === Math.max(...hourlyData.map(x => x.count)));

  const presets: { key: Preset; label: string }[] = [
    { key: "7d", label: "7D" },
    { key: "30d", label: "30D" },
    { key: "3m", label: "3M" },
    { key: "1y", label: "1Y" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-6 max-w-5xl" data-testid="page-analytics">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Visitor check-in trends by office location</p>
      </div>

      {/* Date range controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1.5">
          {presets.map(p => (
            <Button
              key={p.key}
              size="sm"
              variant={preset === p.key ? "secondary" : "outline"}
              className="h-8 px-3 text-xs"
              onClick={() => setPreset(p.key)}
              data-testid={`button-preset-${p.key}`}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                className="h-8 text-sm w-36"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                data-testid="input-custom-start"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                className="h-8 text-sm w-36"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                data-testid="input-custom-end"
              />
            </div>
          </div>
        )}

        <span className="text-xs text-muted-foreground self-center">
          Grouped by {bucket}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Users} label="Total visitors" value={totalVisitors} sub="check-ins submitted" />
        <StatCard
          icon={CalendarDays}
          label="New Jersey"
          value={byLocation.newJersey}
          sub="visitors"
          color="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={UserCheck}
          label="Michigan"
          value={byLocation.michigan}
          sub="visitors"
          color="text-red-600 dark:text-red-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Maryland"
          value={byLocation.maryland}
          sub="visitors"
          color="text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          icon={Clock}
          label="Avg visit duration"
          value={data?.avgVisitDurationMinutes != null
            ? (() => {
                const h = Math.floor(data.avgVisitDurationMinutes / 60);
                const m = data.avgVisitDurationMinutes % 60;
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
              })()
            : "—"
          }
          sub={data?.avgVisitDurationMinutes != null ? "from sign-outs" : "no sign-out data yet"}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        Avg {avgPerPeriod} visitors / {bucket}
      </div>

      {/* Visitors over time chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Visitors over time</CardTitle>
          <CardDescription className="mt-0.5">
            {start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" – "}
            {end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · by office location"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={chartData.length > 20 ? Math.floor(chartData.length / 12) : 0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} cursor={{ fill: "hsl(var(--muted))" }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {LOCATION_SERIES.map((loc) => (
                  <Bar
                    key={loc.key}
                    dataKey={loc.key}
                    name={loc.name}
                    stackId="location"
                    fill={loc.color}
                    fillOpacity={0.9}
                    radius={loc.key === "maryland" ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Peak visit hours */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Peak visit hours</CardTitle>
              <CardDescription className="mt-0.5">
                Sign-ins by hour of day (8am–6pm), stacked by location
              </CardDescription>
            </div>
            {peakHour && peakHour.count > 0 && (
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Busiest hour</p>
                <p className="text-lg font-bold">{peakHour.label}</p>
                <p className="text-xs text-muted-foreground">{peakHour.count} sign-in{peakHour.count !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-3" data-testid="chart-peak-hours">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {LOCATION_SERIES.map((loc) => (
                  <span key={loc.key} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: loc.color }} />
                    {loc.name}
                  </span>
                ))}
              </div>
              <div className="space-y-1.5">
                {hourlyData.map((row) => {
                  const { label, count, hour, newJersey, maryland, michigan } = row;
                  const isPeak = peakHour?.hour === hour && count > 0;
                  const segments = [
                    { key: "nj", count: newJersey, color: LOCATION_SERIES[0].color },
                    { key: "mi", count: michigan, color: LOCATION_SERIES[1].color },
                    { key: "md", count: maryland, color: LOCATION_SERIES[2].color },
                  ];
                  const totalKnown = newJersey + maryland + michigan;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-9 shrink-0 text-right">{label}</span>
                      <div className="flex-1 h-5 rounded bg-muted overflow-hidden flex">
                        {totalKnown > 0
                          ? segments.map((seg) => {
                              if (seg.count <= 0) return null;
                              const pct = (seg.count / peakMax) * 100;
                              return (
                                <div
                                  key={seg.key}
                                  className="h-5 transition-all"
                                  style={{
                                    width: `${Math.max(pct, 0.5)}%`,
                                    backgroundColor: seg.color,
                                    opacity: isPeak ? 1 : 0.85,
                                  }}
                                  title={`${seg.count}`}
                                />
                              );
                            })
                          : null}
                      </div>
                      <span className="text-xs w-6 shrink-0 text-right">
                        {count > 0 ? (
                          <span className={isPeak ? "font-semibold" : "text-muted-foreground"}>{count}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              {hourlyData.every(h => h.count === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No visitor data for this period.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

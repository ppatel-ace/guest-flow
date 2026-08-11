import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/StatsCard";
import { Users, CheckCircle, Mail, Clock, ShieldAlert, ShieldCheck, UserCheck, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Customer as CustomerType, RecentCheckIn } from "@shared/schema";

interface MonthlyCheckIn {
  month: string;
  count: number;
  walkIns: number;
  newJersey?: number;
  maryland?: number;
  michigan?: number;
}

const LOCATION_LINES = [
  { key: "newJersey" as const, name: "New Jersey", color: "#2563eb" },
  { key: "michigan" as const, name: "Michigan", color: "#dc2626" },
  { key: "maryland" as const, name: "Maryland", color: "#eab308" },
];

interface BotStats {
  date: string;
  total: number;
  counts: {
    honeypot: number;
    ua: number;
    timing: number;
    turnstile: number;
    rateLimit: number;
  };
  recentLog: Array<{
    timestamp: number;
    reason: string;
    maskedIp: string;
  }>;
}

const REASON_LABELS: Record<string, string> = {
  honeypot:  "Honeypot",
  ua:        "Bad UA",
  timing:    "Timing",
  turnstile: "CAPTCHA",
  rateLimit: "Rate Limit",
};

const REASON_COLORS: Record<string, string> = {
  honeypot:  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ua:        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  timing:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  turnstile: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  rateLimit: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function BotProtectionCard() {
  const { data: stats, isLoading } = useQuery<BotStats>({
    queryKey: ["/api/admin/bot-stats"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const rows = [
    { key: "honeypot",  label: "Honeypot trap" },
    { key: "ua",        label: "Headless browser" },
    { key: "timing",    label: "Timing token" },
    { key: "turnstile", label: "CAPTCHA failed" },
    { key: "rateLimit", label: "Rate limit" },
  ];

  return (
    <Card data-testid="card-bot-protection">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {!isLoading && (stats?.total ?? 0) === 0
                ? <ShieldCheck className="h-5 w-5 text-green-500" />
                : <ShieldAlert className="h-5 w-5 text-amber-500" />}
              Bot Protection
            </CardTitle>
            <CardDescription>
              Blocked attempts today ({stats?.date ?? "—"})
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" data-testid="text-bot-total">
              {isLoading ? "—" : (stats?.total ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">total blocked</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {rows.map(({ key, label }) => (
            <div
              key={key}
              className="flex flex-col items-center justify-center rounded-lg border p-2 text-center gap-1"
              data-testid={`stat-bot-${key}`}
            >
              <span className="text-xl font-semibold">
                {isLoading ? "—" : (stats?.counts[key as keyof typeof stats.counts] ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {!isLoading && (stats?.recentLog?.length ?? 0) > 0 && (
          <div className="space-y-1" data-testid="list-bot-recent-log">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent blocks</p>
            <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
              {stats!.recentLog.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-1.5 text-xs gap-2"
                  data-testid={`row-bot-log-${i}`}
                >
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${REASON_COLORS[entry.reason] ?? ""}`}
                  >
                    {REASON_LABELS[entry.reason] ?? entry.reason}
                  </span>
                  <span className="font-mono text-muted-foreground truncate">{entry.maskedIp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && (stats?.total ?? 0) === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2" data-testid="text-bot-clean">
            No blocked attempts so far today.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: customers = [] } = useQuery<CustomerType[]>({
    queryKey: ["/api/customers"],
  });

  const { data: monthlyStats = [] } = useQuery<MonthlyCheckIn[]>({
    queryKey: ["/api/stats/monthly-checkins"],
  });

  const { data: recentCheckIns = [], isLoading: recentLoading } = useQuery<RecentCheckIn[]>({
    queryKey: ["/api/checkins/recent"],
  });

  const totalCustomers = customers.length;
  const checkedInCount = customers.filter(c => c.status === "checked-in").length;
  const confirmedCount = customers.filter(c => c.status === "confirmed").length;
  const pendingCount = customers.filter(c => c.status === "pending").length;

  const chartData = monthlyStats.map(stat => {
    const [year, month] = stat.month.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return {
      month: monthName,
      newJersey: stat.newJersey ?? 0,
      maryland: stat.maryland ?? 0,
      michigan: stat.michigan ?? 0,
    };
  });

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
    kiosk: { label: "Kiosk", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    form: { label: "Form", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    invite: { label: "Invite", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    envoy: { label: "Envoy", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  };

  function formatTimeAgo(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="space-y-8" data-testid="page-dashboard">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Ace Electronics customer check-in overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Invites" value={totalCustomers.toString()} icon={Users} description="All registered invites" />
        <StatsCard title="Checked In" value={checkedInCount.toString()} icon={CheckCircle} description="Total checked in" />
        <StatsCard title="Confirmed" value={confirmedCount.toString()} icon={Mail} description="Invites confirmed" />
        <StatsCard title="Pending" value={pendingCount.toString()} icon={Clock} description="Awaiting confirmation" />
      </div>

      <BotProtectionCard />

      <Card data-testid="card-monthly-checkins">
        <CardHeader>
          <CardTitle>Monthly Visitors by Location</CardTitle>
          <CardDescription>Walk-in / kiosk visitors over the last 12 months by office</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" tick={{ fill: "currentColor" }} />
                <YAxis className="text-xs" tick={{ fill: "currentColor" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {LOCATION_LINES.map((loc) => (
                  <Line
                    key={loc.key}
                    type="monotone"
                    dataKey={loc.key}
                    stroke={loc.color}
                    strokeWidth={2}
                    dot={{ fill: loc.color }}
                    name={loc.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-recent-activity">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            The 10 most recent people who checked in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading recent check-ins…</p>
          ) : recentCheckIns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-recent-empty">
              No check-ins yet.
            </p>
          ) : (
            <div className="divide-y" data-testid="list-recent-checkins">
              {recentCheckIns.map((item, i) => {
                const sourceMeta = SOURCE_LABELS[item.source] ?? { label: item.source, className: "bg-muted text-muted-foreground" };
                return (
                  <div key={`${item.checkedInAt}-${i}`} className="flex items-center justify-between gap-3 py-2.5" data-testid={`row-recent-${i}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback>{getInitials(item.fullName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" data-testid={`text-recent-name-${i}`}>
                          {item.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" data-testid={`text-recent-email-${i}`}>
                          {item.email || "—"}
                          {item.company ? ` · ${item.company}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {item.location && (
                          <p className="text-xs text-muted-foreground truncate max-w-32">
                            <FileText className="inline h-3 w-3 mr-1" />
                            {item.location}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground" data-testid={`text-recent-time-${i}`}>
                          {formatTimeAgo(item.checkedInAt)}
                        </p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sourceMeta.className}`}>
                        {sourceMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

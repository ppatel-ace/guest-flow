import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/StatsCard";
import { CustomerTable, Customer } from "@/components/CustomerTable";
import { Users, CheckCircle, Mail, Clock, Download, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Customer as CustomerType, Lead } from "@shared/schema";
import * as XLSX from "xlsx";

interface MonthlyCheckIn {
  month: string;
  count: number;
}

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

const EXPORT_HEADERS = ["Title", "First Name", "Last Name", "Email", "Phone", "Company", "Ace POC", "Event Name", "Submitted At"];

type LeadRow = Record<typeof EXPORT_HEADERS[number], string>;

function leadsToRows(leads: Lead[]): LeadRow[] {
  return leads.map(l => ({
    "Title": l.title ?? "",
    "First Name": l.firstName,
    "Last Name": l.lastName,
    "Email": l.email,
    "Phone": l.phoneNumber,
    "Company": l.company ?? "",
    "Ace POC": l.acePoc ?? "",
    "Event Name": l.eventName ?? "",
    "Submitted At": l.submittedAt ? new Date(l.submittedAt).toLocaleString() : "",
  }));
}

function exportLeadsCSV(leads: Lead[]) {
  const rows = leadsToRows(leads);
  const csv = [EXPORT_HEADERS, ...rows.map(r => EXPORT_HEADERS.map(h => `"${String(r[h]).replace(/"/g, '""')}"`))]
    .map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportLeadsExcel(leads: Lead[]) {
  const rows = leadsToRows(leads);
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, "leads_export.xlsx");
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
        {/* Breakdown grid */}
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

        {/* Recent log */}
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

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: monthlyStats = [] } = useQuery<MonthlyCheckIn[]>({
    queryKey: ["/api/stats/monthly-checkins"],
  });

  const handleSendInvite = (id: string) => {
    console.log("Send invite to customer:", id);
  };

  const handleCheckIn = (id: string) => {
    console.log("Check in customer:", id);
  };

  const totalCustomers = customers.length;
  const checkedInCount = customers.filter(c => c.status === "checked-in").length;
  const confirmedCount = customers.filter(c => c.status === "confirmed").length;
  const pendingCount = customers.filter(c => c.status === "pending").length;

  const chartData = monthlyStats.map(stat => {
    const [year, month] = stat.month.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return { month: monthName, checkIns: stat.count };
  });

  const recentCustomers: Customer[] = customers.slice(0, 5).map(c => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone ?? undefined,
    status: c.status,
    invitedAt: c.invitedAt ? formatTimeAgo(c.invitedAt) : "Not invited",
  }));

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
    <div className="space-y-6" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your customer check-in system</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={leads.length === 0} data-testid="button-export-dashboard">
              <Download className="h-4 w-4 mr-2" />
              Export Leads
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportLeadsCSV(leads)} data-testid="menu-export-csv">
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportLeadsExcel(leads)} data-testid="menu-export-excel">
              Export as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Customers" value={totalCustomers.toString()} icon={Users} description="All registered customers" />
        <StatsCard title="Checked In" value={checkedInCount.toString()} icon={CheckCircle} description="Total checked in" />
        <StatsCard title="Confirmed" value={confirmedCount.toString()} icon={Mail} description="Invites confirmed" />
        <StatsCard title="Pending" value={pendingCount.toString()} icon={Clock} description="Awaiting confirmation" />
      </div>

      <BotProtectionCard />

      <Card data-testid="card-monthly-checkins">
        <CardHeader>
          <CardTitle>Monthly Check-Ins</CardTitle>
          <CardDescription>Check-in activity over the last 12 months</CardDescription>
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
                <Line type="monotone" dataKey="checkIns" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-2))" }} name="Check-Ins" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <CustomerTable customers={recentCustomers} onSendInvite={handleSendInvite} onCheckIn={handleCheckIn} />
      </div>
    </div>
  );
}

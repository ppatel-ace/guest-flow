import { StatsCard } from "@/components/StatsCard";
import { CustomerTable, Customer } from "@/components/CustomerTable";
import { Users, CheckCircle, Mail, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Customer as CustomerType } from "@shared/schema";

interface MonthlyCheckIn {
  month: string;
  count: number;
}

export default function Dashboard() {
  const { data: customers = [] } = useQuery<CustomerType[]>({
    queryKey: ["/api/customers"],
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
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your customer check-in system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Customers" value={totalCustomers.toString()} icon={Users} description="All registered customers" />
        <StatsCard title="Checked In" value={checkedInCount.toString()} icon={CheckCircle} description="Total checked in" />
        <StatsCard title="Confirmed" value={confirmedCount.toString()} icon={Mail} description="Invites confirmed" />
        <StatsCard title="Pending" value={pendingCount.toString()} icon={Clock} description="Awaiting confirmation" />
      </div>

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

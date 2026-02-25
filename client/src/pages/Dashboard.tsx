import { useState } from "react";
import { StatsCard } from "@/components/StatsCard";
import { CustomerTable, Customer } from "@/components/CustomerTable";
import { Users, CheckCircle, Mail, Clock, ExternalLink, Pencil, QrCode, ClipboardList } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import type { Customer as CustomerType, PageSettings } from "@shared/schema";

interface MonthlyCheckIn {
  month: string;
  count: number;
}

interface EditPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: string;
  pageLabel: string;
  hasSuccessMessage: boolean;
  settings: PageSettings | undefined;
}

function EditPageDialog({ open, onOpenChange, pageKey, pageLabel, hasSuccessMessage, settings }: EditPageDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(settings?.title ?? "");
  const [description, setDescription] = useState(settings?.description ?? "");
  const [successMessage, setSuccessMessage] = useState(settings?.successMessage ?? "");

  // Sync form when dialog opens with fresh data
  const handleOpenChange = (val: boolean) => {
    if (val && settings) {
      setTitle(settings.title);
      setDescription(settings.description);
      setSuccessMessage(settings.successMessage ?? "");
    }
    onOpenChange(val);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/page-settings/${pageKey}`, {
        title,
        description,
        successMessage: hasSuccessMessage ? successMessage : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/page-settings/${pageKey}`] });
      toast({ title: "Page Updated", description: `${pageLabel} settings saved successfully.` });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save page settings.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {pageLabel}</DialogTitle>
          <DialogDescription>Customize the text displayed on this public page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${pageKey}-title`}>Title</Label>
            <Input
              id={`${pageKey}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              data-testid={`input-${pageKey}-title`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${pageKey}-description`}>Description</Label>
            <Textarea
              id={`${pageKey}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Page description or instruction text"
              rows={3}
              data-testid={`input-${pageKey}-description`}
            />
          </div>
          {hasSuccessMessage && (
            <div className="space-y-2">
              <Label htmlFor={`${pageKey}-success`}>Success Message</Label>
              <Input
                id={`${pageKey}-success`}
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                placeholder="Message shown after successful check-in"
                data-testid={`input-${pageKey}-success`}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !title.trim() || !description.trim()}
            data-testid={`button-save-${pageKey}`}
          >
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [editScanOpen, setEditScanOpen] = useState(false);
  const [editGuestOpen, setEditGuestOpen] = useState(false);

  const { data: customers = [] } = useQuery<CustomerType[]>({
    queryKey: ["/api/customers"],
  });

  const { data: monthlyStats = [] } = useQuery<MonthlyCheckIn[]>({
    queryKey: ["/api/stats/monthly-checkins"],
  });

  const { data: scanSettings } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/scan_page"],
  });

  const { data: guestSettings } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/guest_checkin_page"],
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

  const origin = window.location.origin;

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

      {/* Public Pages */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Public Pages</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* QR Code Display Page */}
          <Card data-testid="card-scan-page">
            <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <QrCode className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">QR Code Display</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Show this at your event for guests to scan</CardDescription>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditScanOpen(true)}
                data-testid="button-edit-scan-page"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground font-mono break-all">
                {origin}/scan
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Current title</p>
                <p className="text-sm font-medium">{scanSettings?.title ?? "Welcome!"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Current description</p>
                <p className="text-sm text-muted-foreground">{scanSettings?.description ?? "Please scan the QR code with your phone to check in"}</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(`${origin}/scan`, "_blank")}
                data-testid="button-view-scan-page"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Page
              </Button>
            </CardContent>
          </Card>

          {/* Guest Check-In Form Page */}
          <Card data-testid="card-guest-checkin-page">
            <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Guest Check-In Form</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Form guests fill in after scanning the QR code</CardDescription>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditGuestOpen(true)}
                data-testid="button-edit-guest-page"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground font-mono break-all">
                {origin}/guest-check-in
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Current title</p>
                <p className="text-sm font-medium">{guestSettings?.title ?? "Check-In"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Current description</p>
                <p className="text-sm text-muted-foreground">{guestSettings?.description ?? "Enter your phone number or email address to check in"}</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(`${origin}/guest-check-in`, "_blank")}
                data-testid="button-view-guest-page"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialogs */}
      <EditPageDialog
        open={editScanOpen}
        onOpenChange={setEditScanOpen}
        pageKey="scan_page"
        pageLabel="QR Code Display Page"
        hasSuccessMessage={false}
        settings={scanSettings}
      />
      <EditPageDialog
        open={editGuestOpen}
        onOpenChange={setEditGuestOpen}
        pageKey="guest_checkin_page"
        pageLabel="Guest Check-In Form"
        hasSuccessMessage={true}
        settings={guestSettings}
      />
    </div>
  );
}

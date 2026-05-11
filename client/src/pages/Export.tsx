import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileDown, FileSpreadsheet, CheckCircle2, Loader2, UserCheck,
  Pencil, Trash2, RotateCcw, X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Lead, Customer } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ACE_POC_OPTIONS = [
  "Jerry Parker", "Larry Pomasan", "Nish Patel",
  "Craig Frost", "Ashley Morris", "Sanjay Parimi",
];

const UNDO_MS = 5000;
const MAX_PENDING = 5;

interface PendingDeletion {
  key: string;        // customerId — used as unique key / undo handle
  leadId: string | null; // for optimistic filtering of filteredLeads
  label: string;
  deadline: number;
  timerId: ReturnType<typeof setTimeout>;
}

interface EnrichedCustomer extends Customer {
  acePoc: string | null;
  company: string | null;
  eventName: string | null;
  leadId: string | null;
}

function buildLeadsSheet(leads: Lead[]) {
  return leads.map(l => ({
    "Title": l.title ?? "",
    "First Name": l.firstName,
    "Last Name": l.lastName,
    "Email": l.email,
    "Phone": l.phoneNumber,
    "Company": l.company ?? "",
    "Ace POC": l.acePoc ?? "",
    "Event Name": l.eventName?.trim() ?? "",
    "Submitted At": new Date(l.submittedAt).toLocaleString(),
  }));
}

function buildCheckInsSheet(customers: Customer[], leads: Lead[]) {
  const leadByCustomerId = new Map(leads.filter(l => l.customerId).map(l => [l.customerId, l]));
  const leadByEmail = new Map(leads.map(l => [l.email, l]));
  return customers
    .filter(c => c.status === "checked-in")
    .map(c => {
      const lead = leadByCustomerId.get(c.id) ?? leadByEmail.get(c.email);
      return {
        "Name": c.name,
        "Email": c.email,
        "Phone": c.phone ?? "",
        "Company": lead?.company ?? "",
        "Ace POC": lead?.acePoc ?? "",
        "Event Name": lead?.eventName?.trim() ?? "",
        "Status": c.status,
        "Invited At": c.invitedAt ? new Date(c.invitedAt).toLocaleString() : "",
        "Checked In At": c.checkedInAt ? new Date(c.checkedInAt).toLocaleString() : "",
      };
    });
}

// ── Edit dialog ────────────────────────────────────────────────────────────────
interface EditDialogProps {
  lead: Lead | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditDialog({ lead, onClose, onSaved }: EditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", firstName: "", lastName: "", email: "",
    phoneNumber: "", company: "", acePoc: "", eventName: "",
  });

  useEffect(() => {
    if (lead) {
      setForm({
        title: lead.title ?? "",
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phoneNumber: lead.phoneNumber,
        company: lead.company ?? "",
        acePoc: lead.acePoc ?? "",
        eventName: lead.eventName?.trim() ?? "",
      });
    }
  }, [lead]);

  async function handleSave() {
    if (!lead) return;
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/leads/${lead.id}`, {
        title: form.title || null,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        company: form.company.trim() || null,
        acePoc: form.acePoc || null,
        eventName: form.eventName.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      onSaved();
    } catch {
      // keep dialog open on error
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  return (
    <Dialog open={!!lead} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Entry</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={e => field("title", e.target.value)} placeholder="Mr / Ms / Dr" data-testid="input-edit-title" />
          </div>
          <div className="space-y-1.5">
            <Label>First Name</Label>
            <Input value={form.firstName} onChange={e => field("firstName", e.target.value)} data-testid="input-edit-firstName" />
          </div>
          <div className="space-y-1.5">
            <Label>Last Name</Label>
            <Input value={form.lastName} onChange={e => field("lastName", e.target.value)} data-testid="input-edit-lastName" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={e => field("email", e.target.value)} type="email" data-testid="input-edit-email" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phoneNumber} onChange={e => field("phoneNumber", e.target.value)} data-testid="input-edit-phone" />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={form.company} onChange={e => field("company", e.target.value)} data-testid="input-edit-company" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Ace POC</Label>
            <Select value={form.acePoc} onValueChange={v => field("acePoc", v)}>
              <SelectTrigger className="[&>span]:truncate" data-testid="select-edit-acePoc">
                <SelectValue placeholder="Select Ace POC" />
              </SelectTrigger>
              <SelectContent>
                {ACE_POC_OPTIONS.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Event Name</Label>
            <Input value={form.eventName} onChange={e => field("eventName", e.target.value)} data-testid="input-edit-eventName" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-edit-save">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Pending deletion tray ──────────────────────────────────────────────────────
interface UndoTrayProps {
  pending: PendingDeletion[];
  now: number;
  onUndo: (key: string) => void;
}

function UndoTray({ pending, now, onUndo }: UndoTrayProps) {
  if (pending.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end" aria-live="polite">
      {[...pending].reverse().map(p => {
        const remaining = Math.max(0, p.deadline - now);
        const pct = (remaining / UNDO_MS) * 100;
        return (
          <div
            key={p.key}
            className="flex items-center gap-3 bg-popover border rounded-lg shadow-lg px-4 py-3 min-w-72"
            data-testid={`undo-card-${p.key}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Deleted "{p.label}"</p>
              <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-destructive rounded-full transition-none"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUndo(p.key)}
              className="shrink-0 h-8 gap-1.5"
              data-testid={`button-undo-${p.key}`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Undo
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Export() {
  const [downloaded, setDownloaded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [pending, setPending] = useState<PendingDeletion[]>([]);
  const [now, setNow] = useState(Date.now());
  const timerMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const { toast } = useToast();

  // Tick every 200 ms while there are pending deletions
  useEffect(() => {
    if (pending.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [pending.length]);

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const isLoading = leadsLoading || customersLoading;
  const pendingIds = useMemo(() => new Set(pending.map(p => p.key)), [pending]);
  const pendingLeadIds = useMemo(() => new Set(pending.map(p => p.leadId).filter(Boolean) as string[]), [pending]);

  const eventNames = useMemo(() => {
    const names = leads.map(l => l.eventName?.trim()).filter((n): n is string => !!n);
    return Array.from(new Set(names)).sort();
  }, [leads]);

  const filteredLeads = useMemo(() =>
    (selectedEvent === "all" ? leads : leads.filter(l => (l.eventName?.trim() ?? "") === selectedEvent))
      .filter(l => !pendingLeadIds.has(l.id)),
    [leads, selectedEvent, pendingLeadIds]
  );

  const leadByCustomerId = useMemo(
    () => new Map(filteredLeads.filter(l => l.customerId).map(l => [l.customerId, l])),
    [filteredLeads]
  );
  const leadByEmail = useMemo(
    () => new Map(filteredLeads.map(l => [l.email, l])),
    [filteredLeads]
  );

  const checkedIn = useMemo((): EnrichedCustomer[] => {
    const base = customers.filter(c => c.status === "checked-in");
    const enriched = base.map(c => {
      const lead = leadByCustomerId.get(c.id) ?? leadByEmail.get(c.email);
      return {
        ...c,
        acePoc: lead?.acePoc ?? null,
        company: lead?.company ?? null,
        eventName: lead?.eventName?.trim() ?? null,
        leadId: lead?.id ?? null,
      };
    });
    const filtered = selectedEvent === "all" ? enriched : enriched.filter(c => c.eventName === selectedEvent);
    return filtered.sort((a, b) => {
      if (!a.checkedInAt) return 1;
      if (!b.checkedInAt) return -1;
      return new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime();
    });
  }, [customers, leadByCustomerId, leadByEmail, selectedEvent]);

  // ── Delete / undo ────────────────────────────────────────────────────────────
  function handleDelete(leadId: string | null, customerId: string, label: string) {
    const key = customerId;
    if (pending.length >= MAX_PENDING || pendingIds.has(key)) return;
    const deadline = Date.now() + UNDO_MS;
    const timerId = setTimeout(async () => {
      try {
        if (leadId) {
          await apiRequest("DELETE", `/api/leads/${leadId}`);
        } else {
          await apiRequest("DELETE", `/api/customers/${customerId}`);
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/leads"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
        ]);
      } catch (err) {
        toast({
          title: "Delete failed",
          description: err instanceof Error ? err.message : "Could not delete record. Please try again.",
          variant: "destructive",
        });
      } finally {
        setPending(p => p.filter(x => x.key !== key));
        timerMap.current.delete(key);
      }
    }, UNDO_MS);
    timerMap.current.set(key, timerId);
    setPending(p => [...p, { key, leadId, label, deadline, timerId }]);
  }

  function handleUndo(key: string) {
    const id = timerMap.current.get(key);
    if (id !== undefined) clearTimeout(id);
    timerMap.current.delete(key);
    setPending(p => p.filter(x => x.key !== key));
  }

  // ── Download ─────────────────────────────────────────────────────────────────
  function handleDownload() {
    const wb = XLSX.utils.book_new();
    const leadsSheet = XLSX.utils.json_to_sheet(buildLeadsSheet(filteredLeads));
    XLSX.utils.book_append_sheet(wb, leadsSheet, "Leads");

    const allLeadMap = new Map(leads.filter(l => l.customerId).map(l => [l.customerId, l]));
    const allLeadEmailMap = new Map(leads.map(l => [l.email, l]));
    const filteredCustomers = selectedEvent === "all"
      ? customers
      : customers.filter(c => {
          const lead = allLeadMap.get(c.id) ?? allLeadEmailMap.get(c.email);
          return (lead?.eventName?.trim() ?? "") === selectedEvent;
        });
    const checkInsSheet = XLSX.utils.json_to_sheet(buildCheckInsSheet(filteredCustomers, filteredLeads));
    XLSX.utils.book_append_sheet(wb, checkInsSheet, "Check-ins");

    const date = new Date().toISOString().slice(0, 10);
    const eventSlug = selectedEvent === "all" ? "all-events" : selectedEvent.replace(/\s+/g, "-");
    XLSX.writeFile(wb, `event-data-${eventSlug}-${date}.xlsx`);
    setDownloaded(true);
  }

  return (
    <div className="space-y-6 max-w-5xl" data-testid="page-export">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Export Event Data</h1>
          <p className="text-muted-foreground mt-1">Filter by event, then review and download leads and check-ins</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by event:</span>
          <Select value={selectedEvent} onValueChange={v => { setSelectedEvent(v); setDownloaded(false); }}>
            <SelectTrigger className="w-52 [&>span]:truncate" data-testid="select-event-filter">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {eventNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
              <p className="text-3xl font-bold" data-testid="count-leads">{filteredLeads.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">form submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            {customersLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
              <p className="text-3xl font-bold" data-testid="count-checkins">{checkedIn.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">invited guests arrived</p>
          </CardContent>
        </Card>
      </div>

      {/* Download card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Event Data Export
            {selectedEvent !== "all" && (
              <Badge variant="outline" className="ml-1">{selectedEvent}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Downloads a single Excel file with two sheets — one for leads from the check-in form, one for invited guests who arrived
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">Sheet 1</Badge>
              <span className="font-medium">Leads</span>
              <span className="text-muted-foreground">— Title, Name, Email, Phone, Company, Ace POC, Event, Submitted At</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">Sheet 2</Badge>
              <span className="font-medium">Check-ins</span>
              <span className="text-muted-foreground">— Name, Email, Phone, Company, Ace POC, Event Name, Invited At, Checked In At</span>
            </div>
          </div>
          {downloaded ? (
            <div className="flex items-center gap-3">
              <Button
                onClick={() => { setDownloaded(false); handleDownload(); }}
                variant="outline"
                disabled={isLoading}
                data-testid="button-download-again"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Download Again
              </Button>
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400" data-testid="status-downloaded">
                <CheckCircle2 className="h-4 w-4" />
                Downloaded successfully
              </span>
            </div>
          ) : (
            <Button
              onClick={handleDownload}
              disabled={isLoading || (filteredLeads.length === 0 && checkedIn.length === 0)}
              size="lg"
              data-testid="button-download-excel"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading data…</>
              ) : (
                <><FileDown className="h-4 w-4 mr-2" />Download{selectedEvent !== "all" ? ` "${selectedEvent}"` : " Event Data"} (.xlsx)</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Checked-in guests table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Checked-In Guests
            {!customersLoading && (
              <Badge variant="secondary" className="ml-1">{checkedIn.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {selectedEvent === "all"
              ? "Invited guests who have arrived, most recent first"
              : `Guests checked in for "${selectedEvent}", most recent first`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {customersLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : checkedIn.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <UserCheck className="h-9 w-9 mb-3 opacity-25" />
              <p className="text-sm">
                {selectedEvent === "all" ? "No guests have checked in yet" : `No check-ins found for "${selectedEvent}"`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Ace POC</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Checked In At</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkedIn.map(c => {
                  const lead = c.leadId ? leads.find(l => l.id === c.leadId) ?? null : null;
                  const canDelete = !pendingIds.has(c.id) && pending.length < MAX_PENDING;
                  const canEdit = !!c.leadId && !!lead;
                  return (
                    <TableRow key={c.id} data-testid={`row-checkin-${c.id}`}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.company ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.acePoc ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.eventName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.checkedInAt ? new Date(c.checkedInAt).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            disabled={!canEdit}
                            onClick={() => lead && setEditingLead(lead)}
                            data-testid={`button-edit-${c.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            disabled={!canDelete}
                            onClick={() => handleDelete(c.leadId, c.id, c.name)}
                            data-testid={`button-delete-${c.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <EditDialog
        lead={editingLead}
        onClose={() => setEditingLead(null)}
        onSaved={() => setEditingLead(null)}
      />

      {/* Undo tray */}
      <UndoTray pending={pending} now={now} onUndo={handleUndo} />
    </div>
  );
}

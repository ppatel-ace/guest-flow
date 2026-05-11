import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, CheckCircle2, Loader2, UserCheck } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Lead, Customer } from "@shared/schema";

function buildLeadsSheet(leads: Lead[]) {
  return leads.map(l => ({
    "Title": l.title ?? "",
    "First Name": l.firstName,
    "Last Name": l.lastName,
    "Email": l.email,
    "Phone": l.phoneNumber,
    "Company": l.company ?? "",
    "Ace POC": l.acePoc ?? "",
    "Event Name": l.eventName ?? "",
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
        "Event Name": lead?.eventName ?? "",
        "Status": c.status,
        "Invited At": c.invitedAt ? new Date(c.invitedAt).toLocaleString() : "",
        "Checked In At": c.checkedInAt ? new Date(c.checkedInAt).toLocaleString() : "",
      };
    });
}

export default function Export() {
  const [downloaded, setDownloaded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("all");

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

  const eventNames = useMemo(() => {
    const names = leads
      .map(l => l.eventName)
      .filter((n): n is string => !!n);
    return Array.from(new Set(names)).sort();
  }, [leads]);

  const filteredLeads = useMemo(() =>
    selectedEvent === "all" ? leads : leads.filter(l => l.eventName === selectedEvent),
    [leads, selectedEvent]
  );

  const leadByCustomerId = useMemo(
    () => new Map(filteredLeads.filter(l => l.customerId).map(l => [l.customerId, l])),
    [filteredLeads]
  );
  const leadByEmail = useMemo(
    () => new Map(filteredLeads.map(l => [l.email, l])),
    [filteredLeads]
  );

  const checkedIn = useMemo(() => {
    const base = customers.filter(c => c.status === "checked-in");
    const enriched = base.map(c => {
      const lead = leadByCustomerId.get(c.id) ?? leadByEmail.get(c.email);
      return { ...c, acePoc: lead?.acePoc ?? null, company: lead?.company ?? null, eventName: lead?.eventName ?? null };
    });
    const filtered = selectedEvent === "all"
      ? enriched
      : enriched.filter(c => c.eventName === selectedEvent);
    return filtered.sort((a, b) => {
      if (!a.checkedInAt) return 1;
      if (!b.checkedInAt) return -1;
      return new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime();
    });
  }, [customers, leadByCustomerId, leadByEmail, selectedEvent]);

  function handleDownload() {
    const wb = XLSX.utils.book_new();

    const leadsSheet = XLSX.utils.json_to_sheet(buildLeadsSheet(filteredLeads));
    XLSX.utils.book_append_sheet(wb, leadsSheet, "Leads");

    const checkInsSheet = XLSX.utils.json_to_sheet(buildCheckInsSheet(
      selectedEvent === "all" ? customers : customers.filter(c => {
        const lead = new Map(leads.filter(l => l.customerId).map(l => [l.customerId, l])).get(c.id)
          ?? new Map(leads.map(l => [l.email, l])).get(c.email);
        return lead?.eventName === selectedEvent;
      }),
      filteredLeads
    ));
    XLSX.utils.book_append_sheet(wb, checkInsSheet, "Check-ins");

    const date = new Date().toISOString().slice(0, 10);
    const eventSlug = selectedEvent === "all" ? "all-events" : selectedEvent.replace(/\s+/g, "-");
    XLSX.writeFile(wb, `event-data-${eventSlug}-${date}.xlsx`);
    setDownloaded(true);
  }

  return (
    <div className="space-y-6 max-w-5xl" data-testid="page-export">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Export Event Data</h1>
          <p className="text-muted-foreground mt-1">Filter by event, then review and download leads and check-ins</p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by event:</span>
          <Select value={selectedEvent} onValueChange={(v) => { setSelectedEvent(v); setDownloaded(false); }}>
            <SelectTrigger className="w-52" data-testid="select-event-filter">
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

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
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
            {customersLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold" data-testid="count-checkins">{checkedIn.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">invited guests arrived</p>
          </CardContent>
        </Card>
      </div>

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
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading data...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-2" />
                  Download{selectedEvent !== "all" ? ` "${selectedEvent}"` : " Event Data"} (.xlsx)
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

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
            {selectedEvent === "all" ? "Invited guests who have arrived, most recent first" : `Guests checked in for "${selectedEvent}", most recent first`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {customersLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkedIn.map(c => (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

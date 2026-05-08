import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { User, Building2, Mail, Phone, Calendar, ArrowLeft, Download, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";
import type { ContactDetail } from "../../server/storage";

const EXPORT_HEADERS = ["Title", "First Name", "Last Name", "Email", "Phone", "Company", "Ace POC", "Event Name", "Event Date", "Event Location", "Visit Date"];

function buildRows(contact: ContactDetail) {
  if (contact.visits.length === 0) {
    return [{
      "Title": contact.title ?? "",
      "First Name": contact.firstName,
      "Last Name": contact.lastName,
      "Email": contact.email,
      "Phone": contact.phone ?? "",
      "Company": contact.companyName ?? "",
      "Ace POC": contact.acePoc ?? "",
      "Event Name": "",
      "Event Date": "",
      "Event Location": "",
      "Visit Date": "",
    }];
  }
  return contact.visits.map(v => ({
    "Title": contact.title ?? "",
    "First Name": contact.firstName,
    "Last Name": contact.lastName,
    "Email": contact.email,
    "Phone": contact.phone ?? "",
    "Company": contact.companyName ?? "",
    "Ace POC": v.acePoc ?? "",
    "Event Name": v.eventName ?? "",
    "Event Date": v.eventDate ?? "",
    "Event Location": v.eventLocation ?? "",
    "Visit Date": new Date(v.visitedAt).toLocaleDateString(),
  }));
}

function exportCSV(contact: ContactDetail) {
  const rows = buildRows(contact);
  const csv = [EXPORT_HEADERS, ...rows.map(r => EXPORT_HEADERS.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`))].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${contact.firstName}_${contact.lastName}_visits.csv`.replace(/\s+/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(contact: ContactDetail) {
  const rows = buildRows(contact);
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Visits");
  XLSX.writeFile(wb, `${contact.firstName}_${contact.lastName}_visits.xlsx`.replace(/\s+/g, "_"));
}

export default function CrmContactDetail() {
  const params = useParams<{ id: string }>();

  const { data: contact, isLoading } = useQuery<ContactDetail>({
    queryKey: ["/api/crm/contacts", params.id],
  });

  const [visitSearch, setVisitSearch] = useState("");
  const [visitDateFrom, setVisitDateFrom] = useState("");
  const [visitDateTo, setVisitDateTo] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <User className="h-10 w-10 mb-3 opacity-30" />
        <p>Contact not found</p>
        <Link href="/crm/contacts">
          <Button variant="link" className="mt-2">Back to Contacts</Button>
        </Link>
      </div>
    );
  }

  const fullName = `${contact?.title ? contact.title + " " : ""}${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim();

  const filteredVisits = (contact?.visits ?? []).filter(v => {
    const search = visitSearch.trim().toLowerCase();
    if (search && !(v.eventName ?? "").toLowerCase().includes(search)) return false;
    const visitLocalDate = new Date(v.visitedAt).toLocaleDateString("en-CA");
    if (visitDateFrom && visitLocalDate < visitDateFrom) return false;
    if (visitDateTo && visitLocalDate > visitDateTo) return false;
    return true;
  });

  const hasVisitFilter = visitSearch.trim() !== "" || visitDateFrom !== "" || visitDateTo !== "";

  function clearVisitFilters() {
    setVisitSearch("");
    setVisitDateFrom("");
    setVisitDateTo("");
  }

  return (
    <div className="space-y-6" data-testid="page-contact-detail">
      <div className="flex items-center gap-3">
        <Link href="/crm/contacts">
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-contacts">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-3xl font-bold">{fullName}</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-9">
            {contact.visits.length} {contact.visits.length === 1 ? "visit" : "visits"} recorded
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-export-contact">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportCSV(contact)}>Export as CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportExcel(contact)}>Export as Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact info card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="break-all">{contact.email}</span>
            </div>
            {contact.phone && (
              <div className="flex items-start gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.companyName && (
              <div className="flex items-start gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                {contact.companyId ? (
                  <Link href={`/crm/companies/${contact.companyId}`} className="hover:underline font-medium">
                    {contact.companyName}
                  </Link>
                ) : (
                  <span>{contact.companyName}</span>
                )}
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">First seen</p>
              <p className="text-sm">{new Date(contact.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Visit history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Visit History
              </CardTitle>
              <CardDescription>Every event this contact has attended</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {contact.visits.length > 0 && (
                <div className="flex flex-wrap items-end gap-3 pt-3">
                  <div className="flex-1 min-w-[180px]">
                    <Label htmlFor="visit-search-contact" className="text-xs text-muted-foreground mb-1 block">Search event</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        id="visit-search-contact"
                        placeholder="Event name…"
                        value={visitSearch}
                        onChange={e => setVisitSearch(e.target.value)}
                        className="pl-8 h-8 text-sm"
                        data-testid="input-visit-search"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="visit-date-from-contact" className="text-xs text-muted-foreground mb-1 block">From</Label>
                    <Input
                      id="visit-date-from-contact"
                      type="date"
                      value={visitDateFrom}
                      onChange={e => setVisitDateFrom(e.target.value)}
                      className="h-8 text-sm w-36"
                      data-testid="input-visit-date-from"
                    />
                  </div>
                  <div>
                    <Label htmlFor="visit-date-to-contact" className="text-xs text-muted-foreground mb-1 block">To</Label>
                    <Input
                      id="visit-date-to-contact"
                      type="date"
                      value={visitDateTo}
                      onChange={e => setVisitDateTo(e.target.value)}
                      className="h-8 text-sm w-36"
                      data-testid="input-visit-date-to"
                    />
                  </div>
                  {hasVisitFilter && (
                    <Button variant="ghost" size="sm" onClick={clearVisitFilters} className="h-8 text-xs" data-testid="button-clear-visit-filters">
                      <X className="h-3.5 w-3.5 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
            <CardContent className="p-0">
              {contact.visits.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No visits recorded yet
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No visits match the current filters
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Ace POC</TableHead>
                      <TableHead>Event Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Checked In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVisits.map(visit => (
                      <TableRow key={visit.id} data-testid={`row-visit-${visit.id}`}>
                        <TableCell className="font-medium">{visit.eventName ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{visit.acePoc ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{visit.eventDate ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{visit.eventLocation ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(visit.visitedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

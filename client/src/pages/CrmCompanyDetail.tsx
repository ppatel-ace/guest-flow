import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Building2, User, Download, ArrowLeft, Trophy, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import type { CompanyDetail } from "../../server/storage";

const EXPORT_HEADERS = ["Title", "First Name", "Last Name", "Email", "Phone", "Company", "Ace POC", "Event Name", "Event Date", "Event Location", "Visit Date"];

function buildRows(company: CompanyDetail) {
  const rows: Record<string, string>[] = [];
  for (const contact of company.contacts) {
    if (contact.visits.length === 0) {
      rows.push({
        "Title": contact.title ?? "",
        "First Name": contact.firstName,
        "Last Name": contact.lastName,
        "Email": contact.email,
        "Phone": contact.phone ?? "",
        "Company": company.name,
        "Ace POC": contact.acePoc ?? "",
        "Event Name": "",
        "Event Date": "",
        "Event Location": "",
        "Visit Date": "",
      });
    } else {
      for (const visit of contact.visits) {
        rows.push({
          "Title": contact.title ?? "",
          "First Name": contact.firstName,
          "Last Name": contact.lastName,
          "Email": contact.email,
          "Phone": contact.phone ?? "",
          "Company": company.name,
          "Ace POC": visit.acePoc ?? "",
          "Event Name": visit.eventName ?? "",
          "Event Date": visit.eventDate ?? "",
          "Event Location": visit.eventLocation ?? "",
          "Visit Date": new Date(visit.visitedAt).toLocaleDateString(),
        });
      }
    }
  }
  return rows;
}

function exportCSV(company: CompanyDetail) {
  const rows = buildRows(company);
  const csv = [EXPORT_HEADERS, ...rows.map(r => EXPORT_HEADERS.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`))].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${company.name.replace(/[^a-z0-9]/gi, "_")}_contacts.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(company: CompanyDetail) {
  const rows = buildRows(company);
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  XLSX.writeFile(wb, `${company.name.replace(/[^a-z0-9]/gi, "_")}_contacts.xlsx`);
}

export default function CrmCompanyDetail() {
  const params = useParams<{ id: string }>();

  const { data: company, isLoading } = useQuery<CompanyDetail>({
    queryKey: ["/api/crm/companies", params.id],
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

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Building2 className="h-10 w-10 mb-3 opacity-30" />
        <p>Company not found</p>
        <Link href="/crm/companies">
          <Button variant="link" className="mt-2">Back to Companies</Button>
        </Link>
      </div>
    );
  }

  const allVisits = (company?.contacts ?? []).flatMap(c =>
    c.visits.map(v => ({ ...v, contactName: `${c.firstName} ${c.lastName}`, contactId: c.id }))
  ).sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());

  const filteredVisits = allVisits.filter(v => {
    const search = visitSearch.trim().toLowerCase();
    if (search && !(v.eventName ?? "").toLowerCase().includes(search) && !v.contactName.toLowerCase().includes(search)) return false;
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
    <div className="space-y-6" data-testid="page-company-detail">
      <div className="flex items-center gap-3">
        <Link href="/crm/companies">
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-companies">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-3xl font-bold">{company.name}</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-9">
            {company.contacts.length} {company.contacts.length === 1 ? "contact" : "contacts"} · {company.totalVisits} {company.totalVisits === 1 ? "visit" : "visits"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-export-company">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportCSV(company)}>Export as CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportExcel(company)}>Export as Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contacts list */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contacts</CardTitle>
              <CardDescription>{company.contacts.length} people from this company</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {company.contacts.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  No contacts yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Ace POC</TableHead>
                      <TableHead className="text-center">Visits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.contacts.map(contact => (
                      <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                        <TableCell>
                          <Link href={`/crm/contacts/${contact.id}`} className="font-medium hover:underline flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {contact.firstName} {contact.lastName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{contact.title ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{contact.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{contact.phone ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{contact.acePoc ?? "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{contact.visits.length}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Visit history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Visit History</CardTitle>
              <CardDescription>All event visits from contacts at this company</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Filters */}
              {allVisits.length > 0 && (
                <div className="flex flex-wrap items-end gap-3 pt-3">
                  <div className="flex-1 min-w-[180px]">
                    <Label htmlFor="visit-search-company" className="text-xs text-muted-foreground mb-1 block">Search event or contact</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        id="visit-search-company"
                        placeholder="Event name or contact…"
                        value={visitSearch}
                        onChange={e => setVisitSearch(e.target.value)}
                        className="pl-8 h-8 text-sm"
                        data-testid="input-visit-search"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="visit-date-from-company" className="text-xs text-muted-foreground mb-1 block">From</Label>
                    <Input
                      id="visit-date-from-company"
                      type="date"
                      value={visitDateFrom}
                      onChange={e => setVisitDateFrom(e.target.value)}
                      className="h-8 text-sm w-36"
                      data-testid="input-visit-date-from"
                    />
                  </div>
                  <div>
                    <Label htmlFor="visit-date-to-company" className="text-xs text-muted-foreground mb-1 block">To</Label>
                    <Input
                      id="visit-date-to-company"
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
              {allVisits.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  No visits recorded
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  No visits match the current filters
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Ace POC</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVisits.map(visit => (
                      <TableRow key={visit.id} data-testid={`row-visit-${visit.id}`}>
                        <TableCell>
                          <Link href={`/crm/contacts/${visit.contactId}`} className="text-sm hover:underline">
                            {visit.contactName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{visit.eventName ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{visit.acePoc ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {visit.eventDate ?? new Date(visit.visitedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{visit.eventLocation ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ace POC frequency sidebar */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Ace POC Ranking
              </CardTitle>
              <CardDescription>Who has engaged this company most</CardDescription>
            </CardHeader>
            <CardContent>
              {company.acePocFrequency.length === 0 ? (
                <p className="text-sm text-muted-foreground">No POC data available</p>
              ) : (
                <div className="space-y-3">
                  {company.acePocFrequency.map((entry, index) => {
                    const max = company.acePocFrequency[0].count;
                    const pct = Math.round((entry.count / max) * 100);
                    return (
                      <div key={entry.acePoc} className="space-y-1" data-testid={`poc-rank-${index}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium flex items-center gap-1.5">
                            {index === 0 && <span className="text-amber-500">🥇</span>}
                            {index === 1 && <span className="text-slate-400">🥈</span>}
                            {index === 2 && <span className="text-amber-700">🥉</span>}
                            {index > 2 && <span className="text-muted-foreground w-5 text-center">{index + 1}</span>}
                            {entry.acePoc}
                          </span>
                          <Badge variant="secondary">{entry.count}</Badge>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

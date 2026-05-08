import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Download, Search, ChevronDown } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Lead } from "@shared/schema";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleString();
}

function leadsToRows(leads: Lead[]) {
  return leads.map((lead) => ({
    Title: lead.title ?? "",
    "First Name": lead.firstName,
    "Last Name": lead.lastName,
    Email: lead.email,
    "Phone Number": lead.phoneNumber,
    Company: lead.company ?? "",
    "Ace POC": lead.acePoc ?? "",
    "Event Name": lead.eventName ?? "",
    "Submitted At": formatDate(lead.submittedAt),
  }));
}

function exportCSV(leads: Lead[]) {
  const rows = leadsToRows(leads);
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(leads: Lead[]) {
  const rows = leadsToRows(leads);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function Leads() {
  const [search, setSearch] = useState("");

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.firstName, l.lastName, l.email, l.phoneNumber, l.company, l.acePoc, l.eventName]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [leads, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Retrieval</h1>
          <p className="text-muted-foreground mt-1">
            Guests who checked in via the QR code form
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={filtered.length === 0}
              data-testid="button-export"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => exportCSV(filtered)}
              data-testid="menu-item-export-csv"
            >
              Download as CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportExcel(filtered)}
              data-testid="menu-item-export-excel"
            >
              Download as Excel (.xlsx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold">All Leads</CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading..."
                : search.trim()
                ? `${filtered.length} of ${leads.length} lead${leads.length !== 1 ? "s" : ""}`
                : `${leads.length} lead${leads.length !== 1 ? "s" : ""} captured`}
            </CardDescription>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name, email, event…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-56"
              data-testid="input-leads-search"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No leads yet</p>
              <p className="text-sm mt-1">
                Leads will appear here when guests fill out the check-in form.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No matching leads</p>
              <p className="text-sm mt-1">Try a different search term.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Phone</th>
                    <th className="pb-3 pr-4 font-medium">Company</th>
                    <th className="pb-3 pr-4 font-medium">Ace POC</th>
                    <th className="pb-3 pr-4 font-medium">Event</th>
                    <th className="pb-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                      data-testid={`row-lead-${lead.id}`}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          {lead.title && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {lead.title}
                            </Badge>
                          )}
                          <span className="font-medium">
                            {lead.firstName} {lead.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{lead.email}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{lead.phoneNumber}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{lead.company ?? "—"}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{lead.acePoc ?? "—"}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{lead.eventName ?? "—"}</td>
                      <td className="py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(lead.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

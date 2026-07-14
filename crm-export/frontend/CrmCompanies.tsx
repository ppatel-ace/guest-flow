import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Search, Download, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyWithStats } from "../../server/storage";

function exportCSV(companies: CompanyWithStats[]) {
  const headers = ["Company", "Contacts", "Total Visits", "Last Event", "Last Visit"];
  const rows = companies.map(c => [
    c.name,
    c.contactCount,
    c.visitCount,
    c.lastEventName ?? "",
    c.lastVisitedAt ? new Date(c.lastVisitedAt).toLocaleDateString() : "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "companies.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CrmCompanies() {
  const [search, setSearch] = useState("");

  const { data: companies = [], isLoading } = useQuery<CompanyWithStats[]>({
    queryKey: ["/api/crm/companies"],
  });

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="page-crm-companies">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">All companies that have attended your events</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(filtered)}
          data-testid="button-export-companies"
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-companies"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {isLoading ? "Loading..." : `${filtered.length} ${filtered.length === 1 ? "company" : "companies"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No companies found</p>
              {search && <p className="text-xs mt-1">Try a different search term</p>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead className="text-center">Total Visits</TableHead>
                  <TableHead>Last Event</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(company => (
                  <TableRow key={company.id} className="cursor-pointer hover:bg-muted/50" data-testid={`row-company-${company.id}`}>
                    <TableCell>
                      <Link href={`/crm/companies/${company.id}`} className="font-medium hover:underline flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{company.contactCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{company.visitCount}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.lastEventName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.lastVisitedAt ? new Date(company.lastVisitedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/crm/companies/${company.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { User, Search, Download, ChevronRight, Building2, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from "xlsx";
import type { ContactWithStats } from "../../server/storage";

type SortColumn = "name" | "company" | "acePoc" | "visits" | "lastVisit";
type SortDir = "asc" | "desc";

function contactsToRows(contacts: ContactWithStats[]) {
  return contacts.map(c => ({
    "Title": c.title ?? "",
    "First Name": c.firstName,
    "Last Name": c.lastName,
    "Email": c.email,
    "Phone": c.phone ?? "",
    "Company": c.companyName ?? "",
    "Ace POC": c.acePoc ?? "",
    "Visits": c.visitCount,
    "Last Event": c.lastEventName ?? "",
    "Last Visit": c.lastVisitedAt ? new Date(c.lastVisitedAt).toLocaleDateString() : "",
  }));
}

function exportCSV(contacts: ContactWithStats[]) {
  const headers = ["Title", "First Name", "Last Name", "Email", "Phone", "Company", "Ace POC", "Visits", "Last Event", "Last Visit"];
  const rows = contacts.map(c => [
    c.title ?? "",
    c.firstName,
    c.lastName,
    c.email,
    c.phone ?? "",
    c.companyName ?? "",
    c.acePoc ?? "",
    c.visitCount,
    c.lastEventName ?? "",
    c.lastVisitedAt ? new Date(c.lastVisitedAt).toLocaleDateString() : "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(contacts: ContactWithStats[]) {
  const rows = contactsToRows(contacts);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  XLSX.writeFile(wb, `contacts-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function SortIcon({ column, sortCol, sortDir }: { column: SortColumn; sortCol: SortColumn; sortDir: SortDir }) {
  if (sortCol !== column) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />;
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-foreground" />
    : <ArrowDown className="ml-1 h-3.5 w-3.5 text-foreground" />;
}

function sortContacts(contacts: ContactWithStats[], col: SortColumn, dir: SortDir) {
  return [...contacts].sort((a, b) => {
    let av: string | number = 0;
    let bv: string | number = 0;
    switch (col) {
      case "name":
        av = `${a.lastName} ${a.firstName}`.toLowerCase();
        bv = `${b.lastName} ${b.firstName}`.toLowerCase();
        break;
      case "company":
        av = (a.companyName ?? "").toLowerCase();
        bv = (b.companyName ?? "").toLowerCase();
        break;
      case "acePoc":
        av = (a.acePoc ?? "").toLowerCase();
        bv = (b.acePoc ?? "").toLowerCase();
        break;
      case "visits":
        av = a.visitCount;
        bv = b.visitCount;
        break;
      case "lastVisit":
        av = a.lastVisitedAt ? new Date(a.lastVisitedAt).getTime() : 0;
        bv = b.lastVisitedAt ? new Date(b.lastVisitedAt).getTime() : 0;
        break;
    }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

export default function CrmContacts() {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: contacts = [], isLoading } = useQuery<ContactWithStats[]>({
    queryKey: ["/api/crm/contacts"],
  });

  function handleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const filtered = contacts.filter(c => {
    const term = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(term) ||
      c.lastName.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.companyName ?? "").toLowerCase().includes(term) ||
      (c.acePoc ?? "").toLowerCase().includes(term)
    );
  });

  const sorted = sortContacts(filtered, sortCol, sortDir);

  function SortableHead({ col, children, className }: { col: SortColumn; children: React.ReactNode; className?: string }) {
    return (
      <TableHead className={className}>
        <button
          className="flex items-center hover:text-foreground transition-colors w-full"
          onClick={() => handleSort(col)}
          data-testid={`sort-${col}`}
        >
          {children}
          <SortIcon column={col} sortCol={sortCol} sortDir={sortDir} />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-crm-contacts">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">All individuals who have visited your events</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0}
              data-testid="button-export-contacts"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => exportCSV(sorted)}
              data-testid="menu-item-export-csv"
            >
              Download as CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportExcel(sorted)}
              data-testid="menu-item-export-excel"
            >
              Download as Excel (.xlsx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, company, or Ace POC..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-contacts"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {isLoading ? "Loading..." : `${sorted.length} ${sorted.length === 1 ? "contact" : "contacts"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <User className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No contacts found</p>
              {search && <p className="text-xs mt-1">Try a different search term</p>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead col="name">Name</SortableHead>
                  <TableHead>Email</TableHead>
                  <SortableHead col="company">Company</SortableHead>
                  <SortableHead col="acePoc">Ace POC</SortableHead>
                  <SortableHead col="visits" className="text-center">Visits</SortableHead>
                  <TableHead>Last Event</TableHead>
                  <SortableHead col="lastVisit">Last Visit</SortableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(contact => (
                  <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50" data-testid={`row-contact-${contact.id}`}>
                    <TableCell>
                      <Link href={`/crm/contacts/${contact.id}`} className="font-medium hover:underline flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{contact.title ? `${contact.title} ` : ""}{contact.firstName} {contact.lastName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact.email}</TableCell>
                    <TableCell>
                      {contact.companyId ? (
                        <Link href={`/crm/companies/${contact.companyId}`} className="flex items-center gap-1 text-sm hover:underline text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {contact.companyName}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact.acePoc ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{contact.visitCount}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact.lastEventName ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.lastVisitedAt ? new Date(contact.lastVisitedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/crm/contacts/${contact.id}`}>
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

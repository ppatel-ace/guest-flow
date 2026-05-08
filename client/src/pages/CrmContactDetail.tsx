import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { User, Building2, Mail, Phone, Calendar, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ContactDetail } from "../../server/storage";

function exportCSV(contact: ContactDetail) {
  const headers = ["Title", "First Name", "Last Name", "Email", "Phone", "Company", "Ace POC", "Event Name", "Event Date", "Event Location", "Visit Date"];
  const rows = contact.visits.length > 0
    ? contact.visits.map(v => [
        contact.title ?? "",
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone ?? "",
        contact.companyName ?? "",
        contact.acePoc ?? "",
        v.eventName ?? "",
        v.eventDate ?? "",
        v.eventLocation ?? "",
        new Date(v.visitedAt).toLocaleDateString(),
      ])
    : [[
        contact.title ?? "",
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone ?? "",
        contact.companyName ?? "",
        contact.acePoc ?? "",
        "", "", "", "",
      ]];

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${contact.firstName}_${contact.lastName}_visits.csv`.replace(/\s+/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}

export default function CrmContactDetail() {
  const params = useParams<{ id: string }>();

  const { data: contact, isLoading } = useQuery<ContactDetail>({
    queryKey: ["/api/crm/contacts", params.id],
  });

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

  const fullName = `${contact.title ? contact.title + " " : ""}${contact.firstName} ${contact.lastName}`;

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(contact)}
          data-testid="button-export-contact"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
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
            {contact.acePoc && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Ace POC</p>
                <p className="text-sm font-medium">{contact.acePoc}</p>
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
            <CardContent className="p-0">
              {contact.visits.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No visits recorded yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Event Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Checked In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contact.visits.map(visit => (
                      <TableRow key={visit.id} data-testid={`row-visit-${visit.id}`}>
                        <TableCell className="font-medium">{visit.eventName ?? "—"}</TableCell>
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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, CheckCircle2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function buildCheckInsSheet(customers: Customer[]) {
  return customers
    .filter(c => c.status === "checked-in")
    .map(c => ({
      "Name": c.name,
      "Email": c.email,
      "Phone": c.phone ?? "",
      "Status": c.status,
      "Invited At": c.invitedAt ? new Date(c.invitedAt).toLocaleString() : "",
      "Checked In At": c.checkedInAt ? new Date(c.checkedInAt).toLocaleString() : "",
    }));
}

export default function Export() {
  const [downloaded, setDownloaded] = useState(false);

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const isLoading = leadsLoading || customersLoading;
  const checkedInCount = customers.filter(c => c.status === "checked-in").length;

  function handleDownload() {
    const wb = XLSX.utils.book_new();

    const leadsSheet = XLSX.utils.json_to_sheet(buildLeadsSheet(leads));
    XLSX.utils.book_append_sheet(wb, leadsSheet, "Leads");

    const checkInsSheet = XLSX.utils.json_to_sheet(buildCheckInsSheet(customers));
    XLSX.utils.book_append_sheet(wb, checkInsSheet, "Check-ins");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `event-data-${date}.xlsx`);
    setDownloaded(true);
  }

  return (
    <div className="space-y-6 max-w-2xl" data-testid="page-export">
      <div>
        <h1 className="text-3xl font-bold">Export Event Data</h1>
        <p className="text-muted-foreground mt-1">Download all leads and check-ins from this event as an Excel file</p>
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
              <p className="text-3xl font-bold" data-testid="count-leads">{leads.length}</p>
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
              <p className="text-3xl font-bold" data-testid="count-checkins">{checkedInCount}</p>
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
              <span className="text-muted-foreground">— Name, Email, Phone, Status, Invited At, Checked In At</span>
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
              disabled={isLoading || (leads.length === 0 && checkedInCount === 0)}
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
                  Download Event Data (.xlsx)
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

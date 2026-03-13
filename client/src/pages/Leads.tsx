import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import type { Lead } from "@shared/schema";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleString();
}

export default function Leads() {
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Retrieval</h1>
        <p className="text-muted-foreground mt-1">
          Guests who checked in via the QR code form
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base font-semibold">All Leads</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${leads.length} lead${leads.length !== 1 ? "s" : ""} captured`}
            </CardDescription>
          </div>
          <Users className="h-5 w-5 text-muted-foreground" />
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
              <p className="text-sm mt-1">Leads will appear here when guests fill out the check-in form.</p>
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
                    <th className="pb-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          {lead.title && (
                            <Badge variant="outline" className="text-xs shrink-0">{lead.title}</Badge>
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

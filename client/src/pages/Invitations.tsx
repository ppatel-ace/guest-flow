import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerStatusBadge } from "@/components/CustomerStatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Send } from "lucide-react";

interface Invitation {
  id: string;
  customerName: string;
  email: string;
  status: "pending" | "confirmed" | "checked-in";
  sentAt?: string;
  qrCode: string;
}

const mockInvitations: Invitation[] = [
  { id: "1", customerName: "Sarah Johnson", email: "sarah.j@example.com", status: "checked-in", sentAt: "2 hours ago", qrCode: "QR_001" },
  { id: "2", customerName: "Michael Chen", email: "m.chen@example.com", status: "confirmed", sentAt: "1 day ago", qrCode: "QR_002" },
  { id: "3", customerName: "Emily Rodriguez", email: "emily.r@example.com", status: "pending", sentAt: "3 days ago", qrCode: "QR_003" },
  { id: "4", customerName: "David Kim", email: "david.kim@example.com", status: "checked-in", sentAt: "5 hours ago", qrCode: "QR_004" },
  { id: "5", customerName: "Jessica Martinez", email: "j.martinez@example.com", status: "confirmed", sentAt: "12 hours ago", qrCode: "QR_005" },
];

export default function Invitations() {
  const handleSendInvite = (id: string) => {
    console.log('Sending invitation to:', id);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6" data-testid="page-invitations">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Invitations</h1>
          <p className="text-muted-foreground">Manage email invitations and QR codes</p>
        </div>
        <Button data-testid="button-send-bulk-invites">
          <Send className="mr-2 h-4 w-4" />
          Send Bulk Invites
        </Button>
      </div>

      <div className="grid gap-4">
        {mockInvitations.map((invitation) => (
          <Card key={invitation.id} data-testid={`card-invitation-${invitation.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(invitation.customerName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base" data-testid={`text-invitation-name-${invitation.id}`}>{invitation.customerName}</CardTitle>
                    <CardDescription data-testid={`text-invitation-email-${invitation.id}`}>{invitation.email}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CustomerStatusBadge status={invitation.status} />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleSendInvite(invitation.id)}
                    data-testid={`button-resend-${invitation.id}`}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Resend
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
                <div className="text-muted-foreground">
                  Sent: {invitation.sentAt}
                </div>
                <div className="text-muted-foreground">
                  QR Code: <span className="font-mono" data-testid={`text-qr-code-${invitation.id}`}>{invitation.qrCode}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerStatusBadge } from "@/components/CustomerStatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Send, Phone } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@shared/schema";

export default function Invitations() {
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return apiRequest('POST', `/api/customers/${customerId}/invite`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Invitation Sent",
        description: "The invitation has been sent successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invitation.",
        variant: "destructive",
      });
    },
  });

  const handleSendInvite = (id: string) => {
    sendInviteMutation.mutate(id);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return "just now";
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return d.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Invitations</h1>
          <p className="text-muted-foreground">Manage email invitations and QR codes</p>
        </div>
        <p className="text-muted-foreground">Loading invitations...</p>
      </div>
    );
  }

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
        {customers.map((customer) => (
          <Card key={customer.id} data-testid={`card-invitation-${customer.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base" data-testid={`text-invitation-name-${customer.id}`}>{customer.name}</CardTitle>
                    <CardDescription data-testid={`text-invitation-email-${customer.id}`}>{customer.email}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CustomerStatusBadge status={customer.status} />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleSendInvite(customer.id)}
                    disabled={sendInviteMutation.isPending}
                    data-testid={`button-resend-${customer.id}`}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {customer.status === 'pending' ? 'Send' : 'Resend'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span data-testid={`text-phone-${customer.id}`}>{customer.phone}</span>
                </div>
                {customer.invitedAt && (
                  <div className="text-muted-foreground">
                    Sent: {formatDate(customer.invitedAt)}
                  </div>
                )}
                {customer.qrCode && (
                  <div className="text-muted-foreground">
                    QR Code: <span className="font-mono" data-testid={`text-qr-code-${customer.id}`}>{customer.qrCode}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

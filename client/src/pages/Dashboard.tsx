import { StatsCard } from "@/components/StatsCard";
import { CustomerTable, Customer } from "@/components/CustomerTable";
import { Users, CheckCircle, Mail, Clock } from "lucide-react";

const mockCustomers: Customer[] = [
  { id: "1", name: "Sarah Johnson", email: "sarah.j@example.com", phone: "+1 (555) 123-4567", status: "checked-in", invitedAt: "2 hours ago" },
  { id: "2", name: "Michael Chen", email: "m.chen@example.com", phone: "+1 (555) 234-5678", status: "confirmed", invitedAt: "1 day ago" },
  { id: "3", name: "Emily Rodriguez", email: "emily.r@example.com", phone: "+1 (555) 345-6789", status: "pending", invitedAt: "3 days ago" },
  { id: "4", name: "David Kim", email: "david.kim@example.com", phone: "+1 (555) 456-7890", status: "checked-in", invitedAt: "5 hours ago" },
  { id: "5", name: "Jessica Martinez", email: "j.martinez@example.com", phone: "+1 (555) 567-8901", status: "confirmed", invitedAt: "12 hours ago" },
];

export default function Dashboard() {
  const handleSendInvite = (id: string) => {
    console.log('Send invite to customer:', id);
  };

  const handleCheckIn = (id: string) => {
    console.log('Check in customer:', id);
  };

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your customer check-in system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Customers" value="248" icon={Users} description="+12 from last week" />
        <StatsCard title="Checked In" value="142" icon={CheckCircle} description="Today's visitors" />
        <StatsCard title="Invites Sent" value="195" icon={Mail} description="This month" />
        <StatsCard title="Pending" value="53" icon={Clock} description="Awaiting check-in" />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <CustomerTable 
          customers={mockCustomers} 
          onSendInvite={handleSendInvite}
          onCheckIn={handleCheckIn}
        />
      </div>
    </div>
  );
}

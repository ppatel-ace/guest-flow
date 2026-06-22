import { CustomerTable, Customer } from '../CustomerTable';

const mockCustomers: Customer[] = [
  { id: "1", name: "Sarah Johnson", email: "sarah.j@example.com", phone: "+1 (555) 123-4567", status: "checked-in", invitedAt: "2 hours ago", checkedInAt: "1 hour ago" },
  { id: "2", name: "Michael Chen", email: "m.chen@example.com", phone: "+1 (555) 234-5678", status: "confirmed", invitedAt: "1 day ago" },
  { id: "3", name: "Emily Rodriguez", email: "emily.r@example.com", phone: "+1 (555) 345-6789", status: "pending", invitedAt: "3 days ago" },
  { id: "4", name: "David Kim", email: "david.kim@example.com", phone: "+1 (555) 456-7890", status: "checked-in", invitedAt: "5 hours ago", checkedInAt: "30 min ago" },
];

export default function CustomerTableExample() {
  const handleSendInvite = (id: string) => {
    console.log('Send invite to customer:', id);
  };

  const handleCheckIn = (id: string) => {
    console.log('Check in customer:', id);
  };

  return (
    <CustomerTable 
      customers={mockCustomers} 
      onSendInvite={handleSendInvite}
      onCheckIn={handleCheckIn}
    />
  );
}

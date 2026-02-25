import { useState } from "react";
import { CustomerTable, Customer } from "@/components/CustomerTable";
import { AddCustomerDialog } from "@/components/AddCustomerDialog";
import { ImportCustomersDialog } from "@/components/ImportCustomersDialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const initialCustomers: Customer[] = [
  { id: "1", name: "Sarah Johnson", email: "sarah.j@example.com", phone: "+1 (555) 123-4567", status: "checked-in", invitedAt: "2 hours ago" },
  { id: "2", name: "Michael Chen", email: "m.chen@example.com", phone: "+1 (555) 234-5678", status: "confirmed", invitedAt: "1 day ago" },
  { id: "3", name: "Emily Rodriguez", email: "emily.r@example.com", phone: "+1 (555) 345-6789", status: "pending", invitedAt: "3 days ago" },
  { id: "4", name: "David Kim", email: "david.kim@example.com", phone: "+1 (555) 456-7890", status: "checked-in", invitedAt: "5 hours ago" },
  { id: "5", name: "Jessica Martinez", email: "j.martinez@example.com", phone: "+1 (555) 567-8901", status: "confirmed", invitedAt: "12 hours ago" },
  { id: "6", name: "Robert Taylor", email: "r.taylor@example.com", phone: "+1 (555) 678-9012", status: "pending", invitedAt: "2 days ago" },
  { id: "7", name: "Amanda White", email: "amanda.w@example.com", phone: "+1 (555) 789-0123", status: "checked-in", invitedAt: "30 min ago" },
  { id: "8", name: "James Brown", email: "james.b@example.com", phone: "+1 (555) 890-1234", status: "confirmed", invitedAt: "6 hours ago" },
];

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = useState("");

  const handleAddCustomer = (newCustomer: { name: string; email: string; phone: string }) => {
    const customer: Customer = {
      id: String(customers.length + 1),
      ...newCustomer,
      status: "pending",
    };
    setCustomers([customer, ...customers]);
    console.log('Customer added:', customer);
  };

  const handleImport = (file: File) => {
    console.log('Importing file:', file.name);
  };

  const handleSendInvite = (id: string) => {
    console.log('Send invite to customer:', id);
  };

  const handleCheckIn = (id: string) => {
    console.log('Check in customer:', id);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone ?? "").includes(searchTerm)
  );

  return (
    <div className="space-y-6" data-testid="page-customers">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer list and invitations</p>
        </div>
        <div className="flex gap-2">
          <AddCustomerDialog onAdd={handleAddCustomer} />
          <ImportCustomersDialog onImport={handleImport} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-customers"
        />
      </div>

      <CustomerTable 
        customers={filteredCustomers} 
        onSendInvite={handleSendInvite}
        onCheckIn={handleCheckIn}
      />
    </div>
  );
}

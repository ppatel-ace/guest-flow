import { useState } from "react";
import { CustomerTable, Customer } from "@/components/CustomerTable";
import { AddCustomerDialog } from "@/components/AddCustomerDialog";
import { ImportCustomersDialog } from "@/components/ImportCustomersDialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const initialCustomers: Customer[] = [];

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
          <h1 className="text-3xl font-bold">Invites</h1>
          <p className="text-muted-foreground">Manage your invite list and check-ins</p>
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
          placeholder="Search invites..."
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

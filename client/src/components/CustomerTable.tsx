import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import { Mail, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: "pending" | "confirmed" | "checked-in";
  invitedAt?: string;
  checkedInAt?: string;
}

interface CustomerTableProps {
  customers: Customer[];
  onSendInvite?: (customerId: string) => void;
  onCheckIn?: (customerId: string) => void;
}

export function CustomerTable({ customers, onSendInvite, onCheckIn }: CustomerTableProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invited</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{getInitials(customer.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium" data-testid={`text-customer-name-${customer.id}`}>{customer.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div data-testid={`text-customer-email-${customer.id}`}>{customer.email}</div>
                  <div className="text-muted-foreground" data-testid={`text-customer-phone-${customer.id}`}>{customer.phone}</div>
                </div>
              </TableCell>
              <TableCell>
                <CustomerStatusBadge status={customer.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {customer.invitedAt || "Not sent"}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-actions-${customer.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onSendInvite?.(customer.id)} data-testid={`button-send-invite-${customer.id}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invite
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCheckIn?.(customer.id)} data-testid={`button-check-in-${customer.id}`}>
                      Check In
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

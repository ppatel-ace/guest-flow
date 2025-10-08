import { Badge } from "@/components/ui/badge";

type CustomerStatus = "pending" | "confirmed" | "checked-in";

interface CustomerStatusBadgeProps {
  status: CustomerStatus;
}

const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  "checked-in": {
    label: "Checked In",
    className: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  },
};

export function CustomerStatusBadge({ status }: CustomerStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant="outline" 
      className={config.className}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

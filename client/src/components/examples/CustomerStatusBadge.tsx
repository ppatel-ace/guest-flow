import { CustomerStatusBadge } from '../CustomerStatusBadge';

export default function CustomerStatusBadgeExample() {
  return (
    <div className="flex gap-2">
      <CustomerStatusBadge status="pending" />
      <CustomerStatusBadge status="confirmed" />
      <CustomerStatusBadge status="checked-in" />
    </div>
  );
}

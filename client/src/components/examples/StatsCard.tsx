import { StatsCard } from '../StatsCard';
import { Users, CheckCircle, Mail, Clock } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard title="Total Customers" value="248" icon={Users} description="+12 from last week" />
      <StatsCard title="Checked In" value="142" icon={CheckCircle} description="Today's visitors" />
      <StatsCard title="Invites Sent" value="195" icon={Mail} description="This month" />
      <StatsCard title="Pending" value="53" icon={Clock} description="Awaiting check-in" />
    </div>
  );
}

import { CheckInSearch } from '../CheckInSearch';

export default function CheckInSearchExample() {
  const handleCheckIn = (customerId: string) => {
    console.log('Checking in customer:', customerId);
  };

  return <CheckInSearch onCheckIn={handleCheckIn} />;
}

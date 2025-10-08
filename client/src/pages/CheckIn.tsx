import { QRScannerInterface } from "@/components/QRScannerInterface";
import { CheckInSearch } from "@/components/CheckInSearch";

export default function CheckIn() {
  const handleQRScan = (qrData: string) => {
    console.log('QR Code scanned:', qrData);
  };

  const handleCheckIn = (customerId: string) => {
    console.log('Checking in customer:', customerId);
  };

  return (
    <div className="space-y-6" data-testid="page-check-in">
      <div>
        <h1 className="text-3xl font-bold">Check-In</h1>
        <p className="text-muted-foreground">Scan QR codes or search by phone number</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <QRScannerInterface onScan={handleQRScan} />
        <CheckInSearch onCheckIn={handleCheckIn} />
      </div>
    </div>
  );
}

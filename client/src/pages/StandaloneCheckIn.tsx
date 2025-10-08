import { QRScannerInterface } from "@/components/QRScannerInterface";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function StandaloneCheckIn() {
  const handleQRScan = (qrData: string) => {
    console.log('QR Code scanned:', qrData);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Customer Check-In</h1>
        <ThemeToggle />
      </header>
      <main className="container mx-auto p-6 max-w-2xl">
        <QRScannerInterface onScan={handleQRScan} />
      </main>
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Camera } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QRScannerInterfaceProps {
  onScan?: (qrData: string) => void;
}

export function QRScannerInterface({ onScan }: QRScannerInterfaceProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const handleStartScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const mockQRData = `CUSTOMER_${Date.now()}`;
      setLastScanned(mockQRData);
      onScan?.(mockQRData);
      setIsScanning(false);
    }, 2000);
  };

  return (
    <Card data-testid="card-qr-scanner">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR Code Scanner
        </CardTitle>
        <CardDescription>
          Scan customer QR codes for quick check-in
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
          {isScanning ? (
            <div className="text-center">
              <div className="animate-pulse">
                <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Scanning...</p>
              </div>
              <div className="absolute inset-0 border-4 border-primary/30 animate-pulse"></div>
            </div>
          ) : (
            <div className="text-center">
              <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Ready to scan</p>
            </div>
          )}
        </div>

        {lastScanned && !isScanning && (
          <Alert>
            <AlertDescription data-testid="text-last-scanned">
              Last scanned: {lastScanned}
            </AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          onClick={handleStartScan}
          disabled={isScanning}
          data-testid="button-start-scan"
        >
          {isScanning ? "Scanning..." : "Start Scanner"}
        </Button>
      </CardContent>
    </Card>
  );
}

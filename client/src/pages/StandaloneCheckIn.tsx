import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoPath from "@assets/Blue AEDS_1760039981304.png";

export default function StandaloneCheckIn() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    const checkInUrl = `${window.location.origin}/guest-check-in`;
    
    fetch(`/api/generate-qr?url=${encodeURIComponent(checkInUrl)}`)
      .then(res => res.json())
      .then(data => setQrCodeUrl(data.qrCode))
      .catch(err => console.error('Failed to generate QR code:', err));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <img src={logoPath} alt="Ace Electronics Defense Systems" className="h-12 w-auto" data-testid="img-logo" />
        <ThemeToggle />
      </header>
      <main className="container mx-auto p-6 max-w-4xl">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-3xl">Welcome!</CardTitle>
            <CardDescription className="text-lg">
              Please scan the QR code with your phone to check in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="Check-in QR Code" 
                  className="w-80 h-80 border-4 border-border rounded-lg"
                  data-testid="img-qr-code"
                />
              ) : (
                <div className="w-80 h-80 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Loading QR Code...</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium">How to Check In:</p>
              <ol className="text-muted-foreground space-y-1 text-left max-w-md mx-auto">
                <li>1. Open your phone's camera</li>
                <li>2. Point it at the QR code above</li>
                <li>3. Tap the notification to open the link</li>
                <li>4. Enter your phone number or email to check in</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6 border-b">
        <div className="flex-1" />
        <a href="https://www.aceelectronics.com/" target="_blank" rel="noopener noreferrer" data-testid="link-logo">
          <img src={logoPath} alt="Ace Electronics Defense Systems" className="h-24 sm:h-28 md:h-32 lg:h-36 w-auto mx-auto" data-testid="img-logo" />
        </a>
        <div className="flex-1 flex justify-end">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 sm:p-6 max-w-4xl">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl md:text-4xl">Welcome!</CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Please scan the QR code with your phone to check in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="flex justify-center">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="Check-in QR Code" 
                  className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 border-4 border-border rounded-lg"
                  data-testid="img-qr-code"
                />
              ) : (
                <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Loading QR Code...</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-base sm:text-lg font-medium">How to Check In:</p>
              <ol className="text-sm sm:text-base text-muted-foreground space-y-1 text-left max-w-md mx-auto px-4">
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

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import logoPath from "@assets/Blue AEDS_1760039981304.png";
import type { PageSettings } from "@shared/schema";

function useQRWithLogo(qrDataUrl: string, logoSrc: string): string {
  const [composited, setComposited] = useState("");

  useEffect(() => {
    if (!qrDataUrl) return;

    const canvas = document.createElement("canvas");
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 0, 0, size, size);

      const logo = new Image();
      logo.onload = () => {
        const logoSize = size * 0.22;
        const x = (size - logoSize) / 2;
        const y = (size - logoSize) / 2;
        const padding = 8;
        const radius = 10;

        // White rounded-rect background behind logo
        ctx.beginPath();
        ctx.moveTo(x - padding + radius, y - padding);
        ctx.lineTo(x + logoSize + padding - radius, y - padding);
        ctx.quadraticCurveTo(x + logoSize + padding, y - padding, x + logoSize + padding, y - padding + radius);
        ctx.lineTo(x + logoSize + padding, y + logoSize + padding - radius);
        ctx.quadraticCurveTo(x + logoSize + padding, y + logoSize + padding, x + logoSize + padding - radius, y + logoSize + padding);
        ctx.lineTo(x - padding + radius, y + logoSize + padding);
        ctx.quadraticCurveTo(x - padding, y + logoSize + padding, x - padding, y + logoSize + padding - radius);
        ctx.lineTo(x - padding, y - padding + radius);
        ctx.quadraticCurveTo(x - padding, y - padding, x - padding + radius, y - padding);
        ctx.closePath();
        ctx.fillStyle = "white";
        ctx.fill();

        // Draw logo in grayscale
        ctx.filter = "grayscale(1)";
        ctx.drawImage(logo, x, y, logoSize, logoSize);
        ctx.filter = "none";

        setComposited(canvas.toDataURL("image/png"));
      };
      logo.src = logoSrc;
    };
    qrImg.src = qrDataUrl;
  }, [qrDataUrl, logoSrc]);

  return composited;
}

export default function StandaloneCheckIn() {
  const [rawQrUrl, setRawQrUrl] = useState<string>("");

  const { data: settings, isLoading: settingsLoading } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/scan_page"],
  });

  useEffect(() => {
    const checkInUrl = `${window.location.origin}/guest-check-in`;
    fetch(`/api/generate-qr?url=${encodeURIComponent(checkInUrl)}`)
      .then(res => res.json())
      .then(data => setRawQrUrl(data.qrCode))
      .catch(err => console.error("Failed to generate QR code:", err));
  }, []);

  const qrCodeUrl = useQRWithLogo(rawQrUrl, logoPath);

  const title = settings?.title ?? "Welcome!";
  const description = settings?.description ?? "Please scan the QR code with your phone to check in";

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
            {settingsLoading ? (
              <>
                <Skeleton className="h-9 w-48 mx-auto mb-2" />
                <Skeleton className="h-5 w-72 mx-auto" />
              </>
            ) : (
              <>
                <CardTitle className="text-2xl sm:text-3xl md:text-4xl">{title}</CardTitle>
                <CardDescription className="text-base sm:text-lg">{description}</CardDescription>
              </>
            )}
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
                <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-muted rounded-lg flex items-center justify-center" data-testid="img-qr-code">
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

import { useState } from "react";
import { QRScannerInterface } from "@/components/QRScannerInterface";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CheckIn() {
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [scannedQR, setScannedQR] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const handleQRScan = (qrData: string) => {
    console.log('QR Code scanned:', qrData);
    setScannedQR(qrData);
    setShowCustomerForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Customer checked in:', {
      qrCode: scannedQR,
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    });
    
    setShowCustomerForm(false);
    setScannedQR(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
  };

  return (
    <div className="h-full flex items-center justify-center" data-testid="page-check-in">
      <div className="w-full max-w-2xl">
        <QRScannerInterface onScan={handleQRScan} />
      </div>

      <Dialog open={showCustomerForm} onOpenChange={setShowCustomerForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer Information</DialogTitle>
            <DialogDescription>
              Please enter customer details to complete check-in
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Full Name</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Doe"
                required
                data-testid="input-customer-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email Address</Label>
              <Input
                id="customer-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@example.com"
                required
                data-testid="input-customer-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone Number</Label>
              <Input
                id="customer-phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                required
                data-testid="input-customer-phone"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCustomerForm(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="button-submit-checkin">
                Complete Check-In
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

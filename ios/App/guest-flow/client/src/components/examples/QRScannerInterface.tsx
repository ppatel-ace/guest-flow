import { QRScannerInterface } from '../QRScannerInterface';

export default function QRScannerInterfaceExample() {
  const handleScan = (qrData: string) => {
    console.log('QR Code scanned:', qrData);
  };

  return <QRScannerInterface onScan={handleScan} />;
}

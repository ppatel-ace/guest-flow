import Capacitor
import BRLMPrinterKit
import UIKit

@objc(BrotherPrintPlugin)
public class BrotherPrintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BrotherPrintPlugin"
    public let jsName = "BrotherPrint"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "printLabel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPairedPrinters", returnType: CAPPluginReturnPromise),
    ]

    @objc func printLabel(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? ""
        let company = call.getString("company") ?? ""
        let date = call.getString("date") ?? ""

        DispatchQueue.global(qos: .userInitiated).async {
            // QL-820NWB uses classic MFi Bluetooth (not BLE).
            // Pair in iPad Settings → Bluetooth and wait until status is Connected.
            let searchResult = BRLMPrinterSearcher.startBluetoothSearch()
            guard let found = searchResult.channels.first else {
                call.reject("No paired Brother printer found. On the iPad go to Settings → Bluetooth, pair QL-820NWB, wait until it says Connected, then try again.")
                return
            }

            guard let image = self.renderLabel(name: name, company: company, date: date) else {
                call.reject("Failed to render label image.")
                return
            }

            let tmpURL = URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("brother_label.png")
            guard let pngData = image.pngData() else {
                call.reject("Failed to encode label image.")
                return
            }
            do {
                try pngData.write(to: tmpURL)
            } catch {
                call.reject("Failed to write temp image: \(error.localizedDescription)")
                return
            }

            // Try searched channel, then rebuild from Bluetooth local name (EA session).
            var channels: [BRLMChannel] = [found]
            let localName = found.channelInfo
            if !localName.isEmpty {
                channels.append(BRLMChannel(bluetoothLocalName: localName))
            }

            var driver: BRLMPrinterDriver?
            var lastCode: Int = -1
            for channel in channels {
                // External Accessory sessions are more reliable on the main thread.
                let opened = self.openPrinterOnMain(channel: channel)
                lastCode = opened.code
                if let d = opened.driver {
                    driver = d
                    break
                }
                Thread.sleep(forTimeInterval: 0.4)
            }

            guard let driver else {
                call.reject(self.openChannelHelpMessage(code: lastCode))
                return
            }
            defer { driver.closeChannel() }

            let settings = BRLMQLPrintSettings(defaultPrintSettingsWith: .QL_820NWB)
            settings?.autoCut = true
            settings?.labelSize = .rollW62
            guard let s = settings else {
                call.reject("Failed to create print settings.")
                return
            }

            let printErr = driver.printImage(with: tmpURL, settings: s)
            if printErr.code == .noError {
                call.resolve()
            } else {
                call.reject("Print failed, error code: \(printErr.code.rawValue)")
            }
        }
    }

    /// Open MFi channel on the main thread (required for External Accessory stability).
    private func openPrinterOnMain(channel: BRLMChannel) -> (driver: BRLMPrinterDriver?, code: Int) {
        var driver: BRLMPrinterDriver?
        var code = -1
        let sem = DispatchSemaphore(value: 0)
        DispatchQueue.main.async {
            let result = BRLMPrinterDriverGenerator.open(channel)
            code = result.error.code.rawValue
            if result.error.code == .noError {
                driver = result.driver
            }
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 15)
        return (driver, code)
    }

    private func openChannelHelpMessage(code: Int) -> String {
        if code == 30001 {
            return "Printer found but Bluetooth stream failed (30001). On the iPad: Settings → Bluetooth → forget QL-820NWB → pair again → wait until it says Connected (not Not Connected). Close Brother iPrint&Label if open, keep the printer near the iPad, then retry."
        }
        return "Could not open printer channel: \(code)"
    }

    @objc func getPairedPrinters(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            let result = BRLMPrinterSearcher.startBluetoothSearch()
            let count = result.channels.count
            call.resolve(["count": count, "found": count > 0])
        }
    }

    /// 62 mm continuous label at 300 dpi ≈ 696 × 200 px
    private func renderLabel(name: String, company: String, date: String) -> UIImage? {
        let size = CGSize(width: 696, height: 200)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { _ in
            UIColor.white.setFill()
            UIRectFill(CGRect(origin: .zero, size: size))

            let left = self.paragraphStyle(.left)
            let right = self.paragraphStyle(.right)

            name.draw(
                in: CGRect(x: 20, y: 16, width: 656, height: 60),
                withAttributes: [
                    .font: UIFont.boldSystemFont(ofSize: 46),
                    .foregroundColor: UIColor.black,
                    .paragraphStyle: left,
                ]
            )

            if !company.isEmpty {
                company.draw(
                    in: CGRect(x: 20, y: 84, width: 656, height: 50),
                    withAttributes: [
                        .font: UIFont.systemFont(ofSize: 32, weight: .medium),
                        .foregroundColor: UIColor.darkGray,
                        .paragraphStyle: left,
                    ]
                )
            }

            date.draw(
                in: CGRect(x: 20, y: 158, width: 656, height: 30),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 22),
                    .foregroundColor: UIColor.gray,
                    .paragraphStyle: right,
                ]
            )

            UIColor.black.setStroke()
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 696, y: 0))
            path.lineWidth = 3
            path.stroke()
        }
    }

    private func paragraphStyle(_ alignment: NSTextAlignment) -> NSMutableParagraphStyle {
        let p = NSMutableParagraphStyle()
        p.alignment = alignment
        return p
    }
}

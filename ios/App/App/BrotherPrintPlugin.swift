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
            // Pair the printer in iPad Settings → Bluetooth first, then search.
            let searchResult = BRLMPrinterSearcher.startBluetoothSearch()
            guard let channel = searchResult.channels.first else {
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

            let openResult = BRLMPrinterDriverGenerator.open(channel)
            guard openResult.error.code == .noError, let driver = openResult.driver else {
                call.reject("Could not open printer channel: \(openResult.error.code.rawValue)")
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

import Capacitor
import BRLMPrinterKit
import UIKit

@objc(BrotherPrintPlugin)
public class BrotherPrintPlugin: CAPPlugin {

    // MARK: - printLabel

    @objc func printLabel(_ call: CAPPluginCall) {
        let name    = call.getString("name")    ?? ""
        let company = call.getString("company") ?? ""
        let date    = call.getString("date")    ?? ""

        DispatchQueue.global(qos: .userInitiated).async {
            // 1. Find the first paired MFi (Classic Bluetooth) Brother printer
            guard let channel = self.findChannel() else {
                call.reject("No paired Brother printer found. Please pair the QL-820NWB in iOS Settings → Bluetooth first.")
                return
            }

            // 2. Render the label as a bitmap image
            guard let image = self.renderLabel(name: name, company: company, date: date) else {
                call.reject("Failed to render label image.")
                return
            }

            // 3. Open the channel and print
            let openResult = BRLMPrinterDriverGenerator.open(channel)
            guard openResult.error.code == .noError, let driver = openResult.driver else {
                call.reject("Could not open printer channel: \(openResult.error.code.rawValue)")
                return
            }
            defer { driver.closeChannel() }

            let settings = BRLMQLPrintSettings(defaultPrintSettingsWith: .QL_820NWB)
            settings?.autoCut    = true
            settings?.labelSize  = .rollW62

            guard let s = settings else {
                call.reject("Failed to create print settings.")
                return
            }

            let printErr = driver.printImage(with: image, settings: s)
            if printErr.code == .noError {
                call.resolve()
            } else {
                call.reject("Print error code: \(printErr.code.rawValue)")
            }
        }
    }

    // MARK: - getPairedPrinters

    @objc func getPairedPrinters(_ call: CAPPluginCall) {
        let channels = BRLMChannel.availableChannels(with: .bluetoothMFi) ?? []
        let names = channels.compactMap { ($0 as? BRLMChannel)?.channelInfo }
        call.resolve(["printers": names])
    }

    // MARK: - Private helpers

    private func findChannel() -> BRLMChannel? {
        let channels = BRLMChannel.availableChannels(with: .bluetoothMFi) ?? []
        return channels.first as? BRLMChannel
    }

    /// Renders a 62 mm label (696 × 200 px at 300 dpi) with name / company / date.
    private func renderLabel(name: String, company: String, date: String) -> UIImage? {
        let size = CGSize(width: 696, height: 200)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            // White background
            UIColor.white.setFill()
            UIRectFill(CGRect(origin: .zero, size: size))

            let left = NSMutableParagraphStyle()
            left.alignment = .left

            let right = NSMutableParagraphStyle()
            right.alignment = .right

            // Visitor name — large bold
            name.draw(
                in: CGRect(x: 20, y: 16, width: 656, height: 60),
                withAttributes: [
                    .font: UIFont.boldSystemFont(ofSize: 46),
                    .foregroundColor: UIColor.black,
                    .paragraphStyle: left,
                ]
            )

            // Company — medium weight
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

            // Date — small, right-aligned, bottom
            date.draw(
                in: CGRect(x: 20, y: 158, width: 656, height: 30),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 22),
                    .foregroundColor: UIColor.gray,
                    .paragraphStyle: right,
                ]
            )

            // Thin top border for visual separation
            UIColor.black.setStroke()
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 696, y: 0))
            path.lineWidth = 3
            path.stroke()
        }
    }
}

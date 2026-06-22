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
            self.findBLEChannel { channel in
                guard let channel = channel else {
                    call.reject("No Brother printer found via Bluetooth. Make sure the QL-820NWB is powered on and in range.")
                    return
                }

                guard let image = self.renderLabel(name: name, company: company, date: date) else {
                    call.reject("Failed to render label image.")
                    return
                }

                let openResult = BRLMPrinterDriverGenerator.open(channel)
                guard openResult.error.code == .noError, let driver = openResult.driver else {
                    call.reject("Could not open printer channel: \(openResult.error.code.rawValue)")
                    return
                }
                defer { driver.closeChannel() }

                let settings = BRLMQLPrintSettings(defaultPrintSettingsWith: .QL_820NWB)
                settings?.autoCut   = true
                settings?.labelSize = .rollW62

                guard let s = settings else {
                    call.reject("Failed to create print settings.")
                    return
                }

                let printErr = driver.printImage(with: image, settings: s)
                if printErr.code == .noError {
                    call.resolve()
                } else {
                    call.reject("Print failed, error code: \(printErr.code.rawValue)")
                }
            }
        }
    }

    // MARK: - getPairedPrinters

    @objc func getPairedPrinters(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            // Quick 5-second scan for BLE Brother printers
            let channels = BRLMChannel.availableChannels(with: .bluetoothLowEnergy) ?? []
            let count = channels.count
            call.resolve(["count": count, "found": count > 0])
        }
    }

    // MARK: - BLE channel discovery

    /// Tries immediate BLE channel list first (fast); falls back to a 10-second
    /// active BLE scan if nothing is cached yet.
    private func findBLEChannel(completion: @escaping (BRLMChannel?) -> Void) {
        // 1. Try already-cached BLE channels (works when printer stays connected)
        let cached = BRLMChannel.availableChannels(with: .bluetoothLowEnergy) ?? []
        if let ch = cached.first as? BRLMChannel {
            completion(ch)
            return
        }

        // 2. Active scan with 10-second timeout
        var resolved = false
        let lock = NSLock()

        func resolve(_ ch: BRLMChannel?) {
            lock.lock()
            defer { lock.unlock() }
            guard !resolved else { return }
            resolved = true
            completion(ch)
        }

        BRLMPrinterSearcher.startBLESearch({ channel, _ in
            if let ch = channel {
                resolve(ch)
            }
        }, timeout: 10)

        // Safety timeout — ensure completion is always called
        DispatchQueue.global().asyncAfter(deadline: .now() + 12) {
            resolve(nil)
        }
    }

    // MARK: - Label rendering

    /// 62 mm continuous label at 300 dpi ≈ 696 × 200 px
    private func renderLabel(name: String, company: String, date: String) -> UIImage? {
        let size = CGSize(width: 696, height: 200)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { _ in
            UIColor.white.setFill()
            UIRectFill(CGRect(origin: .zero, size: size))

            let left  = paragraphStyle(.left)
            let right = paragraphStyle(.right)

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

            // Date — small, right-aligned
            date.draw(
                in: CGRect(x: 20, y: 158, width: 656, height: 30),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 22),
                    .foregroundColor: UIColor.gray,
                    .paragraphStyle: right,
                ]
            )

            // Top border line
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

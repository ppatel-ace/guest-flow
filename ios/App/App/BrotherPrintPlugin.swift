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
            BLESearchHelper.findChannel { channel in
                guard let channel = channel else {
                    call.reject("No Brother printer found via Bluetooth. Make sure the QL-820NWB is powered on and in range.")
                    return
                }

                guard let image = self.renderLabel(name: name, company: company, date: date) else {
                    call.reject("Failed to render label image.")
                    return
                }

                // BRLMPrinterKit requires a file URL — save UIImage to a temp PNG
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
                settings?.autoCut   = true
                settings?.labelSize = .rollW62

                guard let s = settings else {
                    call.reject("Failed to create print settings.")
                    return
                }

                let printErr = driver.printImage(from: tmpURL, settings: s)
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
            BLESearchHelper.findChannel { channel in
                let found = channel != nil
                call.resolve(["count": found ? 1 : 0, "found": found])
            }
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

// MARK: - BLE search helper (delegate-based, isolated to avoid retain cycles)

private class BLESearchHelper: NSObject, BRLMPrinterSearcherDelegate {

    private var completion: (BRLMChannel?) -> Void
    private var resolved = false
    private var searcher: BRLMPrinterSearcher?

    private init(completion: @escaping (BRLMChannel?) -> Void) {
        self.completion = completion
    }

    static func findChannel(completion: @escaping (BRLMChannel?) -> Void) {
        let helper = BLESearchHelper(completion: completion)
        DispatchQueue.main.async {
            let option = BRLMBLESearchOption()
            helper.searcher = BRLMPrinterSearcher.startBLESearch(option, delegate: helper)
            // Keep helper alive until search resolves
            objc_setAssociatedObject(helper.searcher as Any,
                                     "helperKey",
                                     helper,
                                     .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
        // Hard safety timeout
        DispatchQueue.global().asyncAfter(deadline: .now() + 15) {
            helper.resolve(nil)
        }
    }

    func didFindPrinter(_ channel: BRLMChannel!) {
        resolve(channel)
    }

    func didFinishSearch(_ error: Error!) {
        resolve(nil)
    }

    private func resolve(_ channel: BRLMChannel?) {
        guard !resolved else { return }
        resolved = true
        completion(channel)
    }
}

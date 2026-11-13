import Foundation
import ActivityKit

struct PickupRow: Codable, Hashable {
    let station: String
    let code: String
}
struct PickupSnapshot: Codable {
    let count: Int
    let rows: [PickupRow]
    let updatedAt: Date
    let validUntil: Date
    let showCodes: Bool
    static let empty = PickupSnapshot(count: 0, rows: [], updatedAt: .distantPast,
                                     validUntil: .distantPast, showCodes: false)
}
enum PickupStorage {
    static var hostURL: URL {
        Bundle.main.bundleURL.pathExtension == "appex"
            ? Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent() : Bundle.main.bundleURL
    }
    static var extensionURL: URL { hostURL.appendingPathComponent("PlugIns/MashangquWidgets.appex") }
    static var resolution: (url: URL?, source: String) {
        let manager = FileManager.default
        let configured = Bundle.main.object(forInfoDictionaryKey: "MSQAppGroup") as? String ?? "group.ink.mashangqu.ios"
        if let url = manager.containerURL(forSecurityApplicationGroupIdentifier: configured) { return (url, "configured") }
        // Re-signers may replace App Group entitlements. Use only groups common to BOTH profiles;
        // iOS must still grant this process access to the selected group.
        if let host = ProvisioningSupport.read(bundleURL: hostURL),
           let widget = ProvisioningSupport.read(bundleURL: extensionURL) {
            let common = ProvisioningSupport.groups(host).intersection(ProvisioningSupport.groups(widget)).sorted()
            for group in common {
                if let url = manager.containerURL(forSecurityApplicationGroupIdentifier: group) { return (url, "profile") }
            }
        }
        return (nil, "unavailable")
    }
    static var file: URL? { resolution.url?.appendingPathComponent("pickup-widget-v1.json") }
    static func read() -> PickupSnapshot {
        guard let file, let bytes = try? Data(contentsOf: file),
              let value = try? JSONDecoder().decode(PickupSnapshot.self, from: bytes) else { return .empty }
        return value
    }
}
@available(iOS 16.2, *)
struct PickupActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let station: String
        let code: String
        let remaining: Int
        let updatedAt: Date
        let validUntil: Date
    }
    // Do not put account IDs, credentials, or waybill numbers in activity data.
    let title: String
}

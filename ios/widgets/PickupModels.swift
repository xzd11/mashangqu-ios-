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
    // Both targets and their provisioning profiles must use the same App Group.
    static var group: String {
        Bundle.main.object(forInfoDictionaryKey: "MSQAppGroup") as? String ?? "group.ink.mashangqu.ios"
    }
    static var file: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appendingPathComponent("pickup-widget-v1.json")
    }
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

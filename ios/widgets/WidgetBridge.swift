import Foundation
import ActivityKit
import WidgetKit
import UIKit

@objc(MSQWidgetBridge)
final class MSQWidgetBridge: NSObject {
    @objc(perform:completion:)
    static func perform(_ args: NSDictionary, completion: @escaping (NSDictionary?, NSString?) -> Void) {
        Task { @MainActor in
            do {
                let action = args["action"] as? String ?? "status"
                switch action {
                case "status": break
                case "sync":
                    try writeSnapshot(args)
                    if #available(iOS 16.2, *) { await synchronizeActivity(args) }
                case "start":
                    guard #available(iOS 16.2, *) else { throw failure("实时活动需要 iOS 16.2 或更高版本") }
                    guard UIApplication.shared.applicationState == .active else { throw failure("请在应用前台开始取件") }
                    guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw failure("请先在系统设置中允许码上取使用实时活动") }
                    guard let active = args["active"] as? NSDictionary else { throw failure("请先选择待取包裹") }
                    let state = content(active, count: args["count"] as? Int ?? 0)
                    guard state.remaining > 0 else { throw failure("暂无待取包裹") }
                    // One pickup activity at a time; also clean up a previous process's activity.
                    await endActivities()
                    _ = try Activity<PickupActivityAttributes>.request(
                        attributes: PickupActivityAttributes(title: "码上取 · 正在取件"),
                        content: ActivityContent(state: state, staleDate: state.validUntil), pushType: nil)
                case "end":
                    if #available(iOS 16.2, *) { await endActivities() }
                default: throw failure("未知小组件操作")
                }
                var status: [String: Any] = ["supported": true, "widgetReady": PickupStorage.file != nil,
                                            "liveSupported": false, "liveEnabled": false, "active": false]
                if #available(iOS 16.2, *) {
                    status["liveSupported"] = true
                    status["liveEnabled"] = ActivityAuthorizationInfo().areActivitiesEnabled
                    status["active"] = !Activity<PickupActivityAttributes>.activities.isEmpty
                }
                completion(status as NSDictionary, nil)
            } catch { completion(nil, error.localizedDescription as NSString) }
        }
    }
    private static func failure(_ message: String) -> NSError {
        NSError(domain: "Mashangqu.Widgets", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
    private static func short(_ value: Any?, limit: Int) -> String {
        String((value as? String ?? "").filter { !$0.isNewline && !$0.isASCIIControl }.prefix(limit))
    }
    private static func writeSnapshot(_ args: NSDictionary) throws {
        // Sharing is optional: unavailable App Group must not break account saves or Live Activities.
        guard let file = PickupStorage.file else { return }
        let show = args["showCodes"] as? Bool == true
        let rows = (args["rows"] as? [NSDictionary] ?? []).prefix(8).map {
            PickupRow(station: short($0["station"], limit: 80), code: show ? short($0["code"], limit: 40) : "")
        }
        let now = Date()
        let source = (args["updatedAt"] as? Double ?? 0) / 1000
        let updated = source.isFinite && source > 0 ? min(Date(timeIntervalSince1970: source), now) : .distantPast
        let snapshot = PickupSnapshot(count: max(0, min(args["count"] as? Int ?? 0, 9999)), rows: Array(rows),
                                      updatedAt: updated, validUntil: updated.addingTimeInterval(900), showCodes: show)
        let bytes = try JSONEncoder().encode(snapshot)
        try bytes.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        WidgetCenter.shared.reloadTimelines(ofKind: "MashangquPickup")
    }
    @available(iOS 16.2, *)
    private static func content(_ active: NSDictionary, count: Int) -> PickupActivityAttributes.ContentState {
        let raw = (active["updatedAt"] as? Double ?? 0) / 1000
        let updated = raw.isFinite && raw > 0 ? min(Date(timeIntervalSince1970: raw), Date()) : .distantPast
        return .init(station: short(active["station"], limit: 80), code: short(active["code"], limit: 40),
                     remaining: max(0, min(count, 9999)), updatedAt: updated,
                     validUntil: updated.addingTimeInterval(900))
    }
    @available(iOS 16.2, *)
    private static func synchronizeActivity(_ args: NSDictionary) async {
        guard let active = args["active"] as? NSDictionary, (args["count"] as? Int ?? 0) > 0 else {
            await endActivities(); return
        }
        let state = content(active, count: args["count"] as? Int ?? 0)
        for activity in Activity<PickupActivityAttributes>.activities {
            await activity.update(ActivityContent(state: state, staleDate: state.validUntil))
        }
    }
    @available(iOS 16.2, *)
    private static func endActivities() async {
        for activity in Activity<PickupActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
private extension Character {
    var isASCIIControl: Bool { unicodeScalars.contains { $0.value < 32 || $0.value == 127 } }
}

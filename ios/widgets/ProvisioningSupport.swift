import Foundation

// Reads only a few configuration fields, never credentials or device lists.
// This is NOT a signature verifier. containerURL still asks iOS to enforce the signed entitlement.
enum ProvisioningSupport {
    static func entitlements(in data: Data) -> [String: Any]? {
        guard data.count <= 10_000_000,
              let start = data.range(of: Data("<plist".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex),
              let plist = try? PropertyListSerialization.propertyList(
                from: data.subdata(in: start.lowerBound..<end.upperBound), options: [], format: nil) as? [String: Any]
        else { return nil }
        return plist["Entitlements"] as? [String: Any]
    }
    static func read(bundleURL: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: bundleURL.appendingPathComponent("embedded.mobileprovision")) else { return nil }
        return entitlements(in: data)
    }
    static func groups(_ entitlements: [String: Any]) -> Set<String> {
        Set((entitlements["com.apple.security.application-groups"] as? [String] ?? []).filter {
            $0.hasPrefix("group.") && $0.count <= 255 && !$0.contains(where: { $0.isWhitespace || $0.isNewline })
        })
    }
    static func permits(bundleID: String, entitlements: [String: Any]) -> Bool? {
        guard let appID = entitlements["application-identifier"] as? String,
              let dot = appID.firstIndex(of: ".") else { return nil }
        let allowed = String(appID[appID.index(after: dot)...])
        if allowed == "*" { return true }
        if allowed.hasSuffix(".*") {
            let prefix = String(allowed.dropLast())
            return bundleID.hasPrefix(prefix) && bundleID.count > prefix.count
        }
        return allowed == bundleID
    }
}

import Foundation

@main struct ProfileChecks {
    static func main() throws {
        let ent: [String: Any] = ["application-identifier": "TESTTEAM.ink.mashangqu.ios", "com.apple.security.application-groups": ["group.fixture.shared", "group.fixture.second"]]
        let xml = try PropertyListSerialization.data(fromPropertyList: ["Entitlements": ent], format: .xml, options: 0)
        let wrapped = Data([0x30, 0x82, 0x01, 0x00]) + xml + Data([0, 0, 0])
        guard let parsed = ProvisioningSupport.entitlements(in: wrapped) else { fatalError("Cannot parse embedded profile") }
        precondition(ProvisioningSupport.groups(parsed) == Set(["group.fixture.shared", "group.fixture.second"]))
        precondition(ProvisioningSupport.permits(bundleID: "ink.mashangqu.ios", entitlements: parsed) == true)
        precondition(ProvisioningSupport.permits(bundleID: "ink.mashangqu.ios.widgets", entitlements: parsed) == false)
        var wildcard = ent; wildcard["application-identifier"] = "TESTTEAM.ink.mashangqu.*"
        precondition(ProvisioningSupport.permits(bundleID: "ink.mashangqu.ios.widgets", entitlements: wildcard) == true)
        precondition(ProvisioningSupport.permits(bundleID: "ink.other", entitlements: wildcard) == false)
        precondition(ProvisioningSupport.groups(parsed).intersection(["group.fixture.shared", "group.different"]) == ["group.fixture.shared"])
        precondition(ProvisioningSupport.entitlements(in: Data("malformed".utf8)) == nil)
        precondition(ProvisioningSupport.groups(["com.apple.security.application-groups": ["bad", "group.bad name", "group.good"]]) == ["group.good"])
        print("Profile checks passed: embedded XML, common groups, explicit/wildcard IDs, malformed data and invalid group names")
    }
}

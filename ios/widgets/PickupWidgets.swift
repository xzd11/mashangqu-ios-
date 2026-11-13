import WidgetKit
import SwiftUI
import ActivityKit

struct PickupEntry: TimelineEntry {
    let date: Date
    let snapshot: PickupSnapshot
}
struct PickupProvider: TimelineProvider {
    func placeholder(in context: Context) -> PickupEntry {
        .init(date: Date(), snapshot: .init(count: 2, rows: [.init(station: "校园驿站", code: "")],
                                          updatedAt: Date(), validUntil: Date().addingTimeInterval(900), showCodes: false))
    }
    func getSnapshot(in context: Context, completion: @escaping (PickupEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : .init(date: Date(), snapshot: PickupStorage.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PickupEntry>) -> Void) {
        let now = Date(), snapshot = PickupStorage.read()
        var entries = [PickupEntry(date: now, snapshot: snapshot)]
        // Hide codes at expiry even when the system delays the next provider reload.
        if snapshot.validUntil > now { entries.append(.init(date: snapshot.validUntil, snapshot: snapshot)) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(1800))))
    }
}
struct WidgetSurface<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        if #available(iOS 17.0, *) { content.containerBackground(.fill.tertiary, for: .widget) }
        else { content.padding().background(Color(uiColor: .secondarySystemBackground)) }
    }
}
struct PickupWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PickupEntry
    private var fresh: Bool { entry.date < entry.snapshot.validUntil }
    var body: some View {
        WidgetSurface {
            VStack(alignment: .leading, spacing: 8) {
                Label("码上取", systemImage: "shippingbox.fill").font(.caption).foregroundStyle(.indigo)
                HStack(alignment: .firstTextBaseline) {
                    Text("\(entry.snapshot.count)").font(.system(size: 32, weight: .bold, design: .rounded))
                    Text("件待取").font(.caption).foregroundStyle(.secondary)
                }
                ForEach(Array(entry.snapshot.rows.prefix(family == .systemSmall ? 1 : 3).enumerated()), id: \.offset) { _, row in
                    HStack {
                        Text(row.station.isEmpty ? "待取包裹" : row.station).lineLimit(1)
                        Spacer(minLength: 4)
                        Text(fresh && entry.snapshot.showCodes && !row.code.isEmpty ? row.code : "••••")
                            .monospacedDigit().fontWeight(.semibold).lineLimit(1).minimumScaleFactor(0.7).privacySensitive()
                    }.font(.caption)
                }
                Spacer(minLength: 0)
                Text(entry.snapshot.updatedAt == .distantPast ? "打开 App 同步包裹" : fresh ? "点击查看 · 已同步" : "内容可能已过期，打开刷新")
                    .font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(2)
            }.privacySensitive()
        }.widgetURL(URL(string: "mashangqu://express"))
    }
}
struct PickupHomeWidget: Widget {
    let kind = "MashangquPickup"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PickupProvider()) { entry in PickupWidgetView(entry: entry) }
            .configurationDisplayName("待取包裹").description("查看待取数量、驿站与取件码。请先在码上取中同步。")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
@available(iOS 16.2, *)
struct PickupLiveWidget: Widget {
    private func code(_ state: PickupActivityAttributes.ContentState, stale: Bool) -> String {
        stale || Date() >= state.validUntil ? "请打开 App 刷新" : state.code.isEmpty ? "打开 App 查询取件码" : state.code
    }
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PickupActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label(context.attributes.title, systemImage: "shippingbox.fill").font(.headline)
                    Spacer()
                    Text("剩余 \(context.state.remaining) 件").font(.caption)
                }
                Text(context.state.station).font(.subheadline).lineLimit(1).privacySensitive()
                Text(code(context.state, stale: context.isStale)).font(.system(size: 26, weight: .bold, design: .rounded))
                    .monospacedDigit().lineLimit(1).minimumScaleFactor(0.6).privacySensitive()
                Text("点击返回 App · 标记已取或结束活动").font(.caption2).foregroundStyle(.secondary)
            }.padding().activityBackgroundTint(Color(uiColor: .secondarySystemBackground))
                .widgetURL(URL(string: "mashangqu://express"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Label("正在取件", systemImage: "shippingbox.fill").font(.caption) }
                DynamicIslandExpandedRegion(.trailing) { Text("\(context.state.remaining) 件").font(.caption) }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 5) {
                        Text(context.state.station).font(.caption).lineLimit(1).privacySensitive()
                        Text(code(context.state, stale: context.isStale)).font(.title2.bold()).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.6).privacySensitive()
                        Text("点击打开码上取").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: "shippingbox.fill").foregroundStyle(.indigo)
            } compactTrailing: {
                Text("\(context.state.remaining)").font(.caption.bold()).monospacedDigit()
            } minimal: {
                Image(systemName: "shippingbox.fill")
            }.widgetURL(URL(string: "mashangqu://express"))
        }
    }
}
@main
struct MashangquWidgetBundle: WidgetBundle {
    var body: some Widget {
        PickupHomeWidget()
        PickupLiveWidget()
    }
}

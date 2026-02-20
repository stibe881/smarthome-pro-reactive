import WidgetKit
import SwiftUI
import AppIntents

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), items: [
            DataItem(entityId: "light.example1", label: "Wohnzimmer", value: "An", icon: "lightbulb.fill", iconColor: "#F59E0B", actionType: "toggle"),
            DataItem(entityId: "light.example2", label: "Küche", value: "Aus", icon: "lightbulb.fill", iconColor: "#F59E0B", actionType: "toggle"),
            DataItem(entityId: "script.example1", label: "Movie Night", value: "", icon: "film.fill", iconColor: "#8B5CF6", actionType: "toggle"),
            DataItem(entityId: "script.example2", label: "Morning", value: "", icon: "sunrise.fill", iconColor: "#EAB308", actionType: "toggle")
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), items: [
            DataItem(entityId: "light.living_room", label: "Wohnzimmer", value: "An", icon: "lightbulb.fill", iconColor: "#F59E0B", actionType: "toggle"),
            DataItem(entityId: "lock.front_door", label: "Haustüre", value: "Zu", icon: "lock.fill", iconColor: "#10B981", actionType: "toggle"),
            DataItem(entityId: "script.movie", label: "Movie Night", value: "", icon: "film.fill", iconColor: "#8B5CF6", actionType: "toggle"),
            DataItem(entityId: "script.morning", label: "Morning", value: "", icon: "sunrise.fill", iconColor: "#EAB308", actionType: "toggle")
        ])
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let userDefaults = UserDefaults(suiteName: "group.com.stibe88.mobileapp")
        var items: [DataItem] = []
        
        if let jsonString = userDefaults?.string(forKey: "widgetData") {
            if let data = jsonString.data(using: .utf8),
               let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data) {
                items = widgetData.items
            }
        }

        let entry = SimpleEntry(date: Date(), items: items)
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }
}

struct WidgetData: Decodable {
    let title: String
    let subtitle: String
    let items: [DataItem]
    let updatedAt: String
}

struct DataItem: Decodable, Identifiable {
    var id: String { entityId }
    let entityId: String
    let label: String
    let value: String
    let icon: String?
    let actionType: String?
    let actionData: String?
    let iconColor: String?
    let confirm: Bool?
    
    enum CodingKeys: String, CodingKey {
        case entityId = "id"
        case label
        case value
        case icon
        case actionType
        case actionData
        case iconColor
        case confirm
    }
    
    init(entityId: String, label: String, value: String, icon: String? = nil, iconColor: String? = nil, actionType: String? = nil) {
        self.entityId = entityId
        self.label = label
        self.value = value
        self.icon = icon
        self.iconColor = iconColor
        self.actionType = actionType
        self.actionData = nil
        self.confirm = false
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let items: [DataItem]
}

// MARK: - Widget Button View
struct WidgetButtonView: View {
    let item: DataItem
    
    func colorFromHex(_ hex: String?) -> Color {
        guard let hex = hex else { return .blue }
        var cString = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if cString.hasPrefix("#") { cString.remove(at: cString.startIndex) }
        if cString.count != 6 { return .blue }
        var rgbValue: UInt64 = 0
        Scanner(string: cString).scanHexInt64(&rgbValue)
        return Color(
            red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(rgbValue & 0x0000FF) / 255.0
        )
    }
    
    var body: some View {
        Button(intent: WidgetActionIntent(entityId: item.entityId, actionType: item.actionType ?? "toggle")) {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(Color.gray.opacity(0.35))
                        .frame(width: 34, height: 34)
                    
                    if let iconName = item.icon {
                        Image(systemName: iconName)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white.opacity(0.85))
                    }
                }
                
                Text(item.label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.leading)
                
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color.white.opacity(0.08))
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Widget Entry View
struct widgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var widgetFamily

    var body: some View {
        if entry.items.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "house.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.gray)
                Text("In der App\nkonfigurieren")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .containerBackground(for: .widget) {
                Color.black
            }
        } else {
            let maxItems = widgetFamily == .systemSmall ? 4 : 4
            let visibleItems = Array(entry.items.prefix(maxItems))
            let rows = stride(from: 0, to: visibleItems.count, by: 2).map { i in
                Array(visibleItems[i..<min(i + 2, visibleItems.count)])
            }
            
            VStack(spacing: 6) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 6) {
                        ForEach(row) { item in
                            WidgetButtonView(item: item)
                        }
                        if row.count == 1 {
                            Color.clear
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                }
            }
            .containerBackground(for: .widget) {
                Color.black
            }
        }
    }
}

struct widget: Widget {
    let kind: String = "widget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            widgetEntryView(entry: entry)
        }
        .configurationDisplayName("HomePilot")
        .description("Steuere dein Zuhause direkt vom Homescreen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemMedium) {
    widget()
} timeline: {
    SimpleEntry(date: .now, items: [
        DataItem(entityId: "lock.front", label: "Haustüre", value: "Zu", icon: "lock.fill", iconColor: "#10B981", actionType: "toggle"),
        DataItem(entityId: "lock.apt", label: "Wohnungstüre", value: "Zu", icon: "door.left.hand.closed", iconColor: "#3B82F6", actionType: "toggle"),
        DataItem(entityId: "script.movie", label: "Movie Night", value: "", icon: "film.fill", iconColor: "#8B5CF6", actionType: "toggle"),
        DataItem(entityId: "script.morning", label: "Morning", value: "", icon: "sunrise.fill", iconColor: "#EAB308", actionType: "toggle")
    ])
}

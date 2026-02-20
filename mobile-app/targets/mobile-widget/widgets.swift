import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), title: "HomePilot", subtitle: "Lade...", items: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), title: "HomePilot", subtitle: "Vorschau", items: [
            DataItem(entityId: "sensor.living_room", label: "Wohnzimmer", value: "21°C", icon: "thermometer", iconColor: "#EAB308", actionType: "navigate"),
            DataItem(entityId: "light.living_room", label: "Licht", value: "An", icon: "lightbulb.fill", iconColor: "#F59E0B", actionType: "toggle")
        ])
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        // Fetch data from App Group
        let userDefaults = UserDefaults(suiteName: "group.com.stibe88.mobileapp")
        let title = "HomePilot"
        var subtitle = "Keine Daten"
        var items: [DataItem] = []
        
        if let jsonString = userDefaults?.string(forKey: "widgetData") {
            if let data = jsonString.data(using: .utf8),
               let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data) {
                subtitle = widgetData.subtitle
                items = widgetData.items
            }
        }

        let entry = SimpleEntry(date: Date(), title: title, subtitle: subtitle, items: items)
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
    var id: String { entityId } // Identifiable conformance uses entityId
    let entityId: String
    let label: String
    let value: String
    let icon: String?
    let actionType: String?
    let actionData: String?
    let iconColor: String?
    let confirm: Bool?
    
    enum CodingKeys: String, CodingKey {
        case entityId = "id" // Map JSON "id" to "entityId"
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
    let title: String
    let subtitle: String
    let items: [DataItem]
}

struct widgetEntryView : View {
    var entry: Provider.Entry

    func getUrl(for item: DataItem) -> URL {
        // Format: smarthome-pro://action?id=...&type=...&confirm=...
        var components = URLComponents()
        components.scheme = "smarthome-pro"
        components.host = "action"
        
        var queryItems = [
            URLQueryItem(name: "id", value: item.entityId),
            URLQueryItem(name: "type", value: item.actionType ?? "none")
        ]
        
        if item.confirm == true {
             queryItems.append(URLQueryItem(name: "confirm", value: "true"))
        }
        
        components.queryItems = queryItems
        return components.url ?? URL(string: "smarthome-pro://")!
    }

    // Helper to convert hex string to Color
    func colorFromHex(_ hex: String?) -> Color {
        guard let hex = hex else { return .blue }
        var cString:String = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

        if (cString.hasPrefix("#")) {
            cString.remove(at: cString.startIndex)
        }

        if ((cString.count) != 6) { return .blue }

        var rgbValue:UInt64 = 0
        Scanner(string: cString).scanHexInt64(&rgbValue)

        return Color(
            red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(rgbValue & 0x0000FF) / 255.0
        )
    }

    var body: some View {
        if entry.items.isEmpty {
            VStack {
                Text("In der App konfigurieren")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .containerBackground(for: .widget) {
                Color(UIColor(red: 0.1, green: 0.1, blue: 0.1, alpha: 1.0))
            }
        } else {
            let rows = stride(from: 0, to: min(entry.items.count, 4), by: 2).map { i in
                Array(entry.items[i..<min(i+2, min(entry.items.count, 4))])
            }
            VStack(spacing: 8) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 8) {
                        ForEach(row) { item in
                            Link(destination: getUrl(for: item)) {
                                HStack(spacing: 10) {
                                    ZStack {
                                        Circle()
                                            .fill(Color.gray.opacity(0.3))
                                            .frame(width: 36, height: 36)
                                        
                                        if let iconName = item.icon {
                                            Image(systemName: iconName)
                                                .font(.system(size: 16))
                                                .foregroundColor(.white.opacity(0.9))
                                        }
                                    }
                                    
                                    Text(item.label)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(.white)
                                        .lineLimit(2)
                                        .minimumScaleFactor(0.8)
                                    
                                    Spacer(minLength: 0)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .background(
                                    RoundedRectangle(cornerRadius: 14)
                                        .fill(Color(UIColor(red: 0.18, green: 0.18, blue: 0.18, alpha: 1.0)))
                                )
                            }
                        }
                        // Fill remaining space if odd number of items in this row
                        if row.count == 1 {
                            Spacer()
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .containerBackground(for: .widget) {
                Color(UIColor(red: 0.1, green: 0.1, blue: 0.1, alpha: 1.0))
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
        .configurationDisplayName("HomePilot Status")
        .description("Steuere dein Zuhause direkt vom Homescreen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemSmall) {
    widget()
} timeline: {
    SimpleEntry(date: .now, title: "HomePilot", subtitle: "Zuhause", items: [
        DataItem(entityId: "sensor.temp", label: "Wohnzimmer", value: "22°C", icon: "thermometer", iconColor: "#EF4444", actionType: "navigate"),
        DataItem(entityId: "lock.gate", label: "Eingangstor", value: "Zu", icon: "lock.fill", iconColor: "#10B981", actionType: "toggle")
    ])
}

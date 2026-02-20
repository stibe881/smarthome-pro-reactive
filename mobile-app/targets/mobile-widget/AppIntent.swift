import WidgetKit
import AppIntents
import Foundation

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Configuration" }
    static var description: IntentDescription { "Widget configuration." }
}

// Intent for widget button actions - executes without opening the app
struct WidgetActionIntent: AppIntent {
    static var title: LocalizedStringResource { "Widget Action" }
    static var description: IntentDescription { "Performs a smart home action from the widget." }
    
    // This prevents the app from opening
    static var openAppWhenRun: Bool = false
    
    @Parameter(title: "Entity ID")
    var entityId: String
    
    @Parameter(title: "Action Type")
    var actionType: String
    
    init() {
        self.entityId = ""
        self.actionType = "toggle"
    }
    
    init(entityId: String, actionType: String) {
        self.entityId = entityId
        self.actionType = actionType
    }
    
    func perform() async throws -> some IntentResult {
        // Store the action in App Group UserDefaults for the app to pick up
        let userDefaults = UserDefaults(suiteName: "group.com.stibe88.mobileapp")
        
        let actionData: [String: String] = [
            "entityId": entityId,
            "actionType": actionType,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: actionData),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            userDefaults?.set(jsonString, forKey: "widgetPendingAction")
        }
        
        // Also store in an array for the app to process when it opens
        var pendingActions = userDefaults?.stringArray(forKey: "widgetPendingActions") ?? []
        if let jsonData = try? JSONSerialization.data(withJSONObject: actionData),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            pendingActions.append(jsonString)
            userDefaults?.set(pendingActions, forKey: "widgetPendingActions")
        }
        
        return .result()
    }
}

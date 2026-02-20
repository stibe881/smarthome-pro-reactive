import WidgetKit
import AppIntents
import Foundation

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Configuration" }
    static var description: IntentDescription { "Widget configuration." }
}

// Intent for widget button actions - calls Home Assistant API directly
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
        let userDefaults = UserDefaults(suiteName: "group.com.stibe88.mobileapp")
        
        guard let haUrl = userDefaults?.string(forKey: "haUrl"),
              let haToken = userDefaults?.string(forKey: "haToken"),
              !haUrl.isEmpty, !haToken.isEmpty else {
            print("[Widget] No HA credentials found in UserDefaults")
            return .result()
        }
        
        // Determine domain and service based on entity ID
        let domain: String
        let service: String
        
        if entityId.hasPrefix("script.") {
            domain = "script"
            service = "turn_on"
        } else if entityId.hasPrefix("scene.") {
            domain = "scene"
            service = "turn_on"
        } else if entityId.hasPrefix("input_button.") {
            domain = "input_button"
            service = "press"
        } else if entityId.hasPrefix("light.") {
            domain = "light"
            service = "toggle"
        } else if entityId.hasPrefix("switch.") {
            domain = "switch"
            service = "toggle"
        } else if entityId.hasPrefix("lock.") {
            domain = "lock"
            service = "toggle"
        } else {
            domain = "homeassistant"
            service = "toggle"
        }
        
        // Build the API URL
        let apiUrl = "\(haUrl)/api/services/\(domain)/\(service)"
        
        guard let url = URL(string: apiUrl) else {
            print("[Widget] Invalid URL: \(apiUrl)")
            return .result()
        }
        
        // Create the request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(haToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = ["entity_id": entityId]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        // Execute the request
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                print("[Widget] HA API response: \(httpResponse.statusCode) for \(entityId)")
            }
        } catch {
            print("[Widget] HA API call failed: \(error.localizedDescription)")
        }
        
        return .result()
    }
}

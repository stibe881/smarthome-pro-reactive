import ExpoModulesCore
import WidgetKit

public class WidgetReloadModule: Module {
    public func definition() -> ModuleDefinition {
        Name("WidgetReload")

        AsyncFunction("reloadAll") {
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }
}

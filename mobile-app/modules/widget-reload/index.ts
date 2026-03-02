import { Platform } from 'react-native';

let WidgetReload: any = null;

if (Platform.OS === 'ios') {
    try {
        const { requireNativeModule } = require('expo-modules-core');
        WidgetReload = requireNativeModule('WidgetReload');
    } catch {
        // Native module not available (dev build without rebuild)
        // Native module not available in Expo Go
    }
}

export async function reloadAllWidgets(): Promise<void> {
    if (WidgetReload) {
        try {
            await WidgetReload.reloadAll();
        } catch {
            // Silently fail if reload not available
        }
    }
}

import { requireNativeModule, Platform } from 'expo-modules-core';

const WidgetReload = Platform.OS === 'ios' ? requireNativeModule('WidgetReload') : null;

export async function reloadAllWidgets(): Promise<void> {
    if (WidgetReload) {
        await WidgetReload.reloadAll();
    }
}

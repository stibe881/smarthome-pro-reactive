import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_GROUP_ID = 'group.com.stibe88.mobileapp';
const WIDGET_STORAGE_KEY = '@widget_data';

export interface WidgetData {
    title: string;
    subtitle: string;
    items: { 
        label: string; 
        value: string; 
        id: string; 
        icon?: string;
        actionType?: 'toggle' | 'navigate' | 'script' | 'scene' | 'none';
        actionData?: string; // URL or EntityID
        iconColor?: string;
        confirm?: boolean;
    }[];
    updatedAt: string;
}

let userDefaults: any = null;

try {
    // Dynamically require to prevent crash if native module is missing
    if (Platform.OS === 'ios') {
        const UserDefaults = require('@alevy97/react-native-userdefaults').default;
        userDefaults = new UserDefaults(APP_GROUP_ID);
    }
} catch (e) {
    console.warn('Widget native module not found. Using AsyncStorage fallback.');
}

export const saveCookieToWidget = async (data: WidgetData) => {
    const json = JSON.stringify(data);

    // Always save to AsyncStorage for in-app persistence
    try {
        await AsyncStorage.setItem(WIDGET_STORAGE_KEY, json);
    } catch (error) {
        console.error('Failed to save widget to AsyncStorage:', error);
    }

    // Also save to UserDefaults for native iOS widget (if available)
    if (Platform.OS === 'ios' && userDefaults) {
        try {
            await userDefaults.set('widgetData', json);
        } catch (error) {
            console.error('Failed to save to widget UserDefaults:', error);
        }
    }
};

/**
 * Save Home Assistant credentials to App Group UserDefaults
 * so the native iOS widget can make direct API calls.
 */
export const saveCredentialsToWidget = async (haUrl: string, haToken: string) => {
    if (Platform.OS !== 'ios' || !userDefaults) return;

    try {
        await userDefaults.set('haUrl', haUrl);
        await userDefaults.set('haToken', haToken);
        console.log('[Widget] HA credentials saved to UserDefaults');
    } catch (error) {
        console.error('[Widget] Failed to save credentials:', error);
    }
};

export const loadCookieFromWidget = async (): Promise<WidgetData | null> => {
    // Try UserDefaults first (native widget data)
    if (Platform.OS === 'ios' && userDefaults) {
        try {
            const data = await userDefaults.get('widgetData');
            if (data) return JSON.parse(data);
        } catch (error) {
            console.warn('Failed to load from widget UserDefaults:', error);
        }
    }

    // Fallback to AsyncStorage
    try {
        const data = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.warn('Failed to load widget from AsyncStorage:', error);
        return null;
    }
};

/**
 * Process pending widget actions from UserDefaults.
 * The iOS widget writes actions via WidgetActionIntent to "widgetPendingActions".
 * This function reads them, executes via callService, and clears the queue.
 */
export const processWidgetPendingActions = async (
    callService: (domain: string, service: string, entityId: string, data?: any) => Promise<any>
) => {
    if (Platform.OS !== 'ios' || !userDefaults) return;

    try {
        const raw = await userDefaults.get('widgetPendingActions');
        if (!raw) return;

        let actions: string[] = [];
        try {
            actions = JSON.parse(raw);
        } catch {
            // If it's not valid JSON array, skip
            return;
        }

        if (!Array.isArray(actions) || actions.length === 0) return;

        console.log(`[Widget] Processing ${actions.length} pending action(s)...`);

        for (const actionJson of actions) {
            try {
                const action = JSON.parse(actionJson);
                const { entityId, actionType } = action;
                
                if (!entityId) continue;

                console.log(`[Widget] Executing ${actionType} for ${entityId}`);

                if (entityId.startsWith('script.')) {
                    await callService('script', 'turn_on', entityId);
                } else if (entityId.startsWith('scene.')) {
                    await callService('scene', 'turn_on', entityId);
                } else if (entityId.startsWith('input_button.')) {
                    await callService('input_button', 'press', entityId);
                } else {
                    await callService('homeassistant', 'toggle', entityId);
                }

                console.log(`[Widget] ✅ Action completed for ${entityId}`);
            } catch (error) {
                console.error('[Widget] Failed to execute action:', error);
            }
        }

        // Clear the queue after processing
        await userDefaults.set('widgetPendingActions', JSON.stringify([]));
        console.log('[Widget] Pending actions cleared.');
    } catch (error) {
        console.error('[Widget] Failed to process pending actions:', error);
    }
};

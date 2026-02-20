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

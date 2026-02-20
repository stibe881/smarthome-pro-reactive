import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { HomeAssistantService } from '../services/homeAssistant';
import { processWidgetPendingActions } from '../lib/widget';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';

const GEOFENCING_TASK = 'GEOFENCING_TASK';
const SHOPPING_TASK = 'SHOPPING_TASK';
const HOME_COORDS_KEY = '@smarthome_home_coords';
const SHOPPING_COUNT_KEY = '@smarthome_shopping_count';
const SHOP_ENTRY_KEY = '@smarthome_shop_entry';
const IS_HOME_KEY = '@smarthome_is_at_home';
const METEO_WARNING_KEY = '@smarthome_last_weather_warning';
const SHOPS_STORAGE_KEY = '@smarthome_shopping_locations';

// Default shops with GPS coordinates for reliable geofencing (fallback if no custom list saved)
export const DEFAULT_SHOPS = [
    { name: 'Aldi Sursee', lat: 47.170723963107065, lng: 8.095389675777374 },
    { name: 'Aldi Willisau', lat: 47.12633650391756, lng: 7.996571426910975 },
    { name: 'Coop Willisau', lat: 47.127780306002485, lng: 7.997146443242294 },
    { name: 'Denner Wauwil', lat: 47.185210354299905, lng: 8.020021866533813 },
    { name: 'Emmencenter', lat: 47.07458218737632, lng: 8.287166539542232 },
    { name: 'Gäupark', lat: 47.31872686571612, lng: 7.8036032896462295 },
    { name: 'Lidl Sursee', lat: 47.17435395463242, lng: 8.099342183724342 },
    { name: 'Lidl Willisau', lat: 47.13072945815979, lng: 7.999687810709169 },
    { name: 'Märti Zell', lat: 47.13723434652069, lng: 7.92844912605166 },
    { name: 'Migros Willisau', lat: 47.123844972245344, lng: 7.994886639544442 },
    { name: 'Pilatusmarkt', lat: 47.017756755461235, lng: 8.300323511109347 },
    { name: 'Surseepark', lat: 47.17315292712783, lng: 8.10190380633404 },
];

export type ShoppingLocation = { name: string; lat: number; lng: number };

// Load shops from AsyncStorage (or fallback to defaults)
const getShopList = async (): Promise<ShoppingLocation[]> => {
    try {
        const stored = await AsyncStorage.getItem(SHOPS_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch { }
    return DEFAULT_SHOPS;
};

// Fallback: Generic shop names for reverse geocoding matching
const TARGET_SHOPS = ['coop', 'migros', 'volg', 'aldi', 'lidl', 'kaufland', 'denner'];

// Haversine distance formula (returns meters)
const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Check if location is near a known shop (within 100m) - async to read dynamic list
const findNearbyShop = async (lat: number, lng: number): Promise<string | null> => {
    const shops = await getShopList();
    for (const shop of shops) {
        const distance = haversineDistance(lat, lng, shop.lat, shop.lng);
        if (distance <= 60) { // 60 meters radius
            console.log(`🛒 Near ${shop.name} (${Math.round(distance)}m)`);
            return shop.name;
        }
    }
    return null;
};

// Define the background task for Shopping
if (Platform.OS !== 'web') TaskManager.defineTask(SHOPPING_TASK, async ({ data, error }: any) => {
    if (error) {
        console.error("Shopping Task Error:", error);
        return;
    }

    if (data.locations && data.locations.length > 0) {
        const { latitude, longitude } = data.locations[0].coords;

        try {
            // 1. Check Shopping List Count
            const countStr = await AsyncStorage.getItem(SHOPPING_COUNT_KEY);
            const count = parseInt(countStr || '0');

            if (count <= 0) {
                // List empty, reset any entry and return
                await AsyncStorage.removeItem(SHOP_ENTRY_KEY);
                return;
            }

            // Check Settings
            const settingsStr = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
            if (settingsStr) {
                const settings = JSON.parse(settingsStr);
                // Check new structure (household.shopping) or fallback
                if (settings.household?.shopping === false) {
                    console.log("Shopping notification disabled by setting");
                    return;
                }
            }

            // 2. Check if near a known shop (by GPS coordinates - reliable)
            let matchingShop = await findNearbyShop(latitude, longitude);

            // 3. Fallback: Reverse Geocode to check if we are at a shop (less reliable)
            if (!matchingShop) {
                const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (addresses && addresses.length > 0) {
                    const address = addresses[0];
                    const name = (address.name || '').toLowerCase();
                    const street = (address.street || '').toLowerCase();

                    const geocodeMatch = TARGET_SHOPS.find(shop =>
                        name.includes(shop) || street.includes(shop)
                    );
                    if (geocodeMatch) {
                        matchingShop = geocodeMatch;
                        console.log(`🛒 At Shop (geocode): ${matchingShop}`);
                    }
                }
            }

            if (matchingShop) {
                console.log(`🛒 At Shop: ${matchingShop}`);

                // 3. Logic: Check Duration
                const now = Date.now();
                const entryDataStr = await AsyncStorage.getItem(SHOP_ENTRY_KEY);
                let entryData = entryDataStr ? JSON.parse(entryDataStr) : null;

                if (!entryData || entryData.shop !== matchingShop) {
                    // New shop entry
                    entryData = { shop: matchingShop, timestamp: now, notified: false };
                    await AsyncStorage.setItem(SHOP_ENTRY_KEY, JSON.stringify(entryData));
                } else {
                    // Still in same shop
                    const durationMinutes = (now - entryData.timestamp) / 60000;
                    console.log(`⏱️ Duration in ${matchingShop}: ${durationMinutes.toFixed(1)} min`);

                    if (durationMinutes >= 3 && !entryData.notified) {
                        // > 3 Minutes and not yet notified -> NOTIFY!
                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: "Haushalt",
                                body: "Schau doch kurz in eure Einkaufsliste",
                                sound: true,
                                categoryIdentifier: 'SHOPPING_ACTION',
                                data: { action: 'open_list' }
                            },
                            trigger: null
                        });

                        // Mark as notified
                        entryData.notified = true;
                        await AsyncStorage.setItem(SHOP_ENTRY_KEY, JSON.stringify(entryData));
                    }
                }
            } else {
                // Not at a known shop -> Reset entry
                // Only reset if we are confident (maybe give it a grace period? For simplicity: reset).
                await AsyncStorage.removeItem(SHOP_ENTRY_KEY);
            }
        } catch (e) {
            console.error("Shopping Task Logic Error:", e);
        }
    }
});

// Define the background task
if (Platform.OS !== 'web') TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }: any) => {
    if (error) {
        console.error("Geofencing Task Error:", error);
        return;
    }
    const eventType = data.eventType;

    if (eventType === Location.GeofencingEventType.Enter) {
        const isHome = await AsyncStorage.getItem(IS_HOME_KEY);
        if (isHome === 'true') {
            console.log("Already at home, skipping notification");
            return;
        }

        // Check Settings
        const settingsStr = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
        if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.home?.welcome === false) {
                console.log("Welcome notification disabled by setting");
                return;
            }
        }

        console.log("Entered Home Region!");
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Willkommen Zuhause",
                body: "Möchtest du die Haustüre öffnen?",
                sound: true,
                categoryIdentifier: 'DOOR_OPEN_ACTION',
                data: { action: 'open_door' }
            },
            trigger: null
        });
        await AsyncStorage.setItem(IS_HOME_KEY, 'true');

        // Trigger Arrival Script (script.ankunft_stibe)
        try {
            const haUrl = await AsyncStorage.getItem('@smarthome_ha_url');
            const haToken = await AsyncStorage.getItem('@smarthome_ha_token');

            if (haUrl && haToken) {
                console.log("🚀 Triggering Arrival Script: script.ankunft_stibe");
                fetch(`${haUrl}/api/services/script/turn_on`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${haToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ entity_id: 'script.ankunft_stibe' }),
                }).then(res => {
                    if (!res.ok) console.warn('Script Trigger Status:', res.status);
                }).catch(e => console.error("Failed to trigger arrival script (fetch):", e));
            } else {
                console.log("⚠️ Cannot trigger arrival script - No credentials found in local storage");
            }
        } catch (e) {
            console.error("Failed to trigger arrival script logic:", e);
        }

    } else if (eventType === Location.GeofencingEventType.Exit) {
        console.log("Exited Home Region");
        await AsyncStorage.setItem(IS_HOME_KEY, 'false');
    }
});

export interface EntityState {
    entity_id: string;
    state: string;
    attributes: {
        friendly_name?: string;
        brightness?: number;
        rgb_color?: number[];
        color_temp?: number;
        current_position?: number;
        media_title?: string;
        media_artist?: string;
        media_album_name?: string;
        entity_picture?: string;
        volume_level?: number;
        source_list?: string[];
        source?: string;
        [key: string]: any;
    };
    myPositionEntity?: string;
    last_changed: string;
    last_updated: string;
}

interface HomeAssistantContextType {
    entities: EntityState[];
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    haBaseUrl: string | null;
    authToken: string | null; // Expose token
    connect: (internalCreds?: { url: string; token: string }) => Promise<boolean>;
    disconnect: () => void;
    toggleLight: (entityId: string) => void;
    setLightBrightness: (entityId: string, brightness: number) => void;
    openCover: (entityId: string) => void;
    closeCover: (entityId: string) => void;
    setCoverPosition: (entityId: string, position: number) => void;
    stopCover: (entityId: string) => void;
    startVacuum: (entityId: string) => void;
    pauseVacuum: (entityId: string) => void;
    returnVacuum: (entityId: string) => void;
    activateScene: (sceneId: string) => void;
    setClimateTemperature: (entityId: string, temperature: number) => void;
    setClimateHvacMode: (entityId: string, mode: string) => void;
    setCoverTiltPosition: (entityId: string, position: number) => void;
    pressButton: (entityId: string) => void;
    playMedia: (entityId: string, mediaContentId: string, mediaContentType: string) => void;
    browseMedia: (entityId: string, mediaContentId?: string, mediaContentType?: string) => Promise<any>;
    callService: (domain: string, service: string, entityId: string, data?: any) => void;
    saveCredentials: (url: string, token: string) => Promise<void>;
    getCredentials: () => Promise<{ url: string; token: string } | null>;
    getEntityPictureUrl: (entityPicture: string | undefined) => string | undefined;
    notificationSettings: NotificationSettings;
    updateNotificationSettings: (settings: NotificationSettings) => Promise<void>;
    fetchCalendarEvents: (entityId: string, start: string, end: string) => Promise<any[]>;
    setHomeLocation: () => Promise<void>;
    isGeofencingActive: boolean;
    fetchTodoItems: (entityId: string) => Promise<any[]>;
    updateTodoItem: (entityId: string, item: string, status: 'completed' | 'needs_action') => Promise<void>;
    addTodoItem: (entityId: string, item: string) => Promise<void>;
    shoppingListVisible: boolean;
    setShoppingListVisible: (visible: boolean) => void;
    startShoppingGeofencing: () => Promise<void>;
    fetchWeatherForecast: (entityId: string, forecastType?: 'daily' | 'hourly') => Promise<any[]>;
    debugShoppingLogic: () => Promise<void>;
    getExpoPushToken: () => string | null;
    isDoorbellRinging: boolean;
    setIsDoorbellRinging: (ringing: boolean) => void;
    dashboardConfig: any;
    saveDashboardConfig: (config: any) => Promise<void>;
    isHAInitialized: boolean;
}

const HomeAssistantContext = createContext<HomeAssistantContextType | undefined>(undefined);

const NOTIF_SETTINGS_KEY = '@smarthome_notif_settings';

export interface NotificationSettings {
    enabled: boolean;
    security: {
        doors_ug: boolean; // Waschkueche & Highlight merged
    };
    household: {
        shopping: boolean;
    };
    home: {
        welcome: boolean;
        doorbell: boolean;
    };
    weather: {
        warning: boolean;
    };
    baby: {
        cry: boolean;
    };
    calendar: {
        birthday: boolean;
    };
}

export function HomeAssistantProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    // Derive user slug (e.g. stefan_gross)
    const userSlug = useMemo(() => {
        if (!user?.email) return null;
        // Check if user is 'stibe' explicitly or fallback to email slug
        if (user.email.toLowerCase().startsWith('stibe') || user.email.toLowerCase().startsWith('stefan')) {
            return 'stibe'; // Force 'stibe' for Stefan/Stibe
        }
        return user.email.split('@')[0].replace(/\./g, '_').toLowerCase();
    }, [user]);

    // Helper Entity IDs
    const helperIds = useMemo(() => {
        if (!userSlug) return null;
        return {
            security: `input_boolean.notify_${userSlug}_turen_ug`,
            doorbell: `input_boolean.notify_${userSlug}_doorbell`,
            weather: `input_boolean.notify_${userSlug}_weatheralert`,
            baby_cry: `input_boolean.notify_${userSlug}_baby_cry`,
            birthday: `input_boolean.notify_${userSlug}_birthday`,
        };
    }, [userSlug]);

    const [entities, setEntities] = useState<EntityState[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [haBaseUrl, setHaBaseUrl] = useState<string | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null); // State for token
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null); // State for Expo Push Token
    const serviceRef = useRef<HomeAssistantService | null>(null);
    const [notificationSettings, setNotificationSettingsState] = useState<NotificationSettings>({
        enabled: true,
        security: {
            doors_ug: true
        },
        household: {
            shopping: true
        },
        home: {
            welcome: true,
            doorbell: true
        },
        weather: {
            warning: true
        },
        baby: {
            cry: true
        },
        calendar: {
            birthday: true
        }
    });
    const [dashboardConfig, setDashboardConfig] = useState<any>({});
    const [isHAInitialized, setIsHAInitialized] = useState(false);

    // Create a ref to access current settings in callbacks/effects without dependency cycles
    const notificationSettingsRef = useRef<NotificationSettings>(notificationSettings);

    // Sync ref when state changes
    useEffect(() => {
        notificationSettingsRef.current = notificationSettings;
    }, [notificationSettings]);

    // Compatible setter that updates both
    // Updated setter that handles both Local and HA sync
    const updateNotificationSettings = async (newSettings: NotificationSettings) => {
        // 1. Update Local State & Storage (Optimistic)
        setNotificationSettingsState(newSettings);
        await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(newSettings));

        console.log('UpdateNotifSettings called. Connected:', isConnected, 'HelperIds:', helperIds);

        // 2. Sync with HA Helpers if connected and user is known
        if (isConnected && serviceRef.current && helperIds) {
            try {
                // Security
                if (newSettings.security.doors_ug !== notificationSettings.security.doors_ug) {
                    console.log(`Syncing Security -> ${newSettings.security.doors_ug ? 'ON' : 'OFF'} (${helperIds.security})`);
                    serviceRef.current.callService(
                        'input_boolean',
                        newSettings.security.doors_ug ? 'turn_on' : 'turn_off',
                        helperIds.security
                    );
                }
                // Doorbell
                if (newSettings.home.doorbell !== notificationSettings.home.doorbell) {
                    console.log(`Syncing Doorbell -> ${newSettings.home.doorbell ? 'ON' : 'OFF'} (${helperIds.doorbell})`);
                    serviceRef.current.callService(
                        'input_boolean',
                        newSettings.home.doorbell ? 'turn_on' : 'turn_off',
                        helperIds.doorbell
                    );
                }
                // Weather
                if (newSettings.weather.warning !== notificationSettings.weather.warning) {
                    console.log(`Syncing Weather -> ${newSettings.weather.warning ? 'ON' : 'OFF'} (${helperIds.weather})`);
                    serviceRef.current.callService(
                        'input_boolean',
                        newSettings.weather.warning ? 'turn_on' : 'turn_off',
                        helperIds.weather
                    );
                }
                // Baby Cry
                if (newSettings.baby?.cry !== notificationSettings.baby?.cry) {
                    console.log(`Syncing Baby Cry -> ${newSettings.baby.cry ? 'ON' : 'OFF'} (${helperIds.baby_cry})`);
                    serviceRef.current.callService(
                        'input_boolean',
                        newSettings.baby.cry ? 'turn_on' : 'turn_off',
                        helperIds.baby_cry
                    );
                }
                // Birthday
                if (newSettings.calendar?.birthday !== notificationSettings.calendar?.birthday) {
                    console.log(`Syncing Birthday -> ${newSettings.calendar.birthday ? 'ON' : 'OFF'} (${helperIds.birthday})`);
                    serviceRef.current.callService(
                        'input_boolean',
                        newSettings.calendar.birthday ? 'turn_on' : 'turn_off',
                        helperIds.birthday
                    );
                }
            } catch (e) {
                console.warn('Failed to sync settings with HA', e);
            }
        } else {
            console.log('Skipping HA Sync - Connected:', isConnected, 'Helpers:', !!helperIds);
        }
    };
    const [isGeofencingActive, setIsGeofencingActive] = useState(false);
    const [shoppingListVisible, setShoppingListVisible] = useState(false);
    const [isDoorbellRinging, setIsDoorbellRinging] = useState(false);
    const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Register for Push Notifications
    useEffect(() => {
        registerForPushNotificationsAsync().then(token => setExpoPushToken(token ?? null));
    }, []);

    // Sync Push Token to Home Assistant
    useEffect(() => {
        const syncPushTokenToHA = async () => {
            if (!isConnected || !expoPushToken || !userSlug || !serviceRef.current) return;

            try {
                // The input_text entity should be named: input_text.push_token_{userSlug}
                // e.g., input_text.push_token_stibe
                const inputTextEntityId = `input_text.push_token_${userSlug}`;

                // console.log(`[Push Token] Syncing to HA: ${inputTextEntityId}`);

                await serviceRef.current.callService('input_text', 'set_value', inputTextEntityId, {
                    value: expoPushToken
                });

                // console.log(`[Push Token] Successfully synced to HA`);
            } catch (e) {
                // console.warn('[Push Token] Failed to sync to HA:', e);
            }
        };

        syncPushTokenToHA();
    }, [isConnected, expoPushToken, userSlug]);

    async function registerForPushNotificationsAsync() {
        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
            return;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }

            const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
            const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            // console.log("🔥 Expo Push Token:", token);
            return token;
        } catch (e) {
            console.error("Error getting push token:", e);
        }
    }

    useEffect(() => {
        // console.log("🔵 HomeAssistantProvider MOUNTED");
        return () => {
            // console.log("🔴 HomeAssistantProvider UNMOUNTED - This causes disconnect!");
        };
    }, []);

    // Notification Response Listener
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const actionId = response.actionIdentifier;
            const categoryId = response.notification.request.content.categoryIdentifier;

            // Handle door open action from any door-related notification
            if (actionId === 'open_door_btn' ||
                ((categoryId === 'DOOR_OPEN_ACTION' || categoryId === 'DOORBELL_ACTION') &&
                    actionId === Notifications.DEFAULT_ACTION_IDENTIFIER)) {
                handleDoorOpenAction();
            }
            if (categoryId === 'SHOPPING_ACTION') {
                setShoppingListVisible(true);
            }
        });
        return () => subscription.remove();
    }, [isConnected]); // Depend on connection to ensure we can call service

    const handleDoorOpenAction = async () => {
        // We need to ensure service is connected or reconnect
        // For simplicity, attempt call. If app was killed, we might need to reconnect first.
        // Assuming app is foregrounded by the interaction.
        if (serviceRef.current) {
            // Trigger the button
            serviceRef.current.callService('button', 'press', 'button.hausture_tur_offnen');
            // Feedback
            /* MOVED TO HA AUTOMATION ? No, this is response to action. Keep feedback or remove?
               Let's keep the "Command Sent" feedback locally. */
            Notifications.scheduleNotificationAsync({
                content: { title: "Haustür", body: "Öffnen Befehl gesendet.", sound: false },
                trigger: null
            });
        }
    };

    const handleStateChange = useCallback((newEntities: any[]) => {
        // Sync Shopping Count for Background Task
        const shoppingEntity = newEntities.find(e => e.entity_id === 'todo.google_keep_einkaufsliste');
        if (shoppingEntity) {
            // For todo entities, state is often the count of incomplete items. 
            // However, check if it is a valid number string first.
            const stateCnt = parseInt(shoppingEntity.state);
            if (!isNaN(stateCnt)) {
                AsyncStorage.setItem(SHOPPING_COUNT_KEY, stateCnt.toString());
            }
        }

        // MY_POSITION_MAPPING by entity_id for reliable matching
        const MY_POSITION_MAPPING: Record<string, string> = {
            'cover.essbereich': 'button.evb_essbereich_my_position',
            'cover.kuche': 'button.evb_kuchenfenster_my_position',
            'cover.ogp_3900159': 'button.evb_kuche_balkon_my_position', // Küche Balkon
            'cover.wohnzimmer_sofa': 'button.evb_sofa_my_position',
            'cover.wohnzimmer_spielplaetzchen': 'button.evb_spielplatz_my_position',
            'cover.terrasse': 'button.evb_terrasse_my_position',
        };

        // RENAMING by entity_id for covers only
        const COVER_RENAMING: Record<string, string> = {
            'cover.kuche': 'Küchenfenster',
            'cover.wohnzimmer_sofa': 'Sofa',
        };

        const mapped: EntityState[] = newEntities.map((ent: any) => {
            const attributes = { ...ent.attributes };

            // Renaming logic (covers only)
            if (COVER_RENAMING[ent.entity_id]) {
                attributes.friendly_name = COVER_RENAMING[ent.entity_id];
            }

            return {
                ...ent,
                attributes,
                myPositionEntity: MY_POSITION_MAPPING[ent.entity_id]
            };
        });

        setEntities(mapped);
    }, []);

    // Timestamp tracking to prevent race conditions (HA state vs Local Optimistic state)
    const prevHelperTimestamps = useRef<{ [key: string]: string }>({});

    // Sync HA Helpers to Local State
    useEffect(() => {
        if (!helperIds || entities.length === 0) return;

        const securityHelper = entities.find(e => e.entity_id === helperIds.security);
        const doorbellHelper = entities.find(e => e.entity_id === helperIds.doorbell);
        const weatherHelper = entities.find(e => e.entity_id === helperIds.weather);
        const babyCryHelper = entities.find(e => e.entity_id === helperIds.baby_cry);
        const birthdayHelper = entities.find(e => e.entity_id === helperIds.birthday);

        setNotificationSettingsState(prev => {
            const next = { ...prev };
            let changed = false;
            const timestamps = prevHelperTimestamps.current;

            // Helper function to check sync
            const checkSync = (helper: EntityState | undefined, currentSetting: boolean, setVal: (val: boolean) => void) => {
                if (!helper) return;
                // Only sync if HA state is DIFFERENT from Local AND Timestamp is NEW
                // We use last_updated to ensure we process only NEW events
                const lastTs = timestamps[helper.entity_id];
                if (helper.last_updated !== lastTs) {
                    // HA Updated! Sync to local.
                    const haState = helper.state === 'on';
                    // Update only if different (or force sync to ensure consistency)
                    if (haState !== currentSetting) {
                        setVal(haState);
                        changed = true;
                    }
                    timestamps[helper.entity_id] = helper.last_updated;
                }
            };

            checkSync(securityHelper, prev.security.doors_ug, (v) => next.security.doors_ug = v);
            checkSync(doorbellHelper, prev.home.doorbell, (v) => next.home.doorbell = v);
            checkSync(weatherHelper, prev.weather.warning, (v) => next.weather.warning = v);
            // Ensure baby object exists before assigning
            if (!next.baby) next.baby = { cry: true };
            checkSync(babyCryHelper, prev.baby?.cry ?? true, (v) => next.baby.cry = v);

            // Ensure calendar object exists
            if (!next.calendar) next.calendar = { birthday: true };
            checkSync(birthdayHelper, prev.calendar?.birthday ?? true, (v) => next.calendar.birthday = v);

            if (changed) {
                console.log('🔄 Synced Notification Settings from HA');
                AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(next));
                return next;
            }
            return prev;
        });
    }, [entities, helperIds]);

    // State for notification tracking (previous states)
    const prevDoorStates = useRef<{ [key: string]: string }>({});
    const prevMeteoState = useRef<string>('off');

    // Helper to translate weather warnings
    const translateWeather = (text: string): string => {
        if (!text) return '';
        let t = text;
        // Colors & Levels
        t = t.replace(/Yellow/gi, 'Gelbe');
        t = t.replace(/Orange/gi, 'Orange');
        t = t.replace(/Red/gi, 'Rote');
        t = t.replace(/Warning/gi, 'Warnung');
        t = t.replace(/Watch/gi, 'Vorwarnung');
        // Types
        t = t.replace(/Wind/gi, 'Wind');
        t = t.replace(/Rain/gi, 'Regen');
        t = t.replace(/Snow/gi, 'Schnee');
        t = t.replace(/Ice/gi, 'Eis');
        t = t.replace(/Thunderstorm/gi, 'Gewitter');
        t = t.replace(/Fog/gi, 'Nebel');
        t = t.replace(/Temperature/gi, 'Temperatur');
        t = t.replace(/Heat/gi, 'Hitze');
        t = t.replace(/Cold/gi, 'Kälte');
        t = t.replace(/Flood/gi, 'Flut');
        t = t.replace(/Forest Fire/gi, 'Waldbrand');
        t = t.replace(/Avalanche/gi, 'Lawinen');
        // Phrasing
        t = t.replace(/is effective on/gi, 'gültig ab');
        t = t.replace(/from/gi, 'von');
        t = t.replace(/to/gi, 'bis');

        return t;
    };

    // Monitor MeteoAlarm - REMOVED LOCAL NOTIFICATION LOGIC
    // Now handled by HA Automation via Helper check
    /*
    useEffect(() => {
        const checkWeather = async () => {
            // ... Removed ...
        };
        // checkWeather();
    }, [entities]);
    */

    // Initialize service
    useEffect(() => {
        serviceRef.current = new HomeAssistantService(handleStateChange);

        // Register connection listener to update state in real-time
        serviceRef.current.setConnectionCallback((connected) => {
            // console.log(`🔌 Connection Status Update: ${connected ? 'Connected' : 'Disconnected'}`);

            if (connected) {
                if (disconnectTimer.current) {
                    clearTimeout(disconnectTimer.current);
                    disconnectTimer.current = null;
                }
                setIsConnected(true);
            } else {
                // Debounce disconnect (2s)
                if (!disconnectTimer.current) {
                    disconnectTimer.current = setTimeout(() => {
                        setIsConnected(false);
                        disconnectTimer.current = null;
                        // console.log('🔌 Connection confirmed LOST after delay');
                    }, 2000);
                }
            }
        });

        // Define notification handler
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true
            }),
        });

        // Listen for foreground push notifications to trigger Doorbell Popup
        const doorbellPushSub = Notifications.addNotificationReceivedListener(notification => {
            const data = notification.request.content.data;
            const categoryKey = data?.category_key || '';
            if (categoryKey === 'doorbell' && !isDoorbellRinging) {
                console.log('🔔 DOORBELL PUSH received in foreground! Showing Popup.');
                setIsDoorbellRinging(true);
                setTimeout(() => setIsDoorbellRinging(false), 120000);
            }
        });

        // Register Action Category
        if (Platform.OS !== 'web') {
            Notifications.setNotificationCategoryAsync('DOOR_OPEN_ACTION', [
                {
                    identifier: 'open_door_btn',
                    buttonTitle: 'Haustüre öffnen',
                    options: {
                        opensAppToForeground: false, // Perform in background if supported, or true to open app
                    },
                },
            ]);
        }

        // Register Doorbell Action Category
        if (Platform.OS !== 'web') {
            Notifications.setNotificationCategoryAsync('DOORBELL_ACTION', [
                {
                    identifier: 'open_door_btn',
                    buttonTitle: 'Türe öffnen',
                    options: {
                        opensAppToForeground: false,
                    },
                },
            ]);
        }

        // Set up event callback for doorbell
        // Set up event callback for doorbell
        serviceRef.current.setEventCallback((event: any) => {
            // Check for specific doorbell event
            if (event.event_type === 'state_changed' &&
                event.data?.entity_id === 'event.hausture_klingeln') {

                const newState = event.data.new_state;
                // Only trigger if state is NOT unknown/unavailable and (optional) recently changed
                if (newState && newState.state !== 'unknown' && newState.state !== 'unavailable') {
                    console.log('🔔 DOORBELL RANG! Showing Popup.');
                    setIsDoorbellRinging(true);
                    // Auto-hide after 1 minute if no action taken (optional safety)
                    setTimeout(() => setIsDoorbellRinging(false), 60000);
                }
            }
        });

        // Check/Restore Geofencing
        checkGeofencingStatus();

        // Load Notification Settings
        (async () => {
            try {
                const stored = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
                if (stored) {
                    setNotificationSettingsState(JSON.parse(stored));
                }
            } catch (e) { console.warn('Failed search notif settings', e); }
        })();

        // Request notification permissions (token saving is handled by AuthContext)
        (async () => {
            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    if (status !== 'granted') {
                        console.log('Push notification permission not granted');
                    }
                }
            }
        })();

        // CRITICAL: Listen for Supabase Auth Changes to trigger HA Connect
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // console.log(`[HA Context] Auth Event: ${event}`);

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (session?.user) {
                    // console.log(`[HA Context] User is logged in (${session.user.email}). Attempting to fetch HA credentials...`);
                    const creds = await getCredentials();
                    if (creds) {
                        // console.log(`[HA Context] Credentials found. Connecting to ${creds.url}...`);
                        await connect();
                    } else {
                        // console.log('[HA Context] No HA credentials found in DB for this user.');
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                // console.log('[HA Context] User signed out. Disconnecting HA.');
                disconnect();
            }
        });

        // Initial check in case listener missed it (race condition)
        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const creds = await getCredentials(session.user.id);
                    if (creds) {
                        await connect(creds);
                    }
                }
            } finally {
                setIsHAInitialized(true);
            }
        })();

        return () => {
            serviceRef.current?.disconnect();
            subscription.unsubscribe();
            doorbellPushSub.remove();
        };
    }, []);

    // Save Settings Helper (Legacy wrapper if used elsewhere)
    /*
    const updateNotificationSettings = async (newSettings: NotificationSettings) => {
        setNotificationSettings(newSettings);
        await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(newSettings));
    };
    */

    // Monitor entities for notifications (Doors)
    useEffect(() => {
        if (entities.length === 0) return;
        if (!notificationSettings.enabled) return; // Master Switch Check

        // HYBRID SETUP: Logic moved to Home Assistant.
        // This effect is kept to avoid breaking hook rules, but returns early.
        return;

        // Specific door sensors to monitor - STRICTLY only Waschküche and Highlight as requested
        const binarySensors = entities.filter(e => {
            if (!e.entity_id.startsWith('binary_sensor.')) return false;
            const id = e.entity_id.toLowerCase();

            // Relaxed matching to ensure we catch variations like "highlight_tür" or "waschküchentür"
            return id.includes('highlight') || (id.includes('wasch') && (id.includes('tur') || id.includes('tür')));
        });

        // Log found sensors for debugging (only once when entities change significantly)
        if (binarySensors.length > 0 && Object.keys(prevDoorStates.current).length === 0) {
            console.log('🚪 Monitored door sensors:', binarySensors.map(s => `${s.entity_id} = ${s.state}`));
        }

        binarySensors.forEach(e => {
            const prevState = prevDoorStates.current[e.entity_id];
            const currentState = e.state; // 'on' = Open for binary_sensor

            // Detect transition Closed -> Open (off -> on)
            if (prevState === 'off' && currentState === 'on') {
                console.log(`🔔 Door opened: ${e.entity_id}`);

                // Check granular settings
                // "Türen UG" controls both Highlight and Waschkueche
                const isHighlight = e.entity_id.toLowerCase().includes('highlight');
                const isWaschkueche = e.entity_id.toLowerCase().includes('wasch');

                // If it's one of our targeted doors, check the master switch for UG Doors
                if ((isHighlight || isWaschkueche) && notificationSettings.security?.doors_ug === false) {
                    return;
                }

                // Get friendly name from entity or generate from ID
                const friendlyName = e.attributes.friendly_name ||
                    e.entity_id.replace('binary_sensor.', '').replace(/_/g, ' ');

                Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Security Center",
                        body: `${friendlyName} wurde geöffnet`,
                        sound: true,
                    },
                    trigger: null, // show immediately
                });
            }

            // Update ref
            prevDoorStates.current[e.entity_id] = currentState;
        });

    }, [entities, notificationSettings]); // Re-run when settings change

    // Sync Shopping List Count for Background Task
    useEffect(() => {
        const list = entities.find(e => e.entity_id === 'todo.google_keep_einkaufsliste');
        if (list && list.state) {
            AsyncStorage.setItem(SHOPPING_COUNT_KEY, list.state).catch(e => console.warn('Failed to save shop count', e));
        }
    }, [entities]);

    // Geofencing Logic
    const checkGeofencingStatus = async () => {
        if (Platform.OS === 'web') return;
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);
        setIsGeofencingActive(isRegistered);
    };

    const setHomeLocation = async () => {
        if (Platform.OS === 'web') {
            alert('Funktion im Web nicht verfügbar');
            return;
        }
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert('Standortberechtigung verweigert');
                return;
            }
            const bgStatus = await Location.requestBackgroundPermissionsAsync();
            if (bgStatus.status !== 'granted') {
                alert('Hintergrund-Standortberechtigung verweigert. Diese ist nötig für Geofencing.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            // Save Coords (optional, if we want to show map later)
            await AsyncStorage.setItem(HOME_COORDS_KEY, JSON.stringify({ latitude, longitude }));

            // Start Geofencing
            await Location.startGeofencingAsync(GEOFENCING_TASK, [
                {
                    identifier: 'home_region',
                    latitude,
                    longitude,
                    radius: 100, // 100 meters
                    notifyOnEnter: true,
                    notifyOnExit: true,
                }
            ]);

            setIsGeofencingActive(true);
            alert('Zuhause gesetzt! Du erhältst nun eine Benachrichtigung, wenn du heimkommst.');

        } catch (e: any) {
            console.error(e);
            alert('Fehler beim Setzen des Standorts: ' + e.message);
        }
    };

    const startShoppingGeofencing = async () => {
        if (Platform.OS === 'web') return;
        try {
            const { status } = await Location.requestBackgroundPermissionsAsync();
            if (status !== 'granted') {
                console.log("Bg Location not granted");
                return;
            }

            await Location.startLocationUpdatesAsync(SHOPPING_TASK, {
                accuracy: Location.Accuracy.Balanced,
                distanceInterval: 100, // Update every 100 meters
                deferredUpdatesInterval: 60000, // Minimum 1 minute between updates (on Android)
                showsBackgroundLocationIndicator: false,
            });
            console.log("🛒 Shopping Geofencing (Background Task) started");
        } catch (e: any) {
            // Suppress error in Expo Go client (expected due to missing background update permissions)
            if (Constants.appOwnership === 'expo') {
                // console.log("Shopping Geofence skipped in Expo Go:", e.message);
                return;
            }

            console.error("Failed to start shopping geofence", e);
            if (e?.message && e.message.includes('NSLocation')) {
                // Inform user about the need for a rebuild
                setTimeout(() => {
                    alert(
                        "Geofencing Fehler: Fehlende Berechtigungen.\n\n" +
                        "Bitte 'eas build --profile development --platform ios' ausführen, um die App mit den neuen Standort-Berechtigungen neu zu bauen."
                    );
                }, 1000);
            }
        }
    };

    // Save HA credentials to Supabase household
    const saveCredentials = async (url: string, token: string) => {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('No user logged in');
                return;
            }

            // Get user's household via family_members table
            const { data: memberData } = await supabase
                .from('family_members')
                .select('household_id')
                .eq('user_id', user.id)
                .single();

            if (memberData?.household_id) {
                // Update household with HA credentials
                const { error } = await supabase
                    .from('households')
                    .update({ ha_url: url, ha_token: token })
                    .eq('id', memberData.household_id);

                if (error) {
                    console.error('Failed to save HA credentials to household:', error);
                } else {
                    console.log('✅ HA credentials saved to household');
                }
                // ALWAYS Save to AsyncStorage as fallback/cache
                await AsyncStorage.setItem('@smarthome_ha_url', url);
                await AsyncStorage.setItem('@smarthome_ha_token', token);
            } else {
                // User not in a household, try to get the first household or fallback
                const { data: householdData } = await supabase
                    .from('households')
                    .select('id')
                    .limit(1)
                    .single();

                if (householdData?.id) {
                    await supabase
                        .from('households')
                        .update({ ha_url: url, ha_token: token })
                        .eq('id', householdData.id);
                    console.log('✅ HA credentials saved to default household');
                } else {
                    // Fallback to AsyncStorage if no household exists
                    await AsyncStorage.setItem('@smarthome_ha_url', url);
                    await AsyncStorage.setItem('@smarthome_ha_token', token);
                    console.log('⚠️ No household found, saved to local storage');
                }
            }
        } catch (e) {
            console.error('Error saving credentials:', e);
            // Fallback to AsyncStorage
            await AsyncStorage.setItem('@smarthome_ha_url', url);
            await AsyncStorage.setItem('@smarthome_ha_token', token);
        }
    };

    // Get HA credentials from Supabase household (or fallback to local)
    const getCredentials = async (userUuid?: string): Promise<{ url: string; token: string } | null> => {
        try {
            let userId = userUuid;
            if (!userId) {
                // Get current user if not provided
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                userId = currentUser?.id;
            }

            // console.log('[getCredentials] User ID:', userId || 'NOT LOGGED IN');

            if (!userId) {
                // Not logged in, try local storage
                const url = await AsyncStorage.getItem('@smarthome_ha_url');
                const token = await AsyncStorage.getItem('@smarthome_ha_token');
                // console.log('[getCredentials] No user, checking local storage:', url ? 'URL found' : 'No URL');
                if (url && token) return { url, token };
                return null;
            }

            // Get user's household via family_members table
            const { data: memberData, error: memberError } = await supabase
                .from('family_members')
                .select('household_id')
                .eq('user_id', userId)
                .single();

            // console.log('[getCredentials] family_members lookup:', memberData, memberError?.message);

            if (memberData?.household_id) {
                // Get household HA credentials
                const { data: householdData, error: householdError } = await supabase
                    .from('households')
                    .select('ha_url, ha_token, dashboard_config')
                    .eq('id', memberData.household_id)
                    .single();

                // console.log('[getCredentials] households lookup:', householdData?.ha_url ? 'URL found' : 'No URL', householdError?.message);

                if (householdData?.ha_url && householdData?.ha_token) {
                    // console.log('✅ Loaded HA credentials from household via family_members');
                    if (householdData.dashboard_config) {
                        setDashboardConfig(householdData.dashboard_config);
                    }
                    return { url: householdData.ha_url, token: householdData.ha_token };
                }
            } else {
                // No family_members entry - will fallback to AsyncStorage
                // console.log('[getCredentials] No family_members entry, trying fallbacks...');
            }

            // Fallback: try to get from any household
            const { data: householdData } = await supabase
                .from('households')
                .select('ha_url, ha_token, dashboard_config')
                .not('ha_url', 'is', null)
                .limit(1)
                .single();

            if (householdData?.ha_url && householdData?.ha_token) {
                // console.log('✅ Loaded HA credentials from default household');
                if (householdData.dashboard_config) {
                    setDashboardConfig(householdData.dashboard_config);
                }
                return { url: householdData.ha_url, token: householdData.ha_token };
            }

            // Final fallback to AsyncStorage
            const url = await AsyncStorage.getItem('@smarthome_ha_url');
            const token = await AsyncStorage.getItem('@smarthome_ha_token');
            if (url && token) {
                // console.log('⚠️ Loaded HA credentials from local storage');
                return { url, token };
            }

            return null;
        } catch (e) {
            console.error('Error getting credentials:', e);
            // Fallback to AsyncStorage
            const url = await AsyncStorage.getItem('@smarthome_ha_url');
            const token = await AsyncStorage.getItem('@smarthome_ha_token');
            if (url && token) return { url, token };
            return null;
        }
    };

    const connect = async (internalCreds?: { url: string; token: string }): Promise<boolean> => {
        let creds = internalCreds;
        if (!creds) {
            creds = await getCredentials();
        }

        if (!creds) {
            setError('Keine Home Assistant Zugangsdaten gespeichert');
            return false;
        }

        setIsConnecting(true);
        setError(null);

        try {
            // Clean the URL for storage
            let cleanUrl = creds.url.trim().replace(/\/$/, '');
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = 'http://' + cleanUrl;
            }
            setHaBaseUrl(cleanUrl); // Set base URL immediately
            setAuthToken(creds.token); // Save token to state

            // Cache credentials for Background Tasks (Geofencing)
            await AsyncStorage.setItem('@smarthome_ha_url', cleanUrl);
            await AsyncStorage.setItem('@smarthome_ha_token', creds.token);

            const success = await serviceRef.current!.connect(cleanUrl, creds.token);
            setIsConnected(success);
            if (!success) { // If connection failed, clear the token and URL
                setError('Verbindung fehlgeschlagen');
                setHaBaseUrl(null);
                setAuthToken(null);
            }
            return success;
        } catch (e: any) {
            setError(e.message || 'Verbindungsfehler');
            return false;
        } finally {
            setIsConnecting(false);
        }
    };

    // Auto-Sync on Auth Change & App State Change
    useEffect(() => {
        // 1. Auth Change
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN') {
                console.log('🔄 User signed in. Connecting...');
                connect();
            } else if (event === 'SIGNED_OUT') {
                console.log('👋 User signed out. Clearing HA data...');
                // Disconnect locally
                disconnect();

                // Clear all persistent storage related to HA
                try {
                    await AsyncStorage.multiRemove([
                        '@smarthome_ha_url',
                        '@smarthome_ha_token',
                        NOTIF_SETTINGS_KEY,
                        HOME_COORDS_KEY,
                        SHOPPING_COUNT_KEY,
                        SHOP_ENTRY_KEY,
                        IS_HOME_KEY,
                        METEO_WARNING_KEY
                    ]);
                    console.log('🧹 HA Credentials & Cache cleared.');
                } catch (e) {
                    console.error('Failed to clear HA storage:', e);
                }

                // Reset State
                setIsConnected(false);
                setHaBaseUrl(null);
                setAuthToken(null);
                setError(null);
                setEntities([]);
            }
        });

        // 2. App State Change (Reconnect on resume)
        const subscriptionAppState = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                // console.log('📱 App came to foreground. Checking connection...');
                if (!serviceRef.current?.isConnected()) {
                    console.log('🔌 Reconnecting to Home Assistant...');
                    setIsConnecting(true); // Prevent "Not Connected" flash
                    connect();
                }
                // Process any pending widget actions
                if (serviceRef.current?.isConnected()) {
                    const svc = serviceRef.current;
                    processWidgetPendingActions((domain, service, entityId, data) => {
                        return svc.callService(domain, service, entityId, data);
                    });
                }
            }
        });

        return () => {
            subscription.unsubscribe();
            subscriptionAppState.remove();
        };
    }, []);


    const disconnect = () => {
        serviceRef.current?.disconnect();
        setIsConnected(false);
        setEntities([]);
    };

    const toggleLight = (entityId: string) => {
        serviceRef.current?.toggleLight(entityId);
    };

    const setLightBrightness = (entityId: string, brightness: number) => {
        serviceRef.current?.setLightBrightness(entityId, brightness);
    };

    const openCover = (entityId: string) => {
        serviceRef.current?.openCover(entityId);
    };

    const closeCover = (entityId: string) => {
        serviceRef.current?.closeCover(entityId);
    };

    const setCoverPosition = (entityId: string, position: number) => {
        serviceRef.current?.setCoverPosition(entityId, position);
    };

    const stopCover = (entityId: string) => {
        serviceRef.current?.callService('cover', 'stop_cover', entityId);
    };

    const startVacuum = (entityId: string) => {
        serviceRef.current?.startVacuum(entityId);
    };

    const pauseVacuum = (entityId: string) => {
        serviceRef.current?.pauseVacuum(entityId);
    };

    const returnVacuum = (entityId: string) => {
        serviceRef.current?.returnVacuum(entityId);
    };

    const activateScene = (sceneId: string) => {
        serviceRef.current?.activateScene(sceneId);
    };

    const playMedia = (entityId: string, mediaContentId: string, mediaContentType: string) => {
        serviceRef.current?.playMedia(entityId, mediaContentId, mediaContentType);
    };

    const browseMedia = (entityId: string, mediaContentId?: string, mediaContentType?: string) => {
        return serviceRef.current?.browseMedia(entityId, mediaContentId, mediaContentType) || Promise.resolve(null);
    };

    const callService = useCallback((domain: string, service: string, entityId: string, data: any = {}) => {
        if (!serviceRef.current || !serviceRef.current.isConnected()) {
            // Silently ignore - connection will auto-recover
            return Promise.resolve();
        }
        return serviceRef.current.callService(domain, service, entityId, data);
    }, []);
    const setClimateTemperature = useCallback((entityId: string, temperature: number) => {
        serviceRef.current?.callService('climate', 'set_temperature', entityId, { temperature });
    }, []);

    const setCoverTiltPosition = useCallback((entityId: string, tilt_position: number) => {
        serviceRef.current?.callService('cover', 'set_cover_tilt_position', entityId, { tilt_position });
    }, []);

    const pressButton = useCallback((entityId: string) => {
        serviceRef.current?.callService('button', 'press', entityId);
    }, []);

    const setClimateHvacMode = useCallback((entityId: string, hvac_mode: string) => {
        serviceRef.current?.callService('climate', 'set_hvac_mode', entityId, { hvac_mode: hvac_mode });
    }, []);

    const getEntityPictureUrl = (entityPicture: string | undefined): string | undefined => {
        if (!entityPicture) return undefined;
        // If already absolute URL, return as-is
        if (entityPicture.startsWith('http://') || entityPicture.startsWith('https://')) {
            return entityPicture;
        }
        // Construct full URL using HA base URL
        if (haBaseUrl && serviceRef.current?.token) {
            // Append token for authentication if needed (especially for camera streams)
            // HA supports ?token=... for some endpoints, but for security it's better to just relay usage 
            // However, for <Image> components we can't easily add headers.
            // A common workaround for HA images is using the &token= query param if the integration supports it, 
            // or relying on the session if the user was logged in via webview (which we aren't).
            // 
            // Actually, HA Long-Lived Access Tokens cannot be passed via query param for all endpoints.
            // BUT: Camera entities often update their `entity_picture` attribute to include a short-lived `token` valid for that session context.
            // If the entity_picture ALREADY has a token (e.g. from camera entity attribute), we don't need to do anything.

            // Let's check if it already has a query param
            const joinChar = entityPicture.includes('?') ? '&' : '?';

            // NOTE: The Long-Lived Token is NOT accepted in query params for core API images usually.
            // BUT: Camera entities often update their `entity_picture` attribute to include a short-lived `token` valid for that session context.
            // If the Image fails to load, it might be because the HA instance requires auth headers which <Image> doesn't send.

            // STRATEGY CHANGE: We will NOT append the long-lived token here (security risk + might not work).
            // Instead, we trust the `entity_picture` attribute from the entity state, which normally contains a signed temp token.
            // If that fails, the user might need to use a WebView or a specialized Player.

            // Wait, for standard Lovelace behavior, the frontend API often handles this. 
            // For external apps, passing the LLAT in the URL is unsupported by HA core for security.
            // 
            // Code Modification: Just return the full URL. If it fails, we might need a custom Image component that sends headers.
            return `${haBaseUrl}${entityPicture}`;
        }
        return entityPicture;
    };

    const fetchCalendarEvents = useCallback(async (entityId: string, start: string, end: string) => {
        if (!serviceRef.current) return [];
        return await serviceRef.current.fetchCalendarEvents(entityId, start, end);
    }, []);

    const value = {
        entities,
        isConnected,
        isConnecting,
        error,
        haBaseUrl,
        authToken, // Expose
        connect,
        disconnect,
        toggleLight,
        setLightBrightness,
        openCover,
        closeCover,
        setCoverPosition,
        stopCover,
        setCoverTiltPosition,
        pressButton,
        startVacuum,
        pauseVacuum,
        returnVacuum,
        activateScene,
        setClimateTemperature,
        setClimateHvacMode,
        playMedia,
        browseMedia,
        callService,
        saveCredentials,
        getCredentials,
        getEntityPictureUrl,
        notificationSettings,
        updateNotificationSettings,
        fetchCalendarEvents,
        setHomeLocation,
        isGeofencingActive,
        fetchTodoItems: async (entityId: string) => {
            const items = await serviceRef.current?.fetchTodoItems(entityId) || [];
            if (entityId === 'todo.google_keep_einkaufsliste') {
                const count = items.filter((i: any) => i.status === 'needs_action').length;
                AsyncStorage.setItem(SHOPPING_COUNT_KEY, count.toString());
            }
            return items;
        },
        updateTodoItem: async (entityId: string, item: string, status: any) => serviceRef.current?.updateTodoItem(entityId, item, status),
        addTodoItem: async (entityId: string, item: string) => serviceRef.current?.addTodoItem(entityId, item),
        shoppingListVisible,
        setShoppingListVisible,
        startShoppingGeofencing,
        fetchWeatherForecast: async (entityId: string, forecastType: 'daily' | 'hourly' = 'daily') => serviceRef.current?.fetchWeatherForecast(entityId, forecastType) || [],
        debugShoppingLogic: async () => {
            try {
                // 1. Check Permissions
                const { status } = await Location.getForegroundPermissionsAsync();
                const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();

                // 2. Check Stored Count
                const countStr = await AsyncStorage.getItem(SHOPPING_COUNT_KEY);

                // 3. Get Location & Reverse Geocode
                const loc = await Location.getCurrentPositionAsync({});
                const addresses = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });

                let match = 'NO MATCH';
                let shopData = '';

                if (addresses.length > 0) {
                    const addr = addresses[0];
                    const name = (addr.name || '').toLowerCase();
                    const street = (addr.street || '').toLowerCase();
                    const city = (addr.city || '').toLowerCase();

                    shopData = `Name: ${addr.name}\nStreet: ${addr.street}\nCity: ${addr.city}`;

                    const matchingShop = TARGET_SHOPS.find(shop =>
                        name.includes(shop) || street.includes(shop)
                    );

                    if (matchingShop) match = `YES (${matchingShop})`;
                }

                Alert.alert(
                    "🛒 Shopping Debug",
                    `List Count (Stored): ${countStr || 'NULL'}\n\n` +
                    `Permissions: FG=${status}, BG=${bgStatus}\n\n` +
                    `Location: ${match}\n` +
                    `----------------\n` +
                    shopData
                );

            } catch (e: any) {
                Alert.alert("Debug Error", e.message);
            }
        },
        getExpoPushToken: () => expoPushToken,
        isDoorbellRinging,
        setIsDoorbellRinging,
        dashboardConfig,
        isHAInitialized,
        saveDashboardConfig: async (config: any) => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: memberData } = await supabase
                    .from('family_members')
                    .select('household_id')
                    .eq('user_id', user.id)
                    .single();
                if (memberData?.household_id) {
                    await supabase
                        .from('households')
                        .update({ dashboard_config: config })
                        .eq('id', memberData.household_id);
                    setDashboardConfig(config);
                }
            } catch (e) {
                console.error('Failed to save dashboard config:', e);
            }
        }
    };

    return (
        <HomeAssistantContext.Provider value={value}>
            {children}
        </HomeAssistantContext.Provider>
    );
}


export function useHomeAssistant() {
    const context = useContext(HomeAssistantContext);
    if (context === undefined) {
        throw new Error('useHomeAssistant must be used within a HomeAssistantProvider');
    }
    return context;
}

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { HomeAssistantService } from '../services/homeAssistant';
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

// Shops to trigger notification
const TARGET_SHOPS = ['coop', 'migros', 'volg', 'aldi', 'lidl', 'kaufland', 'denner'];

// Define the background task for Shopping
TaskManager.defineTask(SHOPPING_TASK, async ({ data, error }: any) => {
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

            // 2. Reverse Geocode to check if we are at a shop
            const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });

            if (addresses && addresses.length > 0) {
                const address = addresses[0];
                const name = (address.name || '').toLowerCase();
                const street = (address.street || '').toLowerCase();

                // Check if any target shop name is present in the address name or street (sometimes reliable)
                // Note: Address.name often contains the POI name (e.g. "Coop Supermarkt")
                const matchingShop = TARGET_SHOPS.find(shop =>
                    name.includes(shop) || street.includes(shop)
                );

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
            }

        } catch (e) {
            console.error("Shopping Task Logic Error:", e);
        }
    }
});

// Define the background task
TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }: any) => {
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
    connect: () => Promise<boolean>;
    disconnect: () => void;
    toggleLight: (entityId: string) => void;
    setLightBrightness: (entityId: string, brightness: number) => void;
    openCover: (entityId: string) => void;
    closeCover: (entityId: string) => void;
    setCoverPosition: (entityId: string, position: number) => void;
    startVacuum: (entityId: string) => void;
    pauseVacuum: (entityId: string) => void;
    returnVacuum: (entityId: string) => void;
    activateScene: (sceneId: string) => void;
    setClimateTemperature: (entityId: string, temperature: number) => void;
    setClimateHvacMode: (entityId: string, mode: string) => void;
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
        }
    });

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
            } catch (e) {
                console.warn('Failed to sync settings with HA', e);
            }
        } else {
            console.log('Skipping HA Sync - Connected:', isConnected, 'Helpers:', !!helperIds);
        }
    };
    const [isGeofencingActive, setIsGeofencingActive] = useState(false);
    const [shoppingListVisible, setShoppingListVisible] = useState(false);
    const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Register for Push Notifications
    useEffect(() => {
        registerForPushNotificationsAsync().then(token => setExpoPushToken(token ?? null));
    }, []);

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
            console.log("🔥 Expo Push Token:", token);
            return token;
        } catch (e) {
            console.error("Error getting push token:", e);
        }
    }

    useEffect(() => {
        console.log("🔵 HomeAssistantProvider MOUNTED");
        return () => {
            console.log("🔴 HomeAssistantProvider UNMOUNTED - This causes disconnect!");
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
        setEntities(newEntities);
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
                        console.log('🔌 Connection confirmed LOST after delay');
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

        // Register Action Category
        Notifications.setNotificationCategoryAsync('DOOR_OPEN_ACTION', [
            {
                identifier: 'open_door_btn',
                buttonTitle: 'Haustüre öffnen',
                options: {
                    opensAppToForeground: false, // Perform in background if supported, or true to open app
                },
            },
        ]);

        // Register Doorbell Action Category
        Notifications.setNotificationCategoryAsync('DOORBELL_ACTION', [
            {
                identifier: 'open_door_btn',
                buttonTitle: 'Türe öffnen',
                options: {
                    opensAppToForeground: false,
                },
            },
        ]);

        // Set up event callback for doorbell
        // REMOVED LOCAL NOTIFICATION LOGIC - Handled by HA Automation
        serviceRef.current.setEventCallback((event: any) => {
            // We can still log it or use it for in-app UI updates if needed
            if (event.event_type === 'state_changed' &&
                event.data?.entity_id === 'event.hausture_klingeln') {
                console.log('🔔 Doorbell event received (Logic moved to HA)');
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
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // console.log('[HA Context] Initial session check: User logged in. Checking credentials...');
                const creds = await getCredentials();
                if (creds) {
                    connect();
                }
            }
        })();

        return () => {
            serviceRef.current?.disconnect();
            subscription.unsubscribe();
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
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);
        setIsGeofencingActive(isRegistered);
    };

    const setHomeLocation = async () => {
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
                console.log("Shopping Geofence skipped in Expo Go:", e.message);
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
                    // Fallback to AsyncStorage
                    await AsyncStorage.setItem('@smarthome_ha_url', url);
                    await AsyncStorage.setItem('@smarthome_ha_token', token);
                } else {
                    console.log('✅ HA credentials saved to household');
                }
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
    const getCredentials = async (): Promise<{ url: string; token: string } | null> => {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            // console.log('[getCredentials] User:', user?.email || 'NOT LOGGED IN');

            if (!user) {
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
                .eq('user_id', user.id)
                .single();

            // console.log('[getCredentials] family_members lookup:', memberData, memberError?.message);

            if (memberData?.household_id) {
                // Get household HA credentials
                const { data: householdData, error: householdError } = await supabase
                    .from('households')
                    .select('ha_url, ha_token')
                    .eq('id', memberData.household_id)
                    .single();

                // console.log('[getCredentials] households lookup:', householdData?.ha_url ? 'URL found' : 'No URL', householdError?.message);

                if (householdData?.ha_url && householdData?.ha_token) {
                    // console.log('✅ Loaded HA credentials from household via family_members');
                    return { url: householdData.ha_url, token: householdData.ha_token };
                }
            } else {
                // No family_members entry - will fallback to AsyncStorage
                // console.log('[getCredentials] No family_members entry, trying fallbacks...');
            }

            // Fallback: try to get from any household
            const { data: householdData } = await supabase
                .from('households')
                .select('ha_url, ha_token')
                .not('ha_url', 'is', null)
                .limit(1)
                .single();

            if (householdData?.ha_url && householdData?.ha_token) {
                // console.log('✅ Loaded HA credentials from default household');
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

    const connect = async (): Promise<boolean> => {
        const creds = await getCredentials();
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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                console.log('🔄 User signed in. Connecting...');
                connect();
            }
        });

        // 2. App State Change (Reconnect on resume)
        const subscriptionAppState = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                console.log('📱 App came to foreground. Checking connection...');
                if (!serviceRef.current?.isConnected()) {
                    console.log('🔌 Reconnecting to Home Assistant...');
                    setIsConnecting(true); // Prevent "Not Connected" flash
                    connect();
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
            console.warn('Cannot call service - HA not connected');
            return;
        }
        serviceRef.current.callService(domain, service, entityId, data);
    }, []);
    const setClimateTemperature = (entityId: string, temperature: number) => {
        serviceRef.current?.callService('climate', 'set_temperature', entityId, { temperature });
    };

    const setClimateHvacMode = (entityId: string, mode: string) => {
        serviceRef.current?.callService('climate', 'set_hvac_mode', entityId, { hvac_mode: mode });
    };

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
            // But `entity_picture` for cameras often points to `/api/camera_proxy/...?token=...` which is a temporary token generated by HA.
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
        fetchTodoItems: async (entityId: string) => serviceRef.current?.fetchTodoItems(entityId) || [],
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
        getExpoPushToken: () => expoPushToken
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

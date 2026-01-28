import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeAssistantService } from '../services/homeAssistant';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';

const GEOFENCING_TASK = 'GEOFENCING_TASK';
const SHOPPING_TASK = 'SHOPPING_TASK';
const HOME_COORDS_KEY = '@smarthome_home_coords';
const SHOPPING_COUNT_KEY = '@smarthome_shopping_count';
const SHOP_ENTRY_KEY = '@smarthome_shop_entry';

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
    if (data.eventType === Location.GeofencingEventType.Enter) {
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
}

const HomeAssistantContext = createContext<HomeAssistantContextType | undefined>(undefined);

const NOTIF_SETTINGS_KEY = '@smarthome_notif_settings';

export interface NotificationSettings {
    enabled: boolean;
    doors: {
        highlight: boolean;
        waschkueche: boolean;
        [key: string]: boolean;
    };
}

export function HomeAssistantProvider({ children }: { children: React.ReactNode }) {

    const [entities, setEntities] = useState<EntityState[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [haBaseUrl, setHaBaseUrl] = useState<string | null>(null);
    const serviceRef = useRef<HomeAssistantService | null>(null);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        enabled: true,
        doors: {
            highlight: true,
            waschkueche: true
        }
    });
    const [isGeofencingActive, setIsGeofencingActive] = useState(false);
    const [shoppingListVisible, setShoppingListVisible] = useState(false);

    // Notification Response Listener
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const actionId = response.actionIdentifier;
            if (actionId === 'open_door_btn' || (response.notification.request.content.categoryIdentifier === 'DOOR_OPEN_ACTION' && actionId === Notifications.DEFAULT_ACTION_IDENTIFIER)) {
                // Handle Action
                handleDoorOpenAction();
            }
            if (response.notification.request.content.categoryIdentifier === 'SHOPPING_ACTION') {
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
            Notifications.scheduleNotificationAsync({
                content: { title: "Haustür", body: "Öffnen Befehl gesendet.", sound: false },
                trigger: null
            });
        }
    };

    const handleStateChange = useCallback((newEntities: any[]) => {
        setEntities(newEntities);
    }, []);

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

    // Monitor MeteoAlarm
    useEffect(() => {
        if (!entities.length) return;

        const meteoData = entities.find(e => e.entity_id === 'binary_sensor.meteoalarm');
        if (meteoData) {
            const currentState = meteoData.state;
            const lastState = prevMeteoState.current;

            // Only notify if it turned ON or attributes changed meaningfully while ON (simplified: just checking ON transition for now)
            if (currentState === 'on' && lastState !== 'on') {
                const headline = meteoData.attributes.headline || 'Wetterwarnung';
                const description = meteoData.attributes.description || '';
                const effective = meteoData.attributes.effective || '';

                const titleDE = translateWeather(headline);
                const descDE = translateWeather(description);
                // Simple effective date formatting if it's a timestamp
                const effectiveDE = effective ? new Date(effective).toLocaleString('de-CH') : '';

                const body = `${descDE} ${effectiveDE ? `(gültig ab ${effectiveDE})` : ''}`;

                Notifications.scheduleNotificationAsync({
                    content: {
                        title: titleDE,
                        body: body,
                        sound: true,
                        data: { type: 'weather_warning' }
                    },
                    trigger: null
                });
            }
            prevMeteoState.current = currentState;
        }
    }, [entities]);

    // Initialize service
    useEffect(() => {
        serviceRef.current = new HomeAssistantService(handleStateChange);

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

        // Check/Restore Geofencing
        checkGeofencingStatus();

        // Load Notification Settings
        (async () => {
            try {
                const stored = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
                if (stored) {
                    setNotificationSettings(JSON.parse(stored));
                }
            } catch (e) { console.warn('Failed search notif settings', e); }
        })();

        // Request permissions
        (async () => {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
                console.log('Notification permissions not granted');
            }
        })();

        // Try to auto-connect with saved credentials
        (async () => {
            const creds = await getCredentials();
            if (creds) {
                connect();
            }
        })();

        return () => {
            serviceRef.current?.disconnect();
        };
    }, []);

    // Save Settings Helper
    const updateNotificationSettings = async (newSettings: NotificationSettings) => {
        setNotificationSettings(newSettings);
        await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(newSettings));
    };

    // Monitor entities for notifications (Doors)
    useEffect(() => {
        if (entities.length === 0) return;
        if (!notificationSettings.enabled) return; // Master Switch Check

        // Specific door sensors to monitor - STRICTLY only Waschküche and Highlight as requested
        const binarySensors = entities.filter(e => {
            if (!e.entity_id.startsWith('binary_sensor.')) return false;
            const id = e.entity_id.toLowerCase();

            // Only allow these two specific doors
            return id.includes('waschkuchenture') || id.includes('highlighttur');
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
                const isHighlight = e.entity_id.toLowerCase().includes('highlight');
                const isWaschkueche = e.entity_id.toLowerCase().includes('wasch');

                if (isHighlight && notificationSettings.doors.highlight === false) return;
                if (isWaschkueche && notificationSettings.doors.waschkueche === false) return;

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
                    notifyOnExit: false,
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
            if (!user) {
                // Not logged in, try local storage
                const url = await AsyncStorage.getItem('@smarthome_ha_url');
                const token = await AsyncStorage.getItem('@smarthome_ha_token');
                if (url && token) return { url, token };
                return null;
            }

            // Get user's household via family_members table
            const { data: memberData } = await supabase
                .from('family_members')
                .select('household_id')
                .eq('user_id', user.id)
                .single();

            if (memberData?.household_id) {
                // Get household HA credentials
                const { data: householdData } = await supabase
                    .from('households')
                    .select('ha_url, ha_token')
                    .eq('id', memberData.household_id)
                    .single();

                if (householdData?.ha_url && householdData?.ha_token) {
                    console.log('✅ Loaded HA credentials from household');
                    return { url: householdData.ha_url, token: householdData.ha_token };
                }
            }

            // Fallback: try to get from any household
            const { data: householdData } = await supabase
                .from('households')
                .select('ha_url, ha_token')
                .not('ha_url', 'is', null)
                .limit(1)
                .single();

            if (householdData?.ha_url && householdData?.ha_token) {
                console.log('✅ Loaded HA credentials from default household');
                return { url: householdData.ha_url, token: householdData.ha_token };
            }

            // Final fallback to AsyncStorage
            const url = await AsyncStorage.getItem('@smarthome_ha_url');
            const token = await AsyncStorage.getItem('@smarthome_ha_token');
            if (url && token) {
                console.log('⚠️ Loaded HA credentials from local storage');
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

            const success = await serviceRef.current!.connect(creds.url, creds.token);
            setIsConnected(success);
            if (success) {
                setHaBaseUrl(cleanUrl);
            } else {
                setError('Verbindung fehlgeschlagen');
            }
            return success;
        } catch (e: any) {
            setError(e.message || 'Verbindungsfehler');
            return false;
        } finally {
            setIsConnecting(false);
        }
    };


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

    const callService = (domain: string, service: string, entityId: string, data?: any) => {
        serviceRef.current?.callService(domain, service, entityId, data);
    };

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
        if (haBaseUrl) {
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
        startShoppingGeofencing
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

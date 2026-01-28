import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeAssistantService } from '../services/homeAssistant';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const GEOFENCING_TASK = 'GEOFENCING_TASK';
const HOME_COORDS_KEY = '@smarthome_home_coords';

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
}

const HomeAssistantContext = createContext<HomeAssistantContextType | undefined>(undefined);

const HA_URL_KEY = '@smarthome_ha_url';
const HA_TOKEN_KEY = '@smarthome_ha_token';
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

    // Notification Response Listener
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const actionId = response.actionIdentifier;
            if (actionId === 'open_door_btn' || (response.notification.request.content.categoryIdentifier === 'DOOR_OPEN_ACTION' && actionId === Notifications.DEFAULT_ACTION_IDENTIFIER)) {
                // Handle Action
                handleDoorOpenAction();
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

        // Specific Targets provided by user
        const targetIds = {
            'binary_sensor.waschkuchenture': 'Waschküche',
            'binary_sensor.highlighttur': 'Highlight'
        };

        const targets = entities.filter(e => Object.keys(targetIds).includes(e.entity_id));

        targets.forEach(e => {
            const prevState = prevDoorStates.current[e.entity_id];
            const currentState = e.state; // 'on' = Open for binary_sensor

            // Detect transition Closed -> Open (off -> on)
            if (prevState === 'off' && currentState === 'on') {

                // Check granular settings
                // We map both to 'security' or specific keys if we had them.
                // Assuming 'security' cover these doors or checking explicitly.
                // For now, let's assume if it's in the list, we want it unless security is off.
                // (Optional: add specific settings keys for them later if needed)
                if (notificationSettings.doors.highlight === false && e.entity_id.includes('highlight')) return;
                if (notificationSettings.doors.waschkueche === false && e.entity_id.includes('wasch')) return;

                const friendlyName = targetIds[e.entity_id as keyof typeof targetIds];

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

    const saveCredentials = async (url: string, token: string) => {
        await AsyncStorage.setItem(HA_URL_KEY, url);
        await AsyncStorage.setItem(HA_TOKEN_KEY, token);
    };

    const getCredentials = async () => {
        const url = await AsyncStorage.getItem(HA_URL_KEY);
        const token = await AsyncStorage.getItem(HA_TOKEN_KEY);
        if (url && token) {
            return { url, token };
        }
        return null;
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
        addTodoItem: async (entityId: string, item: string) => serviceRef.current?.addTodoItem(entityId, item)
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

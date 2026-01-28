import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeAssistantService } from '../services/homeAssistant';
import * as Notifications from 'expo-notifications';

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
        fetchCalendarEvents
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

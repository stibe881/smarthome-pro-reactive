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

    // Monitor entities for notifications
    useEffect(() => {
        if (entities.length === 0) return;
        if (!notificationSettings.enabled) return; // Master Switch Check

        // Find targets
        const targets = entities.filter(e => {
            const id = e.entity_id.toLowerCase();
            const name = (e.attributes.friendly_name || '').toLowerCase();

            // Check specific toggles
            const matchesHighlight = (id.includes('highlight') || name.includes('highlight'));
            const matchesWasch = (name.includes('wasch') && name.includes('tür')) || (id.includes('wasch') && id.includes('door'));

            if (matchesHighlight && !notificationSettings.doors.highlight) return false;
            if (matchesWasch && !notificationSettings.doors.waschkueche) return false;

            // Must be binary_sensor (contact) or lock? User said "geöffnet" (opened).
            // Usually binary_sensor is for open/close. Lock is for locked/unlocked.
            // Let's assume binary_sensor first, or covers/locks if no sensors found.
            // Also user said "Highlight Türe", could be a lock too.
            // We'll monitor both binary_sensor (on=open) and lock (unlocked).
            // BUT "opened" implies physical open.
            const isContact = e.entity_id.startsWith('binary_sensor.') && e.attributes.device_class === 'door';
            const isGenericContact = e.entity_id.startsWith('binary_sensor.') && (name.includes('tür') || name.includes('door')); // sometimes device_class is missing

            // If it's a lock, "opened" might mean unlocked, but usually people say "unlocked".
            // "Geöffnet" = Open.
            // Let's stick to binary_sensors for "Open" events if possible.
            return (matchesHighlight || matchesWasch) && (isContact || isGenericContact);
        });

        targets.forEach(e => {
            const prevState = prevDoorStates.current[e.entity_id];
            const currentState = e.state; // 'on' usually means Open for binary_sensor.door

            // Detect transition Closed -> Open (off -> on)
            if (prevState === 'off' && currentState === 'on') {
                const friendlyName = e.attributes.friendly_name || 'Türe';
                Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Tür geöffnet!",
                        body: `${friendlyName} wurde geöffnet.`,
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

    return (
        <HomeAssistantContext.Provider value={{
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
            getEntityPictureUrl
        }}>
            {children}
        </HomeAssistantContext.Provider>
    );
}


export function useHomeAssistant() {
    const context = useContext(HomeAssistantContext);
    if (!context) {
        throw new Error('useHomeAssistant must be used within HomeAssistantProvider');
    }
    return context;
}

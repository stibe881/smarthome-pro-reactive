import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface KidsRoom {
    id: string;
    name: string;
    lightEntity?: string;
    mediaEntity?: string;
    climateEntity?: string;
    dndEntity?: string;
    sleepTrainerEntity?: string;
    rewardEntity?: string;
    backgroundUri?: string;
    volumeLimit: number;
    tempRange: [number, number];
    score: number;
}

interface KidsConfig {
    rooms: KidsRoom[];
    activeRoomId?: string;
    parentalPin: string;
}

interface KidsContextType {
    isKidsModeActive: boolean;
    setKidsModeActive: (active: boolean) => void;
    config: KidsConfig;
    updateConfig: (newConfig: Partial<KidsConfig>) => Promise<void>;
    updateRoom: (roomId: string, updates: Partial<KidsRoom>) => Promise<void>;
    addRoom: (name: string) => Promise<void>;
    deleteRoom: (roomId: string) => Promise<void>;
    selectRoom: (roomId: string) => Promise<void>;
    addScore: (points: number) => Promise<void>;
    resetScore: (roomId: string) => Promise<void>;
}

const KIDS_MODE_KEY = '@smarthome_kids_mode_active';
const KIDS_CONFIG_KEY = '@smarthome_kids_config';
const KIDS_SCORE_KEY = '@smarthome_kids_score';

const DEFAULT_CONFIG: KidsConfig = {
    rooms: [],
    parentalPin: '1234',
};

const KidsContext = createContext<KidsContextType | undefined>(undefined);

export const KidsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isKidsModeActive, setIsKidsModeActiveState] = useState(false);
    const [config, setConfig] = useState<KidsConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const active = await AsyncStorage.getItem(KIDS_MODE_KEY);
            const savedConfig = await AsyncStorage.getItem(KIDS_CONFIG_KEY);
            const savedScore = await AsyncStorage.getItem(KIDS_SCORE_KEY);

            if (active !== null) setIsKidsModeActiveState(JSON.parse(active));

            if (savedConfig !== null) {
                let parsedConfig = JSON.parse(savedConfig);

                // Migration logic: if old config detected (has exitPin directly)
                if (parsedConfig.exitPin && !parsedConfig.rooms) {
                    const migratedRoom: KidsRoom = {
                        id: 'default',
                        name: 'Kinderzimmer',
                        lightEntity: parsedConfig.lightEntity,
                        mediaEntity: parsedConfig.mediaEntity,
                        climateEntity: parsedConfig.climateEntity,
                        sleepTrainerEntity: parsedConfig.sleepTrainerEntity,
                        backgroundUri: parsedConfig.backgroundUri,
                        volumeLimit: parsedConfig.volumeLimit || 0.4,
                        tempRange: parsedConfig.tempRange || [19, 22],
                        score: savedScore ? JSON.parse(savedScore) : 0 // Migrate score
                    };
                    parsedConfig = {
                        rooms: [migratedRoom],
                        activeRoomId: 'default',
                        parentalPin: parsedConfig.exitPin,
                    };
                    await AsyncStorage.setItem(KIDS_CONFIG_KEY, JSON.stringify(parsedConfig));
                }
                // Migration: Ensure all rooms have a score
                else if (parsedConfig.rooms) {
                    parsedConfig.rooms = parsedConfig.rooms.map((r: any) => ({
                        ...r,
                        score: r.score ?? 0
                    }));
                }
                setConfig(parsedConfig);
            }
        } catch (e) {
            console.error('Failed to load Kids Mode data:', e);
        }
    };

    const setKidsModeActive = async (active: boolean) => {
        // 1. Update Config State FIRST if activating
        if (active) {
            const updated = { ...config, activeRoomId: undefined };
            setConfig(updated);
            await AsyncStorage.setItem(KIDS_CONFIG_KEY, JSON.stringify(updated));
        }

        // 2. Then activate Global Mode
        setIsKidsModeActiveState(active);
        await AsyncStorage.setItem(KIDS_MODE_KEY, JSON.stringify(active));
    };

    const updateConfig = async (newConfig: Partial<KidsConfig>) => {
        const updated = { ...config, ...newConfig };
        setConfig(updated);
        await AsyncStorage.setItem(KIDS_CONFIG_KEY, JSON.stringify(updated));
    };

    const updateRoom = async (roomId: string, updates: Partial<KidsRoom>) => {
        const updatedRooms = config.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r);
        const updated = { ...config, rooms: updatedRooms };
        setConfig(updated);
        await AsyncStorage.setItem(KIDS_CONFIG_KEY, JSON.stringify(updated));
    };

    const addRoom = async (name: string) => {
        const newRoom: KidsRoom = {
            id: Date.now().toString(),
            name,
            volumeLimit: 0.4,
            tempRange: [19, 22],
            score: 0
        };
        const updatedConfig = { ...config, rooms: [...config.rooms, newRoom] };
        await updateConfig(updatedConfig);
    };

    const deleteRoom = async (roomId: string) => {
        const updatedRooms = config.rooms.filter(r => r.id !== roomId);
        const updated = {
            ...config,
            rooms: updatedRooms,
            activeRoomId: config.activeRoomId === roomId ? undefined : config.activeRoomId
        };
        setConfig(updated);
        await AsyncStorage.setItem(KIDS_CONFIG_KEY, JSON.stringify(updated));
    };

    const selectRoom = async (roomId: string) => {
        const updated = { ...config, activeRoomId: roomId };
        setConfig(updated);
        await AsyncStorage.setItem(KIDS_CONFIG_KEY, JSON.stringify(updated));
    };

    const addScore = async (points: number) => {
        if (!config.activeRoomId) return;

        const updatedRooms = config.rooms.map(room => {
            if (room.id === config.activeRoomId) {
                const newScore = Math.max(0, (room.score || 0) + points);
                return { ...room, score: newScore };
            }
            return room;
        });

        const updatedConfig = { ...config, rooms: updatedRooms };
        setConfig(updatedConfig); // Optimistic update
        await AsyncStorage.setItem(KIDS_CONFIG_KEY, JSON.stringify(updatedConfig));
    };

    const resetScore = async (roomId: string) => {
        const updatedRooms = config.rooms.map(room => {
            if (room.id === roomId) {
                return { ...room, score: 0 };
            }
            return room;
        });
        const updatedConfig = { ...config, rooms: updatedRooms };
        await updateConfig(updatedConfig);
    };

    return (
        <KidsContext.Provider value={{
            isKidsModeActive,
            setKidsModeActive,
            config,
            updateConfig,
            updateRoom,
            addRoom,
            deleteRoom,
            selectRoom,
            addScore,
            resetScore
        }}>
            {children}
        </KidsContext.Provider>
    );
};

export const useKidsMode = () => {
    const context = useContext(KidsContext);
    if (context === undefined) {
        throw new Error('useKidsMode must be used within a KidsProvider');
    }
    return context;
};

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';

const STORAGE_KEY = '@sleep_timer_state';

interface SleepTimerState {
    activeDuration: number | null;
    remaining: number | null;
    isRunning: boolean;
    startTimer: (min: number) => void;
    stopTimer: () => void;
}

const SleepTimerContext = createContext<SleepTimerState>({
    activeDuration: null,
    remaining: null,
    isRunning: false,
    startTimer: () => {},
    stopTimer: () => {},
});

export function SleepTimerProvider({ children }: { children: React.ReactNode }) {
    const { callService, entities } = useHomeAssistant();

    const [timerEnd, setTimerEnd] = useState<number | null>(null);
    const [activeDuration, setActiveDuration] = useState<number | null>(null);
    const [remaining, setRemaining] = useState<number | null>(null);

    // Load persisted state on mount
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const data = JSON.parse(raw);
                    if (data.endTime > Date.now()) {
                        setTimerEnd(data.endTime);
                        setActiveDuration(data.duration);
                        setRemaining(Math.ceil((data.endTime - Date.now()) / 60000));
                    } else {
                        await AsyncStorage.removeItem(STORAGE_KEY);
                    }
                }
            } catch { }
        })();
    }, []);

    // Sync with HA script state
    useEffect(() => {
        const script = entities.find((e: any) => e.entity_id === 'script.sleep_timer');
        if (script && script.state === 'off' && timerEnd) {
            setTimerEnd(null);
            setActiveDuration(null);
            setRemaining(null);
            AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
    }, [entities]);

    // Countdown
    useEffect(() => {
        if (!timerEnd) return;
        const tick = () => {
            const left = Math.ceil((timerEnd - Date.now()) / 60000);
            if (left <= 0) {
                setRemaining(0);
                setTimerEnd(null);
                AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
            } else {
                setRemaining(left);
            }
        };
        tick();
        const interval = setInterval(tick, 30000);
        return () => clearInterval(interval);
    }, [timerEnd]);

    const startTimer = useCallback((min: number) => {
        const end = Date.now() + min * 60000;
        setTimerEnd(end);
        setActiveDuration(min);
        setRemaining(min);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ endTime: end, duration: min })).catch(() => {});
        callService('script', 'turn_on', 'script.sleep_timer', {
            variables: { duration: min, entity_id: 'media_player.shield_schlafzimmer' }
        });
    }, [callService]);

    const stopTimer = useCallback(() => {
        setTimerEnd(null);
        setActiveDuration(null);
        setRemaining(null);
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        callService('script', 'turn_on', 'script.sleep_timer_cancel', {
            variables: { entity_id: 'media_player.shield_schlafzimmer' }
        });
    }, [callService]);

    const value = useMemo(() => ({
        activeDuration,
        remaining,
        isRunning: !!timerEnd,
        startTimer,
        stopTimer,
    }), [activeDuration, remaining, timerEnd, startTimer, stopTimer]);

    return (
        <SleepTimerContext.Provider value={value}>
            {children}
        </SleepTimerContext.Provider>
    );
}

export function useSleepTimer(): SleepTimerState {
    return useContext(SleepTimerContext);
}

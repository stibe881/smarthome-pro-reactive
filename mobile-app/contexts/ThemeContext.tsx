import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

// Define Theme Interface
export interface ThemeColors {
    background: string;
    card: string;
    text: string;
    subtext: string;
    accent: string;
    border: string;
    success: string;
    error: string;
    warning: string;
    tint: string;
    tabBar: string;
    backgroundImage: any;
}

export type ThemeType =
    | 'nature' | 'vulkan' | 'ocean' | 'rose'
    | 'minimal' | 'cozy' | 'fresh' | 'elegant' | 'blossom';

// Theme display names for UI
export const THEME_DISPLAY_NAMES: Record<ThemeType, string> = {
    nature: 'Nature',
    vulkan: 'Vulkan',
    ocean: 'Ocean',
    minimal: 'Minimal',
    cozy: 'Cozy',
    fresh: 'Fresh',
    elegant: 'Elegant',
    rose: 'Dark Pink',
    blossom: 'Light Pink',
};

// Theme categories
export const DARK_THEMES: ThemeType[] = ['nature', 'vulkan', 'ocean', 'rose'];
export const LIGHT_THEMES: ThemeType[] = ['minimal', 'cozy', 'fresh', 'elegant', 'blossom'];

export const THEMES: Record<ThemeType, ThemeColors> = {
    // --- DARK THEMES ---
    nature: {
        background: '#1A2B26',
        card: '#243832',
        text: '#E8F0ED',
        subtext: '#6C9786',
        accent: '#6C9786',
        border: '#2E4A40',
        success: '#7BC67E',
        error: '#E87461',
        warning: '#D4A745',
        tint: '#6C9786',
        tabBar: '#1A2B26',
        backgroundImage: require('../assets/themes/nature.png'),
    },
    vulkan: {
        background: '#1C1917',
        card: '#292524',
        text: '#FAFAF9',
        subtext: '#A8A29E',
        accent: '#D97706',
        border: '#44403C',
        success: '#BEF264',
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#F59E0B',
        tabBar: '#1C1917',
        backgroundImage: require('../assets/themes/luxury.png'),
    },
    ocean: {
        background: '#0B1120',
        card: '#172554',
        text: '#F0F9FF',
        subtext: '#94A3B8',
        accent: '#0EA5E9',
        border: '#1E3A8A',
        success: '#22C55E',
        error: '#EF4444',
        warning: '#FBBF24',
        tint: '#38BDF8',
        tabBar: '#0B1120',
        backgroundImage: require('../assets/themes/ocean.png'),
    },
    // --- LIGHT THEMES ---
    minimal: {
        background: '#F8FAFC',
        card: '#FFFFFF',
        text: '#0F172A',
        subtext: '#64748B',
        accent: '#000000',
        border: '#E2E8F0',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#0F172A',
        tabBar: '#FFFFFF',
        backgroundImage: require('../assets/themes/light_minimal.png'),
    },
    cozy: {
        background: '#FFF7ED',
        card: '#FFEDD5',
        text: '#431407',
        subtext: '#9A3412',
        accent: '#EA580C',
        border: '#FED7AA',
        success: '#16A34A',
        error: '#DC2626',
        warning: '#D97706',
        tint: '#EA580C',
        tabBar: '#FFF7ED',
        backgroundImage: require('../assets/themes/light_cozy.png'),
    },
    fresh: {
        background: '#F0FDF4',
        card: '#DCFCE7',
        text: '#064E3B',
        subtext: '#15803D',
        accent: '#10B981',
        border: '#BBF7D0',
        success: '#16A34A',
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#10B981',
        tabBar: '#F0FDF4',
        backgroundImage: require('../assets/themes/light_fresh.png'),
    },
    elegant: {
        background: '#FAFAF9',
        card: '#FFFFFF',
        text: '#1C1917',
        subtext: '#57534E',
        accent: '#D97706',
        border: '#E7E5E4',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#D97706',
        tabBar: '#FAFAF9',
        backgroundImage: require('../assets/themes/light_elegant.png'),
    },
    rose: {
        background: '#1a0011',     // Very dark magenta-black
        card: '#2d0020',           // Deep magenta
        text: '#ffe0f0',           // Light pink white
        subtext: '#FF69B4',        // Hot Pink
        accent: '#FF1493',         // Deep Pink (knalliges pink)
        border: '#5c0040',         // Dark magenta border
        success: '#FF69B4',
        error: '#ef4444',
        warning: '#f59e0b',
        tint: '#FF1493',
        tabBar: '#1a0011',
        backgroundImage: require('../assets/themes/dark-pink.png'),
    },
    blossom: {
        background: '#FFF0F5',     // Lavender Blush
        card: '#FFFFFF',
        text: '#99004d',           // Deep pink text
        subtext: '#CC0066',        // Vivid pink
        accent: '#FF1493',         // Deep Pink (knalliges pink)
        border: '#FFB6C1',         // Light Pink border
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        tint: '#FF1493',
        tabBar: '#FFF0F5',
        backgroundImage: require('../assets/themes/light-pink.png'),
    },
};

const THEME_KEY = '@smarthome_theme_preference';
const AUTO_THEME_KEY = '@smarthome_auto_theme';

export interface AutoThemeConfig {
    enabled: boolean;
    dayTheme: ThemeType;
    nightTheme: ThemeType;
}

interface ThemeContextType {
    theme: ThemeType;
    colors: ThemeColors;
    setTheme: (type: ThemeType) => void;
    autoTheme: AutoThemeConfig;
    setAutoTheme: (config: AutoThemeConfig) => void;
    setSunState: (state: 'above_horizon' | 'below_horizon') => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'ocean',
    colors: THEMES.ocean,
    setTheme: () => { },
    autoTheme: { enabled: false, dayTheme: 'minimal', nightTheme: 'ocean' },
    setAutoTheme: () => { },
    setSunState: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeType>('ocean');
    const [autoTheme, setAutoThemeState] = useState<AutoThemeConfig>({
        enabled: false,
        dayTheme: 'minimal',
        nightTheme: 'ocean',
    });
    const sunStateRef = useRef<'above_horizon' | 'below_horizon' | null>(null);

    // Load saved theme + auto config
    useEffect(() => {
        (async () => {
            try {
                const [saved, autoSaved] = await Promise.all([
                    AsyncStorage.getItem(THEME_KEY),
                    AsyncStorage.getItem(AUTO_THEME_KEY),
                ]);
                if (saved && Object.keys(THEMES).includes(saved)) {
                    setThemeState(saved as ThemeType);
                } else if (saved) {
                    // Invalid stored theme, reset to default
                    await AsyncStorage.removeItem(THEME_KEY);
                }
                if (autoSaved) {
                    const parsed = JSON.parse(autoSaved) as AutoThemeConfig;
                    if (parsed && typeof parsed.enabled === 'boolean') {
                        setAutoThemeState(parsed);
                    }
                }
            } catch (e) {
                console.warn('Failed to load theme', e);
            }
        })();
    }, []);

    const setTheme = useCallback(async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        await AsyncStorage.setItem(THEME_KEY, newTheme);
    }, []);

    const setAutoTheme = useCallback(async (config: AutoThemeConfig) => {
        setAutoThemeState(config);
        await AsyncStorage.setItem(AUTO_THEME_KEY, JSON.stringify(config));
        // Apply immediately if enabled and sun state is known
        if (config.enabled && sunStateRef.current) {
            const target = sunStateRef.current === 'above_horizon' ? config.dayTheme : config.nightTheme;
            setThemeState(target);
            await AsyncStorage.setItem(THEME_KEY, target);
        }
    }, []);

    const setSunState = useCallback((state: 'above_horizon' | 'below_horizon') => {
        const prev = sunStateRef.current;
        sunStateRef.current = state;
        // Only switch if auto is enabled AND the sun state actually changed
        if (prev !== state) {
            setAutoThemeState(current => {
                if (current.enabled) {
                    const target = state === 'above_horizon' ? current.dayTheme : current.nightTheme;
                    setThemeState(target);
                    AsyncStorage.setItem(THEME_KEY, target);
                }
                return current;
            });
        }
    }, []);

    const currentColors = THEMES[theme] || THEMES.ocean;

    return (
        <ThemeContext.Provider value={{ theme, colors: currentColors, setTheme, autoTheme, setAutoTheme, setSunState }}>
            <StatusBar
                style={LIGHT_THEMES.includes(theme) ? 'dark' : 'light'}
                backgroundColor={currentColors.background}
            />
            {children}
        </ThemeContext.Provider>
    );
}

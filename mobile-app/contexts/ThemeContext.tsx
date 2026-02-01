import React, { createContext, useContext, useState, useEffect } from 'react';
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
    | 'classic' | 'cyber' | 'nature' | 'luxury' | 'ocean'
    | 'minimal' | 'cozy' | 'fresh' | 'elegant';

export const THEMES: Record<ThemeType, ThemeColors> = {
    classic: {
        background: '#020617', // Original Background
        card: '#1E293B',       // Original Card
        text: '#fff',          // Original White Text
        subtext: '#94A3B8',    // Original Subtext
        accent: '#3B82F6',     // Original Blue Accent
        border: 'rgba(255,255,255,0.05)', // Original Border
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#38BDF8',
        tabBar: '#1E293B', // Match Card/Nav Bar
        backgroundImage: null, // No background image for Classic
    },
    cyber: {
        background: '#09090B', // Zinc 950
        card: '#18181B',       // Zinc 900
        text: '#FAFAFA',       // Zinc 50
        subtext: '#A1A1AA',    // Zinc 400
        accent: '#D946EF',     // Fuchsia 500
        border: '#27272A',     // Zinc 800
        success: '#22C55E',
        error: '#F43F5E',
        warning: '#EAB308',
        tint: '#E879F9',
        tabBar: '#000000',
        backgroundImage: require('../assets/themes/cyber.png'),
    },
    nature: {
        background: '#022C22', // Emerald 950
        card: '#064E3B',       // Emerald 900
        text: '#ECFDF5',       // Emerald 50
        subtext: '#6EE7B7',    // Emerald 300
        accent: '#10B981',     // Emerald 500
        border: '#065F46',     // Emerald 800
        success: '#34D399',
        error: '#F87171',
        warning: '#FBBF24',
        tint: '#34D399',
        tabBar: '#022C22',
        backgroundImage: require('../assets/themes/nature.png'),
    },
    luxury: {
        background: '#1C1917', // Stone 950
        card: '#292524',       // Stone 900
        text: '#FAFAF9',       // Stone 50
        subtext: '#A8A29E',    // Stone 400
        accent: '#D97706',     // Amber 600
        border: '#44403C',     // Stone 700
        success: '#BEF264',    // Lime
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#F59E0B',
        tabBar: '#1C1917',
        backgroundImage: require('../assets/themes/luxury.png'),
    },
    ocean: {
        background: '#0B1120', // Navy 950
        card: '#172554',       // Blue 900
        text: '#F0F9FF',       // Sky 50
        subtext: '#94A3B8',    // Slate 400
        accent: '#0EA5E9',     // Sky 500
        border: '#1E3A8A',     // Blue 800
        success: '#22C55E',
        error: '#EF4444',
        warning: '#FBBF24',
        tint: '#38BDF8',
        tabBar: '#0B1120',
        backgroundImage: require('../assets/themes/ocean.png'),
    },
    minimal: {
        background: '#F8FAFC', // Slate 50
        card: '#FFFFFF',       // White
        text: '#0F172A',       // Slate 900
        subtext: '#64748B',    // Slate 500
        accent: '#000000',     // Black
        border: '#E2E8F0',     // Slate 200
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#0F172A',
        tabBar: '#FFFFFF',
        backgroundImage: require('../assets/themes/light_minimal.png'),
    },
    cozy: {
        background: '#FFF7ED', // Orange 50
        card: '#FFEDD5',       // Orange 100
        text: '#431407',       // Orange 950
        subtext: '#9A3412',    // Orange 700
        accent: '#EA580C',     // Orange 600
        border: '#FED7AA',     // Orange 200
        success: '#16A34A',
        error: '#DC2626',
        warning: '#D97706',
        tint: '#EA580C',
        tabBar: '#FFF7ED',
        backgroundImage: require('../assets/themes/light_cozy.png'),
    },
    fresh: {
        background: '#F0FDF4', // Green 50
        card: '#DCFCE7',       // Green 100
        text: '#064E3B',       // Green 950
        subtext: '#15803D',    // Green 700
        accent: '#10B981',     // Emerald 500
        border: '#BBF7D0',     // Green 200
        success: '#16A34A',
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#10B981',
        tabBar: '#F0FDF4',
        backgroundImage: require('../assets/themes/light_fresh.png'),
    },
    elegant: {
        background: '#FAFAF9', // Stone 50
        card: '#FFFFFF',       // White
        text: '#1C1917',       // Stone 900
        subtext: '#57534E',    // Stone 500
        accent: '#D97706',     // Amber 600
        border: '#E7E5E4',     // Stone 200
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        tint: '#D97706',
        tabBar: '#FAFAF9',
        backgroundImage: require('../assets/themes/light_elegant.png'),
    }
};

const THEME_KEY = '@smarthome_theme_preference';

interface ThemeContextType {
    theme: ThemeType;
    colors: ThemeColors;
    setTheme: (type: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'classic',
    colors: THEMES.classic,
    setTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeType>('classic');

    // Load saved theme
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(THEME_KEY);
                if (saved && Object.keys(THEMES).includes(saved)) {
                    setThemeState(saved as ThemeType);
                }
            } catch (e) {
                console.warn('Failed to load theme', e);
            }
        })();
    }, []);

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        await AsyncStorage.setItem(THEME_KEY, newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, colors: THEMES[theme], setTheme }}>
            <StatusBar
                style={['minimal', 'cozy', 'fresh', 'elegant'].includes(theme) ? 'dark' : 'light'}
                backgroundColor={THEMES[theme].background}
            />
            {children}
        </ThemeContext.Provider>
    );
}

import { Tabs } from 'expo-router';
import { LayoutGrid, DoorOpen, PlayCircle, Users, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useKidsMode } from '../../contexts/KidsContext';
import ResponsiveTabBar from '../../components/ResponsiveTabBar';

export default function TabLayout() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { isKidsModeActive } = useKidsMode();

    return (
        <Tabs
            tabBar={props => isKidsModeActive ? null : <ResponsiveTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.subtext,
                tabBarStyle: isKidsModeActive ? { display: 'none' } : undefined,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color }) => <LayoutGrid size={24} stroke={color} />,
                }}
            />
            <Tabs.Screen
                name="rooms"
                options={{
                    title: 'Räume',
                    tabBarIcon: ({ color }) => <DoorOpen size={24} stroke={color} />,
                }}
            />
            <Tabs.Screen
                name="media"
                options={{
                    title: 'Medien',
                    tabBarIcon: ({ color }) => <PlayCircle size={24} stroke={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Optionen',
                    tabBarIcon: ({ color }) => <Settings size={24} stroke={color} />,
                }}
            />
        </Tabs>
    );
}

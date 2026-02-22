import { Tabs } from 'expo-router';
import { LayoutGrid, DoorOpen, PlayCircle, Users, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useKidsMode } from '../../contexts/KidsContext';
import { useAuth } from '../../contexts/AuthContext';
import ResponsiveTabBar from '../../components/ResponsiveTabBar';

export default function TabLayout() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { isKidsModeActive } = useKidsMode();
    const { userRole } = useAuth();
    const isGuest = userRole === 'guest';

    return (
        <Tabs
            tabBar={props => (isKidsModeActive || isGuest) ? null : <ResponsiveTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.subtext,
                tabBarStyle: (isKidsModeActive || isGuest) ? { display: 'none' } : undefined,
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
                    href: isGuest ? null : undefined,
                }}
            />
            <Tabs.Screen
                name="media"
                options={{
                    title: 'Medien',
                    tabBarIcon: ({ color }) => <PlayCircle size={24} stroke={color} />,
                    href: isGuest ? null : undefined,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Optionen',
                    tabBarIcon: ({ color }) => <Settings size={24} stroke={color} />,
                    href: isGuest ? null : undefined,
                }}
            />
        </Tabs>
    );
}
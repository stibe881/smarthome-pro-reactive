import { Tabs } from 'expo-router';
import { LayoutGrid, DoorOpen, PlayCircle, Users, Sparkles, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResponsiveTabBar from '../../components/ResponsiveTabBar';

export default function TabLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            tabBar={props => <ResponsiveTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#3b82f6',
                tabBarInactiveTintColor: '#6b7280',
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
                name="family"
                options={{
                    title: 'Familie',
                    tabBarIcon: ({ color }) => <Users size={24} stroke={color} />,
                }}
            />
            <Tabs.Screen
                name="gemini"
                options={{
                    title: 'Gemini',
                    tabBarIcon: ({ color }) => <Sparkles size={24} stroke={color} />,
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

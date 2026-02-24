
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { HomeAssistantProvider, useHomeAssistant } from "../contexts/HomeAssistantContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { KidsProvider } from "../contexts/KidsContext";
import { SubscriptionProvider } from "../contexts/SubscriptionContext";
import { SleepTimerProvider } from "../hooks/useSleepTimer";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import ChangePasswordModal from "../components/ChangePasswordModal";
import { DoorbellModal } from "../components/DoorbellModal";

/** Bridges sun.sun entity from HA to ThemeContext for auto theme switching */
function SunThemeBridge() {
    const { entities } = useHomeAssistant();
    const { setSunState } = useTheme();

    useEffect(() => {
        const sun = entities.find(e => e.entity_id === 'sun.sun');
        if (sun && (sun.state === 'above_horizon' || sun.state === 'below_horizon')) {
            setSunState(sun.state as 'above_horizon' | 'below_horizon');
        }
    }, [entities]);

    return null;
}

function RootLayoutNav() {
    const { session, isLoading, mustChangePassword, clearMustChangePassword, needsSetup } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === "(auth)";
        const seg = segments as string[];
        const inSetup = seg[1] === "setup";

        if (!session && !inAuthGroup) {
            // Redirect to the sign-in page.
            router.replace("/(auth)/login");
        } else if (session && needsSetup && !inSetup) {
            // New user needs to complete setup wizard
            router.replace("/(auth)/setup");
        } else if (session && !needsSetup && inAuthGroup) {
            // Redirect away from the auth group to main app.
            router.replace("/(tabs)");
        }
    }, [session, isLoading, segments, needsSetup]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    return (
        <>
            <Slot />
            {/* Show forced password change modal when user needs to change password */}
            <ChangePasswordModal
                visible={mustChangePassword}
                onClose={() => { }} // Cannot close when forced
                onSuccess={clearMustChangePassword}
                isForced={true}
            />
            {/* Global Doorbell Popup */}
            <DoorbellModal />
            <Toast />
        </>
    );
}

export default function Layout() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <AuthProvider>
                    <HomeAssistantProvider>
                        <SubscriptionProvider>
                            <SleepTimerProvider>
                                <KidsProvider>
                                    <SunThemeBridge />
                                    <RootLayoutNav />
                                </KidsProvider>
                            </SleepTimerProvider>
                        </SubscriptionProvider>
                    </HomeAssistantProvider>
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

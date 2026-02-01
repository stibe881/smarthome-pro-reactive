
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { HomeAssistantProvider } from "../contexts/HomeAssistantContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChangePasswordModal from "../components/ChangePasswordModal";

function RootLayoutNav() {
    const { session, isLoading, mustChangePassword, clearMustChangePassword } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === "(auth)";

        if (!session && !inAuthGroup) {
            // Redirect to the sign-in page.
            router.replace("/(auth)/login");
        } else if (session && inAuthGroup) {
            // Redirect away from the sign-in page.
            router.replace("/(tabs)");
        }
    }, [session, isLoading, segments]);

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
        </>
    );
}

export default function Layout() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <AuthProvider>
                    <HomeAssistantProvider>
                        <RootLayoutNav />
                    </HomeAssistantProvider>
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

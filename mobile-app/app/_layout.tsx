
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { HomeAssistantProvider, useHomeAssistant } from "../contexts/HomeAssistantContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { KidsProvider } from "../contexts/KidsContext";
import { useEffect } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import * as Linking from 'expo-linking';
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

    const { callService } = useHomeAssistant();

    // Handle Deep Links (Widget Actions)
    useEffect(() => {
        const handleDeepLink = (event: { url: string }) => {
            const url = event.url;
            console.log('Deep Link received:', url);

            // New Format: smarthome-pro://action?id=...&type=...&confirm=...
            // Legacy Format: smarthome-pro://entity/script.xyz (keep support if needed, or migrate)

            try {
                const parsed = Linking.parse(url);
                const { path, queryParams } = parsed;

                if (path === 'action' && queryParams) {
                    const id = queryParams.id as string;
                    const type = queryParams.type as string;
                    const confirm = queryParams.confirm === 'true';

                    if (!id) return;

                    if (confirm) {
                        Alert.alert(
                            'Bestätigung',
                            `Möchtest du die Aktion für ${id} wirklich ausführen?`,
                            [
                                { text: 'Abbrechen', style: 'cancel' },
                                { text: 'Ausführen', onPress: () => executeAction(id, type) }
                            ]
                        );
                    } else {
                        executeAction(id, type);
                    }
                }
                // Legacy fallback
                else if (url.includes('entity/')) {
                    const entityId = url.split('entity/')[1];
                    if (entityId) executeAction(entityId, 'toggle'); // Default to toggle/smart-guess
                }

            } catch (e) {
                console.error("Deep link parse error", e);
            }
        };

        const executeAction = async (entityId: string, type: string) => {
            console.log(`Executing ${type} for ${entityId}`);

            try {
                switch (type) {
                    case 'navigate':
                        // Simple navigation to detail or just opening app
                        // If we had specific entity details pages, we'd navigate there.
                        // For now, opening the app (which happened via deep link) is enough.
                        Toast.show({
                            type: 'info',
                            text1: 'Geöffnet',
                            text2: `${entityId}`
                        });
                        break;

                    case 'script':
                        await callService('script', 'turn_on', entityId);
                        Toast.show({ type: 'success', text1: 'Skript gestartet' });
                        break;

                    case 'scene':
                        await callService('scene', 'turn_on', entityId);
                        Toast.show({ type: 'success', text1: 'Szene aktiviert' });
                        break;

                    case 'toggle':
                    default:
                        // Smart toggle logic
                        if (entityId.startsWith('script.')) {
                            await callService('script', 'turn_on', entityId);
                            Toast.show({ type: 'success', text1: 'Skript gestartet' });
                        } else if (entityId.startsWith('scene.')) {
                            await callService('scene', 'turn_on', entityId);
                            Toast.show({ type: 'success', text1: 'Szene aktiviert' });
                        } else if (entityId.startsWith('lock.')) {
                            // Locks usually need specific services, generic toggle might work but explicit is safer
                            // For now try generic toggle or ask user to define action
                            await callService('homeassistant', 'toggle', entityId);
                        } else if (entityId.startsWith('input_button.')) {
                            await callService('input_button', 'press', entityId);
                            Toast.show({ type: 'success', text1: 'Knopf gedrückt' });
                        } else {
                            await callService('homeassistant', 'toggle', entityId);
                            // No toast for lights usually better, or small one
                        }
                        break;
                }
            } catch (error) {
                console.error('Widget action failed:', error);
                Alert.alert('Fehler', 'Aktion konnte nicht ausgeführt werden.');
            }
        };

        // Listen for incoming links while app is running
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check for initial link if app was closed
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink({ url });
        });

        return () => {
            subscription.remove();
        };
    }, [callService]);

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
                        <KidsProvider>
                            <SunThemeBridge />
                            <RootLayoutNav />
                        </KidsProvider>
                    </HomeAssistantProvider>
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

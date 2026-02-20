import { useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import Toast from 'react-native-toast-message';

/**
 * Widget Deep Link Handler Route
 * 
 * Catches deep links with format: smarthome-pro://action?id=...&type=...&confirm=...
 * Executes the action and navigates back to the main app.
 */
export default function ActionRoute() {
    const params = useLocalSearchParams<{ id: string; type: string; confirm: string }>();
    const router = useRouter();
    const { callService } = useHomeAssistant();

    useEffect(() => {
        const { id, type = 'toggle', confirm } = params;

        if (!id) {
            router.replace('/(tabs)');
            return;
        }

        const executeAction = async (entityId: string, actionType: string) => {
            console.log(`[Widget Action] Executing ${actionType} for ${entityId}`);

            try {
                switch (actionType) {
                    case 'navigate':
                        Toast.show({ type: 'info', text1: 'Geöffnet', text2: entityId });
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
                        if (entityId.startsWith('script.')) {
                            await callService('script', 'turn_on', entityId);
                            Toast.show({ type: 'success', text1: 'Skript gestartet' });
                        } else if (entityId.startsWith('scene.')) {
                            await callService('scene', 'turn_on', entityId);
                            Toast.show({ type: 'success', text1: 'Szene aktiviert' });
                        } else if (entityId.startsWith('input_button.')) {
                            await callService('input_button', 'press', entityId);
                            Toast.show({ type: 'success', text1: 'Knopf gedrückt' });
                        } else {
                            await callService('homeassistant', 'toggle', entityId);
                            Toast.show({ type: 'success', text1: 'Umgeschaltet', text2: entityId });
                        }
                        break;
                }
            } catch (error) {
                console.error('[Widget Action] Failed:', error);
                Alert.alert('Fehler', 'Aktion konnte nicht ausgeführt werden.');
            }

            // Navigate back to main app
            router.replace('/(tabs)');
        };

        if (confirm === 'true') {
            Alert.alert(
                'Bestätigung',
                `Möchtest du die Aktion für ${id} wirklich ausführen?`,
                [
                    { text: 'Abbrechen', style: 'cancel', onPress: () => router.replace('/(tabs)') },
                    { text: 'Ausführen', onPress: () => executeAction(id, type) }
                ]
            );
        } else {
            executeAction(id, type);
        }
    }, []);

    // Show brief loading screen while action executes
    return (
        <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#3B82F6" />
        </View>
    );
}

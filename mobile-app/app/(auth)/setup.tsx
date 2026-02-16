import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { Server, Key, CheckCircle2, ChevronRight, ChevronLeft, Wifi, House, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function SetupWizardScreen() {
    const { completeSetup } = useAuth();
    const { connect, saveCredentials } = useHomeAssistant();
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [url, setUrl] = useState('');
    const [token, setToken] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testSuccess, setTestSuccess] = useState(false);

    const handleTestConnection = async () => {
        if (!url.trim() || !token.trim()) {
            Alert.alert('Fehler', 'Bitte gib eine URL und einen Token ein.');
            return;
        }

        setIsTesting(true);
        setTestSuccess(false);
        try {
            await saveCredentials(url.trim(), token.trim());
            const success = await connect();
            if (success) {
                setTestSuccess(true);
                // Auto-advance after short delay
                setTimeout(() => setStep(4), 1000);
            } else {
                Alert.alert('Verbindung fehlgeschlagen', 'Bitte überprüfe die URL und den Token.');
            }
        } catch (e) {
            Alert.alert('Fehler', 'Es konnte keine Verbindung hergestellt werden.');
        } finally {
            setIsTesting(false);
        }
    };

    const handleFinish = () => {
        completeSetup();
        router.replace('/(tabs)');
    };

    const handleSkip = () => {
        completeSetup();
        router.replace('/(tabs)');
    };

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
                <Sparkles size={40} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Willkommen!</Text>
            <Text style={styles.description}>
                Du hast dein Konto erfolgreich erstellt. Lass uns jetzt dein Smart Home einrichten.
            </Text>
            <Text style={styles.descriptionSmall}>
                Verbinde die App mit deinem Home Assistant, um dein Zuhause zu steuern.
            </Text>

            <Pressable
                onPress={() => setStep(2)}
                style={styles.primaryButton}
            >
                <Text style={styles.primaryButtonText}>Los geht's</Text>
                <ChevronRight size={20} color="#fff" />
            </Pressable>

            <Pressable onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>Später einrichten</Text>
            </Pressable>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
                <Server size={32} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Home Assistant URL</Text>
            <Text style={styles.description}>
                Gib die URL deiner Home Assistant Instanz ein. Diese findest du in den Einstellungen unter "Allgemein".
            </Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>HOME ASSISTANT URL</Text>
                <TextInput
                    style={styles.input}
                    placeholder="https://deine-url.ui.nabu.casa"
                    placeholderTextColor="#64748b"
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                />
            </View>

            <View style={styles.hintBox}>
                <Wifi size={16} color="#94A3B8" />
                <Text style={styles.hintText}>
                    Tipp: Nutze deine Nabu Casa URL für den Zugriff von überall.
                </Text>
            </View>

            <View style={styles.buttonRow}>
                <Pressable onPress={() => setStep(1)} style={styles.secondaryButton}>
                    <ChevronLeft size={20} color="#fff" />
                    <Text style={styles.secondaryButtonText}>Zurück</Text>
                </Pressable>
                <Pressable
                    onPress={() => {
                        if (!url.trim()) {
                            Alert.alert('Fehler', 'Bitte gib eine URL ein.');
                            return;
                        }
                        setStep(3);
                    }}
                    style={[styles.primaryButton, { flex: 1, marginTop: 0 }]}
                >
                    <Text style={styles.primaryButtonText}>Weiter</Text>
                    <ChevronRight size={20} color="#fff" />
                </Pressable>
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
                <Key size={32} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Access Token</Text>
            <Text style={styles.description}>
                Erstelle einen Long-Lived Access Token in Home Assistant unter Profil → Sicherheit → Long-Lived Access Tokens.
            </Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>LONG-LIVED ACCESS TOKEN</Text>
                <TextInput
                    style={[styles.input, { height: 100 }]}
                    placeholder="Dein Token..."
                    placeholderTextColor="#64748b"
                    value={token}
                    onChangeText={setToken}
                    multiline
                    autoCapitalize="none"
                />
            </View>

            <View style={styles.buttonRow}>
                <Pressable onPress={() => setStep(2)} style={styles.secondaryButton}>
                    <ChevronLeft size={20} color="#fff" />
                    <Text style={styles.secondaryButtonText}>Zurück</Text>
                </Pressable>
                <Pressable
                    onPress={handleTestConnection}
                    disabled={isTesting}
                    style={[styles.primaryButton, { flex: 1, marginTop: 0 }]}
                >
                    {isTesting ? (
                        <ActivityIndicator color="#fff" />
                    ) : testSuccess ? (
                        <CheckCircle2 size={20} color="#fff" />
                    ) : (
                        <Wifi size={20} color="#fff" />
                    )}
                    <Text style={styles.primaryButtonText}>
                        {isTesting ? 'Teste...' : testSuccess ? 'Verbunden!' : 'Verbindung testen'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );

    const renderStep4 = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <CheckCircle2 size={48} color="#10B981" />
            </View>
            <Text style={styles.title}>Alles bereit!</Text>
            <Text style={styles.description}>
                Dein Smart Home ist verbunden. Du kannst jetzt dein Zuhause steuern.
            </Text>

            <View style={styles.successCard}>
                <View style={styles.successRow}>
                    <CheckCircle2 size={18} color="#10B981" />
                    <Text style={styles.successText}>Konto erstellt</Text>
                </View>
                <View style={styles.successRow}>
                    <CheckCircle2 size={18} color="#10B981" />
                    <Text style={styles.successText}>Home Assistant verbunden</Text>
                </View>
                <View style={styles.successRow}>
                    <CheckCircle2 size={18} color="#10B981" />
                    <Text style={styles.successText}>Dashboard bereit</Text>
                </View>
            </View>

            <Pressable onPress={handleFinish} style={styles.primaryButton}>
                <House size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Zum Dashboard</Text>
            </Pressable>
        </View>
    );

    // Step indicator dots
    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            {[1, 2, 3, 4].map(s => (
                <View
                    key={s}
                    style={[
                        styles.dot,
                        s === step && styles.dotActive,
                        s < step && styles.dotCompleted,
                    ]}
                />
            ))}
        </View>
    );

    const renderContent = () => {
        switch (step) {
            case 1: return renderStep1();
            case 2: return renderStep2();
            case 3: return renderStep3();
            case 4: return renderStep4();
            default: return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {renderStepIndicator()}
                    {renderContent()}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 60,
        flexGrow: 1,
        justifyContent: 'center',
    },
    stepContainer: {
        alignItems: 'center',
        maxWidth: 400,
        alignSelf: 'center',
        width: '100%',
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 12,
    },
    descriptionSmall: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 40,
    },
    inputGroup: {
        width: '100%',
        marginBottom: 20,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 14,
        padding: 16,
        fontSize: 15,
        color: '#fff',
    },
    primaryButton: {
        width: '100%',
        paddingVertical: 18,
        borderRadius: 16,
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        gap: 8,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    secondaryButton: {
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    secondaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 32,
        width: '100%',
    },
    skipButton: {
        paddingVertical: 16,
    },
    skipText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '500',
    },
    hintBox: {
        width: '100%',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    hintText: {
        color: '#94A3B8',
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
    },
    successCard: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: 24,
        gap: 18,
        marginVertical: 32,
    },
    successRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    successText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 40,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    dotActive: {
        width: 24,
        backgroundColor: '#3B82F6',
    },
    dotCompleted: {
        backgroundColor: '#10B981',
    },
});

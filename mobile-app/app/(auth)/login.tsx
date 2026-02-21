import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { House, LogIn, Mail, Lock, AlertTriangle, ScanFace, UserPlus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import ForgotPasswordModal from '../../components/ForgotPasswordModal';

export default function LoginScreen() {
    const { login, register, isBiometricsEnabled, biometricLogin } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);

    // Auto-login with biometrics if enabled
    React.useEffect(() => {
        if (isBiometricsEnabled && !isRegisterMode) {
            handleBiometricLogin();
        }
    }, [isBiometricsEnabled]);

    const handleBiometricLogin = async () => {
        setLoading(true);
        const success = await biometricLogin();
        if (!success) {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        setError('');

        if (isRegisterMode) {
            if (!email.trim() || !password.trim()) {
                setError('Bitte fülle alle Felder aus');
                return;
            }
            if (password.length < 6) {
                setError('Das Passwort muss mindestens 6 Zeichen lang sein');
                return;
            }
            if (password !== confirmPassword) {
                setError('Die Passwörter stimmen nicht überein');
                return;
            }
        }

        setLoading(true);
        try {
            if (isRegisterMode) {
                await register(email, password);
            } else {
                await login(email, password);
            }
        } catch (err: any) {
            setError(err.message || 'Ein Fehler ist aufgetreten');
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsRegisterMode(!isRegisterMode);
        setError('');
        setConfirmPassword('');
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View style={styles.content}>
                        {/* Logo */}
                        <View style={styles.logoContainer}>
                            <View style={styles.logoCircle}>
                                <House stroke="white" size={32} />
                            </View>
                            <Text style={styles.title}>
                                SMARTHOME <Text style={styles.titleHighlight}>PRO</Text>
                            </Text>
                            <Text style={styles.subtitle}>Powered by HA</Text>
                        </View>

                        {/* Form */}
                        <View style={styles.formCard}>
                            <Text style={styles.cardTitle}>
                                {isRegisterMode ? 'Registrieren' : 'Willkommen'}
                            </Text>
                            <Text style={styles.cardSubtitle}>
                                {isRegisterMode ? 'Erstelle ein neues Konto' : 'Melde dich an'}
                            </Text>

                            <View style={styles.formGroup}>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>EMAIL</Text>
                                    <View style={styles.inputWrapper}>
                                        <Mail stroke="#94a3b8" size={20} />
                                        <TextInput
                                            value={email}
                                            onChangeText={setEmail}
                                            placeholder="name@beispiel.de"
                                            placeholderTextColor="#64748b"
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                            style={styles.input}
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>PASSWORT</Text>
                                    <View style={styles.inputWrapper}>
                                        <Lock stroke="#94a3b8" size={20} />
                                        <TextInput
                                            value={password}
                                            onChangeText={setPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor="#64748b"
                                            secureTextEntry
                                            style={styles.input}
                                        />
                                    </View>
                                </View>

                                {isRegisterMode && (
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.label}>PASSWORT BESTÄTIGEN</Text>
                                        <View style={styles.inputWrapper}>
                                            <Lock stroke="#94a3b8" size={20} />
                                            <TextInput
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                placeholder="••••••••"
                                                placeholderTextColor="#64748b"
                                                secureTextEntry
                                                style={styles.input}
                                            />
                                        </View>
                                    </View>
                                )}

                                {error ? (
                                    <View style={styles.errorBox}>
                                        <AlertTriangle stroke="#f87171" size={20} />
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                ) : null}

                                <Pressable
                                    onPress={handleSubmit}
                                    disabled={loading}
                                    style={[
                                        styles.button,
                                        loading ? styles.buttonDisabled : styles.buttonActive
                                    ]}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : isRegisterMode ? (
                                        <UserPlus stroke="white" size={24} />
                                    ) : (
                                        <LogIn stroke="white" size={24} />
                                    )}
                                    <Text style={[styles.buttonText, loading && styles.buttonTextDisabled]}>
                                        {loading ? 'BITTE WARTEN...' : isRegisterMode ? 'REGISTRIEREN' : 'ANMELDEN'}
                                    </Text>
                                </Pressable>

                                {!isRegisterMode && (
                                    <Pressable onPress={() => setShowForgotPassword(true)} style={{ alignItems: 'center' }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 14 }}>Passwort vergessen?</Text>
                                    </Pressable>
                                )}

                                {!isRegisterMode && isBiometricsEnabled && (
                                    <Pressable
                                        onPress={handleBiometricLogin}
                                        style={styles.biometricButton}
                                    >
                                        <ScanFace stroke="#3B82F6" size={32} />
                                        <Text style={styles.biometricText}>Or use Face ID</Text>
                                    </Pressable>
                                )}

                                {/* Toggle between Login and Register */}
                                <Pressable onPress={toggleMode} style={styles.toggleButton}>
                                    <Text style={styles.toggleText}>
                                        {isRegisterMode
                                            ? 'Bereits ein Konto? '
                                            : 'Noch kein Konto? '}
                                        <Text style={styles.toggleHighlight}>
                                            {isRegisterMode ? 'Anmelden' : 'Registrieren'}
                                        </Text>
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <ForgotPasswordModal
                visible={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
            />
        </SafeAreaView>
    );
}

import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        width: '100%',
        maxWidth: 384, // max-w-sm
        alignSelf: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoCircle: {
        width: 80,
        height: 80,
        backgroundColor: '#3B82F6',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -1,
        marginBottom: 8,
    },
    titleHighlight: {
        color: '#3B82F6',
    },
    subtitle: {
        color: '#6B7280',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 3,
    },
    formCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 32,
        borderRadius: 48,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardTitle: {
        fontSize: 30,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    cardSubtitle: {
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 32,
    },
    formGroup: {
        gap: 24,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#94A3B8',
        paddingHorizontal: 4,
    },
    inputWrapper: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        color: 'white',
    },
    errorBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    errorText: {
        color: '#F87171',
        fontSize: 14,
        flex: 1,
    },
    button: {
        width: '100%',
        paddingVertical: 20,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonActive: {
        backgroundColor: '#2563EB',
    },
    buttonDisabled: {
        backgroundColor: '#1E293B',
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        fontWeight: '900',
        fontSize: 18,
        color: '#fff',
    },
    buttonTextDisabled: {
        color: '#64748B',
    },
    biometricButton: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16
    },
    biometricText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: '600'
    },
    toggleButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    toggleText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    toggleHighlight: {
        color: '#3B82F6',
        fontWeight: '700',
    },
});

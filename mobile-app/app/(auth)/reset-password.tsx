import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function ResetPasswordScreen() {
    const { changePassword } = useAuth();
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleReset = async () => {
        if (!newPassword.trim() || newPassword.length < 6) {
            Alert.alert('Fehler', 'Das Passwort muss mindestens 6 Zeichen lang sein.');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Fehler', 'Die Passwörter stimmen nicht überein.');
            return;
        }

        setIsLoading(true);
        try {
            await changePassword(newPassword);
            setSuccess(true);
            setTimeout(() => {
                // Navigate back to login or home
                router.replace('/(auth)/login');
            }, 2000);
        } catch (error: any) {
            Alert.alert('Fehler', error.message || 'Das Passwort konnte nicht geändert werden.');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.successContainer}>
                        <CheckCircle size={64} color="#22C55E" />
                        <Text style={styles.successTitle}>Passwort geändert!</Text>
                        <Text style={styles.successText}>Du wirst jetzt zur Anmeldung weitergeleitet...</Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Neues Passwort</Text>
                    <Text style={styles.subtitle}>Bitte wähle ein neues Passwort für dein Konto.</Text>
                </View>

                <View style={styles.formCard}>
                    <View style={styles.formGroup}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>NEUES PASSWORT</Text>
                            <View style={styles.inputWrapper}>
                                <Lock stroke="#94a3b8" size={20} />
                                <TextInput
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="Mindestens 6 Zeichen"
                                    placeholderTextColor="#64748b"
                                    secureTextEntry={!showPassword}
                                    style={styles.input}
                                />
                                <Pressable onPress={() => setShowPassword(!showPassword)}>
                                    {showPassword ? (
                                        <EyeOff stroke="#94a3b8" size={20} />
                                    ) : (
                                        <Eye stroke="#94a3b8" size={20} />
                                    )}
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>BESTÄTIGEN</Text>
                            <View style={styles.inputWrapper}>
                                <Lock stroke="#94a3b8" size={20} />
                                <TextInput
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Passwort wiederholen"
                                    placeholderTextColor="#64748b"
                                    secureTextEntry={!showPassword}
                                    style={styles.input}
                                />
                            </View>
                        </View>

                        <Pressable
                            onPress={handleReset}
                            disabled={isLoading}
                            style={[
                                styles.button,
                                isLoading ? styles.buttonDisabled : styles.buttonActive
                            ]}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>PASSWORT SPEICHERN</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        padding: 24,
        justifyContent: 'center',
    },
    content: {
        width: '100%',
        maxWidth: 384,
        alignSelf: 'center',
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
    },
    successContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 32,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    successTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    successText: {
        color: '#94A3B8',
        textAlign: 'center',
    },
    formCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    formGroup: {
        gap: 20,
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
    button: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonActive: {
        backgroundColor: '#3B82F6',
    },
    buttonDisabled: {
        backgroundColor: '#1E293B',
    },
    buttonText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#fff',
    },
});

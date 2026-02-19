import React, { useState } from 'react';
import { View, Text, Modal, TextInput, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Mail, X, Send } from 'lucide-react-native';

interface ForgotPasswordModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function ForgotPasswordModal({
    visible,
    onClose
}: ForgotPasswordModalProps) {
    const { requestPasswordReset } = useAuth();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleReset = async () => {
        if (!email.trim()) {
            Alert.alert('Fehler', 'Bitte gib deine E-Mail-Adresse ein.');
            return;
        }

        setIsLoading(true);
        try {
            await requestPasswordReset(email);
            Alert.alert(
                'E-Mail gesendet',
                'Wenn ein Konto mit dieser E-Mail-Adresse existiert, erhältst du in Kürze einen Link zum Zurücksetzen deines Passworts.',
                [{ text: 'OK', onPress: onClose }]
            );
            setEmail('');
        } catch (error: any) {
            console.error('Password reset error:', error);
            // Don't reveal if user exists or not for security, but allow generic errors
            Alert.alert(
                'Anfrage gesendet',
                'Wenn ein Konto mit dieser E-Mail-Adresse existiert, erhältst du in Kürze einen Link zum Zurücksetzen deines Passworts.',
                [{ text: 'OK', onPress: onClose }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Passwort vergessen</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <X size={20} color="#94A3B8" />
                        </Pressable>
                    </View>

                    <Text style={styles.infoText}>
                        Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du dein Passwort zurücksetzen kannst.
                    </Text>

                    <View style={styles.modalBody}>
                        <Text style={styles.inputLabel}>E-Mail</Text>
                        <View style={styles.inputContainer}>
                            <View style={styles.inputIcon}>
                                <Mail size={18} color="#64748B" />
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="name@beispiel.de"
                                placeholderTextColor="#64748B"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <Pressable
                            onPress={handleReset}
                            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Send size={18} color="#fff" />
                                    <Text style={styles.submitButtonText}>Link senden</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                    <View style={styles.modalFooter} />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#0F172A', // Dark bg matches app theme
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoText: {
        color: '#94A3B8',
        fontSize: 14,
        padding: 20,
        paddingBottom: 0,
        lineHeight: 20,
    },
    modalBody: {
        padding: 20,
    },
    inputLabel: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 24,
    },
    inputIcon: {
        padding: 16,
    },
    textInput: {
        flex: 1,
        color: '#fff',
        paddingVertical: 16,
        paddingRight: 16,
        fontSize: 16,
    },
    submitButton: {
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalFooter: {
        height: 32,
    },
});

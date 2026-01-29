import React, { useState } from 'react';
import { View, Text, Modal, TextInput, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, X } from 'lucide-react-native';

interface ChangePasswordModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    isForced?: boolean; // If true, user cannot dismiss without changing password
}

export default function ChangePasswordModal({
    visible,
    onClose,
    onSuccess,
    isForced = false
}: ChangePasswordModalProps) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleChangePassword = async () => {
        if (!newPassword.trim() || newPassword.length < 6) {
            Alert.alert('Fehler', 'Passwort muss mindestens 6 Zeichen haben');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Fehler', 'Passwörter stimmen nicht überein');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
                data: { must_change_password: false }
            });

            if (error) {
                Alert.alert('Fehler', error.message);
                return;
            }

            Alert.alert('Erfolgreich', 'Dein Passwort wurde geändert.');
            setNewPassword('');
            setConfirmPassword('');
            onSuccess();
        } catch (error) {
            console.error('Password change error:', error);
            Alert.alert('Fehler', 'Verbindungsfehler');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (isForced) {
            Alert.alert(
                'Passwort ändern erforderlich',
                'Du musst dein Passwort ändern, um fortzufahren.'
            );
            return;
        }
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {isForced ? 'Passwort ändern erforderlich' : 'Passwort ändern'}
                        </Text>
                        {!isForced && (
                            <Pressable onPress={handleClose} style={styles.closeButton}>
                                <X size={20} color="#94A3B8" />
                            </Pressable>
                        )}
                    </View>

                    {isForced && (
                        <Text style={styles.infoText}>
                            Dein Konto wurde mit einem temporären Passwort erstellt.
                            Bitte wähle ein neues Passwort.
                        </Text>
                    )}

                    <View style={styles.modalBody}>
                        <Text style={styles.inputLabel}>Neues Passwort</Text>
                        <View style={styles.inputContainer}>
                            <View style={styles.inputIcon}>
                                <Lock size={18} color="#64748B" />
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Mindestens 6 Zeichen"
                                placeholderTextColor="#64748B"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <Pressable
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.inputIcon}
                            >
                                {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                            </Pressable>
                        </View>

                        <Text style={styles.inputLabel}>Passwort bestätigen</Text>
                        <View style={styles.inputContainer}>
                            <View style={styles.inputIcon}>
                                <Lock size={18} color="#64748B" />
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Passwort wiederholen"
                                placeholderTextColor="#64748B"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                        </View>

                        <Pressable
                            onPress={handleChangePassword}
                            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>Passwort ändern</Text>
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
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoText: {
        color: '#94A3B8',
        fontSize: 14,
        padding: 16,
        paddingBottom: 0,
        lineHeight: 20,
    },
    modalBody: {
        padding: 16,
    },
    inputLabel: {
        color: '#94A3B8',
        fontSize: 14,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 16,
    },
    inputIcon: {
        padding: 12,
    },
    textInput: {
        flex: 1,
        color: '#fff',
        paddingVertical: 12,
        paddingRight: 12,
    },
    submitButton: {
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
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

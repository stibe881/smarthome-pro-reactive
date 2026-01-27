import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { Wifi, WifiOff, Save, LogOut, User, Server, Key, CheckCircle, XCircle, Shield, Bell, Palette, ChevronRight, LucideIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

// =====================================================
// CHILD COMPONENTS - Defined OUTSIDE of Settings
// =====================================================

interface SettingsSectionProps {
    title: string;
    children: React.ReactNode;
}

const SettingsSection = ({ title, children }: SettingsSectionProps) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>
            {title}
        </Text>
        <View style={styles.sectionContent}>
            {children}
        </View>
    </View>
);

interface SettingsRowProps {
    icon: React.ReactNode;
    iconColor: string;
    label: string;
    value?: string;
    onPress?: () => void;
    showChevron?: boolean;
    isLast?: boolean;
}

const SettingsRow = ({
    icon,
    iconColor,
    label,
    value,
    onPress,
    showChevron = false,
    isLast = false
}: SettingsRowProps) => (
    <Pressable
        onPress={onPress}
        style={[styles.row, !isLast && styles.rowBorder]}
    >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
            {icon}
        </View>
        <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{label}</Text>
            {value && <Text style={styles.rowValue}>{value}</Text>}
        </View>
        {showChevron && <ChevronRight size={16} color="#64748B" />}
    </Pressable>
);

// =====================================================
// MAIN SETTINGS COMPONENT
// =====================================================

export default function Settings() {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const { logout, user } = useAuth();
    const {
        isConnected,
        isConnecting,
        connect,
        disconnect,
        saveCredentials,
        getCredentials,
        entities
    } = useHomeAssistant();

    const [haUrl, setHaUrl] = useState('');
    const [haToken, setHaToken] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

    // Load saved credentials on mount
    useEffect(() => {
        (async () => {
            const creds = await getCredentials();
            if (creds) {
                setHaUrl(creds.url);
                setHaToken(creds.token);
            }
        })();
    }, []);

    const handleSaveAndConnect = async () => {
        if (!haUrl.trim() || !haToken.trim()) {
            Alert.alert('Fehler', 'Bitte URL und Token eingeben');
            return;
        }

        setIsSaving(true);
        setTestResult(null);

        try {
            await saveCredentials(haUrl.trim(), haToken.trim());
            const success = await connect();
            setTestResult(success ? 'success' : 'error');

            if (success) {
                Alert.alert('Erfolg', 'Verbindung zu Home Assistant hergestellt!');
            } else {
                Alert.alert('Fehler', 'Verbindung fehlgeschlagen. Überprüfe URL und Token.');
            }
        } catch (e) {
            setTestResult('error');
            Alert.alert('Fehler', 'Verbindung konnte nicht hergestellt werden.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Abmelden',
            'Möchtest du dich wirklich abmelden?',
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Abmelden',
                    style: 'destructive',
                    onPress: () => {
                        disconnect();
                        logout();
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? 24 : 16 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Optionen</Text>
                    </View>

                    {/* User Profile Card */}
                    <View style={styles.profileCard}>
                        <LinearGradient
                            colors={['#3B82F6', '#1D4ED8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.profileGradient}
                        >
                            <View style={styles.profileContent}>
                                <View style={styles.avatar}>
                                    <User size={32} color="#fff" />
                                </View>
                                <View style={styles.profileInfo}>
                                    <Text style={styles.profileLabel}>Angemeldet als</Text>
                                    <Text style={styles.profileEmail}>{user?.email}</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Connection Status */}
                    <SettingsSection title="Home Assistant">
                        <View style={styles.statusRow}>
                            <View style={styles.statusInfo}>
                                {isConnected ? (
                                    <View style={[styles.statusIcon, styles.statusIconSuccess]}>
                                        <Wifi size={20} color="#22C55E" />
                                    </View>
                                ) : (
                                    <View style={[styles.statusIcon, styles.statusIconError]}>
                                        <WifiOff size={20} color="#EF4444" />
                                    </View>
                                )}
                                <View style={styles.statusTextContainer}>
                                    <Text style={styles.statusTitle}>
                                        {isConnected ? 'Verbunden' : 'Nicht verbunden'}
                                    </Text>
                                    {isConnected && (
                                        <Text style={styles.statusSubtitle}>
                                            {entities.length} Geräte geladen
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <View style={[styles.statusDot, isConnected ? styles.bgSuccess : styles.bgError]} />
                        </View>

                        {/* URL Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Server URL</Text>
                            <View style={styles.inputWrapper}>
                                <View style={styles.inputIcon}>
                                    <Server size={18} color="#64748B" />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="http://homeassistant.local:8123"
                                    placeholderTextColor="#64748B"
                                    value={haUrl}
                                    onChangeText={setHaUrl}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                />
                            </View>
                        </View>

                        {/* Token Input */}
                        <View style={[styles.inputContainer, styles.lastInput]}>
                            <Text style={styles.inputLabel}>Access Token</Text>
                            <View style={styles.inputWrapper}>
                                <View style={styles.inputIcon}>
                                    <Key size={18} color="#64748B" />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Long-Lived Access Token"
                                    placeholderTextColor="#64748B"
                                    value={haToken}
                                    onChangeText={setHaToken}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    secureTextEntry
                                />
                            </View>
                            <Text style={styles.helperText}>
                                Profil → Sicherheit → Long-Lived Access Token
                            </Text>
                        </View>

                        {/* Test Result */}
                        {testResult && (
                            <View style={[
                                styles.resultContainer,
                                testResult === 'success' ? styles.resultSuccess : styles.resultError
                            ]}>
                                {testResult === 'success' ? (
                                    <CheckCircle size={18} color="#22C55E" />
                                ) : (
                                    <XCircle size={18} color="#EF4444" />
                                )}
                                <Text style={[
                                    styles.resultText,
                                    testResult === 'success' ? styles.textSuccess : styles.textError
                                ]}>
                                    {testResult === 'success' ? 'Verbindung erfolgreich!' : 'Verbindung fehlgeschlagen'}
                                </Text>
                            </View>
                        )}

                        {/* Save Button */}
                        <View style={styles.saveContainer}>
                            <Pressable
                                onPress={handleSaveAndConnect}
                                disabled={isSaving || isConnecting}
                                style={[
                                    styles.saveButton,
                                    (isSaving || isConnecting) && styles.saveButtonDisabled
                                ]}
                            >
                                {isSaving || isConnecting ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Save size={18} color="white" />
                                        <Text style={styles.saveButtonText}>
                                            Speichern & Verbinden
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </SettingsSection>

                    {/* App Settings */}
                    <SettingsSection title="App">
                        <SettingsRow
                            icon={<Bell size={20} color="#F59E0B" />}
                            iconColor="#F59E0B"
                            label="Benachrichtigungen"
                            value="Aktiviert"
                            showChevron
                        />
                        <SettingsRow
                            icon={<Palette size={20} color="#8B5CF6" />}
                            iconColor="#8B5CF6"
                            label="Erscheinungsbild"
                            value="Dunkel"
                            showChevron
                        />
                        <SettingsRow
                            icon={<Shield size={20} color="#22C55E" />}
                            iconColor="#22C55E"
                            label="Datenschutz"
                            showChevron
                            isLast
                        />
                    </SettingsSection>

                    {/* Logout */}
                    <Pressable
                        onPress={handleLogout}
                        style={styles.logoutButton}
                    >
                        <LogOut size={18} color="#EF4444" />
                        <Text style={styles.logoutText}>Abmelden</Text>
                    </Pressable>

                    {/* Version Info */}
                    <Text style={styles.versionText}>
                        SmartHome Pro v1.0.0
                    </Text>
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
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 8,
        paddingBottom: 32,
    },

    // Header
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },

    // Profile Card
    profileCard: {
        marginBottom: 24,
        borderRadius: 20,
        overflow: 'hidden',
    },
    profileGradient: {
        padding: 20,
    },
    profileContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInfo: {
        marginLeft: 16,
        flex: 1,
    },
    profileLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        marginBottom: 4,
    },
    profileEmail: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },

    // Section
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 12,
        paddingLeft: 4,
    },
    sectionContent: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1E293B',
    },

    // Rows
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#0F172A',
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowContent: {
        flex: 1,
        marginLeft: 12,
    },
    rowLabel: {
        color: '#fff',
        fontWeight: '500',
        fontSize: 16,
    },
    rowValue: {
        color: '#64748B',
        fontSize: 14,
        marginTop: 2,
    },

    // Status Row
    statusRow: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusIconSuccess: {
        backgroundColor: 'rgba(34,197,94,0.15)',
    },
    statusIconError: {
        backgroundColor: 'rgba(239,68,68,0.15)',
    },
    statusTextContainer: {
        marginLeft: 12,
    },
    statusTitle: {
        color: '#fff',
        fontWeight: '500',
        fontSize: 16,
    },
    statusSubtitle: {
        color: '#64748B',
        fontSize: 14,
        marginTop: 2,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    bgSuccess: {
        backgroundColor: '#22C55E',
    },
    bgError: {
        backgroundColor: '#EF4444',
    },

    // Inputs
    inputContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    lastInput: {
        borderBottomWidth: 0,
    },
    inputLabel: {
        color: '#94A3B8',
        fontSize: 14,
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
    },
    inputIcon: {
        padding: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        paddingVertical: 12,
        paddingRight: 12,
        paddingLeft: 0,
        fontSize: 16,
    },
    helperText: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 8,
    },

    // Result
    resultContainer: {
        margin: 16,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
    },
    resultSuccess: {
        backgroundColor: 'rgba(34,197,94,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.2)',
    },
    resultError: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.2)',
    },
    resultText: {
        marginLeft: 8,
        fontWeight: '500',
    },
    textSuccess: {
        color: '#4ADE80',
    },
    textError: {
        color: '#F87171',
    },

    // Save Button
    saveContainer: {
        padding: 16,
        paddingTop: 0,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 14,
        gap: 8,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // Logout
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.2)',
        padding: 16,
        borderRadius: 16,
        gap: 8,
    },
    logoutText: {
        color: '#F87171',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // Version
    versionText: {
        color: '#475569',
        textAlign: 'center',
        fontSize: 12,
        marginTop: 24,
    },
});

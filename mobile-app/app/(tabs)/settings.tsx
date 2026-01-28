import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions, StyleSheet, Switch, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { Wifi, WifiOff, Save, LogOut, User, Server, Key, CheckCircle, XCircle, Shield, Bell, Palette, ChevronRight, LucideIcon, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotificationSettingsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const [settings, setSettings] = useState({
        enabled: true,
        security: true,
        appliances: true,
        updates: false
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const saved = await AsyncStorage.getItem('notification_settings');
            if (saved) {
                setSettings(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load generic notification settings", e);
        }
    };

    const toggleSetting = async (key: keyof typeof settings) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        try {
            await AsyncStorage.setItem('notification_settings', JSON.stringify(newSettings));
        } catch (e) {
            console.error("Failed to save notification settings", e);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Benachrichtigungen</Text>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="#94A3B8" />
                    </Pressable>
                </View>

                <ScrollView style={styles.modalContent}>
                    <View style={styles.settingGroup}>
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.settingLabel}>Benachrichtigungen erlauben</Text>
                                <Text style={styles.settingDescription}>Generelle Erlaubnis für Push-Nachrichten</Text>
                            </View>
                            <Switch
                                value={settings.enabled}
                                onValueChange={() => toggleSetting('enabled')}
                                trackColor={{ false: '#334155', true: '#3B82F6' }}
                                thumbColor={'#fff'}
                            />
                        </View>
                    </View>

                    {settings.enabled && (
                        <View style={styles.settingGroup}>
                            <Text style={styles.groupTitle}>KATEGORIEN</Text>

                            <View style={styles.settingRow}>
                                <View style={styles.iconBadge}>
                                    <Shield size={20} color="#EF4444" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.settingLabel}>Sicherheit</Text>
                                    <Text style={styles.settingDescription}>Haustüre, Alarme, Schlösser</Text>
                                </View>
                                <Switch
                                    value={settings.security}
                                    onValueChange={() => toggleSetting('security')}
                                    trackColor={{ false: '#334155', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                />
                            </View>

                            <View style={styles.settingRow}>
                                <View style={[styles.iconBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                                    <Bell size={20} color="#3B82F6" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.settingLabel}>Haushaltsgeräte</Text>
                                    <Text style={styles.settingDescription}>Waschmaschine, Tumbler, Geschirrspüler</Text>
                                </View>
                                <Switch
                                    value={settings.appliances}
                                    onValueChange={() => toggleSetting('appliances')}
                                    trackColor={{ false: '#334155', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                />
                            </View>

                            <View style={styles.settingRow}>
                                <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                    <CheckCircle size={20} color="#10B981" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.settingLabel}>Updates & Infos</Text>
                                    <Text style={styles.settingDescription}>App Updates, Server Status</Text>
                                </View>
                                <Switch
                                    value={settings.updates}
                                    onValueChange={() => toggleSetting('updates')}
                                    trackColor={{ false: '#334155', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                />
                            </View>
                        </View>
                    )}

                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            Hinweis: Einige kritische Warnungen können möglicherweise nicht deaktiviert werden.
                        </Text>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
};

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
    const [notificationModalVisible, setNotificationModalVisible] = useState(false);

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
                            value="Verwalten"
                            showChevron
                            onPress={() => setNotificationModalVisible(true)}
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
            <NotificationSettingsModal
                visible={notificationModalVisible}
                onClose={() => setNotificationModalVisible(false)}
            />
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
        marginRight: 12,
    },
    rowContent: {
        flex: 1,
    },
    rowLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    rowValue: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 2,
    },

    // Status
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#0F172A',
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    statusInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    statusIconSuccess: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    statusIconError: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    statusTextContainer: {},
    statusTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    statusSubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
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
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#020617',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: 44,
        color: '#fff',
        fontSize: 15,
    },
    helperText: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 8,
        marginLeft: 4,
    },

    // Test Result
    resultContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        gap: 8,
    },
    resultSuccess: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    resultError: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    resultText: {
        fontSize: 14,
        fontWeight: '600',
    },
    textSuccess: {
        color: '#22C55E',
    },
    textError: {
        color: '#EF4444',
    },

    // Save Button
    saveContainer: {
        padding: 16,
        paddingTop: 0,
    },
    saveButton: {
        backgroundColor: '#3B82F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        gap: 8,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Logout
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        marginBottom: 32,
        gap: 8,
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },

    // Footer
    versionText: {
        textAlign: 'center',
        color: '#475569',
        fontSize: 13,
    },

    // New Modal Styles
    modalContainer: { flex: 1, backgroundColor: '#020617' },
    modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingTop: 20 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    closeButton: { padding: 8, backgroundColor: '#1E293B', borderRadius: 12 },
    modalContent: { flex: 1, padding: 20 },
    settingGroup: { marginBottom: 32, backgroundColor: '#0F172A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E293B' },
    groupTitle: { color: '#64748B', fontSize: 12, fontWeight: '700', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    settingLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
    settingDescription: { color: '#94A3B8', fontSize: 13, paddingRight: 16 },
    iconBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', alignItems: 'center', justifyContent: 'center' },
    infoBox: { padding: 16, backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, marginBottom: 40 },
    infoText: { color: '#60A5FA', fontSize: 13, textAlign: 'center' }
});

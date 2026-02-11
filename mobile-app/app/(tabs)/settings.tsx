import React, { useState, useEffect, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions, StyleSheet, Switch, Linking, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { useTheme, THEMES, ThemeType } from '../../contexts/ThemeContext';
import { Wifi, WifiOff, Save, LogOut, User, Server, Key, CheckCircle, XCircle, Shield, Bell, Palette, ChevronRight, LucideIcon, X, ScanFace, MapPin, Smartphone, Search, Calendar, Trash2, Users, Eye, EyeOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { DashboardConfigModal } from '../../components/DashboardConfigModal';
import { FamilyManagement } from '../../components/FamilyManagement';
import { ConnectionWizard } from '../../components/ConnectionWizard';
import { Activity, ShieldCheck, Zap, Blinds, AlertTriangle, Baby, Plus } from 'lucide-react-native';
import { useKidsMode } from '../../contexts/KidsContext';

const NotificationSettingsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const { notificationSettings, updateNotificationSettings } = useHomeAssistant();
    const { theme, setTheme, colors } = useTheme();
    const [token, setToken] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // Load Token for display
    useEffect(() => {
        if (visible) {
            loadToken();
        }
    }, [visible]);

    const loadToken = async () => {
        try {
            const { status } = await Notifications.getPermissionsAsync();
            if (status === 'granted') {
                const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
                if (projectId) {
                    const t = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
                    setToken(t);
                }
            }
        } catch (e) { console.warn('Failed to load token for settings display', e); }
    };

    const toggleSetting = async (category: 'security' | 'household' | 'home' | 'weather' | 'baby' | 'calendar', key: string) => {
        // Deep copy to prevent mutation of existing state causing comparison failure
        let newSettings = JSON.parse(JSON.stringify(notificationSettings));

        // Ensure category exists (migration safety)
        if (!newSettings[category]) newSettings[category] = {} as any;

        // Toggle
        // @ts-ignore - Dynamic access is safe here given our structure
        newSettings[category][key] = !newSettings[category][key];

        await updateNotificationSettings(newSettings);
    };

    const toggleEnabled = async () => {
        let newSettings = { ...notificationSettings };
        newSettings.enabled = !newSettings.enabled;
        await updateNotificationSettings(newSettings);
    };

    const testPush = async () => {
        if (!token) {
            Alert.alert("Fehler", "Kein Push-Token vorhanden.");
            return;
        }
        setIsTesting(true);
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Test Nachricht",
                    body: "Das ist eine lokale Test-Benachrichtigung.",
                    sound: 'default',
                },
                trigger: null,
            });
            Alert.alert(
                "Lokaler Test gesendet",
                "Die lokale Nachricht wurde gesendet. Wenn Benachrichtigungen generell funktionieren, solltest du sie jetzt sehen."
            );
        } catch (e) {
            Alert.alert("Fehler", "Lokaler Test fehlgeschlagen.");
        } finally {
            setIsTesting(false);
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

                <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>

                    {/* DESIGN SELECTOR - MOVED TO MAIN SETTINGS */}

                    {/* INFO BOX REMOVED - NO LONGER NEEDED */}

                    <View style={styles.settingGroup}>
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.settingLabel}>Alle Benachrichtigungen</Text>
                                <Text style={styles.settingDescription}>Globaler Schalter für dieses Gerät</Text>
                            </View>
                            <Switch
                                value={notificationSettings.enabled}
                                onValueChange={toggleEnabled}
                                trackColor={{ false: '#334155', true: '#3B82F6' }}
                                thumbColor={'#fff'}
                            />
                        </View>
                    </View>

                    {notificationSettings.enabled && (
                        <>
                            {/* SICHERHEIT */}
                            <View style={styles.settingGroup}>
                                <Text style={styles.groupTitle}>SICHERHEIT</Text>
                                <View style={styles.settingRow}>
                                    <View style={styles.iconBadge}>
                                        <Shield size={20} color="#EF4444" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.settingLabel}>Türen UG</Text>
                                        <Text style={styles.settingDescription}>Waschküche & Highlight</Text>
                                    </View>
                                    <Switch
                                        value={notificationSettings.security?.doors_ug ?? true}
                                        onValueChange={() => toggleSetting('security', 'doors_ug')}
                                        trackColor={{ false: '#334155', true: '#3B82F6' }}
                                        thumbColor={'#fff'}
                                    />
                                </View>
                            </View>

                            {/* HAUSHALT */}
                            <View style={styles.settingGroup}>
                                <Text style={styles.groupTitle}>HAUSHALT</Text>
                                <View style={styles.settingRow}>
                                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                        <CheckCircle size={20} color="#10B981" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.settingLabel}>Einkaufs-Erinnerung</Text>
                                        <Text style={styles.settingDescription}>Wenn du im Laden bist</Text>
                                    </View>
                                    <Switch
                                        value={notificationSettings.household?.shopping ?? true}
                                        onValueChange={() => toggleSetting('household', 'shopping')}
                                        trackColor={{ false: '#334155', true: '#3B82F6' }}
                                        thumbColor={'#fff'}
                                    />
                                </View>
                            </View>

                            {/* ZUHAUSE */}
                            <View style={styles.settingGroup}>
                                <Text style={styles.groupTitle}>ZUHAUSE</Text>
                                <View style={styles.settingRow}>
                                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                                        <MapPin size={20} color="#3B82F6" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.settingLabel}>Willkommen Zuhause</Text>
                                        <Text style={styles.settingDescription}>Geofencing (100m Radius)</Text>
                                    </View>
                                    <Switch
                                        value={notificationSettings.home?.welcome ?? true}
                                        onValueChange={() => toggleSetting('home', 'welcome')}
                                        trackColor={{ false: '#334155', true: '#3B82F6' }}
                                        thumbColor={'#fff'}
                                    />
                                </View>

                                <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: '#1E293B' }]}>
                                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                                        <Bell size={20} color="#F59E0B" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.settingLabel}>Türklingel</Text>
                                        <Text style={styles.settingDescription}>Wenn jemand klingelt</Text>
                                    </View>
                                    <Switch
                                        value={notificationSettings.home?.doorbell ?? true}
                                        onValueChange={() => toggleSetting('home', 'doorbell')}
                                        trackColor={{ false: '#334155', true: '#3B82F6' }}
                                        thumbColor={'#fff'}
                                    />
                                </View>
                            </View>

                            {/* WETTER */}
                            <View style={styles.settingGroup}>
                                <Text style={styles.groupTitle}>WETTER</Text>
                                <View style={styles.settingRow}>
                                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                                        <Shield size={20} color="#6366F1" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.settingLabel}>Wetterwarnung</Text>
                                        <Text style={styles.settingDescription}>Sturm, Gewitter, etc.</Text>
                                    </View>
                                    <Switch
                                        value={notificationSettings.weather?.warning ?? true}
                                        onValueChange={() => toggleSetting('weather', 'warning')}
                                        trackColor={{ false: '#334155', true: '#3B82F6' }}
                                        thumbColor={'#fff'}
                                    />
                                </View>
                            </View>

                            {/* BABY */}
                            <View style={styles.settingGroup}>
                                <Text style={styles.groupTitle}>BABYPHONE</Text>
                                <View style={styles.settingRow}>
                                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                                        <ScanFace size={20} color="#EC4899" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.settingLabel}>Baby Weint</Text>
                                        <Text style={styles.settingDescription}>Benachrichtigung bei Schreien</Text>
                                    </View>
                                    <Switch
                                        value={notificationSettings.baby?.cry ?? true}
                                        onValueChange={() => toggleSetting('baby', 'cry')}
                                        trackColor={{ false: '#334155', true: '#3B82F6' }}
                                        thumbColor={'#fff'}
                                    />
                                </View>
                            </View>


                            {/* KALENDER */}
                            <View style={styles.settingGroup}>
                                <Text style={styles.groupTitle}>KALENDER</Text>
                                <View style={styles.settingRow}>
                                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                                        <Calendar size={20} color="#A855F7" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.settingLabel}>Geburtstage</Text>
                                        <Text style={styles.settingDescription}>Benachrichtigung bei Geburtstagen</Text>
                                    </View>
                                    <Switch
                                        value={notificationSettings.calendar?.birthday ?? true}
                                        onValueChange={() => toggleSetting('calendar', 'birthday')}
                                        trackColor={{ false: '#334155', true: '#3B82F6' }}
                                        thumbColor={'#fff'}
                                    />
                                </View>
                            </View>
                        </>
                    )
                    }

                    <View style={styles.settingGroup}>
                        <Text style={styles.groupTitle}>DIAGNOSE</Text>
                        <View style={{ marginBottom: 16 }}>
                            <Text style={styles.settingLabel}>Push Token (Tippen zum Kopieren)</Text>
                            <Pressable onPress={async () => {
                                if (token) {
                                    await Clipboard.setStringAsync(token);
                                    Alert.alert("Kopiert", "Token in Zwischenablage kopiert!");
                                }
                            }}>
                                <Text style={[styles.settingDescription, { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#3B82F6' }]} numberOfLines={2}>
                                    {token || "Wird geladen..."}
                                </Text>
                            </Pressable>
                        </View>

                        <Pressable
                            style={[styles.saveButton, { backgroundColor: '#334155' }]}
                            onPress={testPush}
                            disabled={isTesting}
                        >
                            <Bell size={20} color="#fff" />
                            <Text style={styles.saveButtonText}>Lokalen Test senden</Text>
                        </Pressable>
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            Hinweis: Diese Einstellungen gelten nur für dieses Gerät.
                        </Text>
                    </View>
                </ScrollView >
            </View >
        </Modal >
    );
};

const ChangePasswordModal = ({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) => {
    const { changePassword } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async () => {
        if (password.length < 6) {
            Alert.alert('Fehler', 'Das Passwort muss mindestens 6 Zeichen lang sein.');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Fehler', 'Die Passwörter stimmen nicht überein.');
            return;
        }

        setIsLoading(true);
        try {
            await changePassword(password);
            Alert.alert('Erfolg', 'Dein Passwort wurde erfolgreich geändert.');
            setPassword('');
            setConfirmPassword('');
            onClose();
        } catch (e: any) {
            Alert.alert('Fehler', 'Passwortänderung fehlgeschlagen: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Passwort ändern</Text>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>
                <ScrollView style={{ padding: 16 }}>
                    <Text style={{ color: colors.subtext, marginBottom: 8, fontSize: 12 }}>Neues Passwort</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderColor: colors.border, borderWidth: 1, backgroundColor: colors.card, borderRadius: 12, marginBottom: 16 }}>
                        <TextInput
                            style={{ flex: 1, color: colors.text, padding: 12 }}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            placeholder="Mind. 6 Zeichen"
                            placeholderTextColor={colors.subtext}
                        />
                        <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 12 }}>
                            {showPassword ? <EyeOff size={18} color={colors.subtext} /> : <Eye size={18} color={colors.subtext} />}
                        </Pressable>
                    </View>

                    <Text style={{ color: colors.subtext, marginBottom: 8, fontSize: 12 }}>Passwort bestätigen</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderColor: colors.border, borderWidth: 1, backgroundColor: colors.card, borderRadius: 12, marginBottom: 24 }}>
                        <TextInput
                            style={{ flex: 1, color: colors.text, padding: 12 }}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showPassword}
                            placeholder="Gleiches Passwort erneut"
                            placeholderTextColor={colors.subtext}
                        />
                    </View>

                    <Pressable
                        onPress={handleSubmit}
                        disabled={isLoading}
                        style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center' }}
                    >
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Passwort speichern</Text>}
                    </Pressable>
                </ScrollView>
            </View>
        </Modal>
    );
};

const RoomConfigScreen = ({ room, onBack, updateRoom, deleteRoom, resetScore, entities, colors }: {
    room: any,
    onBack: () => void,
    updateRoom: (id: string, updates: Partial<any>) => void,
    deleteRoom: (id: string) => void,
    resetScore: (id: string) => void,
    entities: any[],
    colors: any
}) => {
    const lightEntities = entities.filter(e => e.entity_id.startsWith('light.'));
    const mediaEntities = entities.filter(e => e.entity_id.startsWith('media_player.'));

    const handleDelete = () => {
        Alert.alert("Zimmer löschen", "Möchtest du dieses Zimmer wirklich löschen?", [
            { text: "Abbrechen", style: "cancel" },
            { text: "Löschen", style: "destructive", onPress: () => { deleteRoom(room.id); onBack(); } }
        ]);
    };

    const handleResetScore = () => {
        Alert.alert(
            "Sterne zurücksetzen",
            `Möchtest du die Sterne von ${room.name} wirklich auf 0 zurücksetzen?`,
            [
                { text: "Abbrechen", style: "cancel" },
                {
                    text: "Zurücksetzen",
                    style: "destructive",
                    onPress: () => {
                        resetScore(room.id);
                        Alert.alert("Erledigt", "Sterne wurden zurückgesetzt.");
                    }
                }
            ]
        );
    };

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onBack}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ChevronRight size={24} color={colors.accent} style={{ transform: [{ rotate: '180deg' }] }} />
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{room.name}</Text>
                    </Pressable>
                    <Pressable onPress={handleDelete} style={{ padding: 8 }}>
                        <Trash2 size={20} color={colors.error} />
                    </Pressable>
                </View>

                <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={styles.settingGroup}>
                        <Text style={styles.groupTitle}>INFO</Text>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
                                value={room.name}
                                onChangeText={(val) => updateRoom(room.id, { name: val })}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Hintergrund URL</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
                                value={room.backgroundUri}
                                onChangeText={(val) => updateRoom(room.id, { backgroundUri: val })}
                                placeholder="https://..."
                                placeholderTextColor={colors.subtext}
                            />
                        </View>
                    </View>

                    <View style={styles.settingGroup}>
                        <Text style={styles.groupTitle}>GERÄTE-ZUWEISUNG</Text>
                        <EntitySelector
                            label="Licht"
                            value={room.lightEntity || ''}
                            entities={lightEntities}
                            onSelect={(val) => updateRoom(room.id, { lightEntity: val })}
                            colors={colors}
                        />
                        <EntitySelector
                            label="Media Player"
                            value={room.mediaEntity || ''}
                            entities={mediaEntities}
                            onSelect={(val) => updateRoom(room.id, { mediaEntity: val })}
                            colors={colors}
                        />
                        <EntitySelector
                            label="Schlaf-Trainer"
                            value={room.sleepTrainerEntity || ''}
                            entities={entities}
                            onSelect={(val) => updateRoom(room.id, { sleepTrainerEntity: val })}
                            colors={colors}
                        />
                    </View>

                    <View style={styles.settingGroup}>
                        <Text style={styles.groupTitle}>BESCHRÄNKUNGEN</Text>
                        <View style={styles.settingRow}>
                            <View>
                                <Text style={styles.settingLabel}>Max. Lautstärke ({(room.volumeLimit * 100).toFixed(0)}%)</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.settingGroup}>
                        <Text style={styles.groupTitle}>BELOHNUNGSSYSTEM</Text>
                        <View style={styles.settingRow}>
                            <View>
                                <Text style={styles.settingLabel}>Aktuelle Sterne</Text>
                                <Text style={styles.settingDescription}>{room.score || 0} Sterne gesammelt</Text>
                            </View>
                            <Pressable
                                onPress={handleResetScore}
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            >
                                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 12 }}>RESET</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
};

interface SettingsSectionProps {
    title: string;
    children: React.ReactNode;
    colors: any;
}

const SettingsSection = ({ title, children, colors }: SettingsSectionProps) => (
    <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
            {title}
        </Text>
        <View style={[styles.sectionContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {children}
        </View>
    </View>
);

const KidsSettingsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const { colors } = useTheme();
    const { config, updateConfig, isKidsModeActive, setKidsModeActive, addRoom, updateRoom, deleteRoom, resetScore } = useKidsMode();
    const { entities } = useHomeAssistant();
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

    const toggleKidsMode = () => {
        if (!isKidsModeActive) {
            setKidsModeActive(true);
            onClose();
        } else {
            Alert.prompt(
                "Kindermodus beenden",
                "Bitte gib den PIN ein:",
                [
                    { text: "Abbrechen", style: "cancel" },
                    {
                        text: "Bestätigen",
                        onPress: (input?: string) => {
                            if (input === config.parentalPin) {
                                setKidsModeActive(false);
                            } else {
                                Alert.alert("Falscher PIN");
                            }
                        }
                    }
                ],
                "secure-text"
            );
        }
    };

    const handleAddRoom = () => {
        Alert.prompt("Neues Zimmer", "Name des Zimmers:", [
            { text: "Abbrechen", style: "cancel" },
            { text: "Hinzufügen", onPress: (name: string | undefined) => name && addRoom(name) }
        ]);
    };

    const editingRoom = config.rooms.find(r => r.id === editingRoomId);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Kindermodus</Text>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="#94A3B8" />
                    </Pressable>
                </View>

                <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <SettingsSection title="STATUS" colors={colors}>
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.settingLabel}>Aktivieren</Text>
                                <Text style={styles.settingDescription}>Sperrt die App für Kinder</Text>
                            </View>
                            <Switch
                                value={isKidsModeActive}
                                onValueChange={toggleKidsMode}
                                trackColor={{ false: '#334155', true: '#10B981' }}
                                thumbColor={'#fff'}
                            />
                        </View>
                    </SettingsSection>

                    <SettingsSection title="ZIMMER" colors={colors}>
                        {config.rooms.map(room => (
                            <Pressable
                                key={room.id}
                                onPress={() => setEditingRoomId(room.id)}
                                style={({ pressed }) => [
                                    {
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                        opacity: pressed ? 0.7 : 1
                                    }
                                ]}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + '20', justifyContent: 'center', alignItems: 'center' }}>
                                        <Baby size={20} color={colors.accent} />
                                    </View>
                                    <View>
                                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{room.name}</Text>
                                        <Text style={{ color: colors.subtext, fontSize: 12 }}>
                                            {room.lightEntity ? 'Licht konf.' : 'Kein Licht'} • {room.mediaEntity ? 'Musik konf.' : 'Keine Musik'}
                                        </Text>
                                    </View>
                                </View>
                                <ChevronRight size={20} color={colors.subtext} />
                            </Pressable>
                        ))}

                        <Pressable
                            onPress={handleAddRoom}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                paddingVertical: 12,
                                marginTop: 8,
                                borderTopWidth: 1,
                                borderTopColor: colors.border + '50'
                            }}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
                                <Plus size={20} color={colors.accent} />
                            </View>
                            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>Zimmer hinzufügen</Text>
                        </Pressable>
                    </SettingsSection>

                    <SettingsSection title="ELTERN-EINSTELLUNGEN" colors={colors}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Parental PIN</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
                                value={config.parentalPin}
                                onChangeText={(val) => updateConfig({ parentalPin: val })}
                                keyboardType="number-pad"
                                maxLength={4}
                                secureTextEntry
                            />
                        </View>
                    </SettingsSection>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>

            {editingRoom && (
                <RoomConfigScreen
                    room={editingRoom}
                    onBack={() => setEditingRoomId(null)}
                    updateRoom={updateRoom}
                    deleteRoom={deleteRoom}
                    resetScore={resetScore}
                    entities={entities}
                    colors={colors}
                />
            )}
        </Modal>
    );
};


const EntitySelector = ({ label, value, entities, onSelect, colors }: { label: string, value: string, entities: any[], onSelect: (id: string) => void, colors: any }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [search, setSearch] = useState('');
    const selectedEntity = entities.find(e => e.entity_id === value);

    const filteredEntities = entities.filter(e =>
        e.entity_id.toLowerCase().includes(search.toLowerCase()) ||
        (e.attributes.friendly_name || '').toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id));

    return (
        <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{label}</Text>
            <Pressable
                onPress={() => setModalVisible(true)}
                style={[styles.input, { backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 12 }]}
            >
                <Text style={{ color: value ? colors.text : colors.subtext }}>
                    {selectedEntity?.attributes?.friendly_name || value || "Keines ausgewählt"}
                </Text>
            </Pressable>

            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={[styles.modalHeader, { paddingHorizontal: 20 }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{label} wählen</Text>
                        <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>

                    <View style={{ padding: 16 }}>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.card, color: colors.text, marginBottom: 12 }]}
                            placeholder="Suchen..."
                            placeholderTextColor={colors.subtext}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
                        <Pressable
                            onPress={() => { onSelect(''); setModalVisible(false); }}
                            style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '50' }}
                        >
                            <Text style={{ color: colors.accent }}>Keine Auswahl</Text>
                        </Pressable>
                        {filteredEntities.map(e => (
                            <Pressable
                                key={e.entity_id}
                                onPress={() => { onSelect(e.entity_id); setModalVisible(false); }}
                                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '50' }}
                            >
                                <Text style={{ color: colors.text, fontWeight: e.entity_id === value ? 'bold' : 'normal' }}>
                                    {e.attributes.friendly_name || e.entity_id}
                                </Text>
                                <Text style={{ color: colors.subtext, fontSize: 12 }}>{e.entity_id}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
};

interface SettingsRowProps {
    icon: React.ReactNode;
    iconColor: string;
    label: string;
    value?: string;
    onPress?: () => void;
    showChevron?: boolean;
    isLast?: boolean;
    colors: any;
}

const SettingsRow = ({
    icon,
    iconColor,
    label,
    value,
    onPress,
    showChevron = false,
    isLast = false,
    colors
}: SettingsRowProps) => (
    <Pressable
        onPress={onPress}
        style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }, { backgroundColor: colors.card }]}
    >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
            {icon}
        </View>
        <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
            {value && <Text style={[styles.rowValue, { color: colors.subtext }]}>{value}</Text>}
        </View>
        {showChevron && <ChevronRight size={16} color={colors.subtext} />}
    </Pressable>
);

// =====================================================
// MAIN SETTINGS COMPONENT
// =====================================================

export default function Settings() {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const { logout, user, isBiometricsSupported, isBiometricsEnabled, toggleBiometrics, deleteAccount } = useAuth();
    const {
        isConnected,
        haBaseUrl,
        saveCredentials,
        disconnect,
        notificationSettings,
        updateNotificationSettings,
        isGeofencingActive,
        setHomeLocation,
        connect,
        getCredentials,
        entities,
        isConnecting
    } = useHomeAssistant();
    const { theme, setTheme, colors } = useTheme();

    const [haUrl, setHaUrl] = useState('');
    const [haToken, setHaToken] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [notificationModalVisible, setNotificationModalVisible] = useState(false);
    const [configModalVisible, setConfigModalVisible] = useState(false);
    const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
    const [isHAExpanded, setIsHAExpanded] = useState(false);
    const [isFamilyExpanded, setIsFamilyExpanded] = useState(false);
    const [kidsModalVisible, setKidsModalVisible] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    // Effect to update status bar style based on theme
    useEffect(() => {
        // This side effect is handled in ThemeProvider, but we can double check logic here if needed.
    }, [theme]);

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
                setIsHAExpanded(false); // Auto-collapse on success
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

    const handleDeleteAccount = () => {
        Alert.alert(
            'Konto unwiderruflich löschen',
            'Bist du sicher? Alle deine Daten und Einstellungen werden permanent gelöscht. Dies kann nicht rückgängig gemacht werden.',
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'LÖSCHEN',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteAccount();
                            Alert.alert('Erfolg', 'Dein Konto wurde gelöscht.');
                        } catch (e: any) {
                            Alert.alert('Fehler', 'Löschen fehlgeschlagen: ' + e.message);
                        }
                    }
                }
            ]
        );
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

    const ThemeCard = ({ itemTheme }: { itemTheme: ThemeType }) => {
        const isActive = theme === itemTheme;
        const themeConfig = THEMES[itemTheme];

        return (
            <Pressable
                onPress={() => setTheme(itemTheme)}
                style={{
                    marginRight: 12,
                    width: 100,
                    height: 140,
                    borderRadius: 16,
                    backgroundColor: themeConfig.card,
                    borderWidth: isActive ? 2 : 1,
                    borderColor: isActive ? colors.accent : themeConfig.border,
                    overflow: 'hidden',
                    position: 'relative',
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 4,
                }}
            >
                {/* Preview Header / Background */}
                <View style={{ flex: 1, backgroundColor: themeConfig.background, alignItems: 'center', justifyContent: 'center' }}>
                    {/* Mini UI Representation */}
                    <View style={{ width: '80%', height: 8, borderRadius: 4, backgroundColor: themeConfig.card, marginBottom: 6 }} />
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: themeConfig.accent }} />
                        <View style={{ width: 40, height: 24, borderRadius: 6, backgroundColor: themeConfig.card }} />
                    </View>
                </View>

                {/* Label */}
                <View style={{ padding: 10, backgroundColor: themeConfig.card, borderTopWidth: 1, borderTopColor: themeConfig.border }}>
                    <Text style={{
                        color: themeConfig.text,
                        fontSize: 12,
                        fontWeight: '600',
                        textAlign: 'center',
                        textTransform: 'capitalize'
                    }}>
                        {itemTheme}
                    </Text>
                </View>

                {isActive && (
                    <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.accent, borderRadius: 10, padding: 2 }}>
                        <CheckCircle size={14} color="#fff" />
                    </View>
                )}
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Background Image Layer */}
            {colors.backgroundImage && (
                <View style={StyleSheet.absoluteFill}>
                    <Image
                        source={colors.backgroundImage}
                        style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: 1 }}
                        blurRadius={0}
                    />
                    {/* Optional Gradient Overlay for readability if needed, currently managed by theme colors */}
                </View>
            )}

            <SafeAreaView style={{ flex: 1 }}>
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
                            <Text style={[styles.title, { color: colors.text }]}>Optionen</Text>
                        </View>

                        {/* User Profile Card */}
                        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                            <View style={[styles.profileContent, { padding: 20 }]}>
                                <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                                    <User size={32} color={colors.accent} />
                                </View>
                                <View style={styles.profileInfo}>
                                    <Text style={[styles.profileLabel, { color: colors.subtext }]}>Angemeldet als</Text>
                                    <Text style={[styles.profileEmail, { color: colors.text }]}>{user?.email}</Text>
                                </View>
                            </View>
                        </View>

                        {/* THEME SELECTION - MOVED TO MAIN SCREEN */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>DESIGN</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, paddingHorizontal: 4, paddingBottom: 8 }}>
                                {(Object.keys(THEMES) as ThemeType[]).map((t) => (
                                    <ThemeCard key={t} itemTheme={t} />
                                ))}
                            </ScrollView>
                        </View>

                        <SettingsSection title="Kindermodus" colors={colors}>
                            <SettingsRow
                                icon={<Baby size={20} color={colors.accent} />}
                                iconColor={colors.accent}
                                label="Kindermodus konfigurieren"
                                showChevron
                                onPress={() => setKidsModalVisible(true)}
                                colors={colors}
                            />
                        </SettingsSection>

                        {/* App Settings */}
                        <SettingsSection title="App" colors={colors}>
                            <SettingsRow
                                icon={<Palette size={20} color={colors.accent} />}
                                iconColor={colors.accent}
                                label="Dashboard anpassen"
                                showChevron
                                onPress={() => setConfigModalVisible(true)}
                                colors={colors}
                            />
                            <SettingsRow
                                icon={<Bell size={20} color={notificationSettings.enabled ? colors.accent : colors.subtext} />}
                                iconColor={notificationSettings.enabled ? colors.accent : colors.subtext}
                                label="Benachrichtigungen"
                                showChevron
                                onPress={() => setNotificationModalVisible(true)}
                                isLast
                                colors={colors}
                            />
                        </SettingsSection>

                        <SettingsSection title="Standort" colors={colors}>
                            <SettingsRow
                                icon={<MapPin size={20} color={isGeofencingActive ? colors.success : colors.subtext} />}
                                iconColor={isGeofencingActive ? colors.success : colors.subtext}
                                label="Standort als Zuhause setzen"
                                value={isGeofencingActive ? 'Aktiv' : 'Inaktiv'}
                                onPress={setHomeLocation}
                                isLast
                                colors={colors}
                            />
                        </SettingsSection>

                        <SettingsSection title="Sicherheit" colors={colors}>
                            {isBiometricsSupported && (
                                <SettingsRow
                                    icon={<ScanFace size={20} color={colors.accent} />}
                                    iconColor={colors.accent}
                                    label={Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Biometrie'}
                                    value={isBiometricsEnabled ? 'Aktiv' : 'Inaktiv'}
                                    onPress={toggleBiometrics}
                                    colors={colors}
                                />
                            )}
                            <SettingsRow
                                icon={<Key size={20} color={colors.accent} />}
                                iconColor={colors.accent}
                                label="Passwort ändern"
                                showChevron
                                onPress={() => setChangePasswordModalVisible(true)}
                                colors={colors}
                            />
                            <SettingsRow
                                icon={<Shield size={20} color={colors.success} />}
                                iconColor={colors.success}
                                label="Datenschutz"
                                showChevron
                                onPress={() => Linking.openURL('https://gross-ict.ch/datenschutz')}
                                colors={colors}
                            />
                            <SettingsRow
                                icon={<Trash2 size={20} color={colors.error} />}
                                iconColor={colors.error}
                                label="Konto löschen"
                                onPress={handleDeleteAccount}
                                isLast
                                colors={colors}
                            />
                        </SettingsSection>

                        {/* FAMILY Management - COLLAPSIBLE */}
                        <View style={styles.section}>
                            <Pressable
                                onPress={() => setIsFamilyExpanded(!isFamilyExpanded)}
                                style={[styles.sectionContent, {
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 16,
                                    justifyContent: 'space-between'
                                }]}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[styles.iconContainer, { backgroundColor: colors.accent + '20' }]}>
                                        <Users size={20} color={colors.accent} />
                                    </View>
                                    <View>
                                        <Text style={[styles.rowLabel, { color: colors.text }]}>Familienmitglieder</Text>
                                        <Text style={[styles.rowValue, { color: colors.subtext, marginTop: 2 }]}>
                                            Verwalten & Einladen
                                        </Text>
                                    </View>
                                </View>
                                {isFamilyExpanded ? <ChevronRight size={20} color={colors.subtext} style={{ transform: [{ rotate: '90deg' }] }} /> : <ChevronRight size={20} color={colors.subtext} />}
                            </Pressable>

                            {isFamilyExpanded && (
                                <View style={[styles.sectionContent, {
                                    marginTop: 8,
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                    padding: 8
                                }]}>
                                    <FamilyManagement colors={colors} />
                                </View>
                            )}
                        </View>

                        {/* HOME ASSISTANT - COLLAPSIBLE AT BOTTOM */}
                        <View style={styles.section}>
                            <Pressable
                                onPress={() => setIsHAExpanded(!isHAExpanded)}
                                style={[styles.sectionContent, {
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 16,
                                    justifyContent: 'space-between'
                                }]}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[styles.iconContainer, { backgroundColor: isConnected ? colors.success + '20' : colors.error + '20' }]}>
                                        <Server size={20} color={isConnected ? colors.success : colors.error} />
                                    </View>
                                    <View>
                                        <Text style={[styles.rowLabel, { color: colors.text }]}>Home Assistant</Text>
                                        <Text style={[styles.rowValue, { color: isConnected ? colors.success : colors.error, marginTop: 2 }]}>
                                            {isConnected ? 'Verbunden' : 'Nicht verbunden'}
                                        </Text>
                                    </View>
                                </View>
                                {isHAExpanded ? <ChevronRight size={20} color={colors.subtext} style={{ transform: [{ rotate: '90deg' }] }} /> : <ChevronRight size={20} color={colors.subtext} />}
                            </Pressable>

                            {isHAExpanded && (
                                <View style={[styles.sectionContent, {
                                    marginTop: 8,
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                    padding: 16
                                }]}>
                                    {/* URL Input */}
                                    <View style={styles.inputContainer}>
                                        <Text style={[styles.inputLabel, { color: colors.subtext }]}>Server URL</Text>
                                        <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                            <View style={styles.inputIcon}>
                                                <Server size={18} color={colors.subtext} />
                                            </View>
                                            <TextInput
                                                style={[styles.input, { color: colors.text }]}
                                                placeholder="http://homeassistant.local:8123"
                                                placeholderTextColor={colors.subtext}
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
                                        <Text style={[styles.inputLabel, { color: colors.subtext }]}>Access Token</Text>
                                        <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                            <View style={styles.inputIcon}>
                                                <Key size={18} color={colors.subtext} />
                                            </View>
                                            <TextInput
                                                style={[styles.input, { color: colors.text }]}
                                                placeholder="Long-Lived Access Token"
                                                placeholderTextColor={colors.subtext}
                                                value={haToken}
                                                onChangeText={setHaToken}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                secureTextEntry
                                            />
                                        </View>
                                        <Text style={[styles.helperText, { color: colors.subtext }]}>
                                            Profil → Sicherheit → Long-Lived Access Token
                                        </Text>
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={[styles.saveContainer, { flexDirection: 'row', gap: 12 }]}>
                                        <Pressable
                                            onPress={() => setShowWizard(true)}
                                            style={[styles.saveButton, { backgroundColor: colors.accent, flex: 1, flexDirection: 'row', gap: 8 }]}
                                        >
                                            <Zap size={18} color="#fff" />
                                            <Text style={styles.saveButtonText}>Setup Wizard</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={handleSaveAndConnect}
                                            disabled={isSaving || isConnecting}
                                            style={[
                                                styles.saveButton,
                                                { backgroundColor: colors.success, flex: 1 },
                                                (isSaving || isConnecting) && styles.saveButtonDisabled
                                            ]}
                                        >
                                            {isSaving || isConnecting ? (
                                                <ActivityIndicator size="small" color="white" />
                                            ) : (
                                                <Text style={styles.saveButtonText}>Speichern</Text>
                                            )}
                                        </Pressable>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Logout */}
                        <Pressable
                            onPress={handleLogout}
                            style={[styles.logoutButton, { marginTop: 8 }]}
                        >
                            <LogOut size={18} color={colors.error} />
                            <Text style={[styles.logoutText, { color: colors.error }]}>Abmelden</Text>
                        </Pressable>

                        {/* Version Info */}
                        <Text style={[styles.versionText, { color: colors.subtext }]}>
                            SmartHome Pro v1.1.0 • Theme: {theme}
                        </Text>
                    </ScrollView>
                </KeyboardAvoidingView>
                <NotificationSettingsModal
                    visible={notificationModalVisible}
                    onClose={() => setNotificationModalVisible(false)}
                />
                <DashboardConfigModal
                    visible={configModalVisible}
                    onClose={() => setConfigModalVisible(false)}
                />
                <ChangePasswordModal
                    visible={changePasswordModalVisible}
                    onClose={() => setChangePasswordModalVisible(false)}
                    colors={colors}
                />
                <ConnectionWizard
                    visible={showWizard}
                    onClose={() => setShowWizard(false)}
                />
                <KidsSettingsModal
                    visible={kidsModalVisible}
                    onClose={() => setKidsModalVisible(false)}
                />
            </SafeAreaView>
        </View>
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
    inputGroup: {
        marginBottom: 20,
    },
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

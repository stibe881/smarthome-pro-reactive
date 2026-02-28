import React, { useState, useEffect, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions, StyleSheet, Switch, Linking, Modal, Image, ActionSheetIOS } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { useTheme, THEMES, ThemeType, AutoThemeConfig, THEME_DISPLAY_NAMES, DARK_THEMES, LIGHT_THEMES } from '../../contexts/ThemeContext';
import { Wifi, WifiOff, Save, LogOut, User, Server, Key, CheckCircle, XCircle, Shield, Bell, Palette, ChevronRight, LucideIcon, X, ScanFace, MapPin, Smartphone, Search, Calendar, Trash2, Users, Eye, EyeOff, Sun, Moon, Store, Camera, RotateCw, Cloud, CloudRain, ShoppingCart, DoorOpen, DoorClosed, BellRing, Wind, Fan, Waves, BatteryMedium, Lock, Disc3 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { FamilyManagement } from '../../components/FamilyManagement';
import { ConnectionWizard } from '../../components/ConnectionWizard';
import { AutomationsModal } from '../../components/AutomationsModal';
import { ShoppingLocationsModal } from '../../components/ShoppingLocationsModal';
import { NotificationTypesManager } from '../../components/NotificationTypesManager';
import { WidgetSettings } from '../../components/WidgetSettings';
import { QuickActionsConfigModal } from '../../components/QuickActionsConfigModal';
import { DashboardConfigModal } from '../../components/DashboardConfigModal';
import { Activity, ShieldCheck, Zap, Blinds, AlertTriangle, Baby, Plus, Settings as SettingsIcon, LayoutGrid } from 'lucide-react-native';
import { useKidsMode, KIDS_GENDER_THEMES, KidsGender } from '../../contexts/KidsContext';
import { supabase } from '../../lib/supabase';

// Defensive import for native module (not available in Expo Go)
let setAlternateAppIcon: (name: string | null) => Promise<void> = async () => { };
let getAppIconName: () => string | null = () => null;
let supportsAlternateIcons: boolean = false;
try {
    const mod = require('expo-alternate-app-icons');
    setAlternateAppIcon = mod.setAlternateAppIcon;
    getAppIconName = mod.getAppIconName;
    supportsAlternateIcons = mod.supportsAlternateIcons ?? false;
} catch (e) {
    // Silently ignore – not available in Expo Go or on web
}

// App Icon color variants
const APP_ICON_VARIANTS = [
    { key: null, label: 'Original', color: '#3B82F6', preview: require('../../assets/icon.png') },
    { key: 'Pink', label: 'Pink', color: '#FF1493', preview: require('../../assets/icons/icon-pink.png') },
    { key: 'Green', label: 'Grün', color: '#00B450', preview: require('../../assets/icons/icon-green.png') },
    { key: 'Black', label: 'Schwarz', color: '#1E1E28', preview: require('../../assets/icons/icon-black.png') },
    { key: 'Orange', label: 'Orange', color: '#FF8C00', preview: require('../../assets/icons/icon-orange.png') },
    { key: 'Pride', label: 'Pride 🌈', color: 'rainbow', preview: require('../../assets/icons/icon-pride.png') },
];

// Icon mapping for dynamic notification types – must match ICON_OPTIONS in NotificationTypesManager
const DYNAMIC_ICON_MAP: Record<string, any> = {
    bell: Bell,
    'bell-ring': BellRing,
    shield: Shield,
    lock: Lock,
    'door-open': DoorOpen,
    'door-closed': DoorClosed,
    camera: Camera,
    baby: Baby,
    calendar: Calendar,
    'cloud-lightning': CloudLightning,
    sun: Sun,
    moon: Moon,
    wind: Wind,
    eye: Eye,
    zap: Zap,
    home: HomeLucide,
    thermometer: Thermometer,
    droplets: Droplets,
    waves: Waves,
    fan: Fan,
    'shopping-cart': ShoppingCart,
    battery: BatteryMedium,
    bot: Disc3,
    'scan-face': ScanFace,
    'check-circle': CheckCircle,
    'map-pin': MapPin,
};

import { CloudLightning, House as HomeLucide, Thermometer, Droplets } from 'lucide-react-native';

interface DynamicNotifType {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    category_key: string;
    display_group: string | null;
    is_active: boolean;
}

interface UserNotifPref {
    notification_type_id: string;
    enabled: boolean;
}

const NotificationSettingsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const { notificationSettings, updateNotificationSettings } = useHomeAssistant();
    const { theme, setTheme, colors } = useTheme();
    const { user, userRole } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [showManager, setShowManager] = useState(false);

    // Dynamic notification types from DB
    const [dynamicTypes, setDynamicTypes] = useState<DynamicNotifType[]>([]);
    const [userPrefs, setUserPrefs] = useState<Record<string, boolean>>({});
    const [loadingDynamic, setLoadingDynamic] = useState(false);

    // Group dynamic types by display category, sorted alphabetically
    const groupedTypes = useMemo(() => {
        if (dynamicTypes.length === 0) return [];
        const groups: Record<string, DynamicNotifType[]> = {};
        for (const dtype of dynamicTypes) {
            const group = dtype.display_group || 'Andere';
            if (!groups[group]) groups[group] = [];
            groups[group].push(dtype);
        }
        const sortedGroupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'de'));
        return sortedGroupNames.map(name => ({
            name,
            types: groups[name].sort((a, b) => a.name.localeCompare(b.name, 'de')),
        }));
    }, [dynamicTypes]);

    // Load Token for display
    useEffect(() => {
        if (visible) {
            loadToken();
            fetchDynamicTypes();
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

    const fetchDynamicTypes = async () => {
        if (!user) return;
        setLoadingDynamic(true);
        try {
            // Fetch active notification types
            const { data: types, error: typesError } = await supabase
                .from('notification_types')
                .select('id, name, description, icon, color, category_key, display_group, is_active')
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (typesError) {
                console.warn('Failed to fetch notification types:', typesError);
            } else {
                setDynamicTypes(types || []);
            }

            // Fetch user preferences
            const { data: prefs, error: prefsError } = await supabase
                .from('user_notification_preferences')
                .select('notification_type_id, enabled')
                .eq('user_id', user.id);

            if (!prefsError && prefs) {
                const prefMap: Record<string, boolean> = {};
                for (const p of prefs) {
                    prefMap[p.notification_type_id] = p.enabled;
                }
                setUserPrefs(prefMap);
            }
        } catch (e) {
            console.warn('Error loading dynamic notification types:', e);
        } finally {
            setLoadingDynamic(false);
        }
    };

    const toggleDynamicPref = async (typeId: string) => {
        if (!user) return;
        const currentValue = userPrefs[typeId] ?? true; // default enabled
        const newValue = !currentValue;

        // Optimistic update
        const updatedPrefs = { ...userPrefs, [typeId]: newValue };
        setUserPrefs(updatedPrefs);

        // Also update the AsyncStorage cache for the notification handler
        try {
            const categoryPrefs: Record<string, boolean> = {};
            for (const t of dynamicTypes) {
                categoryPrefs[t.category_key] = updatedPrefs[t.id] ?? true;
            }
            await AsyncStorage.setItem('@smarthome_user_notif_prefs', JSON.stringify(categoryPrefs));
        } catch (e) {
            console.warn('Failed to update notification prefs cache:', e);
        }

        try {
            // Upsert preference
            const { error } = await supabase
                .from('user_notification_preferences')
                .upsert({
                    user_id: user.id,
                    notification_type_id: typeId,
                    enabled: newValue,
                }, { onConflict: 'user_id,notification_type_id' });

            if (error) {
                console.error('Failed to save preference:', error);
                // Revert on error
                setUserPrefs(prev => ({ ...prev, [typeId]: currentValue }));
            }
        } catch (e) {
            console.error('Error toggling preference:', e);
            setUserPrefs(prev => ({ ...prev, [typeId]: currentValue }));
        }
    };

    const toggleSetting = async (category: 'security' | 'household' | 'home' | 'weather' | 'baby' | 'calendar', key: string) => {
        let newSettings = JSON.parse(JSON.stringify(notificationSettings));
        if (!newSettings[category]) newSettings[category] = {} as any;
        // @ts-ignore
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
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Benachrichtigungen</Text>
                    <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.border }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>

                    <View style={[styles.settingGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Alle Benachrichtigungen</Text>
                                <Text style={[styles.settingDescription, { color: colors.subtext }]}>Globaler Schalter für deinen Account</Text>
                            </View>
                            <Switch
                                value={notificationSettings.enabled}
                                onValueChange={toggleEnabled}
                                trackColor={{ false: colors.border, true: colors.accent }}
                                thumbColor={'#fff'}
                            />
                        </View>
                    </View>

                    {notificationSettings.enabled && (
                        <>
                            {/* ===== DYNAMISCHE PUSH-KATEGORIEN GRUPPIERT ===== */}
                            {groupedTypes.map(group => (
                                <View key={group.name} style={[styles.settingGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[styles.groupTitle, { color: colors.subtext }]}>{group.name.toUpperCase()}</Text>
                                    {group.types.map((dtype, index) => {
                                        const IconComp = DYNAMIC_ICON_MAP[dtype.icon] || Bell;
                                        const isEnabled = userPrefs[dtype.id] ?? true;
                                        return (
                                            <View
                                                key={dtype.id}
                                                style={[
                                                    styles.settingRow,
                                                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }
                                                ]}
                                            >
                                                <View style={[styles.iconBadge, { backgroundColor: dtype.color + '25' }]}>
                                                    <IconComp size={20} color={dtype.color} />
                                                </View>
                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text style={[styles.settingLabel, { color: colors.text }]}>{dtype.name}</Text>
                                                    {dtype.description && (
                                                        <Text style={[styles.settingDescription, { color: colors.subtext }]}>{dtype.description}</Text>
                                                    )}
                                                </View>
                                                <Switch
                                                    value={isEnabled}
                                                    onValueChange={() => toggleDynamicPref(dtype.id)}
                                                    trackColor={{ false: colors.border, true: colors.accent }}
                                                    thumbColor={'#fff'}
                                                />
                                            </View>
                                        );
                                    })}
                                </View>
                            ))}


                            {loadingDynamic && dynamicTypes.length === 0 && (
                                <ActivityIndicator style={{ marginVertical: 20 }} color={colors.accent} />
                            )}
                        </>
                    )}


                    {/* Admin: Benachrichtigungen verwalten */}
                    {userRole === 'admin' && (
                        <View style={[styles.settingGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.groupTitle, { color: colors.subtext }]}>ADMIN</Text>
                            <Pressable
                                onPress={() => setShowManager(true)}
                                style={[styles.saveButton, { backgroundColor: colors.accent }]}
                            >
                                <SettingsIcon size={20} color="#fff" />
                                <Text style={styles.saveButtonText}>Benachrichtigungen verwalten</Text>
                            </Pressable>
                        </View>
                    )}

                    <View style={[styles.infoBox, { backgroundColor: colors.accent + '15' }]}>
                        <Text style={[styles.infoText, { color: colors.accent }]}>
                            Hinweis: Deine Einstellungen gelten für deinen Account
                            und werden auf allen Geräten synchronisiert.
                        </Text>
                    </View>
                </ScrollView >
            </View >

            {/* Admin Manager Modal */}
            <NotificationTypesManager
                visible={showManager}
                onClose={() => { setShowManager(false); fetchDynamicTypes(); }}
            />
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
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{room.name}</Text>
                    <Pressable onPress={onBack} style={{ padding: 8, backgroundColor: colors.border, borderRadius: 20 }}>
                        <X size={20} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={[styles.settingGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.groupTitle, { color: colors.subtext }]}>INFO</Text>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderWidth: 1, borderColor: colors.border }]}
                                value={room.name}
                                onChangeText={(val) => updateRoom(room.id, { name: val })}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Design</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                {(['girl', 'boy', 'neutral'] as KidsGender[]).map((g) => {
                                    const theme = KIDS_GENDER_THEMES[g];
                                    const isSelected = (room.gender || 'neutral') === g;
                                    return (
                                        <Pressable
                                            key={g}
                                            onPress={() => updateRoom(room.id, { gender: g })}
                                            style={{
                                                flex: 1,
                                                paddingVertical: 10,
                                                borderRadius: 10,
                                                alignItems: 'center',
                                                backgroundColor: isSelected ? theme.primary + '30' : colors.background,
                                                borderWidth: 2,
                                                borderColor: isSelected ? theme.primary : colors.border,
                                            }}
                                        >
                                            <Text style={{ fontSize: 22, marginBottom: 2 }}>{theme.emoji}</Text>
                                            <Text style={{ color: isSelected ? theme.primary : colors.subtext, fontSize: 11, fontWeight: '600' }}>{theme.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Hintergrund URL</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderWidth: 1, borderColor: colors.border }]}
                                value={room.backgroundUri}
                                onChangeText={(val) => updateRoom(room.id, { backgroundUri: val })}
                                placeholder="https://..."
                                placeholderTextColor={colors.subtext}
                            />
                        </View>
                    </View>

                    <View style={[styles.settingGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.groupTitle, { color: colors.subtext }]}>GERÄTE-ZUWEISUNG</Text>
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

                    <View style={[styles.settingGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.groupTitle, { color: colors.subtext }]}>BESCHRÄNKUNGEN</Text>
                        <View style={styles.settingRow}>
                            <View>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Max. Lautstärke ({(room.volumeLimit * 100).toFixed(0)}%)</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.settingGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.groupTitle, { color: colors.subtext }]}>BELOHNUNGSSYSTEM</Text>
                        <View style={styles.settingRow}>
                            <View>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Aktuelle Sterne</Text>
                                <Text style={[styles.settingDescription, { color: colors.subtext }]}>⭐ {room.score || 0} Sterne gesammelt</Text>
                            </View>
                            <Pressable
                                onPress={handleResetScore}
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            >
                                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 12 }}>RESET</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Delete Room Button */}
                    <Pressable
                        onPress={handleDelete}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: 16,
                            marginHorizontal: 16,
                            marginTop: 8,
                            marginBottom: 40,
                            borderRadius: 12,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                        }}
                    >
                        <Trash2 size={18} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 16 }}>Zimmer löschen</Text>
                    </Pressable>
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

const KidsSettingsSection = ({ title, children, colors }: SettingsSectionProps) => (
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
    const router = useRouter();
    const { config, updateConfig, isKidsModeActive, setKidsModeActive, addRoom, updateRoom, deleteRoom, resetScore, selectRoom } = useKidsMode();
    const { entities } = useHomeAssistant();
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    // Custom prompts (cross-platform replacement for Alert.prompt)
    const [showPinPrompt, setShowPinPrompt] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [showAddRoomPrompt, setShowAddRoomPrompt] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomGender, setNewRoomGender] = useState<KidsGender>('neutral');
    const [showRoomSelection, setShowRoomSelection] = useState(false);

    const toggleKidsMode = () => {
        if (!isKidsModeActive) {
            // Check: no rooms configured?
            if (config.rooms.length === 0) {
                Alert.alert(
                    "Kein Kinderzimmer",
                    "Bitte konfiguriere zuerst ein Kinderzimmer, bevor du den Kindermodus aktivierst."
                );
                return;
            }
            // If only 1 room, activate directly with that room
            if (config.rooms.length === 1) {
                activateWithRoom(config.rooms[0].id);
            } else {
                // Show room selection
                setShowRoomSelection(true);
            }
        } else {
            // Deactivate: ask for PIN
            setPinInput('');
            setShowPinPrompt(true);
        }
    };

    const activateWithRoom = async (roomId: string) => {
        await selectRoom(roomId);
        await setKidsModeActive(true);
        setShowRoomSelection(false);
        onClose();
        // Navigate to Home tab so the kid sees the dashboard immediately
        router.replace('/(tabs)');
        const room = config.rooms.find(r => r.id === roomId);
        setTimeout(() => {
            Alert.alert(
                "Kindermodus aktiv 🧒",
                `Das Zimmer "${room?.name || 'Kinderzimmer'}" ist jetzt aktiv.\n\nSo beendest du den Kindermodus:\n• Dashboard: ✕ oben rechts lange drücken\n• Oder: Einstellungen → Kindermodus → PIN eingeben`
            );
        }, 300);
    };

    const handlePinSubmit = () => {
        if (pinInput === config.parentalPin) {
            setKidsModeActive(false);
            setShowPinPrompt(false);
            setPinInput('');
        } else {
            Alert.alert("Falscher PIN");
            setPinInput('');
        }
    };

    const handleAddRoom = () => {
        setNewRoomName('');
        setNewRoomGender('neutral');
        setShowAddRoomPrompt(true);
    };

    const handleAddRoomSubmit = () => {
        if (newRoomName.trim()) {
            addRoom(newRoomName.trim(), newRoomGender);
            setShowAddRoomPrompt(false);
            setNewRoomName('');
        }
    };

    const editingRoom = config.rooms.find(r => r.id === editingRoomId);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Kindermodus</Text>
                    <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.card }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <KidsSettingsSection title="STATUS" colors={colors}>
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Aktivieren</Text>
                                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                                    {config.rooms.length === 0
                                        ? 'Erst ein Zimmer konfigurieren'
                                        : 'Sperrt die App für Kinder'}
                                </Text>
                            </View>
                            <Switch
                                value={isKidsModeActive}
                                onValueChange={toggleKidsMode}
                                trackColor={{ false: colors.border, true: colors.accent }}
                                thumbColor={'#fff'}
                                disabled={config.rooms.length === 0 && !isKidsModeActive}
                            />
                        </View>
                    </KidsSettingsSection>

                    <KidsSettingsSection title="ZIMMER" colors={colors}>
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
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + '10', justifyContent: 'center', alignItems: 'center' }}>
                                <Plus size={20} color={colors.accent} />
                            </View>
                            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>Zimmer hinzufügen</Text>
                        </Pressable>
                    </KidsSettingsSection>

                    <KidsSettingsSection title="ELTERN-EINSTELLUNGEN" colors={colors}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Parental PIN</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                                value={config.parentalPin}
                                onChangeText={(val) => updateConfig({ parentalPin: val })}
                                keyboardType="number-pad"
                                maxLength={4}
                                secureTextEntry
                            />
                        </View>
                    </KidsSettingsSection>

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

            {/* PIN Prompt Modal (cross-platform) */}
            <Modal visible={showPinPrompt} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: 300, gap: 16 }}>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Kindermodus beenden</Text>
                        <Text style={{ color: colors.subtext, fontSize: 14 }}>Bitte gib den PIN ein:</Text>
                        <TextInput
                            style={{ backgroundColor: colors.background, color: colors.text, borderRadius: 8, padding: 12, fontSize: 18, textAlign: 'center', borderWidth: 1, borderColor: colors.border }}
                            value={pinInput}
                            onChangeText={setPinInput}
                            keyboardType="number-pad"
                            secureTextEntry
                            maxLength={4}
                            autoFocus
                            placeholder="****"
                            placeholderTextColor={colors.subtext}
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Pressable
                                onPress={() => { setShowPinPrompt(false); setPinInput(''); }}
                                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center' }}
                            >
                                <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                            </Pressable>
                            <Pressable
                                onPress={handlePinSubmit}
                                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Bestätigen</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Room Prompt Modal (cross-platform) */}
            <Modal visible={showAddRoomPrompt} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: 320, gap: 16 }}>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Neues Zimmer</Text>
                        <Text style={{ color: colors.subtext, fontSize: 14 }}>Name des Zimmers:</Text>
                        <TextInput
                            style={{ backgroundColor: colors.background, color: colors.text, borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border }}
                            value={newRoomName}
                            onChangeText={setNewRoomName}
                            autoFocus
                            placeholder="z.B. Kinderzimmer Mia"
                            placeholderTextColor={colors.subtext}
                        />
                        <Text style={{ color: colors.subtext, fontSize: 14 }}>Design:</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {(['girl', 'boy', 'neutral'] as KidsGender[]).map((g) => {
                                const theme = KIDS_GENDER_THEMES[g];
                                const isSelected = newRoomGender === g;
                                return (
                                    <Pressable
                                        key={g}
                                        onPress={() => setNewRoomGender(g)}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 12,
                                            borderRadius: 10,
                                            alignItems: 'center',
                                            backgroundColor: isSelected ? theme.primary + '30' : colors.background,
                                            borderWidth: 2,
                                            borderColor: isSelected ? theme.primary : colors.border,
                                        }}
                                    >
                                        <Text style={{ fontSize: 24, marginBottom: 4 }}>{theme.emoji}</Text>
                                        <Text style={{ color: isSelected ? theme.primary : colors.subtext, fontSize: 12, fontWeight: '600' }}>{theme.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Pressable
                                onPress={() => setShowAddRoomPrompt(false)}
                                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center' }}
                            >
                                <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleAddRoomSubmit}
                                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Hinzufügen</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Room Selection Modal */}
            <Modal visible={showRoomSelection} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: 320, gap: 16 }}>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Zimmer auswählen</Text>
                        <Text style={{ color: colors.subtext, fontSize: 14 }}>Welches Kinderzimmer möchtest du aktivieren?</Text>
                        {config.rooms.map(room => (
                            <Pressable
                                key={room.id}
                                onPress={() => activateWithRoom(room.id)}
                                style={({ pressed }) => ({
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: 14,
                                    borderRadius: 10,
                                    backgroundColor: pressed ? colors.accent + '20' : colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                })}
                            >
                                <Baby size={22} color={colors.accent} />
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{room.name}</Text>
                            </Pressable>
                        ))}
                        <Pressable
                            onPress={() => setShowRoomSelection(false)}
                            style={{ padding: 12, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center' }}
                        >
                            <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
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

// Collapsible section – defined at module scope to preserve expand/collapse state across re-renders
const SettingsSection = ({ title, children, colors, defaultExpanded = false }: any) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    return (
        <View style={styles.section}>
            <Pressable
                onPress={() => setExpanded(!expanded)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
            >
                <Text style={[styles.sectionTitle, { color: colors.subtext, marginBottom: 0 }]}>{title}</Text>
                <ChevronRight
                    size={18}
                    color={colors.subtext}
                    style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
                />
            </Pressable>
            {expanded && (
                <View style={[styles.sectionContent, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
                    {children}
                </View>
            )}
        </View>
    );
};

const SettingsRow = ({ icon, label, value, onPress, showChevron, isLast, iconColor, colors }: any) => (
    <Pressable
        onPress={onPress}
        style={({ pressed }) => [
            styles.row,
            !isLast && styles.rowBorder,
            { backgroundColor: pressed ? colors.background : 'transparent' }
        ]}
    >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
            {icon}
        </View>
        <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
            {value && <Text style={[styles.rowValue, { color: colors.subtext }]}>{value}</Text>}
        </View>
        {showChevron && <ChevronRight size={20} color={colors.subtext} />}
    </Pressable>
);

// =====================================================
// MAIN SETTINGS COMPONENT
// =====================================================

export default function Settings() {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const { logout, user, userRole, effectiveRole, impersonatedRole, isBiometricsSupported, isBiometricsEnabled, toggleBiometrics, deleteAccount, avatarUrl, updateProfilePicture } = useAuth();
    const isEffectiveGuest = effectiveRole === 'guest';
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
        isConnecting,
        dashboardConfig,
        saveDashboardConfig
    } = useHomeAssistant();
    const { theme, setTheme, colors, autoTheme, setAutoTheme } = useTheme();
    const { isKidsModeActive: isKidsMode } = useKidsMode();
    const router = useRouter();

    const [haUrl, setHaUrl] = useState('');
    const [haToken, setHaToken] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [notificationModalVisible, setNotificationModalVisible] = useState(false);
    const [automationsModalVisible, setAutomationsModalVisible] = useState(false);
    const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
    const [isHAExpanded, setIsHAExpanded] = useState(false);
    const [familyModalVisible, setFamilyModalVisible] = useState(false);
    const [familyModalDismissing, setFamilyModalDismissing] = useState(false);
    const [kidsModalVisible, setKidsModalVisible] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [shoppingLocationsVisible, setShoppingLocationsVisible] = useState(false);
    const [widgetSettingsVisible, setWidgetSettingsVisible] = useState(false);
    const [isDesignExpanded, setIsDesignExpanded] = useState(false);
    const [quickActionsAdminVisible, setQuickActionsAdminVisible] = useState(false);
    const [dashboardConfigVisible, setDashboardConfigVisible] = useState(false);
    const [quickActionsUserVisible, setQuickActionsUserVisible] = useState(false);
    const [currentAppIcon, setCurrentAppIcon] = useState<string | null>(null);

    // Load current app icon on mount
    useEffect(() => {
        if (Platform.OS !== 'web') {
            try {
                const name = getAppIconName();
                setCurrentAppIcon(name);
            } catch (e) {
                console.warn('Could not get app icon name:', e);
            }
        }
    }, []);



    const handleChangeAppIcon = async (iconKey: string | null) => {
        try {
            await setAlternateAppIcon(iconKey);
            setCurrentAppIcon(iconKey);
        } catch (e: any) {
            if (e?.message?.includes('not supported')) {
                Alert.alert('Hinweis', 'App-Icons können nur im installierten Build geändert werden (nicht in Expo Go).');
            } else {
                Alert.alert('Fehler', 'Icon konnte nicht geändert werden: ' + e.message);
            }
        }
    };

    // Entity Configuration Settings
    const [weatherMainEntity, setWeatherMainEntity] = useState('weather.zell_lu');
    const [weatherForecastEntity, setWeatherForecastEntity] = useState('weather.familie_gross');
    const [weatherAlarmEntity, setWeatherAlarmEntity] = useState('weather.meteo');
    const [shoppingListEntity, setShoppingListEntity] = useState('todo.google_keep_einkaufsliste');
    const [doorFrontEntity, setDoorFrontEntity] = useState('');
    const [doorApartmentEntity, setDoorApartmentEntity] = useState('');
    const [doorApartmentSensorEntity, setDoorApartmentSensorEntity] = useState('');
    const [entityPickerVisible, setEntityPickerVisible] = useState(false);
    const [entityPickerTarget, setEntityPickerTarget] = useState<'main' | 'forecast' | 'alarm' | 'shopping' | 'door_front' | 'door_apartment' | 'door_apartment_sensor'>('main');
    const [entityPickerSearch, setEntityPickerSearch] = useState('');

    // Load entity settings
    useEffect(() => {
        (async () => {
            const main = await AsyncStorage.getItem('@weather_main_entity');
            const forecast = await AsyncStorage.getItem('@weather_forecast_entity');
            const alarm = await AsyncStorage.getItem('@weather_alarm_entity');
            const shopping = await AsyncStorage.getItem('@shopping_list_entity');
            if (main) setWeatherMainEntity(main);
            if (forecast) setWeatherForecastEntity(forecast);
            if (alarm) setWeatherAlarmEntity(alarm);
            if (shopping) setShoppingListEntity(shopping);
            const doorF = await AsyncStorage.getItem('@door_front_entity');
            const doorA = await AsyncStorage.getItem('@door_apartment_entity');
            const doorAS = await AsyncStorage.getItem('@door_apartment_sensor_entity');
            if (doorF) setDoorFrontEntity(doorF);
            if (doorA) setDoorApartmentEntity(doorA);
            if (doorAS) setDoorApartmentSensorEntity(doorAS);
        })();
    }, []);

    const saveEntityConfig = async (target: 'main' | 'forecast' | 'alarm' | 'shopping' | 'door_front' | 'door_apartment' | 'door_apartment_sensor', entityId: string) => {
        const mapping: Record<string, { setter: (v: string) => void, key: string }> = {
            main: { setter: setWeatherMainEntity, key: '@weather_main_entity' },
            forecast: { setter: setWeatherForecastEntity, key: '@weather_forecast_entity' },
            alarm: { setter: setWeatherAlarmEntity, key: '@weather_alarm_entity' },
            shopping: { setter: setShoppingListEntity, key: '@shopping_list_entity' },
            door_front: { setter: setDoorFrontEntity, key: '@door_front_entity' },
            door_apartment: { setter: setDoorApartmentEntity, key: '@door_apartment_entity' },
            door_apartment_sensor: { setter: setDoorApartmentSensorEntity, key: '@door_apartment_sensor_entity' },
        };
        mapping[target].setter(entityId);
        await AsyncStorage.setItem(mapping[target].key, entityId);
        setEntityPickerVisible(false);

        // Sync ALL entity configs to Supabase (shared across household)
        const allConfigs = {
            ...(dashboardConfig || {}),
            entityConfig: {
                ...(dashboardConfig?.entityConfig || {}),
                [target]: entityId,
            },
        };
        saveDashboardConfig(allConfigs);
    };

    const openEntityPicker = (target: 'main' | 'forecast' | 'alarm' | 'shopping' | 'door_front' | 'door_apartment' | 'door_apartment_sensor') => {
        setEntityPickerTarget(target);
        setEntityPickerSearch('');
        setEntityPickerVisible(true);
    };

    const entityPickerTitle: Record<string, string> = {
        main: 'Wetter (Aktuell)',
        forecast: 'Wetter (Vorhersage)',
        alarm: 'MeteoAlarm',
        shopping: 'Einkaufsliste',
        door_front: 'Haustüre (Entität)',
        door_apartment: 'Wohnungstüre (Entität)',
        door_apartment_sensor: 'Wohnungstüre Sensor (Tür offen/zu)',
    };

    const filteredPickerEntities = useMemo(() => {
        let filtered = entities;
        if (entityPickerTarget === 'shopping') {
            filtered = entities.filter(e => e.entity_id.startsWith('todo.') || e.entity_id.startsWith('sensor.'));
        } else if (entityPickerTarget === 'door_apartment_sensor') {
            filtered = entities.filter(e =>
                e.entity_id.startsWith('binary_sensor.')
            );
        } else if (entityPickerTarget === 'door_front' || entityPickerTarget === 'door_apartment') {
            filtered = entities.filter(e =>
                e.entity_id.startsWith('lock.') ||
                e.entity_id.startsWith('button.') ||
                e.entity_id.startsWith('switch.') ||
                e.entity_id.startsWith('script.')
            );
        } else {
            filtered = entities.filter(e =>
                e.entity_id.startsWith('weather.') ||
                (e.entity_id.startsWith('sensor.') && e.attributes.device_class === 'temperature') ||
                e.entity_id.includes('meteo') ||
                e.entity_id.startsWith('binary_sensor.')
            );
        }
        if (entityPickerSearch) {
            filtered = filtered.filter(e =>
                e.entity_id.toLowerCase().includes(entityPickerSearch.toLowerCase()) ||
                (e.attributes.friendly_name || '').toLowerCase().includes(entityPickerSearch.toLowerCase())
            );
        }
        return filtered;
    }, [entities, entityPickerSearch, entityPickerTarget]);

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Berechtigung', 'Wir benötigen Zugriff auf deine Fotos, um das Profilbild zu ändern.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled) {
                setIsUploading(true);
                try {
                    await updateProfilePicture(result.assets[0].uri);
                    Alert.alert('Erfolg', 'Profilbild wurde aktualisiert!');
                } catch (e: any) {
                    Alert.alert('Fehler', 'Upload fehlgeschlagen: ' + e.message);
                } finally {
                    setIsUploading(false);
                }
            }
        } catch (e) {
            console.error('Picker Error:', e);
            setIsUploading(false);
        }
    };



    // SettingsSection & SettingsRow are now defined at module scope (above) to prevent auto-collapse

    const ThemeCard = ({ itemTheme }: { itemTheme: ThemeType }) => {
        const isActive = theme === itemTheme;
        const itemColors = THEMES[itemTheme];

        return (
            <Pressable
                onPress={() => setTheme(itemTheme)}
                style={{
                    marginRight: 12,
                    width: 100,
                    height: 140,
                    borderRadius: 16,
                    backgroundColor: itemColors.card,
                    borderWidth: isActive ? 2 : 1,
                    borderColor: isActive ? colors.accent : itemColors.border,
                    overflow: 'hidden',
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4.65,
                    elevation: 8,
                }}
            >
                {/* Preview Header */}
                <View style={{ height: 60, backgroundColor: itemColors.background, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 40, height: 8, borderRadius: 4, backgroundColor: itemColors.card, marginBottom: 6 }} />
                    <View style={{ width: 60, height: 8, borderRadius: 4, backgroundColor: itemColors.card, opacity: 0.5 }} />
                </View>

                {/* Content */}
                <View style={{ padding: 10, justifyContent: 'space-between', flex: 1 }}>
                    <View>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: itemColors.accent, marginBottom: 6 }} />
                        <Text style={{ color: itemColors.text, fontSize: 13, fontWeight: '700' }}>{THEME_DISPLAY_NAMES[itemTheme]}</Text>
                    </View>

                    {isActive && (
                        <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: colors.accent, borderRadius: 10, padding: 2 }}>
                            <CheckCircle size={14} color="#FFF" />
                        </View>
                    )}
                </View>
            </Pressable>
        );
    };

    // --- Handlers ---
    const handleSaveAndConnect = async () => {
        setIsSaving(true);
        try {
            await connect({ url: haUrl, token: haToken });
            Alert.alert('Erfolg', 'Verbindung erfolgreich hergestellt!');
            setIsHAExpanded(false);
        } catch (e: any) {
            Alert.alert('Fehler', 'Verbindung fehlgeschlagen: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Abmelden',
            'Möchtest du dich wirklich abmelden?',
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Abmelden',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // First try to clear tokens or local state if needed
                            await logout();
                            // Router redirect handled by layout effect
                        } catch (e) {
                            console.error('Logout error', e);
                            Alert.alert('Fehler', 'Abmelden fehlgeschlagen.');
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Konto löschen',
            'Möchtest du dein Konto wirklich unwiderruflich löschen? Alle Daten werden entfernt.',
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Löschen',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteAccount(true); // true to delete household too if last admin
                        } catch (e: any) {
                            Alert.alert('Fehler', 'Löschen fehlgeschlagen: ' + e.message);
                        }
                    }
                }
            ]
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
                                <Pressable onPress={pickImage} style={[styles.avatar, { backgroundColor: colors.background, position: 'relative', overflow: 'hidden' }]}>
                                    {isUploading ? (
                                        <ActivityIndicator color={colors.accent} />
                                    ) : avatarUrl ? (
                                        <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <User size={32} color={colors.accent} />
                                    )}

                                    <View style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 20,
                                        backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Camera size={10} color="#fff" />
                                    </View>
                                </Pressable>
                                <View style={styles.profileInfo}>
                                    <Text style={[styles.profileLabel, { color: colors.subtext }]}>Angemeldet als</Text>
                                    <Text style={[styles.profileEmail, { color: colors.text }]}>{user?.email}</Text>
                                    {/* <Pressable 
                                        hitSlop={10} 
                                        onPress={pickImage}
                                        style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>Bild ändern</Text>
                                    </Pressable> */}
                                </View>
                            </View>
                        </View>

                        {/* Automationen – admin only */}
                        {effectiveRole === 'admin' && (
                            <View style={styles.section}>
                                <Pressable
                                    onPress={() => setAutomationsModalVisible(true)}
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
                                            <Zap size={20} color={colors.accent} />
                                        </View>
                                        <Text style={[styles.rowLabel, { color: colors.text }]}>Automationen</Text>
                                    </View>
                                    <ChevronRight size={20} color={colors.subtext} />
                                </Pressable>
                            </View>
                        )}

                        {/* Benachrichtigungen – hidden for guests */}
                        {!isEffectiveGuest && (
                            <View style={styles.section}>
                                <Pressable
                                    onPress={() => setNotificationModalVisible(true)}
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
                                        <View style={[styles.iconContainer, { backgroundColor: (notificationSettings.enabled ? colors.accent : colors.subtext) + '20' }]}>
                                            <Bell size={20} color={notificationSettings.enabled ? colors.accent : colors.subtext} />
                                        </View>
                                        <View>
                                            <Text style={[styles.rowLabel, { color: colors.text }]}>Benachrichtigungen</Text>
                                            <Text style={[styles.rowValue, { color: notificationSettings.enabled ? colors.success : colors.subtext, marginTop: 2 }]}>
                                                {notificationSettings.enabled ? 'Aktiv' : 'Inaktiv'}
                                            </Text>
                                        </View>
                                    </View>
                                    <ChevronRight size={20} color={colors.subtext} />
                                </Pressable>
                            </View>
                        )}

                        {/* Kindermodus – admin only */}
                        {effectiveRole === 'admin' && (
                            <View style={styles.section}>
                                <Pressable
                                    onPress={() => setKidsModalVisible(true)}
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
                                            <Baby size={20} color={colors.accent} />
                                        </View>
                                        <Text style={[styles.rowLabel, { color: colors.text }]}>Kindermodus</Text>
                                    </View>
                                    <ChevronRight size={20} color={colors.subtext} />
                                </Pressable>
                            </View>
                        )}

                        {/* THEME SELECTION */}
                        <View style={styles.section}>
                            <Pressable
                                onPress={() => setIsDesignExpanded(!isDesignExpanded)}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
                            >
                                <Text style={[styles.sectionTitle, { color: colors.subtext, marginBottom: 0 }]}>DESIGN</Text>
                                <ChevronRight
                                    size={18}
                                    color={colors.subtext}
                                    style={{ transform: [{ rotate: isDesignExpanded ? '90deg' : '0deg' }] }}
                                />
                            </Pressable>
                            {isDesignExpanded && (<>
                                <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 }}>DARK THEMES</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, paddingHorizontal: 4, paddingBottom: 8 }}>
                                    {DARK_THEMES.map((t) => (
                                        <ThemeCard key={t} itemTheme={t} />
                                    ))}
                                </ScrollView>
                                <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 8, letterSpacing: 0.5 }}>LIGHT THEMES</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, paddingHorizontal: 4, paddingBottom: 8 }}>
                                    {LIGHT_THEMES.map((t) => (
                                        <ThemeCard key={t} itemTheme={t} />
                                    ))}
                                </ScrollView>

                                {/* Auto Theme Toggle */}
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                    backgroundColor: colors.card, borderRadius: 16, padding: 16, marginTop: 16,
                                    borderWidth: 1, borderColor: colors.border,
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: autoTheme.enabled ? '#F59E0B' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                                            {autoTheme.enabled ? <Sun size={20} color="#FFF" /> : <Moon size={20} color={colors.subtext} />}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Automatischer Wechsel</Text>
                                            <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>Theme nach Sonnenauf-/untergang</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={autoTheme.enabled}
                                        onValueChange={(val) => setAutoTheme({ ...autoTheme, enabled: val })}
                                        trackColor={{ false: colors.border, true: '#F59E0B' }}
                                        thumbColor="#FFF"
                                    />
                                </View>

                                {/* Day/Night Theme Pickers */}
                                {autoTheme.enabled && (
                                    <View style={{ marginTop: 12, gap: 12 }}>
                                        {/* Day Theme */}
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                <Sun size={14} color="#F59E0B" />
                                                <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: '600' }}>Tagsüber (nach Sonnenaufgang)</Text>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, paddingHorizontal: 4 }}>
                                                {([...DARK_THEMES, ...LIGHT_THEMES]).map((t) => {
                                                    const isActive = autoTheme.dayTheme === t;
                                                    const tc = THEMES[t];
                                                    return (
                                                        <Pressable key={t} onPress={() => setAutoTheme({ ...autoTheme, dayTheme: t })} style={{
                                                            marginRight: 8, width: 72, height: 100, borderRadius: 12,
                                                            backgroundColor: tc.card, borderWidth: isActive ? 2 : 1,
                                                            borderColor: isActive ? '#F59E0B' : tc.border, overflow: 'hidden',
                                                        }}>
                                                            <View style={{ flex: 1, backgroundColor: tc.background, alignItems: 'center', justifyContent: 'center' }}>
                                                                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: tc.accent }} />
                                                            </View>
                                                            <View style={{ padding: 6, backgroundColor: tc.card }}>
                                                                <Text style={{ color: tc.text, fontSize: 9, fontWeight: '600', textAlign: 'center' }}>{THEME_DISPLAY_NAMES[t]}</Text>
                                                            </View>
                                                            {isActive && <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#F59E0B', borderRadius: 8, padding: 1 }}><CheckCircle size={10} color="#FFF" /></View>}
                                                        </Pressable>
                                                    );
                                                })}
                                            </ScrollView>
                                        </View>

                                        {/* Night Theme */}
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                <Moon size={14} color="#818CF8" />
                                                <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: '600' }}>Nachts (nach Sonnenuntergang)</Text>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, paddingHorizontal: 4 }}>
                                                {([...DARK_THEMES, ...LIGHT_THEMES]).map((t) => {
                                                    const isActive = autoTheme.nightTheme === t;
                                                    const tc = THEMES[t];
                                                    return (
                                                        <Pressable key={t} onPress={() => setAutoTheme({ ...autoTheme, nightTheme: t })} style={{
                                                            marginRight: 8, width: 72, height: 100, borderRadius: 12,
                                                            backgroundColor: tc.card, borderWidth: isActive ? 2 : 1,
                                                            borderColor: isActive ? '#818CF8' : tc.border, overflow: 'hidden',
                                                        }}>
                                                            <View style={{ flex: 1, backgroundColor: tc.background, alignItems: 'center', justifyContent: 'center' }}>
                                                                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: tc.accent }} />
                                                            </View>
                                                            <View style={{ padding: 6, backgroundColor: tc.card }}>
                                                                <Text style={{ color: tc.text, fontSize: 9, fontWeight: '600', textAlign: 'center' }}>{THEME_DISPLAY_NAMES[t]}</Text>
                                                            </View>
                                                            {isActive && <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#818CF8', borderRadius: 8, padding: 1 }}><CheckCircle size={10} color="#FFF" /></View>}
                                                        </Pressable>
                                                    );
                                                })}
                                            </ScrollView>
                                        </View>
                                    </View>
                                )}

                                {/* App Icon Selector */}
                                {Platform.OS !== 'web' && (
                                    <View style={{ marginTop: 20 }}>
                                        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>APP ICON</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, paddingHorizontal: 4 }}>
                                            {APP_ICON_VARIANTS.map((variant) => {
                                                const isActive = currentAppIcon === variant.key;
                                                return (
                                                    <Pressable
                                                        key={variant.key ?? 'default'}
                                                        onPress={() => handleChangeAppIcon(variant.key)}
                                                        style={{
                                                            marginRight: 12,
                                                            alignItems: 'center',
                                                            gap: 6,
                                                        }}
                                                    >
                                                        <View style={{
                                                            width: 64,
                                                            height: 64,
                                                            borderRadius: 16,
                                                            overflow: 'hidden',
                                                            borderWidth: isActive ? 3 : 1,
                                                            borderColor: isActive ? colors.accent : colors.border,
                                                            shadowColor: isActive ? colors.accent : '#000',
                                                            shadowOffset: { width: 0, height: 2 },
                                                            shadowOpacity: isActive ? 0.4 : 0.1,
                                                            shadowRadius: 4,
                                                            elevation: isActive ? 6 : 2,
                                                        }}>
                                                            <Image
                                                                source={variant.preview}
                                                                style={{ width: '100%', height: '100%' }}
                                                            />
                                                        </View>
                                                        <Text style={{
                                                            color: isActive ? colors.accent : colors.subtext,
                                                            fontSize: 11,
                                                            fontWeight: isActive ? '700' : '500',
                                                        }}>{variant.label}</Text>
                                                        {isActive && (
                                                            <View style={{
                                                                position: 'absolute',
                                                                top: -2,
                                                                right: -2,
                                                                backgroundColor: colors.accent,
                                                                borderRadius: 10,
                                                                padding: 2,
                                                            }}>
                                                                <CheckCircle size={12} color="#FFF" />
                                                            </View>
                                                        )}
                                                    </Pressable>
                                                );
                                            })}
                                        </ScrollView>
                                        <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                                            Änderungen werden erst im nächsten Build sichtbar.
                                        </Text>
                                    </View>
                                )}
                            </>)}
                        </View>



                        {effectiveRole === 'admin' && (
                            <SettingsSection title="Dashboard" colors={colors}>
                                <SettingsRow
                                    icon={<SettingsIcon size={20} color={colors.accent} />}
                                    iconColor={colors.accent}
                                    label="Dashboard anpassen"
                                    value="Lichter, Rollläden, Saugroboter, Alarm"
                                    showChevron
                                    isLast
                                    onPress={() => setDashboardConfigVisible(true)}
                                    colors={colors}
                                />
                            </SettingsSection>
                        )}

                        {!isEffectiveGuest && (
                            <SettingsSection title="Schnellaktionen" colors={colors}>
                                {effectiveRole === 'admin' && (
                                    <SettingsRow
                                        icon={<Zap size={20} color="#F59E0B" />}
                                        iconColor="#F59E0B"
                                        label="Standard-Aktionen (Admin)"
                                        value="Für alle Nutzer"
                                        showChevron
                                        onPress={() => setQuickActionsAdminVisible(true)}
                                        colors={colors}
                                    />
                                )}
                                <SettingsRow
                                    icon={<Zap size={20} color={colors.accent} />}
                                    iconColor={colors.accent}
                                    label="Meine Schnellaktionen"
                                    value="Personalisieren"
                                    showChevron
                                    onPress={() => setQuickActionsUserVisible(true)}
                                    isLast
                                    colors={colors}
                                />
                            </SettingsSection>
                        )}



                        {/* Weitere App-Einstellungen – hidden for guests */}
                        {!isEffectiveGuest && (
                            <SettingsSection title="Weiteres" colors={colors}>
                                <SettingsRow
                                    icon={<LayoutGrid size={20} color={colors.accent} />}
                                    iconColor={colors.accent}
                                    label="Widgets"
                                    showChevron
                                    onPress={() => setWidgetSettingsVisible(true)}
                                    colors={colors}
                                />
                                {effectiveRole === 'admin' && (
                                    <SettingsRow
                                        icon={<Users size={20} color={colors.accent} />}
                                        iconColor={colors.accent}
                                        label="Familienmitglieder"
                                        value="Verwalten & Einladen"
                                        showChevron
                                        onPress={() => setFamilyModalVisible(true)}
                                        isLast
                                        colors={colors}
                                    />
                                )}
                            </SettingsSection>
                        )}

                        {/* Entity Configuration - Admin Only */}
                        {effectiveRole === 'admin' && (
                            <SettingsSection title="Entitäten (Admin)" colors={colors}>
                                <SettingsRow
                                    icon={<Sun size={20} color="#F59E0B" />}
                                    iconColor="#F59E0B"
                                    label="Wetter (Aktuell)"
                                    value={weatherMainEntity}
                                    showChevron
                                    onPress={() => openEntityPicker('main')}
                                    colors={colors}
                                />
                                <SettingsRow
                                    icon={<CloudRain size={20} color="#3B82F6" />}
                                    iconColor="#3B82F6"
                                    label="Wetter (Vorhersage)"
                                    value={weatherForecastEntity}
                                    showChevron
                                    onPress={() => openEntityPicker('forecast')}
                                    colors={colors}
                                />
                                <SettingsRow
                                    icon={<Cloud size={20} color="#EF4444" />}
                                    iconColor="#EF4444"
                                    label="MeteoAlarm"
                                    value={weatherAlarmEntity}
                                    showChevron
                                    onPress={() => openEntityPicker('alarm')}
                                    colors={colors}
                                />
                                <SettingsRow
                                    icon={<ShoppingCart size={20} color="#10B981" />}
                                    iconColor="#10B981"
                                    label="Einkaufsliste"
                                    value={shoppingListEntity}
                                    showChevron
                                    onPress={() => openEntityPicker('shopping')}
                                    colors={colors}
                                />
                                <SettingsRow
                                    icon={<Key size={20} color="#F59E0B" />}
                                    iconColor="#F59E0B"
                                    label="Haustüre"
                                    value={doorFrontEntity || 'Nicht konfiguriert'}
                                    showChevron
                                    onPress={() => openEntityPicker('door_front')}
                                    colors={colors}
                                />
                                <SettingsRow
                                    icon={<Key size={20} color="#8B5CF6" />}
                                    iconColor="#8B5CF6"
                                    label="Wohnungstüre"
                                    value={doorApartmentEntity || 'Nicht konfiguriert'}
                                    showChevron
                                    onPress={() => openEntityPicker('door_apartment')}
                                    colors={colors}
                                />
                                <SettingsRow
                                    icon={<DoorOpen size={20} color="#F97316" />}
                                    iconColor="#F97316"
                                    label="Wohnungstüre Sensor"
                                    value={doorApartmentSensorEntity || 'Nicht konfiguriert'}
                                    showChevron
                                    onPress={() => openEntityPicker('door_apartment_sensor')}
                                    isLast
                                    colors={colors}
                                />
                            </SettingsSection>
                        )}


                        <WidgetSettings
                            visible={widgetSettingsVisible}
                            onClose={() => setWidgetSettingsVisible(false)}
                        />

                        {!isEffectiveGuest && (<>
                            <SettingsSection title="Standort" colors={colors}>
                                <SettingsRow
                                    icon={<MapPin size={20} color={isGeofencingActive ? colors.success : colors.subtext} />}
                                    iconColor={isGeofencingActive ? colors.success : colors.subtext}
                                    label="Standort als Zuhause setzen"
                                    value={isGeofencingActive ? 'Aktiv' : 'Inaktiv'}
                                    onPress={setHomeLocation}
                                    colors={colors}
                                />
                                <SettingsRow
                                    icon={<Store size={20} color={colors.accent} />}
                                    iconColor={colors.accent}
                                    label="Einkaufsstandorte"
                                    value="Verwalten"
                                    showChevron
                                    onPress={() => setShoppingLocationsVisible(true)}
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
                        </>)}



                        {/* HOME ASSISTANT - Admin only */}
                        {effectiveRole === 'admin' && (
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
                        )}

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
                            HomePilot Pro v1.4.0 • Theme: {theme}
                        </Text>
                    </ScrollView>
                </KeyboardAvoidingView>
                <NotificationSettingsModal
                    visible={notificationModalVisible}
                    onClose={() => setNotificationModalVisible(false)}
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
                <AutomationsModal
                    visible={automationsModalVisible}
                    onClose={() => setAutomationsModalVisible(false)}
                />
                <ShoppingLocationsModal
                    visible={shoppingLocationsVisible}
                    onClose={() => setShoppingLocationsVisible(false)}
                />
                {/* Family Management Modal */}
                <Modal visible={familyModalVisible} animationType={familyModalDismissing ? 'none' : 'slide'} presentationStyle={familyModalDismissing ? 'overFullScreen' : 'pageSheet'} onRequestClose={() => setFamilyModalVisible(false)}>
                    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Familienmitglieder</Text>
                            <Pressable onPress={() => setFamilyModalVisible(false)} style={{ padding: 8 }}>
                                <X size={24} color={colors.subtext} />
                            </Pressable>
                        </View>
                        <ScrollView style={{ flex: 1, padding: 16 }}>
                            <FamilyManagement colors={colors} onClose={() => {
                                setFamilyModalDismissing(true);
                                setTimeout(() => {
                                    setFamilyModalVisible(false);
                                    setFamilyModalDismissing(false);
                                }, 50);
                            }} />
                        </ScrollView>
                    </SafeAreaView>
                </Modal>
                {/* Entity Picker Modal */}
                <Modal visible={entityPickerVisible} transparent animationType="slide">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 40 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                                    {entityPickerTitle[entityPickerTarget]}
                                </Text>
                                <Pressable onPress={() => setEntityPickerVisible(false)} style={{ padding: 4 }}>
                                    <X size={24} color={colors.subtext} />
                                </Pressable>
                            </View>
                            <View style={{ padding: 12 }}>
                                <TextInput
                                    style={{ backgroundColor: colors.background, color: colors.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border, fontSize: 15 }}
                                    placeholder="Entität suchen..."
                                    placeholderTextColor={colors.subtext}
                                    value={entityPickerSearch}
                                    onChangeText={setEntityPickerSearch}
                                    autoCapitalize="none"
                                />
                            </View>
                            <ScrollView style={{ paddingHorizontal: 12 }}>
                                {filteredPickerEntities.map(entity => {
                                    const currentValue = entityPickerTarget === 'shopping'
                                        ? shoppingListEntity
                                        : entityPickerTarget === 'main' ? weatherMainEntity
                                            : entityPickerTarget === 'forecast' ? weatherForecastEntity
                                                : entityPickerTarget === 'door_front' ? doorFrontEntity
                                                    : entityPickerTarget === 'door_apartment' ? doorApartmentEntity
                                                        : weatherAlarmEntity;
                                    const isSelected = entity.entity_id === currentValue;
                                    return (
                                        <Pressable
                                            key={entity.entity_id}
                                            onPress={() => saveEntityConfig(entityPickerTarget, entity.entity_id)}
                                            style={({ pressed }) => ({
                                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                                padding: 14, borderRadius: 10, marginBottom: 4,
                                                backgroundColor: isSelected ? colors.accent + '20' : pressed ? colors.background : 'transparent',
                                                borderWidth: isSelected ? 1 : 0, borderColor: colors.accent,
                                            })}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: isSelected ? '700' : '500' }} numberOfLines={1}>
                                                    {entity.attributes.friendly_name || entity.entity_id}
                                                </Text>
                                                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                                                    {entity.entity_id}
                                                </Text>
                                            </View>
                                            {isSelected && <CheckCircle size={20} color={colors.accent} />}
                                        </Pressable>
                                    );
                                })}
                                {filteredPickerEntities.length === 0 && (
                                    <Text style={{ color: colors.subtext, textAlign: 'center', padding: 20 }}>Keine Entitäten gefunden</Text>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                <QuickActionsConfigModal
                    visible={quickActionsAdminVisible}
                    onClose={() => setQuickActionsAdminVisible(false)}
                    isAdmin={true}
                />
                <QuickActionsConfigModal
                    visible={quickActionsUserVisible}
                    onClose={() => setQuickActionsUserVisible(false)}
                    isAdmin={false}
                />
                <DashboardConfigModal
                    visible={dashboardConfigVisible}
                    onClose={() => setDashboardConfigVisible(false)}
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
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    settingLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
    settingDescription: { color: '#94A3B8', fontSize: 13, paddingRight: 16 },
    iconBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', alignItems: 'center', justifyContent: 'center' },
    infoBox: { padding: 16, backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, marginBottom: 40 },
    infoText: { color: '#60A5FA', fontSize: 13, textAlign: 'center' }
});

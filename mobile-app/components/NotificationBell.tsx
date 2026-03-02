import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable, Modal, FlatList, ScrollView, StyleSheet, Alert, AppState } from 'react-native';
import {
    Bell, Check, CheckCheck, X, Trash2,
    Shield, Baby, Calendar, CloudLightning, Eye, Zap, House, Thermometer, Droplets,
    DoorOpen, DoorClosed, BellRing, Sun, Moon, ShoppingCart,
    BatteryMedium, Lock, Camera, Wind, Fan, Waves, Disc3,
} from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { supabase } from '../lib/supabase';

// Icon lookup map – must match the names used in NotificationTypesManager
const ICON_MAP: Record<string, any> = {
    'bell': Bell, 'bell-ring': BellRing, 'shield': Shield, 'lock': Lock,
    'door-open': DoorOpen, 'door-closed': DoorClosed, 'camera': Camera,
    'baby': Baby, 'calendar': Calendar, 'cloud-lightning': CloudLightning,
    'sun': Sun, 'moon': Moon, 'wind': Wind, 'eye': Eye, 'zap': Zap,
    'home': House, 'thermometer': Thermometer, 'droplets': Droplets,
    'waves': Waves, 'fan': Fan, 'shopping-cart': ShoppingCart, 'battery': BatteryMedium,
    'bot': Disc3,
};
const getIconComponent = (iconName: string) => ICON_MAP[iconName] || Bell;

const USER_NOTIF_PREFS_CACHE_KEY = '@smarthome_user_notif_prefs';

// ── Category Color Map (matched by notification title) ────────
const CATEGORY_RULES = [
    { key: 'security', label: 'Sicherheit', color: '#EF4444', keywords: ['security center', 'alarm', 'sicherheit'] },
    { key: 'household', label: 'Haushalt', color: '#3B82F6', keywords: ['haushalt', 'haustür', 'wohnungstür'] },
    { key: 'battery', label: 'Akku', color: '#F59E0B', keywords: ['akkustand', 'batterie', 'akku'] },
    { key: 'birthday', label: 'Geburtstag', color: '#EC4899', keywords: ['geburtstag', '🎉'] },
    { key: 'doorbell', label: 'Türklingel', color: '#6366F1', keywords: ['geklingelt', 'klingel', 'doorbell'] },
    { key: 'weather', label: 'Wetter', color: '#EF4444', keywords: ['wetter', 'meteo', 'warnung'] },
];

function getCatColor(title: string): string {
    const t = (title || '').toLowerCase();
    const cat = CATEGORY_RULES.find(c => c.keywords.some(kw => t.includes(kw)));
    return cat?.color || '#6B7280';
}

function getCatKey(title: string): string | null {
    const t = (title || '').toLowerCase();
    const cat = CATEGORY_RULES.find(c => c.keywords.some(kw => t.includes(kw)));
    return cat?.key || null;
}

const NOTIFICATION_HISTORY_KEY = '@smarthome_notification_history';

// expo-notifications returns date in seconds on iOS, milliseconds on Android
function toJsDate(epochDate: number): Date {
    // If the value looks like seconds (< 1e12), convert to ms
    return new Date(epochDate < 1e12 ? epochDate * 1000 : epochDate);
}

export interface StoredNotification {
    id: string;
    title: string;
    body: string;
    timestamp: number;
    isRead: boolean;
    categoryKey?: string; // from push data or keyword matching
}

interface NotificationBellProps {
    onAppOpen?: () => void; // Called when app opens to reset badge
}

export default function NotificationBell({ onAppOpen }: NotificationBellProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { notificationSettings } = useHomeAssistant();
    const [notifications, setNotifications] = useState<StoredNotification[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    // Dynamic notification preferences from Supabase
    // Maps category_key -> enabled (true/false)
    const [dynamicPrefs, setDynamicPrefs] = useState<Record<string, boolean>>({});
    const dynamicPrefsRef = React.useRef<Record<string, boolean>>({});
    dynamicPrefsRef.current = dynamicPrefs;

    // Notification types from Supabase (for icon/color display)
    const [notifTypes, setNotifTypes] = useState<Record<string, { icon: string; color: string }>>({});

    // Which filter chips to show (only categories present in data)
    const presentCategories = useMemo(() => {
        const found = new Set<string>();
        for (const n of notifications) {
            const k = getCatKey(n.title);
            if (k) found.add(k);
        }
        return CATEGORY_RULES.filter(c => found.has(c.key));
    }, [notifications]);

    // Filtered list
    const displayedNotifications = useMemo(() => {
        if (!activeFilter) return notifications;
        return notifications.filter(n => getCatKey(n.title) === activeFilter);
    }, [notifications, activeFilter]);

    // Load notifications from Supabase
    const loadNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            if (data) {
                const formatted = data.map(n => ({
                    id: n.id,
                    title: n.title,
                    body: n.body,
                    timestamp: new Date(n.created_at).getTime(),
                    isRead: n.is_read,
                    categoryKey: (n as any).category_key || getCatKey(n.title) || undefined,
                }));
                setNotifications(formatted);
                // Update badge
                const unreadCount = formatted.filter(n => !n.isRead).length;
                Notifications.setBadgeCountAsync(unreadCount);
            }
        } catch (e) {
            console.warn('Failed to load notifications:', e);
        }
    }, [user]);

    // In-memory lock to prevent concurrent inserts for the same notification
    const pendingInserts = React.useRef(new Set<string>());

    // Add new notification to Supabase (state update comes via Realtime subscription)
    const addNotification = useCallback(async (title: string, body: string, deliveredAt?: Date) => {
        if (!user) return;

        // Create a dedup key for in-memory lock (prevents async race condition)
        const dedupKey = `${title}|||${body}`;
        if (pendingInserts.current.has(dedupKey)) {
            return; // Another insert for the same notification is already in progress
        }
        pendingInserts.current.add(dedupKey);

        try {
            // Dedup: check Supabase for recent notification with same title+body (last 5 min)
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', user.id)
                .eq('title', title)
                .eq('body', body)
                .gte('created_at', fiveMinAgo)
                .limit(1);

            if (existing && existing.length > 0) {
                return;
            }

            const insertPayload: any = {
                user_id: user.id,
                title,
                body,
                is_read: false,
            };
            if (deliveredAt) {
                insertPayload.created_at = deliveredAt.toISOString();
            }

            const { error } = await supabase
                .from('notifications')
                .insert(insertPayload);

            if (error) throw error;
            // State will be updated by the Realtime INSERT listener
        } catch (e) {
            console.warn('Failed to add notification:', e);
        } finally {
            // Release lock after a short delay to handle near-simultaneous calls
            setTimeout(() => pendingInserts.current.delete(dedupKey), 3000);
        }
    }, [user]);

    // Mark single notification as read
    const markAsRead = useCallback(async (id: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );

            // Format badge again
            const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
            Notifications.setBadgeCountAsync(updated.filter(n => !n.isRead).length);

        } catch (e) {
            console.warn('Failed to mark read:', e);
        }
    }, [user, notifications]);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false); // optimization

            if (error) throw error;

            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            Notifications.setBadgeCountAsync(0);
        } catch (e) {
            console.warn('Failed to mark all read:', e);
        }
    }, [user]);

    // Clear all notifications
    const clearAll = useCallback(async () => {
        if (!user) return;
        Alert.alert(
            'Alle löschen?',
            'Möchtest du alle Benachrichtigungen löschen?',
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Löschen',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('notifications')
                                .delete()
                                .eq('user_id', user.id);

                            if (error) throw error;

                            setNotifications([]);
                            Notifications.setBadgeCountAsync(0);
                            // Also dismiss from iOS notification center to prevent re-insertion
                            await Notifications.dismissAllNotificationsAsync();
                        } catch (e) {
                            console.warn('Failed to delete all:', e);
                        }
                    }
                }
            ]
        );
    }, [user]);

    // Load dynamic notification preferences from Supabase + cache in AsyncStorage
    const loadDynamicPrefs = useCallback(async () => {
        if (!user) return;
        try {
            // 1. Fetch active notification types (to get category_key -> id mapping)
            const { data: types } = await supabase
                .from('notification_types')
                .select('id, category_key, is_active, icon, color')
                .eq('is_active', true);

            // 2. Fetch user preferences
            const { data: prefs } = await supabase
                .from('user_notification_preferences')
                .select('notification_type_id, enabled')
                .eq('user_id', user.id);

            if (types && prefs) {
                // Build a map: category_key -> enabled
                const prefById: Record<string, boolean> = {};
                for (const p of prefs) {
                    prefById[p.notification_type_id] = p.enabled;
                }

                const categoryPrefs: Record<string, boolean> = {};
                const typeDisplay: Record<string, { icon: string; color: string }> = {};
                for (const t of types) {
                    // If user has a preference, use it; otherwise default to enabled
                    categoryPrefs[t.category_key] = prefById[t.id] ?? true;
                    typeDisplay[t.category_key] = { icon: t.icon || 'bell', color: t.color || '#3B82F6' };
                }

                // console.log('🔔 Dynamic prefs loaded:', JSON.stringify(categoryPrefs));
                setDynamicPrefs(categoryPrefs);
                setNotifTypes(typeDisplay);
                // Cache for use in notification handler (HomeAssistantContext)
                await AsyncStorage.setItem(USER_NOTIF_PREFS_CACHE_KEY, JSON.stringify(categoryPrefs));
            }
        } catch (e) {
            console.warn('Failed to load dynamic notification prefs:', e);
        }
    }, [user]);

    // Load on mount & Auth Change
    useEffect(() => {
        if (user) {
            loadNotifications();
            loadDynamicPrefs();
        }
    }, [user, loadNotifications, loadDynamicPrefs]);

    // Sub to Realtime
    useEffect(() => {
        if (!user) return;

        const sub = supabase
            .channel('public:notifications:' + user.id)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const split = payload.new;
                    // Dedup: skip if already in state
                    setNotifications(prev => {
                        if (prev.some(n => n.id === split.id)) return prev;
                        const newNotif = {
                            id: split.id,
                            title: split.title,
                            body: split.body,
                            timestamp: new Date(split.created_at).getTime(),
                            isRead: split.is_read,
                            categoryKey: (split as any).category_key || getCatKey(split.title) || undefined,
                        };
                        const updated = [newNotif, ...prev];
                        Notifications.setBadgeCountAsync(updated.filter(n => !n.isRead).length);
                        return updated;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [user]);

    // Keep existing badge reset on modal open
    useEffect(() => {
        if (showModal) {
            // Optional: Mark all viewed as read? Or just reset badge?
            // Usually opening the center resets the badge count even if not all read.
            Notifications.setBadgeCountAsync(0);
        }
    }, [showModal]);

    // Save delivered push notifications to Supabase (from ALL sources)
    // Uses a ref to avoid stale closure and dependency cycle issues
    const addNotificationRef = React.useRef(addNotification);
    addNotificationRef.current = addNotification;

    // Track already-processed notification IDs to avoid duplicates
    const processedIds = React.useRef(new Set<string>());

    // Check if a notification's category is enabled in settings
    const isCategoryEnabled = useCallback((title: string, pushCategoryKey?: string): boolean => {
        // Master switch
        if (!notificationSettings.enabled) return false;

        // 1. Check dynamic preferences first (from Supabase)
        //    Push notifications from HA carry data.category_key
        const effectiveCatKey = pushCategoryKey || getCatKey(title);

        if (effectiveCatKey && dynamicPrefsRef.current[effectiveCatKey] !== undefined) {
            // We have a dynamic preference for this category → use it
            return dynamicPrefsRef.current[effectiveCatKey];
        }

        // 2. Fallback to static settings for legacy categories
        if (!effectiveCatKey) return true; // Unknown categories are always allowed

        switch (effectiveCatKey) {
            case 'security': return notificationSettings.security?.doors_ug !== false;
            case 'doorbell': return notificationSettings.home?.doorbell !== false;
            case 'weather': return notificationSettings.weather?.warning !== false;
            case 'birthday': return notificationSettings.calendar?.birthday !== false;
            case 'household': return true;
            case 'battery': return true;
            default: return true;
        }
    }, [notificationSettings, dynamicPrefs]);

    const isCategoryEnabledRef = React.useRef(isCategoryEnabled);
    isCategoryEnabledRef.current = isCategoryEnabled;

    const saveNotification = useCallback((id: string, title: string, body: string, pushCategoryKey?: string, deliveredAt?: Date) => {
        if (processedIds.current.has(id)) return;
        processedIds.current.add(id);
        // Only save if this category is enabled in settings
        const enabled = isCategoryEnabledRef.current(title, pushCategoryKey);
        // console.log(`🔔 saveNotification: title="${title}", catKey="${pushCategoryKey}", enabled=${enabled}`);
        if (!enabled) return;
        addNotificationRef.current(title || 'Benachrichtigung', body || '', deliveredAt);
    }, []);

    // 1) FOREGROUND: Listen for notifications while app is active
    useEffect(() => {
        const sub = Notifications.addNotificationReceivedListener(notification => {
            const { title, body, data } = notification.request.content;
            const id = notification.request.identifier;
            const pushCatKey = (data as any)?.category_key || '';
            const deliveredAt = toJsDate(notification.date);
            // console.log('🔔 FOREGROUND push:', title, 'category_key:', pushCatKey);
            saveNotification(id, title || '', body || '', pushCatKey || undefined, deliveredAt);
            // Dismiss this notification from the notification center so catchDelivered won't re-process it
            Notifications.dismissNotificationAsync(id).catch(() => { });
        });
        return () => sub.remove();
    }, [saveNotification]);

    // 2) TAPPED: When user taps a notification (background or closed app)
    useEffect(() => {
        const sub = Notifications.addNotificationResponseReceivedListener(response => {
            const { title, body, data } = response.notification.request.content;
            const id = response.notification.request.identifier;
            const pushCatKey = (data as any)?.category_key || '';
            const deliveredAt = toJsDate(response.notification.date);
            // console.log('🔔 TAPPED push:', title, 'category_key:', pushCatKey);
            saveNotification(id, title || '', body || '', pushCatKey || undefined, deliveredAt);
        });
        return () => sub.remove();
    }, [saveNotification]);

    // 3) APP OPEN + FOREGROUND RETURN: Catch delivered notifications from notification center
    const catchDelivered = useCallback(async () => {
        if (!user) return;
        try {
            const delivered = await Notifications.getPresentedNotificationsAsync();
            if (delivered.length === 0) return;
            for (const n of delivered) {
                const { title, body, data } = n.request.content;
                const id = n.request.identifier;
                const pushCatKey = (data as any)?.category_key || '';
                const deliveredAt = toJsDate(n.date);
                saveNotification(id, title || '', body || '', pushCatKey || undefined, deliveredAt);
            }
            // Dismiss all processed notifications from the notification center
            await Notifications.dismissAllNotificationsAsync();
        } catch (e) {
            console.warn('Failed to get delivered notifications:', e);
        }
    }, [user, saveNotification]);

    // Run on mount
    useEffect(() => {
        catchDelivered();
    }, [catchDelivered]);

    // Run when app returns to foreground (handles Expo Go limitation + background pushes)
    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                catchDelivered();
                loadNotifications();
            }
        });
        return () => sub.remove();
    }, [catchDelivered, loadNotifications]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Jetzt';
        if (diffMins < 60) return `vor ${diffMins} Min.`;
        if (diffHours < 24) return `vor ${diffHours} Std.`;
        if (diffDays === 1) return 'Gestern';
        return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
    };

    return (
        <>
            {/* Bell Icon with Badge */}
            <Pressable
                onPress={() => setShowModal(true)}
                style={[styles.bellContainer, { backgroundColor: colors.card }]}
            >
                <Bell size={18} color={unreadCount > 0 ? colors.warning : colors.subtext} />
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Text>
                    </View>
                )}
            </Pressable>

            {/* Notification History Modal */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowModal(false)}
            >
                <View style={[styles.modalOverlay]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                Benachrichtigungen
                            </Text>
                            <View style={styles.headerActions}>
                                {notifications.length > 0 && (
                                    <>
                                        <Pressable
                                            onPress={markAllAsRead}
                                            style={[styles.headerBtn, { backgroundColor: colors.background }]}
                                        >
                                            <CheckCheck size={18} color={colors.accent} />
                                        </Pressable>
                                        <Pressable
                                            onPress={clearAll}
                                            style={[styles.headerBtn, { backgroundColor: colors.background }]}
                                        >
                                            <Trash2 size={18} color={colors.error} />
                                        </Pressable>
                                    </>
                                )}
                                <Pressable
                                    onPress={() => setShowModal(false)}
                                    style={[styles.headerBtn, { backgroundColor: colors.background }]}
                                >
                                    <X size={18} color={colors.subtext} />
                                </Pressable>
                            </View>
                        </View>

                        {/* Category Filter Chips */}
                        {presentCategories.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                                <Pressable
                                    style={[styles.filterChip, { backgroundColor: !activeFilter ? colors.accent + '20' : colors.background, borderColor: !activeFilter ? colors.accent : colors.border }]}
                                    onPress={() => setActiveFilter(null)}
                                >
                                    <Text style={{ color: !activeFilter ? colors.accent : colors.subtext, fontSize: 12, fontWeight: '600' }}>Alle</Text>
                                </Pressable>
                                {presentCategories.map(cat => {
                                    const isActive = activeFilter === cat.key;
                                    return (
                                        <Pressable
                                            key={cat.key}
                                            style={[styles.filterChip, { backgroundColor: isActive ? cat.color + '20' : colors.background, borderColor: isActive ? cat.color : colors.border }]}
                                            onPress={() => setActiveFilter(isActive ? null : cat.key)}
                                        >
                                            <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                                            <Text style={{ color: isActive ? cat.color : colors.subtext, fontSize: 12, fontWeight: '600', marginLeft: 5 }}>{cat.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        )}

                        {/* Notification List */}
                        {displayedNotifications.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Bell size={48} color={colors.subtext} />
                                <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                    {activeFilter ? 'Keine in dieser Kategorie' : 'Keine Benachrichtigungen'}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={displayedNotifications}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => {
                                    const catKey = item.categoryKey || getCatKey(item.title);
                                    const typeInfo = catKey ? notifTypes[catKey] : null;
                                    const catColor = typeInfo?.color || getCatColor(item.title);
                                    const IconComp = typeInfo ? getIconComponent(typeInfo.icon) : Bell;
                                    return (
                                        <Pressable
                                            onPress={() => markAsRead(item.id)}
                                            style={[
                                                styles.notifItem,
                                                {
                                                    backgroundColor: item.isRead
                                                        ? colors.background
                                                        : catColor + '10',
                                                    borderLeftColor: catColor,
                                                }
                                            ]}
                                        >
                                            <View style={[styles.notifIcon, { backgroundColor: catColor + '20' }]}>
                                                <IconComp size={18} color={catColor} />
                                            </View>
                                            <View style={styles.notifContent}>
                                                <Text
                                                    style={[
                                                        styles.notifTitle,
                                                        {
                                                            color: colors.text,
                                                            fontWeight: item.isRead ? '500' : '700'
                                                        }
                                                    ]}
                                                >
                                                    {item.title}
                                                </Text>
                                                <Text
                                                    style={[styles.notifBody, { color: colors.subtext }]}
                                                    numberOfLines={2}
                                                >
                                                    {item.body}
                                                </Text>
                                                <Text style={[styles.notifTime, { color: colors.subtext }]}>
                                                    {formatTime(item.timestamp)}
                                                </Text>
                                            </View>
                                            {!item.isRead && (
                                                <View style={[styles.unreadDot, { backgroundColor: catColor }]} />
                                            )}
                                        </Pressable>
                                    );
                                }}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            />
                        )}
                    </View>
                </View>
            </Modal >
        </>
    );
}

const styles = StyleSheet.create({
    bellContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        minHeight: 300,
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
        fontSize: 20,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterRow: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        alignItems: 'center',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
        height: 32,
    },
    catDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
    },
    notifItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 12,
        marginTop: 8,
        borderRadius: 12,
        borderLeftWidth: 3,
    },
    notifContent: {
        flex: 1,
    },
    notifTitle: {
        fontSize: 15,
        marginBottom: 4,
    },
    notifBody: {
        fontSize: 13,
        lineHeight: 18,
    },
    notifTime: {
        fontSize: 11,
        marginTop: 6,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginLeft: 12,
    },
    notifIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
});

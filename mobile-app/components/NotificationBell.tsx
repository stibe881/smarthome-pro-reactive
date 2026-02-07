import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet, Alert } from 'react-native';
import { Bell, Check, CheckCheck, X, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../contexts/ThemeContext';

const NOTIFICATION_HISTORY_KEY = '@smarthome_notification_history';

export interface StoredNotification {
    id: string;
    title: string;
    body: string;
    timestamp: number;
    isRead: boolean;
}

interface NotificationBellProps {
    onAppOpen?: () => void; // Called when app opens to reset badge
}

export default function NotificationBell({ onAppOpen }: NotificationBellProps) {
    const { colors } = useTheme();
    const [notifications, setNotifications] = useState<StoredNotification[]>([]);
    const [showModal, setShowModal] = useState(false);

    // Load notifications from storage
    const loadNotifications = useCallback(async () => {
        try {
            const stored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
            if (stored) {
                setNotifications(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load notification history:', e);
        }
    }, []);

    // Save notifications to storage
    const saveNotifications = useCallback(async (notifs: StoredNotification[]) => {
        try {
            await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(notifs));
        } catch (e) {
            console.warn('Failed to save notification history:', e);
        }
    }, []);

    // Add new notification to history
    const addNotification = useCallback(async (title: string, body: string) => {
        const newNotif: StoredNotification = {
            id: Date.now().toString(),
            title,
            body,
            timestamp: Date.now(),
            isRead: false,
        };
        const updated = [newNotif, ...notifications].slice(0, 50); // Keep last 50
        setNotifications(updated);
        await saveNotifications(updated);

        // Update app badge
        const unreadCount = updated.filter(n => !n.isRead).length;
        await Notifications.setBadgeCountAsync(unreadCount);
    }, [notifications, saveNotifications]);

    // Mark single notification as read
    const markAsRead = useCallback(async (id: string) => {
        const updated = notifications.map(n =>
            n.id === id ? { ...n, isRead: true } : n
        );
        setNotifications(updated);
        await saveNotifications(updated);

        // Update badge
        const unreadCount = updated.filter(n => !n.isRead).length;
        await Notifications.setBadgeCountAsync(unreadCount);
    }, [notifications, saveNotifications]);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        const updated = notifications.map(n => ({ ...n, isRead: true }));
        setNotifications(updated);
        await saveNotifications(updated);
        await Notifications.setBadgeCountAsync(0);
    }, [notifications, saveNotifications]);

    // Clear all notifications
    const clearAll = useCallback(async () => {
        Alert.alert(
            'Alle löschen?',
            'Möchtest du alle Benachrichtigungen löschen?',
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Löschen',
                    style: 'destructive',
                    onPress: async () => {
                        setNotifications([]);
                        await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
                        await Notifications.setBadgeCountAsync(0);
                    }
                }
            ]
        );
    }, []);

    // Load on mount
    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    // Reset badge when modal opens (app is open and user is checking notifications)
    useEffect(() => {
        if (showModal) {
            Notifications.setBadgeCountAsync(0);
        }
    }, [showModal]);

    // Listen for incoming notifications
    useEffect(() => {
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            const { title, body } = notification.request.content;
            if (title || body) {
                addNotification(title || 'Benachrichtigung', body || '');
            }
        });
        return () => subscription.remove();
    }, [addNotification]);

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

                        {/* Notification List */}
                        {notifications.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Bell size={48} color={colors.subtext} />
                                <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                    Keine Benachrichtigungen
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={notifications}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => (
                                    <Pressable
                                        onPress={() => markAsRead(item.id)}
                                        style={[
                                            styles.notifItem,
                                            {
                                                backgroundColor: item.isRead
                                                    ? colors.background
                                                    : colors.accent + '15',
                                                borderLeftColor: item.isRead
                                                    ? 'transparent'
                                                    : colors.accent,
                                            }
                                        ]}
                                    >
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
                                            <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
                                        )}
                                    </Pressable>
                                )}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
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
});

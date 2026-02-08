import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet, Alert } from 'react-native';
import { Bell, Check, CheckCheck, X, Trash2 } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

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
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<StoredNotification[]>([]);
    const [showModal, setShowModal] = useState(false);

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
                    isRead: n.is_read
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

    // Add new notification to Supabase
    const addNotification = useCallback(async (title: string, body: string) => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('notifications')
                .insert({
                    user_id: user.id,
                    title,
                    body,
                    is_read: false
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                const newNotif = {
                    id: data.id,
                    title: data.title,
                    body: data.body,
                    timestamp: new Date(data.created_at).getTime(),
                    isRead: data.is_read
                };
                setNotifications(prev => [newNotif, ...prev]);

                // Update Badge
                Notifications.setBadgeCountAsync((notifications.filter(n => !n.isRead).length) + 1);
            }
        } catch (e) {
            console.warn('Failed to add notification:', e);
        }
    }, [user, notifications]);

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
                        } catch (e) {
                            console.warn('Failed to delete all:', e);
                        }
                    }
                }
            ]
        );
    }, [user]);

    // Load on mount & Auth Change
    useEffect(() => {
        if (user) loadNotifications();
    }, [user, loadNotifications]);

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
                    const newNotif = {
                        id: split.id,
                        title: split.title,
                        body: split.body,
                        timestamp: new Date(split.created_at).getTime(),
                        isRead: split.is_read
                    };
                    setNotifications(prev => [newNotif, ...prev]);
                    // Let the loadNotifications handle badge generally, or update here
                    Notifications.getBadgeCountAsync().then(c => Notifications.setBadgeCountAsync(c + 1));
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

    // Listen for incoming notifications from Push (Background/Foreground)
    // AND SAVE THEM TO SUPABASE (User History)
    useEffect(() => {
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            const { title, body } = notification.request.content;
            if (title || body) {
                // IMPORTANT: Only add if we have a user. 
                // Using the ref logic or wrapper might be better to avoid strict dependency on 'addNotification' changing
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

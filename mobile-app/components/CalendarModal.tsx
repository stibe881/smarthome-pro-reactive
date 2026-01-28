import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { X, Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';

interface CalendarModalProps {
    visible: boolean;
    onClose: () => void;
    entityId: string;
    title: string;
    accentColor: string;
}

export default function CalendarModal({ visible, onClose, entityId, title, accentColor }: CalendarModalProps) {
    const { fetchCalendarEvents } = useHomeAssistant();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && entityId) {
            loadEvents();
        }
    }, [visible, entityId]);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const end = new Date();

            // If it's the birthday calendar (geburtstage_2), fetch a longer range to ensure we get 14 items
            // Otherwise default to 30 days
            const isBirthday = entityId.includes('geburtstage');
            end.setDate(now.getDate() + (isBirthday ? 365 : 30));

            const data = await fetchCalendarEvents(entityId, now.toISOString(), end.toISOString());

            let sorted = data || [];

            // Specific logic for birthdays: limit to 14 items
            if (isBirthday) {
                sorted = sorted.slice(0, 14);
            }

            setEvents(sorted);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
        const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth();

        if (isToday) return 'Heute';
        if (isTomorrow) return 'Morgen';

        return date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    };

    // Helper to check if event is all day
    const isAllDay = (start: string, end: string) => {
        // Simple heuristic: if start/end matches date boundaries or no time
        return start.includes('T') === false || (start.includes('00:00:00') && end.includes('00:00:00'));
        // HA often returns YYYY-MM-DD for all day
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={[styles.header, { backgroundColor: accentColor }]}>
                        <Text style={styles.title}>{title}</Text>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={accentColor} />
                        </View>
                    ) : (
                        <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
                            {events.length > 0 ? (
                                events.map((event, index) => {
                                    // Handle HA Calendar format
                                    const start = event.start?.dateTime || event.start?.date;
                                    const end = event.end?.dateTime || event.end?.date;
                                    const allDay = !event.start?.dateTime;

                                    return (
                                        <View key={index} style={styles.eventCard}>
                                            <View style={[styles.dateStripe, { backgroundColor: accentColor }]} />
                                            <View style={styles.eventContent}>
                                                <Text style={styles.eventTitle}>{event.summary}</Text>

                                                <View style={styles.metaRow}>
                                                    <CalendarIcon size={14} color="#94A3B8" />
                                                    <Text style={styles.metaText}>
                                                        {formatDate(start)}
                                                    </Text>
                                                </View>

                                                {!allDay && (
                                                    <View style={styles.metaRow}>
                                                        <Clock size={14} color="#94A3B8" />
                                                        <Text style={styles.metaText}>
                                                            {formatTime(start)} - {formatTime(end)}
                                                        </Text>
                                                    </View>
                                                )}

                                                {allDay && (
                                                    <View style={styles.metaRow}>
                                                        <Clock size={14} color="#94A3B8" />
                                                        <Text style={styles.metaText}>Ganztägig</Text>
                                                    </View>
                                                )}

                                                {event.location && (
                                                    <View style={styles.metaRow}>
                                                        <MapPin size={14} color="#94A3B8" />
                                                        <Text style={styles.metaText} numberOfLines={1}>
                                                            {event.location}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <View style={styles.empty}>
                                    <Text style={styles.emptyText}>Keine Termine gefunden</Text>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
    content: { backgroundColor: '#1E293B', borderRadius: 24, maxHeight: '80%', overflow: 'hidden', width: '100%' },
    header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
    body: { flex: 1 },
    scrollContent: { padding: 16, gap: 12 },
    center: { flex: 1, padding: 40, alignItems: 'center' },
    eventCard: { flexDirection: 'row', backgroundColor: '#334155', borderRadius: 12, overflow: 'hidden' },
    dateStripe: { width: 6, height: '100%' },
    eventContent: { flex: 1, padding: 16, gap: 6 },
    eventTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: '#CBD5E1', fontSize: 14 },
    empty: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#64748B' }
});

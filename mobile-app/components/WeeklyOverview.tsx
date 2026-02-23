import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView,
    ActivityIndicator, Modal,
} from 'react-native';
import { X, ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Clock } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

interface WeeklyOverviewProps { visible: boolean; onClose: () => void; onOpenModule?: (key: string) => void; }

interface DayData {
    events: { id: string; title: string; color: string; start_date: string; all_day?: boolean }[];
    todos: { id: string; title: string; completed: boolean; priority: string }[];
    meals: { id: string; meal_name: string; meal_type: string }[];
    routines: { id: string; title: string; time_of_day: string }[];
}

export const WeeklyOverview: React.FC<WeeklyOverviewProps> = ({ visible, onClose, onOpenModule }) => {
    const { colors } = useTheme();
    const { householdId } = useHousehold();

    const [weekOffset, setWeekOffset] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [weekData, setWeekData] = useState<Record<number, DayData>>({});
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const getWeekDates = useCallback((offset: number) => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
        const monday = new Date(now);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d;
        });
    }, []);

    const weekDates = getWeekDates(weekOffset);
    const weekLabel = `${weekDates[0].getDate()}.${weekDates[0].getMonth() + 1}. – ${weekDates[6].getDate()}.${weekDates[6].getMonth() + 1}.`;

    const loadWeekData = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const startDate = weekDates[0].toISOString();
            const endDate = new Date(weekDates[6].getTime() + 86400000).toISOString();
            const ws = weekDates[0].toISOString().split('T')[0];

            const [eventsRes, todosRes, mealsRes, routinesRes] = await Promise.all([
                supabase.from('planner_events').select('id, title, color, start_date, all_day').eq('household_id', householdId).gte('start_date', startDate).lt('start_date', endDate),
                supabase.from('family_todos').select('id, title, completed, priority, created_at').eq('household_id', householdId),
                supabase.from('meal_plans').select('id, meal_name, meal_type, day_of_week').eq('household_id', householdId).eq('week_start', ws),
                supabase.from('family_routines').select('id, title, time_of_day').eq('household_id', householdId).eq('is_active', true),
            ]);

            const data: Record<number, DayData> = {};
            for (let i = 0; i < 7; i++) {
                const dayDate = weekDates[i];
                const dayStr = dayDate.toISOString().split('T')[0];
                data[i] = {
                    events: (eventsRes.data || []).filter(e => e.start_date.startsWith(dayStr)),
                    todos: todosRes.data || [],
                    meals: (mealsRes.data || []).filter((m: any) => m.day_of_week === i),
                    routines: routinesRes.data || [],
                };
            }
            setWeekData(data);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [householdId, weekOffset]);

    useEffect(() => { if (visible) loadWeekData(); }, [visible, loadWeekData]);

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    const totalEvents = Object.values(weekData).reduce((sum, d) => sum + d.events.length, 0);
    const totalMeals = Object.values(weekData).reduce((sum, d) => sum + d.meals.length, 0);
    const openTodos = (weekData[0]?.todos || []).filter(t => !t.completed).length;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Wochenübersicht</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Week Nav */}
                <View style={[styles.weekNav, { backgroundColor: colors.card }]}>
                    <Pressable onPress={() => setWeekOffset(w => w - 1)}><ChevronLeft size={20} color={colors.text} /></Pressable>
                    <Text style={[styles.weekLabel, { color: colors.text }]}>KW {weekLabel}</Text>
                    <Pressable onPress={() => setWeekOffset(w => w + 1)}><ChevronRight size={20} color={colors.text} /></Pressable>
                </View>

                {/* Quick Stats */}
                <View style={[styles.statsRow]}>
                    <Pressable style={[styles.statBadge, { backgroundColor: '#3B82F615' }]} onPress={() => { onClose(); onOpenModule?.('calendar'); }}>
                        <Text style={{ fontSize: 18 }}>📅</Text>
                        <Text style={[styles.statNum, { color: '#3B82F6' }]}>{totalEvents}</Text>
                        <Text style={[styles.statLabel, { color: colors.subtext }]}>Termine</Text>
                    </Pressable>
                    <Pressable style={[styles.statBadge, { backgroundColor: '#F59E0B15' }]} onPress={() => { onClose(); onOpenModule?.('meals'); }}>
                        <Text style={{ fontSize: 18 }}>🍽️</Text>
                        <Text style={[styles.statNum, { color: '#F59E0B' }]}>{totalMeals}</Text>
                        <Text style={[styles.statLabel, { color: colors.subtext }]}>Mahlzeiten</Text>
                    </Pressable>
                    <Pressable style={[styles.statBadge, { backgroundColor: '#EF444415' }]} onPress={() => { onClose(); onOpenModule?.('todos'); }}>
                        <Text style={{ fontSize: 18 }}>✅</Text>
                        <Text style={[styles.statNum, { color: '#EF4444' }]}>{openTodos}</Text>
                        <Text style={[styles.statLabel, { color: colors.subtext }]}>Offen</Text>
                    </Pressable>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> : (
                        weekDates.map((date, dayIdx) => {
                            const day = weekData[dayIdx];
                            const today = isToday(date);
                            const hasContent = day && (day.events.length > 0 || day.meals.length > 0);
                            return (
                                <Pressable
                                    key={dayIdx}
                                    style={[styles.dayCard, { backgroundColor: colors.card, borderColor: today ? colors.accent : colors.border }]}
                                    onPress={() => setSelectedDay(selectedDay === dayIdx ? null : dayIdx)}
                                >
                                    <View style={styles.dayHeader}>
                                        <View style={[styles.dayCircle, today && { backgroundColor: colors.accent }]}>
                                            <Text style={[styles.dayNum, { color: today ? '#fff' : colors.text }]}>{date.getDate()}</Text>
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.dayName, { color: today ? colors.accent : colors.text }]}>{DAY_NAMES[dayIdx]}</Text>
                                            {!hasContent && <Text style={{ color: colors.subtext, fontSize: 12 }}>Keine Einträge</Text>}
                                        </View>
                                        {day?.events.length > 0 && (
                                            <View style={[styles.badge, { backgroundColor: '#3B82F620' }]}>
                                                <Text style={{ fontSize: 10, color: '#3B82F6', fontWeight: '700' }}>{day.events.length} 📅</Text>
                                            </View>
                                        )}
                                        {day?.meals.length > 0 && (
                                            <View style={[styles.badge, { backgroundColor: '#F59E0B20', marginLeft: 4 }]}>
                                                <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: '700' }}>{day.meals.length} 🍽️</Text>
                                            </View>
                                        )}
                                    </View>

                                    {selectedDay === dayIdx && day && (
                                        <View style={styles.dayDetails}>
                                            {day.events.map(e => (
                                                <View key={e.id} style={styles.detailRow}>
                                                    <View style={[styles.dot, { backgroundColor: e.color }]} />
                                                    <Text style={[styles.detailText, { color: colors.text }]}>{e.title}</Text>
                                                    <Text style={{ color: colors.subtext, fontSize: 11 }}>
                                                        {e.all_day ? 'Ganztägig' : new Date(e.start_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                                    </Text>
                                                </View>
                                            ))}
                                            {day.meals.map(m => (
                                                <View key={m.id} style={styles.detailRow}>
                                                    <Text style={{ fontSize: 12 }}>🍽️</Text>
                                                    <Text style={[styles.detailText, { color: colors.text }]}>{m.meal_name}</Text>
                                                    <Text style={{ color: colors.subtext, fontSize: 11 }}>{m.meal_type}</Text>
                                                </View>
                                            ))}
                                            {day.routines.map(r => (
                                                <View key={r.id} style={styles.detailRow}>
                                                    <Text style={{ fontSize: 12 }}>{r.time_of_day === 'morning' ? '🌅' : r.time_of_day === 'evening' ? '🌙' : '☀️'}</Text>
                                                    <Text style={[styles.detailText, { color: colors.text }]}>{r.title}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </Pressable>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    weekNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, marginHorizontal: 16, marginTop: 12, borderRadius: 12 },
    weekLabel: { fontSize: 15, fontWeight: '700' },
    statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
    statBadge: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
    statNum: { fontSize: 20, fontWeight: '900' },
    statLabel: { fontSize: 10, fontWeight: '600' },
    dayCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 6 },
    dayHeader: { flexDirection: 'row', alignItems: 'center' },
    dayCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    dayNum: { fontSize: 16, fontWeight: '800' },
    dayName: { fontSize: 15, fontWeight: '700' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    dayDetails: { marginTop: 10, gap: 6 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    detailText: { flex: 1, fontSize: 13 },
});

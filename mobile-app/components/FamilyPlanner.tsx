import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput,
    ActivityIndicator, Alert, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    CalendarDays, Plus, X, Clock, Trash2, Edit3, Check,
    ChevronLeft, ChevronRight, Tag, AlignLeft, Palette,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlannerEvent {
    id: string;
    household_id: string;
    created_by: string | null;
    title: string;
    description: string | null;
    start_date: string;
    end_date: string | null;
    all_day: boolean;
    color: string;
    category: string;
    created_at: string;
}

const CATEGORIES = [
    { key: 'event', label: 'Termin', color: '#3B82F6', icon: '📅' },
    { key: 'task', label: 'Aufgabe', color: '#10B981', icon: '✅' },
    { key: 'reminder', label: 'Erinnerung', color: '#F59E0B', icon: '🔔' },
    { key: 'birthday', label: 'Geburtstag', color: '#EC4899', icon: '🎂' },
];

const COLOR_OPTIONS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316'];

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const FamilyPlanner: React.FC = () => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();
    const insets = useSafeAreaInsets();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [events, setEvents] = useState<PlannerEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formStartDate, setFormStartDate] = useState(new Date());
    const [formEndDate, setFormEndDate] = useState<Date | null>(null);
    const [formAllDay, setFormAllDay] = useState(false);
    const [formColor, setFormColor] = useState('#3B82F6');
    const [formCategory, setFormCategory] = useState('event');
    const [isSaving, setIsSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | 'startTime' | 'endTime' | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    // Load events for current month
    const loadEvents = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

            const { data, error } = await supabase
                .from('planner_events')
                .select('*')
                .eq('household_id', householdId)
                .gte('start_date', monthStart.toISOString())
                .lte('start_date', monthEnd.toISOString())
                .order('start_date', { ascending: true });

            if (error) throw error;
            setEvents(data || []);
        } catch (e: any) {
            console.error('Error loading planner events:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, currentMonth]);

    useEffect(() => { loadEvents(); }, [loadEvents]);

    // Calendar helpers
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date: Date) => {
        const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return day === 0 ? 6 : day - 1; // Convert Sunday=0 to Monday-based index
    };

    const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    const isToday = (date: Date) => isSameDay(date, new Date());

    const getEventsForDay = (date: Date) =>
        events.filter(e => isSameDay(new Date(e.start_date), date));

    const hasEventsOnDay = (date: Date) => getEventsForDay(date).length > 0;

    // Navigation
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const goToToday = () => {
        const today = new Date();
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDate(today);
    };

    // CRUD operations
    const openCreateModal = () => {
        setEditingEvent(null);
        setFormTitle('');
        setFormDescription('');
        setFormStartDate(selectedDate);
        setFormEndDate(null);
        setFormAllDay(false);
        setFormColor('#3B82F6');
        setFormCategory('event');
        setShowCreateModal(true);
    };

    const openEditModal = (event: PlannerEvent) => {
        setEditingEvent(event);
        setFormTitle(event.title);
        setFormDescription(event.description || '');
        setFormStartDate(new Date(event.start_date));
        setFormEndDate(event.end_date ? new Date(event.end_date) : null);
        setFormAllDay(event.all_day);
        setFormColor(event.color);
        setFormCategory(event.category);
        setShowCreateModal(true);
    };

    const handleSave = async () => {
        if (!formTitle.trim() || !householdId) {
            Alert.alert('Fehler', 'Bitte gib einen Titel ein.');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                household_id: householdId,
                title: formTitle.trim(),
                description: formDescription.trim() || null,
                start_date: formStartDate.toISOString(),
                end_date: formEndDate?.toISOString() || null,
                all_day: formAllDay,
                color: formColor,
                category: formCategory,
            };

            if (editingEvent) {
                const { error } = await supabase
                    .from('planner_events')
                    .update(payload)
                    .eq('id', editingEvent.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('planner_events')
                    .insert({ ...payload, created_by: user?.id });
                if (error) throw error;
            }

            setShowCreateModal(false);
            loadEvents();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (event: PlannerEvent) => {
        Alert.alert('Löschen', `"${event.title}" wirklich löschen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen', style: 'destructive', onPress: async () => {
                    try {
                        await supabase.from('planner_events').delete().eq('id', event.id);
                        loadEvents();
                    } catch (e: any) { Alert.alert('Fehler', e.message); }
                }
            }
        ]);
    };

    // Format helpers
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const formatDate = (date: Date) => `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;

    const getCategoryInfo = (key: string) => CATEGORIES.find(c => c.key === key) || CATEGORIES[0];

    // Selected day events
    const selectedDayEvents = getEventsForDay(selectedDate);

    // Calendar grid
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    if (!householdId) {
        return (
            <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
                <CalendarDays size={48} color={colors.subtext} />
                <Text style={[styles.emptyText, { color: colors.subtext }]}>
                    Kein Haushalt gefunden.{'\n'}Bitte richte zuerst deinen Haushalt ein.
                </Text>
            </View>
        );
    }

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {/* Month Header */}
            <View style={[styles.monthHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Pressable onPress={prevMonth} style={styles.navBtn} hitSlop={12}>
                    <ChevronLeft size={22} color={colors.text} />
                </Pressable>
                <Pressable onPress={goToToday}>
                    <Text style={[styles.monthTitle, { color: colors.text }]}>
                        {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </Text>
                </Pressable>
                <Pressable onPress={nextMonth} style={styles.navBtn} hitSlop={12}>
                    <ChevronRight size={22} color={colors.text} />
                </Pressable>
            </View>

            {/* Weekday Headers */}
            <View style={styles.weekdayRow}>
                {WEEKDAYS.map(day => (
                    <View key={day} style={styles.weekdayCell}>
                        <Text style={[styles.weekdayText, { color: colors.subtext }]}>{day}</Text>
                    </View>
                ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
                {calendarDays.map((day, i) => {
                    if (day === null) return <View key={`empty-${i}`} style={styles.dayCell} />;
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                    const isSelected = isSameDay(date, selectedDate);
                    const isTodayDate = isToday(date);
                    const hasEvents = hasEventsOnDay(date);

                    return (
                        <Pressable
                            key={day}
                            style={[
                                styles.dayCell,
                                isSelected && { backgroundColor: colors.accent, borderRadius: 12 },
                                isTodayDate && !isSelected && { borderWidth: 1.5, borderColor: colors.accent, borderRadius: 12 },
                            ]}
                            onPress={() => setSelectedDate(date)}
                        >
                            <Text style={[
                                styles.dayText,
                                { color: isSelected ? '#fff' : colors.text },
                                isTodayDate && !isSelected && { color: colors.accent, fontWeight: '800' },
                            ]}>
                                {day}
                            </Text>
                            {hasEvents && (
                                <View style={[styles.eventDot, { backgroundColor: isSelected ? '#fff' : colors.accent }]} />
                            )}
                        </Pressable>
                    );
                })}
            </View>

            {/* Selected Day Header */}
            <View style={[styles.dayHeader, { borderColor: colors.border }]}>
                <View>
                    <Text style={[styles.dayHeaderTitle, { color: colors.text }]}>
                        {selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                    <Text style={[styles.eventCount, { color: colors.subtext }]}>
                        {selectedDayEvents.length === 0 ? 'Keine Termine' : `${selectedDayEvents.length} ${selectedDayEvents.length === 1 ? 'Termin' : 'Termine'}`}
                    </Text>
                </View>
                <Pressable
                    style={[styles.addBtn, { backgroundColor: colors.accent }]}
                    onPress={openCreateModal}
                >
                    <Plus size={20} color="#fff" />
                </Pressable>
            </View>

            {/* Events List */}
            <ScrollView style={styles.eventsList} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {isLoading ? (
                    <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                ) : selectedDayEvents.length === 0 ? (
                    <View style={styles.emptyDay}>
                        <Text style={[styles.emptyDayText, { color: colors.subtext }]}>
                            Keine Einträge für diesen Tag
                        </Text>
                        <Pressable onPress={openCreateModal} style={{ marginTop: 12 }}>
                            <Text style={[styles.emptyDayLink, { color: colors.accent }]}>+ Neuen Termin erstellen</Text>
                        </Pressable>
                    </View>
                ) : (
                    selectedDayEvents.map(event => {
                        const cat = getCategoryInfo(event.category);
                        return (
                            <Pressable
                                key={event.id}
                                style={[styles.eventCard, { backgroundColor: colors.card, borderLeftColor: event.color, borderColor: colors.border }]}
                                onPress={() => openEditModal(event)}
                            >
                                <View style={styles.eventCardContent}>
                                    <View style={styles.eventCardTop}>
                                        <Text style={styles.eventEmoji}>{cat.icon}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>
                                            {event.description ? (
                                                <Text style={[styles.eventDesc, { color: colors.subtext }]} numberOfLines={1}>{event.description}</Text>
                                            ) : null}
                                        </View>
                                    </View>
                                    <View style={styles.eventMeta}>
                                        {!event.all_day && (
                                            <View style={styles.eventTimeRow}>
                                                <Clock size={12} color={colors.subtext} />
                                                <Text style={[styles.eventTimeText, { color: colors.subtext }]}>
                                                    {formatTime(event.start_date)}
                                                    {event.end_date && ` – ${formatTime(event.end_date)}`}
                                                </Text>
                                            </View>
                                        )}
                                        {event.all_day && (
                                            <View style={[styles.allDayBadge, { backgroundColor: event.color + '20' }]}>
                                                <Text style={[styles.allDayText, { color: event.color }]}>Ganztägig</Text>
                                            </View>
                                        )}
                                        <View style={[styles.categoryBadge, { backgroundColor: cat.color + '15' }]}>
                                            <Text style={[styles.categoryText, { color: cat.color }]}>{cat.label}</Text>
                                        </View>
                                    </View>
                                </View>
                                <Pressable onPress={() => handleDelete(event)} hitSlop={12} style={styles.deleteBtn}>
                                    <Trash2 size={16} color={colors.subtext} />
                                </Pressable>
                            </Pressable>
                        );
                    })
                )}
            </ScrollView>

            {/* Create/Edit Modal */}
            <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
                <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <Pressable onPress={() => setShowCreateModal(false)}><X size={24} color={colors.subtext} /></Pressable>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{editingEvent ? 'Bearbeiten' : 'Neuer Termin'}</Text>
                        <Pressable onPress={handleSave} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator size="small" color={colors.accent} /> : <Check size={24} color={colors.accent} />}
                        </Pressable>
                    </View>
                    <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                        {/* Title */}
                        <Text style={[styles.formLabel, { color: colors.subtext }]}>Titel</Text>
                        <TextInput
                            style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            value={formTitle}
                            onChangeText={setFormTitle}
                            placeholder="z.B. Arzttermin, Einkaufen..."
                            placeholderTextColor={colors.subtext}
                            autoFocus
                        />

                        {/* Description */}
                        <Text style={[styles.formLabel, { color: colors.subtext, marginTop: 16 }]}>Beschreibung</Text>
                        <TextInput
                            style={[styles.formInput, styles.formTextArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            value={formDescription}
                            onChangeText={setFormDescription}
                            placeholder="Optional..."
                            placeholderTextColor={colors.subtext}
                            multiline
                            numberOfLines={3}
                        />

                        {/* Date */}
                        <Text style={[styles.formLabel, { color: colors.subtext, marginTop: 16 }]}>Datum</Text>
                        <Pressable
                            style={[styles.formInput, { borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                            onPress={() => setShowDatePicker('start')}
                        >
                            <CalendarDays size={16} color={colors.subtext} />
                            <Text style={{ color: colors.text, fontSize: 15 }}>{formatDate(formStartDate)}</Text>
                        </Pressable>

                        {showDatePicker === 'start' && (
                            <DateTimePicker
                                value={formStartDate}
                                mode="date"
                                display="spinner"
                                onChange={(_, date) => { setShowDatePicker(null); if (date) setFormStartDate(date); }}
                                locale="de"
                            />
                        )}

                        {/* Time (if not all day) */}
                        {!formAllDay && (
                            <View style={{ marginTop: 12 }}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Pressable
                                        style={[styles.formInput, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                                        onPress={() => setShowDatePicker('startTime')}
                                    >
                                        <Clock size={14} color={colors.subtext} />
                                        <Text style={{ color: colors.text, fontSize: 15 }}>{formStartDate.getHours().toString().padStart(2, '0')}:{formStartDate.getMinutes().toString().padStart(2, '0')}</Text>
                                    </Pressable>
                                    <Text style={{ color: colors.subtext, alignSelf: 'center' }}>–</Text>
                                    <Pressable
                                        style={[styles.formInput, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                                        onPress={() => setShowDatePicker('endTime')}
                                    >
                                        <Clock size={14} color={colors.subtext} />
                                        <Text style={{ color: colors.text, fontSize: 15 }}>
                                            {formEndDate ? `${formEndDate.getHours().toString().padStart(2, '0')}:${formEndDate.getMinutes().toString().padStart(2, '0')}` : '--:--'}
                                        </Text>
                                    </Pressable>
                                </View>
                                {showDatePicker === 'startTime' && (
                                    <DateTimePicker
                                        value={formStartDate}
                                        mode="time"
                                        display="spinner"
                                        is24Hour
                                        onChange={(_, date) => { setShowDatePicker(null); if (date) setFormStartDate(date); }}
                                        locale="de"
                                    />
                                )}
                                {showDatePicker === 'endTime' && (
                                    <DateTimePicker
                                        value={formEndDate || new Date(formStartDate.getTime() + 3600000)}
                                        mode="time"
                                        display="spinner"
                                        is24Hour
                                        onChange={(_, date) => { setShowDatePicker(null); if (date) setFormEndDate(date); }}
                                        locale="de"
                                    />
                                )}
                            </View>
                        )}

                        {/* All Day Toggle */}
                        <Pressable
                            style={[styles.allDayToggle, { borderColor: colors.border, backgroundColor: formAllDay ? colors.accent + '15' : colors.card }]}
                            onPress={() => setFormAllDay(!formAllDay)}
                        >
                            <Text style={{ color: formAllDay ? colors.accent : colors.text, fontWeight: '600' }}>Ganztägig</Text>
                            <View style={[styles.checkbox, formAllDay && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                {formAllDay && <Check size={14} color="#fff" />}
                            </View>
                        </Pressable>

                        {/* Category */}
                        <Text style={[styles.formLabel, { color: colors.subtext, marginTop: 20 }]}>Kategorie</Text>
                        <View style={styles.categoryRow}>
                            {CATEGORIES.map(cat => (
                                <Pressable
                                    key={cat.key}
                                    style={[
                                        styles.categoryOption,
                                        { borderColor: formCategory === cat.key ? cat.color : colors.border, backgroundColor: formCategory === cat.key ? cat.color + '15' : colors.card }
                                    ]}
                                    onPress={() => { setFormCategory(cat.key); setFormColor(cat.color); }}
                                >
                                    <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: formCategory === cat.key ? cat.color : colors.subtext, marginTop: 2 }}>{cat.label}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Color */}
                        <Text style={[styles.formLabel, { color: colors.subtext, marginTop: 20 }]}>Farbe</Text>
                        <View style={styles.colorRow}>
                            {COLOR_OPTIONS.map(c => (
                                <Pressable
                                    key={c}
                                    style={[styles.colorDot, { backgroundColor: c, borderWidth: formColor === c ? 3 : 0, borderColor: '#fff' }]}
                                    onPress={() => setFormColor(c)}
                                />
                            ))}
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </Modal>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { textAlign: 'center', marginTop: 16, fontSize: 15, lineHeight: 22 },

    // Month header
    monthHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 8,
        borderRadius: 16, borderWidth: 1,
    },
    navBtn: { padding: 4 },
    monthTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },

    // Weekday row
    weekdayRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 12 },
    weekdayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
    weekdayText: { fontSize: 12, fontWeight: '700' },

    // Calendar grid
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 4 },
    dayCell: {
        width: (SCREEN_WIDTH - 24) / 7, height: 44,
        justifyContent: 'center', alignItems: 'center',
    },
    dayText: { fontSize: 15, fontWeight: '500' },
    eventDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },

    // Day header
    dayHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14, marginTop: 8,
        borderTopWidth: 1,
    },
    dayHeaderTitle: { fontSize: 16, fontWeight: '700' },
    eventCount: { fontSize: 12, marginTop: 2 },
    addBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

    // Events list
    eventsList: { flex: 1, paddingHorizontal: 16 },
    emptyDay: { alignItems: 'center', paddingVertical: 40 },
    emptyDayText: { fontSize: 14 },
    emptyDayLink: { fontSize: 14, fontWeight: '600' },

    // Event card
    eventCard: {
        flexDirection: 'row', alignItems: 'center',
        padding: 14, borderRadius: 14, borderLeftWidth: 4, borderWidth: 1,
        marginTop: 8,
    },
    eventCardContent: { flex: 1 },
    eventCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    eventEmoji: { fontSize: 20 },
    eventTitle: { fontSize: 15, fontWeight: '600' },
    eventDesc: { fontSize: 12, marginTop: 2 },
    eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    eventTimeText: { fontSize: 12 },
    allDayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    allDayText: { fontSize: 11, fontWeight: '600' },
    categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    categoryText: { fontSize: 11, fontWeight: '600' },
    deleteBtn: { padding: 8 },

    // Modal
    modalContainer: { flex: 1 },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderBottomWidth: 1,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },

    // Form
    formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
    formInput: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    formTextArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },

    allDayToggle: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginTop: 12,
    },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#64748B', justifyContent: 'center', alignItems: 'center' },

    categoryRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    categoryOption: {
        flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    },

    colorRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    colorDot: { width: 28, height: 28, borderRadius: 14 },
});

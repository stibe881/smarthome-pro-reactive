import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Switch, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    X, Check, Plus, Cake, Heart, PartyPopper, Trash2, Bell, BellOff,
    CalendarDays, Eye, RotateCcw, ChevronRight, Link2,
} from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface CelebrationItem {
    id: string;
    household_id: string;
    created_by: string | null;
    name: string;
    event_type: 'birthday' | 'anniversary' | 'celebration';
    event_date: string;
    show_year: boolean;
    all_day: boolean;
    color: string;
    emoji: string;
    image_url: string | null;
    repeat_type: string;
    reminder_time: string;
    visibility: string;
    created_at: string;
}

interface FamilyCelebrationsProps {
    visible: boolean;
    onClose: () => void;
}

type EventType = 'birthday' | 'anniversary' | 'celebration';
type ViewMode = 'list' | 'type_picker' | 'form';

const EVENT_TYPES: { key: EventType; title: string; emoji: string; bgColor: string; description: string }[] = [
    {
        key: 'birthday', title: 'Geburtstag', emoji: '🎂',
        bgColor: '#8B8FC7',
        description: 'Feiern Sie den besonderen Tag, an dem ein geliebter Mensch geboren wurde.',
    },
    {
        key: 'anniversary', title: 'Jubiläen', emoji: '🎈',
        bgColor: '#B88BC7',
        description: 'Halten Sie besondere Meilensteine der Liebe und Verbundenheit fest.',
    },
    {
        key: 'celebration', title: 'Feier', emoji: '🎉',
        bgColor: '#6BB87A',
        description: 'Von besonderen Feiern bis zu bedeutungsvollen Momenten – behalten Sie alles im Blick.',
    },
];

const COLOR_OPTIONS = [
    { name: 'Lavandel', color: '#8B8FC7' },
    { name: 'Pfirsich', color: '#E8915A' },
    { name: 'Gletscher', color: '#5ABDB0' },
    { name: 'Rose', color: '#D4748A' },
    { name: 'Himmel', color: '#5A9EE8' },
    { name: 'Minze', color: '#6BC77A' },
];

const REMINDER_OPTIONS = [
    { key: 'same_day_09', label: 'Am selben Tag um 09:00 Uhr' },
    { key: 'day_before_09', label: '1 Tag vorher um 09:00 Uhr' },
    { key: 'week_before_09', label: '1 Woche vorher um 09:00 Uhr' },
    { key: 'none', label: 'Keine Erinnerung' },
];

export const FamilyCelebrations: React.FC<FamilyCelebrationsProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();
    const { fetchCalendarEvents, callService } = useHomeAssistant();

    const [celebrations, setCelebrations] = useState<CelebrationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Form state
    const [selectedType, setSelectedType] = useState<EventType>('birthday');
    const [formName, setFormName] = useState('');
    const [formDate, setFormDate] = useState(new Date());
    const [formShowYear, setFormShowYear] = useState(true);
    const [formAllDay, setFormAllDay] = useState(true);
    const [formColor, setFormColor] = useState('#8B8FC7');
    const [formRepeat, setFormRepeat] = useState('yearly');
    const [formReminder, setFormReminder] = useState('same_day_09');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingItem, setEditingItem] = useState<CelebrationItem | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showReminderPicker, setShowReminderPicker] = useState(false);

    // HA Birthday calendar integration
    const [birthdayCalSource, setBirthdayCalSource] = useState<{ entity_id: string } | null>(null);
    const [haEvents, setHaEvents] = useState<CelebrationItem[]>([]);

    const loadCelebrations = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_celebrations')
                .select('*')
                .eq('household_id', householdId)
                .order('event_date', { ascending: true });
            if (error) throw error;
            setCelebrations(data || []);
        } catch (e: any) {
            console.error('Error loading celebrations:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => {
        if (visible) {
            loadCelebrations();
            loadBirthdayCalSource();
            setViewMode('list');
        }
    }, [visible, loadCelebrations]);

    // Load the birthday calendar source
    const loadBirthdayCalSource = async () => {
        if (!householdId) return;
        try {
            const { data } = await supabase
                .from('planner_calendar_sources')
                .select('entity_id')
                .eq('household_id', householdId)
                .eq('is_birthday_calendar', true)
                .limit(1)
                .single();
            setBirthdayCalSource(data || null);
        } catch {
            setBirthdayCalSource(null);
        }
    };

    // Load HA birthday events when we have the source
    useEffect(() => {
        if (!birthdayCalSource || !fetchCalendarEvents) return;
        const loadHaBirthdays = async () => {
            try {
                const now = new Date();
                const end = new Date();
                end.setDate(now.getDate() + 365);
                const data = await fetchCalendarEvents(birthdayCalSource.entity_id, now.toISOString(), end.toISOString());
                if (!data || !Array.isArray(data)) return;

                const items: CelebrationItem[] = data.slice(0, 30).map((evt: any, idx: number) => {
                    const startStr = evt.start?.date || evt.start?.dateTime || evt.start || '';
                    const dateOnly = startStr.slice(0, 10);
                    return {
                        id: `ha-birthday-${idx}`,
                        household_id: '',
                        created_by: null,
                        name: evt.summary || 'Unbenannt',
                        event_type: 'birthday' as const,
                        event_date: dateOnly,
                        show_year: false,
                        all_day: true,
                        color: '#EC4899',
                        emoji: '🎂',
                        image_url: null,
                        repeat_type: 'yearly',
                        reminder_time: 'none',
                        visibility: 'everyone',
                        created_at: '',
                    };
                });
                setHaEvents(items);
            } catch (e) {
                console.error('Error loading HA birthday events:', e);
            }
        };
        loadHaBirthdays();
    }, [birthdayCalSource, fetchCalendarEvents]);

    const resetForm = () => {
        setFormName('');
        setFormDate(new Date());
        setFormShowYear(true);
        setFormAllDay(true);
        setFormColor('#8B8FC7');
        setFormRepeat('yearly');
        setFormReminder('same_day_09');
        setEditingItem(null);
        setShowColorPicker(false);
        setShowReminderPicker(false);
    };

    const openTypePicker = () => {
        resetForm();
        setViewMode('type_picker');
    };

    const selectType = (type: EventType) => {
        setSelectedType(type);
        const typeInfo = EVENT_TYPES.find(t => t.key === type)!;
        setFormColor(typeInfo.bgColor);
        setViewMode('form');
    };

    const openEditForm = (item: CelebrationItem) => {
        setEditingItem(item);
        setSelectedType(item.event_type);
        setFormName(item.name);
        setFormDate(new Date(item.event_date + 'T00:00:00'));
        setFormShowYear(item.show_year);
        setFormAllDay(item.all_day);
        setFormColor(item.color);
        setFormRepeat(item.repeat_type);
        setFormReminder(item.reminder_time);
        setViewMode('form');
    };

    const handleSave = async () => {
        if (!formName.trim() || !householdId) {
            Alert.alert('Fehler', 'Bitte gib einen Namen ein.');
            return;
        }
        setIsSaving(true);
        try {
            const typeInfo = EVENT_TYPES.find(t => t.key === selectedType)!;
            const dateStr = formDate.toISOString().split('T')[0];

            const data = {
                household_id: householdId,
                created_by: user?.id,
                name: formName.trim(),
                event_type: selectedType,
                event_date: dateStr,
                show_year: formShowYear,
                all_day: formAllDay,
                color: formColor,
                emoji: typeInfo.emoji,
                repeat_type: formRepeat,
                reminder_time: formReminder,
                visibility: 'everyone',
            };

            if (editingItem) {
                const { error } = await supabase
                    .from('family_celebrations')
                    .update(data)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('family_celebrations')
                    .insert(data);
                if (error) throw error;
            }

            resetForm();
            setViewMode('list');
            loadCelebrations();

            // Sync birthday to HA calendar if birthday calendar is configured
            if (selectedType === 'birthday' && birthdayCalSource && callService) {
                try {
                    const startDate = dateStr;
                    const endDate = new Date(new Date(dateStr + 'T00:00:00').getTime() + 86400000).toISOString().split('T')[0];
                    callService('calendar', 'create_event', birthdayCalSource.entity_id, {
                        summary: formName.trim(),
                        start_date: startDate,
                        end_date: endDate,
                    });
                } catch (syncErr) {
                    console.warn('HA birthday sync failed:', syncErr);
                }
            }
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (item: CelebrationItem) => {
        Alert.alert('Löschen', `"${item.name}" wirklich löschen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen', style: 'destructive', onPress: async () => {
                    await supabase.from('family_celebrations').delete().eq('id', item.id);
                    loadCelebrations();
                }
            },
        ]);
    };

    const getDaysUntil = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = new Date(dateStr + 'T00:00:00');
        const thisYear = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        if (thisYear < today) {
            thisYear.setFullYear(thisYear.getFullYear() + 1);
        }
        const diff = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const formatEventDate = (dateStr: string, showYear: boolean) => {
        const d = new Date(dateStr + 'T00:00:00');
        const day = d.getDate();
        const months = ['Jan.', 'Feb.', 'Mär.', 'Apr.', 'Mai', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
        const month = months[d.getMonth()];
        if (showYear) return `${day}. ${month} ${d.getFullYear()}`;
        return `${day}. ${month}`;
    };

    const getAge = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        let age = today.getFullYear() - d.getFullYear();
        const thisYearBD = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        if (thisYearBD > today) age--;
        return age;
    };

    const currentColorInfo = COLOR_OPTIONS.find(c => c.color === formColor) || { name: 'Benutzerdefiniert', color: formColor };
    const currentReminderInfo = REMINDER_OPTIONS.find(r => r.key === formReminder) || REMINDER_OPTIONS[0];
    const typeInfo = EVENT_TYPES.find(t => t.key === selectedType)!;

    // Merge Supabase celebrations with HA birthday events (deduplicated)
    const mergedCelebrations = (() => {
        const deduped = haEvents.filter(ha => {
            const haName = ha.name.toLowerCase().trim();
            const haMonth = new Date(ha.event_date + 'T00:00:00').getMonth();
            const haDay = new Date(ha.event_date + 'T00:00:00').getDate();
            return !celebrations.some(c => {
                const cName = c.name.toLowerCase().trim();
                const cMonth = new Date(c.event_date + 'T00:00:00').getMonth();
                const cDay = new Date(c.event_date + 'T00:00:00').getDate();
                return cName === haName && cMonth === haMonth && cDay === haDay;
            });
        });
        return [...celebrations, ...deduped];
    })();

    // --- Render ---

    const renderList = () => (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {isLoading ? (
                <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
            ) : mergedCelebrations.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={{ fontSize: 48 }}>🎂</Text>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Einträge</Text>
                    <Text style={[styles.emptyText, { color: colors.subtext }]}>
                        Füge Geburtstage, Jubiläen{'\n'}und Feiern hinzu!
                    </Text>
                </View>
            ) : (
                <>
                    {/* Upcoming section */}
                    {mergedCelebrations.map(item => {
                        const daysUntil = getDaysUntil(item.event_date);
                        const isToday = daysUntil === 0;
                        const isSoon = daysUntil <= 7;
                        const isHaEvent = item.id.startsWith('ha-');

                        return (
                            <Pressable
                                key={item.id}
                                style={[styles.celebrationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => !isHaEvent && openEditForm(item)}
                                onLongPress={() => !isHaEvent && handleDelete(item)}
                            >
                                <View style={[styles.celebEmoji, { backgroundColor: item.color + '25' }]}>
                                    <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.celebName, { color: colors.text }]}>{item.name}</Text>
                                    <Text style={[styles.celebDate, { color: colors.subtext }]}>
                                        {formatEventDate(item.event_date, item.show_year)}
                                        {item.event_type === 'birthday' && item.show_year && ` · wird ${getAge(item.event_date) + 1}`}
                                    </Text>

                                </View>
                                <View style={styles.celebRight}>
                                    {isToday ? (
                                        <View style={[styles.todayBadge, { backgroundColor: '#EF4444' }]}>
                                            <Text style={styles.todayBadgeText}>Heute! 🎉</Text>
                                        </View>
                                    ) : isSoon ? (
                                        <Text style={[styles.daysText, { color: colors.accent }]}>
                                            in {daysUntil}d
                                        </Text>
                                    ) : (
                                        <Text style={[styles.daysText, { color: colors.subtext }]}>
                                            in {daysUntil}d
                                        </Text>
                                    )}
                                </View>
                            </Pressable>
                        );
                    })}
                </>
            )}
        </ScrollView>
    );

    const renderTypePicker = () => (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.typePickerContent}>
            <Text style={[styles.typePickerTitle, { color: colors.text }]}>Neue Feiern</Text>
            {EVENT_TYPES.map(type => (
                <Pressable
                    key={type.key}
                    style={[styles.typeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => selectType(type.key)}
                >
                    <View style={[styles.typeEmoji, { backgroundColor: type.bgColor }]}>
                        <Text style={{ fontSize: 36 }}>{type.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.typeTitle, { color: colors.text }]}>{type.title} {type.emoji}</Text>
                        <Text style={[styles.typeDesc, { color: colors.subtext }]}>{type.description}</Text>
                    </View>
                </Pressable>
            ))}
        </ScrollView>
    );

    const renderForm = () => (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            {/* Emoji header */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={[styles.formEmojiBox, { backgroundColor: typeInfo.bgColor + '30' }]}>
                    <Text style={{ fontSize: 56 }}>{typeInfo.emoji}</Text>
                </View>
            </View>

            {/* Name field */}
            <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                    style={[styles.formInput, { color: colors.text }]}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder={selectedType === 'birthday' ? 'Name' : 'Name der Veranstaltung'}
                    placeholderTextColor={colors.subtext}
                    maxLength={100}
                />
            </View>

            {/* Date section */}
            <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {selectedType !== 'birthday' && (
                    <View style={styles.formRow}>
                        <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                            <CalendarDays size={16} color={colors.accent} />
                        </View>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Ganztägig</Text>
                        <Switch
                            value={formAllDay}
                            onValueChange={setFormAllDay}
                            trackColor={{ false: colors.border, true: colors.accent + '60' }}
                            thumbColor={formAllDay ? colors.accent : '#f4f3f4'}
                        />
                    </View>
                )}
                <Pressable style={styles.formRow} onPress={() => setShowDatePicker(true)}>
                    <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                        <CalendarDays size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.formLabel, { color: colors.text }]}>Datum</Text>
                    <Text style={[styles.formValue, { color: colors.subtext, backgroundColor: colors.background }]}>
                        {formatEventDate(formDate.toISOString().split('T')[0], true)}
                    </Text>
                </Pressable>
                {selectedType === 'birthday' && (
                    <View style={styles.formRow}>
                        <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                            <CalendarDays size={16} color={colors.accent} />
                        </View>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Jahr anzeigen</Text>
                        <Switch
                            value={formShowYear}
                            onValueChange={setFormShowYear}
                            trackColor={{ false: colors.border, true: colors.accent + '60' }}
                            thumbColor={formShowYear ? colors.accent : '#f4f3f4'}
                        />
                    </View>
                )}
            </View>

            {/* Color picker */}
            <Pressable
                style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowColorPicker(!showColorPicker)}
            >
                <View style={styles.formRow}>
                    <View style={[styles.colorDot, { backgroundColor: formColor }]} />
                    <Text style={[styles.formLabel, { color: colors.text }]}>{currentColorInfo.name}</Text>
                    <ChevronRight size={16} color={colors.subtext} />
                </View>
            </Pressable>
            {showColorPicker && (
                <View style={[styles.colorGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {COLOR_OPTIONS.map(opt => (
                        <Pressable
                            key={opt.color}
                            style={[
                                styles.colorOption,
                                { backgroundColor: opt.color },
                                formColor === opt.color && styles.colorOptionSelected,
                            ]}
                            onPress={() => { setFormColor(opt.color); setShowColorPicker(false); }}
                        >
                            {formColor === opt.color && <Check size={16} color="#fff" />}
                        </Pressable>
                    ))}
                </View>
            )}

            {/* Repeat (only for celebration) */}
            {selectedType === 'celebration' && (
                <Pressable style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.formRow}>
                        <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                            <RotateCcw size={16} color={colors.accent} />
                        </View>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Wiederholen</Text>
                        <Pressable
                            onPress={() => setFormRepeat(formRepeat === 'yearly' ? 'none' : 'yearly')}
                        >
                            <Text style={[styles.formValue, { color: colors.subtext, backgroundColor: colors.background }]}>
                                {formRepeat === 'yearly' ? 'Jährlich' : 'Nie'}
                            </Text>
                        </Pressable>
                    </View>
                </Pressable>
            )}

            {/* Reminder */}
            <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Pressable style={styles.formRow} onPress={() => setShowReminderPicker(!showReminderPicker)}>
                    <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                        <Bell size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.formLabel, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                        {currentReminderInfo.label}
                    </Text>
                    {formReminder !== 'none' && (
                        <Pressable
                            onPress={() => setFormReminder('none')}
                            hitSlop={12}
                        >
                            <X size={18} color={colors.subtext} />
                        </Pressable>
                    )}
                </Pressable>
            </View>
            {showReminderPicker && (
                <View style={[styles.reminderList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {REMINDER_OPTIONS.map(opt => (
                        <Pressable
                            key={opt.key}
                            style={[styles.reminderOption, formReminder === opt.key && { backgroundColor: colors.accent + '15' }]}
                            onPress={() => { setFormReminder(opt.key); setShowReminderPicker(false); }}
                        >
                            <Text style={[styles.reminderText, { color: formReminder === opt.key ? colors.accent : colors.text }]}>
                                {opt.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            )}

            {/* Delete button if editing */}
            {editingItem && (
                <Pressable
                    style={[styles.deleteBtn]}
                    onPress={() => { handleDelete(editingItem); setViewMode('list'); }}
                >
                    <Trash2 size={16} color="#EF4444" />
                    <Text style={styles.deleteBtnText}>Löschen</Text>
                </Pressable>
            )}
        </ScrollView>
    );

    // Date picker modal
    const renderDatePicker = () => {
        if (!showDatePicker) return null;
        if (Platform.OS === 'ios') {
            return (
                <Modal transparent animationType="fade" visible={showDatePicker}>
                    <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
                        <View style={[styles.datePickerModal, { backgroundColor: colors.card }]}>
                            <DateTimePicker
                                value={formDate}
                                mode="date"
                                display="spinner"
                                onChange={(_, date) => { if (date) setFormDate(date); }}
                                textColor={colors.text}
                            />
                            <Pressable
                                style={[styles.datePickerDone, { backgroundColor: colors.accent }]}
                                onPress={() => setShowDatePicker(false)}
                            >
                                <Text style={styles.datePickerDoneText}>Fertig</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Modal>
            );
        }
        return (
            <DateTimePicker
                value={formDate}
                mode="date"
                display="default"
                onChange={(_, date) => { if (date) setFormDate(date); setShowDatePicker(false); }}
            />
        );
    };

    const headerTitle = viewMode === 'type_picker' ? 'Neue Feiern' :
        viewMode === 'form' ? (editingItem ? typeInfo.title + ' bearbeiten' : typeInfo.title) :
            'Geburtstage & Feiern';

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.titleRow}>
                        {viewMode === 'list' ? (
                            <Cake size={24} color={colors.accent} />
                        ) : (
                            <Pressable onPress={() => {
                                if (viewMode === 'form') { setViewMode('type_picker'); resetForm(); }
                                else if (viewMode === 'type_picker') setViewMode('list');
                            }}>
                                <X size={24} color={colors.subtext} />
                            </Pressable>
                        )}
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{headerTitle}</Text>
                    </View>
                    {viewMode === 'form' ? (
                        <Pressable onPress={handleSave} disabled={isSaving}>
                            {isSaving
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Check size={24} color={colors.accent} />
                            }
                        </Pressable>
                    ) : viewMode === 'list' ? (
                        <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    ) : (
                        <View style={{ width: 24 }} />
                    )}
                </View>

                {/* Content */}
                {viewMode === 'list' && renderList()}
                {viewMode === 'type_picker' && renderTypePicker()}
                {viewMode === 'form' && renderForm()}

                {/* FAB - only in list mode */}
                {viewMode === 'list' && (
                    <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={openTypePicker}>
                        <Plus size={24} color="#fff" />
                    </Pressable>
                )}

                {renderDatePicker()}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, borderRadius: 20 },

    // List
    listContent: { padding: 16, paddingBottom: 100, gap: 10 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    fab: {
        position: 'absolute', bottom: 30, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 6, shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },

    celebrationCard: {
        flexDirection: 'row', alignItems: 'center', padding: 14,
        borderRadius: 16, borderWidth: 1, gap: 12,
    },
    celebEmoji: {
        width: 52, height: 52, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
    },
    celebName: { fontSize: 15, fontWeight: '700' },
    celebDate: { fontSize: 12, marginTop: 2 },
    celebRight: { alignItems: 'flex-end' },
    todayBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    todayBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    daysText: { fontSize: 13, fontWeight: '600' },

    // Type picker
    typePickerContent: { padding: 20, paddingBottom: 40, gap: 16 },
    typePickerTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
    typeCard: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        borderRadius: 16, borderWidth: 1, gap: 14,
    },
    typeEmoji: {
        width: 80, height: 80, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    typeTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    typeDesc: { fontSize: 13, lineHeight: 18 },

    // Form
    formContent: { padding: 16, paddingBottom: 60, gap: 12 },
    formEmojiBox: {
        width: 120, height: 120, borderRadius: 24,
        justifyContent: 'center', alignItems: 'center',
    },
    formSection: {
        borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    },
    formRow: {
        flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10,
    },
    formIcon: {
        width: 32, height: 32, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    formLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
    formValue: {
        fontSize: 14, fontWeight: '500',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    },
    formInput: {
        fontSize: 15, padding: 14,
    },

    colorDot: { width: 20, height: 20, borderRadius: 10 },
    colorGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 14,
        borderRadius: 14, borderWidth: 1,
    },
    colorOption: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
    },
    colorOptionSelected: {
        borderWidth: 3, borderColor: '#fff',
    },

    reminderList: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
    reminderOption: { padding: 14 },
    reminderText: { fontSize: 14, fontWeight: '500' },

    deleteBtn: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        gap: 8, paddingVertical: 14, marginTop: 8,
    },
    deleteBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },

    // Date picker
    datePickerOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    datePickerModal: {
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 16, paddingBottom: 40,
    },
    datePickerDone: {
        alignItems: 'center', paddingVertical: 12,
        borderRadius: 12, marginTop: 8,
    },
    datePickerDoneText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

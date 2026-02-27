import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Platform, Switch,
} from 'react-native';
import {
    X, Plus, Trash2, Target, Clock, Check, Home,
    Plane, Cake, PartyPopper, Tent, GraduationCap, Gift, Gamepad2, Music, Film, Heart, Baby, Car, Coffee, Star
} from 'lucide-react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';
import { LiveCountdown } from './LiveCountdown';

interface Countdown {
    id: string;
    household_id: string;
    title: string;
    target_date: string;
    target_time?: string | null;
    display_format?: 'days' | 'time' | 'auto';
    emoji: string;
    show_on_homescreen: boolean;
    auto_show_days?: number | null;
    created_at: string;
}

interface CountdownsProps { visible: boolean; onClose: () => void; }

export const COUNTDOWN_ICONS: Record<string, any> = {
    Star, Plane, Cake, PartyPopper, Tent, GraduationCap, Home, Gift, Gamepad2, Music, Film, Heart, Baby, Car, Coffee
};
const ICON_KEYS = Object.keys(COUNTDOWN_ICONS);

export const FamilyCountdowns: React.FC<CountdownsProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { householdId } = useHousehold();

    const [countdowns, setCountdowns] = useState<Countdown[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formDate, setFormDate] = useState(new Date());
    const [formHasTime, setFormHasTime] = useState(false);
    const [formTime, setFormTime] = useState(new Date());
    const [formDisplayFormat, setFormDisplayFormat] = useState<'days' | 'time' | 'auto'>('auto');
    const [formEmoji, setFormEmoji] = useState('Star');
    const [formShowOnHomescreen, setFormShowOnHomescreen] = useState(false);
    const [formAutoShowDays, setFormAutoShowDays] = useState<number | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const loadCountdowns = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('family_countdowns').select('*').eq('household_id', householdId).order('target_date');
            if (error) throw error;
            setCountdowns(data || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [householdId]);

    useEffect(() => { if (visible) loadCountdowns(); }, [visible, loadCountdowns]);

    const resetForm = () => {
        setFormTitle('');
        setFormDate(new Date());
        setFormHasTime(false);
        setFormTime(new Date());
        setFormDisplayFormat('auto');
        setFormEmoji('Star');
        setFormShowOnHomescreen(false);
        setFormAutoShowDays(null);
        setEditingId(null);
        setShowDatePicker(false);
        setShowTimePicker(false);
    };

    const openCreate = () => {
        resetForm();
        setShowForm(true);
    };

    const openEdit = (c: Countdown) => {
        setEditingId(c.id);
        setFormTitle(c.title);
        setFormDate(new Date(c.target_date + 'T00:00:00'));
        setFormHasTime(!!c.target_time);
        if (c.target_time) {
            const [h, m] = c.target_time.split(':');
            const d = new Date();
            d.setHours(parseInt(h), parseInt(m), 0, 0);
            setFormTime(d);
        } else {
            setFormTime(new Date());
        }
        setFormDisplayFormat(c.display_format || 'auto');
        setFormEmoji(c.emoji);
        setFormShowOnHomescreen(c.show_on_homescreen ?? false);
        setFormAutoShowDays(c.auto_show_days ?? null);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formTitle.trim() || !householdId) return;

        // Avoid timezone bugs by formatting locally
        const yyyy = formDate.getFullYear();
        const mm = String(formDate.getMonth() + 1).padStart(2, '0');
        const dd = String(formDate.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        let formattedTime = null;
        if (formHasTime) {
            const hh = String(formTime.getHours()).padStart(2, '0');
            const min = String(formTime.getMinutes()).padStart(2, '0');
            formattedTime = `${hh}:${min}`;
        }

        const payload = {
            household_id: householdId,
            title: formTitle.trim(),
            target_date: formattedDate,
            target_time: formattedTime,
            display_format: formDisplayFormat,
            emoji: formEmoji,
            show_on_homescreen: formShowOnHomescreen,
            auto_show_days: formAutoShowDays,
        };

        let error: any;
        if (editingId) {
            const res = await supabase.from('family_countdowns').update(payload).eq('id', editingId);
            error = res.error;
        } else {
            const res = await supabase.from('family_countdowns').insert(payload);
            error = res.error;
        }

        if (error) {
            Alert.alert('Fehler beim Speichern', error.message + '\n\nBitte stelle sicher, dass die SQL-Migration (supabase_migration_celebrations.sql) in Supabase ausgeführt wurde.');
            return;
        }

        resetForm();
        setShowForm(false);
        loadCountdowns();
    };

    const handleDelete = (c: Countdown) => {
        Alert.alert('Löschen', `"${c.title}" löschen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: async () => { await supabase.from('family_countdowns').delete().eq('id', c.id); loadCountdowns(); } },
        ]);
    };

    const getDaysRemaining = (dateStr: string) => {
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target.getTime() - today.getTime()) / 86400000);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    };

    const getColor = (days: number) => {
        if (days < 0) return '#6B7280';
        if (days === 0) return '#EF4444';
        if (days <= 7) return '#F59E0B';
        if (days <= 30) return '#3B82F6';
        return '#10B981';
    };

    const activeCountdowns = countdowns.filter(c => getDaysRemaining(c.target_date) >= 0);
    const pastCountdowns = countdowns.filter(c => getDaysRemaining(c.target_date) < 0);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <View style={styles.titleRow}>
                            <Target size={24} color={colors.accent} />
                            <Text style={[styles.headerTitle, { color: colors.text }]}>Countdowns</Text>
                        </View>
                        <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                        {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> :
                            countdowns.length === 0 ? (
                                <View style={styles.empty}>
                                    <Clock size={40} color={colors.subtext} />
                                    <Text style={[styles.emptyText, { color: colors.subtext }]}>Noch keine Countdowns.{'\n'}Zähle die Tage bis zum nächsten Event!</Text>
                                </View>
                            ) : (
                                <>
                                    {activeCountdowns.map(c => {
                                        const days = getDaysRemaining(c.target_date);
                                        const color = getColor(days);
                                        return (
                                            <Swipeable
                                                key={c.id}
                                                renderRightActions={() => (
                                                    <Pressable
                                                        style={styles.swipeDelete}
                                                        onPress={() => handleDelete(c)}
                                                    >
                                                        <Trash2 size={18} color="#fff" />
                                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Löschen</Text>
                                                    </Pressable>
                                                )}
                                                overshootRight={false}
                                            >
                                                <Pressable style={[styles.countdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                                    onPress={() => openEdit(c)}
                                                >
                                                    <View style={[styles.daysCircle, { backgroundColor: color + '15', borderColor: color }]}>
                                                        <LiveCountdown
                                                            targetDate={c.target_date}
                                                            targetTime={c.target_time}
                                                            displayFormat={c.display_format}
                                                            color={color}
                                                            textStyle={[styles.daysNumber, { color }]}
                                                            labelStyle={[styles.daysLabel, { color }]}
                                                        />
                                                    </View>
                                                    <View style={{ flex: 1, marginLeft: 14 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                                                {(() => { const IconC = COUNTDOWN_ICONS[c.emoji] || Star; return <IconC size={18} color={colors.text} />; })()}
                                                                <Text style={[styles.countdownTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>{c.title}</Text>
                                                            </View>
                                                            {c.show_on_homescreen && <Home size={12} color={colors.accent} />}
                                                        </View>
                                                        <Text style={[styles.countdownDate, { color: colors.subtext }]}>{formatDate(c.target_date)}</Text>
                                                        {days === 0 && <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12, marginTop: 2 }}>🎉 Heute ist es soweit!</Text>}
                                                    </View>
                                                </Pressable>
                                            </Swipeable>
                                        );
                                    })}

                                    {pastCountdowns.length > 0 && (
                                        <View style={{ marginTop: 20 }}>
                                            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Vergangen</Text>
                                            {pastCountdowns.map(c => (
                                                <Swipeable
                                                    key={c.id}
                                                    renderRightActions={() => (
                                                        <Pressable
                                                            style={styles.swipeDelete}
                                                            onPress={() => handleDelete(c)}
                                                        >
                                                            <Trash2 size={18} color="#fff" />
                                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Löschen</Text>
                                                        </Pressable>
                                                    )}
                                                    overshootRight={false}
                                                >
                                                    <Pressable style={[styles.countdownCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.6 }]}
                                                        onPress={() => openEdit(c)}
                                                    >
                                                        {(() => { const IconC = COUNTDOWN_ICONS[c.emoji] || Star; return <IconC size={24} color={colors.subtext} />; })()}
                                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                                            <Text style={[styles.countdownTitle, { color: colors.text }]}>{c.title}</Text>
                                                            <Text style={{ color: colors.subtext, fontSize: 12 }}>{formatDate(c.target_date)}</Text>
                                                        </View>
                                                    </Pressable>
                                                </Swipeable>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
                    </ScrollView>

                    {/* FAB */}
                    <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={openCreate}>
                        <Plus size={24} color="#fff" />
                    </Pressable>

                    {/* Add / Edit Modal */}
                    <Modal visible={showForm} transparent animationType="fade">
                        <View style={styles.overlay}><View style={[styles.popup, { backgroundColor: colors.card }]}>
                            <Text style={[styles.popupTitle, { color: colors.text }]}>{editingId ? 'Countdown bearbeiten' : 'Neuer Countdown'}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                {ICON_KEYS.map(k => {
                                    const IconC = COUNTDOWN_ICONS[k];
                                    const isSelected = formEmoji === k;
                                    return (
                                        <Pressable key={k} style={[styles.emojiBtn, isSelected && { backgroundColor: colors.accent + '20', borderColor: colors.accent, borderWidth: 1 }]} onPress={() => setFormEmoji(k)}>
                                            <IconC size={24} color={isSelected ? colors.accent : colors.subtext} />
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={formTitle} onChangeText={setFormTitle} placeholder="z.B. Sommerferien" placeholderTextColor={colors.subtext} />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Pressable style={[styles.dateBtn, { borderColor: colors.border, flex: 1 }]} onPress={() => setShowDatePicker(true)}>
                                    <Text style={{ color: colors.text, fontSize: 15 }}>📅 {formDate.getDate()}.{formDate.getMonth() + 1}.{formDate.getFullYear()}</Text>
                                </Pressable>
                                <Pressable style={[styles.dateBtn, { borderColor: colors.border, flex: 1, backgroundColor: !formHasTime ? colors.border + '30' : 'transparent' }]} onPress={() => {
                                    if (!formHasTime) setFormHasTime(true);
                                    setShowTimePicker(true);
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                        <Text style={{ color: formHasTime ? colors.text : colors.subtext, fontSize: 15 }}>
                                            ⏱️ {formHasTime ? `${String(formTime.getHours()).padStart(2, '0')}:${String(formTime.getMinutes()).padStart(2, '0')}` : 'Keine Zeit'}
                                        </Text>
                                        {formHasTime && (
                                            <Pressable onPress={(e) => { e.stopPropagation(); setFormHasTime(false); }} style={{ padding: 4 }}>
                                                <X size={14} color={colors.subtext} />
                                            </Pressable>
                                        )}
                                    </View>
                                </Pressable>
                            </View>

                            {/* Display Format */}
                            <View style={{ marginTop: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Clock size={16} color={colors.accent} />
                                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>Anzeigeformat</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                    {[
                                        { label: 'Automatisch', val: 'auto' },
                                        { label: 'Nur Tage', val: 'days' },
                                        { label: 'Genau (Zeit)', val: 'time' },
                                    ].map(opt => {
                                        const isSelected = formDisplayFormat === opt.val;
                                        return (
                                            <Pressable
                                                key={opt.val}
                                                style={{
                                                    paddingHorizontal: 12, paddingVertical: 8,
                                                    borderRadius: 20, borderWidth: 1,
                                                    borderColor: isSelected ? colors.accent : colors.border,
                                                    backgroundColor: isSelected ? colors.accent + '20' : 'transparent'
                                                }}
                                                onPress={() => setFormDisplayFormat(opt.val as any)}
                                            >
                                                <Text style={{ color: isSelected ? colors.accent : colors.subtext, fontSize: 13, fontWeight: isSelected ? '600' : '400' }}>
                                                    {opt.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Show on homescreen toggle */}
                            <View style={{ marginTop: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Home size={16} color={colors.accent} />
                                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>Anzeige auf Homescreen</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                    {[
                                        { label: 'Nie', show: false, auto: null },
                                        { label: 'Sofort', show: true, auto: null },
                                        { label: '90 Tage vorher', show: false, auto: 90 },
                                        { label: '60 Tage vorher', show: false, auto: 60 },
                                        { label: '30 Tage vorher', show: false, auto: 30 },
                                        { label: '14 Tage vorher', show: false, auto: 14 },
                                        { label: '10 Tage vorher', show: false, auto: 10 },
                                        { label: '7 Tage vorher', show: false, auto: 7 },
                                        { label: '5 Tage vorher', show: false, auto: 5 },
                                        { label: '1 Tag vorher', show: false, auto: 1 },
                                    ].map(opt => {
                                        const isSelected = formShowOnHomescreen === opt.show && formAutoShowDays === opt.auto;
                                        return (
                                            <Pressable
                                                key={opt.label}
                                                style={{
                                                    paddingHorizontal: 12, paddingVertical: 8,
                                                    borderRadius: 20, borderWidth: 1,
                                                    borderColor: isSelected ? colors.accent : colors.border,
                                                    backgroundColor: isSelected ? colors.accent + '20' : 'transparent'
                                                }}
                                                onPress={() => {
                                                    setFormShowOnHomescreen(opt.show);
                                                    setFormAutoShowDays(opt.auto);
                                                }}
                                            >
                                                <Text style={{ color: isSelected ? colors.accent : colors.subtext, fontSize: 13, fontWeight: isSelected ? '600' : '400' }}>
                                                    {opt.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                                <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => { setShowForm(false); resetForm(); }}><Text style={{ color: colors.subtext }}>Abbrechen</Text></Pressable>
                                <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSave}><Text style={{ color: '#fff', fontWeight: '700' }}>{editingId ? 'Speichern' : 'Erstellen'}</Text></Pressable>
                            </View>

                            {editingId && (
                                <Pressable style={styles.deleteRow} onPress={() => {
                                    const cd = countdowns.find(c => c.id === editingId);
                                    if (cd) { setShowForm(false); resetForm(); handleDelete(cd); }
                                }}>
                                    <Trash2 size={14} color="#EF4444" />
                                    <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>Löschen</Text>
                                </Pressable>
                            )}

                            {showDatePicker && (
                                <DateTimePicker value={formDate} mode="date" locale="de" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(_, date) => { if (Platform.OS === 'android') setShowDatePicker(false); if (date) setFormDate(date); }} />
                            )}
                            {showDatePicker && Platform.OS === 'ios' && (
                                <Pressable style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setShowDatePicker(false)}>
                                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Datum bestätigen</Text>
                                </Pressable>
                            )}

                            {showTimePicker && (
                                <DateTimePicker value={formTime} mode="time" locale="de" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(_, time) => { if (Platform.OS === 'android') setShowTimePicker(false); if (time) setFormTime(time); }} />
                            )}
                            {showTimePicker && Platform.OS === 'ios' && (
                                <Pressable style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setShowTimePicker(false)}>
                                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Zeit bestätigen</Text>
                                </Pressable>
                            )}
                        </View></View>
                    </Modal>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, borderRadius: 20 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    countdownCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    daysCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    daysNumber: { fontSize: 22, fontWeight: '900' },
    daysLabel: { fontSize: 9, fontWeight: '700', marginTop: -2 },
    countdownTitle: { fontSize: 16, fontWeight: '700' },
    countdownDate: { fontSize: 12, marginTop: 2 },
    sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
    swipeDelete: {
        backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
        width: 70, borderRadius: 16, marginBottom: 8, marginLeft: 8, gap: 4,
    },
    fab: {
        position: 'absolute', bottom: 30, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 6, shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    popup: { borderRadius: 20, padding: 20 },
    popupTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    dateBtn: { borderWidth: 1, padding: 12, borderRadius: 12, marginTop: 10 },
    emojiBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
    homescreenRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
    homescreenLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
    deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8 },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Platform,
} from 'react-native';
import { X, Plus, Trash2, Clock } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface Countdown {
    id: string;
    household_id: string;
    title: string;
    target_date: string;
    emoji: string;
    created_at: string;
}

interface CountdownsProps { visible: boolean; onClose: () => void; }

const EMOJI_OPTIONS = ['🎉', '🏖️', '🎂', '🎄', '✈️', '🎓', '🏕️', '⚽', '🎃', '🐣', '💍', '🏔️'];

export const FamilyCountdowns: React.FC<CountdownsProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { householdId } = useHousehold();

    const [countdowns, setCountdowns] = useState<Countdown[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formDate, setFormDate] = useState(new Date());
    const [formEmoji, setFormEmoji] = useState('🎉');
    const [showDatePicker, setShowDatePicker] = useState(false);

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

    const handleAdd = async () => {
        if (!formTitle.trim() || !householdId) return;
        await supabase.from('family_countdowns').insert({
            household_id: householdId, title: formTitle.trim(),
            target_date: formDate.toISOString().split('T')[0], emoji: formEmoji,
        });
        setFormTitle(''); setFormDate(new Date()); setShowAdd(false); loadCountdowns();
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
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Countdowns</Text>
                    <Pressable onPress={() => setShowAdd(true)}><Plus size={24} color={colors.accent} /></Pressable>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
                                        <View key={c.id} style={[styles.countdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                            <View style={[styles.daysCircle, { backgroundColor: color + '15', borderColor: color }]}>
                                                <Text style={[styles.daysNumber, { color }]}>{days}</Text>
                                                <Text style={[styles.daysLabel, { color }]}>{days === 1 ? 'Tag' : 'Tage'}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 14 }}>
                                                <Text style={[styles.countdownTitle, { color: colors.text }]}>{c.emoji} {c.title}</Text>
                                                <Text style={[styles.countdownDate, { color: colors.subtext }]}>{formatDate(c.target_date)}</Text>
                                                {days === 0 && <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12, marginTop: 2 }}>🎉 Heute ist es soweit!</Text>}
                                            </View>
                                            <Pressable onPress={() => handleDelete(c)} hitSlop={8}><Trash2 size={14} color={colors.subtext} /></Pressable>
                                        </View>
                                    );
                                })}

                                {pastCountdowns.length > 0 && (
                                    <View style={{ marginTop: 20 }}>
                                        <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Vergangen</Text>
                                        {pastCountdowns.map(c => (
                                            <View key={c.id} style={[styles.countdownCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.6 }]}>
                                                <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                                                <View style={{ flex: 1, marginLeft: 10 }}>
                                                    <Text style={[styles.countdownTitle, { color: colors.text }]}>{c.title}</Text>
                                                    <Text style={{ color: colors.subtext, fontSize: 12 }}>{formatDate(c.target_date)}</Text>
                                                </View>
                                                <Pressable onPress={() => handleDelete(c)} hitSlop={8}><Trash2 size={14} color={colors.subtext} /></Pressable>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </>
                        )}
                </ScrollView>

                {/* Add Modal */}
                <Modal visible={showAdd} transparent animationType="fade">
                    <View style={styles.overlay}><View style={[styles.popup, { backgroundColor: colors.card }]}>
                        <Text style={[styles.popupTitle, { color: colors.text }]}>Neuer Countdown</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <Pressable key={e} style={[styles.emojiBtn, formEmoji === e && { backgroundColor: colors.accent + '20' }]} onPress={() => setFormEmoji(e)}>
                                    <Text style={{ fontSize: 20 }}>{e}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={formTitle} onChangeText={setFormTitle} placeholder="z.B. Sommerferien" placeholderTextColor={colors.subtext} />
                        <Pressable style={[styles.dateBtn, { borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
                            <Text style={{ color: colors.text, fontSize: 15 }}>📅 {formDate.getDate()}.{formDate.getMonth() + 1}.{formDate.getFullYear()}</Text>
                        </Pressable>
                        {showDatePicker && (
                            <DateTimePicker value={formDate} mode="date" locale="de" display={Platform.OS === 'ios' ? 'spinner' : 'default'} minimumDate={new Date()}
                                onChange={(_, date) => { if (Platform.OS === 'android') setShowDatePicker(false); if (date) setFormDate(date); }} />
                        )}
                        {showDatePicker && Platform.OS === 'ios' && (
                            <Pressable style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setShowDatePicker(false)}>
                                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Datum bestätigen</Text>
                            </Pressable>
                        )}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                            <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowAdd(false)}><Text style={{ color: colors.subtext }}>Abbrechen</Text></Pressable>
                            <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleAdd}><Text style={{ color: '#fff', fontWeight: '700' }}>Erstellen</Text></Pressable>
                        </View>
                    </View></View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    countdownCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    daysCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    daysNumber: { fontSize: 22, fontWeight: '900' },
    daysLabel: { fontSize: 9, fontWeight: '700', marginTop: -2 },
    countdownTitle: { fontSize: 16, fontWeight: '700' },
    countdownDate: { fontSize: 12, marginTop: 2 },
    sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    popup: { borderRadius: 20, padding: 20 },
    popupTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    dateBtn: { borderWidth: 1, padding: 12, borderRadius: 12, marginTop: 10 },
    emojiBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal,
} from 'react-native';
import {
    X, Plus, Trash2, Check, ChevronLeft, Luggage, CheckCircle2, Circle, Copy,
} from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface PackingList {
    id: string;
    household_id: string;
    title: string;
    emoji: string;
    items: string[];
    checked_items: boolean[];
    created_at: string;
}

const TEMPLATES = [
    { title: 'Sommerferien ☀️', emoji: '🏖️', items: ['Sonnencreme', 'Badehose/Bikini', 'Sonnenbrille', 'Flip-Flops', 'Handtücher', 'Reisepass', 'Ladekabel', 'Medikamente'] },
    { title: 'Skiferien ⛷️', emoji: '🎿', items: ['Skipass', 'Skiausrüstung', 'Warme Kleidung', 'Handschuhe', 'Mütze', 'Sonnencreme', 'Thermosflasche'] },
    { title: 'Wochenendausflug', emoji: '🧳', items: ['Wechselkleidung', 'Zahnbürste', 'Snacks', 'Wasserflasche', 'Erste-Hilfe-Set', 'Regenschirm'] },
];

interface PackingListsProps { visible: boolean; onClose: () => void; }

export const FamilyPackingLists: React.FC<PackingListsProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { householdId } = useHousehold();

    const [lists, setLists] = useState<PackingList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeList, setActiveList] = useState<PackingList | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formEmoji, setFormEmoji] = useState('🧳');
    const [newItem, setNewItem] = useState('');

    const EMOJI_OPTIONS = ['🧳', '🏖️', '🎿', '⛺', '🏕️', '✈️', '🚗', '🎒', '🏔️', '🚢'];

    const loadLists = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('packing_lists').select('*').eq('household_id', householdId).order('created_at', { ascending: false });
            if (error) throw error;
            setLists(data || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [householdId]);

    useEffect(() => { if (visible) loadLists(); }, [visible, loadLists]);

    const createList = async (title?: string, emoji?: string, items?: string[]) => {
        if (!householdId) return;
        const t = title || formTitle.trim();
        if (!t) return;
        const e = emoji || formEmoji;
        const i = items || [];
        await supabase.from('packing_lists').insert({
            household_id: householdId, title: t, emoji: e,
            items: i, checked_items: new Array(i.length).fill(false),
        });
        setFormTitle(''); setShowAdd(false); loadLists();
    };

    const addItem = async () => {
        if (!activeList || !newItem.trim()) return;
        const updatedItems = [...activeList.items, newItem.trim()];
        const updatedChecked = [...activeList.checked_items, false];
        await supabase.from('packing_lists').update({ items: updatedItems, checked_items: updatedChecked }).eq('id', activeList.id);
        setActiveList({ ...activeList, items: updatedItems, checked_items: updatedChecked });
        setNewItem('');
    };

    const toggleItem = async (idx: number) => {
        if (!activeList) return;
        const updatedChecked = [...activeList.checked_items];
        updatedChecked[idx] = !updatedChecked[idx];
        await supabase.from('packing_lists').update({ checked_items: updatedChecked }).eq('id', activeList.id);
        setActiveList({ ...activeList, checked_items: updatedChecked });
    };

    const removeItem = async (idx: number) => {
        if (!activeList) return;
        const updatedItems = activeList.items.filter((_, i) => i !== idx);
        const updatedChecked = activeList.checked_items.filter((_, i) => i !== idx);
        await supabase.from('packing_lists').update({ items: updatedItems, checked_items: updatedChecked }).eq('id', activeList.id);
        setActiveList({ ...activeList, items: updatedItems, checked_items: updatedChecked });
    };

    const resetChecks = async () => {
        if (!activeList) return;
        const updatedChecked = new Array(activeList.items.length).fill(false);
        await supabase.from('packing_lists').update({ checked_items: updatedChecked }).eq('id', activeList.id);
        setActiveList({ ...activeList, checked_items: updatedChecked });
    };

    const deleteList = (list: PackingList) => {
        Alert.alert('Löschen', `"${list.title}" löschen ? `, [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: async () => { await supabase.from('packing_lists').delete().eq('id', list.id); setActiveList(null); loadLists(); } },
        ]);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.titleRow}>
                        {activeList ? (
                            <Pressable onPress={() => { setActiveList(null); loadLists(); }}>
                                <ChevronLeft size={24} color={colors.accent} />
                            </Pressable>
                        ) : (
                            <Luggage size={24} color={colors.accent} />
                        )}
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{activeList ? activeList.title : 'Packlisten'}</Text>
                    </View>
                    {activeList ? (
                        <Pressable onPress={resetChecks}><Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Reset</Text></Pressable>
                    ) : (
                        <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    )}
                </View>

                {activeList ? (
                    /* Detail View */
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                        <View style={[styles.addItemRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                            <TextInput style={[styles.addItemInput, { color: colors.text }]} value={newItem} onChangeText={setNewItem} placeholder="Artikel hinzufügen..." placeholderTextColor={colors.subtext} onSubmitEditing={addItem} returnKeyType="done" />
                            <Pressable onPress={addItem} style={[styles.addItemBtn, { backgroundColor: colors.accent, opacity: newItem.trim() ? 1 : 0.4 }]}>
                                <Plus size={16} color="#fff" />
                            </Pressable>
                        </View>
                        <Text style={[styles.progress, { color: colors.subtext }]}>
                            {activeList.checked_items.filter(Boolean).length} / {activeList.items.length} eingepackt
                        </Text>
                        {activeList.items.map((item, idx) => (
                            <Pressable key={idx} style={[styles.itemRow, { borderColor: colors.border }]} onPress={() => toggleItem(idx)}>
                                {activeList.checked_items[idx] ? <CheckCircle2 size={20} color="#10B981" fill="#10B98130" /> : <Circle size={20} color={colors.subtext} />}
                                <Text style={[styles.itemText, { color: activeList.checked_items[idx] ? colors.subtext : colors.text }, activeList.checked_items[idx] && styles.itemDone]}>{item}</Text>
                                <Pressable onPress={() => removeItem(idx)} hitSlop={8}><Trash2 size={13} color={colors.subtext} /></Pressable>
                            </Pressable>
                        ))}
                    </ScrollView>
                ) : (
                    /* List Overview */
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                        {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> : (
                            <>
                                {lists.map(list => {
                                    const done = list.checked_items.filter(Boolean).length;
                                    return (
                                        <Pressable key={list.id} style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setActiveList(list)}>
                                            <Text style={{ fontSize: 28 }}>{list.emoji}</Text>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={[styles.listTitle, { color: colors.text }]}>{list.title}</Text>
                                                <Text style={{ color: colors.subtext, fontSize: 12 }}>{done}/{list.items.length} eingepackt</Text>
                                            </View>
                                            <Pressable onPress={() => deleteList(list)} hitSlop={8}><Trash2 size={14} color={colors.subtext} /></Pressable>
                                        </Pressable>
                                    );
                                })}

                                <Text style={[styles.sectionTitle, { color: colors.subtext, marginTop: 20 }]}>Vorlagen</Text>
                                {TEMPLATES.map((t, i) => (
                                    <Pressable key={i} style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => createList(t.title, t.emoji, t.items)}>
                                        <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.listTitle, { color: colors.text }]}>{t.title}</Text>
                                            <Text style={{ color: colors.subtext, fontSize: 11 }}>{t.items.length} Artikel</Text>
                                        </View>
                                        <Copy size={16} color={colors.accent} />
                                    </Pressable>
                                ))}
                            </>
                        )}
                    </ScrollView>
                )}

                {/* FAB - only on list overview */}
                {!activeList && (
                    <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={() => setShowAdd(true)}>
                        <Plus size={24} color="#fff" />
                    </Pressable>
                )}

                {/* Create Modal */}
                <Modal visible={showAdd} transparent animationType="fade">
                    <View style={styles.overlay}><View style={[styles.popup, { backgroundColor: colors.card }]}>
                        <Text style={[styles.popupTitle, { color: colors.text }]}>Neue Packliste</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <Pressable key={e} style={[styles.emojiBtn, formEmoji === e && { backgroundColor: colors.accent + '20' }]} onPress={() => setFormEmoji(e)}>
                                    <Text style={{ fontSize: 20 }}>{e}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={formTitle} onChangeText={setFormTitle} placeholder="z.B. Sommerferien 2026" placeholderTextColor={colors.subtext} />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                            <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowAdd(false)}><Text style={{ color: colors.subtext }}>Abbrechen</Text></Pressable>
                            <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={() => createList()}><Text style={{ color: '#fff', fontWeight: '700' }}>Erstellen</Text></Pressable>
                        </View>
                    </View></View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, borderRadius: 20 },
    progress: { fontSize: 13, fontWeight: '600', marginVertical: 10 },
    addItemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingLeft: 14, paddingRight: 4, paddingVertical: 4 },
    addItemInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
    addItemBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5 },
    itemText: { flex: 1, fontSize: 15 },
    itemDone: { textDecorationLine: 'line-through' },
    listCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    listTitle: { fontSize: 15, fontWeight: '700' },
    sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
    templateCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 6 },
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
    emojiBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
});

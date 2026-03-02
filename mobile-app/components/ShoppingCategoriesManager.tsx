import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Tag, Pencil } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

export interface ShoppingCategory {
    id: string;
    household_id: string;
    name: string;
    color: string;
    icon: string;
    sort_order: number;
}

const COLOR_PRESETS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#6B7280'];

const DEFAULT_CATEGORIES = [
    { name: 'Gemüse & Obst', color: '#10B981', icon: '🥦' },
    { name: 'Milchprodukte', color: '#3B82F6', icon: '🧀' },
    { name: 'Fleisch & Fisch', color: '#EF4444', icon: '🥩' },
    { name: 'Getränke', color: '#14B8A6', icon: '🥤' },
    { name: 'Backwaren', color: '#F59E0B', icon: '🍞' },
    { name: 'Tiefkühl', color: '#6366F1', icon: '🧊' },
    { name: 'Haushalt', color: '#8B5CF6', icon: '🧹' },
    { name: 'Snacks & Süsses', color: '#EC4899', icon: '🍫' },
    { name: 'Gewürze & Saucen', color: '#F97316', icon: '🧂' },
    { name: 'Sonstiges', color: '#6B7280', icon: '📦' },
];

interface Props {
    visible: boolean;
    onClose: () => void;
    householdId: string;
    categories: ShoppingCategory[];
    onCategoriesChanged: () => void;
}

export default function ShoppingCategoriesManager({ visible, onClose, householdId, categories, onCategoriesChanged }: Props) {
    const { colors } = useTheme();
    const [editingCategory, setEditingCategory] = useState<ShoppingCategory | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState(COLOR_PRESETS[0]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);

    const saveCategory = async () => {
        if (!editingCategory || !editName.trim()) return;
        try {
            await supabase
                .from('shopping_categories')
                .update({ name: editName.trim(), color: editColor })
                .eq('id', editingCategory.id);
            setEditingCategory(null);
            onCategoriesChanged();
        } catch (e) {
            console.warn('Failed to update category:', e);
        }
    };

    const addCategory = async () => {
        if (!newName.trim()) return;
        try {
            const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
            await supabase
                .from('shopping_categories')
                .insert({
                    household_id: householdId,
                    name: newName.trim(),
                    color: newColor,
                    icon: '📦',
                    sort_order: maxOrder,
                });
            setNewName('');
            setShowAddForm(false);
            onCategoriesChanged();
        } catch (e) {
            console.warn('Failed to add category:', e);
        }
    };

    const deleteCategory = (cat: ShoppingCategory) => {
        Alert.alert('Kategorie löschen?', `"${cat.name}" wird gelöscht. Produkte behalten ihre Daten, verlieren aber die Zuordnung.`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen', style: 'destructive', onPress: async () => {
                    await supabase.from('shopping_categories').delete().eq('id', cat.id);
                    onCategoriesChanged();
                }
            },
        ]);
    };

    const moveCategory = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === categories.length - 1) return;
        const swapIdx = direction === 'up' ? index - 1 : index + 1;
        const a = categories[index];
        const b = categories[swapIdx];
        try {
            await Promise.all([
                supabase.from('shopping_categories').update({ sort_order: b.sort_order }).eq('id', a.id),
                supabase.from('shopping_categories').update({ sort_order: a.sort_order }).eq('id', b.id),
            ]);
            onCategoriesChanged();
        } catch (e) {
            console.warn('Failed to reorder:', e);
        }
    };

    const initDefaults = async () => {
        Alert.alert('Standard-Kategorien laden?', 'Dies fügt die Standard-Kategorien hinzu.', [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Laden', onPress: async () => {
                    const inserts = DEFAULT_CATEGORIES.map((c, i) => ({
                        household_id: householdId,
                        name: c.name,
                        color: c.color,
                        icon: c.icon,
                        sort_order: i,
                    }));
                    await supabase.from('shopping_categories').insert(inserts);
                    onCategoriesChanged();
                }
            },
        ]);
    };

    // Edit form
    if (editingCategory) {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingCategory(null)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={[s.header, { borderBottomColor: colors.border }]}>
                        <Text style={[s.title, { color: colors.text }]}>Kategorie bearbeiten</Text>
                        <Pressable onPress={() => setEditingCategory(null)} style={{ padding: 8 }}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>
                    <ScrollView style={{ flex: 1, padding: 16 }}>
                        <Text style={[s.label, { color: colors.subtext }]}>NAME</Text>
                        <TextInput
                            value={editName}
                            onChangeText={setEditName}
                            style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                            placeholder="Kategoriename"
                            placeholderTextColor={colors.subtext}
                        />
                        <Text style={[s.label, { color: colors.subtext, marginTop: 16 }]}>FARBE</Text>
                        <View style={s.colorRow}>
                            {COLOR_PRESETS.map(c => (
                                <Pressable key={c} onPress={() => setEditColor(c)}
                                    style={[s.colorDot, { backgroundColor: c, borderWidth: editColor === c ? 3 : 0, borderColor: '#FFF' }]} />
                            ))}
                        </View>
                        <Pressable onPress={saveCategory} style={[s.saveBtn, { backgroundColor: colors.accent }]}>
                            <Text style={s.saveBtnText}>Speichern</Text>
                        </Pressable>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={[s.header, { borderBottomColor: colors.border }]}>
                    <Text style={[s.title, { color: colors.text }]}>Kategorien</Text>
                    <Pressable onPress={onClose} style={{ padding: 8 }}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={{ flex: 1, padding: 16 }}>
                    {categories.length === 0 && (
                        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                            <Tag size={48} color={colors.subtext} />
                            <Text style={{ color: colors.subtext, marginTop: 12, fontSize: 15 }}>Keine Kategorien vorhanden</Text>
                            <Pressable onPress={initDefaults} style={[s.defaultsBtn, { backgroundColor: colors.accent }]}>
                                <Text style={{ color: '#FFF', fontWeight: '600' }}>Standard-Kategorien laden</Text>
                            </Pressable>
                        </View>
                    )}

                    {categories.map((cat, index) => (
                        <View key={cat.id} style={[s.catRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={{ flexDirection: 'column', alignItems: 'center', marginRight: 8 }}>
                                <Pressable onPress={() => moveCategory(index, 'up')} style={{ padding: 4, opacity: index === 0 ? 0.2 : 1 }}>
                                    <ChevronUp size={18} color={colors.subtext} />
                                </Pressable>
                                <Pressable onPress={() => moveCategory(index, 'down')} style={{ padding: 4, opacity: index === categories.length - 1 ? 0.2 : 1 }}>
                                    <ChevronDown size={18} color={colors.subtext} />
                                </Pressable>
                            </View>
                            <Text style={{ fontSize: 20, marginRight: 10 }}>{(!cat.icon || cat.icon === 'tag') ? '📦' : cat.icon}</Text>
                            <Text style={[s.catName, { color: colors.text }]} numberOfLines={1}>{cat.name}</Text>
                            <Pressable onPress={() => { setEditingCategory(cat); setEditName(cat.name); setEditColor(cat.color); }} style={{ padding: 8 }}>
                                <Pencil size={16} color={colors.subtext} />
                            </Pressable>
                            <Pressable onPress={() => deleteCategory(cat)} style={{ padding: 8 }}>
                                <Trash2 size={16} color={colors.error || '#EF4444'} />
                            </Pressable>
                        </View>
                    ))}

                    {/* Add Form */}
                    {showAddForm ? (
                        <View style={[s.addForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <TextInput
                                value={newName}
                                onChangeText={setNewName}
                                placeholder="Neuer Kategoriename"
                                placeholderTextColor={colors.subtext}
                                style={[s.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                autoFocus
                                onSubmitEditing={addCategory}
                            />
                            <View style={s.colorRow}>
                                {COLOR_PRESETS.map(c => (
                                    <Pressable key={c} onPress={() => setNewColor(c)}
                                        style={[s.colorDot, { backgroundColor: c, borderWidth: newColor === c ? 3 : 0, borderColor: '#FFF' }]} />
                                ))}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                <Pressable onPress={() => setShowAddForm(false)} style={[s.formBtn, { backgroundColor: colors.background }]}>
                                    <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                                </Pressable>
                                <Pressable onPress={addCategory} style={[s.formBtn, { backgroundColor: colors.accent }]}>
                                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Hinzufügen</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <Pressable onPress={() => setShowAddForm(true)}
                            style={[s.addBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]}>
                            <Plus size={18} color={colors.accent} />
                            <Text style={{ color: colors.accent, fontWeight: '600', marginLeft: 6 }}>Neue Kategorie</Text>
                        </Pressable>
                    )}

                    {categories.length > 0 && (
                        <Pressable onPress={initDefaults} style={{ alignItems: 'center', padding: 14, marginTop: 8, marginBottom: 40 }}>
                            <Text style={{ color: colors.subtext, fontSize: 13 }}>Standard-Kategorien hinzufügen</Text>
                        </Pressable>
                    )}
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    title: { fontSize: 20, fontWeight: '700' },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
    input: { borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1 },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    saveBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    catRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
    catDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    catName: { flex: 1, fontSize: 15, fontWeight: '600' },
    addForm: { borderRadius: 12, padding: 16, marginTop: 12, borderWidth: 1 },
    formBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginTop: 12, borderWidth: 1 },
    defaultsBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Tag, Pencil, Store, ArrowLeft, Star } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ShoppingCategory {
    id: string;
    household_id: string;
    name: string;
    color: string;
    icon: string;
    sort_order: number;
}

export interface ShoppingStore {
    name: string;
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

const DEFAULT_STORE_KEY = (householdId: string) => `@smarthome_default_store_${householdId}`;

// ── Store Category Order Screen ───────────────────────────────────
function StoreOrderScreen({ storeName, householdId, categories, onBack }: {
    storeName: string;
    householdId: string;
    categories: ShoppingCategory[];
    onBack: () => void;
}) {
    const { colors } = useTheme();
    // ordered list of category ids for this store
    const [orderedIds, setOrderedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const loadOrder = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('shopping_store_category_orders')
                .select('category_id, sort_order')
                .eq('household_id', householdId)
                .eq('store_name', storeName)
                .order('sort_order', { ascending: true });

            if (data && data.length > 0) {
                // Build ordered list, then append any categories not yet in the store order
                const existingIds = data.map((r: any) => r.category_id);
                const remaining = categories.map(c => c.id).filter(id => !existingIds.includes(id));
                setOrderedIds([...existingIds, ...remaining]);
            } else {
                // No store order yet – use global category order
                setOrderedIds(categories.map(c => c.id));
            }
        } catch (e) {
            console.warn('Failed to load store order:', e);
            setOrderedIds(categories.map(c => c.id));
        } finally {
            setLoading(false);
        }
    }, [householdId, storeName, categories]);

    useEffect(() => { loadOrder(); }, [loadOrder]);

    const move = (index: number, dir: 'up' | 'down') => {
        if (dir === 'up' && index === 0) return;
        if (dir === 'down' && index === orderedIds.length - 1) return;
        const next = [...orderedIds];
        const swapIdx = dir === 'up' ? index - 1 : index + 1;
        [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
        setOrderedIds(next);
    };

    const save = async () => {
        try {
            // Delete existing order for this store
            await supabase
                .from('shopping_store_category_orders')
                .delete()
                .eq('household_id', householdId)
                .eq('store_name', storeName);

            // Insert new order
            const inserts = orderedIds.map((catId, idx) => ({
                household_id: householdId,
                store_name: storeName,
                category_id: catId,
                sort_order: idx,
            }));
            if (inserts.length > 0) {
                await supabase.from('shopping_store_category_orders').insert(inserts);
            }
            Alert.alert('✅ Gespeichert', `Reihenfolge für "${storeName}" wurde gespeichert.`);
            onBack();
        } catch (e) {
            console.warn('Failed to save store order:', e);
            Alert.alert('Fehler', 'Reihenfolge konnte nicht gespeichert werden.');
        }
    };

    const catById = (id: string) => categories.find(c => c.id === id);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[s.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={onBack} style={{ padding: 8 }}>
                    <ArrowLeft size={24} color={colors.text} />
                </Pressable>
                <Text style={[s.title, { color: colors.text, flex: 1, marginLeft: 8 }]} numberOfLines={1}>
                    {storeName}
                </Text>
                <Pressable onPress={save} style={[s.saveSmallBtn, { backgroundColor: colors.accent }]}>
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Speichern</Text>
                </Pressable>
            </View>
            <Text style={{ color: colors.subtext, fontSize: 13, padding: 16, paddingBottom: 8 }}>
                Sortiere die Kategorien in der Reihenfolge, in der die Produkte in diesem Laden liegen.
            </Text>
            <ScrollView style={{ flex: 1, padding: 16 }}>
                {loading ? (
                    <Text style={{ color: colors.subtext, textAlign: 'center', paddingTop: 40 }}>Laden...</Text>
                ) : (
                    orderedIds.map((catId, index) => {
                        const cat = catById(catId);
                        if (!cat) return null;
                        return (
                            <View key={catId} style={[s.catRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={{ flexDirection: 'column', alignItems: 'center', marginRight: 8 }}>
                                    <Pressable onPress={() => move(index, 'up')} style={{ padding: 4, opacity: index === 0 ? 0.2 : 1 }}>
                                        <ChevronUp size={18} color={colors.subtext} />
                                    </Pressable>
                                    <Pressable onPress={() => move(index, 'down')} style={{ padding: 4, opacity: index === orderedIds.length - 1 ? 0.2 : 1 }}>
                                        <ChevronDown size={18} color={colors.subtext} />
                                    </Pressable>
                                </View>
                                <Text style={{ fontSize: 20, marginRight: 10 }}>{(!cat.icon || cat.icon === 'tag') ? '📦' : cat.icon}</Text>
                                <View style={[s.catDot, { backgroundColor: cat.color }]} />
                                <Text style={[s.catName, { color: colors.text }]} numberOfLines={1}>{cat.name}</Text>
                                <Text style={{ color: colors.subtext, fontSize: 13, marginLeft: 8 }}>#{index + 1}</Text>
                            </View>
                        );
                    })
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Main Component ────────────────────────────────────────────────
export default function ShoppingCategoriesManager({ visible, onClose, householdId, categories, onCategoriesChanged }: Props) {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState<'categories' | 'stores'>('categories');
    const [editingCategory, setEditingCategory] = useState<ShoppingCategory | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState(COLOR_PRESETS[0]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);

    // Stores state
    const [stores, setStores] = useState<string[]>([]);
    const [defaultStore, setDefaultStore] = useState<string | null>(null);
    const [editingStore, setEditingStore] = useState<string | null>(null);
    const [showAddStoreForm, setShowAddStoreForm] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');

    const loadStores = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('shopping_store_category_orders')
                .select('store_name')
                .eq('household_id', householdId);
            if (data) {
                const unique = [...new Set(data.map((r: any) => r.store_name as string))].sort();
                setStores(unique);
            }
            // Load default store
            const saved = await AsyncStorage.getItem(DEFAULT_STORE_KEY(householdId));
            setDefaultStore(saved);
        } catch (e) {
            console.warn('Failed to load stores:', e);
        }
    }, [householdId]);

    const setAsDefault = async (name: string) => {
        const newDefault = defaultStore === name ? null : name;
        setDefaultStore(newDefault);
        if (newDefault) {
            await AsyncStorage.setItem(DEFAULT_STORE_KEY(householdId), newDefault);
        } else {
            await AsyncStorage.removeItem(DEFAULT_STORE_KEY(householdId));
        }
    };

    useEffect(() => {
        if (visible) loadStores();
    }, [visible, loadStores]);

    // ── Category actions ──
    const saveCategory = async () => {
        if (!editingCategory || !editName.trim()) return;
        try {
            await supabase.from('shopping_categories').update({ name: editName.trim(), color: editColor }).eq('id', editingCategory.id);
            setEditingCategory(null);
            onCategoriesChanged();
        } catch (e) { console.warn('Failed to update category:', e); }
    };

    const addCategory = async () => {
        if (!newName.trim()) return;
        try {
            const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
            await supabase.from('shopping_categories').insert({
                household_id: householdId, name: newName.trim(), color: newColor, icon: '📦', sort_order: maxOrder,
            });
            setNewName(''); setShowAddForm(false);
            onCategoriesChanged();
        } catch (e) { console.warn('Failed to add category:', e); }
    };

    const deleteCategory = (cat: ShoppingCategory) => {
        Alert.alert('Kategorie löschen?', `"${cat.name}" wird gelöscht.`, [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: async () => { await supabase.from('shopping_categories').delete().eq('id', cat.id); onCategoriesChanged(); } },
        ]);
    };

    const moveCategory = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === categories.length - 1) return;
        const swapIdx = direction === 'up' ? index - 1 : index + 1;
        const a = categories[index]; const b = categories[swapIdx];
        try {
            await Promise.all([
                supabase.from('shopping_categories').update({ sort_order: b.sort_order }).eq('id', a.id),
                supabase.from('shopping_categories').update({ sort_order: a.sort_order }).eq('id', b.id),
            ]);
            onCategoriesChanged();
        } catch (e) { console.warn('Failed to reorder:', e); }
    };

    const initDefaults = async () => {
        Alert.alert('Standard-Kategorien laden?', 'Dies fügt die Standard-Kategorien hinzu.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Laden', onPress: async () => {
                const inserts = DEFAULT_CATEGORIES.map((c, i) => ({ household_id: householdId, name: c.name, color: c.color, icon: c.icon, sort_order: i }));
                await supabase.from('shopping_categories').insert(inserts);
                onCategoriesChanged();
            }},
        ]);
    };

    // ── Store actions ──
    const addStore = async () => {
        const name = newStoreName.trim();
        if (!name) return;
        if (stores.includes(name)) { Alert.alert('Hinweis', 'Dieser Laden existiert bereits.'); return; }
        try {
            // Create initial order entries for this store (global order)
            const inserts = categories.map((cat, idx) => ({
                household_id: householdId, store_name: name, category_id: cat.id, sort_order: idx,
            }));
            if (inserts.length > 0) await supabase.from('shopping_store_category_orders').insert(inserts);
            setNewStoreName(''); setShowAddStoreForm(false);
            loadStores();
        } catch (e) { console.warn('Failed to add store:', e); Alert.alert('Fehler', 'Laden konnte nicht hinzugefügt werden. Bitte zuerst die Datenbanktabelle anlegen.'); }
    };

    const deleteStore = (name: string) => {
        Alert.alert('Laden löschen?', `"${name}" und alle zugehörigen Reihenfolgen werden gelöscht.`, [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: async () => {
                await supabase.from('shopping_store_category_orders').delete().eq('household_id', householdId).eq('store_name', name);
                loadStores();
            }},
        ]);
    };

    // ── Sub-screens ──
    if (editingCategory) {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingCategory(null)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={[s.header, { borderBottomColor: colors.border }]}>
                        <Text style={[s.title, { color: colors.text }]}>Kategorie bearbeiten</Text>
                        <Pressable onPress={() => setEditingCategory(null)} style={{ padding: 8 }}><X size={24} color={colors.subtext} /></Pressable>
                    </View>
                    <ScrollView style={{ flex: 1, padding: 16 }}>
                        <Text style={[s.label, { color: colors.subtext }]}>NAME</Text>
                        <TextInput value={editName} onChangeText={setEditName} style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder="Kategoriename" placeholderTextColor={colors.subtext} />
                        <Text style={[s.label, { color: colors.subtext, marginTop: 16 }]}>FARBE</Text>
                        <View style={s.colorRow}>{COLOR_PRESETS.map(c => (<Pressable key={c} onPress={() => setEditColor(c)} style={[s.colorDot, { backgroundColor: c, borderWidth: editColor === c ? 3 : 0, borderColor: '#FFF' }]} />))}</View>
                        <Pressable onPress={saveCategory} style={[s.saveBtn, { backgroundColor: colors.accent }]}><Text style={s.saveBtnText}>Speichern</Text></Pressable>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        );
    }

    if (editingStore) {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingStore(null)}>
                <StoreOrderScreen
                    storeName={editingStore}
                    householdId={householdId}
                    categories={categories}
                    onBack={() => setEditingStore(null)}
                />
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={[s.header, { borderBottomColor: colors.border }]}>
                    <Text style={[s.title, { color: colors.text }]}>Einkauf konfigurieren</Text>
                    <Pressable onPress={onClose} style={{ padding: 8 }}><X size={24} color={colors.subtext} /></Pressable>
                </View>

                {/* Tab Bar */}
                <View style={[s.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                    <Pressable onPress={() => setActiveTab('categories')} style={[s.tab, activeTab === 'categories' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}>
                        <Tag size={16} color={activeTab === 'categories' ? colors.accent : colors.subtext} />
                        <Text style={[s.tabText, { color: activeTab === 'categories' ? colors.accent : colors.subtext }]}>Kategorien</Text>
                    </Pressable>
                    <Pressable onPress={() => setActiveTab('stores')} style={[s.tab, activeTab === 'stores' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}>
                        <Store size={16} color={activeTab === 'stores' ? colors.accent : colors.subtext} />
                        <Text style={[s.tabText, { color: activeTab === 'stores' ? colors.accent : colors.subtext }]}>Läden</Text>
                    </Pressable>
                </View>

                {activeTab === 'categories' ? (
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
                                    <Pressable onPress={() => moveCategory(index, 'up')} style={{ padding: 4, opacity: index === 0 ? 0.2 : 1 }}><ChevronUp size={18} color={colors.subtext} /></Pressable>
                                    <Pressable onPress={() => moveCategory(index, 'down')} style={{ padding: 4, opacity: index === categories.length - 1 ? 0.2 : 1 }}><ChevronDown size={18} color={colors.subtext} /></Pressable>
                                </View>
                                <Text style={{ fontSize: 20, marginRight: 10 }}>{(!cat.icon || cat.icon === 'tag') ? '📦' : cat.icon}</Text>
                                <Text style={[s.catName, { color: colors.text }]} numberOfLines={1}>{cat.name}</Text>
                                <Pressable onPress={() => { setEditingCategory(cat); setEditName(cat.name); setEditColor(cat.color); }} style={{ padding: 8 }}><Pencil size={16} color={colors.subtext} /></Pressable>
                                <Pressable onPress={() => deleteCategory(cat)} style={{ padding: 8 }}><Trash2 size={16} color={colors.error || '#EF4444'} /></Pressable>
                            </View>
                        ))}
                        {showAddForm ? (
                            <View style={[s.addForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <TextInput value={newName} onChangeText={setNewName} placeholder="Neuer Kategoriename" placeholderTextColor={colors.subtext} style={[s.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} autoFocus onSubmitEditing={addCategory} />
                                <View style={s.colorRow}>{COLOR_PRESETS.map(c => (<Pressable key={c} onPress={() => setNewColor(c)} style={[s.colorDot, { backgroundColor: c, borderWidth: newColor === c ? 3 : 0, borderColor: '#FFF' }]} />))}</View>
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                    <Pressable onPress={() => setShowAddForm(false)} style={[s.formBtn, { backgroundColor: colors.background }]}><Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text></Pressable>
                                    <Pressable onPress={addCategory} style={[s.formBtn, { backgroundColor: colors.accent }]}><Text style={{ color: '#FFF', fontWeight: '600' }}>Hinzufügen</Text></Pressable>
                                </View>
                            </View>
                        ) : (
                            <Pressable onPress={() => setShowAddForm(true)} style={[s.addBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]}>
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
                ) : (
                    <ScrollView style={{ flex: 1, padding: 16 }}>
                        {stores.length === 0 && !showAddStoreForm && (
                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                <Store size={48} color={colors.subtext} />
                                <Text style={{ color: colors.subtext, marginTop: 12, fontSize: 15, textAlign: 'center' }}>
                                    Noch keine Läden konfiguriert.{'\n'}Füge einen Laden hinzu, um die Kategoriereihenfolge anpassen zu können.
                                </Text>
                            </View>
                        )}
                        {stores.map(name => (
                            <Pressable key={name} onPress={() => setEditingStore(name)} style={[s.catRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Store size={20} color={colors.accent} style={{ marginRight: 12 }} />
                                <Text style={[s.catName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                                {/* Default star button */}
                                <Pressable
                                    onPress={(e) => { e.stopPropagation(); setAsDefault(name); }}
                                    hitSlop={8}
                                    style={{ padding: 6, marginLeft: 4 }}
                                >
                                    <Star
                                        size={18}
                                        color={defaultStore === name ? '#F59E0B' : colors.subtext}
                                        fill={defaultStore === name ? '#F59E0B' : 'transparent'}
                                    />
                                </Pressable>
                                <ChevronUp size={16} color={colors.subtext} style={{ transform: [{ rotate: '90deg' }] }} />
                                <Pressable onPress={() => deleteStore(name)} style={{ padding: 8, marginLeft: 4 }}><Trash2 size={16} color={colors.error || '#EF4444'} /></Pressable>
                            </Pressable>
                        ))}
                        {showAddStoreForm ? (
                            <View style={[s.addForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[s.label, { color: colors.subtext, marginBottom: 8 }]}>LADENNAME (z.B. "Migros", "Lidl")</Text>
                                <TextInput value={newStoreName} onChangeText={setNewStoreName} placeholder="Ladenname" placeholderTextColor={colors.subtext} style={[s.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} autoFocus onSubmitEditing={addStore} />
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                    <Pressable onPress={() => { setShowAddStoreForm(false); setNewStoreName(''); }} style={[s.formBtn, { backgroundColor: colors.background }]}><Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text></Pressable>
                                    <Pressable onPress={addStore} style={[s.formBtn, { backgroundColor: colors.accent }]}><Text style={{ color: '#FFF', fontWeight: '600' }}>Hinzufügen</Text></Pressable>
                                </View>
                            </View>
                        ) : (
                            <Pressable onPress={() => setShowAddStoreForm(true)} style={[s.addBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]}>
                                <Plus size={18} color={colors.accent} />
                                <Text style={{ color: colors.accent, fontWeight: '600', marginLeft: 6 }}>Neuen Laden hinzufügen</Text>
                            </Pressable>
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                )}
            </SafeAreaView>
        </Modal>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    title: { fontSize: 20, fontWeight: '700' },
    tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
    tabText: { fontSize: 14, fontWeight: '600' },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
    input: { borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1 },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    saveBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    saveSmallBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    catRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
    catDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    catName: { flex: 1, fontSize: 15, fontWeight: '600' },
    addForm: { borderRadius: 12, padding: 16, marginTop: 12, borderWidth: 1 },
    formBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginTop: 12, borderWidth: 1 },
    defaultsBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
});

import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { X, Check, ShoppingCart, Plus, Trash2 } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';

interface ShoppingListModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function ShoppingListModal({ visible, onClose }: ShoppingListModalProps) {
    const { fetchTodoItems, updateTodoItem, addTodoItem } = useHomeAssistant();
    const { colors } = useTheme();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newItemText, setNewItemText] = useState('');
    const ENTITY_ID = 'todo.google_keep_einkaufsliste';

    useEffect(() => {
        if (visible) {
            loadItems();
        }
    }, [visible]);

    const loadItems = async () => {
        setLoading(true);
        console.log('ShoppingList: Loading items...');
        try {
            const data = await fetchTodoItems(ENTITY_ID);
            console.log('ShoppingList: Received items:', JSON.stringify(data));
            // Sort: Needs Action first, then Completed
            const sorted = data.sort((a, b) => {
                if (a.status === 'needs_action' && b.status === 'completed') return -1;
                if (a.status === 'completed' && b.status === 'needs_action') return 1;
                return 0;
            });
            setItems(sorted);
        } catch (e) {
            console.error('ShoppingList error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleItem = async (item: any) => {
        const newStatus = item.status === 'needs_action' ? 'completed' : 'needs_action';

        // Optimistic Update
        setItems(prev => prev.map(i =>
            i.summary === item.summary ? { ...i, status: newStatus } : i
        ));

        // API Call
        await updateTodoItem(ENTITY_ID, item.summary, newStatus);
    };

    const handleAddItem = async () => {
        if (!newItemText.trim()) return;

        const text = newItemText.trim();
        setNewItemText('');

        // Optimistic Add
        setItems(prev => [...prev, { summary: text, status: 'needs_action' }]);

        await addTodoItem(ENTITY_ID, text);
        loadItems(); // Refresh to get real ID/structure
    };

    const activeItems = items.filter(i => i.status === 'needs_action');
    const completedItems = items.filter(i => i.status === 'completed');

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={[styles.content, { backgroundColor: colors.card }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <View style={styles.titleRow}>
                            <ShoppingCart size={24} color={colors.accent} />
                            <Text style={[styles.title, { color: colors.text }]}>Einkaufsliste</Text>
                        </View>
                        <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>

                    <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                            placeholder="Neuer Artikel..."
                            placeholderTextColor={colors.subtext}
                            value={newItemText}
                            onChangeText={setNewItemText}
                            onSubmitEditing={handleAddItem}
                        />
                        <Pressable onPress={handleAddItem} style={[styles.addBtn, { backgroundColor: colors.accent }]}>
                            <Plus size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {loading && items.length === 0 ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.accent} />
                        </View>
                    ) : (
                        <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
                            {activeItems.length === 0 && completedItems.length === 0 && (
                                <View style={styles.empty}>
                                    <Text style={[styles.emptyText, { color: colors.subtext }]}>Liste ist leer</Text>
                                </View>
                            )}

                            {activeItems.map((item, idx) => (
                                <Pressable key={idx + item.summary} style={[styles.itemRow, { borderBottomColor: colors.border + '30' }]} onPress={() => handleToggleItem(item)}>
                                    <View style={[styles.checkbox, { borderColor: colors.subtext }]}>
                                        {/* Empty Circle */}
                                    </View>
                                    <Text style={[styles.itemText, { color: colors.text }]}>{item.summary}</Text>
                                </Pressable>
                            ))}

                            {completedItems.length > 0 && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Erledigt</Text>
                                    {completedItems.map((item, idx) => (
                                        <Pressable key={idx + item.summary} style={[styles.itemRow, { borderBottomColor: colors.border + '30' }]} onPress={() => handleToggleItem(item)}>
                                            <View style={[styles.checkbox, styles.checkboxChecked, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                                <Check size={14} color="#fff" />
                                            </View>
                                            <Text style={[styles.itemText, styles.itemTextDone, { color: colors.subtext }]}>{item.summary}</Text>
                                        </Pressable>
                                    ))}
                                </>
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
    content: { borderRadius: 24, maxHeight: '80%', width: '100%', display: 'flex', flexDirection: 'column' },
    header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, borderRadius: 20 },

    inputRow: { flexDirection: 'row', padding: 16, gap: 10, borderBottomWidth: 1 },
    input: { flex: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
    addBtn: { borderRadius: 12, width: 48, alignItems: 'center', justifyContent: 'center' },

    body: { width: '100%', minHeight: 100 },
    scrollContent: { padding: 16 },
    center: { flex: 1, padding: 40, alignItems: 'center' },

    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: {},
    itemText: { fontSize: 16, flex: 1 },
    itemTextDone: { textDecorationLine: 'line-through' },

    divider: { height: 1, marginVertical: 16 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },

    empty: { padding: 40, alignItems: 'center' },
    emptyText: {}
});

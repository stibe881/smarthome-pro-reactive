import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { X, Check, ShoppingCart, Plus, Trash2 } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';

interface ShoppingListModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function ShoppingListModal({ visible, onClose }: ShoppingListModalProps) {
    const { fetchTodoItems, updateTodoItem, addTodoItem } = useHomeAssistant();
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
        try {
            const data = await fetchTodoItems(ENTITY_ID);
            // Sort: Needs Action first, then Completed
            const sorted = data.sort((a, b) => {
                if (a.status === 'needs_action' && b.status === 'completed') return -1;
                if (a.status === 'completed' && b.status === 'needs_action') return 1;
                return 0;
            });
            setItems(sorted);
        } catch (e) {
            console.error(e);
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

        // Refresh to ensure sync
        // setTimeout(loadItems, 500); 
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
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <ShoppingCart size={24} color="#10B981" />
                            <Text style={styles.title}>Einkaufsliste</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Neuer Artikel..."
                            placeholderTextColor="#64748B"
                            value={newItemText}
                            onChangeText={setNewItemText}
                            onSubmitEditing={handleAddItem}
                        />
                        <Pressable onPress={handleAddItem} style={styles.addBtn}>
                            <Plus size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {loading && items.length === 0 ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color="#10B981" />
                        </View>
                    ) : (
                        <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
                            {activeItems.length === 0 && completedItems.length === 0 && (
                                <View style={styles.empty}>
                                    <Text style={styles.emptyText}>Liste ist leer</Text>
                                </View>
                            )}

                            {activeItems.map((item, idx) => (
                                <Pressable key={idx + item.summary} style={styles.itemRow} onPress={() => handleToggleItem(item)}>
                                    <View style={styles.checkbox}>
                                        {/* Empty Circle */}
                                    </View>
                                    <Text style={styles.itemText}>{item.summary}</Text>
                                </Pressable>
                            ))}

                            {completedItems.length > 0 && (
                                <>
                                    <View style={styles.divider} />
                                    <Text style={styles.sectionTitle}>Erledigt</Text>
                                    {completedItems.map((item, idx) => (
                                        <Pressable key={idx + item.summary} style={styles.itemRow} onPress={() => handleToggleItem(item)}>
                                            <View style={[styles.checkbox, styles.checkboxChecked]}>
                                                <Check size={14} color="#0F172A" />
                                            </View>
                                            <Text style={[styles.itemText, styles.itemTextDone]}>{item.summary}</Text>
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
    content: { backgroundColor: '#1E293B', borderRadius: 24, maxHeight: '80%', overflow: 'hidden', width: '100%' },
    header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#334155' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },

    inputRow: { flexDirection: 'row', padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
    input: { flex: 1, backgroundColor: '#334155', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 16 },
    addBtn: { backgroundColor: '#10B981', borderRadius: 12, width: 48, alignItems: 'center', justifyContent: 'center' },

    body: { flex: 1 },
    scrollContent: { padding: 16 },
    center: { flex: 1, padding: 40, alignItems: 'center' },

    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: '#94A3B8', borderColor: '#94A3B8' },
    itemText: { color: '#fff', fontSize: 16, flex: 1 },
    itemTextDone: { color: '#64748B', textDecorationLine: 'line-through' },

    divider: { height: 1, backgroundColor: '#334155', marginVertical: 16 },
    sectionTitle: { color: '#64748B', fontSize: 14, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },

    empty: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#64748B' }
});

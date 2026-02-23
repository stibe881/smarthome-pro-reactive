import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Animated, Modal,
} from 'react-native';
import {
    Plus, X, Check, Circle, CheckCircle2, Trash2, ChevronDown,
    User, Calendar, Flag,
} from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface Todo {
    id: string;
    household_id: string;
    created_by: string | null;
    assigned_to: string | null;
    title: string;
    completed: boolean;
    due_date: string | null;
    priority: string;
    created_at: string;
}

interface FamilyMember {
    user_id: string;
    email: string;
}

const PRIORITIES = [
    { key: 'low', label: 'Niedrig', color: '#64748B', icon: '○' },
    { key: 'normal', label: 'Normal', color: '#3B82F6', icon: '●' },
    { key: 'high', label: 'Wichtig', color: '#F59E0B', icon: '⚡' },
    { key: 'urgent', label: 'Dringend', color: '#EF4444', icon: '🔥' },
];

interface FamilyTodosProps {
    visible: boolean;
    onClose: () => void;
}

export const FamilyTodos: React.FC<FamilyTodosProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [todos, setTodos] = useState<Todo[]>([]);
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newTitle, setNewTitle] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open');

    const loadTodos = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_todos')
                .select('*')
                .eq('household_id', householdId)
                .order('completed', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTodos(data || []);
        } catch (e: any) {
            console.error('Error loading todos:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    const loadMembers = useCallback(async () => {
        if (!householdId) return;
        try {
            const { data } = await supabase
                .from('family_members')
                .select('user_id, email')
                .eq('household_id', householdId);
            setMembers(data || []);
        } catch (e) { console.error(e); }
    }, [householdId]);

    useEffect(() => {
        if (visible) { loadTodos(); loadMembers(); }
    }, [visible, loadTodos, loadMembers]);

    const handleAdd = async () => {
        if (!newTitle.trim() || !householdId) return;
        setIsAdding(true);
        try {
            const { error } = await supabase.from('family_todos').insert({
                household_id: householdId,
                created_by: user?.id,
                title: newTitle.trim(),
            });
            if (error) throw error;
            setNewTitle('');
            loadTodos();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggle = async (todo: Todo) => {
        try {
            await supabase.from('family_todos')
                .update({ completed: !todo.completed })
                .eq('id', todo.id);
            setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t));
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    const handleDelete = (todo: Todo) => {
        Alert.alert('Löschen', `"${todo.title}" wirklich löschen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen', style: 'destructive', onPress: async () => {
                    await supabase.from('family_todos').delete().eq('id', todo.id);
                    loadTodos();
                }
            }
        ]);
    };

    const filteredTodos = todos.filter(t => {
        if (filter === 'open') return !t.completed;
        if (filter === 'done') return t.completed;
        return true;
    });

    const openCount = todos.filter(t => !t.completed).length;
    const doneCount = todos.filter(t => t.completed).length;

    const getMemberEmail = (userId: string | null) => {
        if (!userId) return null;
        return members.find(m => m.user_id === userId)?.email?.split('@')[0] || null;
    };

    const getPriority = (key: string) => PRIORITIES.find(p => p.key === key) || PRIORITIES[1];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Aufgaben</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Filter */}
                <View style={styles.filterRow}>
                    {[
                        { key: 'open' as const, label: `Offen (${openCount})` },
                        { key: 'done' as const, label: `Erledigt (${doneCount})` },
                        { key: 'all' as const, label: 'Alle' },
                    ].map(f => (
                        <Pressable
                            key={f.key}
                            style={[styles.filterBtn, filter === f.key && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                            onPress={() => setFilter(f.key)}
                        >
                            <Text style={[styles.filterText, { color: filter === f.key ? colors.accent : colors.subtext }]}>{f.label}</Text>
                        </Pressable>
                    ))}
                </View>

                {/* Add */}
                <View style={[styles.addRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <TextInput
                        style={[styles.addInput, { color: colors.text }]}
                        value={newTitle}
                        onChangeText={setNewTitle}
                        placeholder="Neue Aufgabe..."
                        placeholderTextColor={colors.subtext}
                        onSubmitEditing={handleAdd}
                        returnKeyType="done"
                    />
                    <Pressable onPress={handleAdd} disabled={isAdding || !newTitle.trim()} style={[styles.addBtn, { backgroundColor: colors.accent, opacity: newTitle.trim() ? 1 : 0.4 }]}>
                        {isAdding ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={18} color="#fff" />}
                    </Pressable>
                </View>

                {/* List */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                    ) : filteredTodos.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                {filter === 'done' ? 'Noch keine erledigten Aufgaben' : 'Keine offenen Aufgaben 🎉'}
                            </Text>
                        </View>
                    ) : (
                        filteredTodos.map(todo => {
                            const prio = getPriority(todo.priority);
                            const assignee = getMemberEmail(todo.assigned_to);
                            return (
                                <Pressable
                                    key={todo.id}
                                    style={[styles.todoItem, { borderColor: colors.border, backgroundColor: colors.card }]}
                                    onPress={() => handleToggle(todo)}
                                >
                                    <View style={styles.todoCheck}>
                                        {todo.completed ? (
                                            <CheckCircle2 size={22} color={colors.accent} fill={colors.accent + '30'} />
                                        ) : (
                                            <Circle size={22} color={colors.subtext} />
                                        )}
                                    </View>
                                    <View style={styles.todoContent}>
                                        <Text style={[
                                            styles.todoTitle,
                                            { color: todo.completed ? colors.subtext : colors.text },
                                            todo.completed && styles.todoDone,
                                        ]} numberOfLines={2}>
                                            {todo.title}
                                        </Text>
                                        <View style={styles.todoMeta}>
                                            {prio.key !== 'normal' && (
                                                <View style={[styles.prioBadge, { backgroundColor: prio.color + '15' }]}>
                                                    <Text style={{ fontSize: 10 }}>{prio.icon}</Text>
                                                    <Text style={[styles.prioText, { color: prio.color }]}>{prio.label}</Text>
                                                </View>
                                            )}
                                            {assignee && (
                                                <View style={[styles.assigneeBadge, { backgroundColor: colors.accent + '15' }]}>
                                                    <User size={10} color={colors.accent} />
                                                    <Text style={[styles.assigneeText, { color: colors.accent }]}>{assignee}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <Pressable onPress={() => handleDelete(todo)} hitSlop={12}>
                                        <Trash2 size={14} color={colors.subtext} />
                                    </Pressable>
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
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },

    filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
    filterText: { fontSize: 13, fontWeight: '600' },

    addRow: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: 16,
        borderRadius: 14, borderWidth: 1, paddingLeft: 14, paddingRight: 4, paddingVertical: 4,
    },
    addInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
    addBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 15 },

    todoItem: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
        marginHorizontal: 16, marginTop: 8, borderRadius: 14, borderWidth: 1,
    },
    todoCheck: { marginRight: 12 },
    todoContent: { flex: 1 },
    todoTitle: { fontSize: 15, fontWeight: '500' },
    todoDone: { textDecorationLine: 'line-through' },
    todoMeta: { flexDirection: 'row', gap: 6, marginTop: 4 },
    prioBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    prioText: { fontSize: 10, fontWeight: '600' },
    assigneeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    assigneeText: { fontSize: 10, fontWeight: '600' },
});

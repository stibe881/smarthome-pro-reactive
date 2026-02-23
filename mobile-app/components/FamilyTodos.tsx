import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal,
} from 'react-native';
import {
    Plus, X, Check, Circle, CheckCircle2, Trash2, ChevronDown,
    User, Calendar, Flag, Repeat,
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
    points: number;
    recurrence: string | null;
    created_at: string;
}

interface FamilyMember {
    id: string;
    user_id: string | null;
    email: string;
    display_name: string | null;
    planner_access: boolean;
}

const PRIORITIES = [
    { key: 'low', label: 'Niedrig', color: '#64748B', icon: '○' },
    { key: 'normal', label: 'Normal', color: '#3B82F6', icon: '●' },
    { key: 'high', label: 'Wichtig', color: '#F59E0B', icon: '⚡' },
    { key: 'urgent', label: 'Dringend', color: '#EF4444', icon: '🔥' },
];

const RECURRENCE_OPTIONS = [
    { key: 'none', label: 'Einmalig', icon: '—' },
    { key: 'daily', label: 'Täglich', icon: '📆' },
    { key: 'weekly', label: 'Wöchentlich', icon: '📅' },
    { key: 'monthly', label: 'Monatlich', icon: '🗓️' },
];

const AVATAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#14B8A6'];

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
    const [selectedMember, setSelectedMember] = useState<string | null>(null);
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [newPoints, setNewPoints] = useState(0);
    const [newRecurrence, setNewRecurrence] = useState('none');

    // Edit modal
    const [editTodo, setEditTodo] = useState<Todo | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editPriority, setEditPriority] = useState('normal');
    const [editAssignee, setEditAssignee] = useState<string | null>(null);
    const [editPoints, setEditPoints] = useState(0);
    const [editRecurrence, setEditRecurrence] = useState('none');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

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
            // Try loading with display_name first, fall back to basic columns
            let data: any[] | null = null;
            const { data: fullData, error: fullError } = await supabase
                .from('family_members')
                .select('id, user_id, email, display_name, planner_access')
                .eq('household_id', householdId)
                .eq('is_active', true);

            if (fullError) {
                // display_name column might not exist, try without
                const { data: basicData } = await supabase
                    .from('family_members')
                    .select('id, user_id, email, planner_access')
                    .eq('household_id', householdId)
                    .eq('is_active', true);
                data = (basicData || []).map(m => ({ ...m, display_name: null }));
            } else {
                data = fullData;
            }

            setMembers((data || []).filter(m => m.planner_access !== false));
        } catch (e) { console.error('Error loading members:', e); }
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
                assigned_to: selectedMember,
                title: newTitle.trim(),
                points: newPoints,
                recurrence: newRecurrence === 'none' ? null : newRecurrence,
            });
            if (error) throw error;
            setNewTitle('');
            setSelectedMember(null);
            setNewPoints(0);
            setNewRecurrence('none');
            loadTodos();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggle = async (todo: Todo) => {
        try {
            const nowCompleted = !todo.completed;
            await supabase.from('family_todos')
                .update({ completed: nowCompleted })
                .eq('id', todo.id);
            setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: nowCompleted } : t));

            // Award/revoke points when toggling completion
            if (todo.points && todo.points !== 0 && todo.assigned_to && householdId) {
                const memberName = getMemberName(todo.assigned_to);
                if (memberName) {
                    const pointDelta = nowCompleted ? todo.points : -todo.points;
                    // Try to update existing reward_points row
                    const { data: existing } = await supabase
                        .from('reward_points')
                        .select('id, points')
                        .eq('household_id', householdId)
                        .eq('member_name', memberName)
                        .single();
                    if (existing) {
                        await supabase.from('reward_points')
                            .update({ points: existing.points + pointDelta })
                            .eq('id', existing.id);
                    } else if (nowCompleted) {
                        await supabase.from('reward_points').insert({
                            household_id: householdId,
                            member_name: memberName,
                            points: todo.points,
                        });
                    }
                    // Log to history
                    await supabase.from('reward_history').insert({
                        household_id: householdId,
                        member_name: memberName,
                        points: pointDelta,
                        reason: nowCompleted ? `✅ "${todo.title}" erledigt` : `↩️ "${todo.title}" rückgängig`,
                        type: 'task',
                    });
                }
            }
            // Auto-recreate recurring tasks
            if (nowCompleted && todo.recurrence && todo.recurrence !== 'none') {
                await supabase.from('family_todos').insert({
                    household_id: householdId,
                    created_by: todo.created_by,
                    assigned_to: todo.assigned_to,
                    title: todo.title,
                    points: todo.points,
                    priority: todo.priority,
                    recurrence: todo.recurrence,
                    completed: false,
                });
                loadTodos();
            }
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

    const openEdit = (todo: Todo) => {
        setEditTodo(todo);
        setEditTitle(todo.title);
        setEditPriority(todo.priority || 'normal');
        setEditAssignee(todo.assigned_to);
        setEditPoints(todo.points || 0);
        setEditRecurrence(todo.recurrence || 'none');
    };

    const handleSaveEdit = async () => {
        if (!editTodo || !editTitle.trim()) return;
        setIsSavingEdit(true);
        try {
            const { error } = await supabase.from('family_todos')
                .update({ title: editTitle.trim(), priority: editPriority, assigned_to: editAssignee, points: editPoints, recurrence: editRecurrence === 'none' ? null : editRecurrence })
                .eq('id', editTodo.id);
            if (error) throw error;
            setEditTodo(null);
            loadTodos();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsSavingEdit(false);
        }
    };

    const filteredTodos = todos.filter(t => {
        if (filter === 'open') return !t.completed;
        if (filter === 'done') return t.completed;
        return true;
    });

    const openCount = todos.filter(t => !t.completed).length;
    const doneCount = todos.filter(t => t.completed).length;

    const getMemberName = (memberId: string | null) => {
        if (!memberId) return null;
        const m = members.find(m => m.id === memberId || m.user_id === memberId);
        if (!m) return null;
        return m.display_name || m.email.split('@')[0];
    };

    const getMemberColor = (memberId: string | null) => {
        if (!memberId) return AVATAR_COLORS[0];
        const idx = members.findIndex(m => m.id === memberId || m.user_id === memberId);
        return AVATAR_COLORS[idx >= 0 ? idx % AVATAR_COLORS.length : 0];
    };

    const getMemberInitial = (memberId: string | null) => {
        const name = getMemberName(memberId);
        return name ? name.substring(0, 1).toUpperCase() : '?';
    };

    const getSelectedMemberLabel = () => {
        if (!selectedMember) return 'Alle';
        return getMemberName(selectedMember) || 'Alle';
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
                <View style={[styles.addSection, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={styles.addRow}>
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
                    {/* Member Picker Row */}
                    <View style={styles.assignRow}>
                        <Text style={[styles.assignLabel, { color: colors.subtext }]}>Zuweisen an:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                            <Pressable
                                style={[styles.memberChip, !selectedMember && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                onPress={() => setSelectedMember(null)}
                            >
                                <Text style={[styles.memberChipText, { color: !selectedMember ? colors.accent : colors.subtext }]}>Alle</Text>
                            </Pressable>
                            {members.map((m, idx) => {
                                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                                const isSelected = selectedMember === m.id;
                                const name = m.display_name || m.email.split('@')[0];
                                return (
                                    <Pressable
                                        key={m.id}
                                        style={[styles.memberChip, isSelected && { backgroundColor: color + '20', borderColor: color }]}
                                        onPress={() => setSelectedMember(isSelected ? null : m.id)}
                                    >
                                        <View style={[styles.chipAvatar, { backgroundColor: color }]}>
                                            <Text style={styles.chipAvatarText}>{name.substring(0, 1).toUpperCase()}</Text>
                                        </View>
                                        <Text style={[styles.memberChipText, { color: isSelected ? color : colors.subtext }]}>{name}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                    {/* Points Row */}
                    <View style={styles.assignRow}>
                        <Text style={[styles.assignLabel, { color: colors.subtext }]}>⭐ Punkte:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                            {[-5, -1, 0, 1, 2, 3, 5, 10].map(p => (
                                <Pressable
                                    key={p}
                                    style={[styles.memberChip, newPoints === p && { backgroundColor: (p < 0 ? '#EF4444' : colors.accent) + '20', borderColor: p < 0 ? '#EF4444' : colors.accent }]}
                                    onPress={() => setNewPoints(p)}
                                >
                                    <Text style={[styles.memberChipText, { color: newPoints === p ? (p < 0 ? '#EF4444' : colors.accent) : colors.subtext }]}>{p > 0 ? `+${p}` : p}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                    {/* Recurrence Row */}
                    <View style={styles.assignRow}>
                        <Text style={[styles.assignLabel, { color: colors.subtext }]}>🔄 Wiederholen:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                            {RECURRENCE_OPTIONS.map(r => (
                                <Pressable
                                    key={r.key}
                                    style={[styles.memberChip, newRecurrence === r.key && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                    onPress={() => setNewRecurrence(r.key)}
                                >
                                    <Text style={[styles.memberChipText, { color: newRecurrence === r.key ? colors.accent : colors.subtext }]}>{r.icon} {r.label}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
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
                            const assigneeName = getMemberName(todo.assigned_to);
                            const assigneeColor = getMemberColor(todo.assigned_to);
                            return (
                                <View
                                    key={todo.id}
                                    style={[styles.todoItem, { borderColor: colors.border, backgroundColor: colors.card }]}
                                >
                                    {/* Checkbox - toggles completion */}
                                    <Pressable onPress={() => handleToggle(todo)} style={styles.todoCheck} hitSlop={10}>
                                        {todo.completed ? (
                                            <CheckCircle2 size={22} color={colors.accent} fill={colors.accent + '30'} />
                                        ) : (
                                            <Circle size={22} color={colors.subtext} />
                                        )}
                                    </Pressable>
                                    {/* Assignee Avatar */}
                                    {todo.assigned_to && (
                                        <View style={[styles.todoAvatar, { backgroundColor: assigneeColor }]}>
                                            <Text style={styles.todoAvatarText}>{getMemberInitial(todo.assigned_to)}</Text>
                                        </View>
                                    )}
                                    {/* Content - opens edit */}
                                    <Pressable style={styles.todoContent} onPress={() => openEdit(todo)}>
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
                                            {assigneeName && (
                                                <View style={[styles.assigneeBadge, { backgroundColor: assigneeColor + '15' }]}>
                                                    <User size={10} color={assigneeColor} />
                                                    <Text style={[styles.assigneeText, { color: assigneeColor }]}>{assigneeName}</Text>
                                                </View>
                                            )}
                                            {todo.points !== 0 && (
                                                <View style={[styles.prioBadge, { backgroundColor: todo.points > 0 ? '#F59E0B15' : '#EF444415' }]}>
                                                    <Text style={{ fontSize: 10 }}>⭐</Text>
                                                    <Text style={[styles.prioText, { color: todo.points > 0 ? '#F59E0B' : '#EF4444' }]}>{todo.points > 0 ? `+${todo.points}` : todo.points}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </Pressable>
                                    <Pressable onPress={() => handleDelete(todo)} hitSlop={12}>
                                        <Trash2 size={14} color={colors.subtext} />
                                    </Pressable>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </View>

            {/* Edit Modal */}
            <Modal visible={!!editTodo} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditTodo(null)}>
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Pressable onPress={() => setEditTodo(null)}><X size={24} color={colors.subtext} /></Pressable>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Aufgabe bearbeiten</Text>
                        <Pressable onPress={handleSaveEdit} disabled={isSavingEdit}>
                            {isSavingEdit ? <ActivityIndicator size="small" color={colors.accent} /> : <Check size={24} color={colors.accent} />}
                        </Pressable>
                    </View>
                    <ScrollView style={{ padding: 16 }} contentContainerStyle={{ gap: 16 }}>
                        {/* Title */}
                        <View>
                            <Text style={[styles.editLabel, { color: colors.subtext }]}>Titel</Text>
                            <TextInput
                                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                                value={editTitle}
                                onChangeText={setEditTitle}
                                placeholder="Aufgabe..."
                                placeholderTextColor={colors.subtext}
                                autoFocus
                            />
                        </View>

                        {/* Priority */}
                        <View>
                            <Text style={[styles.editLabel, { color: colors.subtext }]}>Priorität</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {PRIORITIES.map(p => (
                                    <Pressable
                                        key={p.key}
                                        style={[styles.editPrioBtn, editPriority === p.key && { backgroundColor: p.color + '20', borderColor: p.color }]}
                                        onPress={() => setEditPriority(p.key)}
                                    >
                                        <Text style={{ fontSize: 12 }}>{p.icon}</Text>
                                        <Text style={[styles.editPrioText, { color: editPriority === p.key ? p.color : colors.subtext }]}>{p.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {/* Assignee */}
                        <View>
                            <Text style={[styles.editLabel, { color: colors.subtext }]}>Zugewiesen an</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                <Pressable
                                    style={[styles.memberChip, !editAssignee && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                    onPress={() => setEditAssignee(null)}
                                >
                                    <Text style={[styles.memberChipText, { color: !editAssignee ? colors.accent : colors.subtext }]}>Niemand</Text>
                                </Pressable>
                                {members.map((m, idx) => {
                                    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                                    const isSelected = editAssignee === m.id;
                                    const name = m.display_name || m.email.split('@')[0];
                                    return (
                                        <Pressable
                                            key={m.id}
                                            style={[styles.memberChip, isSelected && { backgroundColor: color + '20', borderColor: color }]}
                                            onPress={() => setEditAssignee(isSelected ? null : m.id)}
                                        >
                                            <View style={[styles.chipAvatar, { backgroundColor: color }]}>
                                                <Text style={styles.chipAvatarText}>{name.substring(0, 1).toUpperCase()}</Text>
                                            </View>
                                            <Text style={[styles.memberChipText, { color: isSelected ? color : colors.subtext }]}>{name}</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Points */}
                        <View>
                            <Text style={[styles.editLabel, { color: colors.subtext }]}>⭐ Punkte</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                {[-5, -3, -1, 0, 1, 2, 3, 5, 10].map(p => (
                                    <Pressable
                                        key={p}
                                        style={[styles.editPrioBtn, editPoints === p && { backgroundColor: (p < 0 ? '#EF4444' : '#F59E0B') + '20', borderColor: p < 0 ? '#EF4444' : '#F59E0B' }]}
                                        onPress={() => setEditPoints(p)}
                                    >
                                        <Text style={[styles.editPrioText, { color: editPoints === p ? (p < 0 ? '#EF4444' : '#F59E0B') : colors.subtext }]}>{p > 0 ? `+${p}` : p}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Delete */}
                        <Pressable
                            onPress={() => { if (editTodo) { handleDelete(editTodo); setEditTodo(null); } }}
                            style={[styles.editDeleteBtn]}
                        >
                            <Trash2 size={16} color="#EF4444" />
                            <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15 }}>Aufgabe löschen</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </Modal>
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

    addSection: {
        marginHorizontal: 16, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8,
    },
    addRow: {
        flexDirection: 'row', alignItems: 'center',
    },
    addInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
    addBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    assignRow: {
        flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)',
    },
    assignLabel: { fontSize: 12, fontWeight: '600', marginRight: 8 },
    memberChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: 'transparent',
    },
    memberChipText: { fontSize: 12, fontWeight: '600' },
    chipAvatar: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    chipAvatarText: { fontSize: 10, fontWeight: '800', color: '#fff' },

    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 15 },

    todoItem: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
        marginHorizontal: 16, marginTop: 8, borderRadius: 14, borderWidth: 1,
    },
    todoCheck: { marginRight: 10 },
    todoAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    todoAvatarText: { fontSize: 12, fontWeight: '800', color: '#fff' },
    todoContent: { flex: 1 },
    todoTitle: { fontSize: 15, fontWeight: '500' },
    todoDone: { textDecorationLine: 'line-through' },
    todoMeta: { flexDirection: 'row', gap: 6, marginTop: 4 },
    prioBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    prioText: { fontSize: 10, fontWeight: '600' },
    assigneeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    assigneeText: { fontSize: 10, fontWeight: '600' },

    editLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
    editInput: {
        fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    },
    editPrioBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
    },
    editPrioText: { fontSize: 12, fontWeight: '600' },
    editDeleteBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 14, marginTop: 16, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)',
    },
});

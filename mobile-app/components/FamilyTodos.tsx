import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import {
    Plus, X, Check, Circle, CheckCircle2, Trash2, ChevronRight, ChevronDown,
    User, Calendar, Flag, Repeat, List, RefreshCw, Tag, Users, FileText,
    CheckSquare, Bell, Star, Zap,
} from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';

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
    category?: string | null;
    description?: string | null;
    reminder_enabled?: boolean;
    reminder_interval?: string | null;
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

const TASK_TEMPLATES = [
    {
        category: 'Reinigung', emoji: '🧹', templates: [
            { title: 'Staubsaugen', emoji: '🧹', recurrence: 'Wöchentlich' },
            { title: 'Boden wischen', emoji: '🧴', recurrence: 'Wöchentlich' },
            { title: 'Bad putzen', emoji: '🧼', recurrence: 'Wöchentlich' },
            { title: 'Toilette putzen', emoji: '🚿', recurrence: 'Wöchentlich' },
            { title: 'Staub wischen', emoji: '✨', recurrence: 'Wöchentlich' },
            { title: 'Fenster putzen', emoji: '🪟', recurrence: 'Monatlich' },
        ]
    },
    {
        category: 'Küche', emoji: '🍽️', templates: [
            { title: 'Abspülen', emoji: '🍽️', recurrence: 'Täglich' },
            { title: 'Spülmaschine einräumen', emoji: '🧽', recurrence: 'Täglich' },
            { title: 'Spülmaschine ausräumen', emoji: '🧽', recurrence: 'Täglich' },
            { title: 'Herd reinigen', emoji: '🍳', recurrence: 'Wöchentlich' },
            { title: 'Kühlschrank aufräumen', emoji: '❄️', recurrence: 'Monatlich' },
            { title: 'Tisch abwischen', emoji: '🧹', recurrence: 'Täglich' },
        ]
    },
    {
        category: 'Müll & Recycling', emoji: '🗑️', templates: [
            { title: 'Müll rausbringen', emoji: '🗑️', recurrence: 'Wöchentlich' },
            { title: 'Altpapier entsorgen', emoji: '📰', recurrence: 'Wöchentlich' },
            { title: 'Gelber Sack rausstellen', emoji: '🚮', recurrence: 'Wöchentlich' },
        ]
    },
    {
        category: 'Wäsche', emoji: '👕', templates: [
            { title: 'Wäsche waschen', emoji: '👕', recurrence: 'Wöchentlich' },
            { title: 'Wäsche aufhängen', emoji: '🧵', recurrence: 'Wöchentlich' },
            { title: 'Wäsche falten', emoji: '👚', recurrence: 'Wöchentlich' },
            { title: 'Bügeln', emoji: '🪨', recurrence: 'Wöchentlich' },
        ]
    },
    {
        category: 'Einkaufen', emoji: '🛒', templates: [
            { title: 'Einkaufen gehen', emoji: '🛒', recurrence: 'Wöchentlich' },
        ]
    },
    {
        category: 'Garten & Pflanzen', emoji: '🌱', templates: [
            { title: 'Rasen mähen', emoji: '🌿', recurrence: 'Wöchentlich' },
            { title: 'Blumen giessen', emoji: '🌺', recurrence: 'Täglich' },
            { title: 'Unkraut jäten', emoji: '🌾', recurrence: 'Wöchentlich' },
        ]
    },
    {
        category: 'Haustiere', emoji: '🐕', templates: [
            { title: 'Füttern', emoji: '🍖', recurrence: 'Täglich' },
            { title: 'Gassi gehen', emoji: '🐕', recurrence: 'Täglich' },
            { title: 'Katzenklo reinigen', emoji: '🐈', recurrence: 'Täglich' },
        ]
    },
    {
        category: 'Wartung', emoji: '🔧', templates: [
            { title: 'Filter wechseln', emoji: '🔧', recurrence: 'Monatlich' },
            { title: 'Rauchmelder prüfen', emoji: '🚨', recurrence: 'Monatlich' },
            { title: 'Heizung entlüften', emoji: '🌡️', recurrence: 'Monatlich' },
        ]
    },
];

const QUICK_START_TASKS = [
    { title: 'Staubsaugen', emoji: '🧹' },
    { title: 'Abspülen', emoji: '🍽️' },
    { title: 'Müll rausbringen', emoji: '🗑️' },
    { title: 'Wäsche waschen', emoji: '👕' },
    { title: 'Spülmaschine einräumen', emoji: '🔧' },
    { title: 'Bad putzen', emoji: '🧽' },
];

const CATEGORIES = ['Reinigung', 'Küche', 'Wäsche', 'Garten', 'Haustiere', 'Einkaufen', 'Wartung', 'Sonstiges'];

const REMINDER_INTERVALS = [
    { key: '15m', label: '15 Minuten vorher', ms: 15 * 60 * 1000 },
    { key: '30m', label: '30 Minuten vorher', ms: 30 * 60 * 1000 },
    { key: '1h', label: '1 Stunde vorher', ms: 60 * 60 * 1000 },
    { key: '8h', label: '8 Stunden vorher', ms: 8 * 60 * 60 * 1000 },
    { key: '12h', label: '12 Stunden vorher', ms: 12 * 60 * 60 * 1000 },
    { key: '1d', label: '1 Tag vorher', ms: 24 * 60 * 60 * 1000 },
    { key: '3d', label: '3 Tage vorher', ms: 3 * 24 * 60 * 60 * 1000 },
    { key: '7d', label: '7 Tage vorher', ms: 7 * 24 * 60 * 60 * 1000 },
];

interface FamilyTodosProps {
    visible: boolean;
    onClose: () => void;
}

export const FamilyTodos: React.FC<FamilyTodosProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();
    const { notificationSettings } = useHomeAssistant();

    const [todos, setTodos] = useState<Todo[]>([]);
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'tasks' | 'recurring'>('tasks');

    // Add task state
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState<string | null>(null);
    const [newDescription, setNewDescription] = useState('');
    const [showDescription, setShowDescription] = useState(false);
    const [selectedMember, setSelectedMember] = useState<string | null>(null);
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState<false | 'date' | 'time'>(false);
    const [newDueDate, setNewDueDate] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newPoints, setNewPoints] = useState(0);
    const [newPriority, setNewPriority] = useState('normal');
    const [newRecurrence, setNewRecurrence] = useState('none');
    const [enableReminder, setEnableReminder] = useState(false);
    const [reminderInterval, setReminderInterval] = useState('1h');
    const [showReminderPicker, setShowReminderPicker] = useState(false);

    // Recurring add
    const [showRecurringAdd, setShowRecurringAdd] = useState(false);
    const [recurringStep, setRecurringStep] = useState<'quick' | 'form'>('quick');
    const [showTemplates, setShowTemplates] = useState(false);
    const [expandedTemplateCategory, setExpandedTemplateCategory] = useState<string | null>(null);
    const [recurringTitle, setRecurringTitle] = useState('');
    const [recurringCategory, setRecurringCategory] = useState<string | null>(null);
    const [recurringDescription, setRecurringDescription] = useState('');
    const [recurringRecurrence, setRecurringRecurrence] = useState('weekly');
    const [recurringAssignee, setRecurringAssignee] = useState<string | null>(null);
    const [isAddingRecurring, setIsAddingRecurring] = useState(false);
    const [showRecurringCategoryPicker, setShowRecurringCategoryPicker] = useState(false);
    const [showRecurringDescription, setShowRecurringDescription] = useState(false);
    const [recurringReminder, setRecurringReminder] = useState(false);
    const [recurringReminderHour, setRecurringReminderHour] = useState(8);
    const [recurringReminderMinute, setRecurringReminderMinute] = useState(0);
    const [recurringReminderWeekday, setRecurringReminderWeekday] = useState(new Date().getDay() === 0 ? 7 : new Date().getDay()); // 1=Mo..7=So
    const [recurringReminderDay, setRecurringReminderDay] = useState(new Date().getDate());
    const [showRecurringTimePicker, setShowRecurringTimePicker] = useState(false);

    // Edit modal
    const [editTodo, setEditTodo] = useState<Todo | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editPriority, setEditPriority] = useState('normal');
    const [editAssignee, setEditAssignee] = useState<string | null>(null);
    const [editPoints, setEditPoints] = useState(0);
    const [editRecurrence, setEditRecurrence] = useState('none');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editDueDate, setEditDueDate] = useState<string | null>(null);
    const [editCategory, setEditCategory] = useState<string | null>(null);
    const [editDescription, setEditDescription] = useState('');
    const [showEditDatePicker, setShowEditDatePicker] = useState<false | 'date' | 'time'>(false);
    const [showEditCategoryPicker, setShowEditCategoryPicker] = useState(false);
    const [showEditMemberPicker, setShowEditMemberPicker] = useState(false);
    const [showEditDescription, setShowEditDescription] = useState(false);
    const [editReminder, setEditReminder] = useState(false);
    const [editReminderHour, setEditReminderHour] = useState(8);
    const [editReminderMinute, setEditReminderMinute] = useState(0);
    const [editReminderWeekday, setEditReminderWeekday] = useState(1);
    const [editReminderDay, setEditReminderDay] = useState(1);
    const [showEditTimePicker, setShowEditTimePicker] = useState(false);
    const [editEnableReminder, setEditEnableReminder] = useState(false);
    const [editReminderInterval, setEditReminderInterval] = useState('1h');
    const [showEditReminderPicker, setShowEditReminderPicker] = useState(false);

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
            let data: any[] | null = null;
            const { data: fullData, error: fullError } = await supabase
                .from('family_members')
                .select('id, user_id, email, display_name, planner_access')
                .eq('household_id', householdId)
                .eq('is_active', true);
            if (fullError) {
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

    // Tasks split
    const oneTimeTodos = useMemo(() => todos.filter(t => !t.recurrence || t.recurrence === 'none'), [todos]);
    const recurringTodos = useMemo(() => todos.filter(t => t.recurrence && t.recurrence !== 'none'), [todos]);
    const openCount = oneTimeTodos.filter(t => !t.completed).length;
    const recurringCount = recurringTodos.filter(t => !t.completed).length;

    const checkNotificationPermission = () => {
        const plannerEnabled = notificationSettings.planner?.taskReminders !== false;
        if (!notificationSettings.enabled || !plannerEnabled) {
            return false;
        }
        return true;
    };

    const handleReminderToggle = (val: boolean) => {
        if (val && (Platform.OS as string) !== 'web' && !checkNotificationPermission()) {
            Alert.alert(
                'Benachrichtigungen deaktiviert',
                'Du hast Aufgaben-Erinnerungen in den Einstellungen deaktiviert. Bitte aktiviere sie unter Einstellungen > Benachrichtigungen > Familienplaner.',
                [
                    { text: 'OK', style: 'cancel' },
                    { text: 'Trotzdem aktivieren', onPress: () => setEnableReminder(true) },
                ]
            );
            return;
        }
        setEnableReminder(val);
    };

    const scheduleTaskReminder = async (title: string) => {
        if (!enableReminder) return;
        try {
            const interval = REMINDER_INTERVALS.find(r => r.key === reminderInterval);
            if (!interval) return;
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '📋 Aufgaben-Erinnerung',
                    body: `"${title}" ist bald fällig!`,
                    sound: 'default',
                },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.floor(interval.ms / 1000) },
            });
        } catch (e) {
            console.warn('Failed to schedule reminder:', e);
        }
    };

    const scheduleRecurringReminder = async (title: string, recurrence: string) => {
        if (!recurringReminder) return;
        try {
            if (recurrence === 'daily') {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '🔁 Wiederkehrende Aufgabe',
                        body: `"${title}" steht heute an!`,
                        sound: 'default',
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DAILY,
                        hour: recurringReminderHour,
                        minute: recurringReminderMinute,
                    },
                });
            } else if (recurrence === 'weekly') {
                // Expo weekday: 1=Sunday..7=Saturday, our state: 1=Mo..7=So
                const WEEKDAY_MAP: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 1 };
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '🔁 Wiederkehrende Aufgabe',
                        body: `"${title}" steht diese Woche an!`,
                        sound: 'default',
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                        weekday: WEEKDAY_MAP[recurringReminderWeekday] || 2,
                        hour: recurringReminderHour,
                        minute: recurringReminderMinute,
                    },
                });
            } else if (recurrence === 'monthly') {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '🔁 Monatliche Aufgabe',
                        body: `"${title}" steht diesen Monat an!`,
                        sound: 'default',
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
                        day: recurringReminderDay,
                        hour: recurringReminderHour,
                        minute: recurringReminderMinute,
                    },
                });
            }
        } catch (e) {
            console.warn('Failed to schedule recurring reminder:', e);
        }
    };

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
                priority: newPriority,
                recurrence: null,
                due_date: newDueDate,
                reminder_enabled: enableReminder,
                reminder_interval: enableReminder ? reminderInterval : null,
            });
            if (error) throw error;
            if (enableReminder) await scheduleTaskReminder(newTitle.trim());
            setNewTitle(''); setSelectedMember(null); setNewPoints(0); setNewPriority('normal');
            setNewCategory(null); setNewDescription(''); setShowDescription(false);
            setEnableReminder(false); setReminderInterval('1h');
            setNewDueDate(null); setShowDatePicker(false);
            setShowAddModal(false);
            loadTodos();
        } catch (e: any) {
            Platform.OS === 'web' ? window.alert(e.message) : Alert.alert('Fehler', e.message);
        } finally {
            setIsAdding(false);
        }
    };

    const handleAddRecurring = async (title?: string) => {
        const t = title || recurringTitle;
        if (!t.trim() || !householdId) return;
        setIsAddingRecurring(true);
        try {
            const { error } = await supabase.from('family_todos').insert({
                household_id: householdId,
                created_by: user?.id,
                assigned_to: recurringAssignee,
                title: t.trim(),
                points: 0,
                recurrence: recurringRecurrence || 'weekly',
            });
            if (error) throw error;
            if (recurringReminder) await scheduleRecurringReminder(t.trim(), recurringRecurrence || 'weekly');
            setRecurringTitle(''); setRecurringAssignee(null); setRecurringCategory(null);
            setRecurringDescription(''); setRecurringRecurrence('weekly');
            setRecurringReminder(false); setRecurringReminderHour(8); setRecurringReminderMinute(0);
            setShowRecurringAdd(false); setRecurringStep('quick');
            loadTodos();
        } catch (e: any) {
            Platform.OS === 'web' ? window.alert(e.message) : Alert.alert('Fehler', e.message);
        } finally {
            setIsAddingRecurring(false);
        }
    };

    const handleToggle = async (todo: Todo) => {
        try {
            const nowCompleted = !todo.completed;
            await supabase.from('family_todos').update({ completed: nowCompleted }).eq('id', todo.id);
            setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: nowCompleted } : t));
            if (todo.points && todo.points !== 0 && todo.assigned_to && householdId) {
                const memberName = getMemberName(todo.assigned_to);
                if (memberName) {
                    const pointDelta = nowCompleted ? todo.points : -todo.points;
                    const { data: existing } = await supabase.from('reward_points').select('id, points').eq('household_id', householdId).eq('member_name', memberName).single();
                    if (existing) {
                        await supabase.from('reward_points').update({ points: existing.points + pointDelta }).eq('id', existing.id);
                    } else if (nowCompleted) {
                        await supabase.from('reward_points').insert({ household_id: householdId, member_name: memberName, points: todo.points });
                    }
                    await supabase.from('reward_history').insert({
                        household_id: householdId, member_name: memberName, points: pointDelta,
                        reason: nowCompleted ? `✅ "${todo.title}" erledigt` : `↩️ "${todo.title}" rückgängig`, type: 'task',
                    });
                }
            }
            if (nowCompleted && todo.recurrence && todo.recurrence !== 'none') {
                await supabase.from('family_todos').insert({
                    household_id: householdId, created_by: todo.created_by, assigned_to: todo.assigned_to,
                    title: todo.title, points: todo.points, priority: todo.priority, recurrence: todo.recurrence, completed: false,
                });
                loadTodos();
            }
        } catch (e: any) { Platform.OS === 'web' ? window.alert(e.message) : Alert.alert('Fehler', e.message); }
    };

    const handleDelete = (todo: Todo) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`"${todo.title}" wirklich löschen?`)) {
                supabase.from('family_todos').delete().eq('id', todo.id).then(() => loadTodos());
            }
        } else {
            Alert.alert('Löschen', `"${todo.title}" wirklich löschen?`, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Löschen', style: 'destructive', onPress: async () => { await supabase.from('family_todos').delete().eq('id', todo.id); loadTodos(); } }
            ]);
        }
    };

    const openEdit = (todo: Todo) => {
        setEditTodo(todo); setEditTitle(todo.title); setEditPriority(todo.priority || 'normal');
        setEditAssignee(todo.assigned_to); setEditPoints(todo.points || 0); setEditRecurrence(todo.recurrence || 'none');
        setEditDueDate(todo.due_date || null); setEditCategory(todo.category || null);
        setEditDescription(todo.description || ''); setShowEditDescription(!!(todo.description));
        setShowEditDatePicker(false); setShowEditCategoryPicker(false); setShowEditMemberPicker(false);
        setEditReminder(false); setEditReminderHour(8); setEditReminderMinute(0);
        setEditReminderWeekday(new Date().getDay() === 0 ? 7 : new Date().getDay());
        setEditReminderDay(new Date().getDate()); setShowEditTimePicker(false);
        setShowEditReminderPicker(false);
        setEditEnableReminder(todo.reminder_enabled || false);
        setEditReminderInterval(todo.reminder_interval || '1h');
    };

    const handleSaveEdit = async () => {
        if (!editTodo || !editTitle.trim()) return;
        setIsSavingEdit(true);
        try {
            const { error } = await supabase.from('family_todos')
                .update({
                    title: editTitle.trim(),
                    priority: editPriority,
                    assigned_to: editAssignee,
                    points: editPoints,
                    recurrence: editRecurrence === 'none' ? null : editRecurrence,
                    due_date: editDueDate,
                    category: editCategory,
                    description: editDescription.trim() || null,
                    reminder_enabled: editEnableReminder,
                    reminder_interval: editEnableReminder ? editReminderInterval : null,
                })
                .eq('id', editTodo.id);
            if (error) throw error;
            // Schedule recurring reminder if enabled during edit
            if (editReminder && editRecurrence && editRecurrence !== 'none') {
                try {
                    const WEEKDAY_MAP: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 1 };
                    if (editRecurrence === 'daily') {
                        await Notifications.scheduleNotificationAsync({
                            content: { title: '🔁 Wiederkehrende Aufgabe', body: `"${editTitle.trim()}" steht heute an!`, sound: 'default' },
                            trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: editReminderHour, minute: editReminderMinute },
                        });
                    } else if (editRecurrence === 'weekly') {
                        await Notifications.scheduleNotificationAsync({
                            content: { title: '🔁 Wiederkehrende Aufgabe', body: `"${editTitle.trim()}" steht diese Woche an!`, sound: 'default' },
                            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: WEEKDAY_MAP[editReminderWeekday] || 2, hour: editReminderHour, minute: editReminderMinute },
                        });
                    } else if (editRecurrence === 'monthly') {
                        await Notifications.scheduleNotificationAsync({
                            content: { title: '🔁 Monatliche Aufgabe', body: `"${editTitle.trim()}" steht diesen Monat an!`, sound: 'default' },
                            trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: editReminderDay, hour: editReminderHour, minute: editReminderMinute },
                        });
                    }
                } catch (e) { console.warn('Failed to schedule edit reminder:', e); }
            }
            // Schedule regular task reminder if enabled during edit
            if (editEnableReminder && editDueDate && (!editRecurrence || editRecurrence === 'none')) {
                try {
                    const interval = REMINDER_INTERVALS.find(r => r.key === editReminderInterval);
                    if (interval) {
                        const reminderTime = new Date(new Date(editDueDate).getTime() - interval.ms);
                        if (reminderTime > new Date()) {
                            await Notifications.scheduleNotificationAsync({
                                content: { title: '📋 Aufgabe fällig', body: `"${editTitle.trim()}" ist bald fällig!`, sound: 'default' },
                                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
                            });
                        }
                    }
                } catch (e) { console.warn('Failed to schedule edit task reminder:', e); }
            }
            setEditTodo(null); loadTodos();
        } catch (e: any) { Platform.OS === 'web' ? window.alert(e.message) : Alert.alert('Fehler', e.message); } finally { setIsSavingEdit(false); }
    };

    const getMemberName = (memberId: string | null) => {
        if (!memberId) return null;
        const m = members.find(m => m.id === memberId || m.user_id === memberId);
        return m ? (m.display_name || m.email.split('@')[0]) : null;
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
    const getCurrentUserName = () => {
        if (!user) return 'Du';
        const m = members.find(m => m.user_id === user.id);
        return m?.display_name || m?.email?.split('@')[0] || 'Du';
    };
    const getPriority = (key: string) => PRIORITIES.find(p => p.key === key) || PRIORITIES[1];

    const displayTodos = activeTab === 'tasks' ? oneTimeTodos.filter(t => !t.completed) : recurringTodos.filter(t => !t.completed);

    // ─── RENDER ───────────────────────────────────────────────
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.headerSection}>
                    <View style={styles.headerTop}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>
                                {activeTab === 'tasks' ? 'Aufgaben' : 'Wiederkehrende Aufgaben'}
                            </Text>
                            <Text style={[styles.headerSub, { color: colors.subtext }]}>
                                {activeTab === 'tasks' ? `${openCount} offene Aufgaben` : `${recurringCount} aktiv`}
                            </Text>
                        </View>
                        <Pressable onPress={onClose} style={{ padding: 4, borderRadius: 20, backgroundColor: colors.border }}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>

                    {/* Segmented Tab Bar */}
                    <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
                        <Pressable
                            onPress={() => setActiveTab('tasks')}
                            style={[styles.tab, activeTab === 'tasks' && { backgroundColor: colors.accent + '25', borderColor: colors.accent, borderWidth: 1 }]}
                        >
                            <List size={16} color={activeTab === 'tasks' ? colors.accent : colors.subtext} />
                            <Text style={[styles.tabLabel, { color: activeTab === 'tasks' ? colors.text : colors.subtext }]} numberOfLines={1}>Aufgaben</Text>
                            <View style={[styles.tabBadge, { backgroundColor: activeTab === 'tasks' ? colors.accent + '30' : colors.border }]}>
                                <Text style={[styles.tabBadgeText, { color: activeTab === 'tasks' ? colors.accent : colors.subtext }]}>{openCount}</Text>
                            </View>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveTab('recurring')}
                            style={[styles.tab, activeTab === 'recurring' && { backgroundColor: colors.accent + '25', borderColor: colors.accent, borderWidth: 1 }]}
                        >
                            <RefreshCw size={16} color={activeTab === 'recurring' ? colors.accent : colors.subtext} />
                            <Text style={[styles.tabLabel, { color: activeTab === 'recurring' ? colors.text : colors.subtext }]} numberOfLines={2}>Wiederkehrende{'\n'}Aufgaben</Text>
                            <View style={[styles.tabBadge, { backgroundColor: activeTab === 'recurring' ? colors.accent + '30' : colors.border }]}>
                                <Text style={[styles.tabBadgeText, { color: activeTab === 'recurring' ? colors.accent : colors.subtext }]}>{recurringCount}</Text>
                            </View>
                        </Pressable>
                    </View>
                </View>

                {/* Content */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                    ) : displayTodos.length === 0 ? (
                        /* Empty State */
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.accent + '15' }]}>
                                <View style={[styles.emptyIconInner, { backgroundColor: colors.accent + '25' }]}>
                                    {activeTab === 'tasks' ? (
                                        <CheckSquare size={36} color={colors.accent} />
                                    ) : (
                                        <RefreshCw size={36} color={colors.accent} />
                                    )}
                                </View>
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                {activeTab === 'tasks' ? 'Keine Aufgaben' : 'Noch keine Aufgaben'}
                            </Text>
                            <Text style={[styles.emptySub, { color: colors.subtext }]}>
                                {activeTab === 'tasks'
                                    ? 'Tippe auf +, um deine erste Aufgabe zu erstellen'
                                    : 'Richte wiederkehrende Aufgaben ein wie Putzen oder Müll rausbringen. Sie rotieren automatisch zwischen den Haushaltsmitgliedern.'}
                            </Text>
                            {activeTab === 'recurring' && (
                                <Pressable onPress={() => setShowRecurringAdd(true)} style={[styles.emptyBtn, { borderColor: colors.border }]}>
                                    <Plus size={16} color={colors.text} />
                                    <Text style={[styles.emptyBtnText, { color: colors.text }]}>Aufgabe erstellen</Text>
                                </Pressable>
                            )}
                        </View>
                    ) : (
                        /* Todo List */
                        displayTodos.map(todo => {
                            const prio = getPriority(todo.priority);
                            const assigneeName = getMemberName(todo.assigned_to);
                            const assigneeColor = getMemberColor(todo.assigned_to);
                            return (
                                <View key={todo.id} style={[styles.todoItem, { borderColor: colors.border, backgroundColor: colors.card }]}>
                                    <Pressable onPress={() => handleToggle(todo)} style={styles.todoCheck} hitSlop={10}>
                                        {todo.completed ? (
                                            <CheckCircle2 size={22} color={colors.accent} fill={colors.accent + '30'} />
                                        ) : (
                                            <Circle size={22} color={colors.subtext} />
                                        )}
                                    </Pressable>
                                    {todo.assigned_to && (
                                        <View style={[styles.todoAvatar, { backgroundColor: assigneeColor }]}>
                                            <Text style={styles.todoAvatarText}>{getMemberInitial(todo.assigned_to)}</Text>
                                        </View>
                                    )}
                                    <Pressable style={styles.todoContent} onPress={() => openEdit(todo)}>
                                        <Text style={[styles.todoTitle, { color: todo.completed ? colors.subtext : colors.text }, todo.completed && styles.todoDone]} numberOfLines={2}>{todo.title}</Text>
                                        <View style={styles.todoMeta}>
                                            {todo.due_date && (
                                                <View style={[styles.prioBadge, { backgroundColor: new Date(todo.due_date) < new Date() && !todo.completed ? '#EF444415' : colors.accent + '15' }]}>
                                                    <Calendar size={10} color={new Date(todo.due_date) < new Date() && !todo.completed ? '#EF4444' : colors.accent} />
                                                    <Text style={[styles.prioText, { color: new Date(todo.due_date) < new Date() && !todo.completed ? '#EF4444' : colors.accent }]}>
                                                        {new Date(todo.due_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, {new Date(todo.due_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                                    </Text>
                                                </View>
                                            )}
                                            {assigneeName && (
                                                <View style={[styles.prioBadge, { backgroundColor: assigneeColor + '15' }]}>
                                                    <User size={10} color={assigneeColor} />
                                                    <Text style={[styles.prioText, { color: assigneeColor }]}>{assigneeName}</Text>
                                                </View>
                                            )}
                                            {prio.key !== 'normal' && (
                                                <View style={[styles.prioBadge, { backgroundColor: prio.color + '15' }]}>
                                                    <Text style={{ fontSize: 10 }}>{prio.icon}</Text>
                                                    <Text style={[styles.prioText, { color: prio.color }]}>{prio.label}</Text>
                                                </View>
                                            )}
                                            {todo.recurrence && todo.recurrence !== 'none' && (
                                                <View style={[styles.prioBadge, { backgroundColor: colors.accent + '15' }]}>
                                                    <RefreshCw size={10} color={colors.accent} />
                                                    <Text style={[styles.prioText, { color: colors.accent }]}>{RECURRENCE_OPTIONS.find(r => r.key === todo.recurrence)?.label || todo.recurrence}</Text>
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

                {/* FAB */}
                <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={() => activeTab === 'tasks' ? setShowAddModal(true) : setShowRecurringAdd(true)}>
                    <Plus size={24} color="#fff" />
                </Pressable>
            </View>

            {/* ─── ADD ONE-TIME TASK (Bottom Sheet) ─── */}
            <Modal visible={showAddModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAddModal(false)}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                            <Pressable onPress={() => setShowAddModal(false)}><X size={22} color={colors.subtext} /></Pressable>
                            <View style={{ flex: 1 }} />
                            <Pressable onPress={handleAdd} disabled={isAdding || !newTitle.trim()} style={[styles.createBtn, { backgroundColor: colors.accent, opacity: newTitle.trim() ? 1 : 0.4 }]}>
                                {isAdding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createBtnText}>Erstellen</Text>}
                            </Pressable>
                        </View>
                        <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
                            <TextInput
                                style={[styles.titleInput, { color: colors.text }]}
                                value={newTitle} onChangeText={setNewTitle}
                                placeholder="Titel der Aufgabe" placeholderTextColor={colors.subtext + '80'}
                                autoFocus
                            />
                            {/* Field rows */}
                            <Pressable style={[styles.fieldRow, { borderBottomColor: colors.border }]} onPress={() => setShowDatePicker('date')}>
                                <Calendar size={18} color={colors.accent} />
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Fälligkeitsdatum</Text>
                                <Text style={[styles.fieldValue, { color: newDueDate ? colors.text : colors.subtext }]}>
                                    {newDueDate
                                        ? `${new Date(newDueDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${new Date(newDueDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                                        : 'Nicht gesetzt'}
                                </Text>
                                {newDueDate ? (
                                    <Pressable onPress={() => { setNewDueDate(null); setShowDatePicker(false); }} hitSlop={8}><X size={16} color={colors.subtext} /></Pressable>
                                ) : (
                                    <ChevronRight size={16} color={colors.subtext} />
                                )}
                            </Pressable>
                            {showDatePicker && (
                                <>
                                    <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 }}>
                                        {showDatePicker === 'date' ? 'Datum wählen' : 'Uhrzeit wählen'}
                                    </Text>
                                    {Platform.OS === 'web' ? (
                                        <View style={{ gap: 10, paddingVertical: 8 }}>
                                            <input
                                                type="date"
                                                value={newDueDate ? new Date(newDueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                                                onChange={(e: any) => {
                                                    const d = new Date(e.target.value);
                                                    const prev = newDueDate ? new Date(newDueDate) : new Date();
                                                    d.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                                                    setNewDueDate(d.toISOString());
                                                }}
                                                style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.text, fontSize: 15, width: '100%' } as any}
                                            />
                                            <input
                                                type="time"
                                                value={newDueDate ? `${new Date(newDueDate).getHours().toString().padStart(2, '0')}:${new Date(newDueDate).getMinutes().toString().padStart(2, '0')}` : '08:00'}
                                                onChange={(e: any) => {
                                                    const [h, m] = e.target.value.split(':').map(Number);
                                                    const prev = newDueDate ? new Date(newDueDate) : new Date();
                                                    prev.setHours(h, m, 0, 0);
                                                    setNewDueDate(prev.toISOString());
                                                }}
                                                style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.text, fontSize: 15, width: '100%' } as any}
                                            />
                                            <Pressable onPress={() => setShowDatePicker(false)}>
                                                <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14, textAlign: 'right' }}>Fertig</Text>
                                            </Pressable>
                                        </View>
                                    ) : (
                                        <>
                                            <DateTimePicker
                                                value={newDueDate ? new Date(newDueDate) : new Date()}
                                                mode={showDatePicker === 'date' ? 'date' : 'time'}
                                                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                                minimumDate={showDatePicker === 'date' ? new Date() : undefined}
                                                is24Hour={true}
                                                onChange={(event: any, date?: Date) => {
                                                    if (Platform.OS === 'android') {
                                                        if (event.type === 'dismissed') { setShowDatePicker(false); return; }
                                                        if (date) {
                                                            if (showDatePicker === 'date') {
                                                                const d = new Date(date);
                                                                const now = new Date();
                                                                d.setHours(now.getHours(), now.getMinutes(), 0, 0);
                                                                setNewDueDate(d.toISOString());
                                                                setShowDatePicker('time');
                                                            } else {
                                                                const prev = newDueDate ? new Date(newDueDate) : new Date();
                                                                prev.setHours(date.getHours(), date.getMinutes(), 0, 0);
                                                                setNewDueDate(prev.toISOString());
                                                                setShowDatePicker(false);
                                                            }
                                                        }
                                                    } else {
                                                        if (date) {
                                                            if (showDatePicker === 'date') {
                                                                const d = new Date(date);
                                                                const now = new Date();
                                                                d.setHours(now.getHours(), now.getMinutes(), 0, 0);
                                                                setNewDueDate(d.toISOString());
                                                            } else {
                                                                const prev = newDueDate ? new Date(newDueDate) : new Date();
                                                                prev.setHours(date.getHours(), date.getMinutes(), 0, 0);
                                                                setNewDueDate(prev.toISOString());
                                                            }
                                                        }
                                                    }
                                                }}
                                                accentColor={colors.accent}
                                                themeVariant="dark"
                                            />
                                            {Platform.OS === 'ios' && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingVertical: 4 }}>
                                                    {showDatePicker === 'time' && (
                                                        <Pressable onPress={() => setShowDatePicker('date')}>
                                                            <Text style={{ color: colors.subtext, fontWeight: '600', fontSize: 14 }}>Zurück</Text>
                                                        </Pressable>
                                                    )}
                                                    <Pressable onPress={() => {
                                                        if (showDatePicker === 'date') {
                                                            setShowDatePicker('time');
                                                        } else {
                                                            setShowDatePicker(false);
                                                        }
                                                    }}>
                                                        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>
                                                            {showDatePicker === 'date' ? 'Weiter zur Uhrzeit' : 'Fertig'}
                                                        </Text>
                                                    </Pressable>
                                                </View>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                            <Pressable style={[styles.fieldRow, { borderBottomColor: colors.border }]} onPress={() => setShowCategoryPicker(true)}>
                                <Tag size={18} color={colors.accent} />
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Kategorie</Text>
                                <Text style={[styles.fieldValue, { color: newCategory ? colors.text : colors.subtext }]}>{newCategory || 'Nicht gesetzt'}</Text>
                                <ChevronRight size={16} color={colors.subtext} />
                            </Pressable>
                            <Pressable style={[styles.fieldRow, { borderBottomColor: colors.border }]} onPress={() => setShowMemberPicker(true)}>
                                <Users size={18} color={colors.accent} />
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Teilnehmer</Text>
                                <Text style={[styles.fieldValue, { color: colors.text }]}>{selectedMember ? getMemberName(selectedMember) : getCurrentUserName()}</Text>
                                <ChevronRight size={16} color={colors.subtext} />
                            </Pressable>
                            {/* Reminder toggle */}
                            <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                                <Bell size={18} color={colors.accent} />
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Erinnerung</Text>
                                <Switch
                                    value={enableReminder}
                                    onValueChange={handleReminderToggle}
                                    trackColor={{ false: colors.border, true: colors.accent }}
                                    thumbColor={'#fff'}
                                />
                            </View>
                            {enableReminder && (
                                <Pressable onPress={() => setShowReminderPicker(true)} style={[styles.fieldRow, { borderBottomColor: colors.border, paddingLeft: 30 }]}>
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Erinnerung</Text>
                                    <Text style={[styles.fieldValue, { color: colors.accent }]}>{REMINDER_INTERVALS.find(r => r.key === reminderInterval)?.label || '1 Stunde vorher'}</Text>
                                    <ChevronRight size={16} color={colors.subtext} />
                                </Pressable>
                            )}
                            {enableReminder && !checkNotificationPermission() && (
                                <View style={[styles.warningBanner, { backgroundColor: '#F59E0B20' }]}>
                                    <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>⚠️ Aufgaben-Erinnerungen sind in den Einstellungen deaktiviert. Die Erinnerung wird möglicherweise nicht zugestellt.</Text>
                                </View>
                            )}

                            {/* Priority */}
                            <View style={[styles.fieldRow, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <Flag size={18} color={colors.accent} />
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Priorität</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {PRIORITIES.map(p => (
                                        <Pressable key={p.key} onPress={() => setNewPriority(p.key)} style={[styles.chipBtn, { borderColor: newPriority === p.key ? p.color : colors.border, backgroundColor: newPriority === p.key ? p.color + '18' : 'transparent' }]}>
                                            <Text style={{ fontSize: 13 }}>{p.icon}</Text>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: newPriority === p.key ? p.color : colors.subtext }}>{p.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Points */}
                            <View style={[styles.fieldRow, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <Star size={18} color={colors.accent} />
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Punkte</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                    {[-5, -3, -1, 0, 1, 2, 3, 5, 10].map(p => {
                                        const active = newPoints === p;
                                        const col = p < 0 ? '#EF4444' : p > 0 ? '#10B981' : '#F59E0B';
                                        return (
                                            <Pressable key={p} onPress={() => setNewPoints(p)} style={[styles.chipBtn, { paddingHorizontal: 12, borderColor: active ? col : colors.border, backgroundColor: active ? col + '18' : 'transparent' }]}>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: active ? col : colors.subtext }}>{p > 0 ? `+${p}` : `${p}`}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            <Pressable onPress={() => setShowDescription(!showDescription)} style={styles.descBtn}>
                                <View style={[styles.descBtnIcon, { backgroundColor: colors.accent + '15' }]}>
                                    <Plus size={14} color={colors.accent} />
                                </View>
                                <FileText size={16} color={colors.subtext} />
                                <Text style={[styles.descBtnText, { color: colors.subtext }]}>Beschreibung</Text>
                            </Pressable>
                            {showDescription && (
                                <TextInput
                                    style={[styles.descInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                                    value={newDescription} onChangeText={setNewDescription}
                                    placeholder="Beschreibung hinzufügen..." placeholderTextColor={colors.subtext}
                                    multiline numberOfLines={3}
                                />
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>

                {/* Member Picker inside add modal */}
                <Modal visible={showMemberPicker} transparent animationType="fade" onRequestClose={() => setShowMemberPicker(false)}>
                    <Pressable style={styles.pickerOverlay} onPress={() => setShowMemberPicker(false)}>
                        <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Teilnehmer wählen</Text>
                            {members.map((m, idx) => (
                                <Pressable key={m.id} onPress={() => { setSelectedMember(m.id); setShowMemberPicker(false); }} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
                                    <View style={[styles.pickerAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                                        <Text style={styles.pickerAvatarText}>{(m.display_name || m.email)[0].toUpperCase()}</Text>
                                    </View>
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{m.display_name || m.email.split('@')[0]}</Text>
                                    {selectedMember === m.id && <Check size={18} color={colors.accent} />}
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>

                {/* Category Picker */}
                <Modal visible={showCategoryPicker} transparent animationType="fade" onRequestClose={() => setShowCategoryPicker(false)}>
                    <Pressable style={styles.pickerOverlay} onPress={() => setShowCategoryPicker(false)}>
                        <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Kategorie wählen</Text>
                            {CATEGORIES.map(cat => (
                                <Pressable key={cat} onPress={() => { setNewCategory(cat); setShowCategoryPicker(false); }} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{cat}</Text>
                                    {newCategory === cat && <Check size={18} color={colors.accent} />}
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>

                {/* Reminder Interval Picker */}
                <Modal visible={showReminderPicker} transparent animationType="fade" onRequestClose={() => setShowReminderPicker(false)}>
                    <Pressable style={styles.pickerOverlay} onPress={() => setShowReminderPicker(false)}>
                        <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Erinnerung</Text>
                            {REMINDER_INTERVALS.map(r => (
                                <Pressable key={r.key} onPress={() => { setReminderInterval(r.key); setShowReminderPicker(false); }} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{r.label}</Text>
                                    {reminderInterval === r.key && <Check size={18} color={colors.accent} />}
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>
            </Modal>

            {/* ─── ADD RECURRING TASK (Bottom Sheet) ─── */}
            <Modal visible={showRecurringAdd} animationType="slide" presentationStyle="formSheet" onRequestClose={() => { setShowRecurringAdd(false); setRecurringStep('quick'); }}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                            <Pressable onPress={() => { setShowRecurringAdd(false); setRecurringStep('quick'); }}><X size={22} color={colors.subtext} /></Pressable>
                            <View style={{ flex: 1 }} />
                            {recurringStep === 'quick' ? (
                                <Pressable onPress={() => setRecurringStep('form')} style={[styles.createBtn, { backgroundColor: colors.accent }]}>
                                    <Text style={styles.createBtnText}>Weiter</Text>
                                    <ChevronRight size={14} color="#fff" />
                                </Pressable>
                            ) : (
                                <Pressable onPress={() => handleAddRecurring()} disabled={isAddingRecurring || !recurringTitle.trim()} style={[styles.createBtn, { backgroundColor: colors.accent, opacity: recurringTitle.trim() ? 1 : 0.4 }]}>
                                    {isAddingRecurring ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createBtnText}>Erstellen</Text>}
                                </Pressable>
                            )}
                        </View>

                        <ScrollView style={{ flex: 1, padding: 16 }}>
                            {recurringStep === 'quick' ? (
                                <>
                                    {/* Schnellstart */}
                                    <View style={styles.sectionRow}>
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Schnellstart</Text>
                                        <Pressable onPress={() => setShowTemplates(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Alle anzeigen</Text>
                                            <ChevronRight size={14} color={colors.accent} />
                                        </Pressable>
                                    </View>
                                    <View style={styles.chipGrid}>
                                        {QUICK_START_TASKS.map(task => (
                                            <Pressable key={task.title} onPress={() => handleAddRecurring(task.title)} style={[styles.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                <Text style={{ fontSize: 16 }}>{task.emoji}</Text>
                                                <Text style={[styles.quickChipText, { color: colors.text }]}>{task.title}</Text>
                                            </Pressable>
                                        ))}
                                    </View>

                                    {/* Divider */}
                                    <View style={styles.divider}>
                                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                                        <Text style={{ color: colors.subtext, fontSize: 12, marginHorizontal: 12 }}>oder manuell erstellen</Text>
                                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                                    </View>

                                    {/* Recurring icon */}
                                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                        <View style={[styles.recurringIcon, { backgroundColor: colors.accent + '20' }]}>
                                            <RefreshCw size={28} color={colors.accent} />
                                        </View>
                                    </View>

                                    {/* Manual form */}
                                    <TextInput
                                        style={[styles.titleInput, { color: colors.text }]}
                                        value={recurringTitle} onChangeText={setRecurringTitle}
                                        placeholder="Aufgabentitel" placeholderTextColor={colors.subtext + '80'}
                                    />
                                    <Pressable style={[styles.fieldRow, { borderBottomColor: colors.border }]} onPress={() => setShowRecurringCategoryPicker(true)}>
                                        <Tag size={18} color={colors.accent} />
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Kategorie</Text>
                                        <Text style={[styles.fieldValue, { color: recurringCategory ? colors.text : colors.subtext }]}>{recurringCategory || 'Nicht gesetzt'}</Text>
                                        <ChevronRight size={16} color={colors.subtext} />
                                    </Pressable>
                                    <Pressable style={[styles.fieldRow, { borderBottomColor: colors.border }]} onPress={() => setShowRecurringDescription(!showRecurringDescription)}>
                                        <FileText size={18} color={colors.accent} />
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Beschreibung</Text>
                                        <Text style={[styles.fieldValue, { color: colors.accent }]}>Hinzufügen +</Text>
                                    </Pressable>
                                    {showRecurringDescription && (
                                        <TextInput
                                            style={[styles.descInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                                            value={recurringDescription} onChangeText={setRecurringDescription}
                                            placeholder="Beschreibung hinzufügen..." placeholderTextColor={colors.subtext}
                                            multiline numberOfLines={3}
                                        />
                                    )}
                                </>
                            ) : (
                                /* Step 2: Recurrence + Assignee */
                                <>
                                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Wiederholung</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                                        {RECURRENCE_OPTIONS.filter(r => r.key !== 'none').map(r => (
                                            <Pressable key={r.key} onPress={() => setRecurringRecurrence(r.key)} style={[styles.quickChip, { backgroundColor: recurringRecurrence === r.key ? colors.accent + '20' : colors.card, borderColor: recurringRecurrence === r.key ? colors.accent : colors.border }]}>
                                                <Text style={{ fontSize: 14 }}>{r.icon}</Text>
                                                <Text style={{ color: recurringRecurrence === r.key ? colors.accent : colors.subtext, fontWeight: '600', fontSize: 13 }}>{r.label}</Text>
                                            </Pressable>
                                        ))}
                                    </View>

                                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Zuweisen an</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                        <Pressable style={[styles.quickChip, { backgroundColor: !recurringAssignee ? colors.accent + '20' : colors.card, borderColor: !recurringAssignee ? colors.accent : colors.border }]} onPress={() => setRecurringAssignee(null)}>
                                            <Text style={{ color: !recurringAssignee ? colors.accent : colors.subtext, fontWeight: '600' }}>Alle</Text>
                                        </Pressable>
                                        {members.map((m, idx) => (
                                            <Pressable key={m.id} onPress={() => setRecurringAssignee(m.id)} style={[styles.quickChip, { backgroundColor: recurringAssignee === m.id ? AVATAR_COLORS[idx % AVATAR_COLORS.length] + '20' : colors.card, borderColor: recurringAssignee === m.id ? AVATAR_COLORS[idx % AVATAR_COLORS.length] : colors.border }]}>
                                                <View style={[{ width: 22, height: 22, borderRadius: 11, backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length], alignItems: 'center', justifyContent: 'center' }]}>
                                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{(m.display_name || m.email)[0].toUpperCase()}</Text>
                                                </View>
                                                <Text style={{ color: recurringAssignee === m.id ? AVATAR_COLORS[idx % AVATAR_COLORS.length] : colors.subtext, fontWeight: '600', fontSize: 13 }}>{m.display_name || m.email.split('@')[0]}</Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>

                                    {/* Reminder */}
                                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12, marginTop: 20 }]}>Erinnerung</Text>
                                    <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                                        <Bell size={18} color={colors.accent} />
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Erinnerung aktivieren</Text>
                                        <Switch
                                            value={recurringReminder}
                                            onValueChange={(val) => {
                                                if (val && (Platform.OS as string) !== 'web' && !checkNotificationPermission()) {
                                                    Alert.alert('Benachrichtigungen deaktiviert', 'Bitte aktiviere Aufgaben-Erinnerungen in den Einstellungen.', [
                                                        { text: 'OK', style: 'cancel' },
                                                        { text: 'Trotzdem aktivieren', onPress: () => setRecurringReminder(true) },
                                                    ]);
                                                    return;
                                                }
                                                setRecurringReminder(val);
                                            }}
                                            trackColor={{ false: colors.border, true: colors.accent }}
                                            thumbColor={'#fff'}
                                        />
                                    </View>
                                    {recurringReminder && (
                                        <>
                                            {/* Weekday picker for weekly */}
                                            {recurringRecurrence === 'weekly' && (
                                                <View style={{ marginTop: 8 }}>
                                                    <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8, paddingLeft: 30 }}>Wochentag</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingLeft: 30 }}>
                                                        {[{ k: 1, l: 'Mo' }, { k: 2, l: 'Di' }, { k: 3, l: 'Mi' }, { k: 4, l: 'Do' }, { k: 5, l: 'Fr' }, { k: 6, l: 'Sa' }, { k: 7, l: 'So' }].map(d => (
                                                            <Pressable key={d.k} onPress={() => setRecurringReminderWeekday(d.k)} style={[styles.chipBtn, { paddingHorizontal: 14, borderColor: recurringReminderWeekday === d.k ? colors.accent : colors.border, backgroundColor: recurringReminderWeekday === d.k ? colors.accent + '18' : 'transparent' }]}>
                                                                <Text style={{ fontSize: 13, fontWeight: '700', color: recurringReminderWeekday === d.k ? colors.accent : colors.subtext }}>{d.l}</Text>
                                                            </Pressable>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            )}

                                            {/* Day of month picker for monthly */}
                                            {recurringRecurrence === 'monthly' && (
                                                <View style={{ marginTop: 8 }}>
                                                    <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8, paddingLeft: 30 }}>Tag im Monat</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingLeft: 30 }}>
                                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                            <Pressable key={d} onPress={() => setRecurringReminderDay(d)} style={[styles.chipBtn, { paddingHorizontal: 10, minWidth: 38, justifyContent: 'center', borderColor: recurringReminderDay === d ? colors.accent : colors.border, backgroundColor: recurringReminderDay === d ? colors.accent + '18' : 'transparent' }]}>
                                                                <Text style={{ fontSize: 13, fontWeight: '700', color: recurringReminderDay === d ? colors.accent : colors.subtext }}>{d}</Text>
                                                            </Pressable>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            )}

                                            <Pressable onPress={() => setShowRecurringTimePicker(!showRecurringTimePicker)} style={[styles.fieldRow, { borderBottomColor: colors.border, paddingLeft: 30 }]}>
                                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Uhrzeit</Text>
                                                <Text style={[styles.fieldValue, { color: colors.accent }]}>{`${String(recurringReminderHour).padStart(2, '0')}:${String(recurringReminderMinute).padStart(2, '0')}`}</Text>
                                                <ChevronRight size={16} color={colors.subtext} />
                                            </Pressable>
                                            {showRecurringTimePicker && (
                                                (Platform.OS as string) === 'web' ? (
                                                    <View style={{ paddingLeft: 30, paddingVertical: 8 }}>
                                                        <input
                                                            type="time"
                                                            value={`${String(recurringReminderHour).padStart(2, '0')}:${String(recurringReminderMinute).padStart(2, '0')}`}
                                                            onChange={(e: any) => {
                                                                const [h, m] = e.target.value.split(':').map(Number);
                                                                setRecurringReminderHour(h);
                                                                setRecurringReminderMinute(m);
                                                            }}
                                                            style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.text, fontSize: 15, width: '100%' } as any}
                                                        />
                                                    </View>
                                                ) : (
                                                    <DateTimePicker
                                                        value={(() => { const d = new Date(); d.setHours(recurringReminderHour, recurringReminderMinute, 0, 0); return d; })()}
                                                        mode="time"
                                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                        is24Hour={true}
                                                        onChange={(event: any, date?: Date) => {
                                                            if (Platform.OS === 'android') setShowRecurringTimePicker(false);
                                                            if (date) {
                                                                setRecurringReminderHour(date.getHours());
                                                                setRecurringReminderMinute(date.getMinutes());
                                                            }
                                                        }}
                                                        accentColor={colors.accent}
                                                        themeVariant="dark"
                                                    />
                                                )
                                            )}
                                            <View style={[styles.warningBanner, { backgroundColor: colors.accent + '10' }]}>
                                                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                                                    {recurringRecurrence === 'daily'
                                                        ? `📆 Täglich um ${String(recurringReminderHour).padStart(2, '0')}:${String(recurringReminderMinute).padStart(2, '0')}`
                                                        : recurringRecurrence === 'weekly'
                                                            ? `📅 Jeden ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][recurringReminderWeekday - 1]} um ${String(recurringReminderHour).padStart(2, '0')}:${String(recurringReminderMinute).padStart(2, '0')}`
                                                            : `🗓️ Am ${recurringReminderDay}. jeden Monats um ${String(recurringReminderHour).padStart(2, '0')}:${String(recurringReminderMinute).padStart(2, '0')}`
                                                    }
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>

                {/* Templates Modal */}
                <Modal visible={showTemplates} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowTemplates(false)}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View>
                                <Text style={[styles.headerTitle, { color: colors.text }]}>Aufgabenvorlagen</Text>
                                <Text style={[styles.headerSub, { color: colors.subtext }]}>Wähle eine Vorlage für einen schnellen Start</Text>
                            </View>
                            <Pressable onPress={() => { setShowTemplates(false); setExpandedTemplateCategory(null); }} style={[styles.closePill, { backgroundColor: colors.card }]}>
                                <X size={18} color={colors.subtext} />
                            </Pressable>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
                            {TASK_TEMPLATES.map(cat => {
                                const isExpanded = expandedTemplateCategory === cat.category;
                                return (
                                    <View key={cat.category} style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }]}>
                                        {/* Category header */}
                                        <Pressable
                                            onPress={() => setExpandedTemplateCategory(isExpanded ? null : cat.category)}
                                            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}
                                        >
                                            <View style={[styles.templateEmoji, { backgroundColor: colors.accent + '15' }]}>
                                                <Text style={{ fontSize: 28 }}>{cat.emoji}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.templateTitle, { color: colors.text }]}>{cat.category}</Text>
                                                <Text style={{ color: colors.subtext, fontSize: 13 }}>{cat.templates.length} Vorlagen</Text>
                                            </View>
                                            {isExpanded ? (
                                                <ChevronDown size={18} color={colors.subtext} />
                                            ) : (
                                                <ChevronRight size={18} color={colors.subtext} />
                                            )}
                                        </Pressable>
                                        {/* Expanded templates */}
                                        {isExpanded && (
                                            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                                                {cat.templates.map((tmpl, idx) => (
                                                    <View key={tmpl.title} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 }, idx > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border + '60' }]}>
                                                        <Text style={{ fontSize: 20 }}>{tmpl.emoji}</Text>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{tmpl.title}</Text>
                                                            <Text style={{ color: colors.subtext, fontSize: 12 }}>{tmpl.recurrence}</Text>
                                                        </View>
                                                        <Pressable
                                                            onPress={() => {
                                                                setRecurringTitle(tmpl.title);
                                                                const rec = tmpl.recurrence === 'Täglich' ? 'daily' : tmpl.recurrence === 'Monatlich' ? 'monthly' : 'weekly';
                                                                setRecurringRecurrence(rec);
                                                                setShowTemplates(false);
                                                                setExpandedTemplateCategory(null);
                                                                setRecurringStep('form');
                                                            }}
                                                            style={[styles.useBtn, { borderColor: colors.accent }]}
                                                        >
                                                            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Nutzen</Text>
                                                        </Pressable>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </Modal>

                {/* Recurring Category Picker */}
                <Modal visible={showRecurringCategoryPicker} transparent animationType="fade" onRequestClose={() => setShowRecurringCategoryPicker(false)}>
                    <Pressable style={styles.pickerOverlay} onPress={() => setShowRecurringCategoryPicker(false)}>
                        <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Kategorie wählen</Text>
                            {CATEGORIES.map(cat => (
                                <Pressable key={cat} onPress={() => { setRecurringCategory(cat); setShowRecurringCategoryPicker(false); }} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{cat}</Text>
                                    {recurringCategory === cat && <Check size={18} color={colors.accent} />}
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>
            </Modal>

            {/* ─── EDIT MODAL ─── */}
            <Modal visible={!!editTodo} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setEditTodo(null)}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                            <Pressable onPress={() => setEditTodo(null)}><X size={22} color={colors.subtext} /></Pressable>
                            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Aufgabe bearbeiten</Text>
                            <Pressable onPress={handleSaveEdit} disabled={isSavingEdit} style={[styles.createBtn, { backgroundColor: colors.accent, opacity: editTitle.trim() ? 1 : 0.4 }]}>
                                {isSavingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createBtnText}>Speichern</Text>}
                            </Pressable>
                        </View>
                        <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
                            <TextInput
                                style={[styles.titleInput, { color: colors.text }]}
                                value={editTitle} onChangeText={setEditTitle}
                                placeholder="Titel der Aufgabe" placeholderTextColor={colors.subtext + '80'}
                            />

                            {/* Due date — only for one-time tasks */}
                            {(!editTodo?.recurrence || editTodo.recurrence === 'none') && (
                                <>
                                    <Pressable style={[styles.fieldRow, { borderBottomColor: colors.border }]} onPress={() => setShowEditDatePicker('date')}>
                                        <Calendar size={18} color={colors.accent} />
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Fälligkeitsdatum</Text>
                                        <Text style={[styles.fieldValue, { color: editDueDate ? colors.text : colors.subtext }]}>
                                            {editDueDate
                                                ? `${new Date(editDueDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${new Date(editDueDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                                                : 'Nicht gesetzt'}
                                        </Text>
                                        {editDueDate ? (
                                            <Pressable onPress={() => { setEditDueDate(null); setShowEditDatePicker(false); }} hitSlop={8}><X size={16} color={colors.subtext} /></Pressable>
                                        ) : (
                                            <ChevronRight size={16} color={colors.subtext} />
                                        )}
                                    </Pressable>
                                    {showEditDatePicker && (
                                        <>
                                            <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 }}>
                                                {showEditDatePicker === 'date' ? 'Datum wählen' : 'Uhrzeit wählen'}
                                            </Text>
                                            {Platform.OS === 'web' ? (
                                                <View style={{ gap: 10, paddingVertical: 8 }}>
                                                    <input
                                                        type="date"
                                                        value={editDueDate ? new Date(editDueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                                                        onChange={(e: any) => {
                                                            const d = new Date(e.target.value);
                                                            const prev = editDueDate ? new Date(editDueDate) : new Date();
                                                            d.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                                                            setEditDueDate(d.toISOString());
                                                        }}
                                                        style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.text, fontSize: 15, width: '100%' } as any}
                                                    />
                                                    <input
                                                        type="time"
                                                        value={editDueDate ? `${new Date(editDueDate).getHours().toString().padStart(2, '0')}:${new Date(editDueDate).getMinutes().toString().padStart(2, '0')}` : '08:00'}
                                                        onChange={(e: any) => {
                                                            const [h, m] = e.target.value.split(':').map(Number);
                                                            const prev = editDueDate ? new Date(editDueDate) : new Date();
                                                            prev.setHours(h, m, 0, 0);
                                                            setEditDueDate(prev.toISOString());
                                                        }}
                                                        style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.text, fontSize: 15, width: '100%' } as any}
                                                    />
                                                    <Pressable onPress={() => setShowEditDatePicker(false)}>
                                                        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14, textAlign: 'right' }}>Fertig</Text>
                                                    </Pressable>
                                                </View>
                                            ) : (
                                                <>
                                                    <DateTimePicker
                                                        value={editDueDate ? new Date(editDueDate) : new Date()}
                                                        mode={showEditDatePicker === 'date' ? 'date' : 'time'}
                                                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                                        minimumDate={showEditDatePicker === 'date' ? new Date() : undefined}
                                                        is24Hour={true}
                                                        onChange={(event: any, date?: Date) => {
                                                            if (Platform.OS === 'android') {
                                                                if (event.type === 'dismissed') { setShowEditDatePicker(false); return; }
                                                                if (date) {
                                                                    if (showEditDatePicker === 'date') {
                                                                        const d = new Date(date);
                                                                        const now = new Date();
                                                                        d.setHours(now.getHours(), now.getMinutes(), 0, 0);
                                                                        setEditDueDate(d.toISOString());
                                                                        setShowEditDatePicker('time');
                                                                    } else {
                                                                        const prev = editDueDate ? new Date(editDueDate) : new Date();
                                                                        prev.setHours(date.getHours(), date.getMinutes(), 0, 0);
                                                                        setEditDueDate(prev.toISOString());
                                                                        setShowEditDatePicker(false);
                                                                    }
                                                                }
                                                            } else {
                                                                if (date) {
                                                                    if (showEditDatePicker === 'date') {
                                                                        const d = new Date(date);
                                                                        const now = new Date();
                                                                        d.setHours(now.getHours(), now.getMinutes(), 0, 0);
                                                                        setEditDueDate(d.toISOString());
                                                                    } else {
                                                                        const prev = editDueDate ? new Date(editDueDate) : new Date();
                                                                        prev.setHours(date.getHours(), date.getMinutes(), 0, 0);
                                                                        setEditDueDate(prev.toISOString());
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        accentColor={colors.accent}
                                                        themeVariant="dark"
                                                    />
                                                    {Platform.OS === 'ios' && (
                                                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingVertical: 4 }}>
                                                            {showEditDatePicker === 'time' && (
                                                                <Pressable onPress={() => setShowEditDatePicker('date')}>
                                                                    <Text style={{ color: colors.subtext, fontWeight: '600', fontSize: 14 }}>Zurück</Text>
                                                                </Pressable>
                                                            )}
                                                            <Pressable onPress={() => {
                                                                if (showEditDatePicker === 'date') setShowEditDatePicker('time');
                                                                else setShowEditDatePicker(false);
                                                            }}>
                                                                <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>
                                                                    {showEditDatePicker === 'date' ? 'Weiter zur Uhrzeit' : 'Fertig'}
                                                                </Text>
                                                            </Pressable>
                                                        </View>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {/* Recurrence type — only for recurring tasks */}
                            {editTodo?.recurrence && editTodo.recurrence !== 'none' && (
                                <View style={[styles.fieldRow, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                        <RefreshCw size={18} color={colors.accent} />
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Wiederholung</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {RECURRENCE_OPTIONS.filter(r => r.key !== 'none').map(r => (
                                            <Pressable key={r.key} onPress={() => setEditRecurrence(r.key)} style={[styles.chipBtn, { backgroundColor: editRecurrence === r.key ? colors.accent + '18' : 'transparent', borderColor: editRecurrence === r.key ? colors.accent : colors.border }]}>
                                                <Text style={{ fontSize: 14 }}>{r.icon}</Text>
                                                <Text style={{ color: editRecurrence === r.key ? colors.accent : colors.subtext, fontWeight: '600', fontSize: 13 }}>{r.label}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Category */}
                            <Pressable style={[styles.fieldRow, { borderBottomColor: colors.border }]} onPress={() => setShowEditCategoryPicker(true)}>
                                <Tag size={18} color={colors.accent} />
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Kategorie</Text>
                                <Text style={[styles.fieldValue, { color: editCategory ? colors.text : colors.subtext }]}>{editCategory || 'Nicht gesetzt'}</Text>
                                <ChevronRight size={16} color={colors.subtext} />
                            </Pressable>

                            {/* Assignee */}
                            <Pressable style={[styles.fieldRow, { borderBottomColor: colors.border }]} onPress={() => setShowEditMemberPicker(true)}>
                                <Users size={18} color={colors.accent} />
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Teilnehmer</Text>
                                <Text style={[styles.fieldValue, { color: colors.text }]}>{editAssignee ? getMemberName(editAssignee) || 'Unbekannt' : 'Niemand'}</Text>
                                <ChevronRight size={16} color={colors.subtext} />
                            </Pressable>

                            {/* Priority */}
                            <View style={[styles.fieldRow, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <Flag size={18} color={colors.accent} />
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Priorität</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {PRIORITIES.map(p => (
                                        <Pressable key={p.key} onPress={() => setEditPriority(p.key)} style={[styles.chipBtn, { borderColor: editPriority === p.key ? p.color : colors.border, backgroundColor: editPriority === p.key ? p.color + '18' : 'transparent' }]}>
                                            <Text style={{ fontSize: 13 }}>{p.icon}</Text>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: editPriority === p.key ? p.color : colors.subtext }}>{p.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Points */}
                            <View style={[styles.fieldRow, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <Star size={18} color={colors.accent} />
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Punkte</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                    {[-5, -3, -1, 0, 1, 2, 3, 5, 10].map(p => {
                                        const active = editPoints === p;
                                        const col = p < 0 ? '#EF4444' : p > 0 ? '#10B981' : '#F59E0B';
                                        return (
                                            <Pressable key={p} onPress={() => setEditPoints(p)} style={[styles.chipBtn, { paddingHorizontal: 12, borderColor: active ? col : colors.border, backgroundColor: active ? col + '18' : 'transparent' }]}>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: active ? col : colors.subtext }}>{p > 0 ? `+${p}` : `${p}`}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Description */}
                            <Pressable onPress={() => setShowEditDescription(!showEditDescription)} style={[styles.descBtn, { marginTop: 16 }]}>
                                <View style={[styles.descBtnIcon, { backgroundColor: colors.accent + '15' }]}>
                                    <Plus size={14} color={colors.accent} />
                                </View>
                                <FileText size={16} color={colors.subtext} />
                                <Text style={[styles.descBtnText, { color: colors.subtext }]}>Beschreibung</Text>
                            </Pressable>
                            {showEditDescription && (
                                <TextInput
                                    style={[styles.descInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                                    value={editDescription} onChangeText={setEditDescription}
                                    placeholder="Beschreibung..." placeholderTextColor={colors.subtext}
                                    multiline numberOfLines={3}
                                />
                            )}

                            {/* Reminder — for non-recurring tasks */}
                            {(!editTodo?.recurrence || editTodo.recurrence === 'none') && (
                                <>
                                    <View style={[styles.fieldRow, { borderBottomColor: colors.border, marginTop: 8 }]}>
                                        <Bell size={18} color={colors.accent} />
                                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Erinnerung</Text>
                                        <Switch
                                            value={editEnableReminder}
                                            onValueChange={(val) => {
                                                if (val && (Platform.OS as string) !== 'web' && !checkNotificationPermission()) {
                                                    Alert.alert('Benachrichtigungen deaktiviert', 'Bitte aktiviere Aufgaben-Erinnerungen in den Einstellungen.', [
                                                        { text: 'OK', style: 'cancel' },
                                                        { text: 'Trotzdem', onPress: () => setEditEnableReminder(true) },
                                                    ]);
                                                    return;
                                                }
                                                setEditEnableReminder(val);
                                            }}
                                            trackColor={{ false: colors.border, true: colors.accent }}
                                            thumbColor={'#fff'}
                                        />
                                    </View>
                                    {editEnableReminder && (
                                        <Pressable onPress={() => setShowEditReminderPicker(true)} style={[styles.fieldRow, { borderBottomColor: colors.border, paddingLeft: 30 }]}>
                                            <Text style={[styles.fieldLabel, { color: colors.text }]}>Erinnerung</Text>
                                            <Text style={[styles.fieldValue, { color: colors.accent }]}>{REMINDER_INTERVALS.find(r => r.key === editReminderInterval)?.label || '1 Stunde vorher'}</Text>
                                            <ChevronRight size={16} color={colors.subtext} />
                                        </Pressable>
                                    )}
                                </>
                            )}

                            {/* Recurring Reminder — only for recurring tasks */}
                            {editTodo?.recurrence && editTodo.recurrence !== 'none' && (
                                <>
                                    <View style={{ marginTop: 16 }}>
                                        <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                                            <Bell size={18} color={colors.accent} />
                                            <Text style={[styles.fieldLabel, { color: colors.text }]}>Erinnerung</Text>
                                            <Switch
                                                value={editReminder}
                                                onValueChange={(val) => {
                                                    if (val && (Platform.OS as string) !== 'web' && !checkNotificationPermission()) {
                                                        Alert.alert('Benachrichtigungen deaktiviert', 'Bitte aktiviere Aufgaben-Erinnerungen in den Einstellungen.', [
                                                            { text: 'OK', style: 'cancel' },
                                                            { text: 'Trotzdem', onPress: () => setEditReminder(true) },
                                                        ]);
                                                        return;
                                                    }
                                                    setEditReminder(val);
                                                }}
                                                trackColor={{ false: colors.border, true: colors.accent }}
                                                thumbColor={'#fff'}
                                            />
                                        </View>
                                    </View>
                                    {editReminder && (
                                        <>
                                            {editRecurrence === 'weekly' && (
                                                <View style={{ marginTop: 8 }}>
                                                    <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8, paddingLeft: 30 }}>Wochentag</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingLeft: 30 }}>
                                                        {[{ k: 1, l: 'Mo' }, { k: 2, l: 'Di' }, { k: 3, l: 'Mi' }, { k: 4, l: 'Do' }, { k: 5, l: 'Fr' }, { k: 6, l: 'Sa' }, { k: 7, l: 'So' }].map(d => (
                                                            <Pressable key={d.k} onPress={() => setEditReminderWeekday(d.k)} style={[styles.chipBtn, { paddingHorizontal: 14, borderColor: editReminderWeekday === d.k ? colors.accent : colors.border, backgroundColor: editReminderWeekday === d.k ? colors.accent + '18' : 'transparent' }]}>
                                                                <Text style={{ fontSize: 13, fontWeight: '700', color: editReminderWeekday === d.k ? colors.accent : colors.subtext }}>{d.l}</Text>
                                                            </Pressable>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            )}
                                            {editRecurrence === 'monthly' && (
                                                <View style={{ marginTop: 8 }}>
                                                    <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8, paddingLeft: 30 }}>Tag im Monat</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingLeft: 30 }}>
                                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                            <Pressable key={d} onPress={() => setEditReminderDay(d)} style={[styles.chipBtn, { paddingHorizontal: 10, minWidth: 38, justifyContent: 'center', borderColor: editReminderDay === d ? colors.accent : colors.border, backgroundColor: editReminderDay === d ? colors.accent + '18' : 'transparent' }]}>
                                                                <Text style={{ fontSize: 13, fontWeight: '700', color: editReminderDay === d ? colors.accent : colors.subtext }}>{d}</Text>
                                                            </Pressable>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            )}
                                            <Pressable onPress={() => setShowEditTimePicker(!showEditTimePicker)} style={[styles.fieldRow, { borderBottomColor: colors.border, paddingLeft: 30 }]}>
                                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Uhrzeit</Text>
                                                <Text style={[styles.fieldValue, { color: colors.accent }]}>{`${String(editReminderHour).padStart(2, '0')}:${String(editReminderMinute).padStart(2, '0')}`}</Text>
                                                <ChevronRight size={16} color={colors.subtext} />
                                            </Pressable>
                                            {showEditTimePicker && (
                                                (Platform.OS as string) === 'web' ? (
                                                    <View style={{ paddingLeft: 30, paddingVertical: 8 }}>
                                                        <input
                                                            type="time"
                                                            value={`${String(editReminderHour).padStart(2, '0')}:${String(editReminderMinute).padStart(2, '0')}`}
                                                            onChange={(e: any) => {
                                                                const [h, m] = e.target.value.split(':').map(Number);
                                                                setEditReminderHour(h);
                                                                setEditReminderMinute(m);
                                                            }}
                                                            style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.text, fontSize: 15, width: '100%' } as any}
                                                        />
                                                    </View>
                                                ) : (
                                                    <DateTimePicker
                                                        value={(() => { const d = new Date(); d.setHours(editReminderHour, editReminderMinute, 0, 0); return d; })()}
                                                        mode="time"
                                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                        is24Hour={true}
                                                        onChange={(event: any, date?: Date) => {
                                                            if (Platform.OS === 'android') setShowEditTimePicker(false);
                                                            if (date) {
                                                                setEditReminderHour(date.getHours());
                                                                setEditReminderMinute(date.getMinutes());
                                                            }
                                                        }}
                                                        accentColor={colors.accent}
                                                        themeVariant="dark"
                                                    />
                                                )
                                            )}
                                            <View style={[styles.warningBanner, { backgroundColor: colors.accent + '10' }]}>
                                                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                                                    {editRecurrence === 'daily'
                                                        ? `📆 Täglich um ${String(editReminderHour).padStart(2, '0')}:${String(editReminderMinute).padStart(2, '0')}`
                                                        : editRecurrence === 'weekly'
                                                            ? `📅 Jeden ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][editReminderWeekday - 1]} um ${String(editReminderHour).padStart(2, '0')}:${String(editReminderMinute).padStart(2, '0')}`
                                                            : `🗓️ Am ${editReminderDay}. jeden Monats um ${String(editReminderHour).padStart(2, '0')}:${String(editReminderMinute).padStart(2, '0')}`
                                                    }
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </>
                            )}

                            {/* Delete */}
                            <Pressable onPress={() => { if (editTodo) { handleDelete(editTodo); setEditTodo(null); } }} style={[styles.editDeleteBtn, { marginBottom: 40 }]}>
                                <Trash2 size={16} color="#EF4444" />
                                <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15 }}>Aufgabe löschen</Text>
                            </Pressable>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>

                {/* Edit Category Picker */}
                <Modal visible={showEditCategoryPicker} transparent animationType="fade" onRequestClose={() => setShowEditCategoryPicker(false)}>
                    <Pressable style={styles.pickerOverlay} onPress={() => setShowEditCategoryPicker(false)}>
                        <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Kategorie wählen</Text>
                            {CATEGORIES.map(cat => (
                                <Pressable key={cat} onPress={() => { setEditCategory(cat); setShowEditCategoryPicker(false); }} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{cat}</Text>
                                    {editCategory === cat && <Check size={18} color={colors.accent} />}
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>

                {/* Edit Member Picker */}
                <Modal visible={showEditMemberPicker} transparent animationType="fade" onRequestClose={() => setShowEditMemberPicker(false)}>
                    <Pressable style={styles.pickerOverlay} onPress={() => setShowEditMemberPicker(false)}>
                        <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Teilnehmer wählen</Text>
                            <Pressable onPress={() => { setEditAssignee(null); setShowEditMemberPicker(false); }} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
                                <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Niemand</Text>
                                {!editAssignee && <Check size={18} color={colors.accent} />}
                            </Pressable>
                            {members.map((m, idx) => (
                                <Pressable key={m.id} onPress={() => { setEditAssignee(m.id); setShowEditMemberPicker(false); }} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
                                    <View style={[styles.pickerAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                                        <Text style={styles.pickerAvatarText}>{(m.display_name || m.email)[0].toUpperCase()}</Text>
                                    </View>
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{m.display_name || m.email.split('@')[0]}</Text>
                                    {editAssignee === m.id && <Check size={18} color={colors.accent} />}
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>

                {/* Edit Reminder Interval Picker */}
                <Modal visible={showEditReminderPicker} transparent animationType="fade" onRequestClose={() => setShowEditReminderPicker(false)}>
                    <Pressable style={styles.pickerOverlay} onPress={() => setShowEditReminderPicker(false)}>
                        <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Erinnerung</Text>
                            {REMINDER_INTERVALS.map(r => (
                                <Pressable key={r.key} onPress={() => { setEditReminderInterval(r.key); setShowEditReminderPicker(false); }} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{r.label}</Text>
                                    {editReminderInterval === r.key && <Check size={18} color={colors.accent} />}
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>
            </Modal>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    // Header
    headerSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    headerTitle: { fontSize: 24, fontWeight: '800' },
    headerSub: { fontSize: 13, marginTop: 2 },
    calendarBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    // Tab bar
    tabBar: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: 'transparent' },
    tabLabel: { fontSize: 12, fontWeight: '600' },
    tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, marginLeft: 2 },
    tabBadgeText: { fontSize: 11, fontWeight: '700' },
    // Empty
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 80 },
    emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyIconInner: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1, marginTop: 24 },
    emptyBtnText: { fontSize: 14, fontWeight: '600' },
    // FAB
    fab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    // Todo items
    todoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 8, borderRadius: 14, borderWidth: 1 },
    todoCheck: { marginRight: 10 },
    todoAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    todoAvatarText: { fontSize: 12, fontWeight: '800', color: '#fff' },
    todoContent: { flex: 1 },
    todoTitle: { fontSize: 15, fontWeight: '500' },
    todoDone: { textDecorationLine: 'line-through' },
    todoMeta: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    prioBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    prioText: { fontSize: 10, fontWeight: '600' },
    // Sheet header
    sheetHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
    createBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 4 },
    createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    // Form fields
    titleInput: { fontSize: 22, fontWeight: '300', paddingVertical: 12, marginBottom: 16 },
    fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, gap: 12 },
    fieldLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
    fieldValue: { fontSize: 14 },
    descBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
    descBtnIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    descBtnText: { fontSize: 14, fontWeight: '500' },
    descInput: { marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
    // Pickers
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    pickerCard: { borderRadius: 20, padding: 20, maxHeight: '70%' },
    pickerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
    pickerAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    pickerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    // Recurring
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
    quickChipText: { fontSize: 13, fontWeight: '600' },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    dividerLine: { flex: 1, height: 1 },
    recurringIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    closePill: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    // Templates
    templateCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 14 },
    templateEmoji: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    templateTitle: { fontSize: 16, fontWeight: '700' },
    // Edit
    editLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
    editInput: { fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    editPrioBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
    editPrioText: { fontSize: 12, fontWeight: '600' },
    editDeleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 16, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)' },
    memberChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
    memberChipText: { fontSize: 12, fontWeight: '600' },
    chipAvatar: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    chipAvatarText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    warningBanner: { marginTop: 8, marginBottom: 4, padding: 10, borderRadius: 10 },
    useBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    chipBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5 },
});

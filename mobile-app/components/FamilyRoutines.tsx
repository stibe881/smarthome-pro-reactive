import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Switch, Platform,
} from 'react-native';
import { X, Plus, Trash2, Sun, Moon, Clock, CheckCircle2, Circle, Edit3, ShieldCheck, RotateCcw, Trophy } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface Routine {
    id: string;
    household_id: string;
    title: string;
    time_of_day: string;
    assigned_to_name: string | null;
    steps: string[];
    is_active: boolean;
    requires_parent_confirmation: boolean;
    reset_mode: string; // 'nightly' | 'on_confirm'
    reward_points: number | null;
    created_at: string;
}

const TIME_OPTIONS = [
    { key: 'morning', label: 'Morgens', emoji: '🌅', icon: Sun, color: '#F59E0B' },
    { key: 'afternoon', label: 'Nachmittags', emoji: '☀️', icon: Clock, color: '#3B82F6' },
    { key: 'evening', label: 'Abends', emoji: '🌙', icon: Moon, color: '#8B5CF6' },
];

const RESET_OPTIONS = [
    { key: 'nightly', label: 'Jede Nacht', emoji: '🌙' },
    { key: 'on_confirm', label: 'Nach Bestätigung', emoji: '✅' },
];

const platformAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);
};

const platformConfirm = (title: string, msg: string, onOk: () => void) => {
    if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n${msg}`)) onOk();
    } else {
        Alert.alert(title, msg, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: onOk }]);
    }
};

interface RoutinesProps { visible: boolean; onClose: () => void; }

export const FamilyRoutines: React.FC<RoutinesProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { householdId } = useHousehold();

    const [routines, setRoutines] = useState<Routine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formTime, setFormTime] = useState('morning');
    const [formAssignee, setFormAssignee] = useState('');
    const [formSteps, setFormSteps] = useState<string[]>(['']);
    const [formRequiresConfirmation, setFormRequiresConfirmation] = useState(false);
    const [formResetMode, setFormResetMode] = useState('nightly');
    const [formRewardPoints, setFormRewardPoints] = useState('');
    const [editId, setEditId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Record<string, boolean[]>>({});

    const loadRoutines = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_routines')
                .select('*')
                .eq('household_id', householdId)
                .order('time_of_day')
                .order('title');
            if (error) throw error;
            setRoutines(data || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [householdId]);

    useEffect(() => { if (visible) loadRoutines(); }, [visible, loadRoutines]);

    const handleSave = async () => {
        if (!formTitle.trim() || !householdId) return;
        const filteredSteps = formSteps.filter(s => s.trim());
        if (filteredSteps.length === 0) { platformAlert('Fehler', 'Mindestens einen Schritt hinzufügen.'); return; }
        try {
            const parsedPoints = formRewardPoints.trim() ? parseInt(formRewardPoints, 10) : null;
            const payload = {
                household_id: householdId,
                title: formTitle.trim(),
                time_of_day: formTime,
                assigned_to_name: formAssignee.trim() || null,
                steps: filteredSteps,
                is_active: true,
                requires_parent_confirmation: formRequiresConfirmation,
                reset_mode: formRequiresConfirmation ? formResetMode : 'nightly',
                reward_points: (!isNaN(parsedPoints as number) && parsedPoints !== null && parsedPoints > 0) ? parsedPoints : null,
            };
            if (editId) { await supabase.from('family_routines').update(payload).eq('id', editId); }
            else { await supabase.from('family_routines').insert(payload); }
            resetForm(); loadRoutines();
        } catch (e: any) { platformAlert('Fehler', e.message); }
    };

    const resetForm = () => {
        setFormTitle(''); setFormTime('morning'); setFormAssignee(''); setFormSteps(['']);
        setFormRequiresConfirmation(false); setFormResetMode('nightly'); setFormRewardPoints('');
        setEditId(null); setShowAdd(false);
    };

    const openEdit = (r: Routine) => {
        setFormTitle(r.title); setFormTime(r.time_of_day); setFormAssignee(r.assigned_to_name || '');
        setFormSteps(r.steps.length > 0 ? [...r.steps] : ['']);
        setFormRequiresConfirmation(r.requires_parent_confirmation || false);
        setFormResetMode(r.reset_mode || 'nightly');
        setFormRewardPoints(r.reward_points ? String(r.reward_points) : '');
        setEditId(r.id); setShowAdd(true);
    };

    const handleDelete = (id: string) => {
        platformConfirm('Routine löschen', 'Möchtest du diese Routine wirklich löschen?', async () => {
            try {
                await supabase.from('family_routines').delete().eq('id', id);
                loadRoutines();
            } catch (e: any) { platformAlert('Fehler', e.message); }
        });
    };

    const toggleStep = (routineId: string, stepIdx: number) => {
        setCompletedSteps(prev => {
            const current = prev[routineId] || new Array(routines.find(r => r.id === routineId)?.steps.length || 0).fill(false);
            const updated = [...current];
            updated[stepIdx] = !updated[stepIdx];
            return { ...prev, [routineId]: updated };
        });
    };

    const getTimeInfo = (key: string) => TIME_OPTIONS.find(t => t.key === key) || TIME_OPTIONS[0];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.titleRow}>
                        <Clock size={24} color={colors.accent} />
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Routinen</Text>
                    </View>
                    <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                    {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> :
                        routines.length === 0 ? (
                            <View style={styles.empty}>
                                <Clock size={40} color={colors.subtext} />
                                <Text style={[styles.emptyText, { color: colors.subtext }]}>Noch keine Routinen.{'\n'}Erstelle eine Morgen- oder Abendroutine!</Text>
                            </View>
                        ) : (
                            TIME_OPTIONS.map(time => {
                                const timeRoutines = routines.filter(r => r.time_of_day === time.key);
                                if (timeRoutines.length === 0) return null;
                                return (
                                    <View key={time.key} style={{ marginBottom: 20 }}>
                                        <Text style={[styles.timeLabel, { color: time.color }]}>{time.emoji} {time.label}</Text>
                                        {timeRoutines.map(routine => {
                                            const isExpanded = expandedId === routine.id;
                                            const completed = completedSteps[routine.id] || [];
                                            const doneCount = completed.filter(Boolean).length;
                                            const totalSteps = routine.steps.length;
                                            const allDone = doneCount === totalSteps && totalSteps > 0;
                                            const needsConfirm = routine.requires_parent_confirmation;
                                            return (
                                                <Pressable key={routine.id} style={[styles.routineCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setExpandedId(isExpanded ? null : routine.id)}>
                                                    <View style={styles.routineHeader}>
                                                        <View style={{ flex: 1 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                <Text style={[styles.routineTitle, { color: colors.text }]}>{routine.title}</Text>
                                                                {needsConfirm && <ShieldCheck size={14} color="#F59E0B" />}
                                                            </View>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                                                                {routine.assigned_to_name && <Text style={[styles.routineAssignee, { color: colors.subtext }]}>👤 {routine.assigned_to_name}</Text>}
                                                                <Text style={{ fontSize: 10, color: colors.subtext }}>
                                                                    {routine.reset_mode === 'on_confirm' ? '🔄 Nach Bestätigung' : '🌙 Jede Nacht'}
                                                                </Text>
                                                                {routine.reward_points != null && routine.reward_points > 0 && (
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#F59E0B15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                                        <Trophy size={10} color="#F59E0B" />
                                                                        <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: '700' }}>+{routine.reward_points}</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </View>
                                                        <View style={[styles.progressBadge, { backgroundColor: allDone ? '#10B98120' : colors.accent + '15' }]}>
                                                            <Text style={{ fontSize: 12, fontWeight: '700', color: allDone ? '#10B981' : colors.accent }}>{doneCount}/{totalSteps}</Text>
                                                        </View>
                                                        <Pressable onPress={() => openEdit(routine)} hitSlop={8} style={{ marginLeft: 8 }}><Edit3 size={14} color={colors.subtext} /></Pressable>
                                                        <Pressable onPress={() => handleDelete(routine.id)} hitSlop={8} style={{ marginLeft: 4 }}><Trash2 size={14} color="#EF4444" /></Pressable>
                                                    </View>
                                                    {isExpanded && (
                                                        <View style={styles.stepsContainer}>
                                                            {routine.steps.map((step, idx) => (
                                                                <Pressable key={idx} style={styles.stepRow} onPress={() => toggleStep(routine.id, idx)}>
                                                                    {completed[idx] ? <CheckCircle2 size={20} color="#10B981" fill="#10B98130" /> : <Circle size={20} color={colors.subtext} />}
                                                                    <Text style={[styles.stepText, { color: completed[idx] ? colors.subtext : colors.text }, completed[idx] && styles.stepDone]}>{step}</Text>
                                                                </Pressable>
                                                            ))}

                                                            {/* Parent confirmation banner when all steps done */}
                                                            {allDone && needsConfirm && (
                                                                <View style={[styles.confirmBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
                                                                    <ShieldCheck size={18} color="#F59E0B" />
                                                                    <Text style={{ fontSize: 13, color: '#F59E0B', fontWeight: '600', flex: 1 }}>
                                                                        Warte auf Eltern-Bestätigung
                                                                    </Text>
                                                                </View>
                                                            )}

                                                            {/* Manual reset button */}
                                                            {doneCount > 0 && (
                                                                <Pressable
                                                                    onPress={() => setCompletedSteps(prev => ({ ...prev, [routine.id]: new Array(totalSteps).fill(false) }))}
                                                                    style={[styles.resetRoutineBtn, { borderColor: colors.border }]}
                                                                >
                                                                    <RotateCcw size={14} color={colors.subtext} />
                                                                    <Text style={{ fontSize: 13, color: colors.subtext, fontWeight: '600' }}>Zurücksetzen</Text>
                                                                </Pressable>
                                                            )}
                                                        </View>
                                                    )}
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                );
                            })
                        )}
                </ScrollView>

                {/* FAB */}
                <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={() => { resetForm(); setShowAdd(true); }}>
                    <Plus size={24} color="#fff" />
                </Pressable>

                {/* Add/Edit Modal */}
                <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <Pressable onPress={resetForm}><X size={24} color={colors.subtext} /></Pressable>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>{editId ? 'Bearbeiten' : 'Neue Routine'}</Text>
                            <Pressable onPress={handleSave}><Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>Speichern</Text></Pressable>
                        </View>
                        <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
                            <Text style={[styles.label, { color: colors.subtext }]}>Name</Text>
                            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={formTitle} onChangeText={setFormTitle} placeholder="z.B. Morgenroutine" placeholderTextColor={colors.subtext} />

                            <Text style={[styles.label, { color: colors.subtext, marginTop: 16 }]}>Tageszeit</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {TIME_OPTIONS.map(t => (
                                    <Pressable key={t.key} style={[styles.timeBtn, formTime === t.key && { backgroundColor: t.color + '15', borderColor: t.color }]} onPress={() => setFormTime(t.key)}>
                                        <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: formTime === t.key ? t.color : colors.subtext }}>{t.label}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: colors.subtext, marginTop: 16 }]}>Für wen? (optional)</Text>
                            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={formAssignee} onChangeText={setFormAssignee} placeholder="z.B. Lena" placeholderTextColor={colors.subtext} />

                            <Text style={[styles.label, { color: colors.subtext, marginTop: 16 }]}>Schritte</Text>
                            {formSteps.map((step, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <Text style={{ color: colors.subtext, fontWeight: '700', width: 20 }}>{idx + 1}.</Text>
                                    <TextInput
                                        style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                                        value={step}
                                        onChangeText={text => { const u = [...formSteps]; u[idx] = text; setFormSteps(u); }}
                                        placeholder="Schritt beschreiben..."
                                        placeholderTextColor={colors.subtext}
                                    />
                                    {formSteps.length > 1 && (
                                        <Pressable onPress={() => setFormSteps(formSteps.filter((_, i) => i !== idx))}><Trash2 size={16} color={colors.subtext} /></Pressable>
                                    )}
                                </View>
                            ))}
                            <Pressable style={[styles.addStepBtn, { borderColor: colors.border }]} onPress={() => setFormSteps([...formSteps, ''])}>
                                <Plus size={16} color={colors.accent} /><Text style={{ color: colors.accent, fontWeight: '600' }}>Schritt hinzufügen</Text>
                            </Pressable>

                            {/* --- Reward Points Section --- */}
                            <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 24 }]}>
                                <View style={styles.settingRow}>
                                    <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
                                        <Trophy size={20} color="#F59E0B" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.settingLabel, { color: colors.text }]}>Belohnung (optional)</Text>
                                        <Text style={[styles.settingDescription, { color: colors.subtext }]}>Punkte, die bei Abschluss vergeben werden</Text>
                                    </View>
                                    <TextInput
                                        style={[styles.rewardInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                        value={formRewardPoints}
                                        onChangeText={setFormRewardPoints}
                                        placeholder="0"
                                        placeholderTextColor={colors.subtext}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                    />
                                </View>
                            </View>

                            {/* --- Parent Confirmation Section --- */}
                            <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 24 }]}>
                                <View style={styles.settingRow}>
                                    <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
                                        <ShieldCheck size={20} color="#F59E0B" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.settingLabel, { color: colors.text }]}>Eltern-Bestätigung</Text>
                                        <Text style={[styles.settingDescription, { color: colors.subtext }]}>Ein Elternteil muss bestätigen, wenn alle Schritte erledigt sind</Text>
                                    </View>
                                    <Switch
                                        value={formRequiresConfirmation}
                                        onValueChange={(val) => {
                                            setFormRequiresConfirmation(val);
                                            if (!val) setFormResetMode('nightly');
                                        }}
                                        trackColor={{ false: colors.border, true: '#F59E0B' }}
                                        thumbColor="#fff"
                                    />
                                </View>
                            </View>

                            {/* --- Reset Mode Section --- */}
                            <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                    <View style={[styles.settingIcon, { backgroundColor: '#8B5CF620' }]}>
                                        <RotateCcw size={20} color="#8B5CF6" />
                                    </View>
                                    <View style={{ marginLeft: 12 }}>
                                        <Text style={[styles.settingLabel, { color: colors.text }]}>Zurücksetzen</Text>
                                        <Text style={[styles.settingDescription, { color: colors.subtext }]}>Wann wird die Routine zurückgesetzt?</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {RESET_OPTIONS.map(opt => {
                                        // "on_confirm" only available when parent confirmation is enabled
                                        const disabled = opt.key === 'on_confirm' && !formRequiresConfirmation;
                                        const isSelected = formResetMode === opt.key;
                                        return (
                                            <Pressable
                                                key={opt.key}
                                                disabled={disabled}
                                                onPress={() => setFormResetMode(opt.key)}
                                                style={[
                                                    styles.resetBtn,
                                                    {
                                                        borderColor: isSelected ? '#8B5CF6' : colors.border,
                                                        backgroundColor: isSelected ? '#8B5CF615' : 'transparent',
                                                        opacity: disabled ? 0.4 : 1,
                                                    }
                                                ]}
                                            >
                                                <Text style={{ fontSize: 18 }}>{opt.emoji}</Text>
                                                <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? '#8B5CF6' : colors.subtext, textAlign: 'center' }}>{opt.label}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                                {!formRequiresConfirmation && (
                                    <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 8, fontStyle: 'italic' }}>
                                        Tipp: «Nach Bestätigung» ist nur mit Eltern-Bestätigung verfügbar
                                    </Text>
                                )}
                            </View>
                        </ScrollView>
                    </View>
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
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    timeLabel: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
    fab: {
        position: 'absolute', bottom: 30, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 6, shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    routineCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 8 },
    routineHeader: { flexDirection: 'row', alignItems: 'center' },
    routineTitle: { fontSize: 16, fontWeight: '700' },
    routineAssignee: { fontSize: 12 },
    progressBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    stepsContainer: { marginTop: 12, gap: 8 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepText: { fontSize: 14, flex: 1 },
    stepDone: { textDecorationLine: 'line-through' },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    timeBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', gap: 4 },
    addStepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', marginTop: 4 },
    // New styles for confirmation & reset
    settingCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
    settingRow: { flexDirection: 'row', alignItems: 'center' },
    settingIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    settingLabel: { fontSize: 15, fontWeight: '600' },
    settingDescription: { fontSize: 12, marginTop: 2 },
    resetBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
    confirmBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8 },
    rewardInput: { width: 60, textAlign: 'center', borderWidth: 1, padding: 8, borderRadius: 10, fontSize: 16, fontWeight: '700' },
    resetRoutineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', marginTop: 8 },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal,
} from 'react-native';
import { X, Plus, Trash2, UtensilsCrossed, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MEAL_TYPES = [
    { key: 'breakfast', label: 'Frühstück', emoji: '🥐' },
    { key: 'lunch', label: 'Mittagessen', emoji: '🍝' },
    { key: 'dinner', label: 'Abendessen', emoji: '🥘' },
    { key: 'snack', label: 'Snack', emoji: '🍎' },
];

interface MealPlan {
    id: string;
    household_id: string;
    week_start: string;
    day_of_week: number;
    meal_type: string;
    meal_name: string;
    ingredients: string | null;
    created_at: string;
}

interface MealPlannerProps { visible: boolean; onClose: () => void; }

export const MealPlanner: React.FC<MealPlannerProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [meals, setMeals] = useState<MealPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedDay, setSelectedDay] = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addMealType, setAddMealType] = useState('lunch');
    const [addMealName, setAddMealName] = useState('');
    const [addIngredients, setAddIngredients] = useState('');

    const getWeekStart = useCallback((offset: number) => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }, []);

    const weekStart = getWeekStart(weekOffset);
    const weekLabel = `${weekStart.getDate()}.${weekStart.getMonth() + 1}. – ${new Date(weekStart.getTime() + 6 * 86400000).getDate()}.${(new Date(weekStart.getTime() + 6 * 86400000)).getMonth() + 1}.`;

    const loadMeals = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const ws = getWeekStart(weekOffset).toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('meal_plans')
                .select('*')
                .eq('household_id', householdId)
                .eq('week_start', ws)
                .order('meal_type');
            if (error) throw error;
            setMeals(data || []);
        } catch (e: any) {
            console.error('Error loading meals:', e);
        } finally { setIsLoading(false); }
    }, [householdId, weekOffset]);

    useEffect(() => { if (visible) loadMeals(); }, [visible, loadMeals]);

    const handleAdd = async () => {
        if (!addMealName.trim() || !householdId) return;
        try {
            const ws = getWeekStart(weekOffset).toISOString().split('T')[0];
            await supabase.from('meal_plans').insert({
                household_id: householdId,
                week_start: ws,
                day_of_week: selectedDay,
                meal_type: addMealType,
                meal_name: addMealName.trim(),
                ingredients: addIngredients.trim() || null,
            });
            setAddMealName(''); setAddIngredients(''); setShowAddModal(false);
            loadMeals();
        } catch (e: any) { Alert.alert('Fehler', e.message); }
    };

    const handleDelete = async (id: string) => {
        await supabase.from('meal_plans').delete().eq('id', id);
        loadMeals();
    };

    const handleAddToShoppingList = (meal: MealPlan) => {
        if (!meal.ingredients) { Alert.alert('Info', 'Keine Zutaten hinterlegt.'); return; }
        Alert.alert('Zur Einkaufsliste', `Zutaten für "${meal.meal_name}" wurden kopiert:\n\n${meal.ingredients}\n\nÖffne die Einkaufsliste um sie hinzuzufügen.`);
    };

    const dayMeals = meals.filter(m => m.day_of_week === selectedDay);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.titleRow}>
                        <UtensilsCrossed size={24} color={colors.accent} />
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Essensplaner</Text>
                    </View>
                    <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                {/* Week Nav */}
                <View style={[styles.weekNav, { backgroundColor: colors.card }]}>
                    <Pressable onPress={() => setWeekOffset(w => w - 1)}><ChevronLeft size={20} color={colors.text} /></Pressable>
                    <Text style={[styles.weekLabel, { color: colors.text }]}>KW {weekLabel}</Text>
                    <Pressable onPress={() => setWeekOffset(w => w + 1)}><ChevronRight size={20} color={colors.text} /></Pressable>
                </View>

                {/* Day Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
                    {DAYS.map((day, i) => (
                        <Pressable
                            key={day}
                            style={[styles.dayTab, selectedDay === i && { backgroundColor: colors.accent }]}
                            onPress={() => setSelectedDay(i)}
                        >
                            <Text style={[styles.dayTabText, { color: selectedDay === i ? '#fff' : colors.subtext }]}>{day.substring(0, 2)}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <Text style={[styles.dayTitle, { color: colors.text }]}>{DAYS[selectedDay]}</Text>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> : (
                        <>
                            {MEAL_TYPES.map(mt => {
                                const typeMeals = dayMeals.filter(m => m.meal_type === mt.key);
                                return (
                                    <View key={mt.key} style={[styles.mealSection, { borderColor: colors.border }]}>
                                        <Text style={[styles.mealTypeLabel, { color: colors.subtext }]}>{mt.emoji} {mt.label}</Text>
                                        {typeMeals.length === 0 ? (
                                            <Pressable onPress={() => { setAddMealType(mt.key); setShowAddModal(true); }}>
                                                <Text style={[styles.addMealHint, { color: colors.accent }]}>+ Hinzufügen</Text>
                                            </Pressable>
                                        ) : typeMeals.map(meal => (
                                            <View key={meal.id} style={[styles.mealItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.mealName, { color: colors.text }]}>{meal.meal_name}</Text>
                                                    {meal.ingredients && <Text style={[styles.mealIngredients, { color: colors.subtext }]} numberOfLines={2}>{meal.ingredients}</Text>}
                                                </View>
                                                <Pressable onPress={() => handleAddToShoppingList(meal)} hitSlop={8} style={{ marginRight: 8 }}>
                                                    <ShoppingCart size={14} color={colors.accent} />
                                                </Pressable>
                                                <Pressable onPress={() => handleDelete(meal.id)} hitSlop={8}>
                                                    <Trash2 size={14} color={colors.subtext} />
                                                </Pressable>
                                            </View>
                                        ))}
                                    </View>
                                );
                            })}
                            <Pressable
                                style={[styles.addBtn, { backgroundColor: colors.accent }]}
                                onPress={() => setShowAddModal(true)}
                            >
                                <Plus size={18} color="#fff" />
                                <Text style={styles.addBtnText}>Mahlzeit hinzufügen</Text>
                            </Pressable>
                        </>
                    )}
                </ScrollView>

                {/* Add Modal */}
                <Modal visible={showAddModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAddModal(false)}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <Pressable onPress={() => setShowAddModal(false)}><X size={24} color={colors.subtext} /></Pressable>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>Mahlzeit</Text>
                            <Pressable onPress={handleAdd}><Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>Speichern</Text></Pressable>
                        </View>
                        <ScrollView style={{ padding: 16 }}>
                            <Text style={[styles.label, { color: colors.subtext }]}>Mahlzeit</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                {MEAL_TYPES.map(mt => (
                                    <Pressable key={mt.key} style={[styles.mealTypeBtn, addMealType === mt.key && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]} onPress={() => setAddMealType(mt.key)}>
                                        <Text style={{ fontSize: 16 }}>{mt.emoji}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={[styles.label, { color: colors.subtext }]}>Gericht</Text>
                            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={addMealName} onChangeText={setAddMealName} placeholder="z.B. Spaghetti Bolognese" placeholderTextColor={colors.subtext} />
                            <Text style={[styles.label, { color: colors.subtext, marginTop: 16 }]}>Zutaten (optional)</Text>
                            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, height: 80, textAlignVertical: 'top' }]} value={addIngredients} onChangeText={setAddIngredients} placeholder="z.B. Nudeln, Hackfleisch, Tomaten..." placeholderTextColor={colors.subtext} multiline />
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
    weekNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, marginHorizontal: 16, marginTop: 12, borderRadius: 12 },
    weekLabel: { fontSize: 15, fontWeight: '700' },
    dayTabs: { marginTop: 12, maxHeight: 44 },
    dayTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    dayTabText: { fontSize: 13, fontWeight: '700' },
    dayTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginTop: 12 },
    mealSection: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1 },
    mealTypeLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
    addMealHint: { fontSize: 13, fontWeight: '600' },
    mealItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 6 },
    mealName: { fontSize: 15, fontWeight: '600' },
    mealIngredients: { fontSize: 12, marginTop: 2 },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    mealTypeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
});

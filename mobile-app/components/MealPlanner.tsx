import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Image,
} from 'react-native';
import { X, Plus, Trash2, UtensilsCrossed, ChevronLeft, ChevronRight, ShoppingCart, Clock, Calendar, Coffee, Sandwich, CookingPot, BookOpen } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const MEAL_SLOTS = [
    { key: 'breakfast', label: 'Frühstück', icon: Coffee, startH: 7, endH: 9 },
    { key: 'lunch', label: 'Mittagessen', icon: Sandwich, startH: 12, endH: 14 },
    { key: 'dinner', label: 'Abendessen', icon: CookingPot, startH: 18, endH: 20 },
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
    const [dayOffset, setDayOffset] = useState(0); // 0 = today
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedDay, setSelectedDay] = useState(0);

    const [showAddModal, setShowAddModal] = useState(false);
    const [addMealType, setAddMealType] = useState('lunch');
    const [addMealName, setAddMealName] = useState('');
    const [addIngredients, setAddIngredients] = useState('');
    const [showRecipePicker, setShowRecipePicker] = useState(false);
    const [availableRecipes, setAvailableRecipes] = useState<{ id: string; title: string; image_url: string | null; ingredients: string }[]>([]);
    const [recipesLoading, setRecipesLoading] = useState(false);
    const [recipeSearch, setRecipeSearch] = useState('');

    // ── Date Helpers ──
    const currentDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [dayOffset]);

    const dayLabel = useMemo(() => {
        if (dayOffset === 0) return 'Heute';
        if (dayOffset === 1) return 'Morgen';
        if (dayOffset === -1) return 'Gestern';
        return `${DAYS[(currentDate.getDay() + 6) % 7]}, ${currentDate.getDate()}.${currentDate.getMonth() + 1}.`;
    }, [dayOffset, currentDate]);

    const getDayOfWeek = (date: Date) => (date.getDay() + 6) % 7; // Monday=0

    const getWeekStart = useCallback((date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }, []);

    const getWeekStartForOffset = useCallback((offset: number) => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }, []);

    // Currently active meal slot
    const currentSlot = useMemo(() => {
        if (dayOffset !== 0) return null;
        const now = new Date();
        const h = now.getHours();
        return MEAL_SLOTS.find(s => h >= s.startH && h < s.endH)?.key || null;
    }, [dayOffset]);

    // Next upcoming slot (for highlight if no current)
    const activeSlot = useMemo(() => {
        if (dayOffset !== 0) return null;
        if (currentSlot) return currentSlot;
        const now = new Date();
        const h = now.getHours();
        const upcoming = MEAL_SLOTS.find(s => h < s.endH);
        return upcoming?.key || null;
    }, [dayOffset, currentSlot]);

    // ── Load Meals ──
    const loadMeals = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            let ws: string;
            if (viewMode === 'day') {
                ws = getWeekStart(currentDate).toISOString().split('T')[0];
            } else {
                ws = getWeekStartForOffset(weekOffset).toISOString().split('T')[0];
            }
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
    }, [householdId, viewMode, dayOffset, weekOffset]);

    useEffect(() => { if (visible) loadMeals(); }, [visible, loadMeals]);

    // ── Handlers ──
    const handleAdd = async () => {
        if (!addMealName.trim() || !householdId) return;
        try {
            let ws: string;
            let dow: number;
            if (viewMode === 'day') {
                ws = getWeekStart(currentDate).toISOString().split('T')[0];
                dow = getDayOfWeek(currentDate);
            } else {
                ws = getWeekStartForOffset(weekOffset).toISOString().split('T')[0];
                dow = selectedDay;
            }
            await supabase.from('meal_plans').insert({
                household_id: householdId,
                week_start: ws,
                day_of_week: dow,
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

    const openAddForSlot = (slotKey: string) => {
        setAddMealType(slotKey);
        setAddMealName('');
        setAddIngredients('');
        setShowAddModal(true);
    };

    // ── Recipe Picker ──
    const loadRecipes = useCallback(async () => {
        if (!householdId) return;
        setRecipesLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_recipes')
                .select('id, title, image_url, ingredients')
                .eq('household_id', householdId)
                .order('title');
            if (error) throw error;
            setAvailableRecipes(data || []);
        } catch (e) { console.warn(e); }
        finally { setRecipesLoading(false); }
    }, [householdId]);

    const openRecipePicker = () => {
        loadRecipes();
        setRecipeSearch('');
        setShowRecipePicker(true);
    };

    const selectRecipe = (recipe: { title: string; ingredients: string }) => {
        setAddMealName(recipe.title);
        // Try to format ingredients nicely
        try {
            const parsed = JSON.parse(recipe.ingredients);
            if (Array.isArray(parsed)) {
                setAddIngredients(parsed.map((i: any) => `${i.amount || ''} ${i.unit || ''} ${i.name || ''}`.trim()).join('\n'));
            } else {
                setAddIngredients(recipe.ingredients);
            }
        } catch {
            setAddIngredients(recipe.ingredients);
        }
        setShowRecipePicker(false);
    };

    const filteredRecipes = useMemo(() => {
        if (!recipeSearch) return availableRecipes;
        const q = recipeSearch.toLowerCase();
        return availableRecipes.filter(r => r.title.toLowerCase().includes(q));
    }, [availableRecipes, recipeSearch]);

    // ── Filtered Meals ──
    const dayMeals = useMemo(() => {
        if (viewMode === 'day') {
            const dow = getDayOfWeek(currentDate);
            return meals.filter(m => m.day_of_week === dow);
        } else {
            return meals.filter(m => m.day_of_week === selectedDay);
        }
    }, [meals, viewMode, currentDate, selectedDay]);

    const mealsToday = viewMode === 'day' ? dayMeals.length : meals.filter(m => m.day_of_week === selectedDay).length;

    // ── Week View helpers ──
    const weekStart = viewMode === 'week' ? getWeekStartForOffset(weekOffset) : getWeekStart(currentDate);
    const weekLabel = `${weekStart.getDate()}.${weekStart.getMonth() + 1}. – ${new Date(weekStart.getTime() + 6 * 86400000).getDate()}.${(new Date(weekStart.getTime() + 6 * 86400000)).getMonth() + 1}.`;

    // ── Accent color for icons (derived from theme) ──
    const iconColor = colors.accent;
    const iconBg = colors.accent + '20';

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={onClose} style={styles.backBtn}>
                        <ChevronLeft size={24} color={colors.text} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Mahlzeitenkalender</Text>
                        <Text style={[styles.headerSub, { color: colors.subtext }]}>{mealsToday} {mealsToday === 1 ? 'Mahlzeit' : 'Mahlzeiten'} {viewMode === 'day' ? dayLabel.toLowerCase() : ''}</Text>
                    </View>
                    <Pressable
                        onPress={() => setViewMode(v => v === 'day' ? 'week' : 'day')}
                        style={[styles.viewToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <Calendar size={14} color={colors.text} />
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{viewMode === 'day' ? 'Tag' : 'Woche'}</Text>
                    </Pressable>
                    <Pressable onPress={() => openAddForSlot('lunch')} style={[styles.addHeaderBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Plus size={18} color={colors.text} />
                    </Pressable>
                </View>

                {viewMode === 'day' ? (
                    <>
                        {/* Day Navigation */}
                        <View style={[styles.dayNav, { backgroundColor: colors.card }]}>
                            <Pressable onPress={() => setDayOffset(o => o - 1)} style={[styles.navArrow, { backgroundColor: colors.background }]}>
                                <ChevronLeft size={18} color={colors.text} />
                            </Pressable>
                            <Pressable onPress={() => setDayOffset(0)}>
                                <Text style={[styles.dayNavLabel, { color: colors.text }]}>{dayLabel}</Text>
                            </Pressable>
                            <Pressable onPress={() => setDayOffset(o => o + 1)} style={[styles.navArrow, { backgroundColor: colors.background }]}>
                                <ChevronRight size={18} color={colors.text} />
                            </Pressable>
                        </View>

                        {/* Meal Cards */}
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
                            {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> :
                                MEAL_SLOTS.map(slot => {
                                    const slotMeals = dayMeals.filter(m => m.meal_type === slot.key);
                                    const isCurrent = currentSlot === slot.key;
                                    const isActive = activeSlot === slot.key;
                                    const isPast = dayOffset === 0 && !isCurrent && MEAL_SLOTS.indexOf(slot) < MEAL_SLOTS.findIndex(s => s.key === activeSlot);

                                    const cardBorder = isCurrent ? iconColor : 'transparent';
                                    const SlotIcon = slot.icon;

                                    return (
                                        <View
                                            key={slot.key}
                                            style={[
                                                styles.mealCard,
                                                {
                                                    backgroundColor: colors.card,
                                                    borderColor: cardBorder,
                                                    borderWidth: isCurrent ? 1.5 : 0,
                                                },
                                            ]}
                                        >
                                            {/* Card Header */}
                                            <View style={styles.cardHeader}>
                                                <View style={[styles.slotIcon, { backgroundColor: iconBg }]}>
                                                    <SlotIcon size={18} color={iconColor} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.slotLabel, { color: colors.text }]}>{slot.label}</Text>
                                                    <Text style={[styles.slotTime, { color: colors.subtext }]}>
                                                        {slot.startH.toString().padStart(2, '0')}:00 – {slot.endH.toString().padStart(2, '0')}:00
                                                    </Text>
                                                </View>

                                                {isCurrent && (
                                                    <View style={[styles.activeBadge, { backgroundColor: iconColor + '20', borderColor: iconColor + '50' }]}>
                                                        <Clock size={12} color={iconColor} />
                                                        <Text style={{ color: iconColor, fontSize: 11, fontWeight: '600' }}>Aktuelle Zeit</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Meals or Empty State */}
                                            {slotMeals.length > 0 ? (
                                                <View style={styles.mealsContainer}>
                                                    {slotMeals.map(meal => (
                                                        <View key={meal.id} style={[styles.mealItem, { backgroundColor: colors.background + '80', borderColor: colors.border }]}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={[styles.mealName, { color: colors.text }]}>{meal.meal_name}</Text>
                                                                {meal.ingredients && (
                                                                    <Text style={[styles.mealIngredients, { color: colors.subtext }]} numberOfLines={2}>{meal.ingredients}</Text>
                                                                )}
                                                            </View>
                                                            <Pressable onPress={() => handleAddToShoppingList(meal)} hitSlop={8} style={{ padding: 6 }}>
                                                                <ShoppingCart size={14} color={colors.accent} />
                                                            </Pressable>
                                                            <Pressable onPress={() => handleDelete(meal.id)} hitSlop={8} style={{ padding: 6 }}>
                                                                <Trash2 size={14} color={colors.error || '#EF4444'} />
                                                            </Pressable>
                                                        </View>
                                                    ))}
                                                    <Pressable onPress={() => openAddForSlot(slot.key)} style={styles.addMealBtn}>
                                                        <Plus size={16} color={colors.subtext} />
                                                        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '500' }}>Weitere hinzufügen</Text>
                                                    </Pressable>
                                                </View>
                                            ) : (
                                                <View style={styles.emptySlot}>
                                                    {isPast ? (
                                                        <>
                                                            <Clock size={24} color={colors.subtext + '60'} />
                                                            <Text style={[styles.emptyText, { color: colors.subtext + '80' }]}>Zeitfenster ist vorbei</Text>
                                                        </>
                                                    ) : (
                                                        <Pressable onPress={() => openAddForSlot(slot.key)} style={styles.addMealCenterBtn}>
                                                            <View style={[styles.addCircle, { backgroundColor: colors.subtext + '20' }]}>
                                                                <Plus size={20} color={colors.subtext} />
                                                            </View>
                                                            <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 6 }}>Mahlzeit erstellen</Text>
                                                        </Pressable>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            }
                        </ScrollView>
                    </>
                ) : (
                    <>
                        {/* Week View */}
                        <View style={[styles.dayNav, { backgroundColor: colors.card }]}>
                            <Pressable onPress={() => setWeekOffset(w => w - 1)} style={[styles.navArrow, { backgroundColor: colors.background }]}>
                                <ChevronLeft size={18} color={colors.text} />
                            </Pressable>
                            <Text style={[styles.dayNavLabel, { color: colors.text }]}>KW {weekLabel}</Text>
                            <Pressable onPress={() => setWeekOffset(w => w + 1)} style={[styles.navArrow, { backgroundColor: colors.background }]}>
                                <ChevronRight size={18} color={colors.text} />
                            </Pressable>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
                            {DAYS.map((day, i) => (
                                <Pressable
                                    key={day}
                                    style={[styles.dayTab, { backgroundColor: selectedDay === i ? colors.accent : colors.card }]}
                                    onPress={() => setSelectedDay(i)}
                                >
                                    <Text style={[styles.dayTabText, { color: selectedDay === i ? '#fff' : colors.subtext }]}>{day.substring(0, 2)}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Text style={[styles.dayTitle, { color: colors.text }]}>{DAYS[selectedDay]}</Text>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
                            {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> :
                                MEAL_SLOTS.map(slot => {
                                    const slotMeals = dayMeals.filter(m => m.meal_type === slot.key);
                                    const SlotIcon = slot.icon;
                                    return (
                                        <View key={slot.key} style={[styles.mealCard, { backgroundColor: colors.card }]}>
                                            <View style={styles.cardHeader}>
                                                <View style={[styles.slotIcon, { backgroundColor: iconBg }]}>
                                                    <SlotIcon size={18} color={iconColor} />
                                                </View>
                                                <View>
                                                    <Text style={[styles.slotLabel, { color: colors.text }]}>{slot.label}</Text>
                                                    <Text style={[styles.slotTime, { color: colors.subtext }]}>
                                                        {slot.startH.toString().padStart(2, '0')}:00 – {slot.endH.toString().padStart(2, '0')}:00
                                                    </Text>
                                                </View>
                                            </View>
                                            {slotMeals.length > 0 ? (
                                                <View style={styles.mealsContainer}>
                                                    {slotMeals.map(meal => (
                                                        <View key={meal.id} style={[styles.mealItem, { backgroundColor: colors.background + '80', borderColor: colors.border }]}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={[styles.mealName, { color: colors.text }]}>{meal.meal_name}</Text>
                                                                {meal.ingredients && <Text style={[styles.mealIngredients, { color: colors.subtext }]} numberOfLines={2}>{meal.ingredients}</Text>}
                                                            </View>
                                                            <Pressable onPress={() => handleAddToShoppingList(meal)} hitSlop={8} style={{ padding: 6 }}>
                                                                <ShoppingCart size={14} color={colors.accent} />
                                                            </Pressable>
                                                            <Pressable onPress={() => handleDelete(meal.id)} hitSlop={8} style={{ padding: 6 }}>
                                                                <Trash2 size={14} color={colors.error || '#EF4444'} />
                                                            </Pressable>
                                                        </View>
                                                    ))}
                                                    <Pressable onPress={() => openAddForSlot(slot.key)} style={styles.addMealBtn}>
                                                        <Plus size={16} color={colors.subtext} />
                                                        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '500' }}>Weitere hinzufügen</Text>
                                                    </Pressable>
                                                </View>
                                            ) : (
                                                <Pressable onPress={() => openAddForSlot(slot.key)} style={styles.emptySlot}>
                                                    <View style={[styles.addCircle, { backgroundColor: colors.subtext + '20' }]}>
                                                        <Plus size={20} color={colors.subtext} />
                                                    </View>
                                                    <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 6 }}>Mahlzeit erstellen</Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    );
                                })
                            }
                        </ScrollView>
                    </>
                )}

                {/* Add Modal */}
                <Modal visible={showAddModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => { setShowRecipePicker(false); setShowAddModal(false); }}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={[styles.addModalHeader, { borderBottomColor: colors.border }]}>
                            <Pressable onPress={() => { if (showRecipePicker) { setShowRecipePicker(false); } else { setShowAddModal(false); } }}>
                                <X size={24} color={colors.subtext} />
                            </Pressable>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>{showRecipePicker ? 'Rezept wählen' : 'Mahlzeit'}</Text>
                            {showRecipePicker ? <View style={{ width: 24 }} /> : (
                                <Pressable onPress={handleAdd}><Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>Speichern</Text></Pressable>
                            )}
                        </View>

                        {showRecipePicker ? (
                            /* Recipe Picker inline */
                            <View style={{ flex: 1 }}>
                                <View style={{ padding: 16, paddingBottom: 8 }}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                                        value={recipeSearch} onChangeText={setRecipeSearch}
                                        placeholder="Rezept suchen..." placeholderTextColor={colors.subtext}
                                    />
                                </View>
                                <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 8 }}>
                                    {recipesLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> :
                                        filteredRecipes.length === 0 ? (
                                            <Text style={{ color: colors.subtext, textAlign: 'center', paddingVertical: 40 }}>
                                                {recipeSearch ? 'Keine Rezepte gefunden' : 'Noch keine Rezepte vorhanden'}
                                            </Text>
                                        ) : filteredRecipes.map(recipe => (
                                            <Pressable key={recipe.id} onPress={() => selectRecipe(recipe)}
                                                style={[styles.recipeItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                {recipe.image_url ? (
                                                    <Image source={{ uri: recipe.image_url }} style={styles.recipeThumb} />
                                                ) : (
                                                    <View style={[styles.recipeThumb, { backgroundColor: colors.accent + '15', justifyContent: 'center', alignItems: 'center' }]}>
                                                        <Text style={{ fontSize: 20 }}>🍳</Text>
                                                    </View>
                                                )}
                                                <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }} numberOfLines={2}>{recipe.title}</Text>
                                                <ChevronRight size={16} color={colors.subtext} />
                                            </Pressable>
                                        ))
                                    }
                                </ScrollView>
                            </View>
                        ) : (
                            /* Normal add form */
                            <ScrollView style={{ padding: 16 }}>
                                <Text style={[styles.label, { color: colors.subtext }]}>Mahlzeit</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                    {MEAL_SLOTS.map(mt => (
                                        <Pressable key={mt.key} style={[styles.mealTypeBtn, { borderColor: addMealType === mt.key ? colors.accent : 'transparent', backgroundColor: addMealType === mt.key ? colors.accent + '20' : colors.card }]} onPress={() => setAddMealType(mt.key)}>
                                            <mt.icon size={18} color={addMealType === mt.key ? colors.accent : colors.subtext} />
                                            <Text style={{ fontSize: 11, color: addMealType === mt.key ? colors.accent : colors.subtext, marginTop: 2 }}>{mt.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>

                                {/* Recipe Picker Button */}
                                <Pressable onPress={openRecipePicker} style={[styles.recipePickerBtn, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '40' }]}>
                                    <BookOpen size={18} color={colors.accent} />
                                    <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>Aus Rezeptbuch wählen</Text>
                                </Pressable>

                                <Text style={[styles.label, { color: colors.subtext }]}>Gericht</Text>
                                <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={addMealName} onChangeText={setAddMealName} placeholder="z.B. Spaghetti Bolognese" placeholderTextColor={colors.subtext} />
                                <Text style={[styles.label, { color: colors.subtext, marginTop: 16 }]}>Zutaten (optional)</Text>
                                <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, height: 80, textAlignVertical: 'top' }]} value={addIngredients} onChangeText={setAddIngredients} placeholder="z.B. Nudeln, Hackfleisch, Tomaten..." placeholderTextColor={colors.subtext} multiline />
                            </ScrollView>
                        )}
                    </View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingTop: 16, paddingBottom: 12, paddingHorizontal: 16,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    headerSub: { fontSize: 12, marginTop: 1 },
    viewToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
    },
    addHeaderBtn: {
        width: 32, height: 32, borderRadius: 16, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    dayNav: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginHorizontal: 16, marginTop: 8, marginBottom: 4,
        paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14,
    },
    navArrow: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    dayNavLabel: { fontSize: 16, fontWeight: '700' },
    scrollContent: { padding: 16, paddingBottom: 40, gap: 12 },

    /* Meal Card */
    mealCard: {
        borderRadius: 18, padding: 16, overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4,
    },
    slotIcon: {
        width: 36, height: 36, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
    },
    slotLabel: { fontSize: 16, fontWeight: '700' },
    slotTime: { fontSize: 12, marginTop: 1 },
    activeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
    },

    /* Meals inside card */
    mealsContainer: { marginTop: 10, gap: 6 },
    mealItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: 10, borderRadius: 10, borderWidth: 1,
    },
    mealName: { fontSize: 14, fontWeight: '600' },
    mealIngredients: { fontSize: 11, marginTop: 2 },
    addMealBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingVertical: 8,
    },

    /* Empty State */
    emptySlot: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 24,
    },
    emptyText: { fontSize: 13, marginTop: 6 },
    addMealCenterBtn: { alignItems: 'center' },
    addCircle: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
    },

    /* Week View */
    dayTabs: { marginTop: 8, maxHeight: 44 },
    dayTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    dayTabText: { fontSize: 13, fontWeight: '700' },
    dayTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginTop: 12 },

    /* Add Modal */
    addModalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1,
    },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    mealTypeBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 10,
        borderRadius: 12, borderWidth: 1,
    },
    recipePickerBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
        marginBottom: 16,
    },
    recipeItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 10, borderRadius: 12, borderWidth: 1,
    },
    recipeThumb: {
        width: 44, height: 44, borderRadius: 10,
    },
});

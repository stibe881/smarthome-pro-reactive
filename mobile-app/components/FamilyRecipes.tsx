import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
    X, Plus, Search, Clock, Users, Trash2, Edit3, Check, ChevronDown,
    BookOpen, ChefHat,
} from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface Recipe {
    id: string;
    household_id: string;
    created_by: string | null;
    title: string;
    description: string | null;
    ingredients: string;
    instructions: string;
    servings: number;
    prep_time: number | null;
    cook_time: number | null;
    category: string;
    image_url: string | null;
    created_at: string;
}

const RECIPE_CATEGORIES = [
    { key: 'all', label: 'Alle', emoji: '📋' },
    { key: 'breakfast', label: 'Frühstück', emoji: '🥐' },
    { key: 'lunch', label: 'Mittagessen', emoji: '🍝' },
    { key: 'dinner', label: 'Abendessen', emoji: '🥘' },
    { key: 'snack', label: 'Snacks', emoji: '🍪' },
    { key: 'dessert', label: 'Dessert', emoji: '🍰' },
    { key: 'drink', label: 'Getränke', emoji: '🥤' },
    { key: 'other', label: 'Sonstiges', emoji: '🍴' },
];

interface FamilyRecipesProps {
    visible: boolean;
    onClose: () => void;
}

export function FamilyRecipes({ visible, onClose }: FamilyRecipesProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    // Form
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIngredients, setFormIngredients] = useState('');
    const [formInstructions, setFormInstructions] = useState('');
    const [formServings, setFormServings] = useState('4');
    const [formPrepTime, setFormPrepTime] = useState('');
    const [formCookTime, setFormCookTime] = useState('');
    const [formCategory, setFormCategory] = useState('dinner');
    const [isSaving, setIsSaving] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

    const loadRecipes = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_recipes')
                .select('*')
                .eq('household_id', householdId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setRecipes(data || []);
        } catch (e: any) {
            console.error('Error loading recipes:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => { if (visible) loadRecipes(); }, [visible, loadRecipes]);

    const filtered = recipes.filter(r => {
        const matchCat = selectedCategory === 'all' || r.category === selectedCategory;
        const matchSearch = !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    const openCreate = () => {
        setEditingRecipe(null);
        setFormTitle(''); setFormDescription(''); setFormIngredients('');
        setFormInstructions(''); setFormServings('4');
        setFormPrepTime(''); setFormCookTime(''); setFormCategory('dinner');
        setShowCreateModal(true);
    };

    const openEdit = (recipe: Recipe) => {
        setEditingRecipe(recipe);
        setFormTitle(recipe.title);
        setFormDescription(recipe.description || '');
        setFormIngredients(recipe.ingredients);
        setFormInstructions(recipe.instructions);
        setFormServings(String(recipe.servings));
        setFormPrepTime(recipe.prep_time ? String(recipe.prep_time) : '');
        setFormCookTime(recipe.cook_time ? String(recipe.cook_time) : '');
        setFormCategory(recipe.category);
        setShowCreateModal(true);
    };

    const handleSave = async () => {
        if (!formTitle.trim() || !householdId) return Alert.alert('Fehler', 'Bitte gib einen Titel ein.');
        setIsSaving(true);
        try {
            const payload = {
                household_id: householdId,
                title: formTitle.trim(),
                description: formDescription.trim() || null,
                ingredients: formIngredients.trim(),
                instructions: formInstructions.trim(),
                servings: parseInt(formServings) || 4,
                prep_time: formPrepTime ? parseInt(formPrepTime) : null,
                cook_time: formCookTime ? parseInt(formCookTime) : null,
                category: formCategory,
            };
            if (editingRecipe) {
                const { error } = await supabase.from('family_recipes').update(payload).eq('id', editingRecipe.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('family_recipes').insert({ ...payload, created_by: user?.id });
                if (error) throw error;
            }
            setShowCreateModal(false);
            loadRecipes();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (recipe: Recipe) => {
        Alert.alert('Löschen', `"${recipe.title}" wirklich löschen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen', style: 'destructive', onPress: async () => {
                    await supabase.from('family_recipes').delete().eq('id', recipe.id);
                    setSelectedRecipe(null);
                    loadRecipes();
                }
            },
        ]);
    };

    const getCatEmoji = (key: string) => RECIPE_CATEGORIES.find(c => c.key === key)?.emoji || '🍴';

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Rezeptbuch</Text>
                    <Pressable onPress={openCreate}><Plus size={24} color={colors.accent} /></Pressable>
                </View>

                {/* Search */}
                <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Search size={16} color={colors.subtext} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Rezept suchen..."
                        placeholderTextColor={colors.subtext}
                    />
                </View>

                {/* Categories */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                    {RECIPE_CATEGORIES.map(cat => (
                        <Pressable
                            key={cat.key}
                            style={[styles.catChip, {
                                backgroundColor: selectedCategory === cat.key ? colors.accent + '20' : colors.card,
                                borderColor: selectedCategory === cat.key ? colors.accent : colors.border,
                            }]}
                            onPress={() => setSelectedCategory(cat.key)}
                        >
                            <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                            <Text style={[styles.catLabel, { color: selectedCategory === cat.key ? colors.accent : colors.text }]}>{cat.label}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Recipe List */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                    ) : filtered.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={{ fontSize: 48 }}>📖</Text>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                {searchQuery ? 'Keine Rezepte gefunden' : 'Noch keine Rezepte.\nErstelle dein erstes Rezept!'}
                            </Text>
                        </View>
                    ) : (
                        filtered.map(recipe => (
                            <Pressable
                                key={recipe.id}
                                style={[styles.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => setSelectedRecipe(recipe)}
                            >
                                <View style={styles.recipeCardContent}>
                                    <Text style={{ fontSize: 28 }}>{getCatEmoji(recipe.category)}</Text>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.recipeTitle, { color: colors.text }]} numberOfLines={1}>{recipe.title}</Text>
                                        {recipe.description ? (
                                            <Text style={[styles.recipeDesc, { color: colors.subtext }]} numberOfLines={1}>{recipe.description}</Text>
                                        ) : null}
                                        <View style={styles.recipeMeta}>
                                            {recipe.prep_time ? (
                                                <View style={styles.metaItem}>
                                                    <Clock size={11} color={colors.subtext} />
                                                    <Text style={[styles.metaText, { color: colors.subtext }]}>{recipe.prep_time + (recipe.cook_time || 0)} Min</Text>
                                                </View>
                                            ) : null}
                                            <View style={styles.metaItem}>
                                                <Users size={11} color={colors.subtext} />
                                                <Text style={[styles.metaText, { color: colors.subtext }]}>{recipe.servings} Pers.</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Recipe Detail Modal */}
            <Modal visible={!!selectedRecipe} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedRecipe(null)}>
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Pressable onPress={() => setSelectedRecipe(null)}><X size={24} color={colors.subtext} /></Pressable>
                        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{selectedRecipe?.title}</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Pressable onPress={() => { if (selectedRecipe) { openEdit(selectedRecipe); setSelectedRecipe(null); } }}><Edit3 size={20} color={colors.accent} /></Pressable>
                            <Pressable onPress={() => selectedRecipe && handleDelete(selectedRecipe)}><Trash2 size={20} color="#EF4444" /></Pressable>
                        </View>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                        {/* Info Row */}
                        <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={{ fontSize: 36 }}>{getCatEmoji(selectedRecipe?.category || '')}</Text>
                            <View style={{ flex: 1 }}>
                                {selectedRecipe?.description ? <Text style={{ color: colors.subtext, fontSize: 14 }}>{selectedRecipe.description}</Text> : null}
                                <View style={[styles.recipeMeta, { marginTop: 8 }]}>
                                    <View style={[styles.infoBadge, { backgroundColor: colors.accent + '15' }]}>
                                        <Users size={12} color={colors.accent} />
                                        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{selectedRecipe?.servings} Portionen</Text>
                                    </View>
                                    {selectedRecipe?.prep_time ? (
                                        <View style={[styles.infoBadge, { backgroundColor: '#F59E0B20' }]}>
                                            <Clock size={12} color="#F59E0B" />
                                            <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>Vorbereitung: {selectedRecipe.prep_time} Min</Text>
                                        </View>
                                    ) : null}
                                    {selectedRecipe?.cook_time ? (
                                        <View style={[styles.infoBadge, { backgroundColor: '#EF444420' }]}>
                                            <Clock size={12} color="#EF4444" />
                                            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Kochen: {selectedRecipe.cook_time} Min</Text>
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        {/* Ingredients */}
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>🥕 Zutaten</Text>
                        <View style={[styles.contentBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            {selectedRecipe?.ingredients.split('\n').filter(Boolean).map((line, i) => (
                                <View key={i} style={styles.ingredientLine}>
                                    <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{line.trim()}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Instructions */}
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>👨‍🍳 Zubereitung</Text>
                        <View style={[styles.contentBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            {selectedRecipe?.instructions.split('\n').filter(Boolean).map((line, i) => (
                                <View key={i} style={styles.stepLine}>
                                    <View style={[styles.stepNumber, { backgroundColor: colors.accent }]}>
                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
                                    </View>
                                    <Text style={{ color: colors.text, fontSize: 15, flex: 1, lineHeight: 22 }}>{line.trim()}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Create/Edit Modal */}
            <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <Pressable onPress={() => setShowCreateModal(false)}><X size={24} color={colors.subtext} /></Pressable>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>{editingRecipe ? 'Bearbeiten' : 'Neues Rezept'}</Text>
                            <Pressable onPress={handleSave} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator size="small" color={colors.accent} /> : <Check size={24} color={colors.accent} />}
                            </Pressable>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                            <Text style={[styles.formLabel, { color: colors.subtext }]}>Titel *</Text>
                            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={formTitle} onChangeText={setFormTitle} placeholder="z.B. Spaghetti Bolognese" placeholderTextColor={colors.subtext} />

                            <Text style={[styles.formLabel, { color: colors.subtext, marginTop: 14 }]}>Beschreibung</Text>
                            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={formDescription} onChangeText={setFormDescription} placeholder="Kurze Beschreibung..." placeholderTextColor={colors.subtext} />

                            <Text style={[styles.formLabel, { color: colors.subtext, marginTop: 14 }]}>Kategorie</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                                {RECIPE_CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                                    <Pressable key={cat.key} style={[styles.catChip, { backgroundColor: formCategory === cat.key ? colors.accent + '20' : colors.card, borderColor: formCategory === cat.key ? colors.accent : colors.border }]} onPress={() => setFormCategory(cat.key)}>
                                        <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                                        <Text style={{ fontSize: 11, color: formCategory === cat.key ? colors.accent : colors.text }}>{cat.label}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>

                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.formLabel, { color: colors.subtext }]}>Portionen</Text>
                                    <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={formServings} onChangeText={setFormServings} keyboardType="number-pad" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.formLabel, { color: colors.subtext }]}>Vorbereitung (Min)</Text>
                                    <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={formPrepTime} onChangeText={setFormPrepTime} keyboardType="number-pad" placeholder="z.B. 15" placeholderTextColor={colors.subtext} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.formLabel, { color: colors.subtext }]}>Kochen (Min)</Text>
                                    <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={formCookTime} onChangeText={setFormCookTime} keyboardType="number-pad" placeholder="z.B. 30" placeholderTextColor={colors.subtext} />
                                </View>
                            </View>

                            <Text style={[styles.formLabel, { color: colors.subtext, marginTop: 14 }]}>Zutaten (eine pro Zeile)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                                value={formIngredients} onChangeText={setFormIngredients}
                                placeholder={"200g Spaghetti\n100g Hackfleisch\n1 Dose Tomaten\n..."} placeholderTextColor={colors.subtext}
                                multiline numberOfLines={6}
                            />

                            <Text style={[styles.formLabel, { color: colors.subtext, marginTop: 14 }]}>Zubereitung (ein Schritt pro Zeile)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                                value={formInstructions} onChangeText={setFormInstructions}
                                placeholder={"Wasser aufkochen\nNudeln kochen\nSosse zubereiten\n..."} placeholderTextColor={colors.subtext}
                                multiline numberOfLines={8}
                            />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: '800' },

    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
    searchInput: { flex: 1, fontSize: 15 },

    catRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    catLabel: { fontSize: 12, fontWeight: '600' },

    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 },

    recipeCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    recipeCardContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    recipeTitle: { fontSize: 16, fontWeight: '700' },
    recipeDesc: { fontSize: 13, marginTop: 2 },
    recipeMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 11, fontWeight: '500' },

    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
    infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

    sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 8 },
    contentBlock: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    ingredientLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    bulletDot: { width: 6, height: 6, borderRadius: 3 },
    stepLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
    stepNumber: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 1 },

    formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    textArea: { height: 120, textAlignVertical: 'top', paddingTop: 12 },
});

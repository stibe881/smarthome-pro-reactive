import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Image, KeyboardAvoidingView, Platform,
    Dimensions, Linking,
} from 'react-native';
import {
    X, Plus, Search, Clock, Users, Trash2, Edit3, Check, ChevronRight,
    BookOpen, ChefHat, ArrowLeft, MoreHorizontal, Home, Heart,
    Camera, Tag, Bookmark, Share2, Flame,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
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
    source_url: string | null;
    is_favorite: boolean;
    added_by_name: string | null;
    created_at: string;
}

const FILTER_TABS = [
    { key: 'all', label: 'Alle', emoji: '🍴' },
    { key: 'recent', label: 'Neueste', emoji: '🕑' },
    { key: 'favorites', label: 'Favoriten', emoji: '❤️' },
    { key: 'mine', label: 'Beiträge', emoji: '👤' },
];

const RECIPE_CATEGORIES = [
    { key: 'dinner', label: 'Abendessen', emoji: '🥘' },
    { key: 'lunch', label: 'Mittagessen', emoji: '🍝' },
    { key: 'breakfast', label: 'Frühstück', emoji: '🥐' },
    { key: 'snack', label: 'Snacks', emoji: '🍪' },
    { key: 'dessert', label: 'Dessert', emoji: '🍰' },
    { key: 'drink', label: 'Getränke', emoji: '🥤' },
    { key: 'other', label: 'Sonstiges', emoji: '🍴' },
];

type ViewMode = 'list' | 'detail' | 'create_own' | 'create_web';

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
    const [activeFilter, setActiveFilter] = useState('all');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [showNewPicker, setShowNewPicker] = useState(false);
    const [members, setMembers] = useState<Record<string, string>>({});

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIngredients, setFormIngredients] = useState('');
    const [formInstructions, setFormInstructions] = useState('');
    const [formServings, setFormServings] = useState('');
    const [formPrepTime, setFormPrepTime] = useState('');
    const [formCookTime, setFormCookTime] = useState('');
    const [formCategory, setFormCategory] = useState('dinner');
    const [formImageUrl, setFormImageUrl] = useState('');
    const [formSourceUrl, setFormSourceUrl] = useState('');
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

    const loadMembers = useCallback(async () => {
        if (!householdId) return;
        const { data } = await supabase
            .from('family_members')
            .select('user_id, display_name')
            .eq('household_id', householdId);
        if (data) {
            const map: Record<string, string> = {};
            data.forEach(m => { if (m.user_id) map[m.user_id] = m.display_name || 'Unbekannt'; });
            setMembers(map);
        }
    }, [householdId]);

    useEffect(() => {
        if (visible) {
            loadRecipes();
            loadMembers();
            setViewMode('list');
            setSelectedRecipe(null);
            setShowNewPicker(false);
        }
    }, [visible, loadRecipes, loadMembers]);

    const filtered = recipes.filter(r => {
        const matchSearch = !searchQuery ||
            r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.ingredients?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSearch) return false;
        if (activeFilter === 'favorites') return r.is_favorite;
        if (activeFilter === 'mine') return r.created_by === user?.id;
        return true;
    }).sort((a, b) => {
        if (activeFilter === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return 0;
    });

    const getSourceDomain = (url: string | null) => {
        if (!url) return null;
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch { return url; }
    };

    const resetForm = () => {
        setFormTitle(''); setFormDescription(''); setFormIngredients('');
        setFormInstructions(''); setFormServings(''); setFormPrepTime('');
        setFormCookTime(''); setFormCategory('dinner'); setFormImageUrl('');
        setFormSourceUrl(''); setEditingRecipe(null);
    };

    const openCreateOwn = () => {
        resetForm();
        setShowNewPicker(false);
        setViewMode('create_own');
    };

    const openCreateWeb = () => {
        resetForm();
        setShowNewPicker(false);
        setViewMode('create_web');
    };

    const openEdit = (recipe: Recipe) => {
        setEditingRecipe(recipe);
        setFormTitle(recipe.title);
        setFormDescription(recipe.description || '');
        setFormIngredients(recipe.ingredients);
        setFormInstructions(recipe.instructions);
        setFormServings(recipe.servings ? String(recipe.servings) : '');
        setFormPrepTime(recipe.prep_time ? String(recipe.prep_time) : '');
        setFormCookTime(recipe.cook_time ? String(recipe.cook_time) : '');
        setFormCategory(recipe.category);
        setFormImageUrl(recipe.image_url || '');
        setFormSourceUrl(recipe.source_url || '');
        setViewMode('create_own');
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
        });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        try {
            const fileExt = asset.uri.split('.').pop() || 'jpg';
            const filePath = `recipes/${householdId}/${Date.now()}.${fileExt}`;
            const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
            const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const { error } = await supabase.storage
                .from('family-documents')
                .upload(filePath, binaryData, { contentType: `image/${fileExt}` });
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('family-documents').getPublicUrl(filePath);
            setFormImageUrl(urlData.publicUrl);
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    const handleSaveOwn = async () => {
        if (!formTitle.trim() || !householdId) return Alert.alert('Fehler', 'Bitte gib einen Titel ein.');
        setIsSaving(true);
        try {
            const payload: any = {
                household_id: householdId,
                title: formTitle.trim(),
                description: formDescription.trim() || null,
                ingredients: formIngredients.trim(),
                instructions: formInstructions.trim(),
                servings: parseInt(formServings) || 4,
                prep_time: formPrepTime ? parseInt(formPrepTime) : null,
                cook_time: formCookTime ? parseInt(formCookTime) : null,
                category: formCategory,
                image_url: formImageUrl || null,
                source_url: formSourceUrl.trim() || null,
                added_by_name: members[user?.id || ''] || null,
            };
            if (editingRecipe) {
                const { error } = await supabase.from('family_recipes').update(payload).eq('id', editingRecipe.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('family_recipes').insert({ ...payload, created_by: user?.id });
                if (error) throw error;
            }
            setViewMode('list');
            resetForm();
            loadRecipes();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveWeb = async () => {
        if (!formSourceUrl.trim() || !householdId) return Alert.alert('Fehler', 'Bitte gib eine URL ein.');
        setIsSaving(true);
        try {
            const domain = getSourceDomain(formSourceUrl.trim());
            const { error } = await supabase.from('family_recipes').insert({
                household_id: householdId,
                created_by: user?.id,
                title: domain || 'Webrezept',
                source_url: formSourceUrl.trim(),
                ingredients: '',
                instructions: '',
                servings: 4,
                category: 'other',
                added_by_name: members[user?.id || ''] || null,
            });
            if (error) throw error;
            setViewMode('list');
            resetForm();
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
                    setViewMode('list');
                    loadRecipes();
                }
            },
        ]);
    };

    const toggleFavorite = async (recipe: Recipe) => {
        const newVal = !recipe.is_favorite;
        setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, is_favorite: newVal } : r));
        if (selectedRecipe?.id === recipe.id) {
            setSelectedRecipe(prev => prev ? { ...prev, is_favorite: newVal } : prev);
        }
        await supabase.from('family_recipes').update({ is_favorite: newVal }).eq('id', recipe.id);
    };

    const handleShare = (recipe: Recipe) => {
        const text = `${recipe.title}\n\nZutaten:\n${recipe.ingredients}\n\nZubereitung:\n${recipe.instructions}`;
        // Use native share
        const { Share } = require('react-native');
        Share.share({ message: text, title: recipe.title });
    };

    if (!visible) return null;

    // --- LIST VIEW ---
    const renderList = () => (
        <>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={onClose}>
                    <Home size={22} color={colors.accent} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Rezeptbox</Text>
                <Pressable hitSlop={12}>
                    <MoreHorizontal size={22} color={colors.accent} />
                </Pressable>
            </View>

            {/* Search */}
            <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Search size={16} color={colors.subtext} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Ein Rezept oder eine Zutat suchen"
                    placeholderTextColor={colors.subtext}
                />
            </View>

            {/* Filter tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                {FILTER_TABS.map(tab => (
                    <Pressable
                        key={tab.key}
                        style={[styles.catChip, {
                            backgroundColor: activeFilter === tab.key ? colors.accent + '20' : colors.card,
                            borderColor: activeFilter === tab.key ? colors.accent : colors.border,
                        }]}
                        onPress={() => setActiveFilter(tab.key)}
                    >
                        <Text style={{ fontSize: 14 }}>{tab.emoji}</Text>
                        <Text style={[styles.catLabel, { color: activeFilter === tab.key ? colors.accent : colors.text }]}>{tab.label}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Recipe list */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
                {isLoading ? (
                    <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                ) : filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={{ fontSize: 48 }}>📖</Text>
                        <Text style={[styles.emptyText, { color: colors.subtext }]}>
                            {searchQuery ? 'Keine Rezepte gefunden' : 'Noch keine Rezepte.\nTippe +, um loszulegen!'}
                        </Text>
                    </View>
                ) : (
                    filtered.map(recipe => (
                        <Pressable
                            key={recipe.id}
                            style={[styles.recipeRow, { borderBottomColor: colors.border }]}
                            onPress={() => { setSelectedRecipe(recipe); setViewMode('detail'); }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.recipeTitle, { color: colors.text }]} numberOfLines={1}>{recipe.title}</Text>
                                <Text style={[styles.recipeSub, { color: colors.subtext }]} numberOfLines={1}>
                                    {getSourceDomain(recipe.source_url) || ''}{recipe.source_url && recipe.added_by_name ? ' | ' : ''}
                                    {recipe.added_by_name ? `Hinzugefügt von ${recipe.added_by_name}` : ''}
                                </Text>
                            </View>
                            {recipe.image_url ? (
                                <Image source={{ uri: recipe.image_url }} style={styles.recipeThumb} />
                            ) : (
                                <View style={[styles.recipeThumbPlaceholder, { backgroundColor: colors.card }]}>
                                    <ChefHat size={20} color={colors.subtext} />
                                </View>
                            )}
                        </Pressable>
                    ))
                )}
            </ScrollView>

            {/* FAB */}
            <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={() => setShowNewPicker(true)}>
                <Plus size={24} color="#fff" />
            </Pressable>

            {/* New Food Idea Picker (bottom sheet) */}
            <Modal visible={showNewPicker} transparent animationType="slide" onRequestClose={() => setShowNewPicker(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowNewPicker(false)}>
                    <View style={[styles.bottomSheet, { backgroundColor: colors.background }]}>
                        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>Neue Food-Idee</Text>

                        <Pressable style={[styles.ideaCard, { backgroundColor: '#93B5F5' }]} onPress={openCreateOwn}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.ideaCardTitle}>Eigenes Rezept hinzufügen</Text>
                                <Text style={styles.ideaCardDesc}>
                                    Fügen Sie den leckeren Apfelkuchen Ihrer Großmutter oder Ihre eigene geniale Kreation hinzu.
                                </Text>
                            </View>
                            <Text style={{ fontSize: 40 }}>🍽️</Text>
                        </Pressable>

                        <Pressable style={[styles.ideaCard, { backgroundColor: '#F5A893' }]} onPress={openCreateWeb}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.ideaCardTitle}>Webrezept hinzufügen</Text>
                                <Text style={styles.ideaCardDesc}>
                                    Kopieren Sie die URL eines tollen Rezepts, das Sie im Internet gefunden haben, um es zu speichern.
                                </Text>
                            </View>
                            <Text style={{ fontSize: 40 }}>📕</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </>
    );

    // --- DETAIL VIEW ---
    const renderDetail = () => {
        if (!selectedRecipe) return null;
        const r = selectedRecipe;
        return (
            <View style={{ flex: 1 }}>
                {/* Hero image */}
                {r.image_url ? (
                    <View>
                        <Image source={{ uri: r.image_url }} style={styles.heroImage} />
                        <Pressable style={styles.heroBack} onPress={() => setViewMode('list')}>
                            <ArrowLeft size={22} color="#fff" />
                        </Pressable>
                        <Pressable style={styles.heroMenu} onPress={() => openEdit(r)}>
                            <MoreHorizontal size={22} color="#fff" />
                        </Pressable>
                    </View>
                ) : (
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Pressable onPress={() => setViewMode('list')}><ArrowLeft size={22} color={colors.subtext} /></Pressable>
                        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{r.title}</Text>
                        <Pressable onPress={() => openEdit(r)}><MoreHorizontal size={22} color={colors.accent} /></Pressable>
                    </View>
                )}

                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Title + source */}
                    <View style={styles.detailTitleSection}>
                        <Text style={[styles.detailTitle, { color: colors.text }]}>{r.title}</Text>
                        {r.source_url && (
                            <Pressable onPress={() => Linking.openURL(r.source_url!)}>
                                <Text style={[styles.detailSource, { color: colors.accent }]}>{getSourceDomain(r.source_url)}</Text>
                            </Pressable>
                        )}
                        {r.description && (
                            <Text style={[styles.detailDesc, { color: colors.subtext }]}>{r.description}</Text>
                        )}

                        {/* Share button */}
                        <Pressable style={[styles.shareBtn, { borderColor: colors.border }]} onPress={() => handleShare(r)}>
                            <Share2 size={16} color={colors.text} />
                            <Text style={[styles.shareBtnText, { color: colors.text }]}>Teilen</Text>
                        </Pressable>
                    </View>

                    {/* Categories */}
                    <View style={[styles.detailSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.detailRow}>
                            <Tag size={18} color={colors.subtext} />
                            <Text style={[styles.detailRowLabel, { color: colors.text }]}>Kategorien zuweisen</Text>
                            <ChevronRight size={16} color={colors.subtext} />
                        </View>
                    </View>

                    {/* Ingredients */}
                    {r.ingredients && r.ingredients.trim() && (
                        <>
                            <Text style={[styles.sectionLabel, { color: colors.subtext }]}>ZUTATEN</Text>
                            <View style={[styles.detailSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                {r.ingredients.split('\n').filter(Boolean).map((line, i) => (
                                    <View key={i} style={styles.ingredientLine}>
                                        <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                                        <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{line.trim()}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {/* Instructions */}
                    {r.instructions && r.instructions.trim() && (
                        <>
                            <Text style={[styles.sectionLabel, { color: colors.subtext }]}>ANLEITUNG</Text>
                            <View style={[styles.detailSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                {r.instructions.split('\n').filter(Boolean).map((line, i) => (
                                    <View key={i} style={styles.stepLine}>
                                        <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                                        <Text style={{ color: colors.text, fontSize: 15, flex: 1, lineHeight: 22 }}>{line.trim()}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {/* More info */}
                    <View style={[styles.detailSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.detailRow}>
                            <BookOpen size={18} color={colors.subtext} />
                            <Text style={[styles.detailRowLabel, { color: colors.text }]}>Weitere Infos hinzufügen (Zeit, Foto...)</Text>
                            <ChevronRight size={16} color={colors.subtext} />
                        </View>
                    </View>
                </ScrollView>

                {/* Plan recipe button */}
                <View style={styles.planBtnWrap}>
                    <Pressable style={[styles.planBtn, { backgroundColor: colors.accent }]}>
                        <ChefHat size={18} color="#fff" />
                        <Text style={styles.planBtnText}>Dieses Rezept planen</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    // --- CREATE OWN ---
    const renderCreateOwn = () => (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setViewMode('list')}><X size={24} color={colors.subtext} /></Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{editingRecipe ? 'Rezept bearbeiten' : 'Neues Rezept'}</Text>
                <Pressable onPress={handleSaveOwn} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator size="small" color={colors.accent} /> : <Check size={24} color={colors.accent} />}
                </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                {/* Title */}
                <TextInput
                    style={[styles.formTitleInput, { color: colors.text, borderBottomColor: colors.border }]}
                    value={formTitle}
                    onChangeText={setFormTitle}
                    placeholder="Rezepttitel"
                    placeholderTextColor={colors.subtext}
                    maxLength={100}
                />

                {/* Photo */}
                <Pressable style={[styles.formRow, { borderBottomColor: colors.border }]} onPress={handlePickImage}>
                    <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                        <Camera size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.formRowLabel, { color: formImageUrl ? colors.text : colors.subtext }]}>
                        {formImageUrl ? 'Foto ändern' : 'Foto hinzufügen'}
                    </Text>
                </Pressable>

                {/* Description */}
                <Pressable style={[styles.formRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                        <BookOpen size={16} color={colors.accent} />
                    </View>
                    <TextInput
                        style={[styles.formRowInput, { color: colors.text }]}
                        value={formDescription}
                        onChangeText={setFormDescription}
                        placeholder="Beschreibung"
                        placeholderTextColor={colors.subtext}
                    />
                </Pressable>

                {/* Categories - navigable row */}
                <View style={[styles.formRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                        <Tag size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.formRowLabel, { color: colors.text, fontWeight: '700' }]}>Kategorien</Text>
                </View>

                {/* Ingredients */}
                <View style={[styles.formRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                        <ChefHat size={16} color={colors.accent} />
                    </View>
                    <TextInput
                        style={[styles.formRowInput, { color: colors.text }]}
                        value={formIngredients}
                        onChangeText={setFormIngredients}
                        placeholder="Zutaten"
                        placeholderTextColor={colors.subtext}
                        multiline
                    />
                </View>

                {/* Instructions */}
                <View style={[styles.formRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                        <BookOpen size={16} color={colors.accent} />
                    </View>
                    <TextInput
                        style={[styles.formRowInput, { color: colors.text }]}
                        value={formInstructions}
                        onChangeText={setFormInstructions}
                        placeholder="Anleitung"
                        placeholderTextColor={colors.subtext}
                        multiline
                    />
                </View>

                {/* Times & portions */}
                <View style={[styles.formRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.formIcon, { backgroundColor: '#F59E0B20' }]}>
                        <Clock size={16} color="#F59E0B" />
                    </View>
                    <Text style={[styles.formRowLabel, { color: colors.text }]}>Zubereitungszeit</Text>
                    <TextInput
                        style={[styles.formRowSmallInput, { color: colors.subtext }]}
                        value={formPrepTime}
                        onChangeText={setFormPrepTime}
                        placeholder="Keine"
                        placeholderTextColor={colors.subtext}
                        keyboardType="number-pad"
                    />
                </View>

                <View style={[styles.formRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.formIcon, { backgroundColor: '#EF444420' }]}>
                        <Flame size={16} color="#EF4444" />
                    </View>
                    <Text style={[styles.formRowLabel, { color: colors.text }]}>Kochzeit</Text>
                    <TextInput
                        style={[styles.formRowSmallInput, { color: colors.subtext }]}
                        value={formCookTime}
                        onChangeText={setFormCookTime}
                        placeholder="Keine"
                        placeholderTextColor={colors.subtext}
                        keyboardType="number-pad"
                    />
                </View>

                <View style={[styles.formRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.formIcon, { backgroundColor: colors.accent + '15' }]}>
                        <Users size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.formRowLabel, { color: colors.text }]}>Portionen</Text>
                    <TextInput
                        style={[styles.formRowSmallInput, { color: colors.subtext }]}
                        value={formServings}
                        onChangeText={setFormServings}
                        placeholder="Keine"
                        placeholderTextColor={colors.subtext}
                        keyboardType="number-pad"
                    />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );

    // --- CREATE WEB ---
    const renderCreateWeb = () => (
        <View style={{ flex: 1 }}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setViewMode('list')}><X size={24} color={colors.subtext} /></Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Webrezept hinzufügen</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={{ flex: 1, alignItems: 'center', padding: 24 }}>
                {/* Icon */}
                <View style={[styles.webIcon, { backgroundColor: '#F5A893' }]}>
                    <Text style={{ fontSize: 40 }}>📕</Text>
                </View>

                <Text style={[styles.webHint, { color: colors.subtext }]}>
                    Fügen Sie unten die URL des Rezepts ein, das Sie im Internet gefunden haben.
                </Text>

                <TextInput
                    style={[styles.webUrlInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                    value={formSourceUrl}
                    onChangeText={setFormSourceUrl}
                    placeholder="http://www.recipes.com/recipe"
                    placeholderTextColor={colors.subtext}
                    autoCapitalize="none"
                    keyboardType="url"
                />

                <Pressable
                    style={[styles.webSaveBtn, { backgroundColor: colors.accent }]}
                    onPress={handleSaveWeb}
                    disabled={isSaving}
                >
                    <Bookmark size={18} color="#fff" />
                    <Text style={styles.webSaveBtnText}>Dieses Rezept speichern</Text>
                </Pressable>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {viewMode === 'list' && renderList()}
                {viewMode === 'detail' && renderDetail()}
                {viewMode === 'create_own' && renderCreateOwn()}
                {viewMode === 'create_web' && renderCreateWeb()}
            </View>
        </Modal>
    );
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },

    searchRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 16, marginTop: 12,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1,
    },
    searchInput: { flex: 1, fontSize: 15 },

    catRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
    catChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
    },
    catLabel: { fontSize: 12, fontWeight: '600' },

    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 },

    // Recipe list row
    recipeRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
        borderBottomWidth: 1, gap: 12,
    },
    recipeTitle: { fontSize: 16, fontWeight: '700' },
    recipeSub: { fontSize: 12, marginTop: 2 },
    recipeThumb: { width: 50, height: 50, borderRadius: 8 },
    recipeThumbPlaceholder: {
        width: 50, height: 50, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
    },

    // FAB
    fab: {
        position: 'absolute', bottom: 30, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 6, shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },

    // Bottom sheet
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 16 },

    ideaCard: {
        flexDirection: 'row', alignItems: 'center', padding: 18,
        borderRadius: 16, marginBottom: 12, gap: 12,
    },
    ideaCardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
    ideaCardDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },

    // Detail
    heroImage: { width: SCREEN_WIDTH, height: 250, resizeMode: 'cover' },
    heroBack: {
        position: 'absolute', top: 16, left: 16,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
    },
    heroMenu: {
        position: 'absolute', top: 16, right: 16,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
    },
    detailTitleSection: { padding: 20, alignItems: 'center' },
    detailTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
    detailSource: { fontSize: 14, fontWeight: '600', marginTop: 4 },
    detailDesc: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
    shareBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
        borderWidth: 1, marginTop: 14,
    },
    shareBtnText: { fontSize: 14, fontWeight: '600' },

    detailSection: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    detailRowLabel: { fontSize: 15, fontWeight: '500', flex: 1 },

    sectionLabel: { fontSize: 12, fontWeight: '700', marginLeft: 20, marginTop: 8, marginBottom: 6, letterSpacing: 0.5 },
    ingredientLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    bulletDot: { width: 6, height: 6, borderRadius: 3 },
    stepLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },

    planBtnWrap: { position: 'absolute', bottom: 24, left: 20, right: 20 },
    planBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 16, borderRadius: 28,
    },
    planBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Create own
    formTitleInput: { fontSize: 20, fontWeight: '700', padding: 16, borderBottomWidth: 1 },
    formRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
    },
    formIcon: {
        width: 32, height: 32, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    formRowLabel: { fontSize: 15, flex: 1 },
    formRowInput: { fontSize: 15, flex: 1 },
    formRowSmallInput: { fontSize: 14, textAlign: 'right', width: 60 },

    // Create web
    webIcon: {
        width: 80, height: 80, borderRadius: 40,
        justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 20,
    },
    webHint: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    webUrlInput: { width: '100%', borderWidth: 1, padding: 14, borderRadius: 14, fontSize: 15, marginBottom: 20 },
    webSaveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 16, paddingHorizontal: 32, borderRadius: 28, width: '100%',
    },
    webSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

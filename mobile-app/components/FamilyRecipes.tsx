import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Image, KeyboardAvoidingView, Platform,
    Dimensions, Linking, TouchableWithoutFeedback, Animated,
} from 'react-native';
import {
    X, Plus, Search, Clock, Users, Trash2, Edit3, Check, ChevronRight,
    BookOpen, ChefHat, ArrowLeft, Heart,
    Camera, Tag, Bookmark, Share2, Flame, Dices,
    ShoppingCart, Star, ChevronLeft, FileJson, ArrowRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
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
    rest_time: number | null;
    category: string;
    categories: string[] | null;
    image_url: string | null;
    source_url: string | null;
    is_favorite: boolean;
    added_by_name: string | null;
    difficulty: string | null;
    tags: string[] | null;
    notes: string | null;
    created_at: string;
}

const FILTER_TABS = [
    { key: 'all', label: 'Alle', emoji: '📖' },
    { key: 'favorites', label: 'Favoriten', emoji: '❤️' },
    { key: 'recent', label: 'Neueste', emoji: '🕑' },
    { key: 'mine', label: 'Meine', emoji: '👤' },
];

const RECIPE_CATEGORIES = [
    { key: 'dinner', label: 'Abendessen', emoji: '🥘' },
    { key: 'lunch', label: 'Mittagessen', emoji: '🍝' },
    { key: 'breakfast', label: 'Frühstück', emoji: '🥐' },
    { key: 'snack', label: 'Snacks', emoji: '🍪' },
    { key: 'dessert', label: 'Dessert', emoji: '🍰' },
    { key: 'drink', label: 'Getränke', emoji: '🥤' },
    { key: 'movieboard', label: 'Movie Food Board', emoji: '🎬' },
    { key: 'other', label: 'Sonstiges', emoji: '🍴' },
];

const DIFFICULTY_LEVELS = [
    { key: 'easy', label: 'Einfach', emoji: '🟢', color: '#22C55E' },
    { key: 'medium', label: 'Mittel', emoji: '🟡', color: '#F59E0B' },
    { key: 'hard', label: 'Anspruchsvoll', emoji: '🔴', color: '#EF4444' },
];

const COMMON_TAGS = ['Vegan', 'Vegetarisch', 'Glutenfrei', 'Schnell', 'Low Carb', 'High Protein', 'Kinder', 'Party', 'Meal Prep'];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

type ViewMode = 'list' | 'detail' | 'create_own' | 'create_web' | 'cooking';

interface FamilyRecipesProps {
    visible: boolean;
    onClose: () => void;
}
export function FamilyRecipes({ visible, onClose }: FamilyRecipesProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { addTodoItem } = useHomeAssistant();
    const { householdId } = useHousehold();

    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [showNewPicker, setShowNewPicker] = useState(false);
    const [members, setMembers] = useState<Record<string, string>>({});
    const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
    const [portionMultiplier, setPortionMultiplier] = useState(1);
    const [cookingStep, setCookingStep] = useState(0);
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [customCategories, setCustomCategories] = useState<string[]>([]);

    // Cooking mode state
    const [cookingPhase, setCookingPhase] = useState<'mise_en_place' | 'steps' | 'done'>('mise_en_place');
    const [activeTimers, setActiveTimers] = useState<Record<number, { endTime: number, duration: number, id: string }>>({});
    const [_timerTick, setTimerTick] = useState(0);

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIngredients, setFormIngredients] = useState<{ amount: string, unit: string, name: string, notes?: string }[]>([]);
    const [formInstructions, setFormInstructions] = useState<{ text: string, time?: string }[]>([]);
    const [formServings, setFormServings] = useState('');
    const [formPrepTime, setFormPrepTime] = useState('');
    const [formCookTime, setFormCookTime] = useState('');
    const [formRestTime, setFormRestTime] = useState('');
    const [formCategories, setFormCategories] = useState<string[]>(['dinner']);
    const [formImageUrl, setFormImageUrl] = useState('');
    const [formSourceUrl, setFormSourceUrl] = useState('');
    const [formDifficulty, setFormDifficulty] = useState('medium');
    const [formTags, setFormTags] = useState<string[]>([]);
    const [formNotes, setFormNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

    const loadRecipes = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_recipes').select('*')
                .eq('household_id', householdId)
                .order('created_at', { ascending: false });
            if (error) throw error;

            // Extract unique units for the autocomplete
            const units = new Set<string>();
            if (data) {
                data.forEach(r => {
                    try {
                        const parsed = JSON.parse(r.ingredients);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(i => {
                                if (i.unit && i.unit.trim()) units.add(i.unit.trim());
                            });
                        }
                    } catch { }
                });
            }
            setUniqueUnits(Array.from(units).sort());

            // Extract custom categories
            const extractedCustomCats = new Set<string>();
            if (data) {
                data.forEach(r => {
                    if (r.categories) {
                        r.categories.forEach((c: string) => {
                            if (!RECIPE_CATEGORIES.some(rc => rc.key === c)) {
                                extractedCustomCats.add(c);
                            }
                        });
                    }
                });
            }
            setCustomCategories(Array.from(extractedCustomCats).sort());

            setRecipes(data || []);
        } catch (e: any) { console.error('Error loading recipes:', e); }
        finally { setIsLoading(false); }
    }, [householdId]);

    const loadMembers = useCallback(async () => {
        if (!householdId) return;
        const { data } = await supabase.from('family_members')
            .select('user_id, display_name').eq('household_id', householdId);
        if (data) {
            const map: Record<string, string> = {};
            data.forEach(m => { if (m.user_id) map[m.user_id] = m.display_name || 'Unbekannt'; });
            setMembers(map);
        }
    }, [householdId]);

    useEffect(() => {
        if (visible) {
            loadRecipes(); loadMembers();
            setViewMode('list'); setSelectedRecipe(null); setShowNewPicker(false);
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        } else { fadeAnim.setValue(0); }
    }, [visible, loadRecipes, loadMembers]);

    // Keep awake when in cooking mode
    useEffect(() => {
        if (viewMode === 'cooking') {
            activateKeepAwakeAsync();
        } else {
            deactivateKeepAwake();
        }
        return () => { deactivateKeepAwake(); };
    }, [viewMode]);

    // Timer tick interval
    useEffect(() => {
        if (viewMode !== 'cooking') return;
        const interval = setInterval(() => {
            setTimerTick(t => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [viewMode]);

    // Notification for finished timers
    useEffect(() => {
        if (viewMode !== 'cooking') return;
        const nowMs = Date.now();
        Object.entries(activeTimers).forEach(([stepIdx, timer]) => {
            if (timer.endTime > 0 && nowMs >= timer.endTime) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('⏱️ Timer abgelaufen!', 'Ein Zubereitungsschritt ist fertig.');
                setActiveTimers(prev => {
                    const next = { ...prev };
                    delete next[parseInt(stepIdx)];
                    return next;
                });
            }
        });
    }, [_timerTick, activeTimers, viewMode]);

    const startTimer = (stepIdx: number, minutesStr: string) => {
        const mins = parseFloat(minutesStr.replace(',', '.'));
        if (isNaN(mins)) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const durationMs = mins * 60 * 1000;
        setActiveTimers(prev => ({
            ...prev,
            [stepIdx]: { endTime: Date.now() + durationMs, duration: durationMs, id: Date.now().toString() }
        }));
    };

    const stopTimer = (stepIdx: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveTimers(prev => {
            const next = { ...prev };
            delete next[stepIdx];
            return next;
        });
    };

    const getRecipeCategories = (r: Recipe): string[] => {
        if (r.categories && r.categories.length > 0) return r.categories;
        return r.category ? [r.category] : ['other'];
    };

    const filtered = recipes.filter(r => {
        const q = searchQuery.toLowerCase();
        let ingString = r.ingredients;
        try {
            const parsed = JSON.parse(r.ingredients);
            if (Array.isArray(parsed)) ingString = parsed.map(i => i.name).join(' ');
        } catch { }

        const matchSearch = !q || r.title.toLowerCase().includes(q)
            || ingString?.toLowerCase().includes(q)
            || r.description?.toLowerCase().includes(q)
            || r.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchSearch) return false;
        if (activeFilter === 'favorites') return r.is_favorite;
        if (activeFilter === 'mine') return r.created_by === user?.id;
        if (activeCategory && !getRecipeCategories(r).includes(activeCategory)) return false;
        return true;
    }).sort((a, b) => {
        if (activeFilter === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return a.title.localeCompare(b.title);
    });

    const stats = {
        total: recipes.length,
        favorites: recipes.filter(r => r.is_favorite).length,
        categories: [...new Set(recipes.flatMap(r => getRecipeCategories(r)))].length,
    };

    const getSourceDomain = (url: string | null) => {
        if (!url) return null;
        try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
    };

    const fetchWebMeta = async (url: string) => {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await res.text();
            const getMeta = (property: string) => {
                const r1 = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
                const m = html.match(r1);
                if (m) return m[1];
                const r2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i');
                return html.match(r2)?.[1];
            };

            // Extract JSON-LD Recipe structured data
            let recipeData: any = null;
            try {
                const jsonLdMatches = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
                if (jsonLdMatches) {
                    for (const block of jsonLdMatches) {
                        const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
                        const parsed = JSON.parse(jsonStr);
                        const findRecipe = (obj: any): any => {
                            if (!obj) return null;
                            if (obj['@type'] === 'Recipe') return obj;
                            if (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe')) return obj;
                            if (Array.isArray(obj)) {
                                for (const item of obj) { const r = findRecipe(item); if (r) return r; }
                            }
                            if (obj['@graph'] && Array.isArray(obj['@graph'])) {
                                for (const item of obj['@graph']) { const r = findRecipe(item); if (r) return r; }
                            }
                            return null;
                        };
                        recipeData = findRecipe(parsed);
                        if (recipeData) break;
                    }
                }
            } catch { /* JSON-LD parse error, continue with OG tags */ }

            // Extract instructions from recipe data
            let instructions = '';
            if (recipeData?.recipeInstructions) {
                const ri = recipeData.recipeInstructions;
                if (Array.isArray(ri)) {
                    instructions = ri.map((step: any, i: number) => {
                        if (typeof step === 'string') return step.trim();
                        if (step.text) return step.text.trim();
                        if (step.itemListElement && Array.isArray(step.itemListElement)) {
                            return step.itemListElement.map((s: any) => typeof s === 'string' ? s.trim() : s.text?.trim()).filter(Boolean).join('\n');
                        }
                        return '';
                    }).filter(Boolean).join('\n');
                } else if (typeof ri === 'string') {
                    instructions = ri.trim();
                }
            }

            // Extract ingredients from recipe data
            let ingredients = '';
            if (recipeData?.recipeIngredient && Array.isArray(recipeData.recipeIngredient)) {
                ingredients = recipeData.recipeIngredient.join('\n');
            }

            // Extract servings / times
            const servings = recipeData?.recipeYield
                ? parseInt(String(Array.isArray(recipeData.recipeYield) ? recipeData.recipeYield[0] : recipeData.recipeYield)) || 4
                : 4;
            const parseDuration = (iso: string | undefined) => {
                if (!iso) return '';
                const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
                if (!m) return '';
                const hrs = parseInt(m[1] || '0');
                const mins = parseInt(m[2] || '0');
                return String(hrs * 60 + mins);
            };

            return {
                title: recipeData?.name || (getMeta('og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1])?.trim(),
                image: recipeData?.image ? (Array.isArray(recipeData.image) ? recipeData.image[0] : typeof recipeData.image === 'string' ? recipeData.image : recipeData.image?.url) : getMeta('og:image'),
                description: recipeData?.description || (getMeta('og:description') || getMeta('description'))?.trim(),
                instructions,
                ingredients,
                servings,
                prepTime: parseDuration(recipeData?.prepTime),
                cookTime: parseDuration(recipeData?.cookTime),
                restTime: parseDuration(recipeData?.totalTime), // rough approximation for now if available
            };
        } catch { return {}; }
    };

    const [uniqueUnits, setUniqueUnits] = useState<string[]>([]);
    const [newCategory, setNewCategory] = useState('');

    const resetForm = () => {
        setFormTitle(''); setFormDescription(''); setFormIngredients([]);
        setFormInstructions([]); setFormServings(''); setFormPrepTime('');
        setFormCookTime(''); setFormRestTime(''); setFormCategories(['dinner']); setFormImageUrl('');
        setFormSourceUrl(''); setFormDifficulty('medium'); setFormTags([]);
        setFormNotes(''); setEditingRecipe(null); setNewCategory('');
    };

    const openCreateOwn = () => { resetForm(); setShowNewPicker(false); setViewMode('create_own'); };
    const openCreateWeb = () => { resetForm(); setShowNewPicker(false); setViewMode('create_web'); };

    const openEdit = (recipe: Recipe) => {
        setEditingRecipe(recipe);
        setFormTitle(recipe.title); setFormDescription(recipe.description || '');

        // Parse ingredients from string back to array if possible, otherwise treat as simple string list
        let parsedIngredients = [];
        try {
            parsedIngredients = JSON.parse(recipe.ingredients);
        } catch (e) {
            // Fallback for old text-based ingredients
            parsedIngredients = recipe.ingredients.split('\n').filter(Boolean).map(line => {
                // Try to extract amount and unit (very basic heuristic)
                const match = line.match(/^([\d.,]+)\s*([a-zA-Z]+)?\s*(.*)$/);
                if (match) {
                    return { amount: match[1], unit: match[2] || '', name: match[3] || '', notes: '' };
                }
                return { amount: '', unit: '', name: line, notes: '' };
            });
        }
        setFormIngredients(Array.isArray(parsedIngredients) ? parsedIngredients : []);

        // Parse instructions from string back to array
        let parsedInstructions: { text: string; time?: string }[] = [];
        try {
            const rawParsed = JSON.parse(recipe.instructions);
            if (Array.isArray(rawParsed)) {
                parsedInstructions = rawParsed.map(i => {
                    if (typeof i === 'string') return { text: i };
                    return { text: i.text || '', time: i.time || '' };
                });
            }
        } catch (e) {
            parsedInstructions = recipe.instructions.split('\n').filter(Boolean).map(i => ({
                text: i.replace(/^\d+\.\s*/, '')
            }));
        }
        setFormInstructions(parsedInstructions);
        setFormServings(recipe.servings ? String(recipe.servings) : '');
        setFormPrepTime(recipe.prep_time ? String(recipe.prep_time) : '');
        setFormCookTime(recipe.cook_time ? String(recipe.cook_time) : '');
        setFormRestTime(recipe.rest_time ? String(recipe.rest_time) : '');
        setFormCategories(getRecipeCategories(recipe)); setFormImageUrl(recipe.image_url || '');
        setFormSourceUrl(recipe.source_url || ''); setFormDifficulty(recipe.difficulty || 'medium');
        setFormTags(recipe.tags || []); setFormNotes(recipe.notes || '');
        setViewMode('create_own');
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
        if (result.canceled || !result.assets?.length) return;
        try {
            const asset = result.assets[0];
            const fileExt = asset.uri.split('.').pop() || 'jpg';
            const filePath = `recipes/${householdId}/${Date.now()}.${fileExt}`;
            const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
            const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const { error } = await supabase.storage.from('family-documents')
                .upload(filePath, binaryData, { contentType: `image/${fileExt}` });
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('family-documents').getPublicUrl(filePath);
            setFormImageUrl(urlData.publicUrl);
        } catch (e: any) { Alert.alert('Fehler', e.message); }
    };

    const handleSaveOwn = async () => {
        if (!formTitle.trim() || formIngredients.length === 0 || formInstructions.length === 0 || !householdId) {
            Alert.alert('Fehler', 'Bitte gib Titel, mindestens eine Zutat und einen Schritt ein.');
            return;
        }

        setIsSaving(true);
        try {
            const ingrStr = JSON.stringify(formIngredients.filter(i => i.name.trim() !== ''));
            const instStr = JSON.stringify(formInstructions.filter(i => i.text.trim() !== ''));

            const payload: any = {
                household_id: householdId, created_by: user?.id || null,
                title: formTitle.trim(), description: formDescription.trim() || null,
                ingredients: ingrStr,
                instructions: instStr, servings: parseInt(formServings) || 4,
                prep_time: formPrepTime ? parseInt(formPrepTime) : null,
                cook_time: formCookTime ? parseInt(formCookTime) : null,
                rest_time: formRestTime ? parseInt(formRestTime) : null,
                category: formCategories[0] || 'other', categories: formCategories,
                image_url: formImageUrl || null,
                source_url: formSourceUrl.trim() || null,
                added_by_name: members[user?.id || ''] || null,
                difficulty: formDifficulty, tags: formTags, notes: formNotes.trim() || null,
            };
            if (editingRecipe) {
                const { error } = await supabase.from('family_recipes').update(payload).eq('id', editingRecipe.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('family_recipes').insert({ ...payload, created_by: user?.id });
                if (error) throw error;
            }
            setViewMode('list'); resetForm(); loadRecipes();
        } catch (e: any) { Alert.alert('Fehler', e.message); }
        finally { setIsSaving(false); }
    };

    const handleSaveWeb = async () => {
        if (!formSourceUrl.trim() || !householdId) return Alert.alert('Fehler', 'Bitte gib eine URL ein.');
        setIsSaving(true);
        try {
            const url = formSourceUrl.trim();
            const meta = await fetchWebMeta(url);
            const { error } = await supabase.from('family_recipes').insert({
                household_id: householdId, created_by: user?.id,
                title: meta.title || formTitle.trim() || getSourceDomain(url) || 'Webrezept',
                description: meta.description || null, image_url: meta.image || null,
                source_url: url,
                ingredients: meta.ingredients || '',
                instructions: meta.instructions || '',
                servings: meta.servings || 4,
                prep_time: meta.prepTime ? parseInt(meta.prepTime) : null,
                cook_time: meta.cookTime ? parseInt(meta.cookTime) : null,
                category: 'other', added_by_name: members[user?.id || ''] || null,
                difficulty: 'medium', tags: [],
            });
            if (error) throw error;
            setViewMode('list'); resetForm(); loadRecipes();
        } catch (e: any) { Alert.alert('Fehler', e.message); }
        finally { setIsSaving(false); }
    };

    const handleImportJson = async () => {
        if (!householdId) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: false,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            setIsLoading(true);
            const fileUri = result.assets[0].uri;

            // On Android we might need to use standard fetch or expo-file-system to read the content
            const fileContent = await FileSystem.readAsStringAsync(fileUri, {
                encoding: 'utf8'
            });

            const parsedData = JSON.parse(fileContent);
            const recipesToImport = Array.isArray(parsedData) ? parsedData : [parsedData];

            let importedCount = 0;

            for (const r of recipesToImport) {
                if (!r.title || !r.ingredients || !r.instructions) {
                    console.warn('Skipping invalid recipe structure:', r.title);
                    continue;
                }

                const payload = {
                    household_id: householdId,
                    created_by: user?.id,
                    title: r.title,
                    description: r.description || null,
                    ingredients: r.ingredients || '',
                    instructions: r.instructions || '',
                    servings: parseInt(r.servings) || 4,
                    prep_time: r.prep_time ? parseInt(r.prep_time) : null,
                    cook_time: r.cook_time ? parseInt(r.cook_time) : null,
                    category: r.category || 'other',
                    categories: Array.isArray(r.categories) ? r.categories : [r.category || 'other'],
                    image_url: r.image_url || null,
                    source_url: r.source_url || null,
                    added_by_name: members[user?.id || ''] || null,
                    difficulty: r.difficulty || 'medium',
                    tags: Array.isArray(r.tags) ? r.tags : [],
                    notes: r.notes || null,
                };

                const { error } = await supabase.from('family_recipes').insert(payload);
                if (error) {
                    console.error('Error importing recipe:', error);
                } else {
                    importedCount++;
                }
            }

            if (importedCount > 0) {
                Alert.alert('Erfolg ✓', `${importedCount} Rezept(e) erfolgreich importiert.`);
                loadRecipes();
            } else {
                Alert.alert('Fehler', 'Keine gültigen Rezepte in der JSON-Datei gefunden.');
            }
        } catch (e: any) {
            console.error('JSON Import Error:', e);
            Alert.alert('Import Fehler', 'Fehler beim Lesen der JSON-Datei. Stelle sicher, dass das Dateiformat korrekt ist.');
        } finally {
            setIsLoading(false);
            setShowNewPicker(false);
        }
    };

    const handleDelete = (recipe: Recipe) => {
        Alert.alert('Löschen', `"${recipe.title}" wirklich löschen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen', style: 'destructive', onPress: async () => {
                    await supabase.from('family_recipes').delete().eq('id', recipe.id);
                    setSelectedRecipe(null); setViewMode('list'); loadRecipes();
                }
            },
        ]);
    };

    const toggleFavorite = async (recipe: Recipe) => {
        const newVal = !recipe.is_favorite;
        setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, is_favorite: newVal } : r));
        if (selectedRecipe?.id === recipe.id) setSelectedRecipe(prev => prev ? { ...prev, is_favorite: newVal } : prev);
        await supabase.from('family_recipes').update({ is_favorite: newVal }).eq('id', recipe.id);
    };

    const handleShare = (recipe: Recipe) => {
        const text = `${recipe.title}\n\nZutaten:\n${recipe.ingredients}\n\nZubereitung:\n${recipe.instructions}`;
        const { Share } = require('react-native');
        Share.share({ message: text, title: recipe.title });
    };

    const handleAssignCategory = async (recipe: Recipe, categoryKey: string) => {
        await supabase.from('family_recipes').update({ category: categoryKey }).eq('id', recipe.id);
        setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, category: categoryKey } : r));
        if (selectedRecipe?.id === recipe.id) setSelectedRecipe(prev => prev ? { ...prev, category: categoryKey } : prev);
        setShowCategoryPicker(false);
    };

    const handlePlanRecipe = async (recipe: Recipe) => {
        if (!householdId) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const { error } = await supabase.from('family_planner').insert({
                household_id: householdId, created_by: user?.id,
                title: recipe.title, description: recipe.description || '',
                type: 'recipe', date: today, recipe_id: recipe.id,
            });
            if (error) throw error;
            Alert.alert('Geplant ✓', `"${recipe.title}" wurde zum Planer hinzugefügt.`);
        } catch (e: any) { Alert.alert('Fehler', e.message); }
    };

    const handleAddToShoppingList = async (recipe: Recipe) => {
        const lines = recipe.ingredients.split('\n').filter(Boolean).map(l => l.trim());
        if (!lines.length) return Alert.alert('Keine Zutaten', 'Dieses Rezept hat keine Zutaten.');
        const ENTITY_ID = 'todo.google_keep_einkaufsliste';
        try {
            for (const line of lines) { await addTodoItem(ENTITY_ID, line); }
            Alert.alert('Hinzugefügt ✓', `${lines.length} Zutaten wurden zur Einkaufsliste hinzugefügt.`);
        } catch (e: any) { Alert.alert('Fehler', e.message); }
    };

    const handleRandomRecipe = () => {
        if (recipes.length === 0) return;
        const random = recipes[Math.floor(Math.random() * recipes.length)];
        setSelectedRecipe(random); setViewMode('detail');
        setCheckedIngredients(new Set()); setPortionMultiplier(1);
    };

    const getDifficultyInfo = (d: string | null) => DIFFICULTY_LEVELS.find(l => l.key === d) || DIFFICULTY_LEVELS[1];
    const getCategoryInfo = (c: string) => RECIPE_CATEGORIES.find(cat => cat.key === c) || RECIPE_CATEGORIES[6];
    const getTotalTime = (r: Recipe) => (r.prep_time || 0) + (r.cook_time || 0) + (r.rest_time || 0);

    const scaleIngredient = (line: string, mult: number) => {
        if (mult === 1) return line;
        return line.replace(/(\d+([.,]\d+)?)/g, (match) => {
            const num = parseFloat(match.replace(',', '.'));
            const scaled = num * mult;
            return scaled % 1 === 0 ? String(scaled) : scaled.toFixed(1).replace('.', ',');
        });
    };

    if (!visible) return null;
    // --- LIST VIEW ---
    const renderList = () => (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            {/* Header with stats */}
            <LinearGradient colors={[colors.accent, colors.accent + 'CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.listHeader}>
                <View style={s.listHeaderTop}>
                    <View>
                        <Text style={s.listHeaderTitle}>Rezeptbuch</Text>
                        <Text style={s.listHeaderSub}>{stats.total} Rezepte · {stats.favorites} Favoriten</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        <Pressable onPress={handleRandomRecipe} style={s.headerIconBtn}>
                            <Dices size={18} color="#fff" />
                        </Pressable>
                        <Pressable onPress={onClose} style={s.headerIconBtn}>
                            <X size={20} color="#fff" />
                        </Pressable>
                    </View>
                </View>
                {/* Search */}
                <View style={s.searchRow}>
                    <Search size={16} color="rgba(255,255,255,0.6)" />
                    <TextInput style={s.searchInput} value={searchQuery} onChangeText={setSearchQuery}
                        placeholder="Rezept, Zutat oder Tag suchen…" placeholderTextColor="rgba(255,255,255,0.5)" />
                </View>
            </LinearGradient>

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
                contentContainerStyle={s.filterRow}>
                {FILTER_TABS.map(tab => (
                    <Pressable key={tab.key} onPress={() => { setActiveFilter(tab.key); setActiveCategory(null); }}
                        style={[s.filterChip, { backgroundColor: activeFilter === tab.key ? colors.accent + '20' : colors.card, borderColor: activeFilter === tab.key ? colors.accent : colors.border }]}>
                        <Text style={{ fontSize: 13 }}>{tab.emoji}</Text>
                        <Text style={[s.filterLabel, { color: activeFilter === tab.key ? colors.accent : colors.text }]}>{tab.label}</Text>
                    </Pressable>
                ))}
                <View style={[s.filterDivider, { backgroundColor: colors.border }]} />
                {RECIPE_CATEGORIES.map(cat => {
                    const count = recipes.filter(r => getRecipeCategories(r).includes(cat.key)).length;
                    if (count === 0) return null;
                    return (
                        <Pressable key={cat.key} onPress={() => { setActiveCategory(activeCategory === cat.key ? null : cat.key); setActiveFilter('all'); }}
                            style={[s.filterChip, { backgroundColor: activeCategory === cat.key ? colors.accent + '20' : colors.card, borderColor: activeCategory === cat.key ? colors.accent : colors.border }]}>
                            <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
                            <Text style={[s.filterLabel, { color: activeCategory === cat.key ? colors.accent : colors.text }]}>{cat.label} ({count})</Text>
                        </Pressable>
                    );
                })}
                {customCategories.map(cat => {
                    const count = recipes.filter(r => getRecipeCategories(r).includes(cat)).length;
                    if (count === 0) return null;
                    return (
                        <Pressable key={cat} onPress={() => { setActiveCategory(activeCategory === cat ? null : cat); setActiveFilter('all'); }}
                            style={[s.filterChip, { backgroundColor: activeCategory === cat ? colors.accent + '20' : colors.card, borderColor: activeCategory === cat ? colors.accent : colors.border }]}>
                            <Text style={{ fontSize: 13 }}>🏷️</Text>
                            <Text style={[s.filterLabel, { color: activeCategory === cat ? colors.accent : colors.text }]}>{cat} ({count})</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Recipe grid */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.gridContainer}>
                {isLoading ? (
                    <ActivityIndicator color={colors.accent} style={{ paddingVertical: 60 }} />
                ) : filtered.length === 0 ? (
                    <View style={s.empty}>
                        <Text style={{ fontSize: 56 }}>📖</Text>
                        <Text style={[s.emptyTitle, { color: colors.text }]}>
                            {searchQuery ? 'Keine Treffer' : 'Dein Kochbuch ist leer'}
                        </Text>
                        <Text style={[s.emptyText, { color: colors.subtext }]}>
                            {searchQuery ? 'Versuche einen anderen Suchbegriff' : 'Tippe +, um dein erstes Rezept hinzuzufügen!'}
                        </Text>
                    </View>
                ) : (
                    <View style={s.grid}>
                        {filtered.map(recipe => {
                            const diff = getDifficultyInfo(recipe.difficulty);
                            const totalTime = getTotalTime(recipe);
                            return (
                                <Pressable key={recipe.id} style={({ pressed }) => [s.recipeCard, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                                    onPress={() => { setSelectedRecipe(recipe); setViewMode('detail'); setCheckedIngredients(new Set()); setPortionMultiplier(1); }}>
                                    {recipe.image_url ? (
                                        <Image source={{ uri: recipe.image_url }} style={s.cardImage} />
                                    ) : (
                                        <LinearGradient colors={[colors.accent + '30', colors.accent + '10']} style={s.cardImagePlaceholder}>
                                            <Text style={{ fontSize: 36 }}>{getCategoryInfo(getRecipeCategories(recipe)[0]).emoji}</Text>
                                        </LinearGradient>
                                    )}
                                    {/* Gradient overlay */}
                                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={s.cardOverlay}>
                                        <Text style={s.cardTitle} numberOfLines={2}>{recipe.title}</Text>
                                        {totalTime > 0 && (
                                            <View style={s.cardMeta}>
                                                <Clock size={11} color="rgba(255,255,255,0.7)" />
                                                <Text style={s.cardMetaText}>{totalTime} Min</Text>
                                            </View>
                                        )}
                                    </LinearGradient>
                                    {/* Favorite heart */}
                                    <Pressable style={s.cardHeart} onPress={(e) => { e.stopPropagation(); toggleFavorite(recipe); }} hitSlop={8}>
                                        <Heart size={18} color={recipe.is_favorite ? '#EF4444' : 'rgba(255,255,255,0.7)'}
                                            fill={recipe.is_favorite ? '#EF4444' : 'none'} />
                                    </Pressable>
                                    {/* Difficulty badge */}
                                    <View style={[s.cardBadge, { backgroundColor: diff.color + '20' }]}>
                                        <View style={[s.badgeDot, { backgroundColor: diff.color }]} />
                                        <Text style={[s.badgeText, { color: diff.color }]}>{diff.label}</Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* FAB */}
            <Pressable style={[s.fab, { backgroundColor: colors.accent }]} onPress={() => setShowNewPicker(true)}>
                <Plus size={26} color="#fff" />
            </Pressable>

            {/* New picker bottom sheet */}
            <Modal visible={showNewPicker} transparent animationType="slide" onRequestClose={() => setShowNewPicker(false)}>
                <View style={s.overlay}>
                    <TouchableWithoutFeedback onPress={() => setShowNewPicker(false)}><View style={{ flex: 1 }} /></TouchableWithoutFeedback>
                    <View style={[s.bottomSheet, { backgroundColor: colors.background }]}>
                        <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
                        <Text style={[s.sheetTitle, { color: colors.text }]}>Neues Rezept</Text>
                        <Pressable style={[s.ideaCard, { backgroundColor: '#6366F1' }]} onPress={openCreateOwn}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.ideaCardTitle}>Eigenes Rezept</Text>
                                <Text style={s.ideaCardDesc}>Omas Apfelkuchen oder deine eigene Kreation hinzufügen</Text>
                            </View>
                            <Text style={{ fontSize: 36 }}>👨‍🍳</Text>
                        </Pressable>
                        <Pressable style={[s.ideaCard, { backgroundColor: '#EC4899' }]} onPress={openCreateWeb}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.ideaCardTitle}>Webrezept speichern</Text>
                                <Text style={s.ideaCardDesc}>URL einfügen und Rezept automatisch importieren</Text>
                            </View>
                            <Text style={{ fontSize: 36 }}>🌐</Text>
                        </Pressable>
                        <Pressable style={[s.ideaCard, { backgroundColor: '#10B981', marginBottom: 20 }]} onPress={handleImportJson}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.ideaCardTitle}>JSON Datei importieren</Text>
                                <Text style={s.ideaCardDesc}>Lade ein oder mehrere Rezepte aus einer JSON-Datei hoch</Text>
                            </View>
                            <View style={{ width: 40, alignItems: 'center' }}>
                                <FileJson size={32} color="#fff" />
                            </View>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </Animated.View>
    );
    // --- DETAIL VIEW ---
    const renderDetail = () => {
        if (!selectedRecipe) return null;
        const r = selectedRecipe;
        const diff = getDifficultyInfo(r.difficulty);
        const totalTime = getTotalTime(r);

        let ingredientLines: any[] = [];
        try {
            ingredientLines = JSON.parse(r.ingredients);
        } catch {
            ingredientLines = r.ingredients.split('\n').filter(Boolean).map(line => ({
                amount: '', unit: '', name: line
            }));
        }

        let instructionLines: { text: string, time?: string }[] = [];
        try {
            const parsed = JSON.parse(r.instructions);
            if (Array.isArray(parsed)) {
                instructionLines = parsed.map((i: any) => typeof i === 'string' ? { text: i } : { text: i.text, time: i.time });
            }
        } catch {
            instructionLines = r.instructions.split('\n').filter(Boolean).map((i: string) => ({ text: i }));
        }

        const adjServings = Math.round((r.servings || 4) * portionMultiplier);

        return (
            <View style={{ flex: 1 }}>
                {/* Hero */}
                {r.image_url ? (
                    <View>
                        <Image source={{ uri: r.image_url }} style={s.heroImage} />
                        <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
                        <Pressable style={s.heroBack} onPress={() => setViewMode('list')}><ArrowLeft size={22} color="#fff" /></Pressable>
                        <View style={s.heroActions}>
                            <Pressable style={s.heroActionBtn} onPress={() => toggleFavorite(r)}>
                                <Heart size={20} color={r.is_favorite ? '#EF4444' : '#fff'} fill={r.is_favorite ? '#EF4444' : 'none'} />
                            </Pressable>
                            <Pressable style={s.heroActionBtn} onPress={() => openEdit(r)}><Edit3 size={18} color="#fff" /></Pressable>
                        </View>
                    </View>
                ) : (
                    <View style={[s.detailHeaderFlat, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                        <Pressable onPress={() => setViewMode('list')}><ArrowLeft size={22} color={colors.text} /></Pressable>
                        <Text style={[s.detailHeaderTitle, { color: colors.text }]} numberOfLines={1}>{r.title}</Text>
                        <Pressable onPress={() => openEdit(r)}><Edit3 size={18} color={colors.accent} /></Pressable>
                    </View>
                )}

                <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
                    {/* Title & meta */}
                    <View style={s.detailTitleSection}>
                        <Text style={[s.detailTitle, { color: colors.text }]}>{r.title}</Text>
                        {r.source_url && (
                            <Pressable onPress={() => Linking.openURL(r.source_url!)}><Text style={[s.detailSource, { color: colors.accent }]}>{getSourceDomain(r.source_url)}</Text></Pressable>
                        )}
                        {r.description && <Text style={[s.detailDesc, { color: colors.subtext }]}>{r.description}</Text>}
                    </View>

                    {/* Info pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
                        {totalTime > 0 && (
                            <View style={[s.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Clock size={14} color={colors.accent} /><Text style={[s.pillText, { color: colors.text }]}>{totalTime} Min</Text>
                            </View>
                        )}
                        {r.rest_time ? (
                            <View style={[s.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[s.pillText, { color: colors.subtext, fontWeight: '500' }]}>+ {r.rest_time} Min Ruhe</Text>
                            </View>
                        ) : null}
                        <View style={[s.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Users size={14} color={colors.accent} /><Text style={[s.pillText, { color: colors.text }]}>{adjServings} Portionen</Text>
                        </View>
                        <View style={[s.pill, { backgroundColor: diff.color + '15', borderColor: diff.color + '30' }]}>
                            <View style={[s.badgeDot, { backgroundColor: diff.color }]} />
                            <Text style={[s.pillText, { color: diff.color }]}>{diff.label}</Text>
                        </View>
                        <View style={[s.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={{ fontSize: 14 }}>{getCategoryInfo(getRecipeCategories(r)[0]).emoji}</Text>
                            <Text style={[s.pillText, { color: colors.text }]}>{getRecipeCategories(r).map(c => getCategoryInfo(c).label).join(', ')}</Text>
                        </View>
                    </ScrollView>

                    {/* Tags */}
                    {r.tags && r.tags.length > 0 && (
                        <View style={s.tagRow}>
                            {r.tags.map((tag, i) => (
                                <View key={i} style={[s.tagChip, { backgroundColor: colors.accent + '12' }]}>
                                    <Text style={[s.tagText, { color: colors.accent }]}>#{tag}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Action buttons under Hero */}
                    <View style={s.detailActionsHero}>
                        <Pressable
                            style={[s.actionBtnMain, { backgroundColor: colors.accent }]}
                            onPress={() => {
                                setCookingPhase('mise_en_place');
                                setCookingStep(0);
                                setCheckedIngredients(new Set());
                                setActiveTimers({});
                                setViewMode('cooking');
                            }}
                        >
                            <ChefHat size={18} color="#fff" /><Text style={[s.actionBtnTextMain, { color: '#fff' }]}>Kochmodus starten</Text>
                        </Pressable>
                    </View>

                    {/* Portion calculator */}
                    {ingredientLines.length > 0 && (
                        <View style={[s.portionCalc, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[s.portionLabel, { color: colors.text }]}>Portionen anpassen</Text>
                            <View style={s.portionControls}>
                                <Pressable style={[s.portionBtn, { backgroundColor: colors.accent + '15' }]} onPress={() => setPortionMultiplier(Math.max(0.5, portionMultiplier - 0.5))}>
                                    <Text style={[s.portionBtnText, { color: colors.accent }]}>−</Text>
                                </Pressable>
                                <Text style={[s.portionValue, { color: colors.text }]}>{adjServings}</Text>
                                <Pressable style={[s.portionBtn, { backgroundColor: colors.accent + '15' }]} onPress={() => setPortionMultiplier(portionMultiplier + 0.5)}>
                                    <Text style={[s.portionBtnText, { color: colors.accent }]}>+</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    {/* Ingredients with checkboxes */}
                    {ingredientLines.length > 0 && (
                        <>
                            <Text style={[s.sectionLabel, { color: colors.subtext }]}>ZUTATEN</Text>
                            <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
                                {ingredientLines.map((ing, i) => {
                                    const checked = checkedIngredients.has(i);

                                    // Scale parsing
                                    let scaledAmount = ing.amount;
                                    if (ing.amount && portionMultiplier !== 1) {
                                        const num = parseFloat(ing.amount.replace(',', '.'));
                                        if (!isNaN(num)) {
                                            const scaled = num * portionMultiplier;
                                            scaledAmount = scaled % 1 === 0 ? String(scaled) : scaled.toFixed(1).replace('.', ',');
                                        }
                                    }

                                    return (
                                        <Pressable key={i} style={[s.ingredientLine, { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: i < ingredientLines.length - 1 ? 1 : 0, borderBottomColor: colors.border }]} onPress={() => {
                                            setCheckedIngredients(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
                                        }}>
                                            <View style={{ flex: 0.35, flexDirection: 'row', gap: 4 }}>
                                                <Text style={[{ color: '#F59E0B', fontSize: 15, fontWeight: '700' }, checked && { opacity: 0.5 }]}>
                                                    {scaledAmount}
                                                </Text>
                                                <Text style={[{ color: '#F59E0B', fontSize: 15, fontWeight: '700' }, checked && { opacity: 0.5 }]}>
                                                    {ing.unit}
                                                </Text>
                                            </View>
                                            <Text style={[{ color: colors.text, fontSize: 15, flex: 1 }, checked && { textDecorationLine: 'line-through', color: colors.subtext }]}>
                                                {ing.name}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    {/* Instructions */}
                    {instructionLines.length > 0 && (
                        <>
                            <Text style={[s.sectionLabel, { color: colors.subtext }]}>ANLEITUNG</Text>
                            <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                {instructionLines.map((line, i) => (
                                    <View key={i} style={s.stepLine}>
                                        <View style={[s.stepNumber, { backgroundColor: colors.accent + '15' }]}>
                                            <Text style={[s.stepNumberText, { color: colors.accent }]}>{i + 1}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
                                                {line.text ? line.text.trim() : ''}
                                            </Text>
                                            {line.time ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                                                    <Clock size={12} color={colors.accent} />
                                                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{line.time}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {/* Notes */}
                    {r.notes && (
                        <>
                            <Text style={[s.sectionLabel, { color: colors.subtext }]}>NOTIZEN</Text>
                            <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{r.notes}</Text>
                            </View>
                        </>
                    )}

                    {/* Action buttons */}
                    <View style={s.detailActions}>
                        <Pressable style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleShare(r)}>
                            <Share2 size={16} color={colors.text} /><Text style={[s.actionBtnText, { color: colors.text }]}>Teilen</Text>
                        </Pressable>
                        <Pressable style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleAddToShoppingList(r)}>
                            <ShoppingCart size={16} color={colors.text} /><Text style={[s.actionBtnText, { color: colors.text }]}>Einkaufsliste</Text>
                        </Pressable>
                    </View>

                    {/* Delete */}
                    <Pressable style={s.deleteBtn} onPress={() => handleDelete(r)}>
                        <Trash2 size={15} color="#EF4444" /><Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 14 }}>Rezept löschen</Text>
                    </Pressable>
                </ScrollView>

                {/* Bottom bar */}
                <View style={s.bottomBar}>
                    <Pressable style={[s.bottomBtn, { backgroundColor: colors.accent, flex: 1 }]} onPress={() => handlePlanRecipe(r)}>
                        <ChefHat size={18} color="#fff" /><Text style={s.bottomBtnText}>Planen</Text>
                    </Pressable>
                    {instructionLines.length > 0 && (
                        <Pressable style={[s.bottomBtn, { backgroundColor: '#22C55E' }]} onPress={() => { setCookingStep(0); setViewMode('cooking'); }}>
                            <ChefHat size={18} color="#fff" /><Text style={s.bottomBtnText}>Kochen</Text>
                        </Pressable>
                    )}
                </View>

                {/* Category picker modal */}
                <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
                    <View style={s.overlay}>
                        <TouchableWithoutFeedback onPress={() => setShowCategoryPicker(false)}><View style={{ flex: 1 }} /></TouchableWithoutFeedback>
                        <View style={[s.bottomSheet, { backgroundColor: colors.background }]}>
                            <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
                            <Text style={[s.sheetTitle, { color: colors.text }]}>Kategorie wählen</Text>
                            {RECIPE_CATEGORIES.map(cat => (
                                <Pressable key={cat.key} style={[s.catPickerRow, getRecipeCategories(r).includes(cat.key) && { backgroundColor: colors.accent + '15' }]}
                                    onPress={() => handleAssignCategory(r, cat.key)}>
                                    <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                                    <Text style={[s.catPickerLabel, { color: getRecipeCategories(r).includes(cat.key) ? colors.accent : colors.text }]}>{cat.label}</Text>
                                    {getRecipeCategories(r).includes(cat.key) && <Check size={18} color={colors.accent} />}
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </Modal>
            </View>
        );
    };


    // --- CREATE OWN ---
    const isMovieBoard = formCategories.includes('movieboard');
    const toggleFormCategory = (key: string) => {
        setFormCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const renderCreateOwn = () => (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View style={[s.formHeader, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setViewMode('list')} hitSlop={12}><ArrowLeft size={22} color={colors.text} /></Pressable>
                <Text style={[s.formHeaderTitle, { color: colors.text }]}>{editingRecipe ? 'Bearbeiten' : 'Neues Rezept'}</Text>
                <Pressable onPress={handleSaveOwn} disabled={isSaving} style={[s.saveBtn, { backgroundColor: colors.accent }]}>
                    {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <><Check size={16} color="#fff" /><Text style={s.saveBtnText}>Speichern</Text></>}
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Hero Photo */}
                <Pressable onPress={handlePickImage} style={[s.photoArea, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {formImageUrl ? (
                        <Image source={{ uri: formImageUrl }} style={s.photoPreview} />
                    ) : (
                        <View style={s.photoPlaceholder}>
                            <View style={[s.photoIconCircle, { backgroundColor: colors.accent + '15' }]}><Camera size={24} color={colors.accent} /></View>
                            <Text style={[s.photoHint, { color: colors.subtext }]}>Foto hinzufügen</Text>
                        </View>
                    )}
                    {formImageUrl && (
                        <View style={s.photoChangeOverlay}>
                            <Camera size={16} color="#fff" /><Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Ändern</Text>
                        </View>
                    )}
                </Pressable>

                {/* Title & Description */}
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput style={[s.formTitleInput, { color: colors.text }]}
                        value={formTitle} onChangeText={setFormTitle}
                        placeholder={isMovieBoard ? "z.B. Movie Night Snack Board" : "Rezepttitel"}
                        placeholderTextColor={colors.subtext} maxLength={100} />
                    <View style={[s.formDivider, { backgroundColor: colors.border }]} />
                    <TextInput style={[s.formTextArea, { color: colors.text }]}
                        value={formDescription} onChangeText={setFormDescription}
                        placeholder={isMovieBoard ? "Beschreibe dein Board – z.B. Perfektes Snack-Board für einen Filmabend mit Freunden" : "Kurze Beschreibung (optional)"}
                        placeholderTextColor={colors.subtext} multiline numberOfLines={2} />
                </View>

                {/* Categories – Multi-select */}
                <Text style={[s.formSectionTitle, { color: colors.text }]}>Kategorien</Text>
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 12 }]}>
                    <View style={s.catGrid}>
                        {RECIPE_CATEGORIES.map(cat => {
                            const selected = formCategories.includes(cat.key);
                            const isMovie = cat.key === 'movieboard';
                            return (
                                <Pressable key={cat.key} onPress={() => toggleFormCategory(cat.key)}
                                    style={[s.catToggle, {
                                        backgroundColor: selected ? (isMovie ? '#7C3AED20' : colors.accent + '15') : 'transparent',
                                        borderColor: selected ? (isMovie ? '#7C3AED' : colors.accent) : colors.border,
                                    }]}>
                                    <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                                    <Text style={[s.catToggleLabel, { color: selected ? (isMovie ? '#7C3AED' : colors.accent) : colors.subtext }]}>{cat.label}</Text>
                                </Pressable>
                            );
                        })}
                        {customCategories.map(cat => {
                            const selected = formCategories.includes(cat);
                            return (
                                <Pressable key={cat} onPress={() => toggleFormCategory(cat)}
                                    style={[s.catToggle, {
                                        backgroundColor: selected ? colors.accent + '15' : 'transparent',
                                        borderColor: selected ? colors.accent : colors.border,
                                    }]}>
                                    <Text style={{ fontSize: 16 }}>🏷️</Text>
                                    <Text style={[s.catToggleLabel, { color: selected ? colors.accent : colors.subtext }]}>{cat}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                        <TextInput
                            style={[s.formRowInput, { flex: 1, backgroundColor: colors.background, padding: 10, borderRadius: 8, color: colors.text }]}
                            value={newCategory}
                            onChangeText={setNewCategory}
                            placeholder="Eigene Kategorie..."
                            placeholderTextColor={colors.subtext}
                        />
                        <Pressable
                            style={{ padding: 10, backgroundColor: colors.accent, borderRadius: 8 }}
                            onPress={() => {
                                const cat = newCategory.trim();
                                if (cat && !customCategories.includes(cat) && !RECIPE_CATEGORIES.some(c => c.key === cat)) {
                                    setCustomCategories([...customCategories, cat].sort());
                                    setFormCategories([...formCategories, cat]);
                                    setNewCategory('');
                                } else if (cat) {
                                    setNewCategory(''); // Already exists
                                    if (!formCategories.includes(cat)) {
                                        setFormCategories([...formCategories, cat]);
                                    }
                                }
                            }}
                        >
                            <Plus size={18} color="#fff" />
                        </Pressable>
                    </View>
                </View>

                {/* Movie Board hint */}
                {isMovieBoard && (
                    <View style={[s.movieHint, { backgroundColor: '#7C3AED15', borderColor: '#7C3AED30' }]}>
                        <Text style={{ fontSize: 18 }}>🎬🍿</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.movieHintTitle, { color: '#7C3AED' }]}>Movie Food Board Modus</Text>
                            <Text style={[s.movieHintDesc, { color: colors.subtext }]}>Felder sind für ein Snack-/Grazing-Board angepasst</Text>
                        </View>
                    </View>
                )}

                {/* Difficulty & Time */}
                <Text style={[s.formSectionTitle, { color: colors.text }]}>Details</Text>
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {/* Difficulty */}
                    <View style={s.formCardRow}>
                        <View style={[s.formIcon, { backgroundColor: '#F59E0B20' }]}><Star size={16} color="#F59E0B" /></View>
                        <Text style={[s.formCardLabel, { color: colors.text }]}>Schwierigkeit</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {DIFFICULTY_LEVELS.map(d => (
                                <Pressable key={d.key} onPress={() => setFormDifficulty(d.key)}
                                    style={[s.diffChip, { backgroundColor: formDifficulty === d.key ? d.color + '20' : colors.border, borderColor: formDifficulty === d.key ? d.color : 'transparent' }]}>
                                    <Text style={{ fontSize: 11, color: formDifficulty === d.key ? d.color : colors.subtext, fontWeight: '600' }}>{d.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                    <View style={[s.formDivider, { backgroundColor: colors.border }]} />
                    {/* Prep time */}
                    <View style={s.formCardRow}>
                        <View style={[s.formIcon, { backgroundColor: '#F59E0B20' }]}><Clock size={16} color="#F59E0B" /></View>
                        <Text style={[s.formCardLabel, { color: colors.text }]}>{isMovieBoard ? 'Vorbereitungszeit' : 'Vorbereitung'}</Text>
                        <TextInput style={[s.formSmallInput, { color: colors.text, backgroundColor: colors.background }]}
                            value={formPrepTime} onChangeText={setFormPrepTime} placeholder="Min" placeholderTextColor={colors.subtext} keyboardType="number-pad" />
                    </View>
                    <View style={[s.formDivider, { backgroundColor: colors.border }]} />
                    {/* Cook time */}
                    <View style={s.formCardRow}>
                        <View style={[s.formIcon, { backgroundColor: '#EF444420' }]}><Flame size={16} color="#EF4444" /></View>
                        <Text style={[s.formCardLabel, { color: colors.text }]}>{isMovieBoard ? 'Aufbauzeit' : 'Kochzeit'}</Text>
                        <TextInput style={[s.formSmallInput, { color: colors.text, backgroundColor: colors.background }]}
                            value={formCookTime} onChangeText={setFormCookTime} placeholder="Min" placeholderTextColor={colors.subtext} keyboardType="number-pad" />
                    </View>
                    <View style={[s.formDivider, { backgroundColor: colors.border }]} />
                    {/* Rest time */}
                    <View style={s.formCardRow}>
                        <View style={[s.formIcon, { backgroundColor: '#3B82F620' }]}><Clock size={16} color="#3B82F6" /></View>
                        <Text style={[s.formCardLabel, { color: colors.text }]}>Ruhezeit</Text>
                        <TextInput style={[s.formSmallInput, { color: colors.text, backgroundColor: colors.background }]}
                            value={formRestTime} onChangeText={setFormRestTime} placeholder="Min" placeholderTextColor={colors.subtext} keyboardType="number-pad" />
                    </View>
                    <View style={[s.formDivider, { backgroundColor: colors.border }]} />
                    {/* Servings */}
                    <View style={s.formCardRow}>
                        <View style={[s.formIcon, { backgroundColor: colors.accent + '15' }]}><Users size={16} color={colors.accent} /></View>
                        <Text style={[s.formCardLabel, { color: colors.text }]}>{isMovieBoard ? 'Personen' : 'Portionen'}</Text>
                        <TextInput style={[s.formSmallInput, { color: colors.text, backgroundColor: colors.background }]}
                            value={formServings} onChangeText={setFormServings} placeholder="4" placeholderTextColor={colors.subtext} keyboardType="number-pad" />
                    </View>
                </View>

                {/* Ingredients / Board Items */}
                <Text style={[s.formSectionTitle, { color: colors.text }]}>{isMovieBoard ? 'Board-Zutaten' : 'Zutaten'}</Text>
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 8, zIndex: 10 }]}>
                    {formIngredients.map((ing, idx) => (
                        <View key={`ing_${idx}`} style={{ marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                <TextInput
                                    style={[s.formRowInput, { flex: 0.3, backgroundColor: colors.background, padding: 10, borderRadius: 8, color: colors.accent, fontWeight: '700' }]}
                                    value={ing.amount}
                                    onChangeText={(val) => {
                                        const neu = [...formIngredients];
                                        neu[idx].amount = val;
                                        setFormIngredients(neu);
                                    }}
                                    placeholder="Menge"
                                    placeholderTextColor={colors.subtext}
                                    keyboardType="numeric"
                                />
                                <View style={{ flex: 0.3, position: 'relative', zIndex: 100 - idx }}>
                                    <TextInput
                                        style={[s.formRowInput, { backgroundColor: colors.background, padding: 10, borderRadius: 8, color: colors.accent, fontWeight: '700' }]}
                                        value={ing.unit}
                                        onChangeText={(val) => {
                                            const neu = [...formIngredients];
                                            neu[idx].unit = val;
                                            setFormIngredients(neu);
                                        }}
                                        placeholder="Einh."
                                        placeholderTextColor={colors.subtext}
                                    />
                                    {ing.unit.length > 0 && Array.isArray(uniqueUnits) && uniqueUnits.filter(u => u.toLowerCase().startsWith(ing.unit.toLowerCase()) && u !== ing.unit).length > 0 && (
                                        <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 4, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 }}>
                                            {uniqueUnits.filter(u => u.toLowerCase().startsWith(ing.unit.toLowerCase()) && u !== ing.unit).slice(0, 3).map(u => (
                                                <Pressable key={u} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '50' }} onPress={() => {
                                                    const neu = [...formIngredients];
                                                    neu[idx].unit = u;
                                                    setFormIngredients(neu);
                                                }}>
                                                    <Text style={{ color: colors.text, fontSize: 14 }}>{u}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}
                                </View>
                                <TextInput
                                    style={[s.formRowInput, { flex: 1, backgroundColor: colors.background, padding: 10, borderRadius: 8, color: colors.text }]}
                                    value={ing.name}
                                    onChangeText={(val) => {
                                        const neu = [...formIngredients];
                                        neu[idx].name = val;
                                        setFormIngredients(neu);
                                    }}
                                    placeholder={isMovieBoard ? "Nachos, Popcorn..." : "Zutat"}
                                    placeholderTextColor={colors.subtext}
                                />
                                <Pressable onPress={() => setFormIngredients(formIngredients.filter((_, i) => i !== idx))} style={{ padding: 8 }}>
                                    <X size={18} color={colors.subtext} />
                                </Pressable>
                            </View>
                            <TextInput
                                style={[s.formRowInput, { backgroundColor: colors.background, padding: 10, borderRadius: 8, color: colors.subtext, marginTop: 4, fontStyle: 'italic', fontSize: 13 }]}
                                value={ing.notes || ''}
                                onChangeText={(val) => {
                                    const neu = [...formIngredients];
                                    neu[idx].notes = val;
                                    setFormIngredients(neu);
                                }}
                                placeholder="Bemerkung (z.B. fein gehackt) - Optional"
                                placeholderTextColor={colors.subtext + '80'}
                            />
                        </View>
                    ))}
                    <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4, borderRadius: 8, backgroundColor: colors.accent + '15' }}
                        onPress={() => setFormIngredients([...formIngredients, { amount: '', unit: '', name: '', notes: '' }])}>
                        <Plus size={16} color={colors.accent} />
                        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Zutat hinzufügen</Text>
                    </Pressable>
                </View>

                {/* Instructions / Arrangement */}
                <Text style={[s.formSectionTitle, { color: colors.text }]}>{isMovieBoard ? 'Aufbau-Anleitung' : 'Zubereitung'}</Text>
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 8 }]}>
                    {formInstructions.map((step, idx) => (
                        <View key={`step_${idx}`} style={{ flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{idx + 1}</Text>
                            </View>
                            <View style={{ flex: 1, gap: 8 }}>
                                <TextInput
                                    style={[s.formTextArea, { backgroundColor: colors.background, borderRadius: 12, color: colors.text }]}
                                    value={step.text}
                                    onChangeText={(val) => {
                                        const neu = [...formInstructions];
                                        neu[idx].text = val;
                                        setFormInstructions(neu);
                                    }}
                                    placeholder={isMovieBoard ? "Aufbau Schritt..." : "Rezept Schritt..."}
                                    placeholderTextColor={colors.subtext}
                                    multiline
                                />
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Clock size={16} color={colors.subtext} />
                                    <TextInput
                                        style={[s.formRowInput, { flex: 1, backgroundColor: colors.background, padding: 8, borderRadius: 8, color: colors.text }]}
                                        value={step.time || ''}
                                        onChangeText={(val) => {
                                            const neu = [...formInstructions];
                                            neu[idx].time = val;
                                            setFormInstructions(neu);
                                        }}
                                        placeholder="Optionale Zeit (z.B. 10 Min)"
                                        placeholderTextColor={colors.subtext}
                                    />
                                </View>
                            </View>
                            <Pressable onPress={() => setFormInstructions(formInstructions.filter((_, i) => i !== idx))} style={{ padding: 8, marginTop: 4 }}>
                                <X size={18} color={colors.subtext} />
                            </Pressable>
                        </View>
                    ))}
                    <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.accent + '15' }}
                        onPress={() => setFormInstructions([...formInstructions, { text: '' }])}>
                        <Plus size={16} color={colors.accent} />
                        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Schritt hinzufügen</Text>
                    </Pressable>
                </View>

                {/* Tags */}
                <Text style={[s.formSectionTitle, { color: colors.text }]}>Tags</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    {COMMON_TAGS.map(tag => (
                        <Pressable key={tag} onPress={() => setFormTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                            style={[s.tagToggle, { backgroundColor: formTags.includes(tag) ? colors.accent + '15' : colors.card, borderColor: formTags.includes(tag) ? colors.accent : colors.border }]}>
                            <Text style={{ fontSize: 13, color: formTags.includes(tag) ? colors.accent : colors.text, fontWeight: '600' }}>{tag}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Notes */}
                <Text style={[s.formSectionTitle, { color: colors.text }]}>{isMovieBoard ? 'Tipps & Film-Empfehlung' : 'Notizen'}</Text>
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput style={[s.formTextArea, { color: colors.text }]}
                        value={formNotes} onChangeText={setFormNotes}
                        placeholder={isMovieBoard ? "z.B. Passt perfekt zu: Avengers Marathon 🍿\nTipp: Board 15 Min vorher aufbauen" : "Tipps, Variationen oder persönliche Notizen…"}
                        placeholderTextColor={colors.subtext} multiline />
                </View>

                {/* Source URL */}
                <Text style={[s.formSectionTitle, { color: colors.text }]}>Quelle (optional)</Text>
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.formCardRow}>
                        <View style={[s.formIcon, { backgroundColor: colors.accent + '15' }]}><Bookmark size={16} color={colors.accent} /></View>
                        <TextInput style={[s.formRowInput, { color: colors.text }]}
                            value={formSourceUrl} onChangeText={setFormSourceUrl}
                            placeholder="Link zum Originalrezept" placeholderTextColor={colors.subtext} autoCapitalize="none" />
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );

    // --- CREATE WEB ---
    const renderCreateWeb = () => (
        <View style={{ flex: 1 }}>
            <View style={[s.formHeader, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setViewMode('list')} hitSlop={12}><ArrowLeft size={22} color={colors.text} /></Pressable>
                <Text style={[s.formHeaderTitle, { color: colors.text }]}>Webrezept importieren</Text>
                <View style={{ width: 24 }} />
            </View>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <LinearGradient colors={['#EC4899', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.webIconLarge}>
                    <Text style={{ fontSize: 44 }}>🌐</Text>
                </LinearGradient>
                <Text style={[s.webTitle, { color: colors.text }]}>Rezept aus dem Web speichern</Text>
                <Text style={[s.webHint, { color: colors.subtext }]}>Füge die URL ein – Titel und Bild werden automatisch importiert</Text>
                <View style={[s.webInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Bookmark size={16} color={colors.subtext} />
                    <TextInput style={[s.webUrlInput, { color: colors.text }]}
                        value={formSourceUrl} onChangeText={setFormSourceUrl} placeholder="https://www.beispiel.de/rezept"
                        placeholderTextColor={colors.subtext} autoCapitalize="none" keyboardType="url" />
                </View>
                <Pressable style={({ pressed }) => [s.webSaveBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 }]} onPress={handleSaveWeb} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <><Bookmark size={18} color="#fff" /><Text style={s.webSaveBtnText}>Rezept importieren</Text></>}
                </Pressable>
            </View>
        </View>
    );

    // --- COOKING MODE ---
    const renderCooking = () => {
        if (!selectedRecipe) return null;
        const r = selectedRecipe;
        const adjServings = Math.round((r.servings || 4) * portionMultiplier);

        let ingredientLines: any[] = [];
        try { ingredientLines = JSON.parse(r.ingredients); }
        catch { ingredientLines = r.ingredients.split('\n').filter(Boolean).map((line: string) => ({ amount: '', unit: '', name: line })); }

        let instructionLines: { text: string, time?: string }[] = [];
        try {
            const parsed = JSON.parse(r.instructions);
            if (Array.isArray(parsed)) instructionLines = parsed.map((i: any) => typeof i === 'string' ? { text: i } : { text: i.text, time: i.time });
        } catch { instructionLines = r.instructions.split('\n').filter(Boolean).map((i: string) => ({ text: i })); }

        if (cookingPhase === 'mise_en_place') {
            return (
                <View style={[s.cookingContainer, { backgroundColor: colors.background }]}>
                    <View style={s.cookingHeader}>
                        <Pressable onPress={() => setViewMode('detail')}><ArrowLeft size={24} color={colors.text} /></Pressable>
                        <Text style={[s.cookingTitle, { color: colors.text }]}>Mise en Place</Text>
                        <View style={{ width: 24 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 }}>Zutaten bereitlegen</Text>
                        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
                            {ingredientLines.map((ing, i) => {
                                const checked = checkedIngredients.has(i);
                                let scaledAmount = ing.amount;
                                if (ing.amount && portionMultiplier !== 1) {
                                    const num = parseFloat(ing.amount.replace(',', '.'));
                                    if (!isNaN(num)) scaledAmount = (num * portionMultiplier % 1 === 0 ? (num * portionMultiplier).toString() : (num * portionMultiplier).toFixed(1).replace('.', ','));
                                }
                                return (
                                    <Pressable key={i} style={[s.ingredientLine, { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: i < ingredientLines.length - 1 ? 1 : 0, borderBottomColor: colors.border }]}
                                        onPress={() => setCheckedIngredients(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}>
                                        <View style={{ flex: 0.35, flexDirection: 'row', gap: 4 }}>
                                            <Text style={[{ color: '#F59E0B', fontSize: 16, fontWeight: '700' }, checked && { opacity: 0.5 }]}>{scaledAmount}</Text>
                                            <Text style={[{ color: '#F59E0B', fontSize: 16, fontWeight: '700' }, checked && { opacity: 0.5 }]}>{ing.unit}</Text>
                                        </View>
                                        <Text style={[{ color: colors.text, fontSize: 16, flex: 1 }, checked && { textDecorationLine: 'line-through', color: colors.subtext }]}>{ing.name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </ScrollView>
                    <View style={s.cookingNav}>
                        <Pressable style={[s.cookingNavBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                            onPress={() => setCookingPhase('steps')}>
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Loskochen</Text><ArrowRight size={20} color="#fff" />
                        </Pressable>
                    </View>
                </View>
            );
        }

        if (cookingPhase === 'steps') {
            const step = instructionLines[cookingStep];
            const progress = (cookingStep + 1) / instructionLines.length;
            const timer = activeTimers[cookingStep];
            let remainingText = '';
            if (timer && timer.endTime > 0) {
                const diffSec = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
                const m = Math.floor(diffSec / 60);
                const secs = diffSec % 60;
                remainingText = `${m}:${secs < 10 ? '0' : ''}${secs}`;
            }

            return (
                <View style={[s.cookingContainer, { backgroundColor: colors.background }]}>
                    <View style={s.cookingHeader}>
                        <Pressable onPress={() => setViewMode('detail')}><X size={24} color={colors.text} /></Pressable>
                        <Text style={[s.cookingTitle, { color: colors.subtext, textAlign: 'center' }]}>{r.title}</Text>
                        <Text style={[s.cookingProgress, { color: colors.accent }]}>{cookingStep + 1} / {instructionLines.length}</Text>
                    </View>
                    <View style={[s.progressBar, { backgroundColor: colors.border }]}>
                        <View style={[s.progressFill, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
                    </View>

                    <View style={s.cookingContent}>
                        <View style={[s.cookingStepBadge, { backgroundColor: colors.accent + '20' }]}>
                            <Text style={[s.cookingStepNum, { color: colors.accent }]}>SCHRITT {cookingStep + 1}</Text>
                        </View>
                        <Text style={[s.cookingStepText, { color: colors.text }]}>{step?.text}</Text>

                        {step?.time && (
                            <View style={{ marginTop: 40, alignItems: 'center' }}>
                                {timer ? (
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ fontSize: 36, fontWeight: '900', color: colors.text, marginBottom: 12 }}>{remainingText}</Text>
                                        <Pressable onPress={() => stopTimer(cookingStep)} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#EF444420' }}>
                                            <Text style={{ color: '#EF4444', fontWeight: '700' }}>Timer abbrechen</Text>
                                        </Pressable>
                                    </View>
                                ) : (
                                    <Pressable onPress={() => startTimer(cookingStep, step.time!)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.accent + '20', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 24 }}>
                                        <Clock size={24} color={colors.accent} />
                                        <View>
                                            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '800' }}>{step.time} Min. Timer</Text>
                                            <Text style={{ color: colors.accent, fontSize: 13, opacity: 0.8 }}>Hier tippen zum Starten</Text>
                                        </View>
                                    </Pressable>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={s.cookingNav}>
                        <Pressable style={[s.cookingNavBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: cookingStep === 0 ? 0.5 : 1 }]}
                            onPress={() => cookingStep > 0 && setCookingStep(cookingStep - 1)} disabled={cookingStep === 0}>
                            <ArrowLeft size={20} color={colors.text} /><Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Zurück</Text>
                        </Pressable>
                        <Pressable style={[s.cookingNavBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                            onPress={() => {
                                if (cookingStep < instructionLines.length - 1) {
                                    setCookingStep(cookingStep + 1);
                                } else {
                                    setCookingPhase('done');
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }
                            }}>
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                                {cookingStep === instructionLines.length - 1 ? 'Abschließen' : 'Weiter'}
                            </Text>
                            {cookingStep === instructionLines.length - 1 ? <Check size={20} color="#fff" /> : <ArrowRight size={20} color="#fff" />}
                        </Pressable>
                    </View>
                </View>
            );
        }

        // Done phase
        return (
            <View style={[s.cookingContainer, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#10B98120', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                    <ChefHat size={50} color="#10B981" />
                </View>
                <Text style={{ fontSize: 32, fontWeight: '900', color: colors.text, marginBottom: 8 }}>Guten Appetit!</Text>
                <Text style={{ fontSize: 16, color: colors.subtext, textAlign: 'center', paddingHorizontal: 40, lineHeight: 24 }}>
                    Du hast {r.title} erfolgreich zubereitet. Lass es dir schmecken!
                </Text>
                <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 20, left: 20, right: 20 }}>
                    <Pressable style={[s.cookingNavBtn, { backgroundColor: colors.accent, borderColor: colors.accent, width: '100%' }]}
                        onPress={() => setViewMode('detail')}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Zurück zum Rezept</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={[s.container, { backgroundColor: colors.background }]}>
                    {viewMode === 'list' && renderList()}
                    {viewMode === 'detail' && renderDetail()}
                    {viewMode === 'create_own' && renderCreateOwn()}
                    {viewMode === 'create_web' && renderCreateWeb()}
                    {viewMode === 'cooking' && renderCooking()}
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}
const s = StyleSheet.create({
    container: { flex: 1 },
    // List header
    listHeader: { paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingHorizontal: 20, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    listHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    listHeaderTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
    listHeaderSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
    headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
    searchInput: { flex: 1, fontSize: 15, color: '#fff' },
    // Filters
    filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6, alignItems: 'flex-start' },
    filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, height: 34 },
    filterLabel: { fontSize: 12, fontWeight: '600' },
    filterDivider: { width: 1, height: 20, marginHorizontal: 4 },
    // Grid
    gridContainer: { paddingHorizontal: 16, paddingBottom: 100 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    recipeCard: { width: CARD_WIDTH, borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
    cardImage: { width: '100%', height: CARD_WIDTH * 1.2, resizeMode: 'cover' },
    cardImagePlaceholder: { width: '100%', height: CARD_WIDTH * 1.2, justifyContent: 'center', alignItems: 'center' },
    cardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, paddingTop: 40 },
    cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 18 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    cardMetaText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
    cardHeart: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    cardBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    // Empty
    empty: { alignItems: 'center', paddingVertical: 60, width: '100%' },
    emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
    emptyText: { textAlign: 'center', marginTop: 6, fontSize: 14, lineHeight: 20 },
    // FAB
    fab: { position: 'absolute', bottom: 30, right: 20, width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    // Bottom sheet
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
    ideaCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 18, marginBottom: 12, gap: 14 },
    ideaCardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 2 },
    ideaCardDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18 },
    // Detail
    heroImage: { width: SCREEN_WIDTH, height: 280, resizeMode: 'cover' },
    heroBack: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    heroActions: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, right: 16, flexDirection: 'row', gap: 8 },
    heroActionBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    detailHeaderFlat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20, borderBottomWidth: 1 },
    detailHeaderTitle: { fontSize: 18, fontWeight: '700', flex: 1, marginHorizontal: 12 },
    detailTitleSection: { padding: 20, paddingBottom: 8 },
    detailTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
    detailSource: { fontSize: 14, fontWeight: '600', marginTop: 4 },
    detailDesc: { fontSize: 14, lineHeight: 20, marginTop: 8 },
    pillRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
    pillText: { fontSize: 13, fontWeight: '600' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, marginBottom: 12 },
    tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    tagText: { fontSize: 12, fontWeight: '600' },
    // Portion calculator
    portionCalc: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    portionLabel: { fontSize: 15, fontWeight: '600' },
    portionControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    portionBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    portionBtnText: { fontSize: 20, fontWeight: '700' },
    portionValue: { fontSize: 20, fontWeight: '800', minWidth: 24, textAlign: 'center' },
    // Sections
    sectionLabel: { fontSize: 12, fontWeight: '700', marginLeft: 20, marginTop: 8, marginBottom: 6, letterSpacing: 0.5 },
    section: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
    ingredientLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
    stepLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
    stepNumber: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 0 },
    stepNumberText: { fontSize: 13, fontWeight: '800' },
    // Actions
    detailActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 4, marginBottom: 8 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
    actionBtnText: { fontSize: 13, fontWeight: '600' },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginHorizontal: 16, marginBottom: 20 },
    // Bottom bar
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, backgroundColor: 'transparent' },
    bottomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 28 },
    bottomBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    // Category picker
    catPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10 },
    catPickerLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
    // Form – Header & Save
    formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 60 : 16, borderBottomWidth: 1 },
    formHeaderTitle: { fontSize: 18, fontWeight: '700' },
    saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    // Form – Photo
    photoArea: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, marginBottom: 16, borderStyle: 'dashed' },
    photoPreview: { width: '100%', height: 200, resizeMode: 'cover' },
    photoPlaceholder: { height: 140, justifyContent: 'center', alignItems: 'center', gap: 8 },
    photoIconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    photoHint: { fontSize: 14, fontWeight: '500' },
    photoChangeOverlay: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
    // Form – Sections
    formCard: { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
    formTitleInput: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 14 },
    formDivider: { height: 1, marginHorizontal: 16 },
    formTextArea: { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingVertical: 12, minHeight: 60 },
    formTextAreaLarge: { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingVertical: 14, minHeight: 120 },
    formSectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3, marginBottom: 8, marginTop: 4 },
    formCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
    formCardLabel: { fontSize: 15, flex: 1, fontWeight: '500' },
    formIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    formRowLabel: { fontSize: 15, flex: 1 },
    formRowInput: { fontSize: 15, flex: 1 },
    formSmallInput: { fontSize: 14, fontWeight: '600', textAlign: 'center', width: 56, paddingVertical: 6, borderRadius: 10 },
    diffChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
    tagToggle: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
    // Form – Category grid
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
    catToggleLabel: { fontSize: 12, fontWeight: '600' },
    // Form – Movie hint
    movieHint: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
    movieHintTitle: { fontSize: 14, fontWeight: '800' },
    movieHintDesc: { fontSize: 12, lineHeight: 16, marginTop: 2 },
    // Web create
    webIconLarge: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    webTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    webHint: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    webInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', borderWidth: 1, paddingHorizontal: 16, borderRadius: 16, marginBottom: 20 },
    webUrlInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
    webSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 28, width: '100%' },
    webSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    // Detail Hero Actions
    detailActionsHero: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
    actionBtnMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    actionBtnTextMain: { fontSize: 15, fontWeight: '800' },
    // Cooking mode
    cookingContainer: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 20 },
    cookingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
    cookingTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginHorizontal: 12 },
    cookingProgress: { fontSize: 14, fontWeight: '800' },
    progressBar: { height: 4, marginHorizontal: 20, borderRadius: 2 },
    progressFill: { height: 4, borderRadius: 2 },
    cookingContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    cookingStepBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, marginBottom: 20 },
    cookingStepNum: { fontSize: 14, fontWeight: '700' },
    cookingStepText: { fontSize: 24, fontWeight: '600', textAlign: 'center', lineHeight: 34 },
    cookingNav: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
    cookingNavBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, borderRadius: 28, borderWidth: 1 }
});

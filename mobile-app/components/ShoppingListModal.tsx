import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, SectionList, Keyboard } from 'react-native';
import { X, Check, ShoppingCart, Plus, Trash2, Settings, Tag, ChevronDown, ChevronRight } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';
import ShoppingCategoriesManager, { type ShoppingCategory } from './ShoppingCategoriesManager';

interface ShoppingListModalProps {
    visible: boolean;
    onClose: () => void;
}

interface CatalogProduct {
    id: string;
    product_name: string;
    display_name: string;
    category_id: string | null;
    use_count: number;
}

// ── Main Component ──────────────────────────────────────────────
export default function ShoppingListModal({ visible, onClose }: ShoppingListModalProps) {
    const { fetchTodoItems, updateTodoItem, addTodoItem, callService } = useHomeAssistant();
    const { colors } = useTheme();
    const { householdId } = useHousehold();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newItemText, setNewItemText] = useState('');
    const ENTITY_ID = 'todo.google_keep_einkaufsliste';

    // Categories & Catalog
    const [categories, setCategories] = useState<ShoppingCategory[]>([]);
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [showCategoriesManager, setShowCategoriesManager] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    // Auto-suggest
    const [suggestions, setSuggestions] = useState<CatalogProduct[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Category assignment for new items
    const [assignCategory, setAssignCategory] = useState<string | null>(null);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [pendingItem, setPendingItem] = useState<string | null>(null);

    const inputRef = useRef<TextInput>(null);

    // ── Load Items from HA ──
    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchTodoItems(ENTITY_ID);
            const sorted = data.sort((a: any, b: any) => {
                if (a.status === 'needs_action' && b.status === 'completed') return -1;
                if (a.status === 'completed' && b.status === 'needs_action') return 1;
                return 0;
            });
            setItems(sorted);
        } catch (e) {
            console.error('ShoppingList error:', e);
        } finally {
            setLoading(false);
        }
    }, [fetchTodoItems]);

    // ── Load Categories from Supabase ──
    const loadCategories = useCallback(async () => {
        if (!householdId) return;
        try {
            const { data } = await supabase
                .from('shopping_categories')
                .select('*')
                .eq('household_id', householdId)
                .order('sort_order', { ascending: true });
            setCategories(data || []);
        } catch (e) {
            console.warn('Failed to load categories:', e);
        }
    }, [householdId]);

    // ── Load Product Catalog from Supabase ──
    const loadCatalog = useCallback(async () => {
        if (!householdId) return;
        try {
            const { data } = await supabase
                .from('shopping_product_catalog')
                .select('*')
                .eq('household_id', householdId)
                .order('use_count', { ascending: false })
                .limit(500);
            setCatalog(data || []);
        } catch (e) {
            console.warn('Failed to load catalog:', e);
        }
    }, [householdId]);

    // Only load when modal first opens (visible goes from false → true)
    const prevVisible = useRef(false);
    useEffect(() => {
        if (visible && !prevVisible.current) {
            loadItems();
            loadCategories();
            loadCatalog();
        }
        prevVisible.current = visible;
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Auto-Suggest Logic ──
    useEffect(() => {
        if (newItemText.trim().length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const query = newItemText.trim().toLowerCase();
        const matches = catalog
            .filter(p => p.product_name.includes(query) || p.display_name.toLowerCase().includes(query))
            .slice(0, 6);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    }, [newItemText, catalog]);

    // ── Upsert Product to Catalog ──
    const upsertCatalogProduct = useCallback(async (displayName: string, categoryId: string | null) => {
        if (!householdId) return;
        const normalized = displayName.trim().toLowerCase();
        try {
            const { data: existing } = await supabase
                .from('shopping_product_catalog')
                .select('id, use_count')
                .eq('household_id', householdId)
                .eq('product_name', normalized)
                .single();

            if (existing) {
                await supabase
                    .from('shopping_product_catalog')
                    .update({
                        use_count: existing.use_count + 1,
                        last_used: new Date().toISOString(),
                        ...(categoryId ? { category_id: categoryId } : {}),
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('shopping_product_catalog')
                    .insert({
                        household_id: householdId,
                        product_name: normalized,
                        display_name: displayName.trim(),
                        category_id: categoryId,
                        use_count: 1,
                    });
            }
            // Refresh catalog
            loadCatalog();
        } catch (e) {
            console.warn('Failed to upsert catalog product:', e);
        }
    }, [householdId, loadCatalog]);

    // ── Toggle Item ──
    const handleToggleItem = async (item: any) => {
        const newStatus = item.status === 'needs_action' ? 'completed' : 'needs_action';
        // Optimistic update — only toggle the FIRST match to avoid duplicates
        setItems(prev => {
            let toggled = false;
            return prev.map(i => {
                if (!toggled && i.summary === item.summary && i.status === item.status) {
                    toggled = true;
                    return { ...i, status: newStatus };
                }
                return i;
            });
        });
        await updateTodoItem(ENTITY_ID, item.summary, newStatus);
    };

    // ── Delete Item ──
    const handleDeleteItem = async (item: any) => {
        // Optimistic remove
        setItems(prev => {
            let removed = false;
            return prev.filter(i => {
                if (!removed && i.summary === item.summary) {
                    removed = true;
                    return false;
                }
                return true;
            });
        });
        // Call HA service to remove the item
        try {
            callService('todo', 'remove_item', ENTITY_ID, { item: item.summary });
        } catch (e) {
            console.warn('Failed to delete item:', e);
            loadItems(); // Reload if failed
        }
    };

    // ── Add Item ──
    const handleAddItem = async (text?: string, catId?: string | null) => {
        const itemText = (text || newItemText).trim();
        if (!itemText) return;

        setNewItemText('');
        setShowSuggestions(false);
        setAssignCategory(null);

        // Check if product is known in catalog
        const known = catalog.find(p => p.product_name === itemText.toLowerCase());
        const effectiveCatId = catId !== undefined ? catId : (known?.category_id || null);

        // Show category picker IMMEDIATELY for unknown products (don't wait for HA)
        if (!known && categories.length > 0 && catId === undefined) {
            setPendingItem(itemText);
            setShowCategoryPicker(true);
        }

        // Optimistic add so item appears instantly
        setItems(prev => [{ summary: itemText, status: 'needs_action' }, ...prev]);

        // Add to HA in background (don't await — avoids 3s blocking)
        addTodoItem(ENTITY_ID, itemText).catch(e => console.warn('Failed to add item:', e));

        // Upsert to catalog
        upsertCatalogProduct(itemText, effectiveCatId);
    };

    // ── Handle Suggestion Selection ──
    const handleSelectSuggestion = (product: CatalogProduct) => {
        setNewItemText('');
        setShowSuggestions(false);
        handleAddItem(product.display_name, product.category_id);
    };

    // ── Assign Category to Pending Item ──
    const assignCategoryToItem = async (catId: string | null) => {
        if (pendingItem) {
            await upsertCatalogProduct(pendingItem, catId);
        }
        setPendingItem(null);
        setShowCategoryPicker(false);
    };

    // ── Build Sections ──
    const activeItems = useMemo(() => items.filter(i => i.status === 'needs_action'), [items]);
    const completedItems = useMemo(() => items.filter(i => i.status === 'completed'), [items]);

    // Map product_name -> category_id from catalog
    const productCategoryMap = useMemo(() => {
        const map: Record<string, string> = {};
        catalog.forEach(p => {
            if (p.category_id) map[p.product_name] = p.category_id;
        });
        return map;
    }, [catalog]);

    // Group active items by category
    const groupedSections = useMemo(() => {
        if (categories.length === 0) {
            // No categories → single flat list
            return [{ key: 'all', title: 'Einkaufsliste', color: null, data: activeItems }];
        }

        const catMap: Record<string, any[]> = {};
        const uncategorized: any[] = [];

        activeItems.forEach(item => {
            const normalized = item.summary?.toLowerCase();
            const catId = productCategoryMap[normalized];
            if (catId) {
                if (!catMap[catId]) catMap[catId] = [];
                catMap[catId].push(item);
            } else {
                uncategorized.push(item);
            }
        });

        const sections: { key: string; title: string; color: string | null; icon: string | null; data: any[] }[] = [];

        categories.forEach(cat => {
            const items = catMap[cat.id] || [];
            if (items.length > 0) {
                sections.push({ key: cat.id, title: cat.name, color: cat.color, icon: cat.icon, data: items });
            }
        });

        if (uncategorized.length > 0) {
            sections.push({ key: 'uncategorized', title: 'Sonstiges', color: '#6B7280', icon: '📦', data: uncategorized });
        }

        return sections;
    }, [activeItems, categories, productCategoryMap]);

    const toggleSection = (key: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // ── Icon helper (old DB entries may have 'tag' instead of emoji) ──
    const resolveIcon = (icon: string | null | undefined) => {
        if (!icon || icon === 'tag') return '📦';
        return icon;
    };

    // ── Category name lookup ──
    const getCategoryName = (catId: string | null) => {
        if (!catId) return null;
        return categories.find(c => c.id === catId)?.name || null;
    };
    const getCategoryColor = (catId: string | null) => {
        if (!catId) return '#6B7280';
        return categories.find(c => c.id === catId)?.color || '#6B7280';
    };

    return (
        <>
            <Modal visible={visible} animationType="slide" transparent>
                <View style={styles.overlay}>
                    <View style={[styles.content, { backgroundColor: colors.card }]}>
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <View style={styles.titleRow}>
                                <ShoppingCart size={24} color={colors.accent} />
                                <Text style={[styles.title, { color: colors.text }]}>Einkaufsliste</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Pressable
                                    onPress={() => {
                                        console.log('⚙️ Settings pressed, householdId:', householdId);
                                        if (!householdId) {
                                            const { Alert: RNAlert } = require('react-native');
                                            RNAlert.alert('Hinweis', 'Bitte zuerst einem Haushalt beitreten.');
                                            return;
                                        }
                                        setShowCategoriesManager(true);
                                    }}
                                    style={{
                                        width: 40, height: 40, borderRadius: 20,
                                        backgroundColor: colors.border,
                                        alignItems: 'center', justifyContent: 'center',
                                        zIndex: 999,
                                    }}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                >
                                    <Settings size={20} color={colors.subtext} />
                                </Pressable>
                                <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                                    <X size={24} color={colors.subtext} />
                                </Pressable>
                            </View>
                        </View>

                        {/* Input + Auto-Suggest */}
                        <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                            <View style={{ flex: 1, position: 'relative' }}>
                                <TextInput
                                    ref={inputRef}
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                                    placeholder="Neuer Artikel..."
                                    placeholderTextColor={colors.subtext}
                                    value={newItemText}
                                    onChangeText={setNewItemText}
                                    onSubmitEditing={() => handleAddItem()}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                />
                                {/* Suggestions Dropdown */}
                                {showSuggestions && (
                                    <View style={[styles.suggestionsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        {suggestions.map(s => {
                                            const catName = getCategoryName(s.category_id);
                                            const catColor = getCategoryColor(s.category_id);
                                            return (
                                                <Pressable
                                                    key={s.id}
                                                    style={[styles.suggestionItem, { borderBottomColor: colors.border + '30' }]}
                                                    onPress={() => handleSelectSuggestion(s)}
                                                >
                                                    <Text style={[styles.suggestionText, { color: colors.text }]}>{s.display_name}</Text>
                                                    {catName && (
                                                        <View style={[styles.catBadge, { backgroundColor: catColor + '20' }]}>
                                                            <View style={[styles.catBadgeDot, { backgroundColor: catColor }]} />
                                                            <Text style={[styles.catBadgeText, { color: catColor }]}>{catName}</Text>
                                                        </View>
                                                    )}
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                            <Pressable onPress={() => handleAddItem()} style={[styles.addBtn, { backgroundColor: colors.accent }]}>
                                <Plus size={24} color="#fff" />
                            </Pressable>
                        </View>

                        {/* Category Picker Inline (for new unknown items) */}
                        {showCategoryPicker && pendingItem && (
                            <View style={[styles.categoryPickerRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                                <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                                    Kategorie für "{pendingItem}":
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                    {categories.map(cat => (
                                        <Pressable key={cat.id} onPress={() => assignCategoryToItem(cat.id)}
                                            style={[styles.catChip, { backgroundColor: cat.color + '20', borderColor: cat.color }]}>
                                            <View style={[styles.catChipDot, { backgroundColor: cat.color }]} />
                                            <Text style={[styles.catChipText, { color: cat.color }]}>{cat.name}</Text>
                                        </Pressable>
                                    ))}
                                    <Pressable onPress={() => assignCategoryToItem(null)}
                                        style={[styles.catChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        <Text style={[styles.catChipText, { color: colors.subtext }]}>Überspringen</Text>
                                    </Pressable>
                                </ScrollView>
                            </View>
                        )}

                        {loading && items.length === 0 ? (
                            <View style={styles.center}>
                                <ActivityIndicator size="large" color={colors.accent} />
                            </View>
                        ) : (
                            <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                                {activeItems.length === 0 && completedItems.length === 0 && (
                                    <View style={styles.empty}>
                                        <Text style={[styles.emptyText, { color: colors.subtext }]}>Liste ist leer</Text>
                                    </View>
                                )}

                                {/* Grouped Active Items */}
                                {groupedSections.map(section => {
                                    const isCollapsed = collapsedSections.has(section.key);
                                    const hasCategoryHeader = categories.length > 0 && section.color !== null;
                                    return (
                                        <View key={section.key}>
                                            {hasCategoryHeader && (
                                                <Pressable
                                                    onPress={() => toggleSection(section.key)}
                                                    style={[styles.sectionHeader]}
                                                >
                                                    <Text style={{ fontSize: 16, marginRight: 6 }}>{resolveIcon(section.icon)}</Text>
                                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                                                    <Text style={[styles.sectionCount, { color: colors.subtext }]}>{section.data.length}</Text>
                                                    {isCollapsed
                                                        ? <ChevronRight size={16} color={colors.subtext} />
                                                        : <ChevronDown size={16} color={colors.subtext} />
                                                    }
                                                </Pressable>
                                            )}
                                            {!isCollapsed && section.data.map((item, idx) => (
                                                <Pressable
                                                    key={idx + item.summary}
                                                    style={[styles.itemRow, { borderBottomColor: colors.border + '30' }]}
                                                    onPress={() => handleToggleItem(item)}
                                                    onLongPress={() => {
                                                        if (categories.length > 0) {
                                                            setPendingItem(item.summary);
                                                            setShowCategoryPicker(true);
                                                        }
                                                    }}
                                                >
                                                    <View style={[styles.checkbox, { borderColor: section.color || colors.subtext }]} />
                                                    <Text style={[styles.itemText, { color: colors.text }]}>{item.summary}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    );
                                })}

                                {/* Completed Items */}
                                {completedItems.length > 0 && (
                                    <>
                                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                        <Pressable
                                            onPress={() => toggleSection('_completed')}
                                            style={styles.sectionHeader}
                                        >
                                            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Erledigt</Text>
                                            <Text style={[styles.sectionCount, { color: colors.subtext }]}>{completedItems.length}</Text>
                                            {collapsedSections.has('_completed')
                                                ? <ChevronRight size={16} color={colors.subtext} />
                                                : <ChevronDown size={16} color={colors.subtext} />
                                            }
                                        </Pressable>
                                        {!collapsedSections.has('_completed') && completedItems.map((item, idx) => (
                                            <Pressable key={idx + item.summary} style={[styles.itemRow, { borderBottomColor: colors.border + '30' }]} onPress={() => handleToggleItem(item)}>
                                                <View style={[styles.checkbox, styles.checkboxChecked, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                                    <Check size={14} color="#fff" />
                                                </View>
                                                <Text style={[styles.itemText, styles.itemTextDone, { color: colors.subtext }]}>{item.summary}</Text>
                                                <Pressable onPress={() => handleDeleteItem(item)} hitSlop={8} style={{ padding: 6 }}>
                                                    <Trash2 size={16} color={colors.error || '#EF4444'} />
                                                </Pressable>
                                            </Pressable>
                                        ))}
                                    </>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>

                {/* Categories Manager Modal — must be INSIDE the parent modal to stack on iOS */}
                {householdId && (
                    <ShoppingCategoriesManager
                        visible={showCategoriesManager}
                        onClose={() => setShowCategoriesManager(false)}
                        householdId={householdId}
                        categories={categories}
                        onCategoriesChanged={loadCategories}
                    />
                )}
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
    content: { borderRadius: 24, maxHeight: '85%', width: '100%', display: 'flex', flexDirection: 'column' },
    header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 6, borderRadius: 20 },

    inputRow: { flexDirection: 'row', padding: 16, gap: 10, borderBottomWidth: 1 },
    input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
    addBtn: { borderRadius: 12, width: 48, alignItems: 'center', justifyContent: 'center' },

    // Auto-Suggest
    suggestionsContainer: {
        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
        borderRadius: 12, borderWidth: 1, marginTop: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    },
    suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
    suggestionText: { fontSize: 15, flex: 1 },
    catBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
    catBadgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
    catBadgeText: { fontSize: 11, fontWeight: '600' },

    // Category Picker
    categoryPickerRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
    catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    catChipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
    catChipText: { fontSize: 12, fontWeight: '600' },

    // Section Header
    sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 6 },
    sectionDot: { width: 10, height: 10, borderRadius: 5 },
    sectionTitle: { fontSize: 14, fontWeight: '700', flex: 1, textTransform: 'uppercase' },
    sectionCount: { fontSize: 12, fontWeight: '600', marginRight: 4 },

    body: { width: '100%', minHeight: 100 },
    scrollContent: { padding: 16 },
    center: { flex: 1, padding: 40, alignItems: 'center' },

    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: {},
    itemText: { fontSize: 16, flex: 1 },
    itemTextDone: { textDecorationLine: 'line-through' },

    divider: { height: 1, marginVertical: 16 },

    empty: { padding: 40, alignItems: 'center' },
    emptyText: {},
});

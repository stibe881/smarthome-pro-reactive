import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Modal, Platform, Alert,
} from 'react-native';
import {
    X, Plus, Trash2, ChevronLeft, Luggage, CheckCircle2, Circle, Copy,
    Edit3, RotateCcw, ChevronDown, ChevronUp, Check, Settings, User,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

// Platform-aware alert helpers
const platformAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);
};
const platformConfirmDestructive = (title: string, msg: string, actionLabel: string, onOk: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(`${title}\n${msg}`)) onOk(); }
    else { Alert.alert(title, msg, [{ text: 'Abbrechen', style: 'cancel' }, { text: actionLabel, style: 'destructive', onPress: onOk }]); }
};

interface PackingList {
    id: string;
    household_id: string;
    title: string;
    emoji: string;
    items: string[];
    checked_items: boolean[];
    categories?: string[];
    assigned_to?: string[];
    created_at: string;
}

interface CustomTemplate {
    id: string;
    household_id: string;
    title: string;
    emoji: string;
    items: { name: string; cat: string }[];
}

type TemplateBlock = { key: string; title: string; emoji: string; items: { name: string; cat: string }[]; custom?: boolean };

// ---------- MODULAR TEMPLATE BLOCKS ----------
// Each block is a self-contained "module" that can be combined with others
const DEFAULT_BLOCKS: TemplateBlock[] = [
    {
        key: 'basics', title: 'Reise-Basics', emoji: '🧳',
        items: [
            { name: 'Reisepass / Ausweis', cat: 'docs' },
            { name: 'Portemonnaie & Karten', cat: 'docs' },
            { name: 'Ladekabel & Netzstecker', cat: 'tech' },
            { name: 'Kopfhörer', cat: 'tech' },
            { name: 'Medikamente', cat: 'health' },
            { name: 'Zahnbürste & Zahnpasta', cat: 'hygiene' },
            { name: 'Shampoo & Duschgel', cat: 'hygiene' },
            { name: 'Deodorant', cat: 'hygiene' },
        ],
    },
    {
        key: 'clothes_summer', title: 'Sommerkleidung', emoji: '☀️',
        items: [
            { name: 'T-Shirts', cat: 'clothes' },
            { name: 'Shorts / Röcke', cat: 'clothes' },
            { name: 'Leichtes Kleid', cat: 'clothes' },
            { name: 'Sandalen / Flip-Flops', cat: 'clothes' },
            { name: 'Sonnenhut', cat: 'clothes' },
            { name: 'Leichte Jacke', cat: 'clothes' },
        ],
    },
    {
        key: 'clothes_winter', title: 'Winterkleidung', emoji: '🧥',
        items: [
            { name: 'Warme Jacke', cat: 'clothes' },
            { name: 'Pullover / Fleece', cat: 'clothes' },
            { name: 'Lange Hosen', cat: 'clothes' },
            { name: 'Mütze', cat: 'clothes' },
            { name: 'Schal', cat: 'clothes' },
            { name: 'Handschuhe', cat: 'clothes' },
            { name: 'Warme Socken', cat: 'clothes' },
            { name: 'Winterschuhe', cat: 'clothes' },
        ],
    },
    {
        key: 'beach', title: 'Strand & Pool', emoji: '🏖️',
        items: [
            { name: 'Badehose / Bikini', cat: 'clothes' },
            { name: 'Strandtuch', cat: 'general' },
            { name: 'Sonnencreme (LSF 50)', cat: 'hygiene' },
            { name: 'Sonnenbrille', cat: 'general' },
            { name: 'Wasserflasche', cat: 'food' },
            { name: 'Schnorchel-Set', cat: 'general' },
            { name: 'Strandspielzeug', cat: 'kids' },
            { name: 'After-Sun-Lotion', cat: 'hygiene' },
        ],
    },
    {
        key: 'ski', title: 'Ski & Snowboard', emoji: '⛷️',
        items: [
            { name: 'Skipass', cat: 'docs' },
            { name: 'Ski / Snowboard (+ Schuhe)', cat: 'general' },
            { name: 'Skibrille', cat: 'general' },
            { name: 'Helm', cat: 'general' },
            { name: 'Thermounterwäsche', cat: 'clothes' },
            { name: 'Skihandschuhe', cat: 'clothes' },
            { name: 'Nackenwärmer', cat: 'clothes' },
            { name: 'Sonnencreme (Berge)', cat: 'hygiene' },
        ],
    },
    {
        key: 'hiking', title: 'Wandern', emoji: '🥾',
        items: [
            { name: 'Wanderschuhe', cat: 'clothes' },
            { name: 'Rucksack', cat: 'general' },
            { name: 'Regenjacke', cat: 'clothes' },
            { name: 'Wanderstöcke', cat: 'general' },
            { name: 'Erste-Hilfe-Set', cat: 'health' },
            { name: 'Trinkblase / Flasche', cat: 'food' },
            { name: 'Energieriegel / Snacks', cat: 'food' },
            { name: 'Karte / Offline-Karten', cat: 'docs' },
        ],
    },
    {
        key: 'camping', title: 'Camping', emoji: '⛺',
        items: [
            { name: 'Zelt', cat: 'general' },
            { name: 'Schlafsack', cat: 'general' },
            { name: 'Isomatte', cat: 'general' },
            { name: 'Taschenlampe / Stirnlampe', cat: 'tech' },
            { name: 'Campingkocher', cat: 'general' },
            { name: 'Geschirr & Besteck', cat: 'general' },
            { name: 'Feuerzeug / Streichhölzer', cat: 'general' },
            { name: 'Müllsäcke', cat: 'general' },
            { name: 'Taschenmesser', cat: 'general' },
            { name: 'Mückenspray', cat: 'health' },
        ],
    },
    {
        key: 'baby', title: 'Mit Baby / Kleinkind', emoji: '🍼',
        items: [
            { name: 'Windeln (genug!)', cat: 'kids' },
            { name: 'Feuchttücher', cat: 'kids' },
            { name: 'Schnuller', cat: 'kids' },
            { name: 'Fläschchen & Nahrung', cat: 'kids' },
            { name: 'Wickelunterlage', cat: 'kids' },
            { name: 'Wechselkleidung Kind', cat: 'kids' },
            { name: 'Spielzeug & Kuscheltier', cat: 'kids' },
            { name: 'Baby-Sonnencreme', cat: 'kids' },
            { name: 'Kinderwagen / Trage', cat: 'kids' },
            { name: 'Reisebett', cat: 'kids' },
        ],
    },
    {
        key: 'tech', title: 'Technik & Gadgets', emoji: '🔌',
        items: [
            { name: 'Powerbank', cat: 'tech' },
            { name: 'Reiseadapter', cat: 'tech' },
            { name: 'Kamera', cat: 'tech' },
            { name: 'E-Reader / Tablet', cat: 'tech' },
            { name: 'Laptop (falls nötig)', cat: 'tech' },
            { name: 'USB-Kabel', cat: 'tech' },
        ],
    },
    {
        key: 'business', title: 'Business', emoji: '👔',
        items: [
            { name: 'Anzug / Business-Outfit', cat: 'clothes' },
            { name: 'Hemden / Blusen', cat: 'clothes' },
            { name: 'Formale Schuhe', cat: 'clothes' },
            { name: 'Laptop & Ladegerät', cat: 'tech' },
            { name: 'Notizbuch & Stift', cat: 'docs' },
            { name: 'Visitenkarten', cat: 'docs' },
            { name: 'Präsentation (USB-Stick)', cat: 'tech' },
        ],
    },
    {
        key: 'festival', title: 'Festival / Konzert', emoji: '🎶',
        items: [
            { name: 'Festivalticket', cat: 'docs' },
            { name: 'Ohrenstöpsel', cat: 'health' },
            { name: 'Regenponcho', cat: 'clothes' },
            { name: 'Gummistiefel', cat: 'clothes' },
            { name: 'Camping-Stuhl', cat: 'general' },
            { name: 'Bargeld', cat: 'docs' },
            { name: 'Taschenlampe', cat: 'tech' },
            { name: 'Müsliriegel & Wasser', cat: 'food' },
        ],
    },
    {
        key: 'toiletry', title: 'Pflege & Hygiene', emoji: '🧴',
        items: [
            { name: 'Kontaktlinsen & Lösung', cat: 'hygiene' },
            { name: 'Rasierer', cat: 'hygiene' },
            { name: 'Haarbürste', cat: 'hygiene' },
            { name: 'Bodylotion', cat: 'hygiene' },
            { name: 'Lippenpflege', cat: 'hygiene' },
            { name: 'Nagel-Set', cat: 'hygiene' },
            { name: 'Make-up', cat: 'hygiene' },
        ],
    },
    {
        key: 'food', title: 'Verpflegung unterwegs', emoji: '🍎',
        items: [
            { name: 'Snacks / Nüsse', cat: 'food' },
            { name: 'Wasserflaschen', cat: 'food' },
            { name: 'Brot / Sandwiches', cat: 'food' },
            { name: 'Obst', cat: 'food' },
            { name: 'Thermosflasche', cat: 'food' },
            { name: 'Kühlbox (falls Auto)', cat: 'food' },
        ],
    },
];

const CATEGORY_OPTIONS = [
    { key: 'general', label: 'Allgemein', emoji: '📦' },
    { key: 'clothes', label: 'Kleidung', emoji: '👕' },
    { key: 'tech', label: 'Technik', emoji: '🔌' },
    { key: 'hygiene', label: 'Hygiene', emoji: '🧴' },
    { key: 'food', label: 'Essen & Trinken', emoji: '🍎' },
    { key: 'docs', label: 'Dokumente', emoji: '📄' },
    { key: 'kids', label: 'Kinder', emoji: '👶' },
    { key: 'health', label: 'Gesundheit', emoji: '💊' },
];

interface PackingListsProps { visible: boolean; onClose: () => void; }

export const FamilyPackingLists: React.FC<PackingListsProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { householdId } = useHousehold();

    const [lists, setLists] = useState<PackingList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeList, setActiveList] = useState<PackingList | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [createStep, setCreateStep] = useState<'info' | 'blocks'>('info');
    const [formTitle, setFormTitle] = useState('');
    const [formEmoji, setFormEmoji] = useState('🧳');
    const [selectedBlocks, setSelectedBlocks] = useState<Map<string, string>>(new Map());
    const [newItem, setNewItem] = useState('');
    const [newItemCategory, setNewItemCategory] = useState('general');
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    // Per-person
    const [familyMembers, setFamilyMembers] = useState<string[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<string>('Alle');
    const [blockPerson, setBlockPerson] = useState<string>('Alle');
    const [filterPerson, setFilterPerson] = useState<string | null>(null);
    // Custom templates
    const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
    const [showTemplateEditor, setShowTemplateEditor] = useState(false);
    const [editTemplate, setEditTemplate] = useState<CustomTemplate | null>(null);
    const [tplTitle, setTplTitle] = useState('');
    const [tplEmoji, setTplEmoji] = useState('📦');
    const [tplItems, setTplItems] = useState<{ name: string; cat: string }[]>([]);
    const [tplNewItem, setTplNewItem] = useState('');

    const EMOJI_OPTIONS = ['🧳', '🏖️', '🎿', '⛺', '🏕️', '✈️', '🚗', '🎒', '🏔️', '🚢', '👔', '🍼', '🎪', '🥾'];

    const loadLists = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('packing_lists').select('*').eq('household_id', householdId).order('created_at', { ascending: false });
            if (error) throw error;
            setLists(data || []);
            // Load family members
            const { data: fam } = await supabase.from('family_members').select('display_name, email').eq('household_id', householdId).eq('is_active', true);
            setFamilyMembers((fam || []).map(m => m.display_name || m.email?.split('@')[0] || ''));
            // Load custom templates
            const { data: tpls } = await supabase.from('packing_templates').select('*').eq('household_id', householdId).order('title');
            setCustomTemplates(tpls || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [householdId]);

    useEffect(() => { if (visible) loadLists(); }, [visible, loadLists]);

    // Combine default + custom templates
    const allBlocks: TemplateBlock[] = [
        ...DEFAULT_BLOCKS,
        ...customTemplates.map(ct => ({ key: `custom_${ct.id}`, title: ct.title, emoji: ct.emoji, items: ct.items, custom: true })),
    ];

    // Custom template CRUD
    const saveTemplate = async () => {
        if (!householdId || !tplTitle.trim()) return;
        if (editTemplate) {
            await supabase.from('packing_templates').update({ title: tplTitle.trim(), emoji: tplEmoji, items: tplItems }).eq('id', editTemplate.id);
        } else {
            await supabase.from('packing_templates').insert({ household_id: householdId, title: tplTitle.trim(), emoji: tplEmoji, items: tplItems });
        }
        setShowTemplateEditor(false); setEditTemplate(null); setTplTitle(''); setTplEmoji('📦'); setTplItems([]); setTplNewItem('');
        loadLists();
    };
    const deleteTemplate = (id: string) => {
        platformConfirmDestructive('Vorlage löschen', 'Diese Vorlage wird gelöscht.', 'Löschen', async () => {
            await supabase.from('packing_templates').delete().eq('id', id);
            loadLists();
        });
    };

    // Merge selected template blocks into deduplicated items with per-block person
    const getMergedItems = () => {
        const seen = new Set<string>();
        const items: { name: string; cat: string; person: string }[] = [];
        for (const block of allBlocks) {
            if (!selectedBlocks.has(block.key)) continue;
            const person = selectedBlocks.get(block.key) || '';
            for (const item of block.items) {
                if (!seen.has(item.name)) {
                    seen.add(item.name);
                    items.push({ ...item, person });
                }
            }
        }
        return items;
    };

    const handleCreate = async () => {
        if (!householdId || !formTitle.trim()) return;
        const merged = getMergedItems();
        await supabase.from('packing_lists').insert({
            household_id: householdId,
            title: formTitle.trim(),
            emoji: formEmoji,
            items: merged.map(i => i.name),
            checked_items: new Array(merged.length).fill(false),
            categories: merged.map(i => i.cat),
            assigned_to: merged.map(i => i.person),
        });
        resetCreateForm();
        loadLists();
    };

    const resetCreateForm = () => {
        setShowCreate(false);
        setCreateStep('info');
        setFormTitle('');
        setFormEmoji('🧳');
        setSelectedBlocks(new Map());
        setBlockPerson('Alle');
    };

    const toggleBlock = (key: string) => {
        setSelectedBlocks(prev => {
            const next = new Map(prev);
            if (next.has(key)) { next.delete(key); } else { next.set(key, blockPerson === 'Alle' ? '' : blockPerson); }
            return next;
        });
    };

    // Cycle person for an already-selected block
    const cycleBlockPerson = (key: string) => {
        const options = ['', ...familyMembers];
        setSelectedBlocks(prev => {
            const next = new Map(prev);
            const current = next.get(key) || '';
            const idx = options.indexOf(current);
            next.set(key, options[(idx + 1) % options.length]);
            return next;
        });
    };

    const duplicateList = async (list: PackingList) => {
        if (!householdId) return;
        await supabase.from('packing_lists').insert({
            household_id: householdId,
            title: `${list.title} (Kopie)`,
            emoji: list.emoji,
            items: list.items,
            checked_items: new Array(list.items.length).fill(false),
            categories: list.categories || new Array(list.items.length).fill('general'),
            assigned_to: list.assigned_to || new Array(list.items.length).fill(''),
        });
        loadLists();
    };

    // Add template block items to an existing list
    const addBlockToList = async (blockKey: string, person?: string) => {
        if (!activeList) return;
        const block = allBlocks.find((b: TemplateBlock) => b.key === blockKey);
        if (!block) return;
        const existingSet = new Set(activeList.items);
        const newItems: { name: string; cat: string }[] = [];
        for (const item of block.items) {
            if (!existingSet.has(item.name)) newItems.push(item);
        }
        if (newItems.length === 0) { platformAlert('Bereits vorhanden', 'Alle Artikel dieses Blocks sind schon in der Liste.'); return; }
        const p = person && person !== 'Alle' ? person : '';
        const updatedItems = [...activeList.items, ...newItems.map(i => i.name)];
        const updatedChecked = [...activeList.checked_items, ...new Array(newItems.length).fill(false)];
        const updatedCats = [...(activeList.categories || new Array(activeList.items.length).fill('general')), ...newItems.map(i => i.cat)];
        const updatedAssigned = [...(activeList.assigned_to || new Array(activeList.items.length).fill('')), ...new Array(newItems.length).fill(p)];
        await supabase.from('packing_lists').update({ items: updatedItems, checked_items: updatedChecked, categories: updatedCats, assigned_to: updatedAssigned }).eq('id', activeList.id);
        setActiveList({ ...activeList, items: updatedItems, checked_items: updatedChecked, categories: updatedCats, assigned_to: updatedAssigned });
    };

    const updateTitle = async () => {
        if (!activeList || !editTitle.trim()) return;
        await supabase.from('packing_lists').update({ title: editTitle.trim() }).eq('id', activeList.id);
        setActiveList({ ...activeList, title: editTitle.trim() });
        setEditingTitle(false);
    };

    const addItem = async () => {
        if (!activeList || !newItem.trim()) return;
        const updatedItems = [...activeList.items, newItem.trim()];
        const updatedChecked = [...activeList.checked_items, false];
        const updatedCats = [...(activeList.categories || new Array(activeList.items.length).fill('general')), newItemCategory];
        const p = selectedPerson === 'Alle' ? '' : selectedPerson;
        const updatedAssigned = [...(activeList.assigned_to || new Array(activeList.items.length).fill('')), p];
        await supabase.from('packing_lists').update({ items: updatedItems, checked_items: updatedChecked, categories: updatedCats, assigned_to: updatedAssigned }).eq('id', activeList.id);
        setActiveList({ ...activeList, items: updatedItems, checked_items: updatedChecked, categories: updatedCats, assigned_to: updatedAssigned });
        setNewItem('');
    };

    const toggleItem = async (idx: number) => {
        if (!activeList) return;
        const updatedChecked = [...activeList.checked_items];
        updatedChecked[idx] = !updatedChecked[idx];
        await supabase.from('packing_lists').update({ checked_items: updatedChecked }).eq('id', activeList.id);
        setActiveList({ ...activeList, checked_items: updatedChecked });
    };

    const removeItem = async (idx: number) => {
        if (!activeList) return;
        const updatedItems = activeList.items.filter((_, i) => i !== idx);
        const updatedChecked = activeList.checked_items.filter((_, i) => i !== idx);
        const updatedCats = (activeList.categories || []).filter((_, i) => i !== idx);
        const updatedAssigned = (activeList.assigned_to || []).filter((_, i) => i !== idx);
        await supabase.from('packing_lists').update({ items: updatedItems, checked_items: updatedChecked, categories: updatedCats, assigned_to: updatedAssigned }).eq('id', activeList.id);
        setActiveList({ ...activeList, items: updatedItems, checked_items: updatedChecked, categories: updatedCats, assigned_to: updatedAssigned });
    };

    const moveItem = async (idx: number, direction: 'up' | 'down') => {
        if (!activeList) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= activeList.items.length) return;
        const items = [...activeList.items];
        const checked = [...activeList.checked_items];
        const cats = [...(activeList.categories || new Array(activeList.items.length).fill('general'))];
        const assigned = [...(activeList.assigned_to || new Array(activeList.items.length).fill(''))];
        [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
        [checked[idx], checked[newIdx]] = [checked[newIdx], checked[idx]];
        [cats[idx], cats[newIdx]] = [cats[newIdx], cats[idx]];
        [assigned[idx], assigned[newIdx]] = [assigned[newIdx], assigned[idx]];
        await supabase.from('packing_lists').update({ items, checked_items: checked, categories: cats, assigned_to: assigned }).eq('id', activeList.id);
        setActiveList({ ...activeList, items, checked_items: checked, categories: cats, assigned_to: assigned });
    };

    const resetChecks = async () => {
        if (!activeList) return;
        const updatedChecked = new Array(activeList.items.length).fill(false);
        await supabase.from('packing_lists').update({ checked_items: updatedChecked }).eq('id', activeList.id);
        setActiveList({ ...activeList, checked_items: updatedChecked });
    };

    const deleteList = (list: PackingList) => {
        platformConfirmDestructive('Löschen', `"${list.title}" löschen?`, 'Löschen', async () => {
            await supabase.from('packing_lists').delete().eq('id', list.id);
            setActiveList(null);
            loadLists();
        });
    };

    const getProgress = (list: PackingList) => {
        if (list.items.length === 0) return 0;
        return list.checked_items.filter(Boolean).length / list.items.length;
    };

    const getCategoryEmoji = (key: string) => CATEGORY_OPTIONS.find(c => c.key === key)?.emoji || '📦';

    const getGroupedItems = () => {
        if (!activeList) return [];
        const cats = activeList.categories || new Array(activeList.items.length).fill('general');
        const assigned = activeList.assigned_to || new Array(activeList.items.length).fill('');
        const groups = new Map<string, number[]>();
        activeList.items.forEach((_, idx) => {
            const cat = cats[idx] || 'general';
            if (filterCategory && cat !== filterCategory) return;
            if (filterPerson && assigned[idx] && assigned[idx] !== filterPerson) return;
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat)!.push(idx);
        });
        return Array.from(groups.entries()).map(([key, indices]) => ({
            key, indices,
            label: CATEGORY_OPTIONS.find(c => c.key === key)?.label || 'Allgemein',
            emoji: getCategoryEmoji(key),
        }));
    };

    const getActiveCategories = () => {
        if (!activeList) return [];
        const cats = new Set(activeList.categories || []);
        return CATEGORY_OPTIONS.filter(c => cats.has(c.key));
    };

    // ------ State for "add block to existing list" bottom sheet ------
    const [showAddBlock, setShowAddBlock] = useState(false);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.titleRow}>
                        {activeList ? (
                            <Pressable onPress={() => { setActiveList(null); setFilterCategory(null); setShowAddBlock(false); loadLists(); }}>
                                <ChevronLeft size={24} color={colors.accent} />
                            </Pressable>
                        ) : (
                            <Luggage size={24} color={colors.accent} />
                        )}
                        {activeList && editingTitle ? (
                            <TextInput
                                style={[styles.headerTitle, { color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.accent, minWidth: 120 }]}
                                value={editTitle} onChangeText={setEditTitle} autoFocus
                                onSubmitEditing={updateTitle} onBlur={updateTitle} returnKeyType="done"
                            />
                        ) : (
                            <Pressable onPress={() => { if (activeList) { setEditTitle(activeList.title); setEditingTitle(true); } }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={[styles.headerTitle, { color: colors.text }]}>{activeList ? activeList.title : 'Packlisten'}</Text>
                                    {activeList && <Edit3 size={14} color={colors.subtext} />}
                                </View>
                            </Pressable>
                        )}
                    </View>
                    {activeList ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Pressable onPress={resetChecks}><RotateCcw size={18} color={colors.accent} /></Pressable>
                            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}><X size={20} color={colors.subtext} /></Pressable>
                        </View>
                    ) : (
                        <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    )}
                </View>

                {activeList ? (
                    /* ========== DETAIL VIEW ========== */
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
                        {/* Progress Bar */}
                        <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                <Text style={[styles.progressLabel, { color: colors.text }]}>
                                    {activeList.checked_items.filter(Boolean).length} / {activeList.items.length} eingepackt
                                </Text>
                                <Text style={[styles.progressPercent, { color: colors.accent }]}>
                                    {Math.round(getProgress(activeList) * 100)}%
                                </Text>
                            </View>
                            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                                <LinearGradient
                                    colors={getProgress(activeList) === 1 ? ['#10B981', '#059669'] : [colors.accent, colors.accent + 'CC']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={[styles.progressBarFill, { width: `${Math.max(getProgress(activeList) * 100, 2)}%` as any }]}
                                />
                            </View>
                            {getProgress(activeList) === 1 && (
                                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' }}>✅ Alles eingepackt! Gute Reise!</Text>
                            )}
                        </View>

                        {/* Category Filter Chips */}
                        {getActiveCategories().length > 1 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
                                <Pressable
                                    style={[styles.filterChip, { borderColor: !filterCategory ? colors.accent : colors.border, backgroundColor: !filterCategory ? colors.accent + '15' : 'transparent' }]}
                                    onPress={() => setFilterCategory(null)}
                                >
                                    <Text style={{ fontSize: 11, color: !filterCategory ? colors.accent : colors.subtext, fontWeight: '600' }}>Alle</Text>
                                </Pressable>
                                {getActiveCategories().map(cat => (
                                    <Pressable
                                        key={cat.key}
                                        style={[styles.filterChip, { borderColor: filterCategory === cat.key ? colors.accent : colors.border, backgroundColor: filterCategory === cat.key ? colors.accent + '15' : 'transparent' }]}
                                        onPress={() => setFilterCategory(filterCategory === cat.key ? null : cat.key)}
                                    >
                                        <Text style={{ fontSize: 11 }}>{cat.emoji} {cat.label}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}

                        {/* Person Filter Chips */}
                        {familyMembers.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
                                <Pressable
                                    style={[styles.filterChip, { borderColor: !filterPerson ? colors.accent : colors.border, backgroundColor: !filterPerson ? colors.accent + '15' : 'transparent' }]}
                                    onPress={() => setFilterPerson(null)}
                                >
                                    <Text style={{ fontSize: 11, color: !filterPerson ? colors.accent : colors.subtext, fontWeight: '600' }}>👥 Alle</Text>
                                </Pressable>
                                {familyMembers.map(p => (
                                    <Pressable key={p}
                                        style={[styles.filterChip, { borderColor: filterPerson === p ? colors.accent : colors.border, backgroundColor: filterPerson === p ? colors.accent + '15' : 'transparent' }]}
                                        onPress={() => setFilterPerson(filterPerson === p ? null : p)}
                                    >
                                        <Text style={{ fontSize: 11, color: filterPerson === p ? colors.accent : colors.subtext, fontWeight: '600' }}>👤 {p}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}

                        {/* Add Item Row */}
                        <View style={[styles.addItemRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                            <Pressable onPress={() => setShowCategoryPicker(!showCategoryPicker)} style={{ marginRight: 6 }}>
                                <Text style={{ fontSize: 18 }}>{getCategoryEmoji(newItemCategory)}</Text>
                            </Pressable>
                            <TextInput
                                style={[styles.addItemInput, { color: colors.text }]}
                                value={newItem} onChangeText={setNewItem}
                                placeholder="Artikel hinzufügen..." placeholderTextColor={colors.subtext}
                                onSubmitEditing={addItem} returnKeyType="done"
                            />
                            {familyMembers.length > 0 && (
                                <Pressable onPress={() => {
                                    const options = ['Alle', ...familyMembers];
                                    const currentIdx = options.indexOf(selectedPerson);
                                    const nextIdx = (currentIdx + 1) % options.length;
                                    setSelectedPerson(options[nextIdx]);
                                }} style={[styles.personBadge, { backgroundColor: selectedPerson === 'Alle' ? colors.border : colors.accent + '15', marginRight: 4 }]}>
                                    <Text style={{ fontSize: 9, color: selectedPerson === 'Alle' ? colors.subtext : colors.accent, fontWeight: '600' }}>{selectedPerson === 'Alle' ? '👥' : `👤${selectedPerson}`}</Text>
                                </Pressable>
                            )}
                            <Pressable onPress={addItem} style={[styles.addItemBtn, { backgroundColor: colors.accent, opacity: newItem.trim() ? 1 : 0.4 }]}>
                                <Plus size={16} color="#fff" />
                            </Pressable>
                        </View>

                        {/* Category Picker */}
                        {showCategoryPicker && (
                            <View style={[styles.categoryPickerRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                {CATEGORY_OPTIONS.map(cat => (
                                    <Pressable key={cat.key}
                                        style={[styles.categoryChip, { borderColor: newItemCategory === cat.key ? colors.accent : colors.border, backgroundColor: newItemCategory === cat.key ? colors.accent + '15' : 'transparent' }]}
                                        onPress={() => { setNewItemCategory(cat.key); setShowCategoryPicker(false); }}
                                    >
                                        <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                                        <Text style={{ fontSize: 10, color: colors.text, fontWeight: '500' }}>{cat.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}

                        {/* "Add Block" button */}
                        <Pressable onPress={() => setShowAddBlock(!showAddBlock)} style={[styles.addBlockBtn, { borderColor: colors.accent, backgroundColor: colors.accent + '08' }]}>
                            <Plus size={15} color={colors.accent} />
                            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Vorlage hinzufügen</Text>
                        </Pressable>

                        {showAddBlock && (
                            <>
                                {familyMembers.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 6 }} contentContainerStyle={{ gap: 6 }}>
                                        {['Alle', ...familyMembers].map(p => (
                                            <Pressable key={p}
                                                style={[styles.filterChip, { borderColor: blockPerson === p ? colors.accent : colors.border, backgroundColor: blockPerson === p ? colors.accent + '15' : 'transparent' }]}
                                                onPress={() => setBlockPerson(p)}
                                            >
                                                <Text style={{ fontSize: 11, color: blockPerson === p ? colors.accent : colors.subtext, fontWeight: '600' }}>{p === 'Alle' ? '👥 Alle' : `👤 ${p}`}</Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                )}
                                <View style={[styles.blockGrid, { borderColor: colors.border }]}>
                                    {allBlocks.map((block: TemplateBlock) => (
                                        <Pressable key={block.key} style={[styles.blockChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                                            onPress={() => { addBlockToList(block.key, blockPerson); setShowAddBlock(false); }}
                                        >
                                            <Text style={{ fontSize: 18 }}>{block.emoji}</Text>
                                            <Text style={{ fontSize: 10, color: colors.text, fontWeight: '600', textAlign: 'center' }}>{block.title}</Text>
                                            <Text style={{ fontSize: 9, color: colors.subtext }}>+{block.items.length}</Text>
                                            {block.custom && <Text style={{ fontSize: 7, color: colors.accent }}>★ Eigene</Text>}
                                        </Pressable>
                                    ))}
                                </View>
                            </>
                        )}

                        {/* Items grouped by category */}
                        {getGroupedItems().map(group => (
                            <View key={group.key} style={{ marginTop: 12 }}>
                                <View style={styles.groupHeader}>
                                    <Text style={{ fontSize: 14 }}>{group.emoji}</Text>
                                    <Text style={[styles.groupTitle, { color: colors.subtext }]}>{group.label}</Text>
                                    <Text style={{ color: colors.subtext, fontSize: 11 }}>
                                        {group.indices.filter(i => activeList.checked_items[i]).length}/{group.indices.length}
                                    </Text>
                                </View>
                                {group.indices.map(idx => (
                                    <Pressable key={idx} style={[styles.itemRow, { borderColor: colors.border }]} onPress={() => toggleItem(idx)}>
                                        {activeList.checked_items[idx]
                                            ? <CheckCircle2 size={20} color="#10B981" fill="#10B98130" />
                                            : <Circle size={20} color={colors.subtext} />
                                        }
                                        <Text style={[styles.itemText, { color: activeList.checked_items[idx] ? colors.subtext : colors.text }, activeList.checked_items[idx] && styles.itemDone]}>
                                            {activeList.items[idx]}
                                        </Text>
                                        {(activeList.assigned_to?.[idx]) ? (
                                            <View style={[styles.personBadge, { backgroundColor: colors.accent + '15' }]}>
                                                <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '600' }}>{activeList.assigned_to[idx]}</Text>
                                            </View>
                                        ) : null}
                                        <View style={{ flexDirection: 'row', gap: 4 }}>
                                            <Pressable onPress={() => moveItem(idx, 'up')} hitSlop={6} style={{ opacity: idx === 0 ? 0.2 : 1 }}>
                                                <ChevronUp size={13} color={colors.subtext} />
                                            </Pressable>
                                            <Pressable onPress={() => moveItem(idx, 'down')} hitSlop={6} style={{ opacity: idx === activeList.items.length - 1 ? 0.2 : 1 }}>
                                                <ChevronDown size={13} color={colors.subtext} />
                                            </Pressable>
                                            <Pressable onPress={() => removeItem(idx)} hitSlop={8}><Trash2 size={13} color={colors.subtext} /></Pressable>
                                        </View>
                                    </Pressable>
                                ))}
                            </View>
                        ))}

                        {activeList.items.length === 0 && (
                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                <Text style={{ fontSize: 40, marginBottom: 8 }}>📦</Text>
                                <Text style={{ color: colors.subtext, fontSize: 14 }}>Noch keine Artikel. Füge welche über Vorlagen oder manuell hinzu!</Text>
                            </View>
                        )}
                    </ScrollView>
                ) : (
                    /* ========== LIST OVERVIEW ========== */
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                        {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> : (
                            <>
                                {lists.length === 0 && (
                                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                        <Text style={{ fontSize: 50, marginBottom: 12 }}>🧳</Text>
                                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Noch keine Packlisten</Text>
                                        <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center' }}>
                                            Erstelle eine neue Liste und kombiniere Vorlagen-Module.
                                        </Text>
                                    </View>
                                )}
                                {lists.map(list => {
                                    const progress = getProgress(list);
                                    const done = list.checked_items.filter(Boolean).length;
                                    return (
                                        <Pressable key={list.id} style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setActiveList(list); setFilterCategory(null); }}>
                                            <Text style={{ fontSize: 28 }}>{list.emoji}</Text>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={[styles.listTitle, { color: colors.text }]}>{list.title}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                                    <View style={[styles.miniProgressBg, { backgroundColor: colors.border }]}>
                                                        <View style={[styles.miniProgressFill, { width: `${progress * 100}%` as any, backgroundColor: progress === 1 ? '#10B981' : colors.accent }]} />
                                                    </View>
                                                    <Text style={{ color: colors.subtext, fontSize: 11 }}>{done}/{list.items.length}</Text>
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                                <Pressable onPress={() => duplicateList(list)} hitSlop={8}><Copy size={14} color={colors.accent} /></Pressable>
                                                <Pressable onPress={() => deleteList(list)} hitSlop={8}><Trash2 size={14} color={colors.subtext} /></Pressable>
                                            </View>
                                        </Pressable>
                                    );
                                })}

                                {/* All Templates Management */}
                                <View style={{ marginTop: 16, marginBottom: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Vorlagen</Text>
                                        <Pressable onPress={() => { setEditTemplate(null); setTplTitle(''); setTplEmoji('📦'); setTplItems([]); setTplNewItem(''); setShowTemplateEditor(true); }}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                        >
                                            <Plus size={14} color={colors.accent} />
                                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>Neue Vorlage</Text>
                                        </Pressable>
                                    </View>
                                    {allBlocks.map((block: TemplateBlock) => {
                                        const customVersion = customTemplates.find(ct => `custom_${ct.id}` === block.key);
                                        return (
                                            <View key={block.key} style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                <Text style={{ fontSize: 22 }}>{block.emoji}</Text>
                                                <View style={{ flex: 1, marginLeft: 10 }}>
                                                    <Text style={[styles.listTitle, { color: colors.text }]}>{block.title}</Text>
                                                    <Text style={{ color: colors.subtext, fontSize: 11 }}>{block.items.length} Artikel{block.custom ? '' : ' · Standard'}</Text>
                                                </View>
                                                <Pressable onPress={() => {
                                                    if (customVersion) {
                                                        setEditTemplate(customVersion);
                                                    } else {
                                                        setEditTemplate(null);
                                                    }
                                                    setTplTitle(block.title);
                                                    setTplEmoji(block.emoji);
                                                    setTplItems([...block.items]);
                                                    setTplNewItem('');
                                                    setShowTemplateEditor(true);
                                                }} hitSlop={8}>
                                                    <Edit3 size={14} color={colors.accent} />
                                                </Pressable>
                                                {block.custom && customVersion && (
                                                    <Pressable onPress={() => deleteTemplate(customVersion.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                                                        <Trash2 size={14} color={colors.subtext} />
                                                    </Pressable>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            </>
                        )}
                    </ScrollView>
                )}

                {/* FAB */}
                {!activeList && (
                    <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={() => setShowCreate(true)}>
                        <Plus size={24} color="#fff" />
                    </Pressable>
                )}

                {/* ========== CREATE MODAL (2-step) ========== */}
                <Modal visible={showCreate} transparent animationType="fade">
                    <View style={styles.overlay}>
                        <View style={[styles.popup, { backgroundColor: colors.card, maxHeight: '85%' }]}>
                            <Pressable onPress={resetCreateForm} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
                                <X size={18} color={colors.subtext} />
                            </Pressable>

                            {createStep === 'info' ? (
                                /* Step 1: Name + Emoji */
                                <>
                                    <Text style={[styles.popupTitle, { color: colors.text }]}>Neue Packliste</Text>
                                    <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 14 }}>Wähle ein Emoji und gib einen Namen ein.</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                        {EMOJI_OPTIONS.map(e => (
                                            <Pressable key={e} style={[styles.emojiBtn, formEmoji === e && { backgroundColor: colors.accent + '20' }]} onPress={() => setFormEmoji(e)}>
                                                <Text style={{ fontSize: 20 }}>{e}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                        value={formTitle} onChangeText={setFormTitle}
                                        placeholder="z.B. Sommerferien 2026" placeholderTextColor={colors.subtext}
                                    />
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                                        <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetCreateForm}>
                                            <Text style={{ color: colors.subtext }}>Abbrechen</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: formTitle.trim() ? 1 : 0.4 }]}
                                            onPress={() => { if (formTitle.trim()) setCreateStep('blocks'); }}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '700' }}>Weiter</Text>
                                        </Pressable>
                                    </View>
                                </>
                            ) : (
                                /* Step 2: Select template blocks */
                                <>
                                    <Text style={[styles.popupTitle, { color: colors.text }]}>Module kombinieren</Text>
                                    <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 6 }}>
                                        Wähle Module aus. {familyMembers.length > 0 ? 'Tippe nochmal auf ein ausgewähltes Modul, um die Person zu wechseln.' : ''}
                                    </Text>
                                    {selectedBlocks.size > 0 && (
                                        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                                            {selectedBlocks.size} Module · {getMergedItems().length} Artikel
                                        </Text>
                                    )}
                                    {familyMembers.length > 0 && (
                                        <View style={{ marginBottom: 10 }}>
                                            <Text style={{ color: colors.subtext, fontSize: 11, marginBottom: 4 }}>Standard-Person für neue Module:</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                                {['Alle', ...familyMembers].map(p => (
                                                    <Pressable key={p}
                                                        style={[styles.filterChip, { borderColor: blockPerson === p ? colors.accent : colors.border, backgroundColor: blockPerson === p ? colors.accent + '15' : 'transparent' }]}
                                                        onPress={() => setBlockPerson(p)}
                                                    >
                                                        <Text style={{ fontSize: 11, color: blockPerson === p ? colors.accent : colors.subtext, fontWeight: '600' }}>{p === 'Alle' ? '👥 Alle' : `👤 ${p}`}</Text>
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                    <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                                        <View style={styles.blockGrid}>
                                            {allBlocks.map((block: TemplateBlock) => {
                                                const isSelected = selectedBlocks.has(block.key);
                                                const assignedPerson = selectedBlocks.get(block.key) || '';
                                                return (
                                                    <Pressable
                                                        key={block.key}
                                                        style={[
                                                            styles.blockChipLarge,
                                                            { backgroundColor: isSelected ? colors.accent + '15' : colors.background, borderColor: isSelected ? colors.accent : colors.border }
                                                        ]}
                                                        onPress={() => isSelected && familyMembers.length > 0 ? cycleBlockPerson(block.key) : toggleBlock(block.key)}
                                                        onLongPress={() => { if (isSelected) toggleBlock(block.key); }}
                                                    >
                                                        {isSelected && (
                                                            <View style={[styles.checkBadge, { backgroundColor: colors.accent }]}>
                                                                <Check size={10} color="#fff" />
                                                            </View>
                                                        )}
                                                        <Text style={{ fontSize: 22 }}>{block.emoji}</Text>
                                                        <Text style={{ fontSize: 11, color: colors.text, fontWeight: '700', textAlign: 'center', marginTop: 2 }}>{block.title}</Text>
                                                        <Text style={{ fontSize: 9, color: colors.subtext }}>{block.items.length} Artikel</Text>
                                                        {isSelected && familyMembers.length > 0 && (
                                                            <View style={[styles.personBadge, { backgroundColor: assignedPerson ? colors.accent + '20' : colors.border, marginTop: 3 }]}>
                                                                <Text style={{ fontSize: 8, color: assignedPerson ? colors.accent : colors.subtext, fontWeight: '700' }}>
                                                                    {assignedPerson || '👥 Alle'}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </ScrollView>
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                                        <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setCreateStep('info')}>
                                            <Text style={{ color: colors.subtext }}>Zurück</Text>
                                        </Pressable>
                                        <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleCreate}>
                                            <Text style={{ color: '#fff', fontWeight: '700' }}>
                                                {selectedBlocks.size > 0 ? `Erstellen (${getMergedItems().length})` : 'Leer erstellen'}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* Template Editor Modal */}
                <Modal visible={showTemplateEditor} transparent animationType="fade">
                    <View style={styles.overlay}>
                        <View style={[styles.popup, { backgroundColor: colors.card, maxHeight: '80%' }]}>
                            <Pressable onPress={() => { setShowTemplateEditor(false); setEditTemplate(null); }} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
                                <X size={18} color={colors.subtext} />
                            </Pressable>
                            <Text style={[styles.popupTitle, { color: colors.text }]}>{editTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
                                {EMOJI_OPTIONS.map(e => (
                                    <Pressable key={e} style={[styles.emojiBtn, tplEmoji === e && { backgroundColor: colors.accent + '20' }]} onPress={() => setTplEmoji(e)}>
                                        <Text style={{ fontSize: 20 }}>{e}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, marginBottom: 8 }]} value={tplTitle} onChangeText={setTplTitle} placeholder="Vorlagen-Name" placeholderTextColor={colors.subtext} />
                            <View style={[styles.addItemRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                                <TextInput style={[styles.addItemInput, { color: colors.text }]} value={tplNewItem} onChangeText={setTplNewItem} placeholder="Artikel hinzufügen..." placeholderTextColor={colors.subtext} onSubmitEditing={() => { if (tplNewItem.trim()) { setTplItems([...tplItems, { name: tplNewItem.trim(), cat: 'general' }]); setTplNewItem(''); } }} returnKeyType="done" />
                                <Pressable onPress={() => { if (tplNewItem.trim()) { setTplItems([...tplItems, { name: tplNewItem.trim(), cat: 'general' }]); setTplNewItem(''); } }} style={[styles.addItemBtn, { backgroundColor: colors.accent, opacity: tplNewItem.trim() ? 1 : 0.4 }]}>
                                    <Plus size={16} color="#fff" />
                                </Pressable>
                            </View>
                            <ScrollView style={{ maxHeight: 180, marginVertical: 8 }}>
                                {tplItems.map((item, i) => (
                                    <View key={i} style={[styles.itemRow, { borderColor: colors.border }]}>
                                        <Text style={[styles.itemText, { color: colors.text }]}>{item.name}</Text>
                                        <Pressable onPress={() => setTplItems(tplItems.filter((_, j) => j !== i))} hitSlop={8}><Trash2 size={13} color={colors.subtext} /></Pressable>
                                    </View>
                                ))}
                            </ScrollView>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => { setShowTemplateEditor(false); setEditTemplate(null); }}><Text style={{ color: colors.subtext }}>Abbrechen</Text></Pressable>
                                <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: tplTitle.trim() ? 1 : 0.4 }]} onPress={saveTemplate}><Text style={{ color: '#fff', fontWeight: '700' }}>Speichern ({tplItems.length})</Text></Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, borderRadius: 20 },
    progressCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
    progressLabel: { fontSize: 14, fontWeight: '600' },
    progressPercent: { fontSize: 14, fontWeight: '800' },
    progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: 8, borderRadius: 4 },
    filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
    addItemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingLeft: 10, paddingRight: 4, paddingVertical: 4 },
    addItemInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
    addItemBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    addBlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 10, marginTop: 12, marginBottom: 4 },
    categoryPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1, marginTop: 8 },
    categoryChip: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, minWidth: 65 },
    blockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    blockChip: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, width: '30%' as any, minWidth: 85 },
    blockChipLarge: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1.5, width: '30%' as any, minWidth: 90, position: 'relative' },
    checkBadge: { position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    groupTitle: { fontSize: 12, fontWeight: '700', flex: 1 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5 },
    itemText: { flex: 1, fontSize: 15 },
    itemDone: { textDecorationLine: 'line-through' as const },
    listCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    listTitle: { fontSize: 15, fontWeight: '700' },
    miniProgressBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
    miniProgressFill: { height: 4, borderRadius: 2 },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    personBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    sectionTitle: { fontSize: 13, fontWeight: '700' },
    templateCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 6 },
    fab: {
        position: 'absolute', bottom: 30, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 6, shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    popup: { borderRadius: 20, padding: 20 },
    popupTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    emojiBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
});

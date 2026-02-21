import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { X, Plus, Trash2, GripVertical, Zap, Sun, Moon, Clapperboard, Blinds, Bot, BedDouble, Lightbulb, Power, Home, Star, Shield, Fan, Bell, Music, Play, Lock, Unlock, DoorOpen, DoorClosed, RefreshCw, Clock, Video, Baby, PartyPopper, LucideIcon, ChevronRight, Search } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';

interface QuickActionConfig {
    id: string;
    label: string;
    iconName: string;
    color: string;
    description: string;
    type: 'script' | 'button' | 'switch' | 'cover_open' | 'cover_close' | 'vacuum_start' | 'vacuum_home' | 'lights_off' | 'lights_on';
    entityId?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
    Sun, Moon, Clapperboard, Blinds, Bot, BedDouble, Lightbulb, Power,
    Home, Star, Shield, Fan, Bell, Zap, Music, Play, Lock, Unlock,
    DoorOpen, DoorClosed, RefreshCw, Clock, Video, Baby, PartyPopper,
};

const ICON_NAMES = Object.keys(ICON_MAP);

const BUILTIN_ACTIONS: { type: string; label: string; description: string }[] = [
    { type: 'cover_open', label: 'Rollläden öffnen', description: 'Öffnet alle Storen im Haus.' },
    { type: 'cover_close', label: 'Rollläden schliessen', description: 'Schliesst alle Storen im Haus.' },
    { type: 'vacuum_start', label: 'Saugroboter starten', description: 'Startet den Saugroboter.' },
    { type: 'vacuum_home', label: 'Saugroboter Basis', description: 'Schickt den Saugroboter zurück.' },
    { type: 'lights_off', label: 'Alle Lichter aus', description: 'Schaltet alle Lichter im Haus aus.' },
    { type: 'lights_on', label: 'Alle Lichter an', description: 'Schaltet alle Lichter im Haus an.' },
];

const COLOR_PRESETS = ['#F59E0B', '#EC4899', '#60A5FA', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#F97316', '#14B8A6', '#6366F1'];

const DEFAULT_QUICK_ACTIONS: QuickActionConfig[] = [
    { id: 'morning', label: 'Morgen', iconName: 'Sun', color: '#F59E0B', description: 'Startet die Morgenroutine.', type: 'script', entityId: 'script.morgenroutine' },
    { id: 'movie', label: 'Kino', iconName: 'Clapperboard', color: '#EC4899', description: 'Aktiviert den Kino-Modus.', type: 'script', entityId: 'script.movie_night' },
    { id: 'covers_open', label: 'Rollläden auf', iconName: 'Blinds', color: '#60A5FA', description: 'Öffnet alle Storen.', type: 'cover_open' },
    { id: 'covers_close', label: 'Rollläden zu', iconName: 'Blinds', color: '#3B82F6', description: 'Schliesst alle Storen.', type: 'cover_close' },
    { id: 'vacuum_start', label: 'Röbi Start', iconName: 'Bot', color: '#10B981', description: 'Startet den Saugroboter.', type: 'vacuum_start' },
    { id: 'sleep', label: 'Schlafen', iconName: 'BedDouble', color: '#8B5CF6', description: 'Aktiviert den Schlafmodus.', type: 'script', entityId: 'script.bed_time' },
];

interface QuickActionsConfigModalProps {
    visible: boolean;
    onClose: () => void;
    isAdmin: boolean;
}

export const QuickActionsConfigModal = ({ visible, onClose, isAdmin }: QuickActionsConfigModalProps) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { entities } = useHomeAssistant();

    const [actions, setActions] = useState<QuickActionConfig[]>([]);
    const [addMode, setAddMode] = useState<'list' | 'builtin' | 'entity' | 'edit' | null>(null);
    const [editAction, setEditAction] = useState<QuickActionConfig | null>(null);
    const [entitySearch, setEntitySearch] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('Zap');
    const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
    const [actionLabel, setActionLabel] = useState('');
    const [actionDescription, setActionDescription] = useState('');

    const storageKey = isAdmin ? '@quick_actions_admin' : `@quick_actions_user_${user?.id}`;

    // Load actions
    useEffect(() => {
        if (!visible) return;
        (async () => {
            const stored = await AsyncStorage.getItem(storageKey);
            if (stored) {
                try { setActions(JSON.parse(stored)); return; } catch { }
            }
            // If admin with no config, load defaults. If user with no config, load admin or defaults.
            if (isAdmin) {
                setActions(DEFAULT_QUICK_ACTIONS);
            } else {
                const adminCfg = await AsyncStorage.getItem('@quick_actions_admin');
                if (adminCfg) {
                    try { setActions(JSON.parse(adminCfg)); } catch { setActions(DEFAULT_QUICK_ACTIONS); }
                } else {
                    setActions(DEFAULT_QUICK_ACTIONS);
                }
            }
        })();
    }, [visible, storageKey]);

    const saveActions = async (newActions: QuickActionConfig[]) => {
        setActions(newActions);
        await AsyncStorage.setItem(storageKey, JSON.stringify(newActions));
    };

    const deleteAction = (id: string) => {
        Alert.alert('Löschen?', 'Aktion entfernen?', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: () => saveActions(actions.filter(a => a.id !== id)) },
        ]);
    };

    const addBuiltinAction = (builtin: typeof BUILTIN_ACTIONS[0]) => {
        const newAction: QuickActionConfig = {
            id: `${builtin.type}_${Date.now()}`,
            label: builtin.label,
            iconName: builtin.type.includes('cover') ? 'Blinds' : builtin.type.includes('vacuum') ? 'Bot' : 'Lightbulb',
            color: COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)],
            description: builtin.description,
            type: builtin.type as any,
        };
        saveActions([...actions, newAction]);
        setAddMode(null);
    };

    const addEntityAction = (entityId: string) => {
        const domain = entityId.split('.')[0];
        const type = domain === 'button' ? 'button' : domain === 'switch' ? 'switch' : 'script';
        const name = entityId.split('.')[1]?.replace(/_/g, ' ') || entityId;

        setEditAction({
            id: `custom_${Date.now()}`,
            label: name.charAt(0).toUpperCase() + name.slice(1),
            iconName: selectedIcon,
            color: selectedColor,
            description: '',
            type,
            entityId,
        });
        setActionLabel(name.charAt(0).toUpperCase() + name.slice(1));
        setActionDescription('');
        setAddMode('edit');
    };

    const saveEditedAction = () => {
        if (!editAction || !actionLabel.trim()) return;
        const updated: QuickActionConfig = {
            ...editAction,
            label: actionLabel.trim(),
            description: actionDescription.trim(),
            iconName: selectedIcon,
            color: selectedColor,
        };
        const existing = actions.find(a => a.id === updated.id);
        if (existing) {
            saveActions(actions.map(a => a.id === updated.id ? updated : a));
        } else {
            saveActions([...actions, updated]);
        }
        setAddMode(null);
        setEditAction(null);
    };

    const resetToDefaults = () => {
        Alert.alert('Zurücksetzen?', isAdmin ? 'Auf Standard-Aktionen zurücksetzen?' : 'Deine persönlichen Aktionen löschen und Admin-Standard verwenden?', [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Zurücksetzen', style: 'destructive', onPress: async () => {
                    await AsyncStorage.removeItem(storageKey);
                    if (isAdmin) {
                        setActions(DEFAULT_QUICK_ACTIONS);
                    } else {
                        const adminCfg = await AsyncStorage.getItem('@quick_actions_admin');
                        if (adminCfg) {
                            try { setActions(JSON.parse(adminCfg)); } catch { setActions(DEFAULT_QUICK_ACTIONS); }
                        } else {
                            setActions(DEFAULT_QUICK_ACTIONS);
                        }
                    }
                }
            },
        ]);
    };

    const filteredEntities = useMemo(() => {
        const allowed = entities.filter(e =>
            e.entity_id.startsWith('script.') ||
            e.entity_id.startsWith('button.') ||
            e.entity_id.startsWith('switch.') ||
            e.entity_id.startsWith('automation.')
        );
        if (!entitySearch.trim()) return allowed.slice(0, 50);
        const q = entitySearch.toLowerCase();
        return allowed.filter(e => e.entity_id.toLowerCase().includes(q) || (e.attributes?.friendly_name || '').toLowerCase().includes(q)).slice(0, 50);
    }, [entities, entitySearch]);

    const moveAction = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === actions.length - 1) return;
        const newActions = [...actions];
        const swapIdx = direction === 'up' ? index - 1 : index + 1;
        [newActions[index], newActions[swapIdx]] = [newActions[swapIdx], newActions[index]];
        saveActions(newActions);
    };

    // Render the add/edit sub-views
    if (addMode === 'builtin') {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddMode(null)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Eingebaute Aktion</Text>
                        <Pressable onPress={() => setAddMode(null)} style={{ padding: 8 }}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>
                    <ScrollView style={{ flex: 1, padding: 16 }}>
                        {BUILTIN_ACTIONS.map(b => (
                            <Pressable key={b.type} onPress={() => addBuiltinAction(b)}
                                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.accent + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                    <Zap size={20} color={colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{b.label}</Text>
                                    <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>{b.description}</Text>
                                </View>
                                <ChevronRight size={18} color={colors.subtext} />
                            </Pressable>
                        ))}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        );
    }

    if (addMode === 'entity') {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddMode(null)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Entität wählen</Text>
                        <Pressable onPress={() => setAddMode(null)} style={{ padding: 8 }}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>
                    <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
                            <Search size={18} color={colors.subtext} />
                            <TextInput
                                value={entitySearch}
                                onChangeText={setEntitySearch}
                                placeholder="Suchen..."
                                placeholderTextColor={colors.subtext}
                                style={{ flex: 1, color: colors.text, padding: 12, fontSize: 15 }}
                            />
                        </View>
                    </View>
                    <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
                        {filteredEntities.map(e => (
                            <Pressable key={e.entity_id} onPress={() => addEntityAction(e.entity_id)}
                                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.card, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.border }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{e.attributes?.friendly_name || e.entity_id}</Text>
                                    <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 2 }}>{e.entity_id}</Text>
                                </View>
                                <ChevronRight size={16} color={colors.subtext} />
                            </Pressable>
                        ))}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        );
    }

    if (addMode === 'edit' && editAction) {
        const IconPreview = ICON_MAP[selectedIcon] || Zap;
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddMode(null)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Aktion bearbeiten</Text>
                        <Pressable onPress={() => { setAddMode(null); setEditAction(null); }} style={{ padding: 8 }}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>
                    <ScrollView style={{ flex: 1, padding: 16 }}>
                        {/* Preview */}
                        <View style={{ alignItems: 'center', marginBottom: 24 }}>
                            <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: selectedColor + '26', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                <IconPreview size={28} color={selectedColor} />
                            </View>
                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{actionLabel || 'Name'}</Text>
                        </View>

                        {/* Label */}
                        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>NAME</Text>
                        <TextInput
                            value={actionLabel}
                            onChangeText={setActionLabel}
                            placeholder="z.B. Morgenroutine"
                            placeholderTextColor={colors.subtext}
                            style={{ backgroundColor: colors.card, color: colors.text, borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}
                        />

                        {/* Description */}
                        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>BESCHREIBUNG (optional)</Text>
                        <TextInput
                            value={actionDescription}
                            onChangeText={setActionDescription}
                            placeholder="z.B. Startet die Morgenroutine"
                            placeholderTextColor={colors.subtext}
                            style={{ backgroundColor: colors.card, color: colors.text, borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}
                        />

                        {/* Color */}
                        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>FARBE</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            {COLOR_PRESETS.map(c => (
                                <Pressable key={c} onPress={() => setSelectedColor(c)}
                                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: selectedColor === c ? 3 : 0, borderColor: '#FFF' }}>
                                    {selectedColor === c && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>✓</Text></View>}
                                </Pressable>
                            ))}
                        </View>

                        {/* Icon */}
                        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>ICON</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                            {ICON_NAMES.map(name => {
                                const Ic = ICON_MAP[name];
                                if (!Ic) return null;
                                const isSelected = selectedIcon === name;
                                return (
                                    <Pressable key={name} onPress={() => setSelectedIcon(name)}
                                        style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isSelected ? selectedColor + '30' : colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? selectedColor : colors.border }}>
                                        <Ic size={20} color={isSelected ? selectedColor : colors.subtext} />
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Entity info */}
                        {editAction.entityId && (
                            <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                                <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '600' }}>ENTITÄT</Text>
                                <Text style={{ color: colors.text, fontSize: 14, marginTop: 4 }}>{editAction.entityId}</Text>
                            </View>
                        )}

                        {/* Save Button */}
                        <Pressable onPress={saveEditedAction}
                            style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 40 }}>
                            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Speichern</Text>
                        </Pressable>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        );
    }

    // Main list view
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
                        {isAdmin ? 'Schnellaktionen (Admin)' : 'Meine Schnellaktionen'}
                    </Text>
                    <Pressable onPress={onClose} style={{ padding: 8 }}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={{ flex: 1, padding: 16 }}>
                    {/* Action list */}
                    {actions.map((action, index) => {
                        const Ic = ICON_MAP[action.iconName] || Zap;
                        return (
                            <View key={action.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                                <View style={{ flexDirection: 'column', alignItems: 'center', marginRight: 8 }}>
                                    <Pressable onPress={() => moveAction(index, 'up')} style={{ padding: 4, opacity: index === 0 ? 0.2 : 1 }}>
                                        <Text style={{ color: colors.subtext, fontSize: 16 }}>▲</Text>
                                    </Pressable>
                                    <Pressable onPress={() => moveAction(index, 'down')} style={{ padding: 4, opacity: index === actions.length - 1 ? 0.2 : 1 }}>
                                        <Text style={{ color: colors.subtext, fontSize: 16 }}>▼</Text>
                                    </Pressable>
                                </View>
                                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: action.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                    <Ic size={20} color={action.color} />
                                </View>
                                <Pressable
                                    style={{ flex: 1 }}
                                    onPress={() => {
                                        setEditAction(action);
                                        setActionLabel(action.label);
                                        setActionDescription(action.description);
                                        setSelectedIcon(action.iconName);
                                        setSelectedColor(action.color);
                                        setAddMode('edit');
                                    }}
                                >
                                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{action.label}</Text>
                                    <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 2 }}>{action.type}{action.entityId ? ` • ${action.entityId}` : ''}</Text>
                                </Pressable>
                                <Pressable onPress={() => deleteAction(action.id)} style={{ padding: 8 }}>
                                    <Trash2 size={18} color={colors.error || '#EF4444'} />
                                </Pressable>
                            </View>
                        );
                    })}

                    {/* Add buttons */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 }}>
                        <Pressable onPress={() => setAddMode('entity')}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 12, backgroundColor: colors.accent + '15', borderWidth: 1, borderColor: colors.accent + '40' }}>
                            <Plus size={18} color={colors.accent} />
                            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>HA Entität</Text>
                        </Pressable>
                        <Pressable onPress={() => setAddMode('builtin')}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 12, backgroundColor: colors.accent + '15', borderWidth: 1, borderColor: colors.accent + '40' }}>
                            <Zap size={18} color={colors.accent} />
                            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Eingebaut</Text>
                        </Pressable>
                    </View>

                    {/* Reset button */}
                    <Pressable onPress={resetToDefaults}
                        style={{ alignItems: 'center', padding: 14, marginTop: 8, marginBottom: 40 }}>
                        <Text style={{ color: colors.subtext, fontSize: 13 }}>
                            {isAdmin ? 'Auf Standard zurücksetzen' : 'Persönliche Aktionen zurücksetzen'}
                        </Text>
                    </Pressable>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
};

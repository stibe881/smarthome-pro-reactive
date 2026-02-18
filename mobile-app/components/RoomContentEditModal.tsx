import React, { useState, useMemo, useCallback } from 'react';
import {
    View, Text, Modal, ScrollView, Pressable, TextInput,
    Alert, StyleSheet, useWindowDimensions
} from 'react-native';
import {
    X, Plus, Trash2, Edit3, Search, ChevronDown, ChevronUp,
    Lightbulb, Blinds, Thermometer, Music, Film, Camera, Activity, Zap, GripVertical, Save, Check, ArrowRightLeft,
    ArrowUp, ArrowDown, Power
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ========================================================
// Types
// ========================================================

export type EntityGroup = 'lights' | 'covers' | 'climates' | 'mediaPlayers' | 'scripts' | 'scenes' | 'sensors' | 'cameras' | 'helpers' | 'switches';

export interface CustomGroup {
    id: string;
    label: string;
}

export interface RoomOverride {
    /** Entity-ID -> custom friendly name */
    nameOverrides: Record<string, string>;
    /** Entity-ID -> target group (predefined or custom group id) */
    groupOverrides: Record<string, string>;
    /** Ordered list of groups to show (empty = default order) */
    groupOrder: EntityGroup[];
    /** Groups explicitly hidden */
    hiddenGroups: string[];
    /** Additional entity IDs manually added to this room */
    extraEntities: string[];
    /** Entity IDs explicitly removed from this room */
    removedEntities: string[];
    /** Custom groups added by the user */
    customGroups: CustomGroup[];
    /** Custom labels for predefined groups */
    groupLabels: Record<string, string>;
    /** Entity-ID -> display type override (e.g. 'light', 'switch', 'scene', 'cover', 'mediaPlayer') */
    entityDisplayTypes: Record<string, string>;
}

const EMPTY_OVERRIDE: RoomOverride = {
    nameOverrides: {},
    groupOverrides: {},
    groupOrder: [],
    hiddenGroups: [],
    extraEntities: [],
    removedEntities: [],
    customGroups: [],
    groupLabels: {},
    entityDisplayTypes: {},
};

const DEFAULT_GROUP_LABELS: Record<EntityGroup, string> = {
    lights: 'Beleuchtung',
    covers: 'Rollläden',
    climates: 'Klima',
    mediaPlayers: 'Medien',
    scripts: 'Szenen (Scripts)',
    scenes: 'Szenen',
    sensors: 'Status',
    cameras: 'Kameras',
    helpers: 'Einstellungen',
    switches: 'Schalter',
};

const GROUP_ICONS: Record<string, any> = {
    lights: Lightbulb,
    covers: Blinds,
    climates: Thermometer,
    mediaPlayers: Music,
    scripts: Zap,
    scenes: Film,
    sensors: Activity,
    cameras: Camera,
    helpers: GripVertical,
    switches: Power,
};

const ALL_GROUPS: EntityGroup[] = ['lights', 'covers', 'climates', 'mediaPlayers', 'scripts', 'scenes', 'sensors', 'cameras', 'helpers', 'switches'];

const DISPLAY_TYPE_OPTIONS = [
    { key: 'auto', label: 'Auto' },
    { key: 'light', label: 'Licht' },
    { key: 'switch', label: 'Schalter' },
    { key: 'cover', label: 'Rollladen' },
    { key: 'scene', label: 'Szene' },
    { key: 'mediaPlayer', label: 'Media Player' },
    { key: 'climate', label: 'Klima' },
    { key: 'sensor', label: 'Sensor' },
    { key: 'camera', label: 'Kamera' },
];

// ========================================================
// Storage (Supabase-first, AsyncStorage fallback)
// ========================================================

import { supabase } from '../lib/supabase';

const getOverrideKey = (roomName: string) => `@smarthome_room_overrides_${roomName.replace(/\s/g, '_').toLowerCase()}`;

/** Get the current user's household_id from Supabase */
async function getHouseholdId(): Promise<string | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const { data } = await supabase
            .from('family_members')
            .select('household_id')
            .eq('user_id', user.id)
            .single();
        return data?.household_id || null;
    } catch {
        return null;
    }
}

export async function loadRoomOverride(roomName: string): Promise<RoomOverride> {
    // Try Supabase first (instance-wide)
    try {
        const householdId = await getHouseholdId();
        if (householdId) {
            const { data, error } = await supabase
                .from('room_overrides')
                .select('override_data')
                .eq('household_id', householdId)
                .eq('room_name', roomName)
                .single();
            if (data?.override_data && !error) {
                const override = { ...EMPTY_OVERRIDE, ...data.override_data };
                // Cache locally
                AsyncStorage.setItem(getOverrideKey(roomName), JSON.stringify(override)).catch(() => { });
                return override;
            }
        }
    } catch { }

    // Fallback: AsyncStorage (offline / no household)
    try {
        const stored = await AsyncStorage.getItem(getOverrideKey(roomName));
        if (stored) return { ...EMPTY_OVERRIDE, ...JSON.parse(stored) };
    } catch { }
    return { ...EMPTY_OVERRIDE };
}

export async function saveRoomOverride(roomName: string, override: RoomOverride): Promise<void> {
    // Always save to AsyncStorage as cache
    try {
        await AsyncStorage.setItem(getOverrideKey(roomName), JSON.stringify(override));
    } catch (e) {
        console.error('Failed to save room override to local storage', e);
    }

    // Save to Supabase (instance-wide)
    try {
        const householdId = await getHouseholdId();
        if (householdId) {
            const { error } = await supabase
                .from('room_overrides')
                .upsert({
                    household_id: householdId,
                    room_name: roomName,
                    override_data: override,
                }, {
                    onConflict: 'household_id,room_name',
                });
            if (error) {
                // Silently warn - table may not exist yet
                console.warn('[RoomOverrides] Supabase sync skipped:', error.message);
            }
        }
    } catch (e: any) {
        console.warn('[RoomOverrides] Supabase sync skipped:', e?.message || e);
    }
}

// Helper: determine which group an entity belongs to by its entity_id prefix
function getGroupForEntity(entityId: string): EntityGroup {
    if (entityId.startsWith('light.')) return 'lights';
    if (entityId.startsWith('cover.')) return 'covers';
    if (entityId.startsWith('climate.')) return 'climates';
    if (entityId.startsWith('media_player.')) return 'mediaPlayers';
    if (entityId.startsWith('script.')) return 'scripts';
    if (entityId.startsWith('scene.')) return 'scenes';
    if (entityId.startsWith('camera.')) return 'cameras';
    if (entityId.startsWith('sensor.') || entityId.startsWith('binary_sensor.')) return 'sensors';
    if (entityId.startsWith('input_select.') || entityId.startsWith('input_boolean.') || entityId.startsWith('input_number.')) return 'helpers';
    return 'sensors';
}

// Apply overrides to room data
export function applyRoomOverrides(room: any, override: RoomOverride, allEntities?: any[]): any {
    if (!room || !override) return room;

    // Normalize: ensure all fields exist (backward compat with old stored overrides)
    const o: RoomOverride = { ...EMPTY_OVERRIDE, ...override };

    const result = { ...room };

    // Apply name overrides, group reassignments, and filter removed entities
    for (const group of ALL_GROUPS) {
        if (result[group]) {
            result[group] = result[group]
                .filter((e: any) => !(o.removedEntities || []).includes(e.entity_id))
                // Filter out entities reassigned to different groups
                .filter((e: any) => {
                    const reassigned = (o.groupOverrides || {})[e.entity_id];
                    return !reassigned || reassigned === group;
                })
                .map((e: any) => {
                    const customName = (o.nameOverrides || {})[e.entity_id];
                    if (customName) {
                        return { ...e, attributes: { ...e.attributes, friendly_name: customName } };
                    }
                    return e;
                });
        }
    }

    // Add entities reassigned to different predefined groups
    for (const [entityId, targetGroup] of Object.entries(o.groupOverrides || {})) {
        if (ALL_GROUPS.includes(targetGroup as EntityGroup)) {
            if (!result[targetGroup]) result[targetGroup] = [];
            let entity: any = null;
            for (const g of ALL_GROUPS) {
                entity = room[g]?.find((e: any) => e.entity_id === entityId);
                if (entity) break;
            }
            if (!entity && allEntities) {
                entity = allEntities.find((e: any) => e.entity_id === entityId);
            }
            if (entity && !result[targetGroup].some((e: any) => e.entity_id === entityId)) {
                const customName = (o.nameOverrides || {})[entityId];
                const finalEntity = customName
                    ? { ...entity, attributes: { ...entity.attributes, friendly_name: customName } }
                    : entity;
                result[targetGroup] = [...result[targetGroup], finalEntity];
            }
        }
    }

    // Inject extra entities into their appropriate groups (considering groupOverrides)
    if ((o.extraEntities || []).length > 0 && allEntities) {
        for (const entityId of o.extraEntities) {
            const entity = allEntities.find((e: any) => e.entity_id === entityId);
            if (!entity) continue;
            const targetGroup = (o.groupOverrides || {})[entityId] || getGroupForEntity(entityId);
            if (!ALL_GROUPS.includes(targetGroup as EntityGroup)) continue;
            if (!result[targetGroup]) result[targetGroup] = [];
            if (!result[targetGroup].some((e: any) => e.entity_id === entityId)) {
                const customName = (o.nameOverrides || {})[entityId];
                const finalEntity = customName
                    ? { ...entity, attributes: { ...entity.attributes, friendly_name: customName } }
                    : entity;
                result[targetGroup] = [...result[targetGroup], finalEntity];
            }
        }
    }

    // Apply hidden groups
    for (const hidden of (o.hiddenGroups || [])) {
        if (result[hidden]) result[hidden] = [];
    }

    // Apply group labels
    if (!result._groupLabels) result._groupLabels = {};
    for (const [groupId, label] of Object.entries(o.groupLabels || {})) {
        result._groupLabels[groupId] = label;
    }

    // Custom groups: collect entities assigned to custom groups
    if ((o.customGroups || []).length > 0) {
        result._customGroups = o.customGroups.map(cg => {
            const groupEntities: any[] = [];
            for (const [entityId, targetGroup] of Object.entries(o.groupOverrides || {})) {
                if (targetGroup === cg.id) {
                    let entity: any = null;
                    for (const g of ALL_GROUPS) {
                        entity = room[g]?.find((e: any) => e.entity_id === entityId);
                        if (entity) break;
                    }
                    if (!entity && allEntities) {
                        entity = allEntities.find((e: any) => e.entity_id === entityId);
                    }
                    if (entity) {
                        const customName = (o.nameOverrides || {})[entityId];
                        groupEntities.push(customName
                            ? { ...entity, attributes: { ...entity.attributes, friendly_name: customName } }
                            : entity
                        );
                    }
                }
            }
            return { ...cg, entities: groupEntities };
        });
    }

    // Pass group order to result
    result._groupOrder = (o.groupOrder || []).length > 0 ? o.groupOrder : ALL_GROUPS;

    // Pass entity display types
    result._entityDisplayTypes = o.entityDisplayTypes || {};

    return result;
}

// ========================================================
// Component
// ========================================================

interface Props {
    visible: boolean;
    onClose: () => void;
    room: any;
    colors: any;
    allEntities: any[];
    onOverrideChanged: () => void;
}

export function RoomContentEditModal({ visible, onClose, room, colors, allEntities, onOverrideChanged }: Props) {
    const { width } = useWindowDimensions();
    const [override, setOverride] = useState<RoomOverride>({ ...EMPTY_OVERRIDE });
    const [loaded, setLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [showAddEntity, setShowAddEntity] = useState(false);
    const [dirty, setDirty] = useState(false);
    // Group management
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState('');
    // Entity group assignment
    const [assigningEntityId, setAssigningEntityId] = useState<string | null>(null);
    // Pending add entity (staged for group selection)
    const [pendingAddEntityId, setPendingAddEntityId] = useState<string | null>(null);
    // Entity display type picker
    const [typingEntityId, setTypingEntityId] = useState<string | null>(null);

    // Load override when modal opens
    React.useEffect(() => {
        if (visible && room) {
            loadRoomOverride(room.name).then(o => {
                setOverride(o);
                setLoaded(true);
                setDirty(false);
            });
        } else {
            setLoaded(false);
            setShowAddEntity(false);
            setShowNewGroup(false);
            setExpandedGroup(null);
        }
    }, [visible, room?.name]);

    // Helper: find friendly name for any entity across all groups
    const findFriendlyName = useCallback((entityId: string): string => {
        // Check override first
        if (override.nameOverrides[entityId]) return override.nameOverrides[entityId];
        // Search all room groups
        for (const g of ALL_GROUPS) {
            const found = room?.[g]?.find((e: any) => e.entity_id === entityId);
            if (found?.attributes?.friendly_name) return found.attributes.friendly_name;
        }
        // Search allEntities
        const found = allEntities.find(e => e.entity_id === entityId);
        if (found?.attributes?.friendly_name) return found.attributes.friendly_name;
        return entityId;
    }, [room, allEntities, override.nameOverrides]);

    // Get group label
    const getGroupLabel = useCallback((groupId: string): string => {
        if (override.groupLabels[groupId]) return override.groupLabels[groupId];
        if (DEFAULT_GROUP_LABELS[groupId as EntityGroup]) return DEFAULT_GROUP_LABELS[groupId as EntityGroup];
        const custom = override.customGroups.find(g => g.id === groupId);
        if (custom) return custom.label;
        return groupId;
    }, [override.groupLabels, override.customGroups]);

    // Get all entities currently in the room, organized by group
    const roomEntities = useMemo(() => {
        if (!room) return {};
        const result: Record<string, any[]> = {};
        for (const g of ALL_GROUPS) {
            result[g] = (room[g] || [])
                .filter((e: any) => !override.removedEntities.includes(e.entity_id))
                .filter((e: any) => {
                    const reassigned = override.groupOverrides[e.entity_id];
                    return !reassigned || reassigned === g;
                });
        }
        // Add entities reassigned to predefined groups
        for (const [entityId, targetGroup] of Object.entries(override.groupOverrides)) {
            if (ALL_GROUPS.includes(targetGroup as EntityGroup) && !result[targetGroup]?.some((e: any) => e.entity_id === entityId)) {
                let entity: any = null;
                for (const g of ALL_GROUPS) {
                    entity = room[g]?.find((e: any) => e.entity_id === entityId);
                    if (entity) break;
                }
                if (!entity) entity = allEntities.find(e => e.entity_id === entityId);
                if (entity) {
                    if (!result[targetGroup]) result[targetGroup] = [];
                    result[targetGroup].push(entity);
                }
            }
        }
        // Add extra entities
        for (const entityId of override.extraEntities) {
            const targetGroup = override.groupOverrides[entityId] || getGroupForEntity(entityId);
            if (!ALL_GROUPS.includes(targetGroup as EntityGroup)) continue;
            if (!result[targetGroup]) result[targetGroup] = [];
            if (!result[targetGroup].some((e: any) => e.entity_id === entityId)) {
                const entity = allEntities.find(e => e.entity_id === entityId);
                if (entity) result[targetGroup].push(entity);
            }
        }
        // Custom groups
        for (const cg of override.customGroups) {
            result[cg.id] = [];
            for (const [entityId, targetGroup] of Object.entries(override.groupOverrides)) {
                if (targetGroup === cg.id) {
                    let entity: any = null;
                    for (const g of ALL_GROUPS) {
                        entity = room[g]?.find((e: any) => e.entity_id === entityId);
                        if (entity) break;
                    }
                    if (!entity) entity = allEntities.find(e => e.entity_id === entityId);
                    if (entity) result[cg.id].push(entity);
                }
            }
        }
        return result;
    }, [room, override.removedEntities, override.groupOverrides, override.extraEntities, override.customGroups, allEntities]);

    // All group IDs including custom ones
    const allGroupIds = useMemo(() => {
        const ids = [...ALL_GROUPS];
        for (const cg of override.customGroups) {
            if (!ids.includes(cg.id as EntityGroup)) ids.push(cg.id as EntityGroup);
        }
        return ids;
    }, [override.customGroups]);

    // Ordered group IDs: use saved order, then append any new groups not in order
    const orderedGroupIds = useMemo(() => {
        const order = override.groupOrder || [];
        const result: string[] = [];
        // First add groups from saved order that still exist
        for (const gId of order) {
            if (allGroupIds.includes(gId as EntityGroup)) result.push(gId);
        }
        // Then add any groups not in saved order
        for (const gId of allGroupIds) {
            if (!result.includes(gId)) result.push(gId);
        }
        return result;
    }, [override.groupOrder, allGroupIds]);

    // Only groups that exist in this room (have entities or are custom)
    const existingGroupIds = useMemo(() => {
        return orderedGroupIds.filter(gId => {
            const entities = roomEntities[gId] || [];
            if (entities.length > 0) return true;
            // Always show custom groups
            if (override.customGroups.some(cg => cg.id === gId)) return true;
            return false;
        });
    }, [orderedGroupIds, roomEntities, override.customGroups]);

    // Available entities for adding (not already in room)
    const currentEntityIds = useMemo(() => {
        const ids = new Set<string>();
        for (const gId of allGroupIds) {
            (roomEntities[gId] || []).forEach((e: any) => ids.add(e.entity_id));
        }
        override.extraEntities.forEach(id => ids.add(id));
        return ids;
    }, [roomEntities, override.extraEntities, allGroupIds]);

    const filteredAddEntities = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return allEntities
            .filter(e => !currentEntityIds.has(e.entity_id))
            .filter(e =>
                e.entity_id.toLowerCase().includes(q) ||
                (e.attributes.friendly_name || '').toLowerCase().includes(q)
            )
            .slice(0, 30);
    }, [allEntities, currentEntityIds, searchQuery]);

    const updateOverride = (partial: Partial<RoomOverride>) => {
        setOverride(prev => ({ ...prev, ...partial }));
        setDirty(true);
    };

    const handleSave = async () => {
        if (!room) return;
        await saveRoomOverride(room.name, override);
        setDirty(false);
        onOverrideChanged();
        onClose();
    };

    // --- Entity Actions ---

    const handleRenameEntity = (entityId: string) => {
        setEditingEntityId(entityId);
        setEditingName(findFriendlyName(entityId));
    };

    const confirmRename = () => {
        if (!editingEntityId) return;
        const newOverrides = { ...override.nameOverrides };
        if (editingName.trim()) {
            newOverrides[editingEntityId] = editingName.trim();
        } else {
            delete newOverrides[editingEntityId];
        }
        updateOverride({ nameOverrides: newOverrides });
        setEditingEntityId(null);
        setEditingName('');
    };

    const handleRemoveEntity = (entityId: string) => {
        // Remove entity from room (no confirmation dialog)
        const newGroupOverrides = { ...override.groupOverrides };
        delete newGroupOverrides[entityId];
        updateOverride({
            removedEntities: override.removedEntities.includes(entityId)
                ? override.removedEntities
                : [...override.removedEntities, entityId],
            groupOverrides: newGroupOverrides,
        });
    };

    const handleRestoreEntity = (entityId: string) => {
        updateOverride({ removedEntities: override.removedEntities.filter(id => id !== entityId) });
    };

    const handleAddEntity = (entityId: string) => {
        // Stage the entity and open group picker
        setPendingAddEntityId(entityId);
        setSearchQuery('');
    };

    const confirmAddEntityToGroup = (targetGroupId: string) => {
        if (!pendingAddEntityId) return;
        const newGroupOverrides = { ...override.groupOverrides };
        const defaultGroup = getGroupForEntity(pendingAddEntityId);
        if (targetGroupId !== defaultGroup) {
            newGroupOverrides[pendingAddEntityId] = targetGroupId;
        }
        updateOverride({
            extraEntities: [...override.extraEntities, pendingAddEntityId],
            groupOverrides: newGroupOverrides,
        });
        setPendingAddEntityId(null);
    };

    const handleRemoveExtra = (entityId: string) => {
        const newGroupOverrides = { ...override.groupOverrides };
        delete newGroupOverrides[entityId];
        updateOverride({
            extraEntities: override.extraEntities.filter(id => id !== entityId),
            groupOverrides: newGroupOverrides,
        });
    };

    // --- Entity Group Assignment ---

    const handleAssignEntityToGroup = (entityId: string, targetGroupId: string) => {
        const defaultGroup = getGroupForEntity(entityId);
        const newGroupOverrides = { ...override.groupOverrides };
        if (targetGroupId === defaultGroup) {
            // Reset to default
            delete newGroupOverrides[entityId];
        } else {
            newGroupOverrides[entityId] = targetGroupId;
        }
        updateOverride({ groupOverrides: newGroupOverrides });
        setAssigningEntityId(null);
    };

    // --- Group Actions ---

    const handleToggleGroup = (groupId: string) => {
        const hidden = [...override.hiddenGroups];
        const idx = hidden.indexOf(groupId);
        if (idx >= 0) {
            hidden.splice(idx, 1);
        } else {
            hidden.push(groupId);
        }
        updateOverride({ hiddenGroups: hidden });
    };

    const handleCreateGroup = () => {
        if (!newGroupName.trim()) return;
        const id = `custom_${Date.now()}`;
        updateOverride({
            customGroups: [...override.customGroups, { id, label: newGroupName.trim() }],
        });
        setNewGroupName('');
        setShowNewGroup(false);
    };

    const handleRenameGroup = (groupId: string) => {
        setEditingGroupId(groupId);
        setEditingGroupName(getGroupLabel(groupId));
    };

    const confirmGroupRename = () => {
        if (!editingGroupId || !editingGroupName.trim()) return;
        const isCustom = override.customGroups.some(g => g.id === editingGroupId);
        if (isCustom) {
            // Update label directly on CustomGroup
            updateOverride({
                customGroups: override.customGroups.map(g =>
                    g.id === editingGroupId ? { ...g, label: editingGroupName.trim() } : g
                ),
            });
        } else {
            // Use groupLabels for predefined groups
            updateOverride({
                groupLabels: { ...override.groupLabels, [editingGroupId]: editingGroupName.trim() },
            });
        }
        setEditingGroupId(null);
        setEditingGroupName('');
    };

    const handleDeleteGroup = (groupId: string) => {
        const isCustom = override.customGroups.some(g => g.id === groupId);

        if (isCustom) {
            // Remove custom group directly (no confirmation dialog)
            const newGroupOverrides = { ...override.groupOverrides };
            for (const [entityId, target] of Object.entries(newGroupOverrides)) {
                if (target === groupId) delete newGroupOverrides[entityId];
            }
            const newOrder = (override.groupOrder || []).filter(g => g !== groupId);
            updateOverride({
                customGroups: override.customGroups.filter(g => g.id !== groupId),
                groupOverrides: newGroupOverrides,
                groupOrder: newOrder as EntityGroup[],
            });
        } else {
            // Predefined groups: hide AND remove from groupOrder
            const hidden = [...override.hiddenGroups];
            if (!hidden.includes(groupId)) hidden.push(groupId);
            const newOrder = (override.groupOrder || []).filter(g => g !== groupId);
            updateOverride({
                hiddenGroups: hidden,
                groupOrder: newOrder as EntityGroup[],
            });
        }
    };

    const handleMoveGroup = (groupId: string, direction: 'up' | 'down') => {
        const current = [...orderedGroupIds];
        const idx = current.indexOf(groupId);
        if (idx < 0) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= current.length) return;
        // Swap
        [current[idx], current[newIdx]] = [current[newIdx], current[idx]];
        updateOverride({ groupOrder: current as EntityGroup[] });
    };

    if (!room || !loaded) return null;

    // Render an entity row
    const renderEntityRow = (entity: any, groupId: string) => {
        const displayName = override.nameOverrides[entity.entity_id] || entity.attributes.friendly_name || entity.entity_id;
        const currentType = override.entityDisplayTypes?.[entity.entity_id] || 'auto';
        const typeLabel = DISPLAY_TYPE_OPTIONS.find(t => t.key === currentType)?.label || 'Auto';
        return (
            <View key={entity.entity_id} style={[modalStyles.entityRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[modalStyles.entityName, { color: colors.text }]} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <Text style={[modalStyles.entityId, { color: colors.subtext }]} numberOfLines={1}>
                        {entity.entity_id}
                    </Text>
                    <Pressable
                        onPress={() => setTypingEntityId(entity.entity_id)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 4,
                            backgroundColor: colors.accent + '15',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            alignSelf: 'flex-start',
                            borderWidth: 1,
                            borderColor: colors.accent + '30',
                        }}
                    >
                        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                            Typ: {typeLabel}
                        </Text>
                        <ChevronDown size={12} color={colors.accent} />
                    </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable onPress={() => setAssigningEntityId(entity.entity_id)} style={[modalStyles.actionBtn, { backgroundColor: colors.accent + '15' }]}>
                        <ArrowRightLeft size={14} color={colors.accent} />
                    </Pressable>
                    <Pressable onPress={() => handleRenameEntity(entity.entity_id)} style={[modalStyles.actionBtn, { backgroundColor: colors.accent + '15' }]}>
                        <Edit3 size={14} color={colors.accent} />
                    </Pressable>
                    <Pressable onPress={() => handleRemoveEntity(entity.entity_id)} style={[modalStyles.actionBtn, { backgroundColor: colors.error + '15' }]}>
                        <Trash2 size={14} color={colors.error} />
                    </Pressable>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={[modalStyles.overlay]}>
                <View style={[modalStyles.container, { backgroundColor: colors.background }]}>
                    {/* Header */}
                    <View style={[modalStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                        <Text style={[modalStyles.headerTitle, { color: colors.text }]}>
                            {room.name} bearbeiten
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {dirty && (
                                <Pressable onPress={handleSave} style={[modalStyles.headerBtn, { backgroundColor: colors.accent }]}>
                                    <Save size={20} color="#FFF" />
                                </Pressable>
                            )}
                            <Pressable onPress={() => {
                                if (dirty) {
                                    Alert.alert('Änderungen verwerfen?', 'Nicht gespeicherte Änderungen gehen verloren.', [
                                        { text: 'Abbrechen', style: 'cancel' },
                                        { text: 'Verwerfen', style: 'destructive', onPress: onClose }
                                    ]);
                                } else {
                                    onClose();
                                }
                            }} style={[modalStyles.headerBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                                <X size={20} color={colors.text} />
                            </Pressable>
                        </View>
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                        {/* Groups (predefined + custom) */}
                        {orderedGroupIds.map((groupId, groupIndex) => {
                            const entities = roomEntities[groupId] || [];
                            const isHidden = override.hiddenGroups.includes(groupId);
                            const isExpanded = expandedGroup === groupId;
                            const isCustom = override.customGroups.some(g => g.id === groupId);
                            const Icon = GROUP_ICONS[groupId] || GripVertical;
                            const label = getGroupLabel(groupId);
                            const isFirst = groupIndex === 0;
                            const isLast = groupIndex === orderedGroupIds.length - 1;

                            // Hide empty predefined groups unless they are hidden (so user can unhide)
                            if (entities.length === 0 && !isHidden && !isCustom) return null;

                            return (
                                <View key={groupId} style={[modalStyles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Pressable
                                        onPress={() => setExpandedGroup(isExpanded ? null : groupId)}
                                        style={modalStyles.groupHeader}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <Icon size={18} color={isHidden ? colors.subtext : colors.accent} />
                                            <Text style={[modalStyles.groupTitle, { color: isHidden ? colors.subtext : colors.text }]}>
                                                {label} ({entities.length})
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            {/* Move up/down */}
                                            <Pressable
                                                onPress={(e) => { e.stopPropagation(); handleMoveGroup(groupId, 'up'); }}
                                                style={[modalStyles.miniBtn, { backgroundColor: colors.background, opacity: isFirst ? 0.3 : 1 }]}
                                                disabled={isFirst}
                                            >
                                                <ArrowUp size={12} color={colors.subtext} />
                                            </Pressable>
                                            <Pressable
                                                onPress={(e) => { e.stopPropagation(); handleMoveGroup(groupId, 'down'); }}
                                                style={[modalStyles.miniBtn, { backgroundColor: colors.background, opacity: isLast ? 0.3 : 1 }]}
                                                disabled={isLast}
                                            >
                                                <ArrowDown size={12} color={colors.subtext} />
                                            </Pressable>
                                            <Pressable
                                                onPress={(e) => { e.stopPropagation(); handleRenameGroup(groupId); }}
                                                style={[modalStyles.miniBtn, { backgroundColor: colors.accent + '15' }]}
                                            >
                                                <Edit3 size={12} color={colors.accent} />
                                            </Pressable>
                                            <Pressable
                                                onPress={(e) => { e.stopPropagation(); handleDeleteGroup(groupId); }}
                                                style={[modalStyles.miniBtn, { backgroundColor: colors.error + '15' }]}
                                            >
                                                <Trash2 size={12} color={colors.error} />
                                            </Pressable>
                                            <Pressable
                                                onPress={(e) => { e.stopPropagation(); handleToggleGroup(groupId); }}
                                                style={[modalStyles.toggleBtn, { backgroundColor: isHidden ? colors.error + '20' : colors.success + '20' }]}
                                            >
                                                <Text style={{ color: isHidden ? colors.error : colors.success, fontSize: 11, fontWeight: '600' }}>
                                                    {isHidden ? 'Aus' : 'An'}
                                                </Text>
                                            </Pressable>
                                            {isExpanded ? <ChevronUp size={16} color={colors.subtext} /> : <ChevronDown size={16} color={colors.subtext} />}
                                        </View>
                                    </Pressable>

                                    {isExpanded && !isHidden && (
                                        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                                            {entities.length === 0 ? (
                                                <Text style={{ color: colors.subtext, fontSize: 13, fontStyle: 'italic', paddingVertical: 8 }}>
                                                    Keine Entities in dieser Gruppe
                                                </Text>
                                            ) : (
                                                entities.map((entity: any) => renderEntityRow(entity, groupId))
                                            )}
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        {/* New Group Button */}
                        {!showNewGroup ? (
                            <Pressable
                                onPress={() => setShowNewGroup(true)}
                                style={[modalStyles.groupCard, { backgroundColor: colors.card, borderColor: colors.accent + '40', borderStyle: 'dashed' }]}
                            >
                                <View style={[modalStyles.groupHeader, { justifyContent: 'center' }]}>
                                    <Plus size={18} color={colors.accent} />
                                    <Text style={[modalStyles.groupTitle, { color: colors.accent }]}>Neue Gruppe erstellen</Text>
                                </View>
                            </Pressable>
                        ) : (
                            <View style={[modalStyles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={{ padding: 14 }}>
                                    <Text style={[modalStyles.groupTitle, { color: colors.text, marginLeft: 0, marginBottom: 8 }]}>Neue Gruppe</Text>
                                    <TextInput
                                        value={newGroupName}
                                        onChangeText={setNewGroupName}
                                        placeholder="Gruppenname..."
                                        placeholderTextColor={colors.subtext}
                                        style={[modalStyles.renameInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                                        autoFocus
                                    />
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                        <Pressable onPress={() => { setShowNewGroup(false); setNewGroupName(''); }} style={[modalStyles.renameBtn, { backgroundColor: colors.background }]}>
                                            <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                                        </Pressable>
                                        <Pressable onPress={handleCreateGroup} style={[modalStyles.renameBtn, { backgroundColor: colors.accent }]}>
                                            <Plus size={16} color="#FFF" />
                                            <Text style={{ color: '#FFF', fontWeight: '600', marginLeft: 4 }}>Erstellen</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Removed Entities restore section */}
                        {override.removedEntities.length > 0 && (
                            <View style={[modalStyles.groupCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
                                <View style={modalStyles.groupHeader}>
                                    <Text style={[modalStyles.groupTitle, { color: colors.subtext, marginLeft: 0 }]}>
                                        Ausgeblendete Entities ({override.removedEntities.length})
                                    </Text>
                                </View>
                                <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                                    {[...new Set(override.removedEntities)].map(id => (
                                        <View key={id} style={[modalStyles.entityRow, { borderBottomColor: colors.border }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[modalStyles.entityName, { color: colors.subtext }]} numberOfLines={1}>
                                                    {findFriendlyName(id)}
                                                </Text>
                                                <Text style={[modalStyles.entityId, { color: colors.subtext }]} numberOfLines={1}>{id}</Text>
                                            </View>
                                            <Pressable onPress={() => handleRestoreEntity(id)} style={[modalStyles.actionBtn, { backgroundColor: colors.success + '15' }]}>
                                                <Plus size={14} color={colors.success} />
                                            </Pressable>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Add Entity Section */}
                        <View style={[modalStyles.groupCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
                            <Pressable
                                onPress={() => setShowAddEntity(!showAddEntity)}
                                style={modalStyles.groupHeader}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <Plus size={18} color={colors.accent} />
                                    <Text style={[modalStyles.groupTitle, { color: colors.accent }]}>
                                        Entity hinzufügen
                                    </Text>
                                </View>
                                {showAddEntity ? <ChevronUp size={16} color={colors.subtext} /> : <ChevronDown size={16} color={colors.subtext} />}
                            </Pressable>

                            {showAddEntity && (
                                <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, marginBottom: 8 }}>
                                        <Search size={16} color={colors.subtext} />
                                        <TextInput
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                            placeholder="Entity suchen..."
                                            placeholderTextColor={colors.subtext}
                                            style={[modalStyles.addEntitySearchInput, { color: colors.text }]}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        {searchQuery.length > 0 && (
                                            <Pressable onPress={() => setSearchQuery('')}>
                                                <X size={16} color={colors.subtext} />
                                            </Pressable>
                                        )}
                                    </View>

                                    {searchQuery.length > 0 && filteredAddEntities.length === 0 && (
                                        <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                                            Keine passenden Entities gefunden
                                        </Text>
                                    )}

                                    {filteredAddEntities.map(entity => (
                                        <View key={entity.entity_id} style={[modalStyles.entityRow, { borderBottomColor: colors.border }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[modalStyles.entityName, { color: colors.text }]} numberOfLines={1}>
                                                    {entity.attributes.friendly_name || entity.entity_id}
                                                </Text>
                                                <Text style={[modalStyles.entityId, { color: colors.subtext }]} numberOfLines={1}>
                                                    {entity.entity_id}
                                                </Text>
                                            </View>
                                            <Pressable onPress={() => handleAddEntity(entity.entity_id)} style={[modalStyles.actionBtn, { backgroundColor: colors.accent + '15' }]}>
                                                <Plus size={16} color={colors.accent} />
                                            </Pressable>
                                        </View>
                                    ))}

                                    {/* Show already added extra entities */}
                                    {override.extraEntities.length > 0 && (
                                        <View style={{ marginTop: 8 }}>
                                            <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                                                Hinzugefügt ({override.extraEntities.length})
                                            </Text>
                                            {override.extraEntities.map(id => {
                                                const entity = allEntities.find(e => e.entity_id === id);
                                                return (
                                                    <View key={id} style={[modalStyles.entityRow, { borderBottomColor: colors.border }]}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[modalStyles.entityName, { color: colors.text }]} numberOfLines={1}>
                                                                {entity?.attributes.friendly_name || id}
                                                            </Text>
                                                            <Text style={[modalStyles.entityId, { color: colors.subtext }]} numberOfLines={1}>{id}</Text>
                                                        </View>
                                                        <Pressable onPress={() => handleRemoveExtra(id)} style={[modalStyles.actionBtn, { backgroundColor: colors.error + '15' }]}>
                                                            <Trash2 size={14} color={colors.error} />
                                                        </Pressable>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>

            {/* Rename Entity Modal */}
            <Modal visible={!!editingEntityId} transparent animationType="fade" onRequestClose={() => setEditingEntityId(null)}>
                <View style={[modalStyles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[modalStyles.renameCard, { backgroundColor: colors.card }]}>
                        <Text style={[modalStyles.renameTitle, { color: colors.text }]}>Anzeigename bearbeiten</Text>
                        <Text style={[modalStyles.entityId, { color: colors.subtext, marginBottom: 12 }]}>{editingEntityId}</Text>
                        <TextInput
                            value={editingName}
                            onChangeText={setEditingName}
                            placeholder="Neuer Anzeigename..."
                            placeholderTextColor={colors.subtext}
                            style={[modalStyles.renameInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                            <Pressable onPress={() => setEditingEntityId(null)} style={[modalStyles.renameBtn, { backgroundColor: colors.background }]}>
                                <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                            </Pressable>
                            <Pressable onPress={confirmRename} style={[modalStyles.renameBtn, { backgroundColor: colors.accent }]}>
                                <Check size={16} color="#FFF" />
                                <Text style={{ color: '#FFF', fontWeight: '600', marginLeft: 4 }}>Speichern</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Rename Group Modal */}
            <Modal visible={!!editingGroupId} transparent animationType="fade" onRequestClose={() => setEditingGroupId(null)}>
                <View style={[modalStyles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[modalStyles.renameCard, { backgroundColor: colors.card }]}>
                        <Text style={[modalStyles.renameTitle, { color: colors.text }]}>Gruppe umbenennen</Text>
                        <TextInput
                            value={editingGroupName}
                            onChangeText={setEditingGroupName}
                            placeholder="Neuer Name..."
                            placeholderTextColor={colors.subtext}
                            style={[modalStyles.renameInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                            <Pressable onPress={() => setEditingGroupId(null)} style={[modalStyles.renameBtn, { backgroundColor: colors.background }]}>
                                <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                            </Pressable>
                            <Pressable onPress={confirmGroupRename} style={[modalStyles.renameBtn, { backgroundColor: colors.accent }]}>
                                <Check size={16} color="#FFF" />
                                <Text style={{ color: '#FFF', fontWeight: '600', marginLeft: 4 }}>Speichern</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Assign Entity to Group Modal */}
            <Modal visible={!!assigningEntityId} transparent animationType="fade" onRequestClose={() => setAssigningEntityId(null)}>
                <View style={[modalStyles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[modalStyles.renameCard, { backgroundColor: colors.card, maxHeight: '70%' }]}>
                        <Text style={[modalStyles.renameTitle, { color: colors.text }]}>Gruppe zuweisen</Text>
                        <Text style={[modalStyles.entityId, { color: colors.subtext, marginBottom: 4 }]}>
                            {assigningEntityId ? findFriendlyName(assigningEntityId) : ''}
                        </Text>
                        <Text style={[modalStyles.entityId, { color: colors.subtext, marginBottom: 12 }]}>
                            {assigningEntityId}
                        </Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {existingGroupIds.map(gId => {
                                const label = getGroupLabel(gId);
                                const isCurrentGroup = assigningEntityId
                                    ? (override.groupOverrides[assigningEntityId] || getGroupForEntity(assigningEntityId)) === gId
                                    : false;
                                return (
                                    <Pressable
                                        key={gId}
                                        onPress={() => assigningEntityId && handleAssignEntityToGroup(assigningEntityId, gId)}
                                        style={[
                                            modalStyles.groupPickerRow,
                                            {
                                                backgroundColor: isCurrentGroup ? colors.accent + '20' : colors.background,
                                                borderColor: isCurrentGroup ? colors.accent : colors.border,
                                            }
                                        ]}
                                    >
                                        <Text style={{ color: isCurrentGroup ? colors.accent : colors.text, fontWeight: isCurrentGroup ? '700' : '500', fontSize: 14 }}>
                                            {label}
                                        </Text>
                                        {isCurrentGroup && <Check size={16} color={colors.accent} />}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        <Pressable onPress={() => setAssigningEntityId(null)} style={[modalStyles.renameBtn, { backgroundColor: colors.background, marginTop: 12 }]}>
                            <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Entity Display Type Picker Modal */}
            <Modal visible={!!typingEntityId} transparent animationType="fade" onRequestClose={() => setTypingEntityId(null)}>
                <View style={[modalStyles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[modalStyles.renameCard, { backgroundColor: colors.card, maxHeight: '70%' }]}>
                        <Text style={[modalStyles.renameTitle, { color: colors.text }]}>Anzeige-Typ wählen</Text>
                        <Text style={[modalStyles.entityId, { color: colors.subtext, marginBottom: 4 }]}>
                            {typingEntityId ? findFriendlyName(typingEntityId) : ''}
                        </Text>
                        <Text style={[modalStyles.entityId, { color: colors.subtext, marginBottom: 12 }]}>
                            {typingEntityId}
                        </Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {DISPLAY_TYPE_OPTIONS.map(opt => {
                                const isCurrent = typingEntityId
                                    ? (override.entityDisplayTypes?.[typingEntityId] || 'auto') === opt.key
                                    : false;
                                return (
                                    <Pressable
                                        key={opt.key}
                                        onPress={() => {
                                            if (typingEntityId) {
                                                const newTypes = { ...override.entityDisplayTypes };
                                                if (opt.key === 'auto') {
                                                    delete newTypes[typingEntityId];
                                                } else {
                                                    newTypes[typingEntityId] = opt.key;
                                                }
                                                updateOverride({ entityDisplayTypes: newTypes });
                                            }
                                            setTypingEntityId(null);
                                        }}
                                        style={[
                                            modalStyles.groupPickerRow,
                                            {
                                                backgroundColor: isCurrent ? colors.accent + '20' : colors.background,
                                                borderColor: isCurrent ? colors.accent : colors.border,
                                            }
                                        ]}
                                    >
                                        <Text style={{ color: isCurrent ? colors.accent : colors.text, fontWeight: isCurrent ? '700' : '500', fontSize: 14 }}>
                                            {opt.label}
                                        </Text>
                                        {isCurrent && <Check size={16} color={colors.accent} />}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        <Pressable onPress={() => setTypingEntityId(null)} style={[modalStyles.renameBtn, { backgroundColor: colors.background, marginTop: 12 }]}>
                            <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Add Entity → Pick Group Modal */}
            <Modal visible={!!pendingAddEntityId} transparent animationType="fade" onRequestClose={() => setPendingAddEntityId(null)}>
                <View style={[modalStyles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[modalStyles.renameCard, { backgroundColor: colors.card, maxHeight: '70%' }]}>
                        <Text style={[modalStyles.renameTitle, { color: colors.text }]}>Zu welcher Gruppe?</Text>
                        <Text style={[modalStyles.entityId, { color: colors.subtext, marginBottom: 4 }]}>
                            {pendingAddEntityId ? (allEntities.find(e => e.entity_id === pendingAddEntityId)?.attributes.friendly_name || pendingAddEntityId) : ''}
                        </Text>
                        <Text style={[modalStyles.entityId, { color: colors.subtext, marginBottom: 12 }]}>
                            {pendingAddEntityId}
                        </Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {existingGroupIds.map(gId => {
                                const label = getGroupLabel(gId);
                                return (
                                    <Pressable
                                        key={gId}
                                        onPress={() => confirmAddEntityToGroup(gId)}
                                        style={[
                                            modalStyles.groupPickerRow,
                                            { backgroundColor: colors.background, borderColor: colors.border }
                                        ]}
                                    >
                                        <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>
                                            {label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        <Pressable onPress={() => setPendingAddEntityId(null)} style={[modalStyles.renameBtn, { backgroundColor: colors.background, marginTop: 12 }]}>
                            <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

// ========================================================
// Styles
// ========================================================

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    container: {
        flex: 1,
        marginTop: 60,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupCard: {
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        overflow: 'hidden',
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
    },
    groupTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 10,
    },
    toggleBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    miniBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    entityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    entityName: {
        fontSize: 14,
        fontWeight: '500',
    },
    entityId: {
        fontSize: 11,
        marginTop: 2,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    renameCard: {
        margin: 24,
        padding: 24,
        borderRadius: 20,
        alignSelf: 'center',
        width: '90%',
        maxWidth: 400,
        marginTop: 'auto',
        marginBottom: 'auto',
    },
    renameTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    renameInput: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 16,
    },
    renameBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    addEntitySearchInput: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        fontSize: 14,
    },
    groupPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
});

import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, Switch, TextInput } from 'react-native';
import { X, Speaker, Tv, Users as UsersIcon, Pencil, Check } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';
import { MEDIA_PLAYER_CONFIG } from '../config/mediaPlayers';

export type PlayerType = 'speaker' | 'tv' | 'group';

interface MediaPlayerSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onUpdateSelection?: () => void;
}

// Keep exported keys for backward compatibility during migration
export const PLAYER_TYPES_KEY = '@smarthome_media_player_types';

const TYPE_OPTIONS: { value: PlayerType; label: string; icon: any; color: string }[] = [
    { value: 'group', label: 'Gruppe', icon: UsersIcon, color: '#F59E0B' },
    { value: 'speaker', label: 'Speaker', icon: Speaker, color: '#3B82F6' },
    { value: 'tv', label: 'TV', icon: Tv, color: '#8B5CF6' },
];

export function MediaPlayerSelectionModal({ visible, onClose, onUpdateSelection }: MediaPlayerSelectionModalProps) {
    const { entities, dashboardConfig, saveDashboardConfig } = useHomeAssistant();
    const { colors } = useTheme();
    const [visiblePlayers, setVisiblePlayers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [customNames, setCustomNames] = useState<Record<string, string>>({});
    const [playerTypes, setPlayerTypes] = useState<Record<string, PlayerType>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (visible) {
            loadData();
        }
    }, [visible]);

    const loadData = async () => {
        try {
            const config = dashboardConfig?.mediaPlayerConfig;

            if (config?.visiblePlayers) {
                setVisiblePlayers(config.visiblePlayers);
            } else {
                // Default: show all available players
                const allPlayers = entities.filter(e => e.entity_id.startsWith('media_player.'));
                setVisiblePlayers(allPlayers.map(e => e.entity_id));
            }

            if (config?.customNames) {
                setCustomNames(config.customNames);
            }

            if (config?.playerTypes) {
                setPlayerTypes(config.playerTypes);
            } else {
                // Migrate from hardcoded config as initial defaults
                const migrated: Record<string, PlayerType> = {};
                for (const [id, cfg] of Object.entries(MEDIA_PLAYER_CONFIG)) {
                    if (cfg.isGroup) {
                        migrated[id] = 'group';
                    } else {
                        migrated[id] = cfg.type;
                    }
                }
                setPlayerTypes(migrated);
            }
        } catch (e) {
            console.warn('Failed to load player data', e);
        } finally {
            setLoading(false);
        }
    };

    // Helper to persist current state to Supabase dashboardConfig
    const persistConfig = async (
        newVisible?: string[],
        newNames?: Record<string, string>,
        newTypes?: Record<string, PlayerType>
    ) => {
        const mediaPlayerConfig = {
            visiblePlayers: newVisible ?? visiblePlayers,
            customNames: newNames ?? customNames,
            playerTypes: newTypes ?? playerTypes,
        };
        const updatedConfig = { ...dashboardConfig, mediaPlayerConfig };
        await saveDashboardConfig(updatedConfig);
    };

    const saveCustomName = async (entityId: string, newName: string) => {
        const updatedNames = { ...customNames, [entityId]: newName };
        setCustomNames(updatedNames);
        setEditingId(null);
        await persistConfig(undefined, updatedNames, undefined);
        if (onUpdateSelection) onUpdateSelection();
    };

    const saveVisiblePlayers = async (newVisible: string[]) => {
        setVisiblePlayers(newVisible);
        await persistConfig(newVisible, undefined, undefined);
        if (onUpdateSelection) onUpdateSelection();
    };

    const toggleVisibility = (entityId: string) => {
        if (visiblePlayers.includes(entityId)) {
            saveVisiblePlayers(visiblePlayers.filter(id => id !== entityId));
        } else {
            saveVisiblePlayers([...visiblePlayers, entityId]);
        }
    };

    const setPlayerType = async (entityId: string, type: PlayerType) => {
        const updated = { ...playerTypes, [entityId]: type };
        setPlayerTypes(updated);
        await persistConfig(undefined, undefined, updated);
        if (onUpdateSelection) onUpdateSelection();
    };

    const getPlayerType = (entityId: string): PlayerType => {
        if (playerTypes[entityId]) return playerTypes[entityId];
        // Fallback to hardcoded config for migration
        const cfg = MEDIA_PLAYER_CONFIG[entityId];
        if (cfg?.isGroup) return 'group';
        if (cfg?.type === 'tv') return 'tv';
        return 'speaker';
    };

    const allPlayers = entities.filter(e => e.entity_id.startsWith('media_player.'));

    allPlayers.sort((a, b) => {
        const nameA = customNames[a.entity_id] || MEDIA_PLAYER_CONFIG[a.entity_id]?.name || a.attributes.friendly_name || a.entity_id;
        const nameB = customNames[b.entity_id] || MEDIA_PLAYER_CONFIG[b.entity_id]?.name || b.attributes.friendly_name || b.entity_id;
        return nameA.localeCompare(nameB);
    });

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Medienplayer verwalten</Text>
                    <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.card }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <View style={{ padding: 16 }}>
                    <Text style={{ color: colors.subtext }}>
                        Wähle aus, welche Lautsprecher angezeigt werden und ordne sie einer Gruppe zu.
                    </Text>
                </View>

                <ScrollView style={styles.modalContent}>
                    {loading ? (
                        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
                    ) : (
                        <>
                            {allPlayers.map((player) => {
                                const name = MEDIA_PLAYER_CONFIG[player.entity_id]?.name || player.attributes.friendly_name || player.entity_id;
                                const isVisible = visiblePlayers.includes(player.entity_id);
                                const currentType = getPlayerType(player.entity_id);

                                return (
                                    <View key={player.entity_id} style={[styles.row, { borderBottomColor: colors.border }]}>
                                        {/* Top: Name + Visibility Switch */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                                                {currentType === 'tv' ? (
                                                    <Tv size={20} color={isVisible ? '#8B5CF6' : colors.subtext} />
                                                ) : currentType === 'group' ? (
                                                    <UsersIcon size={20} color={isVisible ? '#F59E0B' : colors.subtext} />
                                                ) : (
                                                    <Speaker size={20} color={isVisible ? colors.accent : colors.subtext} />
                                                )}
                                                <View style={{ flex: 1 }}>
                                                    {editingId === player.entity_id ? (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <TextInput
                                                                style={{
                                                                    flex: 1, color: colors.text, fontSize: 16,
                                                                    borderBottomWidth: 1, borderBottomColor: colors.accent, paddingVertical: 4
                                                                }}
                                                                value={editName}
                                                                onChangeText={setEditName}
                                                                autoFocus
                                                                onSubmitEditing={() => saveCustomName(player.entity_id, editName)}
                                                            />
                                                            <Pressable onPress={() => saveCustomName(player.entity_id, editName)}>
                                                                <Check size={20} color={colors.accent} />
                                                            </Pressable>
                                                        </View>
                                                    ) : (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <Text style={[styles.label, { color: colors.text }]}>{customNames[player.entity_id] || name}</Text>
                                                            <Pressable
                                                                onPress={() => {
                                                                    setEditingId(player.entity_id);
                                                                    setEditName(customNames[player.entity_id] || name);
                                                                }}
                                                                hitSlop={8}
                                                            >
                                                                <Pencil size={14} color={colors.subtext} />
                                                            </Pressable>
                                                        </View>
                                                    )}
                                                    <Text style={{ fontSize: 12, color: colors.subtext }}>{player.entity_id}</Text>
                                                </View>
                                            </View>
                                            <Switch
                                                value={isVisible}
                                                onValueChange={() => toggleVisibility(player.entity_id)}
                                                trackColor={{ false: colors.border, true: colors.accent }}
                                                thumbColor="#fff"
                                                ios_backgroundColor={colors.border}
                                            />
                                        </View>

                                        {/* Bottom: Type Selector Pills */}
                                        {isVisible && (
                                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingLeft: 32 }}>
                                                {TYPE_OPTIONS.map(opt => {
                                                    const isActive = currentType === opt.value;
                                                    const IconComp = opt.icon;
                                                    return (
                                                        <Pressable
                                                            key={opt.value}
                                                            onPress={() => setPlayerType(player.entity_id, opt.value)}
                                                            style={{
                                                                flexDirection: 'row', alignItems: 'center', gap: 6,
                                                                paddingHorizontal: 12, paddingVertical: 6,
                                                                borderRadius: 20,
                                                                backgroundColor: isActive ? opt.color + '20' : 'transparent',
                                                                borderWidth: 1,
                                                                borderColor: isActive ? opt.color : colors.border,
                                                            }}
                                                        >
                                                            <IconComp size={14} color={isActive ? opt.color : colors.subtext} />
                                                            <Text style={{ fontSize: 12, fontWeight: isActive ? '700' : '500', color: isActive ? opt.color : colors.subtext }}>
                                                                {opt.label}
                                                            </Text>
                                                        </Pressable>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </>
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: 20,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 8,
        borderRadius: 20,
    },
    modalContent: {
        flex: 1,
    },
    row: {
        padding: 16,
        borderBottomWidth: 1,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
    },
});

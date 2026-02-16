import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, Switch, TextInput } from 'react-native';
import { X, Speaker, Pencil, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';
import { MEDIA_PLAYER_CONFIG } from '../config/mediaPlayers';

interface MediaPlayerSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onUpdateSelection?: () => void;
}

export function MediaPlayerSelectionModal({ visible, onClose, onUpdateSelection }: MediaPlayerSelectionModalProps) {
    const { entities } = useHomeAssistant();
    const { colors } = useTheme();
    const [visiblePlayers, setVisiblePlayers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [customNames, setCustomNames] = useState<Record<string, string>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const VISIBLE_PLAYERS_KEY = '@smarthome_visible_media_players';
    const CUSTOM_NAMES_KEY = '@smarthome_media_player_names';

    useEffect(() => {
        if (visible) {
            loadData();
        }
    }, [visible]);

    const loadData = async () => {
        try {
            const [visibleStored, namesStored] = await Promise.all([
                AsyncStorage.getItem(VISIBLE_PLAYERS_KEY),
                AsyncStorage.getItem(CUSTOM_NAMES_KEY)
            ]);

            if (visibleStored) {
                setVisiblePlayers(JSON.parse(visibleStored));
            } else {
                const allPlayers = entities.filter(e => e.entity_id.startsWith('media_player.'));
                setVisiblePlayers(allPlayers.map(e => e.entity_id));
            }

            if (namesStored) {
                setCustomNames(JSON.parse(namesStored));
            }
        } catch (e) {
            console.warn('Failed to load player data', e);
        } finally {
            setLoading(false);
        }
    };

    const saveCustomName = async (entityId: string, newName: string) => {
        const updatedNames = { ...customNames, [entityId]: newName };
        setCustomNames(updatedNames);
        await AsyncStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(updatedNames));
        setEditingId(null);
        if (onUpdateSelection) onUpdateSelection();
    };

    const saveVisiblePlayers = async (newVisible: string[]) => {
        setVisiblePlayers(newVisible);
        await AsyncStorage.setItem(VISIBLE_PLAYERS_KEY, JSON.stringify(newVisible));
        if (onUpdateSelection) {
            onUpdateSelection();
        }
    };

    const toggleVisibility = (entityId: string) => {
        if (visiblePlayers.includes(entityId)) {
            saveVisiblePlayers(visiblePlayers.filter(id => id !== entityId));
        } else {
            saveVisiblePlayers([...visiblePlayers, entityId]);
        }
    };

    const allPlayers = entities.filter(e => e.entity_id.startsWith('media_player.'));

    // Sort alphabetically by friendly name (using custom name if available)
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
                        Wähle aus, welche Lautsprecher in der Liste angezeigt werden sollen.
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

                                return (
                                    <View key={player.entity_id} style={[styles.row, { borderBottomColor: colors.border }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                                            <Speaker size={20} color={isVisible ? colors.accent : colors.subtext} />
                                            <View style={{ flex: 1 }}>
                                                {editingId === player.entity_id ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <TextInput
                                                            style={{
                                                                flex: 1,
                                                                color: colors.text,
                                                                fontSize: 16,
                                                                borderBottomWidth: 1,
                                                                borderBottomColor: colors.accent,
                                                                paddingVertical: 4
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
    },
});

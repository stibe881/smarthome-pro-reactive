import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, Switch, TextInput, Alert } from 'react-native';
import { X, Zap, Search, Pencil } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';

interface AutomationsModalProps {
    visible: boolean;
    onClose: () => void;
}

export function AutomationsModal({ visible, onClose }: AutomationsModalProps) {
    const { entities, callService } = useHomeAssistant();
    const { colors } = useTheme();
    const [visibleAutomations, setVisibleAutomations] = useState<string[]>([]);
    const [showSelection, setShowSelection] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    // Custom friendly names
    const [customNames, setCustomNames] = useState<Record<string, string>>({});
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [renameTarget, setRenameTarget] = useState<{ entityId: string; currentName: string } | null>(null);
    const [renameInput, setRenameInput] = useState('');

    const VISIBLE_AUTOMATIONS_KEY = '@smarthome_visible_automations';
    const CUSTOM_NAMES_KEY = '@smarthome_automation_names';

    useEffect(() => {
        if (visible) {
            loadVisibleAutomations();
            loadCustomNames();
            setSearchQuery('');
        }
    }, [visible]);

    const loadVisibleAutomations = async () => {
        try {
            const stored = await AsyncStorage.getItem(VISIBLE_AUTOMATIONS_KEY);
            if (stored) {
                setVisibleAutomations(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load visible automations', e);
        } finally {
            setLoading(false);
        }
    };

    const loadCustomNames = async () => {
        try {
            const stored = await AsyncStorage.getItem(CUSTOM_NAMES_KEY);
            if (stored) {
                setCustomNames(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load custom names', e);
        }
    };

    const saveCustomNames = async (names: Record<string, string>) => {
        setCustomNames(names);
        await AsyncStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(names));
    };

    const saveVisibleAutomations = async (newVisible: string[]) => {
        setVisibleAutomations(newVisible);
        await AsyncStorage.setItem(VISIBLE_AUTOMATIONS_KEY, JSON.stringify(newVisible));
    };

    const toggleVisibility = (entityId: string) => {
        if (visibleAutomations.includes(entityId)) {
            saveVisibleAutomations(visibleAutomations.filter(id => id !== entityId));
        } else {
            saveVisibleAutomations([...visibleAutomations, entityId]);
        }
    };

    const toggleAutomationState = (entityId: string, currentState: string) => {
        const newState = currentState === 'on' ? 'off' : 'on';
        callService('automation', newState === 'on' ? 'turn_on' : 'turn_off', entityId);
    };

    const getDisplayName = (automation: any): string => {
        return customNames[automation.entity_id] || automation.attributes.friendly_name || automation.entity_id;
    };

    const openRename = (automation: any) => {
        setRenameTarget({ entityId: automation.entity_id, currentName: getDisplayName(automation) });
        setRenameInput(customNames[automation.entity_id] || automation.attributes.friendly_name || '');
        setRenameModalVisible(true);
    };

    const handleRenameSave = () => {
        if (!renameTarget) return;
        const trimmed = renameInput.trim();
        if (trimmed.length === 0) {
            // Remove custom name (reset to HA default)
            const updated = { ...customNames };
            delete updated[renameTarget.entityId];
            saveCustomNames(updated);
        } else {
            saveCustomNames({ ...customNames, [renameTarget.entityId]: trimmed });
        }
        setRenameModalVisible(false);
        setRenameTarget(null);
    };

    const handleRenameReset = () => {
        if (!renameTarget) return;
        const updated = { ...customNames };
        delete updated[renameTarget.entityId];
        saveCustomNames(updated);
        setRenameModalVisible(false);
        setRenameTarget(null);
    };

    // Filter automation entities
    const allAutomations = entities.filter(e => e.entity_id.startsWith('automation.'));

    // Sort alphabetically by display name
    allAutomations.sort((a, b) => {
        const nameA = getDisplayName(a);
        const nameB = getDisplayName(b);
        return nameA.localeCompare(nameB);
    });

    const displayedAutomations = showSelection
        ? allAutomations
        : allAutomations.filter(e => visibleAutomations.includes(e.entity_id));

    // Apply search filter
    const filteredAutomations = searchQuery.trim()
        ? displayedAutomations.filter(e => {
            const name = getDisplayName(e).toLowerCase();
            return name.includes(searchQuery.toLowerCase());
        })
        : displayedAutomations;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Automationen</Text>
                    <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.card }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                {/* Search Bar */}
                <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.card,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: 12,
                        gap: 8,
                    }}>
                        <Search size={18} color={colors.subtext} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Automation suchen..."
                            placeholderTextColor={colors.subtext}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                fontSize: 15,
                                color: colors.text,
                            }}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')}>
                                <X size={18} color={colors.subtext} />
                            </Pressable>
                        )}
                    </View>
                </View>

                <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: colors.subtext, fontSize: 14 }}>
                        {showSelection ? 'Wähle Automationen aus:' : `Deine Automationen (${filteredAutomations.length}):`}
                    </Text>
                    <Pressable
                        onPress={() => setShowSelection(!showSelection)}
                        style={{ backgroundColor: colors.card, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                    >
                        <Text style={{ color: colors.accent, fontWeight: '600' }}>
                            {showSelection ? 'Fertig' : 'Verwalten'}
                        </Text>
                    </Pressable>
                </View>

                <ScrollView style={styles.modalContent}>
                    {loading ? (
                        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
                    ) : (
                        <>
                            {filteredAutomations.length === 0 && (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Text style={{ color: colors.subtext, textAlign: 'center' }}>
                                        {searchQuery ? 'Keine Automationen gefunden.' : 'Noch keine Automationen ausgewählt.\nTippe auf "Verwalten".'}
                                    </Text>
                                </View>
                            )}

                            {filteredAutomations.map((automation) => (
                                <View key={automation.entity_id} style={[styles.settingsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                                        <Zap size={20} color={automation.state === 'on' ? colors.success : colors.subtext} />
                                        <Pressable style={{ flex: 1 }} onLongPress={() => openRename(automation)}>
                                            <Text style={[styles.settingsLabel, { color: colors.text }]}>
                                                {getDisplayName(automation)}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.subtext }}>
                                                {showSelection ? automation.entity_id : (automation.state === 'on' ? 'Aktiv' : 'Inaktiv')}
                                            </Text>
                                        </Pressable>
                                    </View>

                                    {showSelection ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Pressable onPress={() => openRename(automation)} style={{ padding: 6 }}>
                                                <Pencil size={16} color={colors.subtext} />
                                            </Pressable>
                                            <Switch
                                                value={visibleAutomations.includes(automation.entity_id)}
                                                onValueChange={() => toggleVisibility(automation.entity_id)}
                                                trackColor={{ false: colors.border, true: colors.accent }}
                                                thumbColor="#fff"
                                                ios_backgroundColor={colors.border}
                                            />
                                        </View>
                                    ) : (
                                        <Switch
                                            value={automation.state === 'on'}
                                            onValueChange={() => toggleAutomationState(automation.entity_id, automation.state)}
                                            trackColor={{ false: colors.border, true: colors.success }}
                                            thumbColor="#fff"
                                            ios_backgroundColor={colors.border}
                                        />
                                    )}
                                </View>
                            ))}
                        </>
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>

            {/* Rename Modal */}
            <Modal visible={renameModalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: 320, gap: 16 }}>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Name ändern</Text>
                        <Text style={{ color: colors.subtext, fontSize: 13 }}>
                            Gib einen eigenen Namen für diese Automation ein. Leer lassen für den Standardnamen.
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderRadius: 8,
                                padding: 12,
                                fontSize: 16,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                            value={renameInput}
                            onChangeText={setRenameInput}
                            autoFocus
                            placeholder={renameTarget?.currentName || 'Name eingeben...'}
                            placeholderTextColor={colors.subtext}
                            returnKeyType="done"
                            onSubmitEditing={handleRenameSave}
                        />
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Pressable
                                onPress={() => { setRenameModalVisible(false); setRenameTarget(null); }}
                                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center' }}
                            >
                                <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                            </Pressable>
                            {customNames[renameTarget?.entityId || ''] && (
                                <Pressable
                                    onPress={handleRenameReset}
                                    style={{ padding: 12, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center', paddingHorizontal: 16 }}
                                >
                                    <Text style={{ color: colors.error, fontWeight: '600' }}>Reset</Text>
                                </Pressable>
                            )}
                            <Pressable
                                onPress={handleRenameSave}
                                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Speichern</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
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
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    settingsLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
});

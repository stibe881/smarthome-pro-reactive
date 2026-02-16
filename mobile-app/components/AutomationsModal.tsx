import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { X, Zap } from 'lucide-react-native';
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

    const VISIBLE_AUTOMATIONS_KEY = '@smarthome_visible_automations';

    useEffect(() => {
        if (visible) {
            loadVisibleAutomations();
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

    // Filter automation entities
    const allAutomations = entities.filter(e => e.entity_id.startsWith('automation.'));

    // Sort logic: active first, then alphabetical? Or just alphabetical.
    // Let's sort alphabetically by friendly_name
    allAutomations.sort((a, b) => {
        const nameA = a.attributes.friendly_name || a.entity_id;
        const nameB = b.attributes.friendly_name || b.entity_id;
        return nameA.localeCompare(nameB);
    });

    const displayedAutomations = showSelection
        ? allAutomations
        : allAutomations.filter(e => visibleAutomations.includes(e.entity_id));

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Automationen</Text>
                    <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.card }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: colors.subtext, fontSize: 14 }}>
                        {showSelection ? 'Wähle Automationen aus:' : 'Deine Automationen:'}
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
                            {displayedAutomations.length === 0 && !showSelection && (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Text style={{ color: colors.subtext, textAlign: 'center' }}>
                                        Noch keine Automationen ausgewählt.{'\n'}Tippe auf "Verwalten".
                                    </Text>
                                </View>
                            )}

                            {displayedAutomations.map((automation) => (
                                <View key={automation.entity_id} style={[styles.settingsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                                        <Zap size={20} color={automation.state === 'on' ? colors.success : colors.subtext} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.settingsLabel, { color: colors.text }]}>
                                                {automation.attributes.friendly_name || automation.entity_id}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.subtext }}>
                                                {showSelection ? automation.entity_id : (automation.state === 'on' ? 'Aktiv' : 'Inaktiv')}
                                            </Text>
                                        </View>
                                    </View>

                                    {showSelection ? (
                                        <Switch
                                            value={visibleAutomations.includes(automation.entity_id)}
                                            onValueChange={() => toggleVisibility(automation.entity_id)}
                                            trackColor={{ false: colors.border, true: colors.accent }}
                                            thumbColor="#fff"
                                            // iOS style
                                            ios_backgroundColor={colors.border}
                                        />
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

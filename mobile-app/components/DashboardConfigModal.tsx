import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native';
import { X, Plus, Trash2, Lightbulb, Blinds, Bot, Shield, Search, Pencil, Check, ChevronUp, ChevronDown, Zap } from 'lucide-react-native';
import { useHomeAssistant, EntityState } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardConfigModalProps {
    visible: boolean;
    onClose: () => void;
}

type SectionType = 'lights' | 'covers' | 'vacuum' | 'alarm' | 'homescreenShortcuts';

const TABS: { key: SectionType; label: string; icon: any; domain: string; single?: boolean; allEntities?: boolean }[] = [
    { key: 'lights', label: 'Lichter', icon: Lightbulb, domain: 'light.' },
    { key: 'covers', label: 'Rollläden', icon: Blinds, domain: 'cover.' },
    { key: 'vacuum', label: 'Saugroboter', icon: Bot, domain: 'vacuum.', single: true },
    { key: 'alarm', label: 'Alarmanlage', icon: Shield, domain: 'alarm_control_panel.', single: true },
    { key: 'homescreenShortcuts', label: 'Shortcuts', icon: Zap, domain: '', allEntities: true },
];

export const DashboardConfigModal = ({ visible, onClose }: DashboardConfigModalProps) => {
    const { colors } = useTheme();
    const { entities, dashboardConfig, saveDashboardConfig } = useHomeAssistant();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState<SectionType>('lights');
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const activeTab = TABS.find(t => t.key === activeSection)!;

    // Filter available entities by domain (or show all if allEntities)
    const availableEntities = useMemo(() => {
        return entities
            .filter(e => activeTab.allEntities ? true : e.entity_id.startsWith(activeTab.domain))
            .filter(e => e.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.attributes.friendly_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id));
    }, [entities, activeTab, searchQuery]);

    // Current config for the section
    const currentMapped = useMemo(() => {
        if (activeTab.single) {
            // For single-select: wrap in array for consistent rendering
            const entityId = dashboardConfig[activeSection];
            if (!entityId) return [];
            const entity = entities.find(e => e.entity_id === entityId);
            return [{ id: entityId, name: entity?.attributes?.friendly_name || entityId }];
        }
        return dashboardConfig[activeSection] || [];
    }, [dashboardConfig, activeSection, entities]);

    const handleAdd = async (entity: EntityState) => {
        const name = entity.attributes.friendly_name || entity.entity_id;

        if (activeTab.single) {
            // Single-select: replace the value
            const newConfig = {
                ...dashboardConfig,
                [activeSection]: entity.entity_id,
            };
            setIsSaving(true);
            try {
                await saveDashboardConfig(newConfig);
            } catch (e) {
                Alert.alert("Fehler", "Konfiguration konnte nicht gespeichert werden.");
            } finally {
                setIsSaving(false);
            }
            return;
        }

        // Multi-select: add to array
        const newEntry = { id: entity.entity_id, name };
        if (currentMapped.find((m: any) => m.id === entity.entity_id)) {
            Alert.alert("Hinweis", "Diese Entität ist bereits zugeordnet.");
            return;
        }

        const newConfig = {
            ...dashboardConfig,
            [activeSection]: [...currentMapped, newEntry]
        };

        setIsSaving(true);
        try {
            await saveDashboardConfig(newConfig);
        } catch (e) {
            Alert.alert("Fehler", "Konfiguration konnte nicht gespeichert werden.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async (id: string) => {
        let newConfig;
        if (activeTab.single) {
            newConfig = { ...dashboardConfig, [activeSection]: null };
        } else {
            newConfig = {
                ...dashboardConfig,
                [activeSection]: currentMapped.filter((m: any) => m.id !== id)
            };
        }

        setIsSaving(true);
        try {
            await saveDashboardConfig(newConfig);
        } catch (e) {
            Alert.alert("Fehler", "Entität konnte nicht entfernt werden.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRename = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        const newConfig = {
            ...dashboardConfig,
            [activeSection]: currentMapped.map((m: any) => m.id === id ? { ...m, name: newName.trim() } : m)
        };
        setIsSaving(true);
        try {
            await saveDashboardConfig(newConfig);
        } catch (e) {
            Alert.alert("Fehler", "Name konnte nicht geändert werden.");
        } finally {
            setIsSaving(false);
            setEditingId(null);
        }
    };

    const handleMove = async (id: string, direction: 'up' | 'down') => {
        const idx = currentMapped.findIndex((m: any) => m.id === id);
        if (idx < 0) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= currentMapped.length) return;
        const arr = [...currentMapped];
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
        const newConfig = { ...dashboardConfig, [activeSection]: arr };
        setIsSaving(true);
        try {
            await saveDashboardConfig(newConfig);
        } catch (e) {
            Alert.alert("Fehler", "Reihenfolge konnte nicht geändert werden.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Dashboard anpassen</Text>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                {/* Tab Bar */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeSection === tab.key;
                        return (
                            <Pressable
                                key={tab.key}
                                onPress={() => { setActiveSection(tab.key); setSearchQuery(''); setEditingId(null); }}
                                style={[styles.tab, active && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
                            >
                                <Icon size={18} color={active ? colors.accent : colors.subtext} />
                                <Text style={[styles.tabText, { color: active ? colors.accent : colors.subtext }]}>{tab.label}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                <View style={styles.content}>
                    {/* Current Config Section */}
                    <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                        {activeTab.single ? 'AUSGEWÄHLTE ENTITÄT' : 'AKTUELLE ZUORDNUNG'}
                    </Text>
                    <ScrollView style={styles.mappedListScroll} nestedScrollEnabled>
                        {currentMapped.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                {activeTab.single ? 'Noch keine Entität ausgewählt.' : 'Noch keine Entitäten zugeordnet.'}
                            </Text>
                        ) : (
                            currentMapped.map((m: any) => (
                                <View key={m.id} style={[styles.mappedItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    {editingId === m.id && !activeTab.single ? (
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <TextInput
                                                value={editName}
                                                onChangeText={setEditName}
                                                autoFocus
                                                style={[styles.renameInput, { color: colors.text, borderColor: colors.accent, backgroundColor: colors.background }]}
                                                onSubmitEditing={() => handleRename(m.id, editName)}
                                            />
                                            <Pressable onPress={() => handleRename(m.id, editName)} style={[styles.confirmBtn, { backgroundColor: colors.accent }]}>
                                                <Check size={16} color="#fff" />
                                            </Pressable>
                                        </View>
                                    ) : (
                                        <>
                                            <Pressable
                                                style={{ flex: 1 }}
                                                onPress={() => {
                                                    if (!activeTab.single) {
                                                        setEditingId(m.id);
                                                        setEditName(m.name);
                                                    }
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[styles.mappedName, { color: colors.text }]}>{m.name}</Text>
                                                    {!activeTab.single && <Pencil size={12} color={colors.subtext} />}
                                                </View>
                                                <Text style={[styles.mappedId, { color: colors.subtext }]}>{m.id}</Text>
                                            </Pressable>
                                            {!activeTab.single && (
                                                <View style={styles.reorderBtns}>
                                                    <Pressable onPress={() => handleMove(m.id, 'up')} style={styles.arrowBtn}>
                                                        <ChevronUp size={16} color={colors.subtext} />
                                                    </Pressable>
                                                    <Pressable onPress={() => handleMove(m.id, 'down')} style={styles.arrowBtn}>
                                                        <ChevronDown size={16} color={colors.subtext} />
                                                    </Pressable>
                                                </View>
                                            )}
                                            <Pressable onPress={() => handleRemove(m.id)} style={styles.removeBtn}>
                                                <Trash2 size={18} color="#EF4444" />
                                            </Pressable>
                                        </>
                                    )}
                                </View>
                            ))
                        )}
                    </ScrollView>

                    {/* Search & Available Entities */}
                    <View style={styles.searchSection}>
                        <Text style={[styles.sectionTitle, { color: colors.subtext, marginTop: 24 }]}>VERFÜGBARE ENTITÄTEN</Text>
                        <View style={[styles.searchWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Search size={18} color={colors.subtext} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Suchen..."
                                placeholderTextColor={colors.subtext}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <ScrollView style={styles.scrollArea}>
                        {availableEntities.map(e => {
                            const isAdded = activeTab.single
                                ? dashboardConfig[activeSection] === e.entity_id
                                : currentMapped.some((m: any) => m.id === e.entity_id);
                            return (
                                <Pressable
                                    key={e.entity_id}
                                    onPress={() => !isAdded && handleAdd(e)}
                                    style={[styles.entityItem, { borderBottomColor: colors.border }]}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.entityName, { color: isAdded ? colors.subtext : colors.text }]}>
                                            {e.attributes.friendly_name || e.entity_id}
                                        </Text>
                                        <Text style={[styles.entityId, { color: colors.subtext }]}>{e.entity_id}</Text>
                                    </View>
                                    {isAdded ? (
                                        <Text style={{ color: colors.success || '#10B981', fontSize: 12 }}>Zugeordnet</Text>
                                    ) : (
                                        <Plus size={18} color={colors.accent} />
                                    )}
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>

                {isSaving && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                )}
            </View>
        </Modal >
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    tabContainer: {
        borderBottomWidth: 1,
        flexGrow: 0,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 6,
    },
    tabText: {
        fontWeight: '600',
        fontSize: 13,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
    },
    mappedListScroll: {
        maxHeight: 200,
    },
    mappedList: {
        gap: 8,
    },
    mappedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    mappedName: {
        fontSize: 15,
        fontWeight: '500',
    },
    mappedId: {
        fontSize: 12,
        marginTop: 2,
    },
    removeBtn: {
        padding: 8,
    },
    reorderBtns: {
        flexDirection: 'column',
        marginRight: 4,
    },
    arrowBtn: {
        padding: 2,
    },
    renameInput: {
        flex: 1,
        fontSize: 15,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    confirmBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchSection: {
        marginTop: 16,
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
    },
    scrollArea: {
        flex: 1,
    },
    entityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    entityName: {
        fontSize: 15,
    },
    entityId: {
        fontSize: 11,
        marginTop: 2,
    },
    emptyText: {
        textAlign: 'center',
        paddingVertical: 20,
        fontSize: 14,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    }
});

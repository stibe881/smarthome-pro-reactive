import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native';
import { X, Plus, Trash2, Lightbulb, Blinds, Search } from 'lucide-react-native';
import { useHomeAssistant, EntityState } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardConfigModalProps {
    visible: boolean;
    onClose: () => void;
}

export const DashboardConfigModal = ({ visible, onClose }: DashboardConfigModalProps) => {
    const { colors } = useTheme();
    const { entities, dashboardConfig, saveDashboardConfig } = useHomeAssistant();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState<'lights' | 'covers'>('lights');
    const [isSaving, setIsSaving] = useState(false);

    // Filter available entities by domain
    const availableEntities = useMemo(() => {
        const domain = activeSection === 'lights' ? 'light.' : 'cover.';
        return entities
            .filter(e => e.entity_id.startsWith(domain))
            .filter(e => e.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.attributes.friendly_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id));
    }, [entities, activeSection, searchQuery]);

    // Current config for the section
    const currentMapped = useMemo(() => {
        return dashboardConfig[activeSection] || [];
    }, [dashboardConfig, activeSection]);

    const handleAdd = async (entity: EntityState) => {
        const name = entity.attributes.friendly_name || entity.entity_id;
        const newEntry = { id: entity.entity_id, name };

        // Prevent duplicates
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
        const newConfig = {
            ...dashboardConfig,
            [activeSection]: currentMapped.filter((m: any) => m.id !== id)
        };

        setIsSaving(true);
        try {
            await saveDashboardConfig(newConfig);
        } catch (e) {
            Alert.alert("Fehler", "Entität konnte nicht entfernt werden.");
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

                <View style={styles.tabContainer}>
                    <Pressable
                        onPress={() => setActiveSection('lights')}
                        style={[styles.tab, activeSection === 'lights' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
                    >
                        <Lightbulb size={18} color={activeSection === 'lights' ? colors.accent : colors.subtext} />
                        <Text style={[styles.tabText, { color: activeSection === 'lights' ? colors.accent : colors.subtext }]}>Lichter</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setActiveSection('covers')}
                        style={[styles.tab, activeSection === 'covers' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
                    >
                        <Blinds size={18} color={activeSection === 'covers' ? colors.accent : colors.subtext} />
                        <Text style={[styles.tabText, { color: activeSection === 'covers' ? colors.accent : colors.subtext }]}>Rollläden</Text>
                    </Pressable>
                </View>

                <View style={styles.content}>
                    {/* Current Config Section */}
                    <Text style={[styles.sectionTitle, { color: colors.subtext }]}>AKTUELLE ZUORDNUNG</Text>
                    <View style={styles.mappedList}>
                        {currentMapped.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>Noch keine Entitäten zugeordnet.</Text>
                        ) : (
                            currentMapped.map((m: any) => (
                                <View key={m.id} style={[styles.mappedItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.mappedName, { color: colors.text }]}>{m.name}</Text>
                                        <Text style={[styles.mappedId, { color: colors.subtext }]}>{m.id}</Text>
                                    </View>
                                    <Pressable onPress={() => handleRemove(m.id)} style={styles.removeBtn}>
                                        <Trash2 size={18} color="#EF4444" />
                                    </Pressable>
                                </View>
                            ))
                        )}
                    </View>

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
                            const isAdded = currentMapped.some((m: any) => m.id === e.entity_id);
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
                                        <Text style={{ color: colors.success, fontSize: 12 }}>Zugeordnet</Text>
                                    ) : (
                                        <Plus size={18} color={colors.accent} />
                                    )}
                                </Pressable>
                            )
                        })}
                    </ScrollView>
                </View>

                {isSaving && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                )}
            </View>
        </Modal>
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
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
    },
    tabText: {
        fontWeight: '600',
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

import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, ActivityIndicator, Alert, TextInput, Dimensions } from 'react-native';
import { X, Plus, Trash2, Lightbulb, Blinds, Bot, Shield, Search, Pencil, Check, ChevronUp, ChevronDown, Zap, CheckCircle2, Circle, CookingPot } from 'lucide-react-native';
import { useHomeAssistant, EntityState } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardConfigModalProps {
    visible: boolean;
    onClose: () => void;
}

type SectionType = 'lights' | 'covers' | 'vacuum' | 'alarm' | 'homescreenShortcuts' | 'appliances';

const TABS: { key: SectionType; label: string; icon: any; domain: string; single?: boolean; allEntities?: boolean }[] = [
    { key: 'lights', label: 'Lichter', icon: Lightbulb, domain: 'light.' },
    { key: 'covers', label: 'Rollläden', icon: Blinds, domain: 'cover.' },
    { key: 'appliances', label: 'Geräte', icon: CookingPot, domain: 'sensor.', allEntities: true },
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

    const availableEntities = useMemo(() => {
        let filtered = entities;
        if (activeSection === 'vacuum') {
            // Show all entities for vacuum tab
        } else if (activeTab.allEntities) {
            // Keep all
        } else {
            filtered = entities.filter(e => e.entity_id.startsWith(activeTab.domain));
        }
        return filtered
            .filter(e => e.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.attributes.friendly_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id));
    }, [entities, activeTab, activeSection, searchQuery]);

    const currentMapped = useMemo(() => {
        if (activeTab.single) {
            const entityId = dashboardConfig[activeSection];
            if (!entityId) return [];
            const entity = entities.find(e => e.entity_id === entityId);
            return [{ id: entityId, name: entity?.attributes?.friendly_name || entityId }];
        }
        return dashboardConfig[activeSection] || [];
    }, [dashboardConfig, activeSection, entities]);

    const handleAdd = async (entity: EntityState) => {
        const name = entity.attributes.friendly_name || entity.entity_id;

        // Appliances tab: add to appliances array
        if (activeSection === 'appliances') {
            const currentAppliances = (dashboardConfig.appliances || []) as { id: string; label: string; secondaryId?: string }[];
            if (currentAppliances.find(a => a.id === entity.entity_id)) {
                Alert.alert('Hinweis', 'Dieses Gerät ist bereits hinzugefügt.');
                return;
            }
            setIsSaving(true);
            try {
                await saveDashboardConfig({
                    ...dashboardConfig,
                    appliances: [...currentAppliances, { id: entity.entity_id, label: name }]
                });
            } catch { Alert.alert('Fehler', 'Konfiguration konnte nicht gespeichert werden.'); }
            finally { setIsSaving(false); }
            return;
        }

        if (activeSection === 'vacuum') {
            if (entity.entity_id.startsWith('vacuum.')) {
                // handled below by single-select logic
            } else {
                if (entity.entity_id.startsWith('sensor.') && !dashboardConfig.vacuumBatterySensor) {
                    setIsSaving(true);
                    try {
                        await saveDashboardConfig({ ...dashboardConfig, vacuumBatterySensor: entity.entity_id });
                    } catch { Alert.alert('Fehler', 'Konfiguration konnte nicht gespeichert werden.'); }
                    finally { setIsSaving(false); }
                    return;
                }
                if ((entity.entity_id.startsWith('camera.') || entity.entity_id.startsWith('image.')) && !dashboardConfig.vacuumMapCamera) {
                    setIsSaving(true);
                    try {
                        await saveDashboardConfig({ ...dashboardConfig, vacuumMapCamera: entity.entity_id });
                    } catch { Alert.alert('Fehler', 'Konfiguration konnte nicht gespeichert werden.'); }
                    finally { setIsSaving(false); }
                    return;
                }
                const currentDock = (dashboardConfig.vacuumDockEntities || []) as string[];
                if (currentDock.includes(entity.entity_id)) {
                    Alert.alert('Hinweis', 'Diese Entität ist bereits zugeordnet.');
                    return;
                }
                setIsSaving(true);
                try {
                    await saveDashboardConfig({ ...dashboardConfig, vacuumDockEntities: [...currentDock, entity.entity_id] });
                } catch { Alert.alert('Fehler', 'Konfiguration konnte nicht gespeichert werden.'); }
                finally { setIsSaving(false); }
                return;
            }
        }

        if (activeTab.single) {
            setIsSaving(true);
            try {
                await saveDashboardConfig({ ...dashboardConfig, [activeSection]: entity.entity_id });
            } catch { Alert.alert('Fehler', 'Konfiguration konnte nicht gespeichert werden.'); }
            finally { setIsSaving(false); }
            return;
        }

        if (currentMapped.find((m: any) => m.id === entity.entity_id)) {
            Alert.alert('Hinweis', 'Diese Entität ist bereits zugeordnet.');
            return;
        }
        setIsSaving(true);
        try {
            await saveDashboardConfig({ ...dashboardConfig, [activeSection]: [...currentMapped, { id: entity.entity_id, name }] });
        } catch { Alert.alert('Fehler', 'Konfiguration konnte nicht gespeichert werden.'); }
        finally { setIsSaving(false); }
    };

    const handleRemove = async (id: string) => {
        let newConfig;
        if (activeTab.single) {
            newConfig = { ...dashboardConfig, [activeSection]: null };
        } else {
            newConfig = { ...dashboardConfig, [activeSection]: currentMapped.filter((m: any) => m.id !== id) };
        }
        setIsSaving(true);
        try { await saveDashboardConfig(newConfig); }
        catch { Alert.alert('Fehler', 'Entität konnte nicht entfernt werden.'); }
        finally { setIsSaving(false); }
    };

    const handleRename = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        const newConfig = {
            ...dashboardConfig,
            [activeSection]: currentMapped.map((m: any) => m.id === id ? { ...m, name: newName.trim() } : m)
        };
        setIsSaving(true);
        try { await saveDashboardConfig(newConfig); }
        catch { Alert.alert('Fehler', 'Name konnte nicht geändert werden.'); }
        finally { setIsSaving(false); setEditingId(null); }
    };

    const handleMove = async (id: string, direction: 'up' | 'down') => {
        const idx = currentMapped.findIndex((m: any) => m.id === id);
        if (idx < 0) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= currentMapped.length) return;
        const arr = [...currentMapped];
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
        setIsSaving(true);
        try { await saveDashboardConfig({ ...dashboardConfig, [activeSection]: arr }); }
        catch { Alert.alert('Fehler', 'Reihenfolge konnte nicht geändert werden.'); }
        finally { setIsSaving(false); }
    };

    const isEntityAdded = (entityId: string) => {
        if (activeTab.single) return dashboardConfig[activeSection] === entityId;
        if (activeSection === 'appliances') {
            return ((dashboardConfig.appliances || []) as { id: string }[]).some(a => a.id === entityId);
        }
        if (activeSection === 'vacuum') {
            return dashboardConfig.vacuumBatterySensor === entityId ||
                dashboardConfig.vacuumMapCamera === entityId ||
                ((dashboardConfig.vacuumDockEntities || []) as string[]).includes(entityId) ||
                dashboardConfig[activeSection] === entityId;
        }
        return currentMapped.some((m: any) => m.id === entityId);
    };

    // Helper to render a single config chip (for vacuum sub-items)
    const renderConfigChip = (label: string, entityId: string | null | undefined, onRemove: () => void) => {
        const entity = entityId ? entities.find(e => e.entity_id === entityId) : null;
        return (
            <View style={[s.chipRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.chipDot, { backgroundColor: entityId ? colors.accent : colors.border }]} />
                <View style={{ flex: 1 }}>
                    <Text style={[s.chipLabel, { color: colors.subtext }]}>{label}</Text>
                    <Text style={[s.chipValue, { color: entity ? colors.text : colors.subtext }]}>
                        {entity ? (entity.attributes?.friendly_name || entityId) : 'Nicht konfiguriert'}
                    </Text>
                </View>
                {entityId && (
                    <Pressable onPress={onRemove} hitSlop={8} style={s.chipRemove}>
                        <X size={14} color="#EF4444" />
                    </Pressable>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[s.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[s.header, { borderBottomColor: colors.border }]}>
                    <Text style={[s.headerTitle, { color: colors.text }]}>Dashboard anpassen</Text>
                    <Pressable onPress={onClose} style={[s.headerClose, { backgroundColor: colors.card }]}>
                        <X size={20} color={colors.subtext} />
                    </Pressable>
                </View>

                {/* Tab Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.tabPills}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeSection === tab.key;
                        return (
                            <Pressable
                                key={tab.key}
                                onPress={() => { setActiveSection(tab.key); setSearchQuery(''); setEditingId(null); }}
                                style={[
                                    s.pill,
                                    { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.border }
                                ]}
                            >
                                <Icon size={14} color={active ? '#fff' : colors.subtext} />
                                <Text style={[s.pillText, { color: active ? '#fff' : colors.subtext }]}>{tab.label}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {/* Main Content – single ScrollView */}
                <ScrollView style={s.mainScroll} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

                    {/* Configured Entities Section */}
                    <Text style={[s.sectionLabel, { color: colors.subtext }]}>
                        {activeTab.single ? 'AUSGEWÄHLTE ENTITÄT' : 'ZUGEORDNETE ENTITÄTEN'}
                    </Text>

                    {currentMapped.length === 0 ? (
                        <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Circle size={32} color={colors.border} strokeWidth={1.5} />
                            <Text style={[s.emptyTitle, { color: colors.subtext }]}>
                                {activeTab.single ? 'Keine Entität ausgewählt' : 'Keine Entitäten zugeordnet'}
                            </Text>
                            <Text style={[s.emptyHint, { color: colors.subtext }]}>
                                Suche unten nach Entitäten und tippe zum Hinzufügen.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ gap: 8 }}>
                            {currentMapped.map((m: any, idx: number) => (
                                <View key={m.id} style={[s.configCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    {editingId === m.id && !activeTab.single ? (
                                        <View style={s.editRow}>
                                            <TextInput
                                                value={editName}
                                                onChangeText={setEditName}
                                                autoFocus
                                                style={[s.editInput, { color: colors.text, borderColor: colors.accent, backgroundColor: colors.background }]}
                                                onSubmitEditing={() => handleRename(m.id, editName)}
                                                placeholder="Name eingeben..."
                                                placeholderTextColor={colors.subtext}
                                            />
                                            <Pressable onPress={() => handleRename(m.id, editName)} style={[s.editConfirm, { backgroundColor: colors.accent }]}>
                                                <Check size={16} color="#fff" />
                                            </Pressable>
                                        </View>
                                    ) : (
                                        <>
                                            <View style={[s.configDot, { backgroundColor: colors.accent }]} />
                                            <Pressable
                                                style={{ flex: 1 }}
                                                onPress={() => {
                                                    if (!activeTab.single) { setEditingId(m.id); setEditName(m.name); }
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[s.configName, { color: colors.text }]} numberOfLines={1}>{m.name}</Text>
                                                    {!activeTab.single && <Pencil size={11} color={colors.subtext} />}
                                                </View>
                                                <Text style={[s.configId, { color: colors.subtext }]} numberOfLines={1}>{m.id}</Text>
                                            </Pressable>
                                            {!activeTab.single && (
                                                <View style={s.orderBtns}>
                                                    <Pressable onPress={() => handleMove(m.id, 'up')} style={s.orderBtn} disabled={idx === 0}>
                                                        <ChevronUp size={16} color={idx === 0 ? colors.border : colors.subtext} />
                                                    </Pressable>
                                                    <Pressable onPress={() => handleMove(m.id, 'down')} style={s.orderBtn} disabled={idx === currentMapped.length - 1}>
                                                        <ChevronDown size={16} color={idx === currentMapped.length - 1 ? colors.border : colors.subtext} />
                                                    </Pressable>
                                                </View>
                                            )}
                                            <Pressable onPress={() => handleRemove(m.id)} hitSlop={8} style={s.removeBtn}>
                                                <Trash2 size={16} color="#EF4444" />
                                            </Pressable>
                                        </>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Appliances Config */}
                    {activeSection === 'appliances' && (
                        <View>
                            <Text style={[s.sectionLabel, { color: colors.subtext }]}>KONFIGURIERTE GERÄTE</Text>
                            {((dashboardConfig.appliances || []) as { id: string; label: string }[]).length > 0 ? (
                                <View style={{ gap: 8 }}>
                                    {((dashboardConfig.appliances || []) as { id: string; label: string }[]).map((app, idx) => {
                                        const appList = (dashboardConfig.appliances || []) as { id: string; label: string }[];
                                        const entity = entities.find(e => e.entity_id === app.id);
                                        return (
                                            <View key={app.id} style={[s.configCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                {editingId === app.id ? (
                                                    <View style={s.editRow}>
                                                        <TextInput
                                                            value={editName}
                                                            onChangeText={setEditName}
                                                            autoFocus
                                                            style={[s.editInput, { color: colors.text, borderColor: colors.accent, backgroundColor: colors.background }]}
                                                            onSubmitEditing={async () => {
                                                                if (!editName.trim()) return;
                                                                const updated = appList.map(a => a.id === app.id ? { ...a, label: editName.trim() } : a);
                                                                setIsSaving(true);
                                                                try { await saveDashboardConfig({ ...dashboardConfig, appliances: updated }); }
                                                                catch { } finally { setIsSaving(false); setEditingId(null); }
                                                            }}
                                                            placeholder="Gerätename..."
                                                            placeholderTextColor={colors.subtext}
                                                        />
                                                        <Pressable onPress={async () => {
                                                            if (!editName.trim()) return;
                                                            const updated = appList.map(a => a.id === app.id ? { ...a, label: editName.trim() } : a);
                                                            setIsSaving(true);
                                                            try { await saveDashboardConfig({ ...dashboardConfig, appliances: updated }); }
                                                            catch { } finally { setIsSaving(false); setEditingId(null); }
                                                        }} style={[s.editConfirm, { backgroundColor: colors.accent }]}>
                                                            <Check size={16} color="#fff" />
                                                        </Pressable>
                                                    </View>
                                                ) : (
                                                    <>
                                                        <View style={[s.configDot, { backgroundColor: '#F59E0B' }]} />
                                                        <Pressable style={{ flex: 1 }} onPress={() => { setEditingId(app.id); setEditName(app.label); }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                <Text style={[s.configName, { color: colors.text }]} numberOfLines={1}>{app.label}</Text>
                                                                <Pencil size={11} color={colors.subtext} />
                                                            </View>
                                                            <Text style={[s.configId, { color: colors.subtext }]} numberOfLines={1}>{app.id}</Text>
                                                        </Pressable>
                                                        <View style={s.orderBtns}>
                                                            <Pressable onPress={async () => {
                                                                if (idx === 0) return;
                                                                const arr = [...appList];
                                                                [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                                                                setIsSaving(true);
                                                                try { await saveDashboardConfig({ ...dashboardConfig, appliances: arr }); }
                                                                catch { } finally { setIsSaving(false); }
                                                            }} style={s.orderBtn}>
                                                                <ChevronUp size={16} color={idx === 0 ? colors.border : colors.subtext} />
                                                            </Pressable>
                                                            <Pressable onPress={async () => {
                                                                if (idx === appList.length - 1) return;
                                                                const arr = [...appList];
                                                                [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                                                                setIsSaving(true);
                                                                try { await saveDashboardConfig({ ...dashboardConfig, appliances: arr }); }
                                                                catch { } finally { setIsSaving(false); }
                                                            }} style={s.orderBtn}>
                                                                <ChevronDown size={16} color={idx === appList.length - 1 ? colors.border : colors.subtext} />
                                                            </Pressable>
                                                        </View>
                                                        <Pressable onPress={async () => {
                                                            const updated = appList.filter(a => a.id !== app.id);
                                                            setIsSaving(true);
                                                            try { await saveDashboardConfig({ ...dashboardConfig, appliances: updated }); }
                                                            catch { } finally { setIsSaving(false); }
                                                        }} hitSlop={8} style={s.removeBtn}>
                                                            <Trash2 size={16} color="#EF4444" />
                                                        </Pressable>
                                                    </>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <CookingPot size={32} color={colors.border} strokeWidth={1.5} />
                                    <Text style={[s.emptyTitle, { color: colors.subtext }]}>
                                        Keine Geräte konfiguriert
                                    </Text>
                                    <Text style={[s.emptyHint, { color: colors.subtext }]}>
                                        Füge Sensoren hinzu, die den Gerätestatus anzeigen (z.B. Strom-Sensoren, Programm-Sensoren).
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Vacuum Sub-Config */}
                    {activeSection === 'vacuum' && dashboardConfig.vacuum && (
                        <View style={{ marginTop: 20 }}>
                            <Text style={[s.sectionLabel, { color: colors.subtext }]}>SAUGROBOTER-KONFIGURATION</Text>
                            {renderConfigChip('Akku-Sensor', dashboardConfig.vacuumBatterySensor, async () => {
                                setIsSaving(true);
                                try { await saveDashboardConfig({ ...dashboardConfig, vacuumBatterySensor: null }); }
                                catch { } finally { setIsSaving(false); }
                            })}
                            {renderConfigChip('Karten-Kamera', dashboardConfig.vacuumMapCamera, async () => {
                                setIsSaving(true);
                                try { await saveDashboardConfig({ ...dashboardConfig, vacuumMapCamera: null }); }
                                catch { } finally { setIsSaving(false); }
                            })}

                            <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 16 }]}>DOCKINGSTATION-ENTITÄTEN</Text>
                            {((dashboardConfig.vacuumDockEntities || []) as string[]).length > 0 ? (
                                <View style={{ gap: 6 }}>
                                    {((dashboardConfig.vacuumDockEntities || []) as string[]).map((dockId: string, idx: number) => {
                                        const dockEntity = entities.find(e => e.entity_id === dockId);
                                        const dockList = (dashboardConfig.vacuumDockEntities || []) as string[];
                                        return (
                                            <View key={dockId} style={[s.configCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                <View style={[s.configDot, { backgroundColor: '#3B82F6' }]} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[s.configName, { color: colors.text }]} numberOfLines={1}>
                                                        {dockEntity?.attributes?.friendly_name || dockId}
                                                    </Text>
                                                    <Text style={[s.configId, { color: colors.subtext }]} numberOfLines={1}>{dockId}</Text>
                                                </View>
                                                <View style={s.orderBtns}>
                                                    <Pressable onPress={async () => {
                                                        if (idx === 0) return;
                                                        const arr = [...dockList];
                                                        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                                                        setIsSaving(true);
                                                        try { await saveDashboardConfig({ ...dashboardConfig, vacuumDockEntities: arr }); }
                                                        catch { } finally { setIsSaving(false); }
                                                    }} style={s.orderBtn}>
                                                        <ChevronUp size={16} color={idx === 0 ? colors.border : colors.subtext} />
                                                    </Pressable>
                                                    <Pressable onPress={async () => {
                                                        if (idx === dockList.length - 1) return;
                                                        const arr = [...dockList];
                                                        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                                                        setIsSaving(true);
                                                        try { await saveDashboardConfig({ ...dashboardConfig, vacuumDockEntities: arr }); }
                                                        catch { } finally { setIsSaving(false); }
                                                    }} style={s.orderBtn}>
                                                        <ChevronDown size={16} color={idx === dockList.length - 1 ? colors.border : colors.subtext} />
                                                    </Pressable>
                                                </View>
                                                <Pressable onPress={async () => {
                                                    setIsSaving(true);
                                                    try {
                                                        const updated = dockList.filter((id: string) => id !== dockId);
                                                        await saveDashboardConfig({ ...dashboardConfig, vacuumDockEntities: updated });
                                                    } catch { } finally { setIsSaving(false); }
                                                }} hitSlop={8} style={s.removeBtn}>
                                                    <Trash2 size={16} color="#EF4444" />
                                                </Pressable>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 16 }]}>
                                    <Text style={[s.emptyHint, { color: colors.subtext }]}>
                                        Keine Dockingstation-Entitäten. Wähle beliebige Entities unten aus.
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Search & Entity Picker */}
                    <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 24 }]}>ENTITÄT HINZUFÜGEN</Text>
                    <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Search size={18} color={colors.subtext} />
                        <TextInput
                            style={[s.searchInput, { color: colors.text }]}
                            placeholder="Entität suchen..."
                            placeholderTextColor={colors.subtext}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                                <X size={16} color={colors.subtext} />
                            </Pressable>
                        )}
                    </View>

                    {/* Entity Cards Grid */}
                    <View style={s.entityGrid}>
                        {availableEntities.map(e => {
                            const added = isEntityAdded(e.entity_id);
                            const friendlyName = e.attributes.friendly_name || e.entity_id;
                            const domain = e.entity_id.split('.')[0];
                            return (
                                <Pressable
                                    key={e.entity_id}
                                    onPress={() => !added && handleAdd(e)}
                                    style={({ pressed }) => [
                                        s.entityCard,
                                        {
                                            backgroundColor: added ? (colors.accent + '15') : colors.card,
                                            borderColor: added ? colors.accent : colors.border,
                                            opacity: pressed && !added ? 0.7 : 1,
                                        }
                                    ]}
                                >
                                    <View style={s.entityCardHeader}>
                                        <View style={[s.domainBadge, { backgroundColor: added ? (colors.accent + '30') : (colors.subtext + '15') }]}>
                                            <Text style={[s.domainText, { color: added ? colors.accent : colors.subtext }]}>{domain}</Text>
                                        </View>
                                        {added ? (
                                            <CheckCircle2 size={18} color={colors.accent} />
                                        ) : (
                                            <Plus size={18} color={colors.accent} />
                                        )}
                                    </View>
                                    <Text style={[s.entityCardName, { color: added ? colors.accent : colors.text }]} numberOfLines={2}>
                                        {friendlyName}
                                    </Text>
                                    <Text style={[s.entityCardId, { color: colors.subtext }]} numberOfLines={1}>
                                        {e.entity_id}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {availableEntities.length === 0 && (
                        <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
                            <Search size={28} color={colors.border} />
                            <Text style={[s.emptyTitle, { color: colors.subtext }]}>Keine Entitäten gefunden</Text>
                            <Text style={[s.emptyHint, { color: colors.subtext }]}>Versuche einen anderen Suchbegriff.</Text>
                        </View>
                    )}
                </ScrollView>

                {isSaving && (
                    <View style={s.overlay}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                )}
            </View>
        </Modal>
    );
};

const s = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
    headerClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

    // Tab Pills
    tabPills: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 6 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14, borderWidth: 1 },
    pillText: { fontSize: 12, fontWeight: '600' },

    // Main scroll
    mainScroll: { flex: 1, paddingHorizontal: 20 },

    // Section labels
    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10, marginTop: 4 },

    // Empty state
    emptyCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 24, borderRadius: 16, borderWidth: 1, gap: 8 },
    emptyTitle: { fontSize: 15, fontWeight: '600' },
    emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

    // Config cards (assigned entities)
    configCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
    configDot: { width: 8, height: 8, borderRadius: 4 },
    configName: { fontSize: 15, fontWeight: '600' },
    configId: { fontSize: 11, marginTop: 1 },

    // Reorder
    orderBtns: { flexDirection: 'column', gap: 0 },
    orderBtn: { padding: 3 },
    removeBtn: { padding: 6, marginLeft: 2 },

    // Edit mode
    editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    editInput: { flex: 1, fontSize: 15, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    editConfirm: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

    // Vacuum sub-config chips
    chipRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, gap: 10, marginBottom: 8 },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
    chipValue: { fontSize: 14, fontWeight: '500', marginTop: 1 },
    chipRemove: { padding: 6 },

    // Search
    searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginBottom: 14, gap: 10 },
    searchInput: { flex: 1, fontSize: 15 },

    // Entity cards grid
    entityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    entityCard: { width: '48%', borderRadius: 14, borderWidth: 1, padding: 14, minHeight: 100 },
    entityCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    domainBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    domainText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    entityCardName: { fontSize: 14, fontWeight: '600', lineHeight: 18, marginBottom: 4 },
    entityCardId: { fontSize: 10, lineHeight: 13 },

    // Overlay
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});

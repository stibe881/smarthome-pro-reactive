import React, { useEffect, useState, useMemo } from 'react';
import {
    View, Text, ScrollView, Pressable, Modal, Alert, Switch,
    TextInput, ActivityIndicator, StyleSheet, Platform
} from 'react-native';
import {
    X, Search, Check, Clock, Lightbulb, ToggleLeft, Thermometer, DoorOpen,
    Shield, Tv, Wind, Droplets, Lock, Square, Play, Pencil, Home, Zap,
    Fan, Power, Bell, Wifi, Volume2, Camera, Music, Key, Settings,
    Flame, Snowflake, Sun, Moon, Star, Heart, Coffee, Plug
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import DateTimePicker from '@react-native-community/datetimepicker';

interface GuestPermissionsModalProps {
    visible: boolean;
    onClose: () => void;
    guestUserId: string;
    guestEmail: string;
    colors: any;
}

interface EntityConfig {
    name?: string;
    icon?: string;
}

const DOMAIN_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    'light': { label: 'Lichter', icon: Lightbulb, color: '#FBBF24' },
    'switch': { label: 'Schalter', icon: ToggleLeft, color: '#3B82F6' },
    'climate': { label: 'Klima', icon: Thermometer, color: '#EF4444' },
    'cover': { label: 'Storen', icon: DoorOpen, color: '#8B5CF6' },
    'fan': { label: 'Ventilatoren', icon: Fan, color: '#06B6D4' },
    'media_player': { label: 'Medien', icon: Tv, color: '#EC4899' },
    'humidifier': { label: 'Luftbefeuchter', icon: Droplets, color: '#14B8A6' },
    'alarm_control_panel': { label: 'Alarm', icon: Shield, color: '#F59E0B' },
    'lock': { label: 'Schlösser', icon: Lock, color: '#10B981' },
    'button': { label: 'Buttons', icon: Square, color: '#6366F1' },
    'input_boolean': { label: 'Schalter (Virtuell)', icon: ToggleLeft, color: '#0EA5E9' },
    'script': { label: 'Skripte', icon: Play, color: '#A855F7' },
};

// Available icons for the icon picker
const ICON_OPTIONS: { key: string; icon: any; label: string }[] = [
    { key: 'lock', icon: Lock, label: 'Schloss' },
    { key: 'key', icon: Key, label: 'Schlüssel' },
    { key: 'door', icon: DoorOpen, label: 'Tür' },
    { key: 'home', icon: Home, label: 'Haus' },
    { key: 'lightbulb', icon: Lightbulb, label: 'Licht' },
    { key: 'sun', icon: Sun, label: 'Sonne' },
    { key: 'moon', icon: Moon, label: 'Mond' },
    { key: 'power', icon: Power, label: 'Power' },
    { key: 'plug', icon: Plug, label: 'Stecker' },
    { key: 'zap', icon: Zap, label: 'Blitz' },
    { key: 'bell', icon: Bell, label: 'Glocke' },
    { key: 'shield', icon: Shield, label: 'Schutz' },
    { key: 'camera', icon: Camera, label: 'Kamera' },
    { key: 'tv', icon: Tv, label: 'TV' },
    { key: 'music', icon: Music, label: 'Musik' },
    { key: 'volume', icon: Volume2, label: 'Lautstärke' },
    { key: 'thermometer', icon: Thermometer, label: 'Temperatur' },
    { key: 'flame', icon: Flame, label: 'Flamme' },
    { key: 'snowflake', icon: Snowflake, label: 'Kälte' },
    { key: 'fan', icon: Fan, label: 'Ventilator' },
    { key: 'droplets', icon: Droplets, label: 'Wasser' },
    { key: 'wifi', icon: Wifi, label: 'WLAN' },
    { key: 'star', icon: Star, label: 'Stern' },
    { key: 'heart', icon: Heart, label: 'Herz' },
    { key: 'coffee', icon: Coffee, label: 'Kaffee' },
    { key: 'settings', icon: Settings, label: 'Einstellungen' },
    { key: 'play', icon: Play, label: 'Start' },
    { key: 'square', icon: Square, label: 'Button' },
    { key: 'toggle', icon: ToggleLeft, label: 'Schalter' },
];

export const ICON_MAP: Record<string, any> = Object.fromEntries(
    ICON_OPTIONS.map(o => [o.key, o.icon])
);

export const GuestPermissionsModal = ({ visible, onClose, guestUserId, guestEmail, colors }: GuestPermissionsModalProps) => {
    const { entities } = useHomeAssistant();
    const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
    const [entityConfig, setEntityConfig] = useState<Record<string, EntityConfig>>({});
    const [isActive, setIsActive] = useState(true);
    const [validFrom, setValidFrom] = useState<Date | null>(null);
    const [validUntil, setValidUntil] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showUntilPicker, setShowUntilPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
    const [tempDate, setTempDate] = useState<Date>(new Date());
    const [editingEntity, setEditingEntity] = useState<string | null>(null);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [iconPickerEntityId, setIconPickerEntityId] = useState<string | null>(null);

    // Filter controllable entities and group by domain
    const controllableEntities = useMemo(() => {
        const domains = Object.keys(DOMAIN_CONFIG);
        return entities.filter(e => {
            const domain = e.entity_id.split('.')[0];
            return domains.includes(domain);
        });
    }, [entities]);

    const groupedEntities = useMemo(() => {
        const groups: Record<string, typeof controllableEntities> = {};
        const query = searchQuery.toLowerCase();

        controllableEntities.forEach(e => {
            const name = e.attributes.friendly_name || e.entity_id;
            if (query && !name.toLowerCase().includes(query) && !e.entity_id.toLowerCase().includes(query)) return;

            const domain = e.entity_id.split('.')[0];
            if (!groups[domain]) groups[domain] = [];
            groups[domain].push(e);
        });

        Object.keys(groups).forEach(domain => {
            groups[domain].sort((a, b) =>
                (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id)
            );
        });

        return groups;
    }, [controllableEntities, searchQuery]);

    useEffect(() => {
        if (visible) loadPermissions();
    }, [visible]);

    const loadPermissions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('guest_permissions')
                .select('*')
                .eq('guest_user_id', guestUserId)
                .maybeSingle();

            if (data) {
                setSelectedEntityIds(data.entity_ids || []);
                setEntityConfig(data.entity_config || {});
                setIsActive(data.is_active);
                setValidFrom(data.valid_from ? new Date(data.valid_from) : null);
                setValidUntil(data.valid_until ? new Date(data.valid_until) : null);
            } else {
                setSelectedEntityIds([]);
                setEntityConfig({});
                setIsActive(true);
                setValidFrom(null);
                setValidUntil(null);
            }
        } catch (e) {
            console.error('Error loading guest permissions:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleEntity = (entityId: string) => {
        setSelectedEntityIds(prev =>
            prev.includes(entityId)
                ? prev.filter(id => id !== entityId)
                : [...prev, entityId]
        );
    };

    const toggleDomain = (domain: string) => {
        const domainEntities = groupedEntities[domain] || [];
        const domainIds = domainEntities.map(e => e.entity_id);
        const allSelected = domainIds.every(id => selectedEntityIds.includes(id));

        if (allSelected) {
            setSelectedEntityIds(prev => prev.filter(id => !domainIds.includes(id)));
        } else {
            setSelectedEntityIds(prev => [...new Set([...prev, ...domainIds])]);
        }
    };

    const updateEntityConfig = (entityId: string, field: 'name' | 'icon', value: string) => {
        setEntityConfig(prev => ({
            ...prev,
            [entityId]: { ...prev[entityId], [field]: value || undefined }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data: memberData } = await supabase
                .from('family_members')
                .select('household_id')
                .eq('user_id', guestUserId)
                .single();

            if (!memberData?.household_id) {
                Alert.alert('Fehler', 'Haushalt nicht gefunden.');
                return;
            }

            // Clean entity_config: only keep config for selected entities
            const cleanedConfig: Record<string, EntityConfig> = {};
            selectedEntityIds.forEach(id => {
                if (entityConfig[id] && (entityConfig[id].name || entityConfig[id].icon)) {
                    cleanedConfig[id] = entityConfig[id];
                }
            });

            const payload = {
                guest_user_id: guestUserId,
                household_id: memberData.household_id,
                entity_ids: selectedEntityIds,
                entity_config: cleanedConfig,
                is_active: isActive,
                valid_from: validFrom?.toISOString() || null,
                valid_until: validUntil?.toISOString() || null,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('guest_permissions')
                .upsert(payload, { onConflict: 'guest_user_id,household_id' });

            if (error) throw error;

            Alert.alert('Gespeichert', `Berechtigungen für ${guestEmail} aktualisiert.`);
            onClose();
        } catch (e: any) {
            console.error('Error saving guest permissions:', e);
            Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen.');
        } finally {
            setIsSaving(false);
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'Nicht gesetzt';
        return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
            ' ' + date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    };

    const handleDateChange = (target: 'from' | 'until', event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowFromPicker(false);
            setShowUntilPicker(false);
        }

        if (event.type === 'dismissed') return;
        if (!selectedDate) return;

        if (pickerMode === 'date') {
            setTempDate(selectedDate);
            setPickerMode('time');
            if (target === 'from') setShowFromPicker(true);
            else setShowUntilPicker(true);
        } else {
            const finalDate = new Date(tempDate);
            finalDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
            if (target === 'from') setValidFrom(finalDate);
            else setValidUntil(finalDate);
            setPickerMode('date');
        }
    };

    const getEntityDisplayIcon = (entityId: string) => {
        const cfg = entityConfig[entityId];
        if (cfg?.icon && ICON_MAP[cfg.icon]) return ICON_MAP[cfg.icon];
        const domain = entityId.split('.')[0];
        return DOMAIN_CONFIG[domain]?.icon || ToggleLeft;
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View>
                        <Text style={[styles.title, { color: colors.text }]}>Gast-Berechtigungen</Text>
                        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>{guestEmail}</Text>
                    </View>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
                ) : (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                        {/* Status Toggle */}
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.row}>
                                <Text style={[styles.sectionLabel, { color: colors.text }]}>Gastzugang aktiv</Text>
                                <Switch
                                    value={isActive}
                                    onValueChange={setIsActive}
                                    trackColor={{ false: '#334155', true: colors.accent }}
                                />
                            </View>
                        </View>

                        {/* Time Window */}
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.row}>
                                <Clock size={16} color={colors.subtext} />
                                <Text style={[styles.sectionLabel, { color: colors.text, marginLeft: 8 }]}>Zeitfenster</Text>
                            </View>

                            <Pressable
                                style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                                onPress={() => { setPickerMode('date'); setTempDate(validFrom || new Date()); setShowFromPicker(true); }}
                            >
                                <Text style={{ color: colors.subtext, fontSize: 12 }}>Von</Text>
                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{formatDate(validFrom)}</Text>
                            </Pressable>

                            {validFrom && (
                                <Pressable onPress={() => setValidFrom(null)}>
                                    <Text style={{ color: colors.error, fontSize: 12, marginTop: 4, marginLeft: 4 }}>Zurücksetzen</Text>
                                </Pressable>
                            )}

                            <Pressable
                                style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
                                onPress={() => { setPickerMode('date'); setTempDate(validUntil || new Date()); setShowUntilPicker(true); }}
                            >
                                <Text style={{ color: colors.subtext, fontSize: 12 }}>Bis</Text>
                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{formatDate(validUntil)}</Text>
                            </Pressable>

                            {validUntil && (
                                <Pressable onPress={() => setValidUntil(null)}>
                                    <Text style={{ color: colors.error, fontSize: 12, marginTop: 4, marginLeft: 4 }}>Zurücksetzen</Text>
                                </Pressable>
                            )}

                            {(showFromPicker || showUntilPicker) && (
                                <DateTimePicker
                                    value={showFromPicker ? (validFrom || new Date()) : (validUntil || new Date())}
                                    mode={pickerMode}
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(e: any, d: Date | undefined) => handleDateChange(showFromPicker ? 'from' : 'until', e, d)}
                                    locale="de-CH"
                                />
                            )}
                        </View>

                        {/* Entity Selection */}
                        <Text style={[styles.entityHeader, { color: colors.text }]}>
                            Erlaubte Steuerungen ({selectedEntityIds.length})
                        </Text>

                        {/* Search */}
                        <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                            <Search size={16} color={colors.subtext} />
                            <TextInput
                                style={{ flex: 1, color: colors.text, marginLeft: 8, fontSize: 14 }}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Entität suchen..."
                                placeholderTextColor={colors.subtext}
                            />
                        </View>

                        {Object.entries(groupedEntities).map(([domain, domainEntities]) => {
                            const config = DOMAIN_CONFIG[domain];
                            if (!config) return null;
                            const Icon = config.icon;
                            const allSelected = domainEntities.every(e => selectedEntityIds.includes(e.entity_id));
                            const someSelected = domainEntities.some(e => selectedEntityIds.includes(e.entity_id));

                            return (
                                <View key={domain} style={[styles.domainGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    {/* Domain Header */}
                                    <Pressable
                                        style={styles.domainHeader}
                                        onPress={() => toggleDomain(domain)}
                                    >
                                        <View style={styles.row}>
                                            <Icon size={18} color={config.color} />
                                            <Text style={[styles.domainTitle, { color: colors.text }]}>{config.label}</Text>
                                            <Text style={{ color: colors.subtext, fontSize: 11 }}>
                                                ({domainEntities.filter(e => selectedEntityIds.includes(e.entity_id)).length}/{domainEntities.length})
                                            </Text>
                                        </View>
                                        <View style={[styles.checkbox, {
                                            borderColor: allSelected ? colors.accent : colors.border,
                                            backgroundColor: allSelected ? colors.accent : someSelected ? colors.accent + '40' : 'transparent',
                                        }]}>
                                            {allSelected && <Check size={12} color="#fff" />}
                                        </View>
                                    </Pressable>

                                    {/* Entity List */}
                                    {domainEntities.map(entity => {
                                        const selected = selectedEntityIds.includes(entity.entity_id);
                                        const isEditing = editingEntity === entity.entity_id;
                                        const cfg = entityConfig[entity.entity_id] || {};
                                        const DisplayIcon = getEntityDisplayIcon(entity.entity_id);

                                        return (
                                            <View key={entity.entity_id}>
                                                <Pressable
                                                    style={[styles.entityRow, { borderTopColor: colors.border + '40' }]}
                                                    onPress={() => toggleEntity(entity.entity_id)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                                        <DisplayIcon size={14} color={config.color} style={{ marginRight: 6 }} />
                                                        <Text style={[styles.entityName, { color: colors.text }]} numberOfLines={1}>
                                                            {cfg.name || entity.attributes.friendly_name || entity.entity_id}
                                                        </Text>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        {selected && (
                                                            <Pressable
                                                                onPress={(e) => {
                                                                    e.stopPropagation?.();
                                                                    setEditingEntity(isEditing ? null : entity.entity_id);
                                                                }}
                                                                hitSlop={8}
                                                            >
                                                                <Pencil size={14} color={isEditing ? colors.accent : colors.subtext} />
                                                            </Pressable>
                                                        )}
                                                        <View style={[styles.checkbox, {
                                                            borderColor: selected ? colors.accent : colors.border,
                                                            backgroundColor: selected ? colors.accent : 'transparent',
                                                        }]}>
                                                            {selected && <Check size={12} color="#fff" />}
                                                        </View>
                                                    </View>
                                                </Pressable>

                                                {/* Inline Edit Panel */}
                                                {isEditing && selected && (
                                                    <View style={[styles.editPanel, { backgroundColor: colors.background, borderTopColor: colors.border + '40' }]}>
                                                        {/* Custom Name */}
                                                        <View style={styles.editRow}>
                                                            <Text style={{ color: colors.subtext, fontSize: 11, width: 40 }}>Name</Text>
                                                            <TextInput
                                                                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                                                                value={cfg.name || ''}
                                                                onChangeText={(v) => updateEntityConfig(entity.entity_id, 'name', v)}
                                                                placeholder={entity.attributes.friendly_name || entity.entity_id}
                                                                placeholderTextColor={colors.subtext + '80'}
                                                            />
                                                        </View>
                                                        {/* Icon Picker */}
                                                        <View style={styles.editRow}>
                                                            <Text style={{ color: colors.subtext, fontSize: 11, width: 40 }}>Icon</Text>
                                                            <Pressable
                                                                style={[styles.iconPickerBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                                                                onPress={() => {
                                                                    setIconPickerEntityId(entity.entity_id);
                                                                    setShowIconPicker(true);
                                                                }}
                                                            >
                                                                <DisplayIcon size={16} color={config.color} />
                                                                <Text style={{ color: colors.text, fontSize: 12, marginLeft: 6 }}>
                                                                    {cfg.icon ? ICON_OPTIONS.find(o => o.key === cfg.icon)?.label || cfg.icon : 'Standard'}
                                                                </Text>
                                                            </Pressable>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Save Button */}
                {!isLoading && (
                    <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                        <Pressable
                            onPress={handleSave}
                            disabled={isSaving}
                            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>Berechtigungen speichern</Text>
                            )}
                        </Pressable>
                    </View>
                )}
            </View>

            {/* Icon Picker Modal */}
            <Modal visible={showIconPicker} transparent animationType="fade" onRequestClose={() => setShowIconPicker(false)}>
                <Pressable style={styles.iconModalOverlay} onPress={() => setShowIconPicker(false)}>
                    <View style={[styles.iconModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.iconModalTitle, { color: colors.text }]}>Icon wählen</Text>
                        <View style={styles.iconGrid}>
                            {ICON_OPTIONS.map(opt => {
                                const IconComp = opt.icon;
                                const isSelected = iconPickerEntityId && entityConfig[iconPickerEntityId]?.icon === opt.key;
                                return (
                                    <Pressable
                                        key={opt.key}
                                        style={[styles.iconOption, {
                                            backgroundColor: isSelected ? colors.accent + '20' : colors.background,
                                            borderColor: isSelected ? colors.accent : colors.border,
                                        }]}
                                        onPress={() => {
                                            if (iconPickerEntityId) {
                                                updateEntityConfig(iconPickerEntityId, 'icon', opt.key);
                                            }
                                            setShowIconPicker(false);
                                        }}
                                    >
                                        <IconComp size={20} color={isSelected ? colors.accent : colors.subtext} />
                                        <Text style={{ color: colors.subtext, fontSize: 9, marginTop: 2 }} numberOfLines={1}>{opt.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <Pressable
                            style={{ marginTop: 12, alignSelf: 'center' }}
                            onPress={() => {
                                if (iconPickerEntityId) {
                                    updateEntityConfig(iconPickerEntityId, 'icon', '');
                                }
                                setShowIconPicker(false);
                            }}
                        >
                            <Text style={{ color: colors.error, fontSize: 13 }}>Zurücksetzen</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    title: { fontSize: 18, fontWeight: 'bold' },
    section: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionLabel: { fontSize: 15, fontWeight: '600' },
    dateButton: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 12 },
    entityHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 8, marginBottom: 12 },
    searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
    domainGroup: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
    domainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
    domainTitle: { fontSize: 14, fontWeight: '600', marginLeft: 8, flex: 1 },
    entityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5 },
    entityName: { fontSize: 13, flex: 1 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, borderTopWidth: 1 },
    saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Edit panel
    editPanel: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5, gap: 6 },
    editRow: { flexDirection: 'row', alignItems: 'center' },
    editInput: { flex: 1, fontSize: 13, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    iconPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },

    // Icon picker modal
    iconModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    iconModalContent: { borderRadius: 20, borderWidth: 1, padding: 20, maxWidth: 360, width: '100%' },
    iconModalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    iconOption: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

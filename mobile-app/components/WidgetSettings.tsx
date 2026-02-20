import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Switch, Alert, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Save, Plus, Trash2, Smartphone, Search, Edit2, ChevronRight, CheckCircle, Play, MoreHorizontal, Lightbulb, Lock, Thermometer, Tv, Music, Camera, Fan, Blinds, Power, Zap, Home, Sun, Moon, Coffee, Film, Sunrise, DoorOpen, Shield, Bell, Wifi, Speaker, Cloud, Droplets, Wind, Eye, ToggleLeft } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { saveCookieToWidget, loadCookieFromWidget, WidgetData } from '../lib/widget';
import * as Linking from 'expo-linking';

interface WidgetSettingsProps {
    visible: boolean;
    onClose: () => void;
}

const ACTION_TYPES = [
    { id: 'toggle', label: 'Umschalten (An/Aus)', icon: 'toggle-right' },
    { id: 'script', label: 'Skript ausführen', icon: 'play-circle' },
    { id: 'scene', label: 'Szene aktivieren', icon: 'image' },
    { id: 'navigate', label: 'In App öffnen (Navigieren)', icon: 'arrow-right-circle' },
    { id: 'none', label: 'Keine Aktion (Nur Anzeige)', icon: 'slash' },
] as const;

const COLORS = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#64748B', // Slate
];

// SF Symbol icons for the iOS widget with matching Lucide icons for preview
const SF_ICONS = [
    { sf: 'lightbulb.fill', label: 'Licht', lucide: Lightbulb },
    { sf: 'lock.fill', label: 'Schloss', lucide: Lock },
    { sf: 'lock.open.fill', label: 'Offen', lucide: DoorOpen },
    { sf: 'thermometer', label: 'Temperatur', lucide: Thermometer },
    { sf: 'tv.fill', label: 'TV', lucide: Tv },
    { sf: 'music.note', label: 'Musik', lucide: Music },
    { sf: 'camera.fill', label: 'Kamera', lucide: Camera },
    { sf: 'fan.fill', label: 'Ventilator', lucide: Fan },
    { sf: 'blinds.vertical.closed', label: 'Rollläden', lucide: Blinds },
    { sf: 'power', label: 'Strom', lucide: Power },
    { sf: 'bolt.fill', label: 'Blitz', lucide: Zap },
    { sf: 'house.fill', label: 'Haus', lucide: Home },
    { sf: 'sun.max.fill', label: 'Sonne', lucide: Sun },
    { sf: 'moon.fill', label: 'Mond', lucide: Moon },
    { sf: 'cup.and.saucer.fill', label: 'Kaffee', lucide: Coffee },
    { sf: 'film.fill', label: 'Film', lucide: Film },
    { sf: 'sunrise.fill', label: 'Sonnenaufgang', lucide: Sunrise },
    { sf: 'door.left.hand.closed', label: 'Tür', lucide: DoorOpen },
    { sf: 'shield.fill', label: 'Sicherheit', lucide: Shield },
    { sf: 'bell.fill', label: 'Glocke', lucide: Bell },
    { sf: 'wifi', label: 'WLAN', lucide: Wifi },
    { sf: 'speaker.wave.2.fill', label: 'Lautsprecher', lucide: Speaker },
    { sf: 'cloud.fill', label: 'Wolke', lucide: Cloud },
    { sf: 'drop.fill', label: 'Wasser', lucide: Droplets },
    { sf: 'wind', label: 'Wind', lucide: Wind },
    { sf: 'eye.fill', label: 'Auge', lucide: Eye },
    { sf: 'switch.2', label: 'Schalter', lucide: ToggleLeft },
    { sf: 'play.fill', label: 'Abspielen', lucide: Play },
];

export function WidgetSettings({ visible, onClose }: WidgetSettingsProps) {
    const { colors } = useTheme();
    const { entities } = useHomeAssistant();
    const insets = useSafeAreaInsets();

    // Main State
    const [items, setItems] = useState<WidgetData['items']>([]);

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editItem, setEditItem] = useState<Partial<WidgetData['items'][0]>>({});
    const [editIndex, setEditIndex] = useState<number | null>(null);

    // Entity Picker State (nested in Edit Modal)
    const [pickerVisible, setPickerVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (visible) {
            loadSettings();
        }
    }, [visible]);

    const loadSettings = async () => {
        const data = await loadCookieFromWidget();
        if (data && data.items) {
            // Migration: Add default fields if missing
            const migratedItems = data.items.map((item: any) => ({
                ...item,
                actionType: item.actionType || 'none',
                iconColor: item.iconColor || '#3B82F6',
                confirm: item.confirm || false
            }));
            setItems(migratedItems);
        }
    };

    const handleAddItem = () => {
        if (items.length >= 4) {
            Alert.alert('Limit', 'Maximal 4 Elemente erlaubt.');
            return;
        }
        setEditItem({
            label: '',
            value: '',
            id: '',
            icon: 'lightbulb.fill',
            actionType: 'toggle',
            iconColor: '#3B82F6',
            confirm: false
        });
        setEditIndex(null);
        setEditModalVisible(true);
    };

    const handleEditItemPress = (index: number) => {
        setEditItem({ ...items[index] });
        setEditIndex(index);
        setEditModalVisible(true);
    };

    const handleSaveItem = () => {
        if (!editItem.id) {
            Alert.alert('Fehler', 'Bitte wähle ein Gerät aus.');
            return;
        }
        if (!editItem.label) {
            Alert.alert('Fehler', 'Bitte gib einen Namen ein.');
            return;
        }

        const newItem = editItem as WidgetData['items'][0];

        // Auto-fill value/icon from entity if missing/generic
        const entity = entities.find(e => e.entity_id === newItem.id);
        if (entity) {
            if (!newItem.value || newItem.value === '?') newItem.value = entity.state;
            // We don't overwrite icon here to allow custom icons in future
        }

        setItems(prev => {
            const next = [...prev];
            if (editIndex !== null) {
                next[editIndex] = newItem;
            } else {
                next.push(newItem);
            }
            return next;
        });
        setEditModalVisible(false);
    };

    const handleDeleteItem = () => {
        if (editIndex !== null) {
            setItems(prev => prev.filter((_, i) => i !== editIndex));
            setEditModalVisible(false);
        }
    };

    const handleSaveWidget = async () => {
        const widgetData: WidgetData = {
            title: "HomePilot",
            subtitle: items.length > 0 ? `${items.length} Elemente` : "Leer",
            items: items,
            updatedAt: new Date().toISOString()
        };

        if (Platform.OS === 'ios') {
            await saveCookieToWidget(widgetData);
            Alert.alert('Gespeichert', 'Widget aktualisiert.');
        }
        onClose();
    };

    // Helper to select entity
    const selectEntity = (entity: any) => {
        setEditItem(prev => ({
            ...prev,
            id: entity.entity_id,
            label: prev.label || entity.attributes.friendly_name,
            // Default action guessing
            actionType: entity.entity_id.startsWith('script.') ? 'script' :
                entity.entity_id.startsWith('scene.') ? 'scene' : 'toggle'
        }));
        setPickerVisible(false);
    };

    const availableEntities = entities.filter(e =>
        e.attributes.friendly_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.entity_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Widget Konfigurieren</Text>
                    <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.card }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                {/* List of Items */}
                <ScrollView style={styles.content}>
                    <Text style={{ color: colors.subtext, marginBottom: 16 }}>
                        Füge bis zu 4 Elemente hinzu. Tippe zum Bearbeiten.
                    </Text>

                    <View style={{ gap: 12 }}>
                        {items.map((item: WidgetData['items'][0], index: number) => (
                            <Pressable
                                key={index}
                                onPress={() => handleEditItemPress(index)}
                                style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                            >
                                <View style={[styles.iconBadge, { backgroundColor: (item.iconColor || colors.accent) + '20' }]}>
                                    {(() => {
                                        const matchedIcon = SF_ICONS.find(i => i.sf === item.icon);
                                        const IconComponent = matchedIcon ? matchedIcon.lucide : Lightbulb;
                                        return <IconComponent size={16} color={item.iconColor || colors.accent} />;
                                    })()}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: colors.text, fontWeight: '600' }}>{item.label}</Text>
                                    <Text style={{ color: colors.subtext, fontSize: 12 }}>{item.actionType} • {item.id}</Text>
                                </View>
                                <ChevronRight size={20} color={colors.subtext} />
                            </Pressable>
                        ))}

                        {items.length < 4 && (
                            <Pressable onPress={handleAddItem} style={[styles.addButton, { borderColor: colors.border }]}>
                                <Plus size={24} color={colors.subtext} />
                                <Text style={{ color: colors.subtext }}>Element hinzufügen</Text>
                            </Pressable>
                        )}
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                    <Pressable onPress={handleSaveWidget} style={[styles.saveButton, { backgroundColor: colors.accent }]}>
                        <Save size={20} color="#fff" />
                        <Text style={styles.saveText}>Speichern</Text>
                    </Pressable>
                </View>

                {/* EDIT ITEM MODAL */}
                <Modal visible={editModalVisible} animationType="slide">
                    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>{editIndex !== null ? 'Bearbeiten' : 'Neu'}</Text>
                            <Pressable onPress={() => setEditModalVisible(false)}>
                                <Text style={{ color: colors.accent, fontSize: 16 }}>Abbrechen</Text>
                            </Pressable>
                        </View>

                        <ScrollView style={styles.content}>
                            {/* Device Selection */}
                            <Text style={[styles.sectionLabel, { color: colors.subtext }]}>GERÄT / OBJEKT</Text>
                            <Pressable
                                onPress={() => setPickerVisible(true)}
                                style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                                <Text style={{ color: editItem.id ? colors.text : colors.subtext, flex: 1 }}>
                                    {editItem.id || 'Wählen...'}
                                </Text>
                                <Search size={20} color={colors.subtext} />
                            </Pressable>

                            {/* Name */}
                            <Text style={[styles.sectionLabel, { color: colors.subtext, marginTop: 24 }]}>NAME</Text>
                            <TextInput
                                style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                                value={editItem.label}
                                onChangeText={t => setEditItem(prev => ({ ...prev, label: t }))}
                                placeholder="Name eingeben"
                                placeholderTextColor={colors.subtext}
                            />

                            {/* Icon Picker */}
                            <Text style={[styles.sectionLabel, { color: colors.subtext, marginTop: 24 }]}>ICON</Text>
                            <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {SF_ICONS.map(({ sf, label, lucide: LucideIcon }) => {
                                        const isSelected = editItem.icon === sf;
                                        return (
                                            <Pressable
                                                key={sf}
                                                onPress={() => setEditItem(prev => ({ ...prev, icon: sf }))}
                                                style={{
                                                    width: 48, height: 48, borderRadius: 12,
                                                    alignItems: 'center', justifyContent: 'center',
                                                    backgroundColor: isSelected ? (editItem.iconColor || colors.accent) + '30' : colors.background,
                                                    borderWidth: isSelected ? 2 : 0,
                                                    borderColor: editItem.iconColor || colors.accent,
                                                }}
                                            >
                                                <LucideIcon size={22} color={isSelected ? (editItem.iconColor || colors.accent) : colors.subtext} />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                                {editItem.icon && (
                                    <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                                        {SF_ICONS.find(i => i.sf === editItem.icon)?.label || editItem.icon}
                                    </Text>
                                )}
                            </View>

                            {/* Action */}
                            <Text style={[styles.sectionLabel, { color: colors.subtext, marginTop: 24 }]}>AKTION</Text>
                            <View style={{ backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                                {ACTION_TYPES.map((type, i) => (
                                    <Pressable
                                        key={type.id}
                                        onPress={() => setEditItem(prev => ({ ...prev, actionType: type.id as any }))}
                                        style={[
                                            styles.actionRow,
                                            i < ACTION_TYPES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }
                                        ]}
                                    >
                                        <Text style={{ color: colors.text, flex: 1 }}>{type.label}</Text>
                                        {editItem.actionType === type.id && <CheckCircle size={20} color={colors.accent} />}
                                    </Pressable>
                                ))}
                            </View>

                            {/* Colors */}
                            <Text style={[styles.sectionLabel, { color: colors.subtext, marginTop: 24 }]}>ICON FARBE</Text>
                            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                                {COLORS.map(c => (
                                    <Pressable
                                        key={c}
                                        onPress={() => setEditItem(prev => ({ ...prev, iconColor: c }))}
                                        style={{
                                            width: 40, height: 40, borderRadius: 20, backgroundColor: c,
                                            alignItems: 'center', justifyContent: 'center',
                                            borderWidth: editItem.iconColor === c ? 2 : 0, borderColor: '#fff'
                                        }}
                                    >
                                        {editItem.iconColor === c && <CheckCircle size={20} color="#fff" />}
                                    </Pressable>
                                ))}
                            </View>

                            {/* Confirmation */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, backgroundColor: colors.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Bestätigung verlangen</Text>
                                <Switch
                                    value={editItem.confirm || false}
                                    onValueChange={v => setEditItem(prev => ({ ...prev, confirm: v }))}
                                    trackColor={{ false: colors.border, true: colors.accent }}
                                />
                            </View>

                            {/* Delete */}
                            {editIndex !== null && (
                                <Pressable
                                    onPress={handleDeleteItem}
                                    style={{ marginTop: 40, alignItems: 'center', padding: 16 }}
                                >
                                    <Text style={{ color: colors.error, fontSize: 16, fontWeight: 'bold' }}>Element entfernen</Text>
                                </Pressable>
                            )}

                            <View style={{ height: 60 }} />
                        </ScrollView>

                        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                            <Pressable onPress={handleSaveItem} style={[styles.saveButton, { backgroundColor: colors.accent }]}>
                                <Save size={20} color="#fff" />
                                <Text style={styles.saveText}>Übernehmen</Text>
                            </Pressable>
                        </View>
                        {/* Entity Picker Modal (must be INSIDE Edit Modal to render on top) */}
                        <Modal visible={pickerVisible} animationType="slide">
                            <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                                <View style={styles.header}>
                                    <Text style={[styles.title, { color: colors.text }]}>Element wählen</Text>
                                    <Pressable onPress={() => setPickerVisible(false)}>
                                        <X size={24} color={colors.text} />
                                    </Pressable>
                                </View>
                                <View style={{ padding: 16 }}>
                                    <TextInput
                                        style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                                        placeholder="Suchen..."
                                        placeholderTextColor={colors.subtext}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                </View>
                                <ScrollView>
                                    {availableEntities.map(e => (
                                        <Pressable key={e.entity_id} onPress={() => selectEntity(e)} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                            <Text style={{ color: colors.text, fontWeight: 'bold' }}>{e.attributes.friendly_name}</Text>
                                            <Text style={{ color: colors.subtext }}>{e.entity_id}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        </Modal>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    title: { fontSize: 20, fontWeight: 'bold' },
    closeButton: { padding: 8, borderRadius: 20 },
    content: { flex: 1, padding: 16 },
    footer: { padding: 16, borderTopWidth: 1 },
    itemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8, gap: 12 },
    iconBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', gap: 8 },
    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
    saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Form
    sectionLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
    inputRow: { padding: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', fontSize: 16 },
    actionRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
});

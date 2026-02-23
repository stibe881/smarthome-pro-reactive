import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, Pressable, Alert, Modal, ScrollView, TextInput,
    StyleSheet, ActivityIndicator, Switch, Platform
} from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
    X, Plus, Trash2, ChevronRight, Bell, Shield, Baby, Calendar,
    CloudLightning, Eye, Zap, House, Thermometer, Droplets, Edit3, Copy, Check,
    Volume2, VolumeX, AlertTriangle
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

// Available icons for selection
const ICON_OPTIONS = [
    { name: 'bell', label: 'Glocke', Component: Bell },
    { name: 'shield', label: 'Schild', Component: Shield },
    { name: 'baby', label: 'Baby', Component: Baby },
    { name: 'calendar', label: 'Kalender', Component: Calendar },
    { name: 'cloud-lightning', label: 'Gewitter', Component: CloudLightning },
    { name: 'eye', label: 'Auge', Component: Eye },
    { name: 'zap', label: 'Blitz', Component: Zap },
    { name: 'home', label: 'Haus', Component: House },
    { name: 'thermometer', label: 'Temperatur', Component: Thermometer },
    { name: 'droplets', label: 'Wasser', Component: Droplets },
];

const COLOR_OPTIONS = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
    '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6',
    '#F97316', '#06B6D4',
];

const SOUND_OPTIONS = [
    { value: 'default', label: 'Standard' },
    { value: 'alarm.wav', label: 'Alarm' },
    { value: 'doorbell.wav', label: 'Türklingel' },
    { value: 'chime.wav', label: 'Chime' },
    { value: null, label: 'Stumm' },
];

const DISPLAY_GROUP_OPTIONS = [
    'Akku',
    'Babyphone',
    'Geburtstage',
    'Haushalt',
    'Security Center',
    'Tagesablauf',
    'Türklingel',
    'Wetter',
];

interface NotificationType {
    id: string;
    household_id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    category_key: string;
    display_group: string | null;
    is_active: boolean;
    is_critical: boolean;
    sound: string | null;
    created_at: string;
}

const getIconComponent = (iconName: string) => {
    const found = ICON_OPTIONS.find(i => i.name === iconName);
    return found?.Component || Bell;
};

export const NotificationTypesManager = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [types, setTypes] = useState<NotificationType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingType, setEditingType] = useState<NotificationType | null>(null);
    const [showCodeSnippet, setShowCodeSnippet] = useState<NotificationType | null>(null);
    const [copied, setCopied] = useState(false);

    // Editor state
    const [editorName, setEditorName] = useState('');
    const [editorDescription, setEditorDescription] = useState('');
    const [editorIcon, setEditorIcon] = useState('bell');
    const [editorColor, setEditorColor] = useState('#3B82F6');
    const [editorCategoryKey, setEditorCategoryKey] = useState('');
    const [editorIsCritical, setEditorIsCritical] = useState(false);
    const [editorSound, setEditorSound] = useState<string | null>('default');
    const [editorDisplayGroup, setEditorDisplayGroup] = useState('Haushalt');
    const [saving, setSaving] = useState(false);
    const [playingSound, setPlayingSound] = useState<string | null>(null);

    const fetchTypes = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notification_types')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setTypes(data || []);
        } catch (e: any) {
            console.error('Failed to fetch notification types:', e);
            Alert.alert('Fehler', 'Konnte Benachrichtigungstypen nicht laden.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (visible) {
            fetchTypes();
        }
    }, [visible, fetchTypes]);

    const openEditor = (type?: NotificationType) => {
        if (type) {
            setEditingType(type);
            setEditorName(type.name);
            setEditorDescription(type.description || '');
            setEditorIcon(type.icon);
            setEditorColor(type.color);
            setEditorCategoryKey(type.category_key);
            setEditorIsCritical(type.is_critical || false);
            setEditorSound(type.sound ?? 'default');
            setEditorDisplayGroup(type.display_group || 'Haushalt');
        } else {
            setEditingType(null);
            setEditorName('');
            setEditorDescription('');
            setEditorIcon('bell');
            setEditorColor('#3B82F6');
            setEditorCategoryKey('');
            setEditorIsCritical(false);
            setEditorSound('default');
            setEditorDisplayGroup('Haushalt');
        }
        setShowEditor(true);
    };

    const generateCategoryKey = (name: string): string => {
        return name
            .toLowerCase()
            .replace(/[äÄ]/g, 'ae')
            .replace(/[öÖ]/g, 'oe')
            .replace(/[üÜ]/g, 'ue')
            .replace(/[ß]/g, 'ss')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    };

    const SOUND_FILES: Record<string, any> = {
        'default': require('../assets/sounds/chime.wav'),
        'alarm.wav': require('../assets/sounds/alarm.wav'),
        'doorbell.wav': require('../assets/sounds/doorbell.wav'),
        'chime.wav': require('../assets/sounds/chime.wav'),
    };

    const playPreview = async (soundValue: string | null) => {
        if (!soundValue || !SOUND_FILES[soundValue]) return;
        try {
            setPlayingSound(soundValue);
            await setAudioModeAsync({ playsInSilentMode: true });
            const player = createAudioPlayer(SOUND_FILES[soundValue]);
            player.play();
            // Auto-cleanup after 3s (sound files are short)
            setTimeout(() => {
                try { player.remove(); } catch (e) { }
                setPlayingSound(null);
            }, 3000);
        } catch (e) {
            console.warn('Sound preview failed:', e);
            setPlayingSound(null);
        }
    };

    const handleSave = async () => {
        if (!editorName.trim()) {
            Alert.alert('Fehler', 'Bitte gib einen Namen ein.');
            return;
        }

        const categoryKey = editorCategoryKey.trim() || generateCategoryKey(editorName);
        if (!categoryKey) {
            Alert.alert('Fehler', 'Bitte gib einen eindeutigen Schlüssel ein.');
            return;
        }

        setSaving(true);
        try {
            // Get household_id
            const { data: memberData } = await supabase
                .from('family_members')
                .select('household_id')
                .eq('user_id', user!.id)
                .single();

            if (!memberData?.household_id) {
                Alert.alert('Fehler', 'Kein Haushalt gefunden.');
                return;
            }

            const payload = {
                household_id: memberData.household_id,
                name: editorName.trim(),
                description: editorDescription.trim() || null,
                icon: editorIcon,
                color: editorColor,
                category_key: categoryKey,
                display_group: editorDisplayGroup,
                is_critical: editorIsCritical,
                sound: editorSound,
            };

            if (editingType) {
                // Update
                const { error } = await supabase
                    .from('notification_types')
                    .update(payload)
                    .eq('id', editingType.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('notification_types')
                    .insert(payload);
                if (error) throw error;
            }

            setShowEditor(false);
            fetchTypes();
        } catch (e: any) {
            console.error('Save error:', e);
            if (e.message?.includes('duplicate') || e.code === '23505') {
                Alert.alert('Fehler', 'Dieser Schlüssel existiert bereits. Bitte wähle einen anderen.');
            } else {
                Alert.alert('Fehler', 'Speichern fehlgeschlagen: ' + (e.message || e));
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (type: NotificationType) => {
        Alert.alert(
            'Löschen',
            `Möchtest du "${type.name}" wirklich löschen? Alle User-Einstellungen für diese Kategorie werden ebenfalls gelöscht.`,
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Löschen', style: 'destructive', onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('notification_types')
                                .delete()
                                .eq('id', type.id);
                            if (error) throw error;
                            fetchTypes();
                        } catch (e: any) {
                            Alert.alert('Fehler', 'Löschen fehlgeschlagen: ' + (e.message || e));
                        }
                    }
                }
            ]
        );
    };

    const toggleActive = async (type: NotificationType) => {
        try {
            const { error } = await supabase
                .from('notification_types')
                .update({ is_active: !type.is_active })
                .eq('id', type.id);
            if (error) throw error;
            setTypes(prev => prev.map(t =>
                t.id === type.id ? { ...t, is_active: !t.is_active } : t
            ));
        } catch (e: any) {
            Alert.alert('Fehler', 'Status ändern fehlgeschlagen.');
        }
    };

    const getCodeSnippet = (type: NotificationType): string => {
        return `# Home Assistant Automation – ${type.name}
# Füge dies zu deiner automations.yaml hinzu oder erstelle 
# eine neue Automation im visuellen Editor.

- alias: "Push: ${type.name}"
  trigger:
    # ANPASSEN: Ersetze dies mit deinem gewünschten Trigger
    - platform: state
      entity_id: sensor.DEIN_SENSOR
      to: "on"
  action:
    - service: rest_command.send_push_notification
      data:
        title: "${type.name}"
        message: "${type.description || 'Benachrichtigung'}"
        data:
          category_key: "${type.category_key}"`;
    };

    const handleCopySnippet = async (type: NotificationType) => {
        try {
            await Clipboard.setStringAsync(getCodeSnippet(type));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            Alert.alert('Fehler', 'Kopieren fehlgeschlagen.');
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[s.container, { backgroundColor: colors.background }]}>
                <View style={[s.header, { borderBottomColor: colors.border }]}>
                    <Text style={[s.headerTitle, { color: colors.text }]}>Benachrichtigungen verwalten</Text>
                    <Pressable onPress={onClose} style={s.closeBtn}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 100 }}>
                    <View style={[s.infoBox, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}>
                        <Text style={[s.infoText, { color: colors.text }]}>
                            Erstelle hier neue Push-Benachrichtigungs-Kategorien. Diese erscheinen automatisch
                            bei allen Familienmitgliedern in den Einstellungen.
                        </Text>
                    </View>

                    {loading ? (
                        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
                    ) : types.length === 0 ? (
                        <View style={s.emptyState}>
                            <Bell size={48} color={colors.subtext} />
                            <Text style={[s.emptyText, { color: colors.subtext }]}>
                                Noch keine Benachrichtigungstypen erstellt.
                            </Text>
                        </View>
                    ) : (
                        types.map((type) => {
                            const IconComp = getIconComponent(type.icon);
                            return (
                                <View key={type.id} style={[s.typeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={s.typeCardHeader}>
                                        <View style={[s.iconBadge, { backgroundColor: type.color + '20' }]}>
                                            <IconComp size={20} color={type.color} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={[s.typeName, { color: colors.text }]}>{type.name}</Text>
                                                {type.is_critical && (
                                                    <View style={{ backgroundColor: '#EF444420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                        <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}>KRITISCH</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {type.description ? (
                                                <Text style={[s.typeDesc, { color: colors.subtext }]}>{type.description}</Text>
                                            ) : null}
                                            <Text style={[s.typeKey, { color: colors.subtext }]}>Key: {type.category_key}</Text>
                                        </View>
                                        <Switch
                                            value={type.is_active}
                                            onValueChange={() => toggleActive(type)}
                                            trackColor={{ false: '#334155', true: '#3B82F6' }}
                                            thumbColor="#fff"
                                        />
                                    </View>
                                    <View style={[s.typeCardActions, { borderTopColor: colors.border }]}>
                                        <Pressable onPress={() => openEditor(type)} style={s.actionBtn}>
                                            <Edit3 size={16} color={colors.accent} />
                                            <Text style={[s.actionText, { color: colors.accent }]}>Bearbeiten</Text>
                                        </Pressable>
                                        <Pressable onPress={() => setShowCodeSnippet(type)} style={s.actionBtn}>
                                            <Copy size={16} color={colors.subtext} />
                                            <Text style={[s.actionText, { color: colors.subtext }]}>HA Code</Text>
                                        </Pressable>
                                        <Pressable onPress={() => handleDelete(type)} style={s.actionBtn}>
                                            <Trash2 size={16} color="#EF4444" />
                                            <Text style={[s.actionText, { color: '#EF4444' }]}>Löschen</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                {/* FAB */}
                <Pressable
                    onPress={() => openEditor()}
                    style={[s.fab, { backgroundColor: colors.accent }]}
                >
                    <Plus size={28} color="#fff" />
                </Pressable>

                {/* Editor Modal */}
                <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditor(false)}>
                    <View style={[s.container, { backgroundColor: colors.background }]}>
                        <View style={[s.header, { borderBottomColor: colors.border }]}>
                            <Text style={[s.headerTitle, { color: colors.text }]}>
                                {editingType ? 'Bearbeiten' : 'Neue Kategorie'}
                            </Text>
                            <Pressable onPress={() => setShowEditor(false)} style={s.closeBtn}>
                                <X size={24} color={colors.subtext} />
                            </Pressable>
                        </View>
                        <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
                            <Text style={[s.label, { color: colors.subtext }]}>Name *</Text>
                            <TextInput
                                style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                                value={editorName}
                                onChangeText={(v) => {
                                    setEditorName(v);
                                    if (!editingType) setEditorCategoryKey(generateCategoryKey(v));
                                }}
                                placeholder="z.B. Trockner fertig"
                                placeholderTextColor={colors.subtext}
                            />

                            <Text style={[s.label, { color: colors.subtext }]}>Beschreibung</Text>
                            <TextInput
                                style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                                value={editorDescription}
                                onChangeText={setEditorDescription}
                                placeholder="z.B. Wenn der Trockner fertig ist"
                                placeholderTextColor={colors.subtext}
                            />

                            <Text style={[s.label, { color: colors.subtext }]}>Eindeutiger Schlüssel *</Text>
                            <TextInput
                                style={[s.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                                value={editorCategoryKey}
                                onChangeText={setEditorCategoryKey}
                                placeholder="z.B. dryer_done"
                                placeholderTextColor={colors.subtext}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <Text style={[s.hint, { color: colors.subtext }]}>
                                Wird in der HA-Automation als category_key verwendet
                            </Text>

                            <Text style={[s.label, { color: colors.subtext }]}>Kategorie *</Text>
                            <View style={s.iconGrid}>
                                {DISPLAY_GROUP_OPTIONS.map(g => {
                                    const isSelected = editorDisplayGroup === g;
                                    return (
                                        <Pressable
                                            key={g}
                                            onPress={() => setEditorDisplayGroup(g)}
                                            style={[
                                                s.iconOption,
                                                { backgroundColor: colors.card, borderColor: isSelected ? colors.accent : colors.border },
                                                isSelected && { borderWidth: 2 }
                                            ]}
                                        >
                                            <Text style={[s.iconOptionLabel, { color: isSelected ? colors.text : colors.subtext }]}>
                                                {g}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <Text style={[s.hint, { color: colors.subtext }]}>
                                Bestimmt unter welcher Gruppe die Benachrichtigung in den Einstellungen angezeigt wird
                            </Text>

                            <Text style={[s.label, { color: colors.subtext }]}>Icon</Text>
                            <View style={s.iconGrid}>
                                {ICON_OPTIONS.map(opt => {
                                    const IconC = opt.Component;
                                    const isSelected = editorIcon === opt.name;
                                    return (
                                        <Pressable
                                            key={opt.name}
                                            onPress={() => setEditorIcon(opt.name)}
                                            style={[
                                                s.iconOption,
                                                { backgroundColor: colors.card, borderColor: isSelected ? editorColor : colors.border },
                                                isSelected && { borderWidth: 2 }
                                            ]}
                                        >
                                            <IconC size={20} color={isSelected ? editorColor : colors.subtext} />
                                            <Text style={[s.iconOptionLabel, { color: isSelected ? colors.text : colors.subtext }]}>
                                                {opt.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={[s.label, { color: colors.subtext }]}>Farbe</Text>
                            <View style={s.colorGrid}>
                                {COLOR_OPTIONS.map(c => (
                                    <Pressable
                                        key={c}
                                        onPress={() => setEditorColor(c)}
                                        style={[
                                            s.colorOption,
                                            { backgroundColor: c },
                                            editorColor === c && s.colorSelected,
                                        ]}
                                    >
                                        {editorColor === c && <Check size={16} color="#fff" />}
                                    </Pressable>
                                ))}
                            </View>

                            {/* Critical Alert Toggle */}
                            <View style={[s.criticalRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <AlertTriangle size={20} color={editorIsCritical ? '#EF4444' : colors.subtext} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.settingLabel, { color: colors.text }]}>Critical Alert</Text>
                                        <Text style={[s.hint, { color: colors.subtext, marginTop: 2 }]}>
                                            Durchbricht "Nicht stören" auf iOS
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={editorIsCritical}
                                    onValueChange={setEditorIsCritical}
                                    trackColor={{ false: '#334155', true: '#EF4444' }}
                                    thumbColor="#fff"
                                />
                            </View>

                            {/* Sound Selector */}
                            <Text style={[s.label, { color: colors.subtext }]}>Ton</Text>
                            <View style={s.soundGrid}>
                                {SOUND_OPTIONS.map(opt => {
                                    const isSelected = editorSound === opt.value;
                                    return (
                                        <Pressable
                                            key={opt.label}
                                            onPress={() => {
                                                setEditorSound(opt.value);
                                                playPreview(opt.value);
                                            }}
                                            style={[
                                                s.soundOption,
                                                { backgroundColor: colors.card, borderColor: isSelected ? colors.accent : colors.border },
                                                isSelected && { borderWidth: 2 }
                                            ]}
                                        >
                                            {opt.value === null ? (
                                                <VolumeX size={16} color={isSelected ? colors.accent : colors.subtext} />
                                            ) : (
                                                <Volume2 size={16} color={isSelected ? colors.accent : colors.subtext} />
                                            )}
                                            <Text style={[s.soundLabel, { color: isSelected ? colors.text : colors.subtext }]}>
                                                {opt.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>


                            <Pressable
                                onPress={handleSave}
                                disabled={saving}
                                style={[s.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }]}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={s.saveBtnText}>
                                        {editingType ? 'Speichern' : 'Erstellen'}
                                    </Text>
                                )}
                            </Pressable>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </Modal>

                {/* Code Snippet Modal */}
                <Modal
                    visible={!!showCodeSnippet}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowCodeSnippet(null)}
                >
                    <View style={[s.container, { backgroundColor: colors.background }]}>
                        <View style={[s.header, { borderBottomColor: colors.border }]}>
                            <Text style={[s.headerTitle, { color: colors.text }]}>HA Automation Code</Text>
                            <Pressable onPress={() => setShowCodeSnippet(null)} style={s.closeBtn}>
                                <X size={24} color={colors.subtext} />
                            </Pressable>
                        </View>
                        <ScrollView style={s.content}>
                            <View style={[s.infoBox, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}>
                                <Text style={[s.infoText, { color: colors.text }]}>
                                    Kopiere diesen Code und füge ihn in deine Home Assistant Automationen ein.
                                    Passe den Trigger an dein gewünschtes Ereignis an.
                                </Text>
                            </View>

                            {showCodeSnippet && (
                                <View style={[s.codeBlock, { backgroundColor: '#1E293B', borderColor: colors.border }]}>
                                    <Text style={s.codeText}>
                                        {getCodeSnippet(showCodeSnippet)}
                                    </Text>
                                </View>
                            )}

                            {showCodeSnippet && (
                                <Pressable
                                    onPress={() => handleCopySnippet(showCodeSnippet)}
                                    style={[s.saveBtn, { backgroundColor: copied ? '#10B981' : colors.accent }]}
                                >
                                    {copied ? (
                                        <>
                                            <Check size={20} color="#fff" />
                                            <Text style={[s.saveBtnText, { marginLeft: 8 }]}>Kopiert!</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={20} color="#fff" />
                                            <Text style={[s.saveBtnText, { marginLeft: 8 }]}>Code kopieren</Text>
                                        </>
                                    )}
                                </Pressable>
                            )}

                            <View style={[s.infoBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)', marginTop: 16 }]}>
                                <Text style={[s.infoText, { color: '#F59E0B' }]}>
                                    Wichtig: Der REST-Command "send_push_notification" muss in deiner
                                    configuration.yaml eingerichtet sein. Das Feld "data.category_key"
                                    sorgt dafür, dass nur User mit aktivierter Kategorie benachrichtigt werden.
                                </Text>
                            </View>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    infoBox: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 20,
    },
    infoText: {
        fontSize: 13,
        lineHeight: 19,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
    },
    typeCard: {
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
        overflow: 'hidden',
    },
    typeCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeName: {
        fontSize: 16,
        fontWeight: '600',
    },
    typeDesc: {
        fontSize: 12,
        marginTop: 2,
    },
    typeKey: {
        fontSize: 11,
        marginTop: 2,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    typeCardActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '500',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
        marginTop: 16,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
    },
    hint: {
        fontSize: 11,
        marginTop: 4,
        fontStyle: 'italic',
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    iconOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    iconOptionLabel: {
        fontSize: 12,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    colorOption: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorSelected: {
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 4,
    },
    criticalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 16,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    soundGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    soundOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    soundLabel: {
        fontSize: 12,
    },
    saveBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 24,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    codeBlock: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    codeText: {
        color: '#E2E8F0',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 18,
    },
});

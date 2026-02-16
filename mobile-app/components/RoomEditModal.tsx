import React, { useState, useMemo } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    X, Check, Search, Plus, Trash2,
    Home, Bed, Sofa, UtensilsCrossed, Bath, Warehouse, Building2,
    Lightbulb, Blinds, Briefcase, Baby, Dumbbell, Shirt,
    TreeDeciduous, Droplets, Thermometer, Gamepad2, BookOpen,
    Armchair, DoorOpen, ChevronUp, ParkingSquare, Flower2,
    Sun, Moon, Tv, Music, Coffee, Zap, Camera, Star, Rocket, Crown, Heart
} from 'lucide-react-native';

// Available Icons for Selection
const AVAILABLE_ICONS = [
    { name: 'Home', icon: Home },
    { name: 'Sofa', icon: Sofa },
    { name: 'Bed', icon: Bed },
    { name: 'Kitchen', icon: UtensilsCrossed },
    { name: 'Bath', icon: Bath },
    { name: 'Office', icon: Briefcase },
    { name: 'Kids', icon: Baby },
    { name: 'Gym', icon: Dumbbell },
    { name: 'Laundry', icon: Shirt },
    { name: 'Garden', icon: Flower2 },
    { name: 'Terrace', icon: TreeDeciduous },
    { name: 'Pool', icon: Droplets },
    { name: 'Garage', icon: ParkingSquare },
    { name: 'Basement', icon: Warehouse },
    { name: 'Gaming', icon: Gamepad2 },
    { name: 'Library', icon: BookOpen },
    { name: 'Dining', icon: Armchair },
    { name: 'Hall', icon: DoorOpen },
    { name: 'Stairs', icon: ChevronUp },
    { name: 'Attic', icon: Building2 }, // Fallback
    { name: 'Cinema', icon: Tv },
    { name: 'Music', icon: Music },
    { name: 'Coffee', icon: Coffee },
    { name: 'Power', icon: Zap },
    { name: 'Camera', icon: Camera },
    { name: 'Star', icon: Star },
    { name: 'Rocket', icon: Rocket },
    { name: 'Crown', icon: Crown },
    { name: 'Heart', icon: Heart }
];

interface RoomEditModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (room: any) => void;
    onDelete?: (roomId: string) => void;
    initialRoom?: any | null;
}

export function RoomEditModal({ visible, onClose, onSave, onDelete, initialRoom }: RoomEditModalProps) {
    const { entities, getEntityPictureUrl } = useHomeAssistant();
    const { colors } = useTheme();

    const [name, setName] = useState(initialRoom?.name || '');
    const [selectedIconName, setSelectedIconName] = useState(initialRoom?.iconName || 'Home');
    const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(initialRoom?.entities || []);
    const [searchQuery, setSearchQuery] = useState('');

    // Reset state when opening for new room
    React.useEffect(() => {
        if (visible) {
            if (initialRoom) {
                setName(initialRoom.name);
                setSelectedIconName(initialRoom.iconName || 'Home');
                setSelectedEntityIds(initialRoom.entities || []);
            } else {
                setName('');
                setSelectedIconName('Home');
                setSelectedEntityIds([]);
            }
            setSearchQuery('');
        }
    }, [visible, initialRoom]);

    const filteredEntities = useMemo(() => {
        if (!searchQuery) return entities.slice(0, 50); // Show first 50 default
        const lowerQuery = searchQuery.toLowerCase();
        return entities.filter(e =>
            e.entity_id.toLowerCase().includes(lowerQuery) ||
            (e.attributes.friendly_name?.toLowerCase() || '').includes(lowerQuery)
        ).slice(0, 50);
    }, [entities, searchQuery]);

    const handleSave = () => {
        if (!name.trim()) return;

        const newRoom = {
            id: initialRoom?.id || Date.now().toString(),
            name: name.trim(),
            iconName: selectedIconName,
            entities: selectedEntityIds
        };
        onSave(newRoom);
        onClose();
    };

    const toggleEntity = (entityId: string) => {
        if (selectedEntityIds.includes(entityId)) {
            setSelectedEntityIds(prev => prev.filter(id => id !== entityId));
        } else {
            setSelectedEntityIds(prev => [...prev, entityId]);
        }
    };

    const SelectedIcon = AVAILABLE_ICONS.find(i => i.name === selectedIconName)?.icon || Home;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        {initialRoom ? 'Raum bearbeiten' : 'Neuer Raum'}
                    </Text>
                    <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.card }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                    {/* Name Input */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: colors.subtext }]}>NAME</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                            value={name}
                            onChangeText={setName}
                            placeholder="z.B. Gästezimmer"
                            placeholderTextColor={colors.subtext}
                        />
                    </View>

                    {/* Icon Picker */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: colors.subtext }]}>ICON</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
                            {AVAILABLE_ICONS.map((item) => {
                                const isSelected = item.name === selectedIconName;
                                return (
                                    <Pressable
                                        key={item.name}
                                        onPress={() => setSelectedIconName(item.name)}
                                        style={[
                                            styles.iconOption,
                                            { backgroundColor: isSelected ? colors.accent : colors.card, borderColor: isSelected ? colors.accent : colors.border }
                                        ]}
                                    >
                                        <item.icon size={24} color={isSelected ? '#FFF' : colors.subtext} />
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Entity Picker */}
                    <View style={[styles.section, { flex: 1 }]}>
                        <Text style={[styles.label, { color: colors.subtext }]}>GERÄTE ({selectedEntityIds.length})</Text>

                        {/* Search Bar */}
                        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Search size={20} color={colors.subtext} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Geräte suchen..."
                                placeholderTextColor={colors.subtext}
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')}>
                                    <X size={16} color={colors.subtext} />
                                </Pressable>
                            )}
                        </View>

                        {/* List */}
                        <View style={styles.listContainer}>
                            {filteredEntities.map((entity) => {
                                const isSelected = selectedEntityIds.includes(entity.entity_id);
                                const domain = entity.entity_id.split('.')[0];

                                // Only show relevant domains for rooms
                                if (!['light', 'switch', 'cover', 'media_player', 'climate', 'sensor', 'binary_sensor', 'camera', 'scene', 'script', 'input_select', 'input_boolean', 'input_number'].includes(domain)) {
                                    if (!isSelected && searchQuery === '') return null; // Hide obscure entities unless searching or selected
                                }

                                return (
                                    <Pressable
                                        key={entity.entity_id}
                                        onPress={() => toggleEntity(entity.entity_id)}
                                        style={[styles.entityRow, { borderBottomColor: colors.border, backgroundColor: isSelected ? colors.card : 'transparent' }]}
                                    >
                                        <View style={[styles.checkCircle, { borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' }]}>
                                            {isSelected && <Check size={14} color="#FFF" />}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text numberOfLines={1} style={[styles.entityName, { color: colors.text, fontWeight: isSelected ? '700' : '400' }]}>
                                                {entity.attributes.friendly_name || entity.entity_id}
                                            </Text>
                                            <Text numberOfLines={1} style={[styles.entityId, { color: colors.subtext }]}>
                                                {entity.entity_id}
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                            {filteredEntities.length === 0 && (
                                <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 20 }}>Keine Ergebnisse</Text>
                            )}
                        </View>
                    </View>
                </ScrollView>

                {/* Footer Buttons */}
                <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                    {initialRoom && onDelete && (
                        <Pressable
                            onPress={() => onDelete(initialRoom.id)}
                            style={[styles.deleteButton, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
                        >
                            <Trash2 size={24} color="#EF4444" />
                        </Pressable>
                    )}
                    <Pressable
                        onPress={handleSave}
                        style={[styles.saveButton, { backgroundColor: colors.accent, flex: 1, opacity: name.trim() ? 1 : 0.5 }]}
                        disabled={!name.trim()}
                    >
                        <Text style={styles.saveButtonText}>Speichern</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: 20,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 8, borderRadius: 20 },
    content: { flex: 1, padding: 16 },
    section: { marginBottom: 24 },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 12, letterSpacing: 1 },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    iconOption: {
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 12,
        gap: 8,
    },
    searchInput: { flex: 1, fontSize: 16 },
    listContainer: { gap: 0 },
    entityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        gap: 12,
        borderRadius: 8,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    entityName: { fontSize: 16 },
    entityId: { fontSize: 12 },
    footer: {
        padding: 16,
        flexDirection: 'row',
        gap: 16,
        borderTopWidth: 1,
    },
    saveButton: {
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    deleteButton: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

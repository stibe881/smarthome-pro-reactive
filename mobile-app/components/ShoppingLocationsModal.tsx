import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Alert, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Plus, MapPin, Trash2, Navigation, Store } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { DEFAULT_SHOPS, ShoppingLocation } from '../contexts/HomeAssistantContext';

const SHOPS_STORAGE_KEY = '@smarthome_shopping_locations';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export const ShoppingLocationsModal = ({ visible, onClose }: Props) => {
    const { colors } = useTheme();
    const [shops, setShops] = useState<ShoppingLocation[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newLat, setNewLat] = useState('');
    const [newLng, setNewLng] = useState('');
    const [isLocating, setIsLocating] = useState(false);

    // Load shops
    useEffect(() => {
        if (visible) loadShops();
    }, [visible]);

    const loadShops = async () => {
        try {
            const stored = await AsyncStorage.getItem(SHOPS_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setShops(parsed);
                    return;
                }
            }
            // No custom list yet — use defaults
            setShops([...DEFAULT_SHOPS]);
        } catch {
            setShops([...DEFAULT_SHOPS]);
        }
    };

    const saveShops = async (updated: ShoppingLocation[]) => {
        setShops(updated);
        await AsyncStorage.setItem(SHOPS_STORAGE_KEY, JSON.stringify(updated));
    };

    const handleAddShop = async () => {
        const lat = parseFloat(newLat);
        const lng = parseFloat(newLng);
        if (!newName.trim()) {
            Alert.alert('Fehler', 'Bitte gib einen Namen ein.');
            return;
        }
        if (isNaN(lat) || isNaN(lng)) {
            Alert.alert('Fehler', 'Ungültige Koordinaten.');
            return;
        }
        const updated = [...shops, { name: newName.trim(), lat, lng }].sort((a, b) => a.name.localeCompare(b.name, 'de'));
        await saveShops(updated);
        setNewName('');
        setNewLat('');
        setNewLng('');
        setShowAddForm(false);
    };

    const handleDelete = (index: number) => {
        const shop = shops[index];
        Alert.alert(
            'Löschen',
            `"${shop.name}" wirklich entfernen?`,
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Löschen', style: 'destructive', onPress: async () => {
                        const updated = shops.filter((_, i) => i !== index);
                        await saveShops(updated);
                    }
                },
            ]
        );
    };

    const handleGetCurrentLocation = async () => {
        setIsLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Berechtigung fehlt', 'Standortzugriff wurde nicht erlaubt.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setNewLat(loc.coords.latitude.toFixed(6));
            setNewLng(loc.coords.longitude.toFixed(6));
        } catch (e) {
            Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
        } finally {
            setIsLocating(false);
        }
    };

    const handleResetToDefaults = () => {
        Alert.alert(
            'Zurücksetzen',
            'Alle Standorte auf Standardwerte zurücksetzen?',
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Zurücksetzen', style: 'destructive', onPress: async () => {
                        await saveShops([...DEFAULT_SHOPS]);
                    }
                },
            ]
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        {/* Header */}
                        <View style={[styles.header, { backgroundColor: colors.accent }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Store size={22} color="#fff" />
                                <Text style={styles.headerTitle}>Einkaufsstandorte</Text>
                            </View>
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <X size={22} color="#fff" />
                            </Pressable>
                        </View>

                        <Text style={[styles.description, { color: colors.subtext }]}>
                            Push-Benachrichtigung wenn du dich in der Nähe eines Ladens befindest und Artikel auf der Einkaufsliste stehen.
                        </Text>

                        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
                            {/* Shop List */}
                            {shops.map((shop, index) => (
                                <View key={`${shop.name}-${index}`} style={[styles.shopRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={[styles.shopIcon, { backgroundColor: colors.accent + '20' }]}>
                                        <MapPin size={18} color={colors.accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.shopName, { color: colors.text }]}>{shop.name}</Text>
                                        <Text style={[styles.shopCoords, { color: colors.subtext }]}>
                                            {shop.lat.toFixed(4)}, {shop.lng.toFixed(4)}
                                        </Text>
                                    </View>
                                    <Pressable onPress={() => handleDelete(index)} hitSlop={8} style={styles.deleteBtn}>
                                        <Trash2 size={18} color={colors.error || '#EF4444'} />
                                    </Pressable>
                                </View>
                            ))}

                            {/* Add Form */}
                            {showAddForm ? (
                                <View style={[styles.addForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[styles.addFormTitle, { color: colors.text }]}>Neuen Standort hinzufügen</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                        placeholder="Name (z.B. Migros Sursee)"
                                        placeholderTextColor={colors.subtext}
                                        value={newName}
                                        onChangeText={setNewName}
                                    />
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            placeholder="Breitengrad"
                                            placeholderTextColor={colors.subtext}
                                            keyboardType="decimal-pad"
                                            value={newLat}
                                            onChangeText={setNewLat}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            placeholder="Längengrad"
                                            placeholderTextColor={colors.subtext}
                                            keyboardType="decimal-pad"
                                            value={newLng}
                                            onChangeText={setNewLng}
                                        />
                                    </View>
                                    {/* Get Current Location */}
                                    <Pressable
                                        onPress={handleGetCurrentLocation}
                                        style={[styles.locationBtn, { backgroundColor: colors.success + '20', borderColor: colors.success + '40' }]}
                                    >
                                        <Navigation size={16} color={colors.success} />
                                        <Text style={{ color: colors.success, fontWeight: '600', fontSize: 14 }}>
                                            {isLocating ? 'Ermittle Standort...' : 'Aktuellen Standort verwenden'}
                                        </Text>
                                    </Pressable>

                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                        <Pressable
                                            onPress={() => { setShowAddForm(false); setNewName(''); setNewLat(''); setNewLng(''); }}
                                            style={[styles.formBtn, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                                        >
                                            <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={handleAddShop}
                                            style={[styles.formBtn, { backgroundColor: colors.accent, flex: 2 }]}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '700' }}>Hinzufügen</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : (
                                <Pressable
                                    onPress={() => setShowAddForm(true)}
                                    style={[styles.addBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]}
                                >
                                    <Plus size={20} color={colors.accent} />
                                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>Standort hinzufügen</Text>
                                </Pressable>
                            )}

                            {/* Reset to defaults */}
                            <Pressable onPress={handleResetToDefaults} style={[styles.resetBtn, { borderColor: colors.border }]}>
                                <Text style={{ color: colors.subtext, fontSize: 13 }}>Auf Standardwerte zurücksetzen</Text>
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1 },
    container: { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
    header: {
        paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20,
        borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
    description: { fontSize: 13, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, lineHeight: 18 },
    body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
    shopRow: {
        flexDirection: 'row', alignItems: 'center', padding: 14,
        borderRadius: 16, marginBottom: 8, borderWidth: 1, gap: 12,
    },
    shopIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    shopName: { fontSize: 15, fontWeight: '600' },
    shopCoords: { fontSize: 11, marginTop: 2 },
    deleteBtn: { padding: 8 },
    addForm: { borderRadius: 16, padding: 16, marginTop: 4, borderWidth: 1, gap: 10 },
    addFormTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    input: { height: 44, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1 },
    locationBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    },
    formBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    addBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 16, borderRadius: 16, marginTop: 4, borderWidth: 1, borderStyle: 'dashed',
    },
    resetBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 20, borderTopWidth: 1 },
});

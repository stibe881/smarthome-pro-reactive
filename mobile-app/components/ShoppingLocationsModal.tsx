import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Alert, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { X, Plus, MapPin, Trash2, Navigation, Store } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useHousehold } from '../hooks/useHousehold';

interface ShoppingLocation {
    id: string; // UUID from Supabase
    name: string;
    lat: number;
    lng: number;
}

interface Props {
    visible: boolean;
    onClose: () => void;
}

export const ShoppingLocationsModal = ({ visible, onClose }: Props) => {
    const { colors } = useTheme();
    const { householdId, loading: householdLoading } = useHousehold();
    const [shops, setShops] = useState<ShoppingLocation[]>([]);
    const [loading, setLoading] = useState(false);

    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newLat, setNewLat] = useState('');
    const [newLng, setNewLng] = useState('');
    const [isLocating, setIsLocating] = useState(false);

    // Load shops when visible and household is ready
    useEffect(() => {
        if (visible && householdId) {
            loadShops();
        }
    }, [visible, householdId]);

    const loadShops = async () => {
        if (!householdId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('shopping_locations')
                .select('*')
                .eq('household_id', householdId)
                .order('name', { ascending: true });

            if (error) throw error;
            setShops(data || []);

            // Sync to AsyncStorage for background task
            if (data && data.length > 0) {
                const forStorage = data.map((s: any) => ({ name: s.name, lat: s.lat, lng: s.lng }));
                await AsyncStorage.setItem('@smarthome_shopping_locations', JSON.stringify(forStorage));
                console.log(`🛒 Synced ${data.length} shops to AsyncStorage`);
            } else {
                await AsyncStorage.removeItem('@smarthome_shopping_locations');
            }
        } catch (e: any) {
            console.error('Error loading shops:', e);
            Alert.alert('Fehler', 'Konnte Einkaufsstandorte nicht laden.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddShop = async () => {
        if (!householdId) return;

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

        try {
            const { error } = await supabase
                .from('shopping_locations')
                .insert({
                    household_id: householdId,
                    name: newName.trim(),
                    lat,
                    lng
                });

            if (error) throw error;

            await loadShops();
            setNewName('');
            setNewLat('');
            setNewLng('');
            setShowAddForm(false);
        } catch (e: any) {
            Alert.alert('Fehler', 'Konnte Standort nicht speichern: ' + e.message);
        }
    };

    const handleDelete = (id: string, name: string) => {
        Alert.alert(
            'Löschen',
            `"${name}" wirklich entfernen?`,
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Löschen', style: 'destructive', onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('shopping_locations')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;
                            loadShops();
                        } catch (e: any) {
                            Alert.alert('Fehler', 'Konnte Standort nicht löschen.');
                        }
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
                            Push-Benachrichtigung wenn du dich in der Nähe eines Ladens befindest und Artikel auf der Einkaufsliste stehen. (Synchronisiert für alle Nutzer im Haushalt)
                        </Text>

                        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
                            {loading ? (
                                <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />
                            ) : (
                                <>
                                    {/* Shop List */}
                                    {shops.map((shop) => (
                                        <View key={shop.id} style={[styles.shopRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                            <View style={[styles.shopIcon, { backgroundColor: colors.accent + '20' }]}>
                                                <MapPin size={18} color={colors.accent} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.shopName, { color: colors.text }]}>{shop.name}</Text>
                                                <Text style={[styles.shopCoords, { color: colors.subtext }]}>
                                                    {shop.lat.toFixed(4)}, {shop.lng.toFixed(4)}
                                                </Text>
                                            </View>
                                            <Pressable onPress={() => handleDelete(shop.id, shop.name)} hitSlop={8} style={styles.deleteBtn}>
                                                <Trash2 size={18} color={colors.error || '#EF4444'} />
                                            </Pressable>
                                        </View>
                                    ))}

                                    {shops.length === 0 && !showAddForm && (
                                        <Text style={{ textAlign: 'center', color: colors.subtext, marginTop: 20 }}>
                                            Keine Standorte definiert.
                                        </Text>
                                    )}
                                </>
                            )}

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

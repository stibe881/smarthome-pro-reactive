import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Alert, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { X, Plus, MapPin, Trash2, Navigation, Store, Search, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useHousehold } from '../hooks/useHousehold';

interface ShoppingLocation {
    id: string;
    name: string;
    lat: number;
    lng: number;
}

interface Props {
    visible: boolean;
    onClose: () => void;
}

type SearchState = 'idle' | 'searching' | 'found' | 'not_found' | 'manual';

export const ShoppingLocationsModal = ({ visible, onClose }: Props) => {
    const { colors } = useTheme();
    const { householdId, loading: householdLoading } = useHousehold();
    const [shops, setShops] = useState<ShoppingLocation[]>([]);
    const [loading, setLoading] = useState(false);

    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchState, setSearchState] = useState<SearchState>('idle');
    const [foundAddress, setFoundAddress] = useState('');
    const [foundLat, setFoundLat] = useState(0);
    const [foundLng, setFoundLng] = useState(0);

    // Manual fallback
    const [manualAddress, setManualAddress] = useState('');

    // Current location
    const [isLocating, setIsLocating] = useState(false);

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

            if (data && data.length > 0) {
                const forStorage = data.map((s: any) => ({ name: s.name, lat: s.lat, lng: s.lng }));
                await AsyncStorage.setItem('@smarthome_shopping_locations', JSON.stringify(forStorage));
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

    // ── Smart Search (Geocoding) ──
    const handleSearch = async () => {
        const query = searchQuery.trim();
        if (!query) {
            Alert.alert('Hinweis', 'Bitte gib einen Laden oder eine Adresse ein (z.B. "Migros, Zell")');
            return;
        }

        setSearchState('searching');
        try {
            const results = await Location.geocodeAsync(query);
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];
                setFoundLat(latitude);
                setFoundLng(longitude);

                // Reverse geocode to get a human-readable address
                const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (addresses && addresses.length > 0) {
                    const a = addresses[0];
                    const parts = [a.name, a.street, a.city].filter(Boolean);
                    setFoundAddress(parts.join(', '));
                } else {
                    setFoundAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                }

                setSearchState('found');
            } else {
                setSearchState('not_found');
            }
        } catch (e) {
            console.warn('Geocode failed:', e);
            setSearchState('not_found');
        }
    };

    // ── Manual Address Search ──
    const handleManualSearch = async () => {
        const query = manualAddress.trim();
        if (!query) return;

        setSearchState('searching');
        try {
            const results = await Location.geocodeAsync(query);
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];
                setFoundLat(latitude);
                setFoundLng(longitude);

                const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (addresses && addresses.length > 0) {
                    const a = addresses[0];
                    const parts = [a.name, a.street, a.city].filter(Boolean);
                    setFoundAddress(parts.join(', '));
                } else {
                    setFoundAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                }
                setSearchState('found');
            } else {
                Alert.alert('Nicht gefunden', 'Die Adresse konnte nicht gefunden werden. Bitte versuche es mit einer genaueren Angabe.');
                setSearchState('manual');
            }
        } catch (e) {
            Alert.alert('Fehler', 'Suche fehlgeschlagen.');
            setSearchState('manual');
        }
    };

    // ── Use Current Location ──
    const handleGetCurrentLocation = async () => {
        setIsLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Berechtigung fehlt', 'Standortzugriff wurde nicht erlaubt.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setFoundLat(loc.coords.latitude);
            setFoundLng(loc.coords.longitude);

            const addresses = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });
            if (addresses && addresses.length > 0) {
                const a = addresses[0];
                const parts = [a.name, a.street, a.city].filter(Boolean);
                setFoundAddress(parts.join(', '));
            } else {
                setFoundAddress(`${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
            }
            setSearchState('found');
        } catch (e) {
            Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
        } finally {
            setIsLocating(false);
        }
    };

    // ── Confirm & Save ──
    const handleConfirmAndSave = async () => {
        if (!householdId) return;
        const name = newName.trim() || searchQuery.trim();
        if (!name) {
            Alert.alert('Fehler', 'Bitte gib einen Namen ein.');
            return;
        }

        try {
            const { error } = await supabase
                .from('shopping_locations')
                .insert({
                    household_id: householdId,
                    name,
                    lat: foundLat,
                    lng: foundLng,
                });

            if (error) throw error;

            await loadShops();
            resetForm();
        } catch (e: any) {
            Alert.alert('Fehler', 'Konnte Standort nicht speichern: ' + e.message);
        }
    };

    const resetForm = () => {
        setShowAddForm(false);
        setNewName('');
        setSearchQuery('');
        setSearchState('idle');
        setFoundAddress('');
        setFoundLat(0);
        setFoundLng(0);
        setManualAddress('');
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

                        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
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

                                    {/* Step 1: Name */}
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                        placeholder="Name (z.B. Migros Zell)"
                                        placeholderTextColor={colors.subtext}
                                        value={newName}
                                        onChangeText={setNewName}
                                    />

                                    {/* Step 2: Search by store name */}
                                    {searchState !== 'found' && (
                                        <>
                                            {searchState !== 'manual' ? (
                                                <>
                                                    <Text style={[styles.stepLabel, { color: colors.subtext }]}>LADEN SUCHEN</Text>
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        <TextInput
                                                            style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                                            placeholder="z.B. Migros, Zell"
                                                            placeholderTextColor={colors.subtext}
                                                            value={searchQuery}
                                                            onChangeText={setSearchQuery}
                                                            onSubmitEditing={handleSearch}
                                                        />
                                                        <Pressable
                                                            onPress={handleSearch}
                                                            style={[styles.searchBtn, { backgroundColor: colors.accent }]}
                                                        >
                                                            {searchState === 'searching'
                                                                ? <ActivityIndicator size="small" color="#fff" />
                                                                : <Search size={20} color="#fff" />
                                                            }
                                                        </Pressable>
                                                    </View>
                                                </>
                                            ) : (
                                                /* Manual address fallback */
                                                <>
                                                    <Text style={[styles.stepLabel, { color: colors.subtext }]}>ADRESSE EINGEBEN</Text>
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        <TextInput
                                                            style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                                            placeholder="z.B. Bahnhofstrasse 1, 6130 Willisau"
                                                            placeholderTextColor={colors.subtext}
                                                            value={manualAddress}
                                                            onChangeText={setManualAddress}
                                                            onSubmitEditing={handleManualSearch}
                                                        />
                                                        <Pressable
                                                            onPress={handleManualSearch}
                                                            style={[styles.searchBtn, { backgroundColor: colors.accent }]}
                                                        >
                                                            {searchState === 'searching'
                                                                ? <ActivityIndicator size="small" color="#fff" />
                                                                : <Search size={20} color="#fff" />
                                                            }
                                                        </Pressable>
                                                    </View>
                                                </>
                                            )}

                                            {/* Not found message */}
                                            {searchState === 'not_found' && (
                                                <View style={[styles.resultCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                                    <AlertCircle size={20} color="#EF4444" />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: '#991B1B', fontWeight: '600', fontSize: 14 }}>Nicht gefunden</Text>
                                                        <Text style={{ color: '#B91C1C', fontSize: 12, marginTop: 2 }}>
                                                            Versuche es mit einer genaueren Angabe oder gib die Adresse ein.
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Alternative options */}
                                            {(searchState === 'not_found' || searchState === 'idle') && (
                                                <View style={{ gap: 6, marginTop: 4 }}>
                                                    {searchState === 'not_found' && (
                                                        <Pressable
                                                            onPress={() => setSearchState('manual')}
                                                            style={[styles.altBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                                                        >
                                                            <MapPin size={16} color={colors.accent} />
                                                            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Adresse manuell eingeben</Text>
                                                        </Pressable>
                                                    )}
                                                    <Pressable
                                                        onPress={handleGetCurrentLocation}
                                                        style={[styles.altBtn, { backgroundColor: (colors.success || '#10B981') + '15', borderColor: (colors.success || '#10B981') + '40' }]}
                                                    >
                                                        <Navigation size={16} color={colors.success || '#10B981'} />
                                                        <Text style={{ color: colors.success || '#10B981', fontWeight: '600', fontSize: 13 }}>
                                                            {isLocating ? 'Ermittle...' : 'Aktuellen Standort verwenden'}
                                                        </Text>
                                                    </Pressable>
                                                </View>
                                            )}

                                            {searchState === 'manual' && (
                                                <Pressable
                                                    onPress={() => setSearchState('idle')}
                                                    style={{ marginTop: 4 }}
                                                >
                                                    <Text style={{ color: colors.accent, fontSize: 13, textAlign: 'center' }}>← Zurück zur Suche</Text>
                                                </Pressable>
                                            )}
                                        </>
                                    )}

                                    {/* Found Result */}
                                    {searchState === 'found' && (
                                        <View style={[styles.resultCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                                            <CheckCircle size={20} color="#16A34A" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: '#166534', fontWeight: '600', fontSize: 14 }}>Gefunden!</Text>
                                                <Text style={{ color: '#15803D', fontSize: 12, marginTop: 2 }}>{foundAddress}</Text>
                                                <Text style={{ color: '#22C55E', fontSize: 10, marginTop: 2 }}>
                                                    {foundLat.toFixed(5)}, {foundLng.toFixed(5)}
                                                </Text>
                                            </View>
                                            <Pressable
                                                onPress={() => { setSearchState('idle'); setFoundAddress(''); }}
                                                style={{ padding: 4 }}
                                            >
                                                <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '600' }}>Ändern</Text>
                                            </Pressable>
                                        </View>
                                    )}

                                    {/* Action Buttons */}
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                        <Pressable
                                            onPress={resetForm}
                                            style={[styles.formBtn, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                                        >
                                            <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={handleConfirmAndSave}
                                            disabled={searchState !== 'found'}
                                            style={[styles.formBtn, {
                                                backgroundColor: searchState === 'found' ? colors.accent : colors.border,
                                                flex: 2,
                                                opacity: searchState === 'found' ? 1 : 0.5,
                                            }]}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '700' }}>Speichern</Text>
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
    stepLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
    searchBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    resultCard: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 12, borderRadius: 12, borderWidth: 1,
    },
    altBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 10, borderWidth: 1,
    },
    formBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    addBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 16, borderRadius: 16, marginTop: 4, borderWidth: 1, borderStyle: 'dashed',
    },
});

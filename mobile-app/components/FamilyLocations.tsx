import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Platform, AppState,
} from 'react-native';
import {
    X, MapPin, Navigation, RefreshCw, Clock, Users,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface MemberLocation {
    id: string;
    household_id: string;
    user_id: string;
    member_name: string;
    latitude: number;
    longitude: number;
    address: string | null;
    updated_at: string;
    sharing_enabled: boolean;
}

interface FamilyLocationsProps {
    visible: boolean;
    onClose: () => void;
}

export function FamilyLocations({ visible, onClose }: FamilyLocationsProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [locations, setLocations] = useState<MemberLocation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSharingEnabled, setIsSharingEnabled] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const loadLocations = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_locations')
                .select('*')
                .eq('household_id', householdId)
                .eq('sharing_enabled', true);
            if (error) throw error;
            setLocations(data || []);

            // Check if current user is sharing
            const myLoc = (data || []).find(l => l.user_id === user?.id);
            if (myLoc) setIsSharingEnabled(true);
        } catch (e: any) {
            console.error('Error loading locations:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, user?.id]);

    useEffect(() => { if (visible) loadLocations(); }, [visible, loadLocations]);

    const getTimeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Gerade eben';
        if (mins < 60) return `vor ${mins} Min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `vor ${hours} Std`;
        return `vor ${Math.floor(hours / 24)} Tagen`;
    };

    const updateMyLocation = async () => {
        if (!householdId || !user?.id) return;
        setIsUpdating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Standortzugriff in den Einstellungen.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            let address: string | null = null;
            try {
                const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                if (geo) {
                    address = [geo.street, geo.streetNumber, geo.city].filter(Boolean).join(', ');
                }
            } catch (e) { }

            // Get display name from family members
            const { data: memberData } = await supabase
                .from('family_members')
                .select('display_name, email')
                .eq('household_id', householdId)
                .eq('user_id', user.id)
                .single();

            const memberName = memberData?.display_name || memberData?.email?.split('@')[0] || 'Unbekannt';

            const { error } = await supabase
                .from('family_locations')
                .upsert({
                    household_id: householdId,
                    user_id: user.id,
                    member_name: memberName,
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    address,
                    sharing_enabled: true,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'household_id,user_id' });

            if (error) throw error;
            setIsSharingEnabled(true);
            loadLocations();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const toggleSharing = async () => {
        if (!householdId || !user?.id) return;
        if (isSharingEnabled) {
            // Disable sharing
            await supabase.from('family_locations')
                .update({ sharing_enabled: false })
                .eq('household_id', householdId)
                .eq('user_id', user.id);
            setIsSharingEnabled(false);
            loadLocations();
        } else {
            updateMyLocation();
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Standort teilen</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                    {/* My Sharing Control */}
                    <View style={[styles.sharingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.sharingTitle, { color: colors.text }]}>Mein Standort</Text>
                            <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2 }}>
                                {isSharingEnabled ? 'Dein Standort wird geteilt' : 'Standort teilen deaktiviert'}
                            </Text>
                        </View>
                        <Pressable
                            style={[styles.shareBtn, { backgroundColor: isSharingEnabled ? '#EF444420' : colors.accent + '20' }]}
                            onPress={toggleSharing}
                        >
                            <Text style={{ color: isSharingEnabled ? '#EF4444' : colors.accent, fontWeight: '700', fontSize: 13 }}>
                                {isSharingEnabled ? 'Deaktivieren' : 'Aktivieren'}
                            </Text>
                        </Pressable>
                    </View>

                    {isSharingEnabled && (
                        <Pressable
                            style={[styles.updateBtn, { backgroundColor: colors.accent }]}
                            onPress={updateMyLocation}
                            disabled={isUpdating}
                        >
                            {isUpdating ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <RefreshCw size={16} color="#fff" />
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Standort aktualisieren</Text>
                                </>
                            )}
                        </Pressable>
                    )}

                    {/* Family Members Locations */}
                    <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>👨‍👩‍👧‍👦 Familie</Text>

                    {isLoading ? (
                        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                    ) : locations.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={{ fontSize: 48 }}>📍</Text>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                Noch niemand teilt seinen Standort.{'\n'}Aktiviere die Standortfreigabe oben.
                            </Text>
                        </View>
                    ) : (
                        locations.map(loc => (
                            <View key={loc.id} style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={[styles.avatarCircle, { backgroundColor: colors.accent + '20' }]}>
                                    <Text style={{ fontSize: 20 }}>📍</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.memberName, { color: colors.text }]}>{loc.member_name}</Text>
                                    {loc.address ? (
                                        <View style={styles.addressRow}>
                                            <MapPin size={12} color={colors.subtext} />
                                            <Text style={{ color: colors.subtext, fontSize: 13, flex: 1 }} numberOfLines={1}>{loc.address}</Text>
                                        </View>
                                    ) : (
                                        <Text style={{ color: colors.subtext, fontSize: 13 }}>
                                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                        </Text>
                                    )}
                                    <View style={styles.timeRow}>
                                        <Clock size={10} color={colors.subtext} />
                                        <Text style={{ color: colors.subtext, fontSize: 11 }}>{getTimeAgo(loc.updated_at)}</Text>
                                    </View>
                                </View>
                                {loc.user_id === user?.id && (
                                    <View style={[styles.meBadge, { backgroundColor: colors.accent + '15' }]}>
                                        <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '700' }}>ICH</Text>
                                    </View>
                                )}
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: '800' },

    sharingCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    sharingTitle: { fontSize: 16, fontWeight: '700' },
    shareBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    updateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 4 },

    sectionTitle: { fontSize: 16, fontWeight: '800' },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 },

    locationCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 8 },
    avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    memberName: { fontSize: 15, fontWeight: '700' },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    meBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});

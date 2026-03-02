import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, Image,
    ActivityIndicator, Alert, Modal, Platform, Dimensions,
} from 'react-native';
import {
    X, MapPin, RefreshCw, Clock,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

// Lazy-load react-native-maps to avoid crash when native module isn't available
let MapView: any = null;
let Marker: any = null;
let mapsAvailable = false;
try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    mapsAvailable = true;
} catch (e) {
    console.log('[FamilyLocations] react-native-maps not available, showing fallback');
}

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

interface FamilyMemberInfo {
    user_id: string | null;
    avatar_url: string | null;
    display_name: string | null;
    email: string;
}

interface FamilyLocationsProps {
    visible: boolean;
    onClose: () => void;
}

const AVATAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#14B8A6'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function FamilyLocations({ visible, onClose }: FamilyLocationsProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();
    const mapRef = useRef<any>(null);

    const [locations, setLocations] = useState<MemberLocation[]>([]);
    const [memberInfos, setMemberInfos] = useState<FamilyMemberInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSharingEnabled, setIsSharingEnabled] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const getAvatarPublicUrl = (avatarPath: string) => {
        const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
        return data.publicUrl;
    };

    const loadLocations = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const [locResult, memberResult] = await Promise.all([
                supabase
                    .from('family_locations')
                    .select('*')
                    .eq('household_id', householdId)
                    .eq('sharing_enabled', true),
                supabase
                    .from('family_members')
                    .select('user_id, avatar_url, display_name, email')
                    .eq('household_id', householdId)
                    .eq('is_active', true),
            ]);

            if (locResult.error) throw locResult.error;
            setLocations(locResult.data || []);
            setMemberInfos(memberResult.data || []);

            const myLoc = (locResult.data || []).find(l => l.user_id === user?.id);
            if (myLoc) setIsSharingEnabled(true);
        } catch (e: any) {
            console.error('Error loading locations:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, user?.id]);

    useEffect(() => { if (visible) loadLocations(); }, [visible, loadLocations]);

    // Fit map to all markers when locations change
    useEffect(() => {
        if (!mapsAvailable || locations.length === 0 || !mapRef.current) return;
        const timer = setTimeout(() => {
            if (locations.length === 1) {
                mapRef.current?.animateToRegion({
                    latitude: locations[0].latitude,
                    longitude: locations[0].longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                }, 500);
            } else {
                mapRef.current?.fitToCoordinates(
                    locations.map(l => ({ latitude: l.latitude, longitude: l.longitude })),
                    { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
                );
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [locations]);

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
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    const updateAllLocations = async () => {
        if (!householdId) return;
        setIsUpdating(true);
        try {
            // Update my own location first (if sharing is enabled)
            if (isSharingEnabled && user?.id) {
                await updateMyLocation();
            }
            // Then reload all family member locations from DB
            await loadLocations();
        } catch (e: any) {
            console.error('Error updating locations:', e);
        } finally {
            setIsUpdating(false);
        }
    };

    const toggleSharing = async () => {
        if (!householdId || !user?.id) return;
        if (isSharingEnabled) {
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

    const getMemberAvatar = (userId: string): string | null => {
        const member = memberInfos.find(m => m.user_id === userId);
        return member?.avatar_url ? getAvatarPublicUrl(member.avatar_url) : null;
    };

    const getMemberColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];
    const getInitial = (name: string) => name.substring(0, 1).toUpperCase();

    const defaultRegion = {
        latitude: 47.37,
        longitude: 8.54,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
    };

    const initialRegion = locations.length === 1
        ? { latitude: locations[0].latitude, longitude: locations[0].longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
        : defaultRegion;

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <MapPin size={24} color={colors.accent} />
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Standort teilen</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Pressable onPress={loadLocations} hitSlop={10}>
                            <RefreshCw size={20} color={colors.accent} />
                        </Pressable>
                        <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>
                </View>

                {/* Map */}
                <View style={styles.mapContainer}>
                    {isLoading ? (
                        <View style={[styles.mapPlaceholder, { backgroundColor: colors.card }]}>
                            <ActivityIndicator color={colors.accent} />
                        </View>
                    ) : !mapsAvailable ? (
                        <View style={[styles.mapPlaceholder, { backgroundColor: colors.card }]}>
                            <Text style={{ fontSize: 48, marginBottom: 8 }}>🗺️</Text>
                            <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 }}>
                                Karte benötigt einen neuen Build.{'\n'}Bitte erstelle einen neuen EAS-Build.
                            </Text>
                        </View>
                    ) : (
                        <MapView
                            ref={mapRef}
                            style={styles.map}
                            initialRegion={initialRegion}
                            showsUserLocation={false}
                            showsMyLocationButton={false}
                            mapType="standard"
                        >
                            {locations.map((loc, idx) => {
                                const color = getMemberColor(idx);
                                const isMe = loc.user_id === user?.id;
                                const avatarUrl = getMemberAvatar(loc.user_id);
                                return (
                                    <Marker
                                        key={loc.id}
                                        coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                                        title={loc.member_name}
                                        description={loc.address || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
                                    >
                                        <View style={styles.markerContainer}>
                                            <View style={[
                                                styles.markerBubble,
                                                {
                                                    backgroundColor: avatarUrl ? '#fff' : color,
                                                    borderColor: isMe ? colors.accent : '#fff',
                                                    borderWidth: 3,
                                                },
                                            ]}>
                                                {avatarUrl ? (
                                                    <Image
                                                        source={{ uri: avatarUrl }}
                                                        style={styles.markerImage}
                                                    />
                                                ) : (
                                                    <Text style={styles.markerInitial}>{getInitial(loc.member_name)}</Text>
                                                )}
                                            </View>
                                            <View style={[styles.markerArrow, { borderTopColor: isMe ? colors.accent : (avatarUrl ? '#fff' : color) }]} />
                                        </View>
                                    </Marker>
                                );
                            })}
                        </MapView>
                    )}
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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

                    <Pressable
                        style={[styles.updateBtn, { backgroundColor: colors.accent }]}
                        onPress={updateAllLocations}
                        disabled={isUpdating}
                    >
                        {isUpdating ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <RefreshCw size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Alle Standorte aktualisieren</Text>
                            </>
                        )}
                    </Pressable>

                    {/* Family Members Locations */}
                    <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>👨‍👩‍👧‍👦 Familie</Text>

                    {locations.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={{ fontSize: 48 }}>📍</Text>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                Noch niemand teilt seinen Standort.{'\n'}Aktiviere die Standortfreigabe oben.
                            </Text>
                        </View>
                    ) : (
                        locations.map((loc, idx) => {
                            const color = getMemberColor(idx);
                            const avatarUrl = getMemberAvatar(loc.user_id);
                            return (
                                <Pressable
                                    key={loc.id}
                                    style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                    onPress={() => {
                                        if (mapsAvailable && mapRef.current) {
                                            mapRef.current.animateToRegion({
                                                latitude: loc.latitude,
                                                longitude: loc.longitude,
                                                latitudeDelta: 0.005,
                                                longitudeDelta: 0.005,
                                            }, 500);
                                        }
                                    }}
                                >
                                    {avatarUrl ? (
                                        <Image source={{ uri: avatarUrl }} style={styles.listAvatar} />
                                    ) : (
                                        <View style={[styles.listAvatarFallback, { backgroundColor: color }]}>
                                            <Text style={styles.listAvatarText}>{getInitial(loc.member_name)}</Text>
                                        </View>
                                    )}
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
                                </Pressable>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, borderRadius: 20 },

    // Map
    mapContainer: { height: 280, width: SCREEN_WIDTH },
    map: { flex: 1 },
    mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Marker
    markerContainer: { alignItems: 'center' },
    markerBubble: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
    },
    markerImage: {
        width: 38, height: 38, borderRadius: 19,
    },
    markerInitial: { color: '#fff', fontSize: 16, fontWeight: '900' },
    markerArrow: {
        width: 0, height: 0, marginTop: -2,
        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
    },

    sharingCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    sharingTitle: { fontSize: 16, fontWeight: '700' },
    shareBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    updateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 4 },

    sectionTitle: { fontSize: 16, fontWeight: '800' },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 },

    locationCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 8 },
    listAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    listAvatarFallback: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    listAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
    memberName: { fontSize: 15, fontWeight: '700' },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    meBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});

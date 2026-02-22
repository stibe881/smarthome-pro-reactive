import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import {
    X, Play, Pause, Square, Home, Battery,
    Bath, Armchair, Monitor, Refrigerator, BedDouble,
    Gamepad2, User, Utensils, DoorOpen, Footprints,
    ArrowRight, Brush, Wind
} from 'lucide-react-native';

const ROOMS = [
    { id: 1, name: 'Bad', icon: Bath },
    { id: 2, name: 'Gäste WC', icon: Wind },
    { id: 3, name: 'Wohnzimmer', icon: Armchair },
    { id: 4, name: 'Reduit', icon: Brush },
    { id: 5, name: 'Büro', icon: Monitor },
    { id: 6, name: 'Küche', icon: Refrigerator },
    { id: 7, name: 'Schlafzimmer', icon: BedDouble },
    { id: 8, name: 'Vorraum', icon: Footprints },
    { id: 9, name: 'Levin', icon: Gamepad2 },
    { id: 10, name: 'Lina', icon: User },
    { id: 11, name: 'Essen', icon: Utensils },
    { id: 12, name: 'Eingang', icon: DoorOpen },
    { id: 13, name: 'Gang', icon: ArrowRight },
];

export default function RobiVacuumModal({
    visible,
    onClose,
    entityId = 'vacuum.robi'
}: {
    visible: boolean;
    onClose: () => void;
    entityId?: string;
}) {
    const { entities, callService, getEntityPictureUrl, dashboardConfig } = useHomeAssistant();
    const [loading, setLoading] = useState(false);

    const vacuum = entities.find(e => e.entity_id === entityId);

    // Use configured camera entity, fallback to auto-detect
    const mapCamera = dashboardConfig.vacuumMapCamera
        ? entities.find(e => e.entity_id === dashboardConfig.vacuumMapCamera)
        : entities.find(e => e.entity_id.startsWith('camera.') && (e.entity_id.includes('map') || e.entity_id.includes('robi')));

    // Use configured battery sensor, fallback to vacuum attribute
    const batterySensor = dashboardConfig.vacuumBatterySensor
        ? entities.find(e => e.entity_id === dashboardConfig.vacuumBatterySensor)
        : null;

    const handleAction = (action: string) => {
        callService('vacuum', action, entityId);
    };

    const cleanRoom = async (roomIds: number[]) => {
        try {
            // Try Roborock integration first (HA 2024.8+)
            await callService('roborock', 'vacuum_clean_segment', entityId, {
                segments: roomIds
            });
        } catch {
            try {
                // Fallback: Xiaomi Miio integration
                await callService('xiaomi_miio', 'vacuum_clean_segment', entityId, {
                    segments: roomIds
                });
            } catch {
                try {
                    // Fallback: Legacy send_command
                    await callService('vacuum', 'send_command', entityId, {
                        command: 'app_segment_clean',
                        params: roomIds
                    });
                } catch (e: any) {
                    Alert.alert('Fehler', 'Raum-Reinigung wird von diesem Saugroboter nicht unterstützt.');
                }
            }
        }
        onClose();
    };

    if (!vacuum) return null;

    const batteryLevel = batterySensor?.state ?? vacuum.attributes?.battery_level ?? '?';
    const status = vacuum.attributes?.status || vacuum.state || 'Unbekannt';

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>{vacuum.attributes?.friendly_name || 'Röbi'}</Text>
                        <Text style={styles.headerSubtitle}>{status} • {batteryLevel}% Akku</Text>
                    </View>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="#94A3B8" />
                    </Pressable>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>

                    {/* Map View */}
                    {mapCamera && (
                        <View style={styles.mapContainer}>
                            <Image
                                source={{ uri: getEntityPictureUrl(mapCamera.attributes.entity_picture) }}
                                style={styles.mapImage}
                                resizeMode="contain"
                            />
                        </View>
                    )}

                    {/* Quick Actions */}
                    <View style={styles.controlsRow}>
                        <Pressable onPress={() => handleAction('start')} style={[styles.controlBtn, { backgroundColor: '#3B82F6' }]}>
                            <Play size={24} color="#fff" fill="#fff" />
                        </Pressable>
                        <Pressable onPress={() => handleAction('pause')} style={[styles.controlBtn, { backgroundColor: '#F59E0B' }]}>
                            <Pause size={24} color="#fff" fill="#fff" />
                        </Pressable>
                        <Pressable onPress={() => handleAction('return_to_base')} style={[styles.controlBtn, { backgroundColor: '#10B981' }]}>
                            <Home size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {/* Rooms Grid */}
                    <Text style={styles.sectionTitle}>RAUM REINIGEN</Text>
                    <View style={styles.grid}>
                        {ROOMS.map((room) => {
                            const Icon = room.icon;
                            return (
                                <Pressable
                                    key={room.id}
                                    style={styles.roomBtn}
                                    onPress={() => cleanRoom([room.id])}
                                >
                                    <View style={styles.roomIcon}>
                                        <Icon size={24} color="#fff" />
                                    </View>
                                    <Text style={styles.roomName}>{room.name}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    headerSubtitle: { color: '#94A3B8', fontSize: 14, marginTop: 4 },
    closeButton: { padding: 8, backgroundColor: '#1E293B', borderRadius: 12 },
    content: { flex: 1, padding: 20 },

    mapContainer: {
        height: 250,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        marginBottom: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    mapImage: { width: '100%', height: '100%' },

    controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 32 },
    controlBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },

    sectionTitle: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 16 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    roomBtn: { width: '31%', aspectRatio: 1, backgroundColor: '#1E293B', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 8, borderWidth: 1, borderColor: '#334155' },
    roomIcon: { marginBottom: 8 },
    roomName: { color: '#E2E8F0', fontSize: 12, fontWeight: '600', textAlign: 'center' }
});

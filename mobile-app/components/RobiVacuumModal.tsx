import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Image, Alert, Dimensions } from 'react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import {
    X, Play, Pause, Home,
    Bath, Armchair, Monitor, Refrigerator, BedDouble,
    Gamepad2, User, Utensils, DoorOpen, Footprints,
    ArrowRight, Brush, Wind, Dock, Gauge, Check
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ROOMS = [
    { id: 1, name: 'Bad', icon: Bath },
    { id: 5, name: 'Büro', icon: Monitor },
    { id: 12, name: 'Eingang', icon: DoorOpen },
    { id: 11, name: 'Essen', icon: Utensils },
    { id: 13, name: 'Gang', icon: ArrowRight },
    { id: 2, name: 'Gäste WC', icon: Wind },
    { id: 6, name: 'Küche', icon: Refrigerator },
    { id: 9, name: 'Levin', icon: Gamepad2 },
    { id: 10, name: 'Lina', icon: User },
    { id: 4, name: 'Reduit', icon: Brush },
    { id: 7, name: 'Schlafzimmer', icon: BedDouble },
    { id: 8, name: 'Vorraum', icon: Footprints },
    { id: 3, name: 'Wohnzimmer', icon: Armchair },
];

type TabKey = 'cleaning' | 'dock';

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
    const [activeTab, setActiveTab] = useState<TabKey>('cleaning');
    const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
    const [showMapZoom, setShowMapZoom] = useState(false);
    const [mapOpenCount, setMapOpenCount] = useState(0);

    const openMapZoom = () => {
        setMapOpenCount(c => c + 1);
        setShowMapZoom(true);
    };

    const vacuum = entities.find(e => e.entity_id === entityId);

    // Use configured camera entity, fallback to auto-detect
    const mapCamera = dashboardConfig.vacuumMapCamera
        ? entities.find(e => e.entity_id === dashboardConfig.vacuumMapCamera)
        : entities.find(e => e.entity_id.startsWith('camera.') && (e.entity_id.includes('map') || e.entity_id.includes('robi')));

    // Use configured battery sensor, fallback to vacuum attribute
    const batterySensor = dashboardConfig.vacuumBatterySensor
        ? entities.find(e => e.entity_id === dashboardConfig.vacuumBatterySensor)
        : null;

    // Dock station entities (multi-select from config)
    const dockEntities = ((dashboardConfig.vacuumDockEntities || []) as string[])
        .map((id: string) => entities.find(e => e.entity_id === id))
        .filter(Boolean) as any[];

    const handleAction = (action: string) => {
        callService('vacuum', action, entityId);
    };

    const toggleRoom = (roomId: number) => {
        setSelectedRooms(prev =>
            prev.includes(roomId)
                ? prev.filter(id => id !== roomId)
                : [...prev, roomId]
        );
    };

    const cleanSelectedRooms = async () => {
        if (selectedRooms.length === 0) return;
        try {
            await callService('roborock', 'vacuum_clean_segment', entityId, { segments: selectedRooms });
        } catch {
            try {
                await callService('xiaomi_miio', 'vacuum_clean_segment', entityId, { segments: selectedRooms });
            } catch {
                try {
                    await callService('vacuum', 'send_command', entityId, { command: 'app_segment_clean', params: selectedRooms });
                } catch {
                    Alert.alert('Fehler', 'Raum-Reinigung wird von diesem Saugroboter nicht unterstützt.');
                    return;
                }
            }
        }
        setSelectedRooms([]);
        onClose();
    };

    if (!vacuum) return null;

    const batteryLevel = batterySensor?.state ?? vacuum.attributes?.battery_level ?? '?';
    const rawStatus = vacuum.attributes?.status || vacuum.state || 'unknown';

    // Translate vacuum states to German
    const statusMap: Record<string, string> = {
        docked: 'Angedockt',
        cleaning: 'Reinigt',
        returning: 'Kehrt zurück',
        paused: 'Pausiert',
        idle: 'Bereit',
        error: 'Fehler',
        charging: 'Lädt',
        'returning_to_dock': 'Kehrt zurück',
        unknown: 'Unbekannt',
    };
    const status = statusMap[rawStatus.toLowerCase()] || rawStatus;

    const mapUrl = mapCamera ? getEntityPictureUrl(mapCamera.attributes.entity_picture) : null;

    const renderCleaningTab = () => (
        <>
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 20 }}>
                {mapCamera && mapUrl && (
                    <Pressable onPress={openMapZoom} style={styles.mapContainer}>
                        <Image
                            source={{ uri: mapUrl }}
                            style={styles.mapImage}
                            resizeMode="contain"
                        />
                    </Pressable>
                )}

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

                <Text style={styles.sectionTitle}>RAUM REINIGEN</Text>
                <View style={styles.grid}>
                    {ROOMS.map((room) => {
                        const Icon = room.icon;
                        const isSelected = selectedRooms.includes(room.id);
                        return (
                            <Pressable
                                key={room.id}
                                style={[
                                    styles.roomBtn,
                                    isSelected && { borderColor: '#3B82F6', backgroundColor: '#3B82F6' + '20' },
                                ]}
                                onPress={() => toggleRoom(room.id)}
                            >
                                {isSelected && (
                                    <View style={styles.checkBadge}>
                                        <Check size={12} color="#fff" />
                                    </View>
                                )}
                                <View style={styles.roomIcon}>
                                    <Icon size={24} color={isSelected ? '#3B82F6' : '#fff'} />
                                </View>
                                <Text style={[styles.roomName, isSelected && { color: '#3B82F6' }]}>
                                    {room.name}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Clean button - fixed at bottom */}
            {selectedRooms.length > 0 && (
                <View style={styles.cleanBtnWrapper}>
                    <Pressable onPress={cleanSelectedRooms} style={styles.cleanBtn}>
                        <Play size={20} color="#fff" fill="#fff" />
                        <Text style={styles.cleanBtnText}>
                            {selectedRooms.length === 1 ? '1 Raum reinigen' : `${selectedRooms.length} Räume reinigen`}
                        </Text>
                    </Pressable>
                </View>
            )}
        </>
    );

    const renderDockTab = () => (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
            {dockEntities.length === 0 ? (
                <View style={styles.emptyDock}>
                    <Dock size={48} color="#334155" />
                    <Text style={styles.emptyDockText}>Keine Dockingstation-Entitäten konfiguriert.</Text>
                    <Text style={styles.emptyDockHint}>
                        Gehe zu Einstellungen → Dashboard anpassen → Saugroboter und füge Dockingstation-Entitäten hinzu.
                    </Text>
                </View>
            ) : (
                <>
                    <Text style={styles.sectionTitle}>DOCKINGSTATION</Text>
                    {dockEntities.map((entity: any) => {
                        const unit = entity.attributes?.unit_of_measurement || '';
                        const friendlyName = entity.attributes?.friendly_name || entity.entity_id;

                        // Translate binary_sensor states to human-readable German
                        let displayState = entity.state;
                        if (entity.entity_id.startsWith('binary_sensor.')) {
                            const dc = entity.attributes?.device_class;
                            if (dc === 'problem') displayState = entity.state === 'off' ? 'OK' : 'Problem';
                            else if (dc === 'moisture') displayState = entity.state === 'off' ? 'Trocken' : 'Feucht';
                            else if (dc === 'connectivity') displayState = entity.state === 'on' ? 'Verbunden' : 'Getrennt';
                            else if (dc === 'plug' || dc === 'power') displayState = entity.state === 'on' ? 'Eingesteckt' : 'Nicht eingesteckt';
                            else displayState = entity.state === 'on' ? 'An' : 'Aus';
                        }
                        const stateValue = `${displayState}${unit ? ' ' + unit : ''}`;

                        return (
                            <View key={entity.entity_id} style={styles.dockInfoCard}>
                                <View style={[styles.dockInfoIcon, { backgroundColor: '#3B82F620' }]}>
                                    <Gauge size={20} color="#3B82F6" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.dockInfoLabel}>{friendlyName}</Text>
                                    <Text style={styles.dockInfoValue}>{stateValue}</Text>
                                </View>
                            </View>
                        );
                    })}
                </>
            )}
        </ScrollView>
    );

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

                {/* Tab Bar */}
                <View style={styles.tabBar}>
                    <Pressable
                        style={[styles.tab, activeTab === 'cleaning' && styles.tabActive]}
                        onPress={() => setActiveTab('cleaning')}
                    >
                        <Play size={16} color={activeTab === 'cleaning' ? '#3B82F6' : '#64748B'} />
                        <Text style={[styles.tabText, activeTab === 'cleaning' && styles.tabTextActive]}>Reinigung</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tab, activeTab === 'dock' && styles.tabActive]}
                        onPress={() => setActiveTab('dock')}
                    >
                        <Dock size={16} color={activeTab === 'dock' ? '#3B82F6' : '#64748B'} />
                        <Text style={[styles.tabText, activeTab === 'dock' && styles.tabTextActive]}>Dockingstation</Text>
                    </Pressable>
                </View>

                {activeTab === 'cleaning' ? renderCleaningTab() : renderDockTab()}
            </View>

            {/* Map Zoom Modal */}
            <Modal visible={showMapZoom} animationType="fade" transparent onRequestClose={() => setShowMapZoom(false)}>
                <View style={styles.mapZoomOverlay}>
                    <View style={styles.mapZoomContainer}>
                        {mapUrl && (
                            <ScrollView
                                key={`map-${mapOpenCount}`}
                                maximumZoomScale={5}
                                minimumZoomScale={1}
                                centerContent
                                showsHorizontalScrollIndicator={false}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ flex: 1 }}
                            >
                                <Image
                                    source={{ uri: mapUrl }}
                                    style={styles.mapZoomImage}
                                    resizeMode="contain"
                                />
                            </ScrollView>
                        )}
                    </View>
                    <Pressable onPress={() => setShowMapZoom(false)} style={styles.mapZoomClose}>
                        <X size={24} color="#fff" />
                    </Pressable>
                </View>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    headerSubtitle: { color: '#94A3B8', fontSize: 14, marginTop: 4 },
    closeButton: { padding: 8, backgroundColor: '#1E293B', borderRadius: 12 },

    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#3B82F6' },
    tabText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: '#3B82F6' },

    content: { flex: 1, padding: 20 },

    mapContainer: { height: 250, backgroundColor: '#0F172A', borderRadius: 20, marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#1E293B' },
    mapImage: { width: '100%', height: '100%' },

    controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 32 },
    controlBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },

    sectionTitle: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 16 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    roomBtn: {
        width: '31%', aspectRatio: 1, backgroundColor: '#1E293B', borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', padding: 8,
        borderWidth: 1.5, borderColor: '#334155', position: 'relative',
    },
    checkBadge: {
        position: 'absolute', top: 6, right: 6, width: 20, height: 20,
        borderRadius: 10, backgroundColor: '#3B82F6',
        alignItems: 'center', justifyContent: 'center',
    },
    roomIcon: { marginBottom: 8 },
    roomName: { color: '#E2E8F0', fontSize: 12, fontWeight: '600', textAlign: 'center' },

    cleanBtnWrapper: {
        paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8,
        backgroundColor: '#020617',
    },
    cleanBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: '#3B82F6', borderRadius: 16,
        paddingVertical: 16, paddingHorizontal: 24,
        shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    },
    cleanBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

    // Map Zoom
    mapZoomOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center', alignItems: 'center',
    },
    mapZoomContainer: {
        width: SCREEN_WIDTH - 32, height: SCREEN_HEIGHT * 0.7,
        borderRadius: 20, overflow: 'hidden',
    },
    mapZoomImage: { width: '100%', height: '100%' },
    mapZoomClose: {
        position: 'absolute', top: 60, right: 20,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },

    dockInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1E293B', gap: 14 },
    dockInfoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    dockInfoLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 2 },
    dockInfoValue: { color: '#E2E8F0', fontSize: 16, fontWeight: '700' },
    emptyDock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyDockText: { color: '#64748B', fontSize: 16, fontWeight: '600' },
    emptyDockHint: { color: '#475569', fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});

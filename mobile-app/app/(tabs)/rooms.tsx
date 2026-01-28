import React, { useMemo, useState, memo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import {
    Home, Bed, Sofa, UtensilsCrossed, Bath, Warehouse, Building2,
    Lightbulb, Blinds, ChevronRight, WifiOff, X,
    Briefcase, Baby, Dumbbell, Shirt, TreeDeciduous, Droplets,
    Thermometer, Gamepad2, BookOpen, Armchair, DoorOpen, Stairs,
    ParkingSquare, Flower2, Sun, Moon, LucideIcon,
    Wind, Fan, Play, Pause, Square, Volume2, Tv
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';

// =====================================================
// UTILS
// =====================================================

const getRoomIcon = (roomName: string): LucideIcon => {
    const name = roomName.toLowerCase();
    if (name.includes('wohn') || name.includes('living')) return Sofa;
    if (name.includes('schlaf') || name.includes('bed')) return Bed;
    if (name.includes('küche') || name.includes('kueche') || name.includes('kitchen')) return UtensilsCrossed;
    if (name.includes('bad') || name.includes('bath') || name.includes('wc') || name.includes('toilet')) return Bath;
    if (name.includes('garage')) return ParkingSquare;
    if (name.includes('keller') || name.includes('basement')) return Warehouse;
    if (name.includes('büro') || name.includes('buero') || name.includes('office') || name.includes('arbeit')) return Briefcase;
    if (name.includes('kind') || name.includes('levin') || name.includes('lina') || name.includes('child')) return Baby;
    if (name.includes('fitness') || name.includes('gym') || name.includes('sport')) return Dumbbell;
    if (name.includes('wasch') || name.includes('laundry')) return Shirt;
    if (name.includes('garten') || name.includes('garden')) return Flower2;
    if (name.includes('terrasse') || name.includes('balkon') || name.includes('terrace')) return TreeDeciduous;
    if (name.includes('pool') || name.includes('schwimm')) return Droplets;
    if (name.includes('heiz') || name.includes('heating')) return Thermometer;
    if (name.includes('spiel') || name.includes('game')) return Gamepad2;
    if (name.includes('bibliothek') || name.includes('library')) return BookOpen;
    if (name.includes('flur') || name.includes('hall') || name.includes('korridor')) return DoorOpen;
    if (name.includes('treppe') || name.includes('stair')) return Stairs;
    if (name.includes('dach') || name.includes('attic')) return Home;
    if (name.includes('eingang') || name.includes('entry') || name.includes('foyer')) return DoorOpen;
    if (name.includes('esszimmer') || name.includes('dining')) return Armchair;
    return Building2;
};

const ROOM_GRADIENTS: [string, string][] = [
    ['#6366F1', '#4F46E5'], // Indigo
    ['#EC4899', '#DB2777'], // Pink
    ['#F97316', '#EA580C'], // Orange
    ['#14B8A6', '#0D9488'], // Teal
    ['#8B5CF6', '#7C3AED'], // Violet
    ['#22C55E', '#16A34A'], // Green
    ['#EAB308', '#CA8A04'], // Yellow
    ['#3B82F6', '#1D4ED8'], // Blue
    ['#EF4444', '#DC2626'], // Red
    ['#06B6D4', '#0891B2'], // Cyan
];

// =====================================================
// SUB-COMPONENTS
// =====================================================

const SectionHeader = memo(({ title, actionIcon: ActionIcon, onAction }: { title: string, actionIcon?: LucideIcon, onAction?: () => void }) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {ActionIcon && onAction && (
            <Pressable onPress={onAction} style={styles.sectionAction}>
                <ActionIcon size={20} color="#94A3B8" />
            </Pressable>
        )}
    </View>
));

const LightTile = memo(({ light, toggleLight, setBrightness, width }: any) => {
    const isOn = light.state === 'on';
    const brightness = light.attributes.brightness || 0;

    return (
        <View style={[styles.tile, { width }]}>
            <Pressable
                onPress={() => toggleLight(light.entity_id)}
                style={[styles.tileContent, isOn && styles.tileActive]}
            >
                <View style={[styles.tileHeader]}>
                    <View style={[styles.tileIcon, isOn && { backgroundColor: '#FBBF24' }]}>
                        <Lightbulb size={24} color={isOn ? "#FFF" : "#FBBF24"} />
                    </View>
                    <Text style={[styles.tileState, isOn && styles.textActive]}>
                        {isOn ? `${Math.round(brightness / 255 * 100)}%` : 'Aus'}
                    </Text>
                </View>
                <Text numberOfLines={2} style={[styles.tileName, isOn && styles.textActive]}>
                    {light.attributes.friendly_name}
                </Text>
            </Pressable>

            {isOn && (
                <View style={styles.tileSlider}>
                    <Slider
                        style={{ height: 40, width: '100%' }}
                        value={brightness / 255}
                        onSlidingComplete={(val) => setBrightness(light.entity_id, Math.round(val * 255))}
                        minimumValue={0}
                        maximumValue={1}
                        minimumTrackTintColor="#FBBF24"
                        maximumTrackTintColor="rgba(255,255,255,0.1)"
                        thumbTintColor="#FFF"
                    />
                </View>
            )}
        </View>
    );
});

const CoverTile = memo(({ cover, openCover, closeCover, stopCover, width }: any) => {
    const isOpen = cover.state === 'open' || (cover.attributes.current_position && cover.attributes.current_position > 0);
    const position = cover.attributes.current_position;

    return (
        <View style={[styles.tile, { width }]}>
            <View style={[styles.tileContent, isOpen && styles.tileActiveCover]}>
                <View style={styles.tileHeader}>
                    <View style={[styles.tileIcon, isOpen && { backgroundColor: '#3B82F6' }]}>
                        <Blinds size={24} color={isOpen ? "#FFF" : "#3B82F6"} />
                    </View>
                    <Text style={[styles.tileState, isOpen && styles.textActive]}>
                        {position !== undefined ? `${position}%` : cover.state}
                    </Text>
                </View>
                <Text numberOfLines={2} style={[styles.tileName, isOpen && styles.textActive]}>
                    {cover.attributes.friendly_name}
                </Text>

                <View style={styles.tileActions}>
                    <Pressable onPress={() => openCover(cover.entity_id)} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => closeCover(cover.entity_id)} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>↓</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
});

const ClimateTile = memo(({ climate, setTemp, width }: any) => {
    const currentTemp = climate.attributes.current_temperature;
    const targetTemp = climate.attributes.temperature;
    const label = climate.attributes.friendly_name;

    return (
        <View style={[styles.tile, { width }]}>
            <View style={[styles.tileContent, styles.tileActiveClimate]}>
                <View style={styles.tileHeader}>
                    <View style={[styles.tileIcon, { backgroundColor: '#F97316' }]}>
                        <Thermometer size={24} color="#FFF" />
                    </View>
                    <Text style={[styles.tileState, styles.textActive]}>
                        {currentTemp}°C
                    </Text>
                </View>
                <Text numberOfLines={1} style={[styles.tileName, styles.textActive]}>
                    {label}
                </Text>

                <View style={styles.climateControl}>
                    <Text style={styles.climateTarget}>{targetTemp}°</Text>
                    <Slider
                        style={{ height: 40, flex: 1 }}
                        value={targetTemp}
                        onSlidingComplete={(val) => setTemp(climate.entity_id, Math.round(val))}
                        minimumValue={16}
                        maximumValue={30}
                        step={0.5}
                        minimumTrackTintColor="#F97316"
                        maximumTrackTintColor="rgba(255,255,255,0.2)"
                        thumbTintColor="#FFF"
                    />
                </View>
            </View>
        </View>
    );
});

const MediaTile = memo(({ player, playMedia, callService, width }: any) => {
    const isPlaying = player.state === 'playing';
    const volume = player.attributes.volume_level || 0;

    const togglePlay = () => {
        callService('media_player', isPlaying ? 'media_pause' : 'media_play', player.entity_id);
    };

    const setVolume = (val: number) => {
        callService('media_player', 'volume_set', player.entity_id, { volume_level: val });
    };

    return (
        <View style={[styles.tile, { width }]}>
            <View style={[styles.tileContent, isPlaying && styles.tileActiveMedia]}>
                <View style={styles.tileHeader}>
                    <View style={[styles.tileIcon, isPlaying && { backgroundColor: '#8B5CF6' }]}>
                        <Volume2 size={24} color={isPlaying ? "#FFF" : "#8B5CF6"} />
                    </View>
                    <Pressable onPress={togglePlay} style={styles.playBtn}>
                        {isPlaying ? <Pause size={20} color={isPlaying ? "#FFF" : "#CBD5E1"} /> : <Play size={20} color="#CBD5E1" />}
                    </Pressable>
                </View>
                <Text numberOfLines={1} style={[styles.tileName, isPlaying && styles.textActive]}>
                    {player.attributes.friendly_name}
                </Text>
                {/* Volume Slider if supported */}
                {volume !== undefined && (
                    <Slider
                        style={{ height: 40, width: '100%', marginTop: 8 }}
                        value={volume}
                        onSlidingComplete={setVolume}
                        minimumValue={0}
                        maximumValue={1}
                        minimumTrackTintColor={isPlaying ? "#FFF" : "#8B5CF6"}
                        maximumTrackTintColor="rgba(255,255,255,0.1)"
                        thumbTintColor="#FFF"
                    />
                )}
            </View>
        </View>
    );
});

const RoomDetailModal = memo(({ room, visible, onClose, api }: any) => {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;
    const tileWidth = isTablet ? (width - 64 - 24) / 3 : (width - 32 - 12) / 2;

    if (!room) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <LinearGradient
                        colors={room.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.modalHeader}
                    >
                        <View style={styles.modalTitleRow}>
                            <View style={styles.titleIconBubble}>
                                <room.icon size={24} color="#fff" />
                            </View>
                            <Text style={styles.modalTitleText}>{room.name}</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </LinearGradient>

                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                        {/* Climate Section */}
                        {room.climates?.length > 0 && (
                            <View style={styles.section}>
                                <SectionHeader title="Klima" />
                                <View style={styles.grid}>
                                    {room.climates.map((c: any) => (
                                        <ClimateTile
                                            key={c.entity_id}
                                            climate={c}
                                            setTemp={api.setClimateTemperature}
                                            width={isTablet ? tileWidth : '100%'} // Full width for climate on mobile
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Lights Section */}
                        {room.lights?.length > 0 && (
                            <View style={styles.section}>
                                <SectionHeader title="Beleuchtung" actionIcon={Moon} onAction={() => room.lights.forEach((l: any) => l.state === 'on' && api.toggleLight(l.entity_id))} />
                                <View style={styles.grid}>
                                    {room.lights.map((l: any) => (
                                        <LightTile
                                            key={l.entity_id}
                                            light={l}
                                            toggleLight={api.toggleLight}
                                            setBrightness={api.setLightBrightness}
                                            width={tileWidth}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Covers Section */}
                        {room.covers?.length > 0 && (
                            <View style={styles.section}>
                                <SectionHeader title="Rollläden" />
                                <View style={styles.grid}>
                                    {room.covers.map((c: any) => (
                                        <CoverTile
                                            key={c.entity_id}
                                            cover={c}
                                            openCover={api.openCover}
                                            closeCover={api.closeCover}
                                            width={tileWidth}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Media Section */}
                        {room.mediaPlayers?.length > 0 && (
                            <View style={styles.section}>
                                <SectionHeader title="Medien" />
                                <View style={styles.grid}>
                                    {room.mediaPlayers.map((m: any) => (
                                        <MediaTile
                                            key={m.entity_id}
                                            player={m}
                                            callService={api.callService}
                                            width={isTablet ? tileWidth : '100%'}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
});

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function Rooms() {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const {
        entities,
        isConnected,
        isConnecting,
        toggleLight,
        setLightBrightness,
        openCover,
        closeCover,
        setCoverPosition,
        callService,
        setClimateTemperature, // Assuming availability
        connect
    } = useHomeAssistant();

    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

    // Allowed Rooms Configuration
    const ALLOWED_ROOMS = [
        'Wohnzimmer',
        'Essbereich',
        'Küche',
        'Schlafzimmer',
        'Levins Zimmer',
        'Linas Zimmer',
        'Büro',
        'Bad',
        'Gäste WC',
        'Terrasse',
        'Grillplatz',
        'Balkon',
        'Reduit',
        'Waschküche',
        'Highlight'
    ];

    // Prepare rooms data
    const rooms = useMemo(() => {
        // Initialize with allowed rooms to preserve order
        const areaMap = new Map<string, any>();
        ALLOWED_ROOMS.forEach(room => {
            areaMap.set(room, { lights: [], covers: [], sensors: [], climates: [], mediaPlayers: [] });
        });

        // Helper to find room for entity
        const getRoomForEntity = (entity: any): string | null => {
            const id = entity.entity_id.toLowerCase();
            const name = (entity.attributes.friendly_name || '').toLowerCase();
            const area = (entity.attributes.area_id || '').toLowerCase();

            // Specific Mappings
            if (name.includes('licht garage') || id.includes('garage') || name.includes('gäste wc')) return 'Gäste WC';
            if (name.includes('badezimmer') || area.includes('badezimmer')) return 'Bad';
            if (name.includes('büro') || area.includes('buro') || id.includes('buro')) return 'Büro';
            if (name.includes('levin')) return 'Levins Zimmer';
            if (name.includes('lina')) return 'Linas Zimmer';
            if (name.includes('schlaf')) return 'Schlafzimmer';
            if (name.includes('wohn') || name.includes('living')) return 'Wohnzimmer';
            if (name.includes('ess') || name.includes('dining')) return 'Essbereich';
            if (name.includes('küche') || name.includes('kueche') || name.includes('kitchen')) return 'Küche';
            if (name.includes('reduit')) return 'Reduit';
            if (name.includes('wasch') || name.includes('laundry')) return 'Waschküche';
            if (name.includes('terrasse')) return 'Terrasse';
            if (name.includes('grill')) return 'Grillplatz';
            if (name.includes('balkon')) return 'Balkon';
            if (name.includes('highlight')) return 'Highlight';

            return null;
        };

        entities.forEach(entity => {
            const roomName = getRoomForEntity(entity);
            if (!roomName || !areaMap.has(roomName)) return;

            const room = areaMap.get(roomName)!;

            // Allow lights, covers, climates, media players
            // Filter specific undesired entities if needed
            if (entity.entity_id.startsWith('light.')) room.lights.push(entity);
            else if (entity.entity_id.startsWith('cover.')) room.covers.push(entity);
            else if (entity.entity_id.startsWith('sensor.') && entity.attributes.unit_of_measurement === '°C') room.sensors.push(entity);
            else if (entity.entity_id.startsWith('climate.')) room.climates.push(entity);
            else if (entity.entity_id.startsWith('media_player.')) room.mediaPlayers.push(entity);
        });

        // Return only rooms that have at least one device, in the order of ALLOWED_ROOMS
        return ALLOWED_ROOMS
            .map(name => {
                const data = areaMap.get(name);
                return {
                    name,
                    ...data,
                    gradient: ROOM_GRADIENTS[ALLOWED_ROOMS.indexOf(name) % ROOM_GRADIENTS.length],
                    icon: getRoomIcon(name)
                };
            })
            .filter(room =>
                room.lights.length > 0 ||
                room.covers.length > 0 ||
                room.climates.length > 0 ||
                room.mediaPlayers.length > 0
            );
    }, [entities]);

    const activeRoomData = useMemo(() => rooms.find(r => r.name === selectedRoom), [rooms, selectedRoom]);

    // API object stable reference for modal
    const api = useMemo(() => ({
        toggleLight,
        setLightBrightness,
        openCover,
        closeCover,
        setCoverPosition,
        setClimateTemperature,
        callService
    }), [toggleLight, setLightBrightness, openCover, closeCover, setCoverPosition, setClimateTemperature, callService]);

    const closeModal = useCallback(() => setSelectedRoom(null), []);

    if (!isConnected && !isConnecting) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyState}>
                    <WifiOff size={48} color="#64748B" />
                    <Text style={styles.emptyTitle}>Nicht verbunden</Text>
                    <Pressable onPress={connect} style={styles.connectBtn}>
                        <Text style={styles.connectBtnText}>Verbinden</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? 24 : 16 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Räume</Text>
                    <Text style={styles.subtitle}>
                        {rooms.length} Bereiche • {rooms.reduce((acc, r) => acc + r.lights.length, 0)} Lichter
                    </Text>
                </View>

                {/* Grid */}
                <View style={styles.roomsGrid}>
                    {rooms.map((room) => {
                        const Icon = room.icon;
                        const lightsOn = room.lights.filter((l: any) => l.state === 'on').length;
                        const hasActive = lightsOn > 0 || room.mediaPlayers.some((m: any) => m.state === 'playing');
                        const temp = room.climates[0]?.attributes.current_temperature || room.sensors[0]?.state;

                        return (
                            <Pressable
                                key={room.name}
                                onPress={() => setSelectedRoom(room.name)}
                                style={[styles.roomCard, { width: isTablet ? '32%' : '48%' }]}
                            >
                                <LinearGradient
                                    colors={hasActive ? room.gradient : ['#1E293B', '#0F172A']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.cardGradient}
                                >
                                    <View style={[styles.iconContainer, hasActive && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                        <Icon size={24} color={hasActive ? '#FFF' : room.gradient[0]} />
                                    </View>

                                    <View style={styles.cardContent}>
                                        <Text numberOfLines={1} style={styles.roomName}>{room.name}</Text>
                                        <View style={styles.cardStats}>
                                            <Text style={styles.statsText}>
                                                {lightsOn > 0 ? `${lightsOn} an` : 'Aus'}
                                            </Text>
                                            {temp && (
                                                <Text style={styles.statsText}>• {temp}°</Text>
                                            )}
                                        </View>
                                    </View>
                                </LinearGradient>
                            </Pressable>
                        )
                    })}
                </View>
            </ScrollView>

            <RoomDetailModal
                room={activeRoomData}
                visible={!!selectedRoom}
                onClose={closeModal}
                api={api}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617', // Rich Dark
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 12,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 4,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        color: '#FFF',
        marginTop: 16,
        fontSize: 18,
    },
    connectBtn: {
        marginTop: 16,
        backgroundColor: '#3B82F6',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    connectBtnText: {
        color: '#FFF',
        fontWeight: '600',
    },
    // Grid
    roomsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    roomCard: {
        borderRadius: 24,
        overflow: 'hidden',
        height: 140,
    },
    cardGradient: {
        flex: 1,
        padding: 16,
        justifyContent: 'space-between',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardContent: {},
    roomName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFF',
    },
    cardStats: {
        flexDirection: 'row',
        marginTop: 4,
    },
    statsText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: '#000',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#020617',
    },
    modalHeader: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    titleIconBubble: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitleText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionAction: {
        padding: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    tile: {
        minHeight: 110,
    },
    tileContent: {
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 16,
        minHeight: 110,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    tileActive: {
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        borderColor: 'rgba(234, 179, 8, 0.5)',
    },
    tileActiveCover: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.5)',
    },
    tileActiveClimate: {
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderColor: 'rgba(249, 115, 22, 0.3)',
    },
    tileActiveMedia: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderColor: 'rgba(139, 92, 246, 0.5)',
    },
    tileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    tileIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tileState: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 4,
    },
    textActive: {
        color: '#FFF',
    },
    tileName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#CBD5E1',
        marginTop: 12,
    },
    tileSlider: {
        marginTop: 12,
        backgroundColor: '#1E293B',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    tileActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    actionBtn: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    climateControl: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        paddingHorizontal: 8,
    },
    climateTarget: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
        marginRight: 8,
    },
    playBtn: {
        padding: 8,
    }
});

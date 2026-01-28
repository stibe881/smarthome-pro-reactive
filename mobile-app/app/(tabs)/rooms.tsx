import React, { useMemo, useState, memo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import {
    Home, Bed, Sofa, UtensilsCrossed, Bath, Warehouse, Building2,
    Lightbulb, Blinds, ChevronRight, WifiOff, X,
    Briefcase, Baby, Dumbbell, Shirt, TreeDeciduous, Droplets,
    Thermometer, Gamepad2, BookOpen, Armchair, DoorOpen, ChevronUp,
    ParkingSquare, Flower2, Sun, Moon, LucideIcon,
    Wind, Fan, Play, Pause, Square, Volume2, Tv, Timer, Heart, Music, Coffee, Zap
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';

// Script/Scene Tile Component
// Script/Scene Tile Component
// Script/Scene Tile Component (Compact & Visual)
const SceneTile = memo(({ scene, activateScene, width }: any) => {
    const getSceneStyle = (entityId: string, name: string) => {
        const id = entityId.toLowerCase();
        const n = name.toLowerCase();

        if (id.includes('bed') || n.includes('schlafen') || n.includes('nacht')) {
            return {
                colors: ['#312E81', '#4F46E5'] as const,
                icon: Moon,
                iconColor: '#A5B4FC'
            };
        }
        if (id.includes('sex') || n.includes('romance') || n.includes('liebe')) {
            return {
                colors: ['#881337', '#E11D48'] as const,
                icon: Heart,
                iconColor: '#FDA4AF'
            };
        }
        if (id.includes('movie') || n.includes('film') || n.includes('tv') || n.includes('netflix')) {
            return {
                colors: ['#7F1D1D', '#EF4444'] as const, // Red
                icon: Tv,
                iconColor: '#FECACA'
            };
        }
        if (id.includes('party') || n.includes('musik')) {
            return {
                colors: ['#701A75', '#D946EF'] as const, // Fuchsia
                icon: Music,
                iconColor: '#F0ABFC'
            };
        }
        if (id.includes('essen') || n.includes('dinner') || id.includes('kochen') || n.includes('cooking')) {
            return {
                colors: ['#7C2D12', '#F97316'] as const, // Orange
                icon: UtensilsCrossed,
                iconColor: '#FDBA74'
            };
        }
        if (id.includes('coffee') || n.includes('kaffee') || n.includes('morgen') || n.includes('aufwachen') || n.includes('wake')) {
            return {
                colors: ['#D97706', '#F59E0B'] as const, // Amber
                icon: Sun,
                iconColor: '#FEF3C7'
            };
        }

        // Default
        return {
            colors: ['#1E293B', '#334155'] as const, // Slate
            icon: Zap,
            iconColor: '#CBD5E1'
        };
    };

    const style = getSceneStyle(scene.entity_id, scene.attributes.friendly_name || '');
    const Icon = style.icon;

    return (
        <View style={[styles.tile, { width, minHeight: 60, height: 60 }]}>
            <Pressable
                onPress={() => activateScene(scene.entity_id)}
                style={{ flex: 1 }}
            >
                <LinearGradient
                    colors={style.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.tileContent, {
                        minHeight: 60,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        padding: 12,
                        gap: 12,
                        borderWidth: 0
                    }]}
                >
                    <View style={[styles.tileIcon, { backgroundColor: 'rgba(255,255,255,0.15)', width: 36, height: 36, borderRadius: 18, marginBottom: 0 }]}>
                        <Icon size={18} color="#FFF" />
                    </View>
                    <Text numberOfLines={1} style={[styles.tileName, { color: '#FFF', fontWeight: '700', fontSize: 13, marginTop: 0 }]}>
                        {scene.attributes.friendly_name}
                    </Text>
                </LinearGradient>
            </Pressable>
        </View>
    );
});

// =====================================================
// UTILS
// =====================================================

const getRoomIcon = (roomName: string): LucideIcon => {
    const name = roomName.toLowerCase();
    if (name.includes('wohn') || name.includes('living')) return Sofa;
    if (name.includes('levin')) return Gamepad2;
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
    if (name.includes('treppe') || name.includes('stair')) return ChevronUp;
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

const RoomDetailModal = memo(({ room, visible, onClose, api, sleepTimerState }: any) => {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;
    const tileWidth = isTablet ? (width - 64 - 24) / 3 : (width - 32 - 12) / 2;

    const shutdownRoom = () => {
        if (!room) return;
        // Lights Off
        room.lights?.forEach((l: any) => api.callService('light', 'turn_off', l.entity_id));
        // Media Off
        room.mediaPlayers?.forEach((m: any) => api.callService('media_player', 'turn_off', m.entity_id));
        // Covers Close
        room.covers?.forEach((c: any) => api.closeCover(c.entity_id));
    };

    // Calculate if room is "Quiet" (Everything off/closed)
    const isRoomQuiet = useMemo(() => {
        if (!room) return true;
        const lightsOff = !room.lights?.some((l: any) => l.state === 'on');
        const mediaOff = !room.mediaPlayers?.some((m: any) => m.state === 'playing');
        const coversClosed = !room.covers?.some((c: any) => c.state === 'open' || (c.attributes.current_position || 0) > 0);
        return lightsOff && mediaOff && coversClosed;
    }, [room]);

    if (!room) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContainer, room.name === "Levins Zimmer" && { backgroundColor: '#0B1026' }]}>
                    {/* Background Effect for Levin */}
                    {room.name === "Levins Zimmer" && (
                        <View style={StyleSheet.absoluteFill}>
                            <LinearGradient
                                colors={['#0F172A', '#1E1B4B', '#312E81']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            {/* Simple Stars dotting */}
                            <View style={{ position: 'absolute', top: 50, left: 50, width: 2, height: 2, backgroundColor: '#FFF', borderRadius: 1, opacity: 0.7 }} />
                            <View style={{ position: 'absolute', top: 120, right: 80, width: 3, height: 3, backgroundColor: '#FFF', borderRadius: 1.5, opacity: 0.5 }} />
                            <View style={{ position: 'absolute', bottom: 200, left: 100, width: 4, height: 4, backgroundColor: '#A78BFA', borderRadius: 2, opacity: 0.6 }} />
                            <View style={{ position: 'absolute', top: '40%', right: '20%', width: 2, height: 2, backgroundColor: '#FFF', borderRadius: 1, opacity: 0.4 }} />
                        </View>
                    )}

                    {/* Background Effect for Lina */}
                    {room.name === "Linas Zimmer" && (
                        <View style={StyleSheet.absoluteFill}>
                            <LinearGradient
                                colors={['#4A044E', '#831843', '#BE185D']} // Dark Pink/Magents
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            {/* Sparkles/Polka dots */}
                            <View style={{ position: 'absolute', top: 60, left: 40, width: 6, height: 6, backgroundColor: '#FBCFE8', borderRadius: 3, opacity: 0.4 }} />
                            <View style={{ position: 'absolute', top: 150, right: 60, width: 4, height: 4, backgroundColor: '#FFF', borderRadius: 2, opacity: 0.6 }} />
                            <View style={{ position: 'absolute', bottom: 100, left: 80, width: 8, height: 8, backgroundColor: '#F472B6', borderRadius: 4, opacity: 0.3 }} />
                            <View style={{ position: 'absolute', top: '30%', right: '40%', width: 3, height: 3, backgroundColor: '#FFF', borderRadius: 1.5, opacity: 0.5 }} />
                        </View>
                    )}

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
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {/* Shutdown Button */}
                            <Pressable onPress={shutdownRoom} style={[styles.closeButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                                <Moon
                                    size={24}
                                    color={isRoomQuiet ? "#FDB813" : "#FFF"}
                                    fill={isRoomQuiet ? "#FDB813" : "transparent"}
                                />
                            </Pressable>
                            <Pressable onPress={onClose} style={styles.closeButton}>
                                <X size={24} color="#fff" />
                            </Pressable>
                        </View>
                    </LinearGradient>

                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                        {/* Scenes/Scripts Section (Moved to TOP) */}
                        {room.scripts?.length > 0 && (
                            <View style={styles.section}>
                                <SectionHeader title="Szenen" />
                                <View style={styles.grid}>
                                    {room.scripts.map((s: any) => (
                                        <SceneTile
                                            key={s.entity_id}
                                            scene={s}
                                            activateScene={(id: string) => api.callService('script', 'turn_on', id)}
                                            width={tileWidth}
                                        />
                                    ))}
                                    {room.scenes?.map((s: any) => (
                                        <SceneTile
                                            key={s.entity_id}
                                            scene={s}
                                            activateScene={(id: string) => api.activateScene(id)}
                                            width={tileWidth}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

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
                                <SectionHeader title="Beleuchtung" />
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

                        {/* Sleep Timer (Specific for Schlafzimmer) */}
                        {room.name === 'Schlafzimmer' && (
                            <View style={styles.section}>
                                <SectionHeader title={`Sleep Timer (Shield) ${sleepTimerState?.remaining ? `— Noch ${sleepTimerState.remaining} Min` : ''}`} />
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {[30, 60, 90, 120, 150].map((min) => {
                                        const isActive = sleepTimerState?.activeDuration === min;
                                        return (
                                            <Pressable
                                                key={min}
                                                style={{
                                                    backgroundColor: isActive ? '#3B82F6' : '#1E293B',
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 10,
                                                    borderRadius: 12,
                                                    borderWidth: 1,
                                                    borderColor: isActive ? '#60A5FA' : 'rgba(255,255,255,0.1)'
                                                }}
                                                onPress={() => sleepTimerState.startTimer(min)}
                                            >
                                                <Text style={{ color: isActive ? '#FFF' : '#E2E8F0', fontWeight: '600' }}>
                                                    {min === 90 ? '1.5 h' : min === 150 ? '2.5 h' : min >= 60 ? `${min / 60} h` : `${min} Min`}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                    <Pressable
                                        style={{ backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, opacity: sleepTimerState?.isRunning ? 1 : 0.5 }}
                                        onPress={sleepTimerState.stopTimer}
                                    >
                                        <Text style={{ color: '#FFF', fontWeight: '600' }}>Deaktivieren</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View >
        </Modal >
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
        activateScene,
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
            areaMap.set(room, { lights: [], covers: [], sensors: [], climates: [], mediaPlayers: [], scripts: [], scenes: [] });
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
            else if (entity.entity_id.startsWith('script.')) room.scripts.push(entity);
        });

        // CUSTOMIZATION: Wohnzimmer strict filtering
        const wohnzimmer = areaMap.get('Wohnzimmer');
        if (wohnzimmer) {
            wohnzimmer.lights = wohnzimmer.lights.filter((l: any) =>
                l.entity_id === 'light.wohnzimmer' ||
                l.entity_id === 'light.hue_play_gradient_lightstrip_1'
            );
            wohnzimmer.covers = wohnzimmer.covers.filter((c: any) =>
                c.entity_id === 'cover.wohnzimmer_sofa' ||
                c.entity_id === 'cover.wohnzimmer_spielplaetzchen'
            );

            // Add specific scripts to Wohnzimmer if they exist in entities
            const movieScript = entities.find(e => e.entity_id === 'script.movie_night');
            const sexScript = entities.find(e => e.entity_id === 'script.sex_wohnzimmer');

            wohnzimmer.scripts = []; // Reset and add specific
            if (movieScript) wohnzimmer.scripts.push(movieScript);
            if (sexScript) wohnzimmer.scripts.push(sexScript);

            // Filter Media Players
            wohnzimmer.mediaPlayers = wohnzimmer.mediaPlayers.filter((m: any) =>
                m.entity_id === 'media_player.fernseher_im_wohnzimmer_2' ||
                m.entity_id === 'media_player.nest_wohnzimmer_3'
            );

            // Clear others
            wohnzimmer.climates = [];
            wohnzimmer.sensors = [];
            wohnzimmer.scenes = [];
            wohnzimmer.scenes = [];
        }

        // CUSTOMIZATION: Essbereich strict filtering
        const essbereich = areaMap.get('Essbereich');
        if (essbereich) {
            // Lights
            essbereich.lights = essbereich.lights.filter((l: any) => l.entity_id === 'light.essbereich');

            // Covers
            essbereich.covers = essbereich.covers.filter((c: any) => c.entity_id === 'cover.essbereich');

            // Scenes
            const dinnerScene = entities.find(e => e.entity_id === 'scene.essbereich_essen');
            essbereich.scenes = [];
            if (dinnerScene) essbereich.scenes.push(dinnerScene);

            // Media Players
            essbereich.mediaPlayers = essbereich.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.kuche_2');

            // Clear others
            essbereich.sensors = [];
            essbereich.climates = [];
            essbereich.scripts = [];
            essbereich.scripts = [];
        }

        // CUSTOMIZATION: Küche strict filtering
        const kueche = areaMap.get('Küche');
        if (kueche) {
            // Lights
            kueche.lights = kueche.lights.filter((l: any) => l.entity_id === 'light.kuche');

            // Covers
            kueche.covers = kueche.covers.filter((c: any) => c.entity_id === 'cover.kuche');

            // Scripts
            const cookingScript = entities.find(e => e.entity_id === 'script.kochen');
            kueche.scripts = [];
            if (cookingScript) kueche.scripts.push(cookingScript);

            // Media Players
            kueche.mediaPlayers = kueche.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.kuche_2');

            // Clear others
            kueche.sensors = [];
            kueche.climates = [];
            kueche.scenes = [];
            kueche.scenes = [];
        }

        // CUSTOMIZATION: Schlafzimmer strict filtering
        const schlafzimmer = areaMap.get('Schlafzimmer');
        if (schlafzimmer) {
            // Lights (Specific hue ambiance)
            schlafzimmer.lights = schlafzimmer.lights.filter((l: any) => l.entity_id === 'light.hue_ambiance_ceiling_1');

            // Scripts
            const bedTime = entities.find(e => e.entity_id === 'script.bed_time');
            const sexScript = entities.find(e => e.entity_id === 'script.sex_schlafzimmer');

            schlafzimmer.scripts = [];
            if (bedTime) schlafzimmer.scripts.push(bedTime);
            if (sexScript) schlafzimmer.scripts.push(sexScript);

            // Media
            schlafzimmer.mediaPlayers = schlafzimmer.mediaPlayers.filter((m: any) =>
                m.entity_id === 'media_player.shield_schlafzimmer' ||
                m.entity_id === 'media_player.nest_schlafzimmer_2'
            );

            // Clear others
            schlafzimmer.covers = [];
            schlafzimmer.sensors = [];
            schlafzimmer.climates = [];
            schlafzimmer.scenes = [];
            schlafzimmer.scenes = [];
        }

        // CUSTOMIZATION: Levins Zimmer strict filtering & Child Theme
        const levin = areaMap.get('Levins Zimmer');
        if (levin) {
            // Helper to rename
            const rename = (e: any, newName: string) => ({ ...e, attributes: { ...e.attributes, friendly_name: newName } });

            // Lights
            const lLev = entities.find(e => e.entity_id === 'light.levins_zimmer');
            const lWardrobe = entities.find(e => e.entity_id === 'light.hue_play_1_2');
            const lGalaxy = entities.find(e => e.entity_id === 'light.galaxie_kinderzimmer');

            levin.lights = [];
            if (lLev) levin.lights.push(lLev);
            if (lWardrobe) levin.lights.push(rename(lWardrobe, 'Licht Kleiderschrank'));
            if (lGalaxy) levin.lights.push(lGalaxy);

            // Scenes/Scripts
            const sFocus = entities.find(e => e.entity_id === 'scene.levins_zimmer_konzentrieren');
            const sBed = entities.find(e => e.entity_id === 'script.bed_time_levin');
            const sWake = entities.find(e => e.entity_id === 'scene.levins_zimmer_herbsternte');
            const sParty = entities.find(e => e.entity_id === 'script.levin_party');

            levin.scripts = [];
            levin.scenes = [];

            // We combine them into 'scripts' or 'scenes' bucket for display, or distribute them
            // The UI combines them. Let's push all to scripts/scenes.
            if (sFocus) levin.scenes.push(sFocus);
            if (sWake) levin.scenes.push(rename(sWake, 'Aufwachen'));

            if (sBed) levin.scripts.push(sBed);
            if (sParty) levin.scripts.push(sParty);

            // Media
            levin.mediaPlayers = levin.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.hub_levin');

            // Theme Override
            levin.gradient = ['#4F46E5', '#818CF8']; // Starry Blue/Indigo

            // Clear others
            levin.covers = [];
            levin.sensors = [];
            levin.climates = [];
        }

        // CUSTOMIZATION: Linas Zimmer strict filtering & Girl Theme
        const lina = areaMap.get('Linas Zimmer');
        if (lina) {
            // Lights
            lina.lights = lina.lights.filter((l: any) =>
                l.entity_id === 'light.licht_lina_decke' ||
                l.entity_id === 'light.hue_play_wickeltisch'
            );

            // Media
            lina.mediaPlayers = lina.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.hub_lina_2');

            // Theme Override
            lina.gradient = ['#DB2777', '#EC4899']; // Pink

            // Clear others
            lina.covers = [];
            lina.sensors = [];
            lina.climates = [];
            lina.scripts = [];
            lina.scenes = [];
        }

        // Return only rooms that have at least one device, in the order of ALLOWED_ROOMS
        // Sort lights and covers alphabetically by friendly_name
        const sortByName = (a: any, b: any) => {
            const nameA = (a.attributes.friendly_name || '').toLowerCase();
            const nameB = (b.attributes.friendly_name || '').toLowerCase();
            return nameA.localeCompare(nameB, 'de');
        };

        return ALLOWED_ROOMS
            .map(name => {
                const data = areaMap.get(name);
                return {
                    name,
                    ...data,
                    lights: data.lights.sort(sortByName),
                    covers: data.covers.sort(sortByName),
                    gradient: ROOM_GRADIENTS[ALLOWED_ROOMS.indexOf(name) % ROOM_GRADIENTS.length],
                    icon: getRoomIcon(name)
                };
            })
            .filter(room =>
                room.lights.length > 0 ||
                room.covers.length > 0 ||
                room.climates.length > 0 ||
                room.mediaPlayers.length > 0
            )
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }, [entities]);

    // API object stable reference for modal
    const api = useMemo(() => ({
        toggleLight,
        setLightBrightness,
        openCover,
        closeCover,
        setCoverPosition,
        setClimateTemperature,
        callService,
        activateScene
    }), [toggleLight, setLightBrightness, openCover, closeCover, setCoverPosition, setClimateTemperature, callService, activateScene]);

    const activeRoomData = useMemo(() => rooms.find(r => r.name === selectedRoom), [rooms, selectedRoom]);

    // Sleep Timer Logic
    const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);
    const [activeDuration, setActiveDuration] = useState<number | null>(null);
    const [remainingTime, setRemainingTime] = useState<number | null>(null);

    // Sync with script state
    useEffect(() => {
        const script = entities.find(e => e.entity_id === 'script.sleep_timer');
        if (script && script.state === 'off') {
            setSleepTimerEnd(null);
            setActiveDuration(null);
            setRemainingTime(null);
        }
    }, [entities]);

    // Countdown interval
    useEffect(() => {
        if (!sleepTimerEnd) return;
        const interval = setInterval(() => {
            const now = Date.now();
            const left = Math.ceil((sleepTimerEnd - now) / 60000);
            if (left <= 0) {
                setRemainingTime(0);
                setSleepTimerEnd(null); // Expired locally
            } else {
                setRemainingTime(left);
            }
        }, 1000); // Check every second for smoother UI update, but display minutes
        return () => clearInterval(interval);
    }, [sleepTimerEnd]);

    const sleepTimerState = useMemo(() => ({
        activeDuration,
        remaining: remainingTime,
        isRunning: !!sleepTimerEnd,
        startTimer: (min: number) => {
            const now = Date.now();
            setSleepTimerEnd(now + min * 60000);
            setActiveDuration(min);
            setRemainingTime(min);
            api.callService('script', 'turn_on', 'script.sleep_timer', { variables: { duration: min, entity_id: 'media_player.shield_schlafzimmer' } });
        },
        stopTimer: () => {
            setSleepTimerEnd(null);
            setActiveDuration(null);
            setRemainingTime(null);
            api.callService('script', 'turn_on', 'script.sleep_timer_cancel', { variables: { entity_id: 'media_player.shield_schlafzimmer' } });
        }
    }), [activeDuration, remainingTime, sleepTimerEnd, api]);

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
                sleepTimerState={sleepTimerState}
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

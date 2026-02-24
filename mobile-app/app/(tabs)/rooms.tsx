import React, { useMemo, useState, memo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, Modal, StyleSheet, ActivityIndicator, Image, Alert, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
    Home, Bed, Sofa, UtensilsCrossed, Bath, Warehouse, Building2,
    Lightbulb, Blinds, ChevronRight, WifiOff, X,
    Briefcase, Baby, Dumbbell, Shirt, TreeDeciduous, Droplets,
    Thermometer, Gamepad2, BookOpen, Armchair, DoorOpen, ChevronUp,
    ParkingSquare, Flower2, Sun, Moon, LucideIcon, Edit3,
    Wind, Fan, Play, Pause, Square, Volume2, Tv, Timer, Heart, Music, Coffee, Zap, Camera,
    SkipBack, SkipForward, Palette, DoorClosed, Rocket, Star, Crown, Power, ChevronDown
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import LightControlModal from '../../components/LightControlModal';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import ShutterControlModal from '../../components/ShutterControlModal';
import { RoomEditModal } from '../../components/RoomEditModal';
import { RoomContentEditModal, loadRoomOverride, applyRoomOverrides } from '../../components/RoomContentEditModal';
import { EntityState } from '../../contexts/HomeAssistantContext';

// Theme Types
type RoomTheme = {
    backgroundColors: [string, string, string];
    textColor: string;
    iconColor: string;
    accentColor: string;
    isDark: boolean;
};

const KIDS_THEMES: Record<string, RoomTheme> = {
    'levin': {
        backgroundColors: ['#0B1026', '#1E1B4B', '#312E81'], // Space Dark Blue
        textColor: '#F8FAFC',
        iconColor: '#FFF',
        accentColor: '#818CF8',
        isDark: true
    },
    'lina': {
        backgroundColors: ['#FDF2F8', '#FCE7F3', '#FBCFE8'], // Very light pink
        textColor: '#831843', // Dark pink text
        iconColor: '#DB2777',
        accentColor: '#EC4899',
        isDark: false
    }
};

// Script/Scene Tile Component
// Script/Scene Tile Component
// Script/Scene Tile Component (Compact & Visual)
const SceneTile = memo(({ scene, activateScene, width }: any) => {
    const { colors } = useTheme();
    const getSceneStyle = (entityId: string, name: string) => {
        const id = entityId.toLowerCase();
        const n = name.toLowerCase();

        // Gaming / Spielen / Zocken
        if (n.includes('spielen') || n.includes('zocken') || n.includes('gaming') || id.includes('zock') || id.includes('game')) {
            return {
                colors: ['#7C3AED', '#A855F7'] as const, // Purple
                icon: Gamepad2,
                iconColor: '#DDD6FE'
            };
        }
        // Work / Arbeit
        if (n.includes('arbeit') || n.includes('work') || id.includes('arbeit')) {
            return {
                colors: ['#0369A1', '#0EA5E9'] as const, // Sky Blue
                icon: Briefcase,
                iconColor: '#BAE6FD'
            };
        }
        // Focus / Konzentrieren
        if (n.includes('konzentrier') || n.includes('focus') || n.includes('konzentration')) {
            return {
                colors: ['#065F46', '#10B981'] as const, // Emerald
                icon: BookOpen,
                iconColor: '#A7F3D0'
            };
        }
        // Cinema / Kino
        if (n.includes('kino') || n.includes('cinema') || id.includes('kino')) {
            return {
                colors: ['#7F1D1D', '#EF4444'] as const, // Red
                icon: Tv,
                iconColor: '#FECACA'
            };
        }
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
            colors: [colors.card, colors.border] as const, // Theme aware
            icon: Zap,
            iconColor: colors.subtext
        };
    };

    const style = getSceneStyle(scene.entity_id, scene.attributes.friendly_name || '');
    const Icon = style.icon;

    // Renaming Logic (Specific overrides requested by user)
    let displayName = scene.attributes.friendly_name;
    if (displayName === 'Arbeit mit Musik') displayName = 'Arbeit';
    else if (displayName === 'Kino Büro') displayName = 'Kino';
    else if (displayName === 'Büro Konzentrieren') displayName = 'Konzentrieren';
    else if (displayName === 'Büro Zocken') displayName = 'Zocken';
    else if (displayName?.toLowerCase().startsWith('levins')) displayName = 'Spielen';

    return (
        <View style={[styles.tile, { width, height: 72, borderRadius: 20, overflow: 'hidden', borderWidth: 0, backgroundColor: 'transparent' }]}>
            <Pressable
                onPress={() => activateScene(scene.entity_id)}
                style={{ flex: 1 }}
            >
                <LinearGradient
                    colors={style.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        paddingHorizontal: 16,
                        gap: 16
                    }}
                >
                    <View style={{
                        width: 40, height: 40, borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
                    }}>
                        <Icon size={20} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: '#FFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 }}>
                            {displayName}
                        </Text>
                        {/* Secondary info hidden as requested */}
                    </View>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Play size={10} color="#FFF" fill="#FFF" />
                    </View>
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

const LightTile = memo(({ light, toggleLight, setBrightness, width, onLongPress, theme: roomTheme }: any) => {
    const { colors } = useTheme();
    const isOn = light.state === 'on';
    const brightness = light.attributes.brightness || 0;
    const activeColor = roomTheme ? roomTheme.accentColor : colors.accent;
    const colorModes = light.attributes.supported_color_modes || [];
    const supportsBrightness = colorModes.length > 0 && !(colorModes.length === 1 && colorModes[0] === 'onoff');
    const supportsColor = colorModes.some((m: string) => ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(m));

    return (
        <View style={[styles.tile, { width, backgroundColor: 'transparent', borderWidth: 0 }]}>
            <View style={[
                styles.tileContent,
                {
                    backgroundColor: roomTheme ? 'rgba(255,255,255,0.1)' : colors.card,
                    borderColor: roomTheme ? 'rgba(255,255,255,0.1)' : colors.border,
                    borderWidth: 1,
                },
                isOn && {
                    backgroundColor: activeColor + '20',
                    borderColor: activeColor + '50',
                }
            ]}>
                <View style={[styles.tileHeader]}>
                    <View style={[styles.tileIcon, { backgroundColor: isOn ? activeColor : (roomTheme ? 'rgba(255,255,255,0.1)' : colors.background) }]}>
                        <Lightbulb size={24} color={isOn ? "#FFF" : colors.subtext} />
                    </View>
                    {onLongPress && supportsColor && (
                        <Pressable
                            onPress={() => onLongPress(light)}
                            hitSlop={12}
                            style={{ position: 'absolute', top: 0, right: 0, padding: 4 }}
                        >
                            <Palette size={20} color={isOn ? "#FFF" : "#94A3B8"} opacity={0.8} />
                        </Pressable>
                    )}
                </View>
                <Pressable
                    onPress={() => toggleLight(light.entity_id)}
                    onLongPress={() => onLongPress && onLongPress(light)}
                >
                    <View style={{ marginTop: 8 }}>
                        <Text numberOfLines={1} style={[styles.tileName, { color: roomTheme ? '#FFF' : colors.text, marginTop: 0 }, isOn && styles.textActive]}>
                            {light.attributes.friendly_name}
                        </Text>
                        <Text style={[styles.tileState, { color: roomTheme ? 'rgba(255,255,255,0.6)' : colors.subtext }, isOn && styles.textActive, { marginTop: 2, fontSize: 11 }]}>
                            {isOn ? (supportsBrightness ? `${Math.round(brightness / 255 * 100)}%` : 'An') : 'Aus'}
                        </Text>
                    </View>
                </Pressable>

                {isOn && supportsBrightness && (
                    <View style={{ marginTop: 8 }}>
                        <Slider
                            style={{ height: 36, width: '100%' }}
                            value={brightness / 255}
                            onSlidingComplete={(val) => setBrightness(light.entity_id, Math.round(val * 255))}
                            minimumValue={0}
                            maximumValue={1}
                            minimumTrackTintColor={activeColor}
                            maximumTrackTintColor="rgba(255,255,255,0.1)"
                            thumbTintColor="#FFF"
                        />
                    </View>
                )}
            </View>
        </View>
    );
});

const CoverTile = memo(({ cover, openCover, closeCover, stopCover, pressButton, onPress, width, theme: roomTheme }: any) => {
    const { colors } = useTheme();
    const isOpen = cover.state === 'open' || (cover.attributes.current_position && cover.attributes.current_position > 0);
    const position = cover.attributes.current_position;
    const activeColor = roomTheme ? roomTheme.accentColor : colors.accent;

    return (
        <Pressable
            onPress={() => onPress?.(cover)}
            style={[styles.tile, { width, backgroundColor: roomTheme ? 'rgba(255,255,255,0.1)' : colors.card, borderColor: roomTheme ? 'rgba(255,255,255,0.1)' : colors.border }]}
        >
            <View style={[styles.tileContent, isOpen && { backgroundColor: activeColor + '20', borderColor: activeColor + '50' }]}>
                {/* My Position Star (top-left) */}
                {cover.myPositionEntity && (
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            pressButton(cover.myPositionEntity!);
                        }}
                        style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(245, 158, 11, 0.3)',
                            zIndex: 10,
                        }}
                    >
                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                    </Pressable>
                )}

                <View style={styles.tileHeader}>
                    <View style={[styles.tileIcon, { backgroundColor: isOpen ? activeColor : (roomTheme ? 'rgba(255,255,255,0.1)' : colors.background) }]}>
                        <Blinds size={24} color={isOpen ? "#FFF" : activeColor} />
                    </View>
                    <Text style={[styles.tileState, { color: roomTheme ? 'rgba(255,255,255,0.6)' : colors.subtext }, isOpen && styles.textActive]}>
                        {position !== undefined ? `${position}%` : cover.state}
                    </Text>
                </View>
                <Text numberOfLines={2} style={[styles.tileName, { color: roomTheme ? '#FFF' : colors.text }, isOpen && styles.textActive]}>
                    {cover.attributes.friendly_name}
                </Text>

                {/* Up / Stop / Down Buttons */}
                <View style={styles.tileActions}>
                    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openCover(cover.entity_id); }} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); stopCover(cover.entity_id); }} style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                        <Square size={12} color="#EF4444" fill="#EF4444" />
                    </Pressable>
                    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); closeCover(cover.entity_id); }} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>↓</Text>
                    </Pressable>
                </View>
            </View>
        </Pressable>
    );
});

const ClimateTile = memo(({ climate, setTemp, width, theme: roomTheme }: any) => {
    const { colors } = useTheme();
    const currentTemp = climate.attributes.current_temperature;
    const targetTemp = climate.attributes.temperature;
    const label = climate.attributes.friendly_name;
    const activeColor = roomTheme ? roomTheme.accentColor : colors.warning; // Default to warning (Orange) for Climate

    return (
        <View style={[styles.tile, { width, backgroundColor: roomTheme ? 'rgba(255,255,255,0.1)' : colors.card }]}>
            <View style={[styles.tileContent, styles.tileActiveClimate]}>
                <View style={styles.tileHeader}>
                    <View style={[styles.tileIcon, { backgroundColor: activeColor }]}>
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
                        minimumTrackTintColor={activeColor}
                        maximumTrackTintColor="rgba(255,255,255,0.2)"
                        thumbTintColor="#FFF"
                    />
                </View>
            </View>
        </View>
    );
});

const MediaTile = memo(({ player, api, width, theme }: any) => {
    const { colors } = useTheme();
    const { getEntityPictureUrl } = useHomeAssistant();
    const isPlaying = player.state === 'playing';
    const isOff = player.state === 'off' || player.state === 'unavailable';
    const volume = player.attributes.volume_level || 0;

    // Smart metadata extraction
    const appName = player.attributes.app_name;
    const isSpotify = appName === 'Spotify';

    // Title/Artist logic
    let title = player.attributes.media_title;
    let artist = player.attributes.media_artist || player.attributes.media_series_title;

    if (isOff) {
        title = "Ausgeschaltet";
        artist = "Tippen zum Starten";
    } else if (!title) {
        title = appName || player.state;
        artist = "Keine Wiedergabe";
    }

    // Controls
    const togglePlay = () => api.callService('media_player', isPlaying ? 'media_pause' : 'media_play', player.entity_id);
    const togglePower = () => api.callService('media_player', isOff ? 'turn_on' : 'turn_off', player.entity_id);
    const nextTrack = () => api.callService('media_player', 'media_next_track', player.entity_id);
    const prevTrack = () => api.callService('media_player', 'media_previous_track', player.entity_id);
    const setVolume = (val: number) => api.callService('media_player', 'volume_set', player.entity_id, { volume_level: val });

    const imageUrl = player.attributes.entity_picture ? getEntityPictureUrl(player.attributes.entity_picture) : null;
    const activeColor = theme ? theme.accentColor : colors.accent;

    // Layout calculation - Adjust height based on whether controls fit
    // Standard tile height is usually ~150-180. We make this one slightly taller to fit everything nicely if needed.
    const TILE_HEIGHT = 200;

    return (
        <View style={[styles.tile, { width, height: TILE_HEIGHT, padding: 0, overflow: 'hidden', borderWidth: 0, borderRadius: 24, backgroundColor: colors.card }]}>
            {/* Background Layer */}
            {imageUrl && !isOff ? (
                <Image
                    source={{ uri: imageUrl }}
                    style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
                    resizeMode="cover"
                    blurRadius={40}
                />
            ) : (
                <LinearGradient
                    colors={[colors.card, colors.background]}
                    style={StyleSheet.absoluteFill}
                />
            )}

            {/* Gradient Overlay for Readability */}
            <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                style={StyleSheet.absoluteFill}
            />

            <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
                {/* Header: Name + Power */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOff ? '#64748B' : (isPlaying ? '#22C55E' : '#EAB308') }} />
                        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            {player.attributes.friendly_name}
                        </Text>
                    </View>
                    <Pressable
                        onPress={togglePower}
                        hitSlop={12}
                        style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}
                    >
                        <Power size={14} color={isOff ? '#EF4444' : '#FFF'} />
                    </Pressable>
                </View>

                {/* Main Content: Art + Info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 4 }}>
                    {/* Floating Artwork */}
                    <View style={{
                        width: 56, height: 56, borderRadius: 14,
                        backgroundColor: colors.border,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6,
                        alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                    }}>
                        {imageUrl && !isOff ? (
                            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <Music size={24} color="#64748B" />
                        )}
                    </View>

                    {/* Meta */}
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text numberOfLines={1} style={{ color: '#FFF', fontWeight: '700', fontSize: 16, marginBottom: 2 }}>
                            {title}
                        </Text>
                        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                            {artist}
                        </Text>
                    </View>
                </View>

                {/* Controls Section */}
                <View style={{ gap: 14 }}>
                    {/* Playback Buttons */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
                        <Pressable onPress={prevTrack} disabled={isOff} style={{ opacity: isOff ? 0.3 : 1 }}>
                            <SkipBack size={24} color="#FFF" />
                        </Pressable>

                        <Pressable
                            onPress={togglePlay}
                            disabled={isOff}
                            style={{
                                width: 48, height: 48, borderRadius: 24,
                                backgroundColor: isOff ? 'rgba(255,255,255,0.1)' : '#FFF',
                                alignItems: 'center', justifyContent: 'center',
                                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2
                            }}
                        >
                            {isPlaying ? (
                                <Pause size={24} color="#0F172A" fill="#0F172A" />
                            ) : (
                                <Play size={24} color={isOff ? 'rgba(255,255,255,0.3)' : '#0F172A'} fill={isOff ? 'rgba(255,255,255,0.3)' : '#0F172A'} style={{ marginLeft: 3 }} />
                            )}
                        </Pressable>

                        <Pressable onPress={nextTrack} disabled={isOff} style={{ opacity: isOff ? 0.3 : 1 }}>
                            <SkipForward size={24} color="#FFF" />
                        </Pressable>
                    </View>

                    {/* Volume Slider */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Volume2 size={16} color="rgba(255,255,255,0.5)" />
                        <Slider
                            style={{ flex: 1, height: 20 }}
                            value={volume}
                            onSlidingComplete={setVolume}
                            minimumValue={0}
                            maximumValue={1}
                            minimumTrackTintColor={activeColor}
                            maximumTrackTintColor="rgba(255,255,255,0.15)"
                            thumbTintColor="#FFF"
                        />
                    </View>
                </View>
            </View>
        </View>
    );
});

const SensorTile = memo(({ sensor, width }: any) => {
    const { colors } = useTheme();
    const isBinary = sensor.entity_id.startsWith('binary_sensor.');
    const isOn = sensor.state === 'on';

    // Icon Logic
    let Icon: any = Zap;
    if (sensor.entity_id.includes('temp')) Icon = Thermometer;
    else if (sensor.entity_id.includes('humid')) Icon = Droplets;
    else if (sensor.entity_id.includes('wind')) Icon = Wind;
    else if (sensor.entity_id.includes('rain')) Icon = Droplets;

    // Display Logic
    let display = sensor.state;
    if (isBinary) {
        if (sensor.entity_id.includes('rain')) display = isOn ? 'Regen' : 'Trocken';
        else if (sensor.attributes.device_class === 'door' || sensor.attributes.device_class === 'window' || sensor.entity_id.includes('tur') || sensor.entity_id.includes('door')) {
            display = isOn ? 'Offen' : 'Geschlossen';
        }
        else display = isOn ? 'An' : 'Aus';
    } else {
        display = `${sensor.state}${sensor.attributes.unit_of_measurement ? ` ${sensor.attributes.unit_of_measurement}` : ''}`;
    }

    // Friendly Name Cleanup
    let name = sensor.attributes.friendly_name;
    const isWetterstation = name.startsWith('Wetterstation ');
    if (isWetterstation) name = name.replace('Wetterstation ', '');

    // Ensure specific sensor names
    if (sensor.entity_id === 'binary_sensor.balkonture') name = 'Balkontüre';
    if (sensor.entity_id === 'binary_sensor.highlighttur') name = 'Highlighttür';
    if (sensor.entity_id === 'binary_sensor.waschkuchenture') name = 'Waschküchentüre';
    if (sensor.entity_id === 'binary_sensor.terrassenture_tur') name = 'Terrassentüre';

    // SPECIAL LOGIC: Specific Doors (Balkon, Highlight, Waschküche)
    // User Request: Closed = Green + OpenIcon. Open = Red + ClosedIcon.
    const isSpecialDoor = ['binary_sensor.balkonture', 'binary_sensor.highlighttur', 'binary_sensor.waschkuchenture', 'binary_sensor.terrassenture_tur'].includes(sensor.entity_id);
    let specialColor = null;
    let SpecialIcon = null;

    if (isSpecialDoor) {
        if (isOn) { // Open
            specialColor = '#EF4444'; // Red
            SpecialIcon = DoorClosed; // User requested "icon eine geschlossene türe" when open
        } else { // Closed
            specialColor = '#22C55E'; // Green
            SpecialIcon = DoorOpen; // User requested "icon eine geöffnete türe" when closed
        }
    }

    // Determine final styles
    const activeColor = specialColor || (isBinary && isOn ? "#60A5FA" : colors.subtext);
    const bgColor = specialColor ? `${specialColor}33` : (isBinary && isOn ? 'rgba(59, 130, 246, 0.2)' : colors.background);
    const borderColor = specialColor ? `${specialColor}66` : (isBinary && isOn ? 'rgba(59, 130, 246, 0.4)' : colors.border);
    const textColor = specialColor ? '#FFF' : (isBinary && isOn ? '#FFF' : colors.text);

    // Override Icon if special
    if (SpecialIcon) Icon = SpecialIcon;

    return (
        <View style={{
            width: 110,
            height: 80,
            justifyContent: 'space-between',
            backgroundColor: bgColor,
            padding: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: borderColor,
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Icon size={18} color={specialColor || activeColor} />
            </View>

            <View>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: textColor, marginBottom: 2 }}>
                    {display}
                </Text>

                {/* Hide secondary info for Wetterstation (Terrasse) as requested */}
                {!isWetterstation && (
                    <Text numberOfLines={1} style={{ fontSize: 11, color: colors.subtext }}>
                        {name}
                    </Text>
                )}
            </View>
        </View>
    );
});




const CameraTile = memo(({ camera, width, api }: any) => {
    const { colors } = useTheme();
    const { haBaseUrl, getCredentials } = useHomeAssistant();
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [headers, setHeaders] = useState<any>(null);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            const creds = await getCredentials();
            if (mounted && creds && haBaseUrl) {
                // Setup headers
                setHeaders({
                    Authorization: `Bearer ${creds.token}`
                });

                // Construct Clean URL
                const cleanBaseUrl = haBaseUrl.replace(/\/$/, '');
                // Try entity_picture first if it's a proxy link, otherwise standard stream
                // Use standard MJPEG stream endpoint
                setStreamUrl(`${cleanBaseUrl}/api/camera_proxy_stream/${camera.entity_id}`);
            }
        };
        load();
        return () => { mounted = false; };
    }, [camera.entity_id, haBaseUrl]);

    return (
        <View style={[styles.tile, { width, height: width * 0.75 }]}>
            <View style={[styles.tileContent, { padding: 0, overflow: 'hidden' }]}>
                {streamUrl && headers ? (
                    <Image
                        source={{
                            uri: streamUrl,
                            headers: headers
                        }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
                        <Camera size={32} color={colors.subtext} />
                        <ActivityIndicator size="small" color={colors.subtext} style={{ marginTop: 8 }} />
                    </View>
                )}

                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <Text numberOfLines={1} style={[styles.tileName, { marginTop: 0, color: '#FFF', fontSize: 12 }]}>
                        {camera.attributes.friendly_name}
                    </Text>
                </View>
            </View>
        </View>
    );
});

const HelperTile = memo(({ entity, api, width, theme }: any) => {
    const { colors } = useTheme();
    const activeColor = theme ? theme.accentColor : colors.accent;
    const isInputSelect = entity.entity_id.startsWith('input_select.');
    const state = entity.state;

    // Timer Logic for TV Bedroom
    if (isInputSelect && entity.entity_id === 'input_select.timer_tv_schlafzimmer') {
        const icon = Timer;
        const isActive = state?.toLowerCase() !== 'aus';

        return (
            <View style={[styles.tile, { width }]}>
                <View style={[styles.tileContent, isActive && { backgroundColor: activeColor + '20', borderColor: activeColor + '50' }]}>
                    <View style={styles.tileHeader}>
                        <View style={[styles.tileIcon, isActive && { backgroundColor: activeColor }]}>
                            <Timer size={24} color={isActive ? "#FFF" : activeColor} />
                        </View>
                        <Text style={[styles.tileState, isActive && styles.textActive]}>
                            {state}
                        </Text>
                    </View>
                    <Text numberOfLines={2} style={[styles.tileName, isActive && styles.textActive]}>
                        TV Timer
                    </Text>

                    {/* Simple Dropdown Trigger or Cycle */}
                    <View style={styles.tileActions}>
                        <Pressable
                            onPress={() => {
                                const options = entity.attributes.options || [];

                                Alert.alert(
                                    "Timer einstellen",
                                    `Aktuell: ${state}`,
                                    [
                                        // Specific "Ausschalten" option if active, or just "Aus" if in list.
                                        // We map all options.
                                        ...options.map((opt: string) => ({
                                            text: opt,
                                            onPress: () => api.callService('input_select', 'select_option', entity.entity_id, { option: opt }),
                                            style: (opt.toLowerCase() === 'aus') ? 'destructive' : 'default'
                                        })),
                                        { text: "Abbrechen", style: "cancel" }
                                    ]
                                );
                            }}
                            style={[styles.actionBtn, { width: '100%' }]}
                        >
                            <Text style={styles.actionBtnText}>{isActive ? 'Ändern' : 'Starten'}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }

    // input_boolean: toggle on/off
    const isInputBoolean = entity.entity_id.startsWith('input_boolean.');
    if (isInputBoolean) {
        const isOn = state === 'on';
        const displayName = entity.attributes?.friendly_name || entity.entity_id;

        return (
            <View style={[styles.tile, { width, backgroundColor: colors.card }]}>
                <Pressable
                    onPress={() => api.callService('input_boolean', 'toggle', entity.entity_id)}
                    style={[styles.tileContent, isOn && { backgroundColor: activeColor + '20', borderColor: activeColor + '50' }]}
                >
                    <View style={styles.tileHeader}>
                        <View style={[styles.tileIcon, { backgroundColor: isOn ? activeColor : colors.background }]}>
                            <Power size={24} color={isOn ? '#FFF' : colors.subtext} />
                        </View>
                        <Text style={[styles.tileState, { color: colors.subtext }, isOn && styles.textActive]}>
                            {isOn ? 'An' : 'Aus'}
                        </Text>
                    </View>
                    <Text numberOfLines={2} style={[styles.tileName, { color: colors.text }, isOn && styles.textActive]}>
                        {displayName}
                    </Text>
                </Pressable>
            </View>
        );
    }

    // Generic input_select: show current option + tap to select
    if (isInputSelect) {
        const options = entity.attributes?.options || [];
        const displayName = entity.attributes?.friendly_name || entity.entity_id;

        return (
            <View style={[styles.tile, { width, backgroundColor: colors.card }]}>
                <Pressable
                    onPress={() => {
                        Alert.alert(
                            displayName,
                            `Aktuell: ${state}`,
                            [
                                ...options.map((opt: string) => ({
                                    text: opt,
                                    onPress: () => api.callService('input_select', 'select_option', entity.entity_id, { option: opt }),
                                    style: (opt === state) ? 'cancel' : 'default' as any
                                })),
                                { text: 'Abbrechen', style: 'cancel' }
                            ]
                        );
                    }}
                    style={[styles.tileContent]}
                >
                    <View style={styles.tileHeader}>
                        <View style={[styles.tileIcon, { backgroundColor: colors.background }]}>
                            <ChevronDown size={24} color={colors.subtext} />
                        </View>
                        <Text style={[styles.tileState, { color: colors.subtext }]} numberOfLines={1}>
                            {state}
                        </Text>
                    </View>
                    <Text numberOfLines={2} style={[styles.tileName, { color: colors.text }]}>
                        {displayName}
                    </Text>
                </Pressable>
            </View>
        );
    }

    return null;
});

const RoomDetailModal = memo(({ room, visible, onClose, api, sleepTimerState, onSelectCover, userRole, allEntities }: any) => {
    const { width } = useWindowDimensions();
    const { colors } = useTheme();
    const isTablet = width >= 768;
    const tileWidth = isTablet ? (width - 64 - 24) / 3 : (width - 32 - 12) / 2;
    const [selectedLight, setSelectedLight] = useState<any>(null);
    const [showContentEdit, setShowContentEdit] = useState(false);
    const [overrideVersion, setOverrideVersion] = useState(0);
    const [roomOverride, setRoomOverride] = useState<any>(null);

    // Load overrides when room opens
    React.useEffect(() => {
        if (visible && room) {
            loadRoomOverride(room.name).then(setRoomOverride);
        }
    }, [visible, room?.name, overrideVersion]);

    // Apply overrides to room data
    const displayRoom = useMemo(() => {
        if (!room) return room;
        if (!roomOverride) return room;
        return applyRoomOverrides(room, roomOverride, allEntities);
    }, [room, roomOverride, allEntities]);

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

    // Theme Logic
    const roomNameLower = room?.name.toLowerCase() || '';
    let theme = null;
    if (roomNameLower.includes('levin')) theme = KIDS_THEMES['levin'];
    if (roomNameLower.includes('lina')) theme = KIDS_THEMES['lina'];

    // Icon Overrides for themes
    const MoonIcon = theme ? (theme.isDark ? Moon : Star) : Moon;
    const CloseIcon = theme ? X : X;

    if (!room) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContainer, { backgroundColor: colors.background }, theme && { backgroundColor: theme.backgroundColors[0] }]}>

                    {/* Background Effect for Levin (Space) */}
                    {roomNameLower.includes('levin') && (
                        <View style={StyleSheet.absoluteFill}>
                            <LinearGradient
                                colors={theme!.backgroundColors}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            {/* Stars */}
                            <Star size={10} color="#FFF" style={{ position: 'absolute', top: 60, left: 40, opacity: 0.6 }} />
                            <Star size={6} color="#FFF" style={{ position: 'absolute', top: 150, right: 60, opacity: 0.4 }} />
                            <Star size={8} color="#818CF8" style={{ position: 'absolute', bottom: 100, left: 80, opacity: 0.5 }} />
                            <Rocket size={400} color="rgba(255,255,255,0.03)" style={{ position: 'absolute', bottom: -50, right: -50, transform: [{ rotate: '-15deg' }] }} />
                        </View>
                    )}

                    {/* Background Effect for Lina (Princess) */}
                    {roomNameLower.includes('lina') && (
                        <View style={StyleSheet.absoluteFill}>
                            <LinearGradient
                                colors={theme!.backgroundColors}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <Heart size={16} color="#DB2777" style={{ position: 'absolute', top: 180, right: 50, opacity: 0.2 }} />
                            <Crown size={300} color="rgba(236, 72, 153, 0.05)" style={{ position: 'absolute', top: 100, left: -50, transform: [{ rotate: '15deg' }] }} />
                            <Flower2 size={200} color="rgba(236, 72, 153, 0.05)" style={{ position: 'absolute', bottom: -20, right: -20 }} />
                        </View>
                    )}

                    {/* Header */}
                    {!theme ? (
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
                                {userRole === 'admin' && (
                                    <Pressable onPress={() => setShowContentEdit(true)} style={[styles.closeButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                                        <Edit3 size={22} color="#FFF" />
                                    </Pressable>
                                )}
                                <Pressable onPress={shutdownRoom} style={[styles.closeButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                                    <Moon size={24} color={isRoomQuiet ? "#FDB813" : "#FFF"} fill={isRoomQuiet ? "#FDB813" : "transparent"} />
                                </Pressable>
                                <Pressable onPress={onClose} style={styles.closeButton}>
                                    <X size={24} color="#fff" />
                                </Pressable>
                            </View>
                        </LinearGradient>
                    ) : (
                        // Custom Themed Header
                        <View style={[styles.modalHeader, { backgroundColor: 'transparent' }]}>
                            <View style={styles.modalTitleRow}>
                                {/* Custom Icon Bubble */}
                                <View style={[styles.titleIconBubble, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' }]}>
                                    {roomNameLower.includes('levin') ? <Rocket size={24} color={theme.iconColor} /> :
                                        roomNameLower.includes('lina') ? <Crown size={24} color={theme.iconColor} /> :
                                            <room.icon size={24} color={theme.iconColor} />
                                    }
                                </View>
                                <Text style={[styles.modalTitleText, { color: theme.textColor }]}>{room.name}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                {userRole === 'admin' && (
                                    <Pressable onPress={() => setShowContentEdit(true)} style={[styles.closeButton, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                                        <Edit3 size={22} color={theme.iconColor} />
                                    </Pressable>
                                )}
                                <Pressable onPress={shutdownRoom} style={[styles.closeButton, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                                    <MoonIcon size={24} color={theme.iconColor} />
                                </Pressable>
                                <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                                    <CloseIcon size={24} color={theme.iconColor} />
                                </Pressable>
                            </View>
                        </View>
                    )}

                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                        {/* Sleep Timer Active Banner */}
                        {sleepTimerState.isRunning && (
                            <Pressable
                                onPress={sleepTimerState.stopTimer}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                    marginHorizontal: 16, marginTop: 16, padding: 14, borderRadius: 14,
                                    backgroundColor: '#8B5CF6' + '18', borderWidth: 1, borderColor: '#8B5CF6' + '30',
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Timer size={20} color="#8B5CF6" />
                                    <View>
                                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                                            Sleep Timer — {sleepTimerState.remaining ?? 0} Min
                                        </Text>
                                        <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 1 }}>
                                            von {sleepTimerState.activeDuration} Min · Tippen zum Stoppen
                                        </Text>
                                    </View>
                                </View>
                                <Square size={18} color="#EF4444" />
                            </Pressable>
                        )}
                        {/* Dynamic sections based on group order */}
                        {(displayRoom._groupOrder || ['sensors', 'scripts', 'climates', 'lights', 'helpers', 'covers', 'mediaPlayers', 'cameras']).map((groupId: string) => {
                            // Skip hidden groups
                            if (displayRoom._hiddenGroups?.includes(groupId)) return null;
                            // --- Sensors ---
                            if (groupId === 'sensors' && displayRoom.sensors?.length > 0) {
                                return (
                                    <View key="sensors" style={[styles.section, { marginTop: 16 }]}>
                                        <SectionHeader title={displayRoom._groupLabels?.sensors || "Status"} />
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                                            {displayRoom.sensors.map((s: any) => (
                                                <SensorTile key={s.entity_id} sensor={s} />
                                            ))}
                                        </ScrollView>
                                    </View>
                                );
                            }

                            // --- Scripts / Scenes ---
                            if (groupId === 'scripts' && (displayRoom.scripts?.length > 0 || displayRoom.scenes?.length > 0)) {
                                return (
                                    <View key="scripts" style={styles.section}>
                                        <SectionHeader title={displayRoom._groupLabels?.scripts || "Szenen"} />
                                        <View style={styles.grid}>
                                            {displayRoom.scripts?.map((s: any, idx: number) => {
                                                const totalScenes = (displayRoom.scripts?.length || 0) + (displayRoom.scenes?.length || 0);
                                                const isLastAlone = idx === (displayRoom.scripts?.length || 0) - 1 && (displayRoom.scenes?.length || 0) === 0 && totalScenes % 2 === 1;
                                                return <SceneTile key={s.entity_id} scene={s} activateScene={(id: string) => api.callService('script', 'turn_on', id)} width={isLastAlone ? '100%' : tileWidth} />;
                                            })}
                                            {displayRoom.scenes?.map((s: any, idx: number) => {
                                                const totalScenes = (displayRoom.scripts?.length || 0) + (displayRoom.scenes?.length || 0);
                                                const globalIdx = (displayRoom.scripts?.length || 0) + idx;
                                                const isLastAlone = globalIdx === totalScenes - 1 && totalScenes % 2 === 1;
                                                return <SceneTile key={s.entity_id} scene={s} activateScene={(id: string) => api.activateScene(id)} width={isLastAlone ? '100%' : tileWidth} />;
                                            })}
                                        </View>
                                    </View>
                                );
                            }

                            // --- Climates ---
                            if (groupId === 'climates' && displayRoom.climates?.length > 0) {
                                return (
                                    <View key="climates" style={styles.section}>
                                        <SectionHeader title={displayRoom._groupLabels?.climates || "Klima"} />
                                        <View style={styles.grid}>
                                            {displayRoom.climates.map((c: any) => (
                                                <ClimateTile key={c.entity_id} climate={c} setTemp={api.setClimateTemperature} width={isTablet ? tileWidth : '100%'} theme={theme} />
                                            ))}
                                        </View>
                                    </View>
                                );
                            }

                            // --- Lights ---
                            if (groupId === 'lights' && displayRoom.lights?.length > 0) {
                                return (
                                    <View key="lights" style={styles.section}>
                                        <SectionHeader title={displayRoom._groupLabels?.lights || "Beleuchtung"} />
                                        <View style={styles.grid}>
                                            {displayRoom.lights.map((l: any, idx: number) => {
                                                const isLastAlone = idx === displayRoom.lights.length - 1 && displayRoom.lights.length % 2 === 1;
                                                return <LightTile key={l.entity_id} light={l} toggleLight={api.toggleLight} setBrightness={api.setLightBrightness} width={l.fullWidth || isLastAlone ? '100%' : tileWidth} onLongPress={setSelectedLight} theme={theme} />;
                                            })}
                                        </View>
                                    </View>
                                );
                            }

                            // --- Helpers ---
                            if (groupId === 'helpers' && displayRoom.helpers?.length > 0) {
                                return (
                                    <View key="helpers" style={styles.section}>
                                        <SectionHeader title={displayRoom._groupLabels?.helpers || "Einstellungen"} />
                                        <View style={styles.grid}>
                                            {displayRoom.helpers.map((h: any) => (
                                                <HelperTile key={h.entity_id} entity={h} api={api} width={isTablet ? tileWidth : '100%'} theme={theme} />
                                            ))}
                                        </View>
                                    </View>
                                );
                            }

                            // --- Covers ---
                            if (groupId === 'covers' && displayRoom.covers?.length > 0) {
                                return (
                                    <View key="covers" style={styles.section}>
                                        <SectionHeader title={displayRoom._groupLabels?.covers || "Rollläden"} />
                                        <View style={styles.grid}>
                                            {displayRoom.covers.map((c: any, idx: number) => {
                                                const isLastAlone = idx === displayRoom.covers.length - 1 && displayRoom.covers.length % 2 === 1;
                                                return <CoverTile key={c.entity_id} cover={c} openCover={api.openCover} closeCover={api.closeCover} stopCover={api.stopCover} pressButton={api.pressButton} onPress={onSelectCover} width={isLastAlone ? '100%' : tileWidth} theme={theme} />;
                                            })}
                                        </View>
                                    </View>
                                );
                            }

                            // --- Media Players ---
                            if (groupId === 'mediaPlayers' && displayRoom.mediaPlayers?.length > 0) {
                                return (
                                    <View key="mediaPlayers" style={styles.section}>
                                        <SectionHeader title={displayRoom._groupLabels?.mediaPlayers || "Medien"} />
                                        <View style={styles.grid}>
                                            {displayRoom.mediaPlayers.map((m: any) => (
                                                <MediaTile key={m.entity_id} player={m} api={api} width={isTablet ? tileWidth : '100%'} theme={theme} />
                                            ))}
                                        </View>
                                    </View>
                                );
                            }

                            // --- Cameras ---
                            if (groupId === 'cameras' && displayRoom.cameras?.length > 0) {
                                return (
                                    <View key="cameras" style={styles.section}>
                                        <SectionHeader title={displayRoom._groupLabels?.cameras || "Kameras"} />
                                        <View style={styles.grid}>
                                            {displayRoom.cameras.map((c: any) => (
                                                <CameraTile key={c.entity_id} camera={c} width="100%" />
                                            ))}
                                        </View>
                                    </View>
                                );
                            }

                            // --- Switches ---
                            if (groupId === 'switches' && displayRoom.switches?.length > 0) {
                                return (
                                    <View key="switches" style={styles.section}>
                                        <SectionHeader title={displayRoom._groupLabels?.switches || "Schalter"} />
                                        <View style={styles.grid}>
                                            {displayRoom.switches.map((sw: any, idx: number) => {
                                                const isOn = sw.state === 'on';
                                                const isLastAlone = idx === displayRoom.switches.length - 1 && displayRoom.switches.length % 2 === 1;
                                                const swWidth = isLastAlone ? '100%' : tileWidth;
                                                return (
                                                    <View key={sw.entity_id} style={[styles.tile, { width: swWidth, backgroundColor: colors.card, borderColor: colors.border }]}>
                                                        <Pressable
                                                            onPress={() => api.callService('switch', isOn ? 'turn_off' : 'turn_on', sw.entity_id)}
                                                            style={[styles.tileContent, isOn && { backgroundColor: colors.accent + '20' }]}
                                                        >
                                                            <View style={styles.tileHeader}>
                                                                <View style={[styles.tileIcon, { backgroundColor: isOn ? colors.accent : colors.background }]}>
                                                                    <Power size={18} color={isOn ? '#FFF' : colors.subtext} />
                                                                </View>
                                                            </View>
                                                            <Text style={[styles.tileName, { color: colors.text }]} numberOfLines={1}>
                                                                {sw.attributes?.friendly_name || sw.entity_id}
                                                            </Text>
                                                            <Text style={[styles.tileState, { color: colors.subtext }]}>
                                                                {isOn ? 'An' : 'Aus'}
                                                            </Text>
                                                        </Pressable>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                            }

                            // --- Custom Groups: render entities with correct tile type ---
                            const customGroup = displayRoom._customGroups?.find((cg: any) => cg.id === groupId);
                            if (customGroup && customGroup.entities?.length > 0) {
                                const displayTypes = displayRoom._entityDisplayTypes || {};
                                const cgCount = customGroup.entities.length;
                                return (
                                    <View key={customGroup.id} style={styles.section}>
                                        <SectionHeader title={customGroup.label} />
                                        <View style={styles.grid}>
                                            {customGroup.entities.map((e: any, idx: number) => {
                                                const isLastAlone = idx === cgCount - 1 && cgCount % 2 === 1;
                                                const cgWidth = isLastAlone ? '100%' : tileWidth;
                                                const eid = e.entity_id;
                                                // Use manual override first, then infer from entity_id
                                                let dtype = displayTypes[eid] || '';
                                                if (!dtype) {
                                                    if (eid.startsWith('light.')) dtype = 'light';
                                                    else if (eid.startsWith('cover.')) dtype = 'cover';
                                                    else if (eid.startsWith('script.') || eid.startsWith('scene.')) dtype = 'scene';
                                                    else if (eid.startsWith('media_player.')) dtype = 'mediaPlayer';
                                                    else if (eid.startsWith('climate.')) dtype = 'climate';
                                                    else if (eid.startsWith('switch.')) dtype = 'switch';
                                                    else if (eid.startsWith('sensor.') || eid.startsWith('binary_sensor.')) dtype = 'sensor';
                                                    else if (eid.startsWith('camera.')) dtype = 'camera';
                                                    else if (eid.startsWith('input_select.') || eid.startsWith('input_boolean.') || eid.startsWith('input_number.')) dtype = 'helper';
                                                    else dtype = 'generic';
                                                }

                                                if (dtype === 'light') {
                                                    return <LightTile key={eid} light={e} toggleLight={api.toggleLight} setBrightness={api.setLightBrightness} width={cgWidth} onLongPress={setSelectedLight} theme={theme} />;
                                                }
                                                if (dtype === 'cover') {
                                                    return <CoverTile key={eid} cover={e} openCover={api.openCover} closeCover={api.closeCover} stopCover={api.stopCover} pressButton={api.pressButton} onPress={onSelectCover} width={cgWidth} theme={theme} />;
                                                }
                                                if (dtype === 'scene') {
                                                    const isScript = eid.startsWith('script.');
                                                    return <SceneTile key={eid} scene={e} activateScene={(id: string) => isScript ? api.callService('script', 'turn_on', id) : api.activateScene(id)} width={cgWidth} />;
                                                }
                                                if (dtype === 'mediaPlayer') {
                                                    return <MediaTile key={eid} player={e} api={api} width={isTablet ? tileWidth : '100%'} theme={theme} />;
                                                }
                                                if (dtype === 'climate') {
                                                    return <ClimateTile key={eid} climate={e} setTemp={api.setClimateTemperature} width={isTablet ? tileWidth : '100%'} theme={theme} />;
                                                }
                                                if (dtype === 'switch') {
                                                    const isOn = e.state === 'on';
                                                    // Use the actual entity domain for service calls, not the display type
                                                    const domain = eid.split('.')[0];
                                                    return (
                                                        <View key={eid} style={[styles.tile, { width: cgWidth, backgroundColor: colors.card, borderColor: colors.border }]}>
                                                            <Pressable
                                                                onPress={() => api.callService(domain, isOn ? 'turn_off' : 'turn_on', eid)}
                                                                style={[styles.tileContent, isOn && { backgroundColor: colors.accent + '20' }]}
                                                            >
                                                                <View style={styles.tileHeader}>
                                                                    <View style={[styles.tileIcon, { backgroundColor: isOn ? colors.accent : colors.background }]}>
                                                                        <Power size={18} color={isOn ? '#FFF' : colors.subtext} />
                                                                    </View>
                                                                </View>
                                                                <Text style={[styles.tileName, { color: colors.text }]} numberOfLines={1}>
                                                                    {e.attributes?.friendly_name || eid}
                                                                </Text>
                                                                <Text style={[styles.tileState, { color: colors.subtext }]}>
                                                                    {isOn ? 'An' : 'Aus'}
                                                                </Text>
                                                            </Pressable>
                                                        </View>
                                                    );
                                                }
                                                if (dtype === 'sensor') {
                                                    return <SensorTile key={eid} sensor={e} />;
                                                }
                                                if (dtype === 'camera') {
                                                    return <CameraTile key={eid} camera={e} width="100%" />;
                                                }
                                                if (dtype === 'helper') {
                                                    return <HelperTile key={eid} entity={e} api={api} width={cgWidth} theme={theme} />;
                                                }
                                                // Fallback: generic tile
                                                return (
                                                    <View key={eid} style={{ width: cgWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 }}>
                                                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                                                            {e.attributes?.friendly_name || eid}
                                                        </Text>
                                                        <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                                                            {e.state}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                            }

                            return null;
                        })}

                        {/* LightControlModal (rendered outside the loop) */}
                        <LightControlModal
                            visible={!!selectedLight}
                            light={selectedLight}
                            onClose={() => setSelectedLight(null)}
                            callService={api.callService}
                        />

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View >
            </View >

            {/* Room Content Edit Modal (Admin only) */}
            <RoomContentEditModal
                visible={showContentEdit}
                onClose={() => setShowContentEdit(false)}
                room={room}
                colors={colors}
                allEntities={allEntities || []}
                onOverrideChanged={() => setOverrideVersion(v => v + 1)}
            />
        </Modal >
    );
});

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function Rooms() {
    const { width } = useWindowDimensions();
    const { colors } = useTheme();
    const { userRole } = useAuth();
    const isTablet = width >= 768;

    const {
        entities,
        isConnected,
        isConnecting,
        hasEverConnected,
        toggleLight,
        setLightBrightness,
        openCover,
        closeCover,
        setCoverPosition,
        setCoverTiltPosition,
        stopCover,
        pressButton,
        callService,
        setClimateTemperature, // Assuming availability
        activateScene,
        connect
    } = useHomeAssistant();

    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [selectedCoverForModal, setSelectedCoverForModal] = useState<EntityState | null>(null);

    // Dynamic Rooms State
    const [customRooms, setCustomRooms] = useState<any[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingRoom, setEditingRoom] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Initial Load of Custom Rooms
    useEffect(() => {
        loadCustomRooms();
    }, []);

    const loadCustomRooms = async () => {
        try {
            const stored = await AsyncStorage.getItem('@smarthome_custom_rooms');
            if (stored) {
                setCustomRooms(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load custom rooms', e);
        }
    };

    const saveCustomRooms = async (rooms: any[]) => {
        try {
            await AsyncStorage.setItem('@smarthome_custom_rooms', JSON.stringify(rooms));
            setCustomRooms(rooms);
        } catch (e) {
            console.error('Failed to save custom rooms', e);
        }
    };

    const handleSaveRoom = (room: any) => {
        let newRooms;
        if (customRooms.find((r: any) => r.id === room.id)) {
            // Edit
            newRooms = customRooms.map((r: any) => r.id === room.id ? room : r);
        } else {
            // Create
            newRooms = [...customRooms, room];
        }
        saveCustomRooms(newRooms);
    };

    const handleDeleteRoom = (roomId: string) => {
        Alert.alert(
            "Raum löschen",
            "Möchtest du diesen Raum wirklich löschen?",
            [
                { text: "Abbrechen", style: "cancel" },
                {
                    text: "Löschen",
                    style: "destructive",
                    onPress: () => {
                        const newRooms = customRooms.filter((r: any) => r.id !== roomId);
                        saveCustomRooms(newRooms);
                        setShowEditModal(false);
                    }
                }
            ]
        );
    };

    // Allowed Rooms Configuration
    // Categories Configuration
    const ROOM_CATEGORIES = [
        {
            title: 'Innenbereich',
            data: ['Wohnzimmer', 'Essbereich', 'Küche', 'Schlafzimmer', 'Levin', 'Lina', 'Büro', 'Bad', 'Gäste WC', 'Reduit']
        },
        {
            title: 'Aussenbereich',
            data: ['Terrasse', 'Grillplatz', 'Balkon']
        },
        {
            title: 'UG',
            data: ['Waschküche', 'Highlight']
        }
    ];

    const ALLOWED_ROOMS = ROOM_CATEGORIES.flatMap(c => c.data);

    // Prepare rooms data
    const rooms = useMemo(() => {
        // Initialize with allowed rooms to preserve order
        const areaMap = new Map<string, any>();
        ALLOWED_ROOMS.forEach(room => {
            areaMap.set(room, { lights: [], covers: [], sensors: [], climates: [], mediaPlayers: [], scripts: [], scenes: [], cameras: [], helpers: [], switches: [] });
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
            if (name.includes('levin')) return 'Levin';
            if (name.includes('lina')) return 'Lina';
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
            // else if (entity.entity_id.startsWith('camera.')) room.cameras.push(entity);
            else if (entity.entity_id.startsWith('input_select.')) room.helpers.push(entity);
            else if (entity.entity_id.startsWith('input_boolean.')) room.helpers.push(entity);
            else if (entity.entity_id.startsWith('switch.')) room.switches.push(entity);
        });

        // CUSTOMIZATION: Wohnzimmer strict filtering
        const wohnzimmer = areaMap.get('Wohnzimmer');
        if (wohnzimmer) {
            wohnzimmer.lights = wohnzimmer.lights.filter((l: any) =>
                l.entity_id === 'light.wohnzimmer' ||
                l.entity_id === 'light.hue_play_gradient_lightstrip_1'
            ).map((l: any) => {
                if (l.entity_id === 'light.wohnzimmer') return { ...l, attributes: { ...l.attributes, friendly_name: 'Deckenbeleuchtung' } };
                if (l.entity_id === 'light.hue_play_gradient_lightstrip_1') return { ...l, attributes: { ...l.attributes, friendly_name: 'TV Ambilight' } };
                return l;
            });
            wohnzimmer.covers = wohnzimmer.covers.filter((c: any) =>
                c.entity_id === 'cover.wohnzimmer_sofa' ||
                c.entity_id === 'cover.wohnzimmer_spielplaetzchen'
            ).map((c: any) => {
                if (c.entity_id === 'cover.wohnzimmer_sofa') return { ...c, attributes: { ...c.attributes, friendly_name: 'Sofa' } };
                if (c.entity_id === 'cover.wohnzimmer_spielplaetzchen') return { ...c, attributes: { ...c.attributes, friendly_name: 'Spielplätzchen' } };
                return c;
            });

            // Add specific scripts to Wohnzimmer if they exist in entities
            const movieScript = entities.find(e => e.entity_id === 'script.movie_night');
            const sexScript = entities.find(e => e.entity_id === 'script.sex_wohnzimmer');

            wohnzimmer.scripts = []; // Reset and add specific
            if (movieScript) wohnzimmer.scripts.push(movieScript);
            if (sexScript) wohnzimmer.scripts.push({ ...sexScript, attributes: { ...sexScript.attributes, friendly_name: 'Romantic' } });

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
            essbereich.lights = essbereich.lights
                .filter((l: any) => l.entity_id === 'light.essbereich')
                .map((l: any) => ({ ...l, attributes: { ...l.attributes, friendly_name: 'Deckenbeleuchtung' } }));

            // Covers
            essbereich.covers = essbereich.covers
                .filter((c: any) => c.entity_id === 'cover.essbereich')
                .map((c: any) => ({ ...c, attributes: { ...c.attributes, friendly_name: 'Store' } }));

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
            kueche.lights = kueche.lights
                .filter((l: any) => l.entity_id === 'light.kuche')
                .map((l: any) => ({ ...l, attributes: { ...l.attributes, friendly_name: 'Deckenbeleuchtung' } }));

            // Covers
            kueche.covers = kueche.covers
                .filter((c: any) => c.entity_id === 'cover.kuche')
                .map((c: any) => ({ ...c, attributes: { ...c.attributes, friendly_name: 'Küchenfenster' } }));

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
            schlafzimmer.lights = schlafzimmer.lights
                .filter((l: any) => l.entity_id === 'light.hue_ambiance_ceiling_1')
                .map((l: any) => ({ ...l, attributes: { ...l.attributes, friendly_name: 'Deckenbeleuchtung' } }));

            // Scripts
            const bedTime = entities.find(e => e.entity_id === 'script.bed_time');
            const sexScript = entities.find(e => e.entity_id === 'script.sex_schlafzimmer');

            schlafzimmer.scripts = [];
            if (bedTime) schlafzimmer.scripts.push(bedTime);
            if (sexScript) schlafzimmer.scripts.push({ ...sexScript, attributes: { ...sexScript.attributes, friendly_name: 'Romantic' } });

            // Media
            schlafzimmer.mediaPlayers = schlafzimmer.mediaPlayers.filter((m: any) =>
                m.entity_id === 'media_player.shield_schlafzimmer' ||
                m.entity_id === 'media_player.nest_schlafzimmer_2'
            );

            // Helpers
            schlafzimmer.helpers = schlafzimmer.helpers.filter((h: any) =>
                h.entity_id === 'input_select.timer_tv_schlafzimmer'
            );

            // Clear others
            schlafzimmer.covers = [];
            schlafzimmer.sensors = [];
            schlafzimmer.climates = [];
            schlafzimmer.scenes = [];
            schlafzimmer.scenes = [];
        }

        // CUSTOMIZATION: Levin strict filtering & Child Theme
        const levin = areaMap.get('Levin');
        if (levin) {
            // Helper to rename
            const rename = (e: any, newName: string) => ({ ...e, attributes: { ...e.attributes, friendly_name: newName } });

            // Lights
            const lLev = entities.find(e => e.entity_id === 'light.levins_zimmer');
            const lWardrobe = entities.find(e => e.entity_id === 'light.hue_play_1_2');
            const lGalaxy = entities.find(e => e.entity_id === 'light.galaxie_kinderzimmer');

            levin.lights = [];
            if (lLev) levin.lights.push({ ...rename(lLev, 'Deckenbeleuchtung'), fullWidth: true, order: 0 });
            if (lWardrobe) levin.lights.push({ ...rename(lWardrobe, 'Kleiderschrank'), order: 1 });
            if (lGalaxy) levin.lights.push({ ...rename(lGalaxy, 'Galaxy'), order: 2 });

            // Scenes/Scripts
            const sFocus = entities.find(e => e.entity_id === 'scene.levins_zimmer_konzentrieren');
            const sBed = entities.find(e => e.entity_id === 'script.bed_time_levin');
            const sWake = entities.find(e => e.entity_id === 'scene.levins_zimmer_herbsternte');
            const sParty = entities.find(e => e.entity_id === 'script.levin_party');
            const sPlay = entities.find(e => e.entity_id === 'scene.levins_zimmer_spielen'); // Guessing ID

            levin.scripts = [];
            levin.scenes = [];

            // We combine them into 'scripts' or 'scenes' bucket for display, or distribute them
            // The UI combines them. Let's push all to scripts/scenes.
            if (sFocus) levin.scenes.push(sFocus);
            if (sWake) levin.scenes.push(rename(sWake, 'Aufwachen'));
            if (sPlay) levin.scenes.push(rename(sPlay, 'Spielen'));

            if (sBed) levin.scripts.push(rename(sBed, 'Bed-Time'));
            if (sParty) levin.scripts.push(rename(sParty, 'Party'));

            // Media
            levin.mediaPlayers = levin.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.hub_levin');

            // Theme Override
            levin.gradient = ['#4F46E5', '#818CF8']; // Starry Blue/Indigo

            // Clear others
            levin.covers = [];
            levin.sensors = [];
            levin.climates = [];
        }

        // CUSTOMIZATION: Lina strict filtering & Girl Theme
        const lina = areaMap.get('Lina');
        if (lina) {
            // Lights
            const lDecke = entities.find(e => e.entity_id === 'light.licht_lina_decke');
            const lWickel = entities.find(e => e.entity_id === 'light.hue_play_wickeltisch');
            const lWickelAlt = entities.find(e => e.entity_id === 'light.wickeltisch');

            lina.lights = [];
            if (lDecke) lina.lights.push({ ...lDecke, attributes: { ...lDecke.attributes, friendly_name: 'Deckenbeleuchtung' } });
            if (lWickel) lina.lights.push({ ...lWickel, attributes: { ...lWickel.attributes, friendly_name: 'Wickeltisch' } });
            if (lWickelAlt) lina.lights.push({ ...lWickelAlt, attributes: { ...lWickelAlt.attributes, friendly_name: 'Wickeltisch (Alt)' } });


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

            // Add Scenes
            const sNachtlicht = entities.find(e => e.entity_id === 'script.nachtlicht_lina');
            if (sNachtlicht) lina.scripts.push({ ...sNachtlicht, attributes: { ...sNachtlicht.attributes, friendly_name: 'Nachtlicht' } });
        }

        // CUSTOMIZATION: Büro strict filtering
        const buro = areaMap.get('Büro');
        if (buro) {
            // Scenes & Scripts
            const sMusic = entities.find(e => e.entity_id === 'script.arbeiten_mit_musik');
            const sFocus = entities.find(e => e.entity_id === 'scene.buro_konzentration');
            const sPhantom = entities.find(e => e.entity_id === 'scene.buro_phantom');
            const sCinema = entities.find(e => e.entity_id === 'script.kino_buro');

            buro.scripts = [];
            buro.scenes = [];

            // We combine them for display
            if (sMusic) buro.scripts.push(sMusic);
            if (sCinema) buro.scripts.push(sCinema);

            if (sFocus) buro.scenes.push(sFocus);
            if (sPhantom) buro.scenes.push(sPhantom);

            // Lights
            buro.lights = buro.lights.filter((l: any) =>
                l.entity_id === 'light.deckenbeleuchtung_buro' ||
                l.entity_id === 'light.ambilight_kallax' ||
                l.entity_id === 'light.ambiente_buro'
            );

            // Renaming
            buro.lights = buro.lights.map((l: any) => {
                if (l.entity_id === 'light.ambiente_buro') return { ...l, attributes: { ...l.attributes, friendly_name: 'Ambilight' } };
                if (l.entity_id === 'light.deckenbeleuchtung_buro') return { ...l, attributes: { ...l.attributes, friendly_name: 'Deckenbeleuchtung' } };
                return l;
            });

            // Media
            buro.mediaPlayers = buro.mediaPlayers.filter((m: any) =>
                m.entity_id === 'media_player.nest_garage_2' ||
                m.entity_id === 'media_player.xgimi_halo_3'
            );

            // Gradient
            buro.gradient = ['#3B82F6', '#2563EB']; // Blue

            // Clear others
            buro.covers = [];
            buro.sensors = [];
            buro.climates = [];
        }

        // CUSTOMIZATION: Bad strict filtering
        const bad = areaMap.get('Bad');
        if (bad) {
            // Lights
            // Explicitly find light.badezimmer as it might not be in the area list
            const lBad = entities.find(e => e.entity_id === 'light.badezimmer');
            bad.lights = lBad
                ? [{ ...lBad, attributes: { ...lBad.attributes, friendly_name: 'Spiegelschrank' } }]
                : [];

            // Media
            bad.mediaPlayers = bad.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.badezimmer_2');

            // Clear others
            bad.covers = [];
            bad.sensors = [];
            bad.climates = [];
            bad.scripts = [];
            bad.scenes = [];
        }

        // CUSTOMIZATION: Gäste WC strict filtering
        const guestWc = areaMap.get('Gäste WC');
        if (guestWc) {
            // Lights
            // Fix entity ID (was pointing to garage) and rename
            guestWc.lights = guestWc.lights
                .filter((l: any) => l.entity_id === 'light.gaste_wc' || l.entity_id === 'light.licht_gaste_wc')
                .map((l: any) => ({ ...l, attributes: { ...l.attributes, friendly_name: 'Spiegelschrank' } }));

            // Media
            guestWc.mediaPlayers = guestWc.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.gaste_wc_2');

            // Clear others
            guestWc.covers = [];
            guestWc.sensors = [];
            guestWc.climates = [];
            guestWc.scripts = [];
            guestWc.scenes = [];
        }


        // CUSTOMIZATION: Terrasse strict filtering
        const terrasse = areaMap.get('Terrasse');
        if (terrasse) {
            // Sensors (Manual add)
            const sTemp = entities.find(e => e.entity_id === 'sensor.wetterstation_actual_temperature');
            const sHum = entities.find(e => e.entity_id === 'sensor.wetterstation_humidity');
            const sWind = entities.find(e => e.entity_id === 'sensor.wetterstation_wind_speed');
            const sRain = entities.find(e => e.entity_id === 'binary_sensor.wetterstation_raining');
            const sDoor = entities.find(e => e.entity_id === 'binary_sensor.terrassenture_tur');

            terrasse.sensors = [];
            if (sDoor) terrasse.sensors.push(sDoor); // Door sensor first for prominence
            if (sTemp) terrasse.sensors.push(sTemp);
            if (sHum) terrasse.sensors.push(sHum);
            if (sWind) terrasse.sensors.push(sWind);
            if (sRain) terrasse.sensors.push(sRain);

            // Light
            terrasse.lights = terrasse.lights.filter((l: any) => l.entity_id === 'light.terrasse');

            // Media
            terrasse.mediaPlayers = terrasse.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.lounge_2');

            // Cover
            terrasse.covers = terrasse.covers.filter((c: any) => c.entity_id === 'cover.terrasse');

            // Scenes & Scripts (Same as Büro)
            const sMusic = entities.find(e => e.entity_id === 'script.arbeiten_mit_musik');
            const sFocus = entities.find(e => e.entity_id === 'scene.buro_konzentration');
            const sPhantom = entities.find(e => e.entity_id === 'scene.buro_phantom');
            const sCinema = entities.find(e => e.entity_id === 'script.kino_buro');

            terrasse.scripts = [];
            terrasse.scenes = [];
            if (sMusic) terrasse.scripts.push(sMusic);
            if (sCinema) terrasse.scripts.push(sCinema);
            if (sFocus) terrasse.scenes.push(sFocus);
            if (sPhantom) terrasse.scenes.push(sPhantom);

            // Clear others
            terrasse.climates = [];
        }

        // CUSTOMIZATION: Grillplatz strict filtering
        const grill = areaMap.get('Grillplatz');
        if (grill) {
            // Camera
            // const cam = entities.find(e => e.entity_id === 'camera.kamera_grillplatz_high_resolution_channel');
            grill.cameras = [];
            // if (cam) grill.cameras.push(cam);

            // Clear others
            grill.lights = [];
            grill.covers = [];
            grill.sensors = [];
            grill.climates = [];
            grill.mediaPlayers = [];
            grill.scripts = [];
            grill.scenes = [];
        }

        // CUSTOMIZATION: Balkon strict filtering
        const balkon = areaMap.get('Balkon');
        if (balkon) {
            // Sensors
            const sDoor = entities.find(e => e.entity_id === 'binary_sensor.balkonture');
            balkon.sensors = [];
            if (sDoor) balkon.sensors.push(sDoor);

            // Camera
            // const cam = entities.find(e => e.entity_id === 'camera.kamera_balkon_high_resolution_channel');
            balkon.cameras = [];
            // if (cam) balkon.cameras.push(cam);

            // Clear others
            balkon.lights = [];
            balkon.covers = [];
            balkon.climates = [];
            balkon.mediaPlayers = [];
            balkon.scripts = [];
            balkon.scenes = [];
        }

        // CUSTOMIZATION: Reduit strict filtering
        const reduit = areaMap.get('Reduit');
        if (reduit) {
            // Light
            reduit.lights = reduit.lights
                .filter((l: any) => l.entity_id === 'light.reduit')
                .map((l: any) => ({ ...l, attributes: { ...l.attributes, friendly_name: 'Deckenbeleuchtung' } }));

            // Clear others
            reduit.covers = [];
            reduit.sensors = [];
            reduit.climates = [];
            reduit.mediaPlayers = [];
            reduit.scripts = [];
            reduit.scenes = [];
            reduit.cameras = [];
        }

        // CUSTOMIZATION: Waschküche strict filtering
        const wasch = areaMap.get('Waschküche');
        if (wasch) {
            // Sensors
            const sDoor = entities.find(e => e.entity_id === 'binary_sensor.waschkuchenture');
            // const sMotion = entities.find(e => e.entity_id === 'binary_sensor.kamera_waschkuche_motion');
            wasch.sensors = [];
            if (sDoor) wasch.sensors.push(sDoor);
            // if (sMotion) wasch.sensors.push(sMotion);

            // Media
            wasch.mediaPlayers = wasch.mediaPlayers.filter((m: any) => m.entity_id === 'media_player.nesthub5b73_2');

            // Camera
            // const cam = entities.find(e => e.entity_id === 'camera.kamera_waschkuche_high_resolution_channel');
            wasch.cameras = [];
            // if (cam) wasch.cameras.push(cam);

            // Clear others
            wasch.lights = [];
            wasch.covers = [];
            wasch.climates = [];
            wasch.scripts = [];
            wasch.scenes = [];
        }

        // CUSTOMIZATION: Highlight strict filtering
        const highlight = areaMap.get('Highlight');
        if (highlight) {
            // Sensors
            const sDoor = entities.find(e => e.entity_id === 'binary_sensor.highlighttur');
            highlight.sensors = [];
            if (sDoor) highlight.sensors.push(sDoor);

            // Camera
            // const cam = entities.find(e => e.entity_id === 'camera.kamera_balkon_high_resolution_channel_2');
            highlight.cameras = [];
            // if (cam) highlight.cameras.push(cam);

            // Clear others
            highlight.lights = [];
            highlight.covers = [];
            highlight.climates = [];
            highlight.mediaPlayers = [];
            highlight.scripts = [];
            highlight.scenes = [];
        }

        // Return only rooms that have at least one device, in the order of ALLOWED_ROOMS
        // Sort lights and covers alphabetically by friendly_name
        // Sort lights and covers alphabetically by friendly_name, or by 'order' prop if exists
        const sortByName = (a: any, b: any) => {
            const orderA = a.order ?? 999;
            const orderB = b.order ?? 999;
            if (orderA !== orderB) return orderA - orderB;

            const nameA = (a.attributes.friendly_name || '').toLowerCase();
            const nameB = (b.attributes.friendly_name || '').toLowerCase();
            return nameA.localeCompare(nameB, 'de');
        };

        const systemRooms = ALLOWED_ROOMS
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
                room.mediaPlayers.length > 0 ||
                room.sensors.length > 0 ||
                room.cameras.length > 0
            )
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));

        // Process Custom Rooms
        const userRooms = customRooms.map(cr => {
            // Map Entities
            const lights = entities.filter(e => cr.entities.includes(e.entity_id) && e.entity_id.startsWith('light.'));
            const covers = entities.filter(e => cr.entities.includes(e.entity_id) && e.entity_id.startsWith('cover.'));
            const climates = entities.filter(e => cr.entities.includes(e.entity_id) && e.entity_id.startsWith('climate.'));
            const sensors = entities.filter(e => cr.entities.includes(e.entity_id) && (e.entity_id.startsWith('sensor.') || e.entity_id.startsWith('binary_sensor.')));
            const mediaPlayers = entities.filter(e => cr.entities.includes(e.entity_id) && e.entity_id.startsWith('media_player.'));
            const scripts = entities.filter(e => cr.entities.includes(e.entity_id) && e.entity_id.startsWith('script.'));
            const scenes = entities.filter(e => cr.entities.includes(e.entity_id) && e.entity_id.startsWith('scene.'));
            const cameras = entities.filter(e => cr.entities.includes(e.entity_id) && e.entity_id.startsWith('camera.'));

            return {
                ...cr,
                lights,
                covers,
                climates,
                sensors,
                mediaPlayers,
                scripts,
                scenes,
                cameras,
                gradient: ['#6366F1', '#4F46E5'], // Default Indigo
                icon: getRoomIcon(cr.iconName || 'Home'), // TODO: Dynamic Icon
                isCustom: true
            };
        });

        return [...systemRooms, ...userRooms];
    }, [entities, customRooms]);

    // API object stable reference for modal
    const api = useMemo(() => ({
        toggleLight,
        setLightBrightness,
        openCover,
        closeCover,
        setCoverPosition,
        setCoverTiltPosition,
        pressButton,
        setClimateTemperature,
        callService,
        activateScene,
        stopCover
    }), [toggleLight, setLightBrightness, openCover, closeCover, setCoverPosition, setCoverTiltPosition, stopCover, pressButton, setClimateTemperature, callService, activateScene]);

    const activeRoomData = useMemo(() => rooms.find(r => r.name === selectedRoom), [rooms, selectedRoom]);

    // Sleep Timer Logic — shared with homescreen via useSleepTimer hook
    const sharedSleepTimer = useSleepTimer();

    const sleepTimerState = useMemo(() => ({
        activeDuration: sharedSleepTimer.activeDuration,
        remaining: sharedSleepTimer.remaining,
        isRunning: sharedSleepTimer.isRunning,
        startTimer: sharedSleepTimer.startTimer,
        stopTimer: sharedSleepTimer.stopTimer,
    }), [sharedSleepTimer]);

    const closeModal = useCallback(() => setSelectedRoom(null), []);

    if (!isConnected && !isConnecting && !hasEverConnected) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
                    <WifiOff size={48} color={colors.subtext} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Nicht verbunden</Text>
                    <Pressable onPress={() => connect()} style={[styles.connectBtn, { backgroundColor: colors.accent }]}>
                        <Text style={styles.connectBtnText}>Verbinden</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Background Image Layer */}
            {colors.backgroundImage && (
                <View style={StyleSheet.absoluteFill}>
                    <Image
                        source={colors.backgroundImage}
                        style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: 1 }}
                        blurRadius={0}
                    />
                </View>
            )}
            <ScrollView
                style={[styles.scrollView, { backgroundColor: 'transparent' }]}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? 24 : 16 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View>
                        <Text style={[styles.title, { color: colors.text }]}>Räume</Text>
                        <Text style={[styles.subtitle, { color: colors.subtext }]}>
                            {rooms.length} Bereiche • {rooms.reduce((acc, r) => acc + r.lights.length, 0)} Lichter
                        </Text>
                    </View>
                    {userRole === 'admin' && (
                        <Pressable
                            onPress={() => {
                                setEditingRoom(null);
                                setShowEditModal(true);
                            }}
                            style={({ pressed }) => ({
                                backgroundColor: colors.card,
                                padding: 10,
                                borderRadius: 12,
                                opacity: pressed ? 0.7 : 1
                            })}
                        >
                            {/* Using Plus icon from Lucide directly */}
                            <Text style={{ fontSize: 24, color: colors.accent, lineHeight: 28 }}>+</Text>
                        </Pressable>
                    )}
                </View>

                {/* Categorized Grids */}
                {ROOM_CATEGORIES.map((category) => {
                    const categoryRooms = rooms.filter(r => category.data.includes(r.name));
                    if (categoryRooms.length === 0) return null;

                    return (
                        <View key={category.title} style={{ marginBottom: 24 }}>
                            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.subtext, marginBottom: 12, marginLeft: 4 }}>
                                {category.title}
                            </Text>
                            <View style={styles.roomsGrid}>
                                {categoryRooms.map((room) => {
                                    const Icon = room.icon;
                                    const lightsOn = room.lights.filter((l: any) => l.state === 'on').length;
                                    const hasActive = lightsOn > 0 || room.mediaPlayers.some((m: any) => m.state === 'playing');

                                    // Check if room has door sensor and is one of the special rooms
                                    const doorRooms = ['Highlight', 'Waschküche', 'Terrasse', 'Balkon'];
                                    const isDoorRoom = doorRooms.includes(room.name);
                                    const doorSensor = room.sensors?.find((s: any) =>
                                        s.entity_id.includes('tur') || s.entity_id.includes('door') ||
                                        s.attributes?.device_class === 'door'
                                    );

                                    // For door rooms, show door status; otherwise show temperature
                                    let secondaryInfo = null;
                                    let secondaryLabel = '';
                                    if (isDoorRoom && doorSensor) {
                                        secondaryLabel = doorSensor.state === 'on' ? 'geöffnet' : 'geschlossen';
                                        secondaryInfo = secondaryLabel;
                                    } else {
                                        const temp = room.climates[0]?.attributes.current_temperature ||
                                            (room.sensors[0]?.attributes?.unit_of_measurement === '°C' ? room.sensors[0]?.state : null);
                                        if (temp) secondaryInfo = `${temp}°`;
                                    }

                                    const isMediaPlaying = room.mediaPlayers.some((m: any) => m.state === 'playing');

                                    return (
                                        <Pressable
                                            key={room.name}
                                            onPress={() => {
                                                if (isEditMode && room.isCustom) {
                                                    setEditingRoom(room);
                                                    setShowEditModal(true);
                                                } else {
                                                    setSelectedRoom(room.name);
                                                }
                                            }}
                                            onLongPress={() => {
                                                if (room.isCustom) {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                                    setIsEditMode(true);
                                                    setEditingRoom(room);
                                                    setShowEditModal(true);
                                                }
                                            }}
                                            delayLongPress={500}
                                            style={[
                                                styles.roomCard,
                                                {
                                                    width: isTablet ? '32%' : '48%',
                                                    backgroundColor: colors.card,
                                                    opacity: (isEditMode && !room.isCustom) ? 0.5 : 1,
                                                    transform: [{ scale: (isEditMode && room.isCustom) ? 0.95 : 1 }]
                                                }
                                            ]}
                                        >
                                            {isEditMode && room.isCustom && (
                                                <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: colors.accent, borderRadius: 12, padding: 4 }}>
                                                    <Palette size={16} color="#FFF" />
                                                </View>
                                            )}
                                            <LinearGradient
                                                colors={hasActive ? room.gradient : [colors.card, colors.background]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.cardGradient}
                                            >
                                                <View style={[styles.iconContainer, hasActive && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                                    <Icon size={24} color={hasActive ? '#FFF' : room.gradient[0]} />
                                                </View>

                                                <View style={styles.cardContent}>
                                                    <Text numberOfLines={1} style={[styles.roomName, { color: colors.text }]}>{room.name}</Text>
                                                    <View style={styles.cardStats}>
                                                        <Text style={[styles.statsText, { color: colors.subtext }]}>
                                                            {lightsOn > 0 ? `${lightsOn} an` : 'Aus'}
                                                        </Text>
                                                        {secondaryInfo && (
                                                            <Text style={[styles.statsText, { color: colors.subtext }]}>• {secondaryInfo}</Text>
                                                        )}
                                                    </View>
                                                </View>

                                                {/* Music playing indicator */}
                                                {isMediaPlaying && (
                                                    <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: 4 }}>
                                                        <Music size={12} color={hasActive ? '#FFF' : room.gradient[0]} />
                                                    </View>
                                                )}
                                            </LinearGradient>
                                        </Pressable>
                                    )
                                })}
                            </View>
                        </View>
                    );
                })}

                {/* Custom Rooms Section (User Defined) */}
                {rooms.filter(r => r.isCustom).length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 20, fontWeight: '600', color: colors.subtext, marginBottom: 12, marginLeft: 4 }}>
                            Meine Räume
                        </Text>
                        <View style={styles.roomsGrid}>
                            {rooms.filter(r => r.isCustom).map((room) => {
                                // Reuse Logic... actually we merge them in the main list above if we want them integrated?
                                // The plan said "append to system rooms", which we did in the useMemo.
                                // But existing categories filter mainly by name. 
                                // Since users can name rooms anything, they won't fall into "Ground Floor" etc.
                                // So we probably need to RENDER them here if they weren't caught by categories.
                                // Wait, the logic above: `const categoryRooms = rooms.filter(r => category.data.includes(r.name));`
                                // So custom rooms are excluded!
                                // Let's render them here.

                                const Icon = getRoomIcon(room.iconName || 'Home'); // Correct Icon Retrieval
                                const lightsOn = room.lights.filter((l: any) => l.state === 'on').length;
                                const hasActive = lightsOn > 0 || room.mediaPlayers.some((m: any) => m.state === 'playing');
                                let secondaryInfo = null;
                                const temp = room.climates[0]?.attributes.current_temperature ||
                                    (room.sensors[0]?.attributes?.unit_of_measurement === '°C' ? room.sensors[0]?.state : null);
                                if (temp) secondaryInfo = `${temp}°`;

                                return (
                                    <Pressable
                                        key={room.id}
                                        onPress={() => {
                                            if (isEditMode) {
                                                setEditingRoom(room);
                                                setShowEditModal(true);
                                            } else {
                                                setSelectedRoom(room.name);
                                            }
                                        }}
                                        onLongPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                            setIsEditMode(true);
                                            // Don't open modal immediately, just enter mode? 
                                            // User workflow: Long press -> Edit Mode -> Tap to edit.
                                        }}
                                        delayLongPress={500}
                                        style={[
                                            styles.roomCard,
                                            {
                                                width: isTablet ? '32%' : '48%',
                                                backgroundColor: colors.card,
                                                transform: [{ scale: isEditMode ? 0.95 : 1 }]
                                            }
                                        ]}
                                    >
                                        {isEditMode && (
                                            <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: colors.accent, borderRadius: 12, padding: 4 }}>
                                                <Palette size={16} color="#FFF" />
                                            </View>
                                        )}
                                        <LinearGradient
                                            colors={hasActive ? room.gradient : [colors.card, colors.background]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.cardGradient}
                                        >
                                            <View style={[styles.iconContainer, hasActive && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                                <Icon size={24} color={hasActive ? '#FFF' : room.gradient[0]} />
                                            </View>

                                            <View style={styles.cardContent}>
                                                <Text numberOfLines={1} style={[styles.roomName, { color: colors.text }]}>{room.name}</Text>
                                                <View style={styles.cardStats}>
                                                    <Text style={[styles.statsText, { color: colors.subtext }]}>
                                                        {lightsOn > 0 ? `${lightsOn} an` : 'Aus'}
                                                    </Text>
                                                    {secondaryInfo && (
                                                        <Text style={[styles.statsText, { color: colors.subtext }]}>• {secondaryInfo}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        </LinearGradient>
                                    </Pressable>
                                )
                            })}
                        </View>
                    </View>
                )}

            </ScrollView>

            {/* Footer Control for Adding Rooms */}
            {customRooms.length > 0 && userRole === 'admin' && (
                <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' }}>
                    <Pressable onPress={() => setIsEditMode(!isEditMode)} style={{ padding: 12 }}>
                        <Text style={{ color: isEditMode ? colors.accent : colors.subtext, fontWeight: '600', fontSize: 16 }}>
                            {isEditMode ? 'Fertig' : 'Liste bearbeiten'}
                        </Text>
                    </Pressable>
                </View>
            )}

            <RoomEditModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSave={handleSaveRoom}
                onDelete={handleDeleteRoom}
                initialRoom={editingRoom}
            />

            <RoomDetailModal
                room={activeRoomData}
                visible={!!selectedRoom}
                onClose={closeModal}
                api={api}
                sleepTimerState={sleepTimerState}
                onSelectCover={setSelectedCoverForModal}
                userRole={userRole}
                allEntities={entities}
            />

            <ShutterControlModal
                visible={!!selectedCoverForModal}
                cover={selectedCoverForModal}
                onClose={() => setSelectedCoverForModal(null)}
                setCoverPosition={setCoverPosition}
                setCoverTiltPosition={setCoverTiltPosition}
                stopCover={stopCover}
                pressButton={pressButton}
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
        alignItems: 'stretch',
    },
    tile: {
        minHeight: 110,
    },
    tileContent: {
        flex: 1,
        backgroundColor: 'transparent',
        borderRadius: 20,
        padding: 16,
        minHeight: 110,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'transparent',
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
        backgroundColor: 'rgba(128,128,128,0.1)',
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
        backgroundColor: 'rgba(128,128,128,0.1)',
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
        backgroundColor: 'rgba(128,128,128,0.1)',
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

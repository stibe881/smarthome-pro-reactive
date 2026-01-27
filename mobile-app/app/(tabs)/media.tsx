import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, useWindowDimensions, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
    Music, Tv, Speaker, WifiOff, Radio, Home, LucideIcon, Disc
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

// Whitelisted media players
const MEDIA_PLAYER_CONFIG: Record<string, { name: string; type: 'speaker' | 'tv' }> = {
    'media_player.haus_4': { name: '🏠 Haus', type: 'speaker' },
    'media_player.ma_wohnung': { name: '🎵 Wohnung', type: 'speaker' },
    'media_player.kuche_2': { name: '🍳 Küche', type: 'speaker' },
    'media_player.nest_terrasse': { name: '🌳 Terrasse', type: 'speaker' },
    'media_player.hub_levin': { name: '👦 Levin', type: 'speaker' },
    'media_player.hub_lina': { name: '👧 Lina', type: 'speaker' },
    'media_player.nest_schlafzimmer': { name: '🛏️ Schlafzimmer', type: 'speaker' },
    'media_player.fernseher_im_wohnzimmer_2': { name: '📺 Wohnzimmer TV', type: 'tv' },
    'media_player.shield_schlafzimmer': { name: '📺 Schlafzimmer TV', type: 'tv' },
};

const WHITELISTED_PLAYERS = Object.keys(MEDIA_PLAYER_CONFIG);

export default function Media() {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const { entities, isConnected, callService, getEntityPictureUrl } = useHomeAssistant();

    // Filter only whitelisted media players
    const mediaPlayers = useMemo(() =>
        entities.filter(e => WHITELISTED_PLAYERS.includes(e.entity_id)),
        [entities]
    );

    const activePlayers = mediaPlayers.filter(p => p.state === 'playing' || p.state === 'paused');
    const idlePlayers = mediaPlayers.filter(p => p.state !== 'playing' && p.state !== 'paused');

    // Utils
    const handlePlayPause = (entityId: string, isPlaying: boolean) => {
        callService('media_player', isPlaying ? 'media_pause' : 'media_play', entityId);
    };

    const handlePrevious = (entityId: string) => {
        callService('media_player', 'media_previous_track', entityId);
    };

    const handleNext = (entityId: string) => {
        callService('media_player', 'media_next_track', entityId);
    };

    const handleVolumeChange = (entityId: string, volume: number) => {
        callService('media_player', 'volume_set', entityId, { volume_level: volume });
    };

    const playSpotify = (entityId: string) => {
        // Try to select Spotify source
        callService('media_player', 'select_source', entityId, { source: 'Spotify' });

        // Optimistic UI feedback
        Alert.alert('Spotify', 'Versuche Spotify zu starten...');
    };

    const getPlayerName = (entityId: string, fallback: string) => {
        return MEDIA_PLAYER_CONFIG[entityId]?.name || fallback;
    };

    const getPlayerIcon = (entityId: string, size: number = 32) => {
        const type = MEDIA_PLAYER_CONFIG[entityId]?.type;
        if (type === 'tv') return <Tv size={size} color="#fff" />;
        return <Speaker size={size} color="#fff" />;
    };

    const getPlayerGradient = (entityId: string): [string, string] => {
        const type = MEDIA_PLAYER_CONFIG[entityId]?.type;
        if (type === 'tv') return ['#7C3AED', '#5B21B6'];
        return ['#1DB954', '#191414']; // Spotify Green default
    };

    // COMPONENTS

    const ActivePlayerCard = ({ player }: { player: any }) => {
        const isPlaying = player.state === 'playing';
        const isMuted = player.attributes.is_volume_muted;
        const volume = player.attributes.volume_level || 0;
        const entityPicture = player.attributes.entity_picture;

        return (
            <View style={styles.activeCard}>
                <LinearGradient
                    colors={getPlayerGradient(player.entity_id)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activeCardGradient}
                >
                    <View style={styles.activeHeader}>
                        <View style={styles.deviceBadge}>
                            {getPlayerIcon(player.entity_id, 14)}
                            <Text style={styles.deviceBadgeText}>
                                {getPlayerName(player.entity_id, player.attributes.friendly_name)}
                            </Text>
                        </View>
                        {/* Spotify Indicator */}
                        <View style={styles.spotifyBadge}>
                            <Disc size={14} color="#1DB954" />
                            <Text style={styles.spotifyText}>Spotify</Text>
                        </View>
                    </View>

                    <View style={styles.mainContent}>
                        {/* Cover Art */}
                        <View style={styles.coverArtContainer}>
                            {entityPicture ? (
                                <Image
                                    source={{ uri: getEntityPictureUrl(entityPicture) }}
                                    style={styles.coverArt}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[styles.coverArt, styles.emptyCover]}>
                                    <Music size={48} color="rgba(255,255,255,0.2)" />
                                </View>
                            )}
                        </View>

                        {/* Info */}
                        <View style={styles.trackInfo}>
                            <Text style={styles.trackTitle} numberOfLines={1}>
                                {player.attributes.media_title || 'Unbekannter Titel'}
                            </Text>
                            <Text style={styles.trackArtist} numberOfLines={1}>
                                {player.attributes.media_artist || 'Unbekannter Künstler'}
                            </Text>
                        </View>
                    </View>

                    {/* Controls */}
                    <View style={styles.controls}>
                        <Pressable onPress={() => handlePrevious(player.entity_id)} style={styles.controlBtn}>
                            <SkipBack size={24} color="#fff" />
                        </Pressable>
                        <Pressable onPress={() => handlePlayPause(player.entity_id, isPlaying)} style={styles.playBtn}>
                            {isPlaying ? <Pause size={32} color="#000" /> : <Play size={32} color="#000" style={{ marginLeft: 4 }} />}
                        </Pressable>
                        <Pressable onPress={() => handleNext(player.entity_id)} style={styles.controlBtn}>
                            <SkipForward size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {/* Volume */}
                    <View style={styles.volumeContainer}>
                        <Volume2 size={16} color="rgba(255,255,255,0.6)" />
                        <Slider
                            style={styles.volumeSlider}
                            value={volume}
                            onSlidingComplete={(val) => handleVolumeChange(player.entity_id, val)}
                            minimumValue={0}
                            maximumValue={1}
                            minimumTrackTintColor="#fff"
                            maximumTrackTintColor="rgba(255,255,255,0.2)"
                            thumbTintColor="#fff"
                        />
                    </View>
                </LinearGradient>
            </View>
        );
    };

    const PlayerRow = ({ player }: { player: any }) => (
        <Pressable style={styles.playerRow} onPress={() => {/* Maybe open detailed view? */ }}>
            <View style={[styles.playerIcon, { backgroundColor: MEDIA_PLAYER_CONFIG[player.entity_id]?.type === 'tv' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(29, 185, 84, 0.2)' }]}>
                {getPlayerIcon(player.entity_id, 20)}
            </View>

            <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{getPlayerName(player.entity_id, player.attributes.friendly_name)}</Text>
                <Text style={styles.playerStatus}>{player.state === 'off' ? 'Aus' : player.state}</Text>
            </View>

            <Pressable
                onPress={() => playSpotify(player.entity_id)}
                style={styles.spotifyBtn}
            >
                <Disc size={16} color="#1DB954" />
                <Text style={styles.spotifyBtnText}>Spotify</Text>
            </Pressable>
        </Pressable>
    );

    if (!isConnected) return (
        <SafeAreaView style={styles.container}><View style={styles.emptyState}><WifiOff size={48} color="#64748B" /><Text style={styles.emptyTitle}>Nicht verbunden</Text></View></SafeAreaView>
    );

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#020617', '#111827']}
                style={styles.background}
            />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Musik & Medien</Text>
                </View>

                {/* Active Players */}
                {activePlayers.map(player => (
                    <View key={player.entity_id} style={styles.section}>
                        <ActivePlayerCard player={player} />
                    </View>
                ))}

                {/* All Players List */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Verfügbare Player</Text>
                    <View style={styles.listContainer}>
                        {idlePlayers.map((player, idx) => (
                            <View key={player.entity_id}>
                                <PlayerRow player={player} />
                                {idx < idlePlayers.length - 1 && <View style={styles.divider} />}
                            </View>
                        ))}
                        {idlePlayers.length === 0 && activePlayers.length === 0 && (
                            <Text style={styles.emptyText}>Keine Player gefunden</Text>
                        )}
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    scrollView: { flex: 1 },
    header: { paddingVertical: 24 },
    title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 16, paddingLeft: 4 },

    // Active Card
    activeCard: { borderRadius: 24, overflow: 'hidden', minHeight: 400, backgroundColor: '#1E293B', marginBottom: 8 },
    activeCardGradient: { padding: 24, flex: 1, justifyContent: 'space-between' },
    activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    deviceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    deviceBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    spotifyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29, 185, 84, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    spotifyText: { color: '#1DB954', fontSize: 12, fontWeight: 'bold' },

    mainContent: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    coverArtContainer: { width: 200, height: 200, borderRadius: 12, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, marginBottom: 32 },
    coverArt: { width: '100%', height: '100%', borderRadius: 12 },
    emptyCover: { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    trackInfo: { alignItems: 'center', width: '100%' },
    trackTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 6 },
    trackArtist: { fontSize: 18, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },

    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 32 },
    controlBtn: { padding: 12 },
    playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

    volumeContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    volumeSlider: { flex: 1, height: 40 },

    // Player Row
    listContainer: { backgroundColor: '#1E293B', borderRadius: 20, padding: 8 },
    playerRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    playerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    playerInfo: { flex: 1 },
    playerName: { color: '#fff', fontSize: 16, fontWeight: '600' },
    playerStatus: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
    spotifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29, 185, 84, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    spotifyBtnText: { color: '#1DB954', fontWeight: '600', fontSize: 13 },
    divider: { height: 1, backgroundColor: '#334155', marginLeft: 68 },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { color: '#fff', fontSize: 20, marginTop: 16 },
    emptyText: { color: '#94A3B8', textAlign: 'center', padding: 20 },
});

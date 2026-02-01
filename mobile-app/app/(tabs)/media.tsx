import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, useWindowDimensions, StyleSheet, Alert, Modal, FlatList, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
    Play, Pause, SkipBack, SkipForward, Volume2,
    Music, WifiOff, Disc, Power, Smartphone, Speaker,
    ListMusic, Cast, Radio
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSpotifyAuth, saveSpotifyToken, getSpotifyToken, logoutSpotify, exchangeSpotifyCode } from '../../services/spotifyAuth';
import { spotifyApi, SpotifyDevice } from '../../services/spotifyApi';
import { OptimisticVolumeSlider } from '../../components/OptimisticVolumeSlider';

import { MEDIA_PLAYER_CONFIG, WHITELISTED_PLAYERS } from '../../config/mediaPlayers';

export default function Media() {
    const { entities, isConnected, isConnecting, callService, getEntityPictureUrl, browseMedia } = useHomeAssistant();
    const { colors } = useTheme();
    const { width } = useWindowDimensions();

    // Spotify Modal State
    const [spotifyModalVisible, setSpotifyModalVisible] = useState(false);
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [targetEntityId, setTargetEntityId] = useState<string | null>(null);

    // Native Spotify State
    const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
    const [spotifyDevices, setSpotifyDevices] = useState<SpotifyDevice[]>([]);
    const [showSpotifyDevicePicker, setShowSpotifyDevicePicker] = useState(false);

    // Player Picker State for Hero
    const [showPlayerPicker, setShowPlayerPicker] = useState(false);

    // Auth Hook
    const { request, response, promptAsync } = useSpotifyAuth();

    // State for manually selected player
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

    React.useEffect(() => {
        if (response?.type === 'success') {
            const { code } = response.params;
            if (code && request?.codeVerifier) {
                exchangeSpotifyCode(code, request.codeVerifier, request.redirectUri)
                    .then(data => {
                        if (data.access_token) {
                            saveSpotifyToken(data.access_token, data.refresh_token, data.expires_in);
                            setSpotifyToken(data.access_token);
                            Alert.alert("Verbunden", "Spotify erfolgreich verknüpft!");
                        }
                    })
                    .catch(e => {
                        Alert.alert("Fehler", "Login fehlgeschlagen.");
                    });
            }
        }
    }, [response]);

    // Check for existing token on mount
    React.useEffect(() => {
        getSpotifyToken().then(setSpotifyToken);
    }, []);

    // Filter only whitelisted media players
    const mediaPlayers = useMemo(() =>
        entities.filter(e => WHITELISTED_PLAYERS.includes(e.entity_id)),
        [entities]
    );

    // Sort: Type (Speaker > TV) then Name
    const sortedPlayers = useMemo(() => {
        return [...mediaPlayers].sort((a, b) => {
            const configA = MEDIA_PLAYER_CONFIG[a.entity_id];
            const configB = MEDIA_PLAYER_CONFIG[b.entity_id];

            // 1. Sort by Type (Speaker first, then TV)
            const typeA = configA?.type || 'speaker';
            const typeB = configB?.type || 'speaker';

            if (typeA !== typeB) {
                // 'speaker' comes before 'tv'
                if (typeA === 'speaker') return -1;
                if (typeB === 'speaker') return 1;
            }

            // 2. Sort by Name
            const nameA = configA?.name || 'Unbekannt';
            const nameB = configB?.name || 'Unbekannt';
            return nameA.localeCompare(nameB);
        });
    }, [mediaPlayers]);

    // Determine Active Player (Hero)
    // Priority: 1. Manually Selected, 2. Currently Playing, 3. First in list
    const activePlayer = useMemo(() => {
        if (selectedEntityId) return sortedPlayers.find(p => p.entity_id === selectedEntityId) || sortedPlayers[0];
        return sortedPlayers.find(p => p.state === 'playing') || sortedPlayers[0];
    }, [sortedPlayers, selectedEntityId]);

    // --- LOGIC: MASS RESOLUTION ---
    const getMassPlayerId = (id: string) => {
        if (!id) return null;

        // Pattern 0: Explicit Mapping (User defined overrides)
        const MASS_ID_MAPPING: Record<string, string> = {
            'media_player.nest_buro': 'media_player.nest_garage_2',
        };

        if (MASS_ID_MAPPING[id]) {
            const mappedId = MASS_ID_MAPPING[id];
            // Check if the mapped entity actually exists in our list
            if (entities.find(e => e.entity_id === mappedId)) {
                console.log(`[MASS] Found explicit mapping: ${mappedId} for ${id}`);
                return mappedId;
            }
            console.log(`[MASS] Using explicit mapping (blind trust): ${mappedId} for ${id}`);
            return mappedId;
        }

        // Pattern 1: media_player.mass_name (Exact Prefix Replacement)
        const massId = id.replace('media_player.', 'media_player.mass_');
        if (entities.find(e => e.entity_id === massId)) return massId;

        // Pattern 2: Fuzzy Search (Strip common prefixes)
        const coreName = id.replace('media_player.', '')
            .replace('nest_', '')
            .replace('google_', '')
            .replace('hub_', '')
            .replace('home_', '');

        const massCandidate = entities.find(e =>
            e.entity_id.startsWith('media_player.mass_') &&
            e.entity_id.includes(coreName)
        );

        if (massCandidate) {
            console.log(`[MASS] Found fuzzy match: ${massCandidate.entity_id} for ${id}`);
            return massCandidate.entity_id;
        }

        // Pattern 3: The player itself is already a MASS player
        if (id.startsWith('media_player.mass_')) return id;

        return null;
    };

    // Utils
    const safelyCallService = async (service: string, action: string, entityId: string, data?: any) => {
        if (!isConnected) return;

        let targetId = entityId;

        // AUTO-RESOLVE MASS PLAYER
        // If we are controlling a player that has a MASS equivalent, we should control the MASS player instead.
        // This fixes issues where "Next Trace" fails on the underlying Cast entity.
        const massId = getMassPlayerId(entityId);
        if (massId) {
            // Only redirect if it's NOT a power command (usually power works on the device itself)
            // But actually, for MASS playback, we usually control the MASS player.
            // Let's redirect everything EXCEPT turn_on/turn_off for the underlying hardware if needed.
            // For now: Redirect everything to MASS if available, it usually handles the underlying player.
            console.log(`🔀 Redirecting control from ${entityId} to ${massId} (MASS)`);
            targetId = massId;
        }

        try {
            await callService(service, action, targetId, data);
        } catch (e) {
            console.error("Service Call Failed:", e);
        }
    };

    const handlePlayPause = (entityId: string, isPlaying: boolean) => {
        if (!isPlaying) {
            const player = entities.find(e => e.entity_id === entityId);
            if (player && (player.state === 'idle' || player.state === 'off' || player.state === 'unavailable')) {
                handleSpotify(entityId);
                return;
            }
        }
        safelyCallService('media_player', isPlaying ? 'media_pause' : 'media_play', entityId);
    };

    const handleVolumeChange = (entityId: string, volume: number) => {
        safelyCallService('media_player', 'volume_set', entityId, { volume_level: volume });
    };

    const handlePower = (entityId: string, isOn: boolean) => {
        safelyCallService('media_player', isOn ? 'turn_off' : 'turn_on', entityId);
    };

    const handleSpotify = async (entityId: string) => {
        if (!spotifyToken) {
            if (promptAsync) promptAsync();
            else Alert.alert("Fehler", "Spotify-Konfiguration lädt noch.");
            return;
        }
        setTargetEntityId(entityId);
        // Skip Device Picker -> Go straight to Playlists
        fetchPlaylists();
        setSpotifyModalVisible(true);
    };

    const fetchPlaylists = async () => {
        setLoadingPlaylists(true);
        try {
            const spotifyEntity = entities.find(e => e.entity_id.startsWith('media_player.spotify'));
            if (!spotifyEntity) {
                // If NO Spotify Entity in HA, maybe we can't browse?
                // But we might still be able to play via Web API if we had devices.
                // For now, assume HA integration is key.
                throw new Error("No Spotify Entity in HA");
            }

            const root = await browseMedia(spotifyEntity.entity_id);
            if (!root || !root.children) throw new Error("Root empty");

            let playlistFolder = root.children.find((c: any) => c.title === 'Playlists' || c.title === 'Bibliothek' || c.media_content_type === 'playlist');
            if (playlistFolder) {
                const content = await browseMedia(spotifyEntity.entity_id, playlistFolder.media_content_id, playlistFolder.media_content_type);
                setPlaylists(content?.children || []);
            } else {
                setPlaylists(root.children);
            }
        } catch (e) {
            console.warn("Fetch Playlists Error:", e);
            Alert.alert('Fehler', 'Konnte Playlists nicht laden.');
        } finally {
            setLoadingPlaylists(false);
        }
    };

    const selectPlaylist = async (item: any) => {
        if (!targetEntityId) return;
        setSpotifyModalVisible(false);

        let type = item.media_content_type;
        if (type && type.startsWith('spotify://')) type = type.replace('spotify://', '');

        let contextUri = item.media_content_id;
        // Ensure prefix
        if (!contextUri.startsWith('spotify:')) {
            if (type === 'playlist') contextUri = `spotify:playlist:${contextUri}`;
            else if (type === 'album') contextUri = `spotify:album:${contextUri}`;
            else if (type === 'track') contextUri = `spotify:track:${contextUri}`;
            else if (type === 'artist') contextUri = `spotify:artist:${contextUri}`;
        }

        const targetDevice = entities.find(e => e.entity_id === targetEntityId);
        const deviceName = targetDevice?.attributes.friendly_name || 'Unknown';
        const spotifyEntity = entities.find(e => e.entity_id.startsWith('media_player.spotify'));

        // Helper for URL Fallback
        const getSpotifyUrl = (uri: string) => {
            const parts = uri.split(':');
            if (parts.length >= 3 && parts[0] === 'spotify') {
                return `https://open.spotify.com/${parts[1]}/${parts[2]}`;
            }
            return uri;
        };
        const contextUrl = getSpotifyUrl(contextUri);

        console.log(`🎵 Selecting Playlist: ${item.title} (${type}) for ${deviceName} (${targetEntityId})`);

        const isCast = targetEntityId.includes('nest') || targetEntityId.includes('hub') || targetEntityId.includes('google') || targetEntityId.includes('mini') || targetEntityId.includes('chromecast');

        // Use the Shared Component Logic for resolution
        const massPlayerId = getMassPlayerId(targetEntityId);

        // PRE-WAKE
        try {
            console.log("⚡ Pre-Wake: Ensuring device is on...");
            await callService('media_player', 'turn_on', targetEntityId);
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { console.warn("Wake up failed", e); }

        try {
            // STRATEGY 0: Music Assistant (MASS) - Highest reliability
            if (massPlayerId || isCast) {
                console.log("💿 Attempting Music Assistant (MASS)...");
                try {
                    // We use music_assistant.play_media. If we found a massPlayerId, we target it.
                    // Otherwise, we try to target the standard player via MASS logic.
                    // CORRECTION: Service is 'music_assistant.play_media'
                    await callService('music_assistant', 'play_media', massPlayerId || targetEntityId, {
                        media_id: contextUri,
                        media_type: type || 'playlist'
                    });
                    Alert.alert("Music Assistant", `Wiedergabe auf ${deviceName} gestartet`);
                    return;
                } catch (e: any) {
                    console.warn("Music Assistant failed, falling back to Spotcast...", e);
                }
            }

            // STRATEGY 1: Spotcast
            if (isCast) {
                console.log("🚀 Attempting Spotcast (User Suggestion)...");
                try {
                    await callService('spotcast', 'start', undefined as any, {
                        device_name: deviceName,
                        uri: contextUri,
                        force_playback: true,
                        random_song: false
                    });
                    Alert.alert("Spotify", `Wiedergabe via Spotcast auf ${deviceName} gestartet`);
                    return;
                } catch (e: any) {
                    console.warn("Spotcast failed, falling back to Native HA...", e);
                }
            }

            // STRATEGY 2: HA-NATIVE SPOTIFY (Fallback)
            if (spotifyEntity) {
                console.log(`🤖 Attempting HA-Native Spotify via ${spotifyEntity.entity_id}...`);
                try {
                    // 1. Select Source
                    const sourceList = spotifyEntity.attributes.source_list || [];
                    const sourceMatch = sourceList.find((s: string) =>
                        s.toLowerCase() === deviceName.toLowerCase() ||
                        s.toLowerCase().includes(deviceName.toLowerCase()) ||
                        deviceName.toLowerCase().includes(s.toLowerCase())
                    );
                    const finalSource = sourceMatch || deviceName;

                    console.log(`📤 Setting HA Spotify source to: ${finalSource}`);
                    await callService('media_player', 'select_source', spotifyEntity.entity_id, { source: finalSource });
                    await new Promise(r => setTimeout(r, 1500));

                    // 2. Play on the SPOTIFY entity
                    console.log(`▶️ Calling play_media on ${spotifyEntity.entity_id}`);
                    await callService('media_player', 'play_media', spotifyEntity.entity_id, {
                        media_content_id: contextUri,
                        media_content_type: 'playlist'
                    });

                    Alert.alert("Spotify", `Wiedergabe auf ${deviceName} gestartet`);
                    return;
                } catch (e) {
                    console.warn("HA-Native Spotify failed, trying Direct URL...", e);
                }
            }

            // STRATEGY 3: Direct Play Music URL (Absolute Fallback)
            console.log("🎯 Attempting Direct URL Play (Fallback)...");
            try {
                await callService('media_player', 'play_media', targetEntityId, {
                    media_content_id: contextUrl,
                    media_content_type: 'music'
                });
                console.log("✅ Direct URL Play call succeeded");
                return;
            } catch (e) {
                console.warn("Direct URL Play failed, trying legacy URI fallback...");
                await callService('media_player', 'play_media', targetEntityId, {
                    media_content_id: contextUri,
                    media_content_type: 'music'
                });
            }

        } catch (e) {
            console.error("All playback strategies failed:", e);
            Alert.alert("Fehler", "Spotify konnte nicht gestartet werden. Bitte starte die Wiedergabe einmal manuell in der Spotify App.");
        }
    };

    // --- RENDER HELPERS ---
    const getPlayerName = (entityId: string) => MEDIA_PLAYER_CONFIG[entityId]?.name || 'Unbekannt';

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
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

            {/* Disconnected Overlay */}
            {(!isConnected && !isConnecting) && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, justifyContent: 'center', alignItems: 'center' }]}>
                    <WifiOff size={64} color="#64748B" />
                    <Text style={{ color: '#F8FAFC', fontSize: 20, marginTop: 16 }}>Keine Verbindung</Text>
                    <Text style={{ color: '#94A3B8', marginTop: 8 }}>Versuche neu zu verbinden...</Text>
                </View>
            )}

            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.headerTitle}>Medien</Text>

                    {/* Hero */}
                    <View style={{ marginBottom: 32 }}>
                        <HeroPlayer
                            player={activePlayer}
                            imageUrl={getEntityPictureUrl(activePlayer?.attributes.entity_picture)}
                            onSelect={() => setShowPlayerPicker(true)}
                            onSpotify={() => handleSpotify(activePlayer?.entity_id)}
                            onPlayPause={(playing) => handlePlayPause(activePlayer?.entity_id, playing)}
                            onNext={() => safelyCallService('media_player', 'media_next_track', activePlayer?.entity_id)}
                            onPrev={() => safelyCallService('media_player', 'media_previous_track', activePlayer?.entity_id)}
                            onPower={(on) => handlePower(activePlayer?.entity_id, on)}
                            onVolume={(v) => handleVolumeChange(activePlayer?.entity_id, v)}
                            spotifyActive={!!spotifyToken}
                        />
                    </View>

                    {/* List */}
                    <Text style={styles.sectionTitle}>Alle Lautsprecher</Text>
                    <View style={styles.listContainer}>
                        {sortedPlayers.map(p => (
                            <ExpandedPlayerRow
                                key={p.entity_id}
                                player={p}
                                isSelected={p.entity_id === activePlayer.entity_id}
                                imageUrl={getEntityPictureUrl(p.attributes.entity_picture)}
                                onSelect={() => setSelectedEntityId(p.entity_id)}
                                onSpotify={() => handleSpotify(p.entity_id)}
                                onPlayPause={(playing) => handlePlayPause(p.entity_id, playing)}
                                onPower={(on) => handlePower(p.entity_id, on)}
                                onVolume={(v) => handleVolumeChange(p.entity_id, v)}
                                spotifyActive={!!spotifyToken}
                            />
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Media Player Picker (Hero Selection) */}
            <Modal animationType="fade" transparent={true} visible={showPlayerPicker} onRequestClose={() => setShowPlayerPicker(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalHeader}>Lautsprecher wählen</Text>
                        <FlatList
                            data={sortedPlayers}
                            keyExtractor={i => i.entity_id}
                            renderItem={({ item }) => {
                                const isSelected = item.entity_id === activePlayer.entity_id;
                                const isPlaying = item.state === 'playing';
                                return (
                                    <Pressable style={styles.modalItem} onPress={() => {
                                        setSelectedEntityId(item.entity_id);
                                        setShowPlayerPicker(false);
                                    }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }}>
                                            <Speaker size={20} color={isSelected ? '#60A5FA' : '#94A3B8'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.modalItemText, isSelected && { color: '#60A5FA', fontWeight: '700' }]}>
                                                {MEDIA_PLAYER_CONFIG[item.entity_id]?.name || 'Unbekannt'}
                                            </Text>
                                            {isPlaying && <Text style={{ fontSize: 12, color: '#1DB954' }}>Spielt gerade</Text>}
                                        </View>
                                        {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#60A5FA' }} />}
                                    </Pressable>
                                );
                            }}
                        />
                        <Pressable style={styles.closeButton} onPress={() => setShowPlayerPicker(false)}>
                            <Text style={styles.closeButtonText}>Abbrechen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Spotify Device Picker (Bottom Sheet) */}
            <Modal animationType="slide" transparent={true} visible={showSpotifyDevicePicker} onRequestClose={() => setShowSpotifyDevicePicker(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalHeader}>Gerät auswählen (Spotify)</Text>
                        <FlatList
                            data={spotifyDevices}
                            keyExtractor={i => i.id}
                            renderItem={({ item }) => (
                                <Pressable style={styles.modalItem} onPress={async () => {
                                    await spotifyApi.transferPlayback(item.id, true);
                                    setShowSpotifyDevicePicker(false);
                                }}>
                                    <Cast size={20} color={item.is_active ? "#1DB954" : "#FFF"} />
                                    <Text style={[styles.modalItemText, item.is_active && { color: '#1DB954' }]}>{item.name}</Text>
                                </Pressable>
                            )}
                        />
                        <Pressable style={styles.closeButton} onPress={() => setShowSpotifyDevicePicker(false)}>
                            <Text style={styles.closeButtonText}>Abbrechen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Playlist Browser */}
            <Modal animationType="slide" transparent={true} visible={spotifyModalVisible} onRequestClose={() => setSpotifyModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '80%' }]}>
                        <Text style={styles.modalHeader}>Bibliothek</Text>
                        {loadingPlaylists ? <ActivityIndicator color="#1DB954" size="large" /> : (
                            <FlatList
                                data={playlists}
                                keyExtractor={i => i.media_content_id}
                                renderItem={({ item }) => (
                                    <Pressable style={styles.modalItem} onPress={() => selectPlaylist(item)}>
                                        <Image source={{ uri: getEntityPictureUrl(item.thumbnail) }} style={{ width: 40, height: 40, borderRadius: 4, marginRight: 12 }} />
                                        <View>
                                            <Text style={styles.modalItemText}>{item.title}</Text>
                                            <Text style={{ color: '#64748B', fontSize: 12 }}>{item.media_content_type}</Text>
                                        </View>
                                    </Pressable>
                                )}
                            />
                        )}
                        <Pressable style={styles.closeButton} onPress={() => setSpotifyModalVisible(false)}>
                            <Text style={styles.closeButtonText}>Schließen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}



// --- EXTRACTED COMPONENTS ---

const HeroPlayer = ({ player, imageUrl, onSelect, onSpotify, onPlayPause, onNext, onPrev, onPower, onVolume, spotifyActive }: {
    player: any,
    imageUrl?: string,
    onSelect: () => void,
    onSpotify: () => void,
    onPlayPause: (playing: boolean) => void,
    onNext: () => void,
    onPrev: () => void,
    onPower: (on: boolean) => void,
    onVolume: (v: number) => void,

    spotifyActive: boolean
}) => {
    const { colors } = useTheme();
    if (!player) return null;
    const isPlaying = player.state === 'playing';
    const isOff = player.state === 'off';
    const volume = player.attributes.volume_level || 0;
    const title = player.attributes.media_title || (isOff ? 'Bereit' : (player.attributes.app_name || MEDIA_PLAYER_CONFIG[player.entity_id]?.name || 'Unbekannt'));
    const artist = player.attributes.media_artist || player.attributes.media_series_title || (isOff ? 'Tippen zum Starten' : '');

    return (
        <View style={[styles.heroContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {imageUrl && !isOff ? (
                <Image source={{ uri: imageUrl }} style={styles.heroBackground} blurRadius={40} />
            ) : (
                <LinearGradient colors={[colors.card, colors.background]} style={styles.heroBackground} />
            )}
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
                <Pressable style={[styles.heroHeaderSelect, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onSelect}>
                    <Text style={[styles.heroSourceText, { color: '#CBD5E1' }]}>{MEDIA_PLAYER_CONFIG[player.entity_id]?.name || 'Unbekannt'} ▼</Text>
                </Pressable>

                {/* Artwork */}
                <View style={styles.heroArtworkContainer}>
                    {imageUrl && !isOff ? (
                        <Image source={{ uri: imageUrl }} style={styles.heroArtwork} />
                    ) : (
                        <View style={[styles.heroArtwork, { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' }]}>
                            <Music size={64} color="#64748B" />
                        </View>
                    )}
                </View>

                {/* Metadata */}
                <View style={styles.heroMeta}>
                    <Text style={styles.heroTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.heroArtist} numberOfLines={1}>{artist}</Text>
                </View>

                {/* Controls */}
                <View style={styles.heroControls}>
                    <Pressable onPress={onSpotify} style={styles.controlBtnSmall}>
                        <Disc size={24} color={spotifyActive ? "#1DB954" : "#64748B"} />
                    </Pressable>

                    <Pressable onPress={onPrev}>
                        <SkipBack size={32} color="#FFF" />
                    </Pressable>

                    <Pressable onPress={() => onPlayPause(isPlaying)} style={styles.playBtnLarge}>
                        {isPlaying ? <Pause size={32} color="#000" fill="#000" /> : <Play size={32} color="#000" fill="#000" style={{ marginLeft: 4 }} />}
                    </Pressable>

                    <Pressable onPress={onNext}>
                        <SkipForward size={32} color="#FFF" />
                    </Pressable>

                    <Pressable onPress={() => onPower(!isOff)} style={styles.controlBtnSmall}>
                        <Power size={24} color={!isOff ? "#EF4444" : "#64748B"} />
                    </Pressable>
                </View>

                {/* Volume */}
                <View style={styles.heroVolume}>
                    <Volume2 size={20} color="#94A3B8" />
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <OptimisticVolumeSlider
                            value={volume}
                            onValueChange={() => { }}
                            onSlidingComplete={onVolume}
                            disabled={isOff}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
};

const ExpandedPlayerRow = ({ player, isSelected, imageUrl, onSelect, onSpotify, onPlayPause, onPower, onVolume, spotifyActive }: {
    player: any,
    isSelected: boolean,
    imageUrl?: string,
    onSelect: () => void,
    onSpotify: () => void,
    onPlayPause: (playing: boolean) => void,
    onPower: (on: boolean) => void,
    onVolume: (v: number) => void,

    spotifyActive: boolean
}) => {
    const { colors } = useTheme();
    const isOff = player.state === 'off';
    const isPlaying = player.state === 'playing';
    const name = MEDIA_PLAYER_CONFIG[player.entity_id]?.name || 'Unbekannt';
    const volume = player.attributes.volume_level || 0;

    return (
        <Pressable
            onPress={onSelect}
            style={[styles.expandedPlayer, { backgroundColor: colors.card, borderColor: colors.border }, isSelected && { borderColor: colors.accent, backgroundColor: colors.card }, isOff && { opacity: 0.8 }]}
        >
            <View style={styles.expandedHeader}>
                <View style={[styles.miniIcon, { backgroundColor: colors.background }]}>
                    {imageUrl && !isOff ? (
                        <Image source={{ uri: imageUrl }} style={{ width: 48, height: 48, borderRadius: 8 }} />
                    ) : (
                        <Speaker size={24} color={colors.subtext} />
                    )}
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <Text style={[styles.miniName, { color: colors.text }, isSelected && { color: colors.accent }]}>{name}</Text>
                    <Text style={[styles.miniStatus, { color: colors.subtext }]} numberOfLines={1}>
                        {isOff ? 'Aus' : (player.attributes.media_title || 'Bereit')}
                    </Text>
                </View>
                <Pressable onPress={() => onPower(!isOff)} style={{ padding: 8 }}>
                    <Power size={22} color={!isOff ? "#EF4444" : "#64748B"} />
                </Pressable>
            </View>

            {/* Controls Row (Volume + Spotify + Play) */}
            <View style={styles.expandedControls}>
                <Pressable onPress={onSpotify} style={styles.iconBtn}>
                    <Disc size={20} color={spotifyActive ? "#1DB954" : "#64748B"} />
                </Pressable>

                {/* Volume Slider */}
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <OptimisticVolumeSlider
                        style={{ height: 30 }}
                        value={volume}
                        onValueChange={() => { }}
                        onSlidingComplete={onVolume}
                        disabled={isOff}
                    />
                </View>

                <Pressable onPress={() => onPlayPause(isPlaying)} style={styles.iconBtn} disabled={isOff}>
                    {isPlaying ? <Pause size={24} color="#FFF" /> : <Play size={24} color={isOff ? "#64748B" : "#FFF"} />}
                </Pressable>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#020617' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    offText: { color: '#64748B', marginTop: 12, fontSize: 16 },
    scrollContent: { padding: 24, paddingBottom: 100 },
    headerTitle: { fontSize: 32, fontWeight: '800', color: '#F8FAFC', marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginBottom: 12, marginTop: 12 },

    // Hero
    heroContainer: { width: '100%', height: 420, borderRadius: 32, overflow: 'hidden', backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
    heroBackground: { ...StyleSheet.absoluteFillObject },
    heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    heroContent: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'space-between' },
    heroArtworkContainer: { width: 160, height: 160, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, elevation: 12, marginBottom: 16, position: 'relative' },
    heroArtwork: { width: '100%', height: '100%', borderRadius: 24 },
    heroSourceBadge: { position: 'absolute', bottom: -12, alignSelf: 'center', backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
    heroSourceText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
    heroMeta: { alignItems: 'center', marginBottom: 16 },
    heroTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 4 },
    heroArtist: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
    heroControls: { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 24 },
    playBtnLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
    controlBtnSmall: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
    heroVolume: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 8 },
    heroHeaderSelect: { position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },

    // Expanded List
    listContainer: { gap: 12 },
    expandedPlayer: { backgroundColor: '#1E293B', borderRadius: 24, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
    expandedPlayerSelected: { borderColor: '#60A5FA', backgroundColor: '#1e293b' },
    expandedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    expandedControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: 8 },

    miniIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
    miniName: { color: '#FFF', fontSize: 18, fontWeight: '600' },
    miniStatus: { color: '#94A3B8', fontSize: 13 },
    iconBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalHeader: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 20 },
    modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155', gap: 16 },
    modalItemText: { color: '#FFF', fontSize: 16 },
    actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', padding: 16, borderRadius: 16, marginTop: 16, gap: 8 },
    actionButtonText: { color: '#FFF', fontWeight: 'bold' },
    closeButton: { alignItems: 'center', padding: 16, marginTop: 8 },
    closeButtonText: { color: '#EF4444' }
});

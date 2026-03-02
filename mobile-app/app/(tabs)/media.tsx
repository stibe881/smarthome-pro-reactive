import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, useWindowDimensions, StyleSheet, Alert, Modal, FlatList, Linking, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
    Play, Pause, SkipBack, SkipForward, Volume2,
    Music, WifiOff, Disc, Power, Smartphone, Speaker,
    ListMusic, Cast, Radio, Shuffle, Repeat, Repeat1, ChevronRight, ChevronLeft, ChevronDown, Tv, X, Settings
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSpotifyAuth, saveSpotifyToken, getSpotifyToken, logoutSpotify, exchangeSpotifyCode } from '../../services/spotifyAuth';
import { spotifyApi, SpotifyDevice } from '../../services/spotifyApi';
import { OptimisticVolumeSlider } from '../../components/OptimisticVolumeSlider';

import { MEDIA_PLAYER_CONFIG } from '../../config/mediaPlayers';
import { PlayerType } from '../../components/MediaPlayerSelectionModal';
import { MediaPlayerSelectionModal } from '../../components/MediaPlayerSelectionModal';

export default function Media() {
    const { entities, isConnected, isConnecting, callService, getEntityPictureUrl, browseMedia, dashboardConfig } = useHomeAssistant();
    const { colors } = useTheme();
    const { userRole } = useAuth();
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

    // Playlist Track Browsing State
    const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
    const [loadingTracks, setLoadingTracks] = useState(false);
    const [selectedPlaylistItem, setSelectedPlaylistItem] = useState<any>(null);

    // Delayed disconnection state - don't show overlay for brief blips
    const [showDisconnected, setShowDisconnected] = useState(false);
    const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!isConnected && !isConnecting) {
            disconnectTimerRef.current = setTimeout(() => setShowDisconnected(true), 5000);
        } else {
            if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
            setShowDisconnected(false);
        }
        return () => { if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current); };
    }, [isConnected, isConnecting]);

    // Auth Hook
    const { request, response, promptAsync } = useSpotifyAuth();

    // State for manually selected player
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

    // Dynamic Media Player    // Visibility State
    const [visiblePlayers, setVisiblePlayers] = useState<string[]>([]);
    const [customNames, setCustomNames] = useState<Record<string, string>>({});
    const [playerTypes, setPlayerTypes] = useState<Record<string, PlayerType>>({});
    const [showSelectionModal, setShowSelectionModal] = useState(false);

    // Sync from dashboardConfig (Supabase tenant storage)
    useEffect(() => {
        const config = dashboardConfig?.mediaPlayerConfig;
        if (config?.visiblePlayers) {
            setVisiblePlayers(config.visiblePlayers);
        } else {
            // Fallback: use hardcoded whitelist
            const whitelist = Object.keys(MEDIA_PLAYER_CONFIG);
            setVisiblePlayers(whitelist);
        }
        if (config?.customNames) {
            setCustomNames(config.customNames);
        }
        if (config?.playerTypes) {
            setPlayerTypes(config.playerTypes);
        }
    }, [dashboardConfig?.mediaPlayerConfig]);

    useEffect(() => {
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

    // Filter media players based on visible configuration
    const mediaPlayers = useMemo(() =>
        entities.filter(e => visiblePlayers.includes(e.entity_id)),
        [entities, visiblePlayers]
    );

    // Helper: get player type from dynamic config, fallback to hardcoded config
    const getPlayerType = (entityId: string): PlayerType => {
        if (playerTypes[entityId]) return playerTypes[entityId];
        const cfg = MEDIA_PLAYER_CONFIG[entityId];
        if (cfg?.isGroup) return 'group';
        if (cfg?.type === 'tv') return 'tv';
        return 'speaker';
    };

    // Sort: Groups first, then Speakers, then TVs, then alphabetically
    const sortedPlayers = useMemo(() => {
        const typeOrder: Record<PlayerType, number> = { group: 0, speaker: 1, tv: 2 };
        return [...mediaPlayers].sort((a, b) => {
            const typeA = getPlayerType(a.entity_id);
            const typeB = getPlayerType(b.entity_id);
            if (typeA !== typeB) return typeOrder[typeA] - typeOrder[typeB];

            const nameA = customNames[a.entity_id] || MEDIA_PLAYER_CONFIG[a.entity_id]?.name || 'Unbekannt';
            const nameB = customNames[b.entity_id] || MEDIA_PLAYER_CONFIG[b.entity_id]?.name || 'Unbekannt';
            return nameA.localeCompare(nameB);
        });
    }, [mediaPlayers, customNames, playerTypes]);

    // Auto-clear manual selection when selected player stops and another starts
    useEffect(() => {
        if (!selectedEntityId) return;
        const selected = sortedPlayers.find(p => p.entity_id === selectedEntityId);
        const anyPlaying = sortedPlayers.find(p => p.state === 'playing');
        // If the manually selected player is NOT playing, but another one IS -> auto-switch
        if (selected && selected.state !== 'playing' && anyPlaying && anyPlaying.entity_id !== selectedEntityId) {
            setSelectedEntityId(null);
        }
    }, [sortedPlayers, selectedEntityId]);

    // Determine Active Player (Hero)
    // Priority: 1. Manually Selected, 2. Playing Group, 3. Playing Individual, 4. First in list
    const activePlayer = useMemo(() => {
        if (selectedEntityId) return sortedPlayers.find(p => p.entity_id === selectedEntityId) || sortedPlayers[0];
        // Prioritize playing groups over individual players
        const playingGroup = sortedPlayers.find(p => p.state === 'playing' && getPlayerType(p.entity_id) === 'group');
        if (playingGroup) return playingGroup;
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
                // console.log(`[MASS] Found explicit mapping: ${mappedId} for ${id}`);
                return mappedId;
            }
            console.log(`[MASS] Using explicit mapping (blind trust): ${mappedId} for ${id}`);
            return mappedId;
        }

        // Pattern 0.5: The player itself is already a Music Assistant player (ma_ or mass_ prefix)
        if (id.startsWith('media_player.ma_') || id.startsWith('media_player.mass_')) {
            console.log(`[MASS] Player ${id} is already a Music Assistant player`);
            return id;
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
            (e.entity_id.startsWith('media_player.mass_') || e.entity_id.startsWith('media_player.ma_')) &&
            e.entity_id.includes(coreName)
        );

        if (massCandidate) {
            console.log(`[MASS] Found fuzzy match: ${massCandidate.entity_id} for ${id}`);
            return massCandidate.entity_id;
        }

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
            // console.log(`🔀 Redirecting control from ${entityId} to ${massId} (MASS)`);
            targetId = massId;
        }

        try {
            await callService(service, action, targetId, data);
        } catch (e: any) {
            // Silently ignore service_validation_error (e.g. entity doesn't support action)
            if (e?.code === 'service_validation_error') return;
        }
    };

    const handlePlayPause = (entityId: string, isPlaying: boolean) => {
        if (!isPlaying) {
            const player = entities.find(e => e.entity_id === entityId);
            // Only open Spotify picker if player is truly empty (no media loaded)
            // Cast devices go to 'idle' after pause — if media_title exists, just resume
            if (player && (player.state === 'idle' || player.state === 'off' || player.state === 'unavailable' || player.state === 'paused')) {
                const hasMedia = player.attributes?.media_title || player.attributes?.media_content_id;
                if (!hasMedia) {
                    handleSpotify(entityId);
                    return;
                }
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

    const handleShuffle = (entityId: string) => {
        const player = entities.find(e => e.entity_id === entityId);
        const currentShuffle = player?.attributes?.shuffle || false;
        safelyCallService('media_player', 'shuffle_set', entityId, { shuffle: !currentShuffle });
    };

    const handleRepeat = (entityId: string) => {
        const player = entities.find(e => e.entity_id === entityId);
        const currentRepeat = player?.attributes?.repeat || 'off';
        // Cycle: off -> all -> one -> off
        const nextRepeat = currentRepeat === 'off' ? 'all' : currentRepeat === 'all' ? 'one' : 'off';
        safelyCallService('media_player', 'repeat_set', entityId, { repeat: nextRepeat });
    };

    // --- SESSION TRANSFER ---
    // When switching players, transfer the current media session to the new player
    const transferSessionToPlayer = async (newEntityId: string) => {
        const currentPlayer = activePlayer;
        if (!currentPlayer || currentPlayer.entity_id === newEntityId) {
            setSelectedEntityId(newEntityId);
            return;
        }

        const isPlaying = currentPlayer.state === 'playing' || currentPlayer.state === 'paused';
        const attrs = currentPlayer.attributes || {};
        const mediaContentId = attrs.media_content_id;
        const mediaTitle = attrs.media_title;
        const mediaArtist = attrs.media_artist;

        // Switch hero immediately
        setSelectedEntityId(newEntityId);

        // Only transfer if something is actually playing/paused
        if (!isPlaying || !mediaContentId) return;

        try {
            // 1. Wake up target player if needed
            const targetState = entities.find(e => e.entity_id === newEntityId)?.state;
            if (targetState === 'off' || targetState === 'idle' || targetState === 'unavailable' || !targetState) {
                await callService('media_player', 'turn_on', newEntityId);
                await new Promise(r => setTimeout(r, 2000));
            }

            // 2. Try to play the same media on the new player
            const massTarget = getMassPlayerId(newEntityId) || newEntityId;

            // Try MASS first
            try {
                await callService('music_assistant', 'play_media', massTarget, {
                    media_id: mediaContentId,
                    media_type: 'track'
                });
            } catch {
                // Fallback to HA play_media
                try {
                    await callService('media_player', 'play_media', massTarget, {
                        media_content_id: mediaContentId,
                        media_content_type: 'music'
                    });
                } catch (e2) {
                    console.warn('[Transfer] Playback transfer failed:', e2);
                }
            }

            // 3. Stop playback on old player (after brief delay to ensure new one started)
            await new Promise(r => setTimeout(r, 1000));
            try {
                await callService('media_player', 'media_pause', currentPlayer.entity_id);
            } catch { /* ignore */ }

        } catch (e) {
            console.warn('[Transfer] Session transfer failed:', e);
        }
    };

    const browsePlaylistTracks = async (item: any) => {
        setSelectedPlaylistItem(item);
        setLoadingTracks(true);
        try {
            const spotifyEntity = entities.find(e => e.entity_id.startsWith('media_player.spotify'));
            if (!spotifyEntity) throw new Error('No Spotify Entity');
            const content = await browseMedia(spotifyEntity.entity_id, item.media_content_id, item.media_content_type);
            setPlaylistTracks(content?.children || []);
        } catch (e) {
            console.warn('Failed to load tracks:', e);
            setPlaylistTracks([]);
        } finally {
            setLoadingTracks(false);
        }
    };

    const startPlaylistFromTrack = async (track: any, playlist: any) => {
        if (!targetEntityId) return;
        setSpotifyModalVisible(false);
        setPlaylistTracks([]);
        setSelectedPlaylistItem(null);

        // Build the playlist URI to give context
        let playlistUri = playlist.media_content_id;
        if (!playlistUri.startsWith('spotify:')) {
            playlistUri = `spotify:playlist:${playlistUri}`;
        }
        let trackUri = track.media_content_id;
        if (!trackUri.startsWith('spotify:')) {
            trackUri = `spotify:track:${trackUri}`;
        }

        const massPlayerId = getMassPlayerId(targetEntityId);
        const massTarget = massPlayerId || targetEntityId;

        try {
            await callService('media_player', 'turn_on', targetEntityId);
            await new Promise(r => setTimeout(r, 1000));

            // Try playing the playlist with offset to specific track
            await callService('music_assistant', 'play_media', massTarget, {
                media_id: trackUri,
                media_type: 'track'
            });
        } catch (e) {
            try {
                await callService('media_player', 'play_media', massTarget, {
                    media_content_id: trackUri,
                    media_content_type: 'music'
                });
            } catch (e2) {
                console.warn('Track play failed:', e2);
            }
        }
    };

    const startPlaylistShuffled = async (item: any) => {
        if (!targetEntityId) return;
        // Close modal and clean up state first
        setSpotifyModalVisible(false);
        setPlaylistTracks([]);
        setSelectedPlaylistItem(null);

        // Enable shuffle BEFORE starting the playlist
        await safelyCallService('media_player', 'shuffle_set', targetEntityId, { shuffle: true });

        // Then start the playlist (pass item directly to selectPlaylist)
        // selectPlaylist will handle the actual playback
        await selectPlaylist(item);
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

        // PRE-WAKE - Only wait if player is actually off
        try {
            const playerState = entities.find(e => e.entity_id === targetEntityId)?.state;
            if (playerState === 'off' || playerState === 'idle' || playerState === 'unavailable' || !playerState) {
                await callService('media_player', 'turn_on', targetEntityId);
                // Cast devices and groups need more time to initialize
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch (e) { /* Wake up failed - continue anyway */ }

        try {
            // STRATEGY 0: Music Assistant (MASS) - Always try first (highest reliability)
            const massTarget = massPlayerId || targetEntityId;
            const isMassGroup = massTarget.startsWith('media_player.ma_') || massTarget.startsWith('media_player.mass_');

            if (isMassGroup) {
                // MASS groups work better with standard HA play_media
                console.log("💿 Attempting HA play_media on MASS group:", massTarget);
                try {
                    await callService('media_player', 'play_media', massTarget, {
                        media_content_id: contextUri,
                        media_content_type: type || 'playlist'
                    });
                    // Playback started successfully
                    return;
                } catch (e: any) {
                    console.warn("MASS group play_media failed, trying music_assistant...", e);
                }
            }

            console.log("💿 Attempting music_assistant.play_media on:", massTarget);
            try {
                await callService('music_assistant', 'play_media', massTarget, {
                    media_id: contextUri,
                    media_type: type || 'playlist'
                });
                // Playback started successfully
                return;
            } catch (e: any) {
                console.warn("Music Assistant failed, falling back...", e);
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
                    // Playback started successfully
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

                    // Playback started successfully
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
    const getPlayerName = (entityId: string) => {
        if (customNames[entityId]) return customNames[entityId];
        const configName = MEDIA_PLAYER_CONFIG[entityId]?.name;
        if (configName) return configName;
        const entity = entities.find(e => e.entity_id === entityId);
        return entity?.attributes?.friendly_name || 'Unbekannt';
    };

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

            {/* Disconnected Overlay - only after 5s */}
            {showDisconnected && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, justifyContent: 'center', alignItems: 'center' }]}>
                    <WifiOff size={64} color="#64748B" />
                    <Text style={{ color: '#F8FAFC', fontSize: 20, marginTop: 16 }}>Keine Verbindung</Text>
                    <Text style={{ color: '#94A3B8', marginTop: 8 }}>Versuche neu zu verbinden...</Text>
                </View>
            )}

            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.headerTitle}>Medien</Text>
                    </View>

                    {/* Hero */}
                    <View style={{ marginBottom: 32 }}>
                        <HeroPlayer
                            player={activePlayer}
                            massPlayer={(() => {
                                const massId = getMassPlayerId(activePlayer?.entity_id);
                                return massId ? entities.find(e => e.entity_id === massId) : undefined;
                            })()}
                            imageUrl={getEntityPictureUrl(activePlayer?.attributes.entity_picture)}
                            massImageUrl={(() => {
                                const massId = getMassPlayerId(activePlayer?.entity_id);
                                const massEntity = massId ? entities.find(e => e.entity_id === massId) : undefined;
                                return massEntity ? getEntityPictureUrl(massEntity.attributes?.entity_picture) : undefined;
                            })()}
                            onSelect={() => setShowPlayerPicker(true)}
                            onSpotify={() => handleSpotify(activePlayer?.entity_id)}
                            onPlayPause={(playing) => handlePlayPause(activePlayer?.entity_id, playing)}
                            onNext={() => safelyCallService('media_player', 'media_next_track', activePlayer?.entity_id)}
                            onPrev={() => safelyCallService('media_player', 'media_previous_track', activePlayer?.entity_id)}
                            onPower={(on) => handlePower(activePlayer?.entity_id, on)}
                            onVolume={(v) => handleVolumeChange(activePlayer?.entity_id, v)}
                            onShuffle={() => handleShuffle(activePlayer?.entity_id)}
                            onRepeat={() => handleRepeat(activePlayer?.entity_id)}
                            spotifyActive={(() => {
                                const massId = getMassPlayerId(activePlayer?.entity_id);
                                const me = massId ? entities.find(e => e.entity_id === massId) : undefined;
                                const an = (activePlayer?.attributes?.app_name || me?.attributes?.app_name || '').toLowerCase();
                                const ci = (activePlayer?.attributes?.media_content_id || me?.attributes?.media_content_id || '').toLowerCase();
                                return an.includes('spotify') || ci.includes('spotify');
                            })()}
                            getPlayerName={getPlayerName}
                        />
                    </View>

                    {/* Player list removed — only HeroPlayer is shown */}
                    {/* Users switch players via the player picker (tap player name) */}


                </ScrollView>
            </SafeAreaView>

            {/* Media Player Picker (Hero Selection) */}
            <Modal animationType="slide" transparent={true} visible={showPlayerPicker} onRequestClose={() => setShowPlayerPicker(false)}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={{ flex: 1, backgroundColor: '#020617' }}>
                        {/* Header */}
                        <View style={{
                            paddingVertical: 24,
                            paddingHorizontal: 20,
                            paddingTop: 60,
                            borderBottomLeftRadius: 32,
                            borderBottomRightRadius: 32,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#3B82F6',
                        }}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FFF' }}>Lautsprecher wählen</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {userRole === 'admin' && (
                                    <Pressable onPress={() => { setShowPlayerPicker(false); setShowSelectionModal(true); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Settings size={20} color="#FFF" />
                                    </Pressable>
                                )}
                                <Pressable onPress={() => setShowPlayerPicker(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={24} color="#FFF" />
                                </Pressable>
                            </View>
                        </View>
                        {/* Body */}
                        <ScrollView style={{ flex: 1, padding: 16 }}>
                            {(() => {
                                const sortFn = (a: any, b: any) => getPlayerName(a.entity_id).localeCompare(getPlayerName(b.entity_id));
                                const sections = [
                                    { title: 'Gruppen', data: sortedPlayers.filter(p => getPlayerType(p.entity_id) === 'group').sort(sortFn) },
                                    { title: 'Lautsprecher', data: sortedPlayers.filter(p => getPlayerType(p.entity_id) === 'speaker').sort(sortFn) },
                                    { title: 'Fernseher', data: sortedPlayers.filter(p => getPlayerType(p.entity_id) === 'tv').sort(sortFn) },
                                ];
                                return sections.map(s => s.data.length === 0 ? null : (
                                    <View key={s.title} style={{ marginBottom: 16 }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>{s.title}</Text>
                                        {s.data.map(item => {
                                            const isSelected = item.entity_id === activePlayer.entity_id;
                                            const isItemPlaying = item.state === 'playing';
                                            const IconComp = getPlayerType(item.entity_id) === 'tv' ? Tv : Speaker;
                                            return (
                                                <Pressable
                                                    key={item.entity_id}
                                                    onPress={() => {
                                                        transferSessionToPlayer(item.entity_id);
                                                        setShowPlayerPicker(false);
                                                    }}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        backgroundColor: isSelected ? 'rgba(59,130,246,0.15)' : '#1E293B',
                                                        borderRadius: 16,
                                                        padding: 14,
                                                        marginBottom: 8,
                                                        borderWidth: 1,
                                                        borderColor: isSelected ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.05)',
                                                        gap: 14,
                                                    }}
                                                >
                                                    <View style={{
                                                        width: 44, height: 44, borderRadius: 14,
                                                        backgroundColor: isSelected ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                                                        alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <IconComp size={22} color={isSelected ? '#FFF' : '#94A3B8'} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: isSelected ? '#60A5FA' : '#E2E8F0', fontSize: 16, fontWeight: isSelected ? '700' : '600' }}>
                                                            {getPlayerName(item.entity_id)}
                                                        </Text>
                                                        {isItemPlaying && <Text style={{ fontSize: 12, color: '#1DB954', marginTop: 2 }}>Spielt gerade</Text>}
                                                    </View>
                                                    {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#60A5FA' }} />}
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                ));
                            })()}
                        </ScrollView>
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
            <Modal animationType="slide" transparent={true} visible={spotifyModalVisible} onRequestClose={() => { setSpotifyModalVisible(false); setPlaylistTracks([]); setSelectedPlaylistItem(null); }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '80%' }]}>
                        {/* Header with Back Button */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                            {selectedPlaylistItem && (
                                <Pressable onPress={() => { setPlaylistTracks([]); setSelectedPlaylistItem(null); }} style={{ marginRight: 12, padding: 4 }}>
                                    <ChevronLeft size={24} color="#94A3B8" />
                                </Pressable>
                            )}
                            <Text style={[styles.modalHeader, { marginBottom: 0, flex: 1 }]}>
                                {selectedPlaylistItem ? selectedPlaylistItem.title : 'Bibliothek'}
                            </Text>
                        </View>

                        {/* Track View */}
                        {selectedPlaylistItem ? (
                            loadingTracks ? <ActivityIndicator color="#1DB954" size="large" /> : (
                                <>
                                    {/* Shuffle Start Button */}
                                    <Pressable
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1DB954', padding: 14, borderRadius: 14, marginBottom: 16, justifyContent: 'center', gap: 8 }}
                                        onPress={() => startPlaylistShuffled(selectedPlaylistItem)}
                                    >
                                        <Shuffle size={20} color="#FFF" />
                                        <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Zufällig abspielen</Text>
                                    </Pressable>
                                    <FlatList
                                        data={playlistTracks}
                                        keyExtractor={(i, idx) => i.media_content_id + idx}
                                        renderItem={({ item, index }) => (
                                            <Pressable style={styles.modalItem} onPress={() => startPlaylistFromTrack(item, selectedPlaylistItem)}>
                                                <Text style={{ color: '#64748B', fontSize: 14, width: 30, textAlign: 'center' }}>{index + 1}</Text>
                                                {item.thumbnail ? (
                                                    <Image source={{ uri: getEntityPictureUrl(item.thumbnail) }} style={{ width: 40, height: 40, borderRadius: 4 }} />
                                                ) : (
                                                    <View style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Music size={18} color="#64748B" />
                                                    </View>
                                                )}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.modalItemText} numberOfLines={1}>{item.title}</Text>
                                                    {item.media_class === 'track' && <Text style={{ color: '#64748B', fontSize: 12 }} numberOfLines={1}>{item.media_content_type?.replace('spotify://', '') || 'Track'}</Text>}
                                                </View>
                                                <Play size={18} color="#94A3B8" />
                                            </Pressable>
                                        )}
                                    />
                                </>
                            )
                        ) : (
                            /* Playlist List */
                            loadingPlaylists ? <ActivityIndicator color="#1DB954" size="large" /> : (
                                <FlatList
                                    data={playlists}
                                    keyExtractor={i => i.media_content_id}
                                    renderItem={({ item }) => (
                                        <Pressable style={styles.modalItem} onPress={() => browsePlaylistTracks(item)}>
                                            <Image source={{ uri: getEntityPictureUrl(item.thumbnail) }} style={{ width: 48, height: 48, borderRadius: 6, marginRight: 4 }} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.modalItemText}>{item.title}</Text>
                                                <Text style={{ color: '#64748B', fontSize: 12 }}>{item.media_content_type?.replace('spotify://', '') || 'Playlist'}</Text>
                                            </View>
                                            <ChevronRight size={20} color="#64748B" />
                                        </Pressable>
                                    )}
                                />
                            )
                        )}
                        <Pressable style={styles.closeButton} onPress={() => { setSpotifyModalVisible(false); setPlaylistTracks([]); setSelectedPlaylistItem(null); }}>
                            <Text style={styles.closeButtonText}>Schließen</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Media Player Selection Modal */}
            <MediaPlayerSelectionModal
                visible={showSelectionModal}
                onClose={() => setShowSelectionModal(false)}
            />
        </View>
    );
}



// --- EXTRACTED COMPONENTS ---

const HeroPlayer = ({ player, massPlayer, imageUrl, massImageUrl, onSelect, onSpotify, onPlayPause, onNext, onPrev, onPower, onVolume, onShuffle, onRepeat, onTuneIn, spotifyActive, getPlayerName }: {
    player: any,
    massPlayer?: any,
    imageUrl?: string,
    massImageUrl?: string,
    onSelect: () => void,
    onSpotify: () => void,
    onPlayPause: (playing: boolean) => void,
    onNext: () => void,
    onPrev: () => void,
    onPower: (on: boolean) => void,
    onVolume: (v: number) => void,
    onShuffle: () => void,
    onRepeat: () => void,
    onTuneIn?: () => void,
    spotifyActive: boolean,
    getPlayerName: (entityId: string) => string
}) => {
    const { colors } = useTheme();
    // Track the last successfully loaded image to prevent flash during transitions
    // Use MASS image as primary source (more stable), falling back to player image
    const effectiveImageUrl = massImageUrl || imageUrl;
    const lastKnownImage = useRef<string | undefined>(effectiveImageUrl);
    const [displayImage, setDisplayImage] = useState<string | undefined>(effectiveImageUrl);
    const hasEverLoadedCover = useRef(!!effectiveImageUrl);

    // When a new image URL arrives and successfully loads, swap the display
    const handleNewImageLoaded = useCallback(() => {
        const url = massImageUrl || imageUrl;
        if (url) {
            setDisplayImage(url);
            lastKnownImage.current = url;
            hasEverLoadedCover.current = true;
        }
    }, [imageUrl, massImageUrl]);

    // If imageUrl goes to undefined (brief gap during track change), keep old image
    useEffect(() => {
        const url = massImageUrl || imageUrl;
        if (!url) return; // never clear
        if (url === displayImage) return; // already showing this
        // New URL arrived — will be preloaded via hidden Image component
    }, [imageUrl, massImageUrl]);

    // The stable display image: prefer current display, fall back to last known
    const stableImage = displayImage || lastKnownImage.current;
    const preloadUrl = (massImageUrl || imageUrl);
    // Once a cover has ever loaded, never show the music note placeholder again
    const showFallbackIcon = !hasEverLoadedCover.current && !stableImage;

    // Optimistic state for shuffle/repeat (immediate visual feedback)
    const [optShuffle, setOptShuffle] = useState(player?.attributes?.shuffle || massPlayer?.attributes?.shuffle || false);
    const [optRepeat, setOptRepeat] = useState(player?.attributes?.repeat || massPlayer?.attributes?.repeat || 'off');
    useEffect(() => {
        const sh = player?.attributes?.shuffle ?? massPlayer?.attributes?.shuffle ?? false;
        const rp = player?.attributes?.repeat || massPlayer?.attributes?.repeat || 'off';
        setOptShuffle(sh);
        setOptRepeat(rp);
    }, [player?.attributes?.shuffle, player?.attributes?.repeat, massPlayer?.attributes?.shuffle, massPlayer?.attributes?.repeat]);

    const isPlaying = player?.state === 'playing';
    const isOff = player?.state === 'off' || player?.state === 'unavailable';
    // Keep last known title during brief track transitions to avoid 'Aus' flash
    const lastTitleRef = useRef(player?.attributes?.media_title || '');
    const currentTitle = player?.attributes?.media_title || massPlayer?.attributes?.media_title || '';
    if (currentTitle) lastTitleRef.current = currentTitle;
    const mediaTitle = currentTitle || lastTitleRef.current || (isOff ? 'Aus' : 'Bereit');
    const artist = player?.attributes?.media_artist || massPlayer?.attributes?.media_artist || '';
    const volume = player?.attributes?.volume_level ?? 0.4;


    // --- Progress Bar: Use MASS player attributes if available (Cast devices often lack these) ---
    const attrs = massPlayer?.attributes || player?.attributes || {};
    const mediaDuration = attrs.media_duration || 0;

    // Detect radio playback — hide shuffle/repeat for radio
    const contentType = player?.attributes?.media_content_type || massPlayer?.attributes?.media_content_type || '';
    const appName = (player?.attributes?.app_name || massPlayer?.attributes?.app_name || '').toLowerCase();
    const contentId = (player?.attributes?.media_content_id || massPlayer?.attributes?.media_content_id || '').toLowerCase();
    const isRadio = contentType === 'channel' || contentType === 'podcast'
        || appName.includes('tunein') || appName.includes('radio')
        || contentId.includes('tunein') || contentId.includes('radio')
        || (isPlaying && mediaDuration === 0);
    const mediaPosition = attrs.media_position || 0;
    const positionUpdatedAt = attrs.media_position_updated_at;
    const [currentPosition, setCurrentPosition] = useState(mediaPosition);

    useEffect(() => {
        setCurrentPosition(mediaPosition);
    }, [mediaPosition, positionUpdatedAt]);

    useEffect(() => {
        if (!isPlaying || !mediaDuration) return;
        let interval: ReturnType<typeof setInterval> | null = null;
        const start = () => {
            interval = setInterval(() => {
                setCurrentPosition((prev: number) => {
                    const next = prev + 1;
                    return next > mediaDuration ? mediaDuration : next;
                });
            }, 1000);
        };
        const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
        start();
        // Battery: pause progress bar timer when app is backgrounded
        const sub = AppState.addEventListener('change', (s) => { s === 'active' ? start() : stop(); });
        return () => { stop(); sub.remove(); };
    }, [isPlaying, mediaDuration, positionUpdatedAt]);

    const progress = mediaDuration > 0 ? Math.min(currentPosition / mediaDuration, 1) : 0;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleShufflePress = () => {
        setOptShuffle(!optShuffle);
        onShuffle();
    };
    const handleRepeatPress = () => {
        const next = optRepeat === 'off' ? 'all' : optRepeat === 'all' ? 'one' : 'off';
        setOptRepeat(next);
        onRepeat();
    };

    if (!player) return null;

    return (
        <View style={[styles.heroContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Background Layer: blurred cover (always show if available) */}
            {stableImage && (
                <Image source={{ uri: stableImage }} style={styles.heroBackground} blurRadius={40} />
            )}
            {/* Hidden preload: new image loads invisibly, then swaps */}
            {preloadUrl && preloadUrl !== displayImage && (
                <Image source={{ uri: preloadUrl }} style={[styles.heroBackground, { opacity: 0 }]} blurRadius={40} onLoad={handleNewImageLoaded} />
            )}
            {!stableImage && (
                <LinearGradient colors={[colors.card, colors.background]} style={styles.heroBackground} />
            )}
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
                <Pressable
                    style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        zIndex: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                    }}
                    onPress={onSelect}
                >
                    <Speaker size={14} color="#CBD5E1" />
                    <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '600' }}>{getPlayerName(player.entity_id)}</Text>
                </Pressable>

                {/* Artwork: always show last known cover, preload new ones */}
                <View style={styles.heroArtworkContainer}>
                    {stableImage ? (
                        <Image source={{ uri: stableImage }} style={styles.heroArtwork} />
                    ) : null}
                    {preloadUrl && preloadUrl !== displayImage ? (
                        <Image source={{ uri: preloadUrl }} style={[styles.heroArtwork, { position: 'absolute', opacity: 0 }]} onLoad={handleNewImageLoaded} />
                    ) : null}
                    {showFallbackIcon && (
                        <View style={[styles.heroArtwork, { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' }]}>
                            <Music size={64} color="#64748B" />
                        </View>
                    )}
                </View>

                {/* Metadata */}
                <View style={styles.heroMeta}>
                    <Text style={styles.heroTitle} numberOfLines={1}>{mediaTitle}</Text>
                    <Text style={styles.heroArtist} numberOfLines={1}>{artist}</Text>
                </View>

                {/* Controls */}
                <View style={styles.heroControls}>
                    {!isRadio && (
                        <Pressable onPress={handleShufflePress} style={styles.controlBtnSmall}>
                            <Shuffle size={22} color={optShuffle ? "#1DB954" : "#64748B"} />
                        </Pressable>
                    )}

                    <Pressable onPress={onPrev}>
                        <SkipBack size={32} color="#FFF" />
                    </Pressable>

                    <Pressable onPress={() => onPlayPause(isPlaying)} style={styles.playBtnLarge}>
                        {isPlaying ? <Pause size={32} color="#000" fill="#000" /> : <Play size={32} color="#000" fill="#000" style={{ marginLeft: 4 }} />}
                    </Pressable>

                    <Pressable onPress={onNext}>
                        <SkipForward size={32} color="#FFF" />
                    </Pressable>

                    {!isRadio && (
                        <Pressable onPress={handleRepeatPress} style={styles.controlBtnSmall}>
                            {optRepeat === 'one' ? (
                                <Repeat1 size={22} color="#1DB954" />
                            ) : (
                                <Repeat size={22} color={optRepeat === 'all' ? "#1DB954" : "#64748B"} />
                            )}
                        </Pressable>
                    )}
                </View>

                {/* Secondary Controls: Power + Spotify + TuneIn */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 8 }}>
                    <Pressable onPress={() => onPower(!isOff)} style={{ padding: 8 }}>
                        <Power size={22} color={!isOff ? "#EF4444" : "#64748B"} />
                    </Pressable>
                    <Pressable onPress={onSpotify} style={{ padding: 8 }}>
                        <Disc size={22} color={spotifyActive ? "#1DB954" : "#64748B"} />
                    </Pressable>
                    <Pressable onPress={() => onTuneIn?.()} style={{ padding: 8 }}>
                        <Radio size={22} color={isRadio ? "#FF6B00" : "#64748B"} />
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

const ExpandedPlayerRow = ({ player, isSelected, imageUrl, onSelect, onSpotify, onPlayPause, onPower, onVolume, onShuffle, onRepeat, spotifyActive, getPlayerName }: {
    player: any,
    isSelected: boolean,
    imageUrl?: string,
    onSelect: () => void,
    onSpotify: () => void,
    onPlayPause: (playing: boolean) => void,
    onPower: (on: boolean) => void,
    onVolume: (v: number) => void,
    onShuffle: () => void,
    onRepeat: () => void,
    spotifyActive: boolean,
    getPlayerName: (entityId: string) => string
}) => {
    const { colors } = useTheme();
    const isOff = player.state === 'off';
    const isPlaying = player.state === 'playing';
    const name = getPlayerName(player.entity_id);
    const volume = player.attributes.volume_level || 0;

    // Optimistic shuffle/repeat state
    const [optShuffle, setOptShuffle] = useState(player?.attributes?.shuffle || false);
    const [optRepeat, setOptRepeat] = useState(player?.attributes?.repeat || 'off');
    useEffect(() => {
        setOptShuffle(player?.attributes?.shuffle || false);
        setOptRepeat(player?.attributes?.repeat || 'off');
    }, [player?.attributes?.shuffle, player?.attributes?.repeat]);

    return (
        <Pressable
            onPress={onSelect}
            style={[styles.expandedPlayer, { backgroundColor: colors.card, borderColor: colors.border }, isSelected && { borderColor: colors.accent, backgroundColor: colors.card }, isOff && { opacity: 0.8 }]}
        >
            <View style={styles.expandedHeader}>
                <View style={[styles.miniIcon, { backgroundColor: colors.background }]}>
                    {imageUrl && !isOff ? (
                        <Text style={{ fontSize: 24, color: colors.accent, lineHeight: 28 }}>+</Text>
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

            {/* Controls Row (Shuffle + Spotify + Volume + Play + Repeat) */}
            <View style={styles.expandedControls}>
                <Pressable onPress={() => { setOptShuffle(!optShuffle); onShuffle(); }} style={styles.iconBtn} disabled={isOff}>
                    <Shuffle size={18} color={optShuffle ? "#1DB954" : "#64748B"} />
                </Pressable>

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

                <Pressable onPress={() => { const next = optRepeat === 'off' ? 'all' : optRepeat === 'all' ? 'one' : 'off'; setOptRepeat(next); onRepeat(); }} style={styles.iconBtn} disabled={isOff}>
                    {optRepeat === 'one' ? (
                        <Repeat1 size={18} color="#1DB954" />
                    ) : (
                        <Repeat size={18} color={optRepeat === 'all' ? "#1DB954" : "#64748B"} />
                    )}
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
    heroContainer: { width: '100%', height: 540, borderRadius: 32, overflow: 'hidden', backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
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

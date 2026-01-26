import React, { useEffect, useState } from 'react';
import { HomeAssistantService } from '../services/homeAssistant';
import { spotifyService } from '../services/spotifyService';

interface MediaBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityId: string;
    haService: HomeAssistantService;
}

interface MediaItem {
    title: string;
    media_content_id: string;
    media_content_type: string;
    media_class: string;
    children_media_class?: string;
    can_play: boolean;
    can_expand: boolean;
    thumbnail?: string;
    children?: MediaItem[];
}

export const MediaBrowserModal: React.FC<MediaBrowserModalProps> = ({ isOpen, onClose, entityId, haService }) => {
    const [history, setHistory] = useState<MediaItem[]>([]); // Navigation stack
    const [currentLevel, setCurrentLevel] = useState<MediaItem | null>(null); // Current folder
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial load
    useEffect(() => {
        if (isOpen && entityId) {
            setHistory([]);
            setError(null);
            loadMedia(); // Load root
        }
    }, [isOpen, entityId]);

    const loadMedia = async (item?: MediaItem) => {
        setLoading(true);
        setError(null);
        try {
            const result = await haService.browseMedia(
                entityId,
                item?.media_content_id,
                item?.media_content_type
            );

            if (result) {
                // Feature: Auto-dive into Spotify if at root
                // If we are loading the root (!item) and we find a Spotify item, load that instead.
                if (!item && result.children) {
                    const spotifyItem = result.children.find((child: MediaItem) =>
                        child.media_content_id?.startsWith('spotify://') ||
                        child.media_content_type?.startsWith('spotify://')
                    );

                    if (spotifyItem) {
                        console.log('🎵 Auto-diving into Spotify:', spotifyItem.title);
                        // Recursively load the spotify item
                        // We do NOT add the root to history, so "Back" will close the modal (or we are at top level)
                        // This gives the "Only Spotify" feeling.
                        loadMedia(spotifyItem);
                        return;
                    }
                }

                // Feature: Filter Spotify Main Menu
                // If this looks like the Spotify main menu (contains "Playlists" AND "Artists"),
                // filter to show only the requested items.
                if (result.children) {
                    const hasPlaylists = result.children.some((c: MediaItem) => c.title === 'Playlists');
                    const hasArtists = result.children.some((c: MediaItem) => c.title === 'Artists');

                    if (hasPlaylists && hasArtists) {
                        const ALLOWED_TITLES = ['Playlists', 'Artists', 'Albums', 'Tracks', 'Podcasts'];
                        result.children = result.children.filter((c: MediaItem) => ALLOWED_TITLES.includes(c.title));
                    }
                }

                setCurrentLevel(result);
            } else {
                // If result is null (handled in haService but returned as null), it means error or empty.
                // However, haService returns null on error. 
                // If result is empty but successful, it returns object with empty children.
                // So null here means unexpected error
                if (!item) { // Only set error if we failed to load ANYTHING (root)
                    setError('Medien konnten nicht geladen werden. Prüfe ob der Player eingeschaltet ist.');
                }
            }
        } catch (error) {
            console.error('Failed to browse media:', error);
            setError('Verbindungsfehler zu Home Assistant');
        }
        setLoading(false);
    };

    // Fallback: Play Spotify via Home Assistant media_player service
    const playViaHomeAssistant = async (spotifyUri: string) => {
        console.log('🏠 Playing via HA media_player on:', entityId, 'URI:', spotifyUri);

        try {
            // Use media_player.play_media service
            await haService.callService('media_player', 'play_media', entityId, {
                media_content_id: spotifyUri,
                media_content_type: 'music'
            });
            console.log('✅ HA playback started on:', entityId);
            onClose();
        } catch (err: any) {
            console.error('❌ HA playback failed:', err);
            setError('Fehler beim Abspielen: ' + (err.message || 'Unbekannt'));
        }
    };

    const handleNavigate = async (item: MediaItem) => {
        console.log('Navigate clicked:', item);
        if (item.can_expand) {
            if (currentLevel) {
                setHistory(prev => [...prev, currentLevel]);
            }
            loadMedia(item);
        } else if (item.can_play) {
            console.log('Playing media:', item.title, item.media_content_id, item.media_content_type);

            let contentId = item.media_content_id;
            let contentType = item.media_content_type;
            let isSpotify = false;
            let spotifyUri = '';

            // Detect Spotify content
            if (contentId && contentId.startsWith('spotify://')) {
                const match = contentId.match(/spotify:(track|album|artist|playlist|show|episode):[a-zA-Z0-9]+/);
                if (match) {
                    spotifyUri = match[0]; // Use Short URI (e.g., spotify:track:xxx)
                    isSpotify = true;
                    console.log('✨ Spotify detected');
                    console.log('URI:', spotifyUri);
                }
            }

            if (isSpotify) {
                // Check if logged into Spotify
                if (!spotifyService.isLoggedIn()) {
                    console.log('🔐 Spotify not logged in - redirecting to login');
                    spotifyService.login();
                    return;
                }

                // Auto-select device based on the current speaker (entityId)
                const speakerName = entityId.replace('media_player.', '').replace(/_/g, ' ').toLowerCase();
                console.log('🔊 Looking for device matching:', speakerName);

                try {
                    const devices = await spotifyService.getDevices();
                    console.log('📱 Available devices:', devices);

                    // Try to find a matching device by name
                    const matchingDevice = devices.find(d =>
                        d.name.toLowerCase().includes(speakerName) ||
                        speakerName.includes(d.name.toLowerCase())
                    );

                    if (matchingDevice) {
                        // Auto-play on the matching device via Spotify API
                        console.log('✅ Found matching device:', matchingDevice.name);
                        await spotifyService.play(spotifyUri, matchingDevice.id);
                        console.log('▶️ Playing on:', matchingDevice.name);
                        onClose();
                    } else {
                        // Device not in Spotify - use Spotcast to wake it up
                        console.log('🏠 Device not in Spotify list - using Spotcast');
                        await playViaHomeAssistant(spotifyUri);
                    }
                } catch (err: any) {
                    console.error('❌ Spotify API failed, trying Home Assistant fallback:', err);
                    // Fall back to Home Assistant on any error
                    await playViaHomeAssistant(spotifyUri);
                }
            } else {
                // Normal playback for non-Spotify content
                haService.playMedia(entityId, contentId, contentType)
                    .then(() => {
                        console.log('Play command sent successfully');
                    })
                    .catch(err => {
                        console.error('Play command failed', err);
                        setError('Fehler beim Abspielen: ' + (err.message || 'Unbekannt'));
                    });
                onClose();
            }
        } else {
            console.warn('Clickable item is neither expandable nor playable:', item);
        }
    };

    const handleBack = () => {
        if (history.length > 0) {
            const prev = history[history.length - 1];
            setHistory(prevHistory => prevHistory.slice(0, -1));
            setCurrentLevel(prev);
            setError(null);
        } else {
            loadMedia();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-[#121212] border border-white/10 w-full max-w-2xl max-h-[80vh] min-h-[400px] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-[#1a1a1a]">
                    {history.length > 0 && (
                        <button
                            onClick={handleBack}
                            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                        >
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                    )}
                    <h2 className="text-xl font-bold flex-1 truncate">
                        {translateTitle(currentLevel?.title || 'Medienbibliothek')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-4"></i>
                            <p>Lade Inhalte...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-400 text-center p-6">
                            <i className="fa-solid fa-circle-exclamation text-4xl mb-4"></i>
                            <p className="font-bold mb-2">Fehler beim Laden</p>
                            <p className="text-sm opacity-80">{error}</p>
                            <button
                                onClick={() => loadMedia()}
                                className="mt-4 px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-sm text-white"
                            >
                                Erneut versuchen
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {currentLevel?.children?.map((child, idx) => {
                                const style = getItemStyle(child);

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleNavigate(child)}
                                        className="flex flex-col text-left group"
                                    >
                                        <div className={`aspect-square rounded-2xl mb-3 overflow-hidden relative shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl border border-white/5 ${style.gradient || 'bg-white/5'}`}>
                                            {child.thumbnail ? (
                                                <img src={child.thumbnail} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                                                    {/* Background Icon Faded */}
                                                    <i className={`fa-solid ${style.icon} text-9xl absolute -bottom-4 -right-4 opacity-10 rotate-[-15deg] transition-transform group-hover:rotate-0`}></i>

                                                    {/* Main Icon */}
                                                    <div className="relative z-10 flex flex-col items-center gap-2">
                                                        <div className={`w-16 h-16 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center ${style.text}`}>
                                                            <i className={`fa-solid ${style.icon} text-3xl`}></i>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {child.can_play && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                                    <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform scale-50 group-hover:scale-100 transition-all">
                                                        <i className="fa-solid fa-play ml-1 text-2xl"></i>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-bold text-sm leading-tight text-gray-200 group-hover:text-white transition-colors line-clamp-2 px-1">
                                            {translateTitle(child.title)}
                                        </span>
                                    </button>
                                );
                            })}
                            {(!currentLevel?.children || currentLevel.children.length === 0) && (
                                <div className="col-span-full text-center py-12 text-gray-500">
                                    <i className="fa-solid fa-folder-open text-4xl mb-3 opacity-30"></i>
                                    <p>Dieser Ordner ist leer</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Translation helper
function translateTitle(title: string): string {
    const translations: Record<string, string> = {
        'Media Library': 'Medienbibliothek',
        'Albums': 'Alben',
        'Artists': 'Künstler',
        'Tracks': 'Titel',
        'Playlists': 'Playlists',
        'Podcasts': 'Podcasts',
        'Local Media': 'Lokale Medien',
        'Radio Browser': 'Radio',
        'Favorites': 'Favoriten'
    };
    return translations[title] || title;
}

function getItemStyle(item: MediaItem): { gradient: string; icon: string; text: string } {
    // Special styles for top-level Spotify folders
    if (item.title === 'Playlists') return {
        gradient: 'bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-purple-500/20 group-hover:border-purple-500/50',
        icon: 'fa-layer-group',
        text: 'text-purple-400'
    };
    if (item.title === 'Artists') return {
        gradient: 'bg-gradient-to-br from-pink-900/40 to-rose-900/40 border-pink-500/20 group-hover:border-pink-500/50',
        icon: 'fa-microphone',
        text: 'text-pink-400'
    };
    if (item.title === 'Albums') return {
        gradient: 'bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border-emerald-500/20 group-hover:border-emerald-500/50',
        icon: 'fa-compact-disc',
        text: 'text-emerald-400'
    };
    if (item.title === 'Tracks' || item.title === 'Lieblingssongs') return {
        gradient: 'bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-blue-500/20 group-hover:border-blue-500/50',
        icon: 'fa-heart',
        text: 'text-blue-400'
    };
    if (item.title === 'Podcasts') return {
        gradient: 'bg-gradient-to-br from-orange-900/40 to-amber-900/40 border-orange-500/20 group-hover:border-orange-500/50',
        icon: 'fa-podcast',
        text: 'text-orange-400'
    };

    // Default map based on media_class
    switch (item.media_class) {
        case 'directory': return { gradient: 'bg-white/5', icon: 'fa-folder', text: 'text-gray-400' };
        case 'album': return { gradient: 'bg-white/5', icon: 'fa-compact-disc', text: 'text-blue-400' };
        case 'artist': return { gradient: 'bg-white/5', icon: 'fa-microphone', text: 'text-pink-400' };
        case 'playlist': return { gradient: 'bg-white/5', icon: 'fa-list-music', text: 'text-purple-400' };
        case 'track': return { gradient: 'bg-white/5', icon: 'fa-music', text: 'text-green-400' };
        case 'tv_show': return { gradient: 'bg-white/5', icon: 'fa-tv', text: 'text-blue-400' };
        case 'episode': return { gradient: 'bg-white/5', icon: 'fa-film', text: 'text-blue-400' };
        case 'movie': return { gradient: 'bg-white/5', icon: 'fa-clapperboard', text: 'text-amber-400' };
        case 'image': return { gradient: 'bg-white/5', icon: 'fa-image', text: 'text-purple-400' };
        case 'url': return { gradient: 'bg-white/5', icon: 'fa-link', text: 'text-blue-400' };
        case 'app': return { gradient: 'bg-white/5', icon: 'fa-gamepad', text: 'text-indigo-400' };
        case 'channel': return { gradient: 'bg-white/5', icon: 'fa-tower-broadcast', text: 'text-teal-400' };
        case 'podcast': return { gradient: 'bg-white/5', icon: 'fa-podcast', text: 'text-orange-400' };
        default: return { gradient: 'bg-white/5', icon: 'fa-folder', text: 'text-gray-400' };
    }
}

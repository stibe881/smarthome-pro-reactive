import React, { useState, useMemo } from 'react';
import { EntityState } from '../types';
import { MediaPlayerCard } from '../components/MediaPlayerCard';
import { MediaBrowserModal } from '../components/MediaBrowserModal';
import { HomeAssistantService } from '../services/homeAssistant';

interface MediaProps {
    entities: EntityState[];
    onMediaControl?: (id: string, action: 'play' | 'pause' | 'play_pause') => void;
    haService: HomeAssistantService;
}

interface MediaGroupProps {
    title: string;
    icon: string;
    players: EntityState[];
    onPlayPause: (id: string) => void;
    onVolumeChange: (id: string, volume: number) => void;
    onSeek: (id: string, position: number) => void;
    onBrowse?: (id: string) => void;
    defaultOpen?: boolean;
}

const MediaGroup: React.FC<MediaGroupProps> = ({
    title,
    icon,
    players,
    onPlayPause,
    onVolumeChange,
    onSeek,
    onBrowse,
    defaultOpen = true
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    if (players.length === 0) return null;

    return (
        <div className="glass-card rounded-3xl overflow-hidden border border-white/10">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <i className={`fa-solid ${icon} text-blue-400`}></i>
                    </div>
                    <span className="font-bold text-lg">{title}</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-xs font-bold text-gray-400">
                        {players.length}
                    </span>
                </div>
                <i className={`fa-solid fa-chevron-down text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>

            <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px]' : 'max-h-0'}`}>
                <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {players.map(player => (
                        <MediaPlayerCard
                            key={player.id}
                            player={player}
                            onPlayPause={onPlayPause}
                            onVolumeChange={onVolumeChange}
                            onSeek={onSeek}
                            onBrowse={onBrowse}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export const Media: React.FC<MediaProps> = ({ entities, onMediaControl, haService }) => {
    const [browserState, setBrowserState] = useState<{ isOpen: boolean; entityId: string }>({
        isOpen: false,
        entityId: ''
    });
    // Configuration: Map Entity IDs to Display Names and Categories
    const PLAYER_CONFIG: Record<string, { name: string; type: 'speaker' | 'group' | 'tv' }> = {
        // Speakers
        'media_player.nest_badezimmer': { name: 'Badezimmer', type: 'speaker' },
        'media_player.nest_buro': { name: 'Büro', type: 'speaker' },
        'media_player.nest_gaste_wc': { name: 'Gäste WC', type: 'speaker' },
        'media_player.kuche': { name: 'Küche', type: 'speaker' },
        'media_player.hub_levin': { name: 'Levins Zimmer', type: 'speaker' },
        'media_player.hub_lina': { name: 'Linas Zimmer', type: 'speaker' },
        'media_player.nest_schlafzimmer': { name: 'Schlafzimmer', type: 'speaker' },
        'media_player.nest_terrasse': { name: 'Terrasse', type: 'speaker' },

        // Groups
        'media_player.wohnung': { name: 'Wohnung', type: 'group' },
        'media_player.haus': { name: 'Haus', type: 'group' },

        // TVs
        'media_player.fernseher_im_wohnzimmer_2': { name: 'Fernseher Wohnzimmer', type: 'tv' },
        'media_player.shield_schlafzimmer': { name: 'Fernseher Schlafzimmer', type: 'tv' }
    };

    // Filter only media_player entities
    const { speakers, groups, tvs, allPlayers } = useMemo(() => {
        const speakers: EntityState[] = [];
        const groups: EntityState[] = [];
        const tvs: EntityState[] = [];
        const all: EntityState[] = [];

        entities.forEach(e => {
            if (e.type !== 'media_player') return;

            const config = PLAYER_CONFIG[e.id];
            if (!config) return;

            // Create a new entity object with the mapped display name
            const mappedEntity = { ...e, name: config.name };

            if (config.type === 'speaker') {
                speakers.push(mappedEntity);
            } else if (config.type === 'group') {
                groups.push(mappedEntity);
            } else if (config.type === 'tv') {
                tvs.push(mappedEntity);
            }
            all.push(mappedEntity);
        });

        // Sort by name for consistent display
        speakers.sort((a, b) => a.name.localeCompare(b.name));
        groups.sort((a, b) => a.name.localeCompare(b.name));
        tvs.sort((a, b) => a.name.localeCompare(b.name));
        all.sort((a, b) => a.name.localeCompare(b.name));

        return { speakers, groups, tvs, allPlayers: all };
    }, [entities]);

    // State for selected player in master player
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);

    // Get the selected player or default to first playing/paused player
    const masterPlayer = useMemo(() => {
        if (selectedPlayerId) {
            return allPlayers.find(p => p.id === selectedPlayerId);
        }
        // Auto-select first playing or paused player
        const playing = allPlayers.find(p => p.state === 'playing');
        if (playing) return playing;

        const paused = allPlayers.find(p => p.state === 'paused');
        if (paused) return paused;

        return allPlayers[0]; // Fallback to first player
    }, [allPlayers, selectedPlayerId]);

    // Debug: Log all attributes to console
    if (masterPlayer) {
        console.log('🎵 Media Player Attributes:', masterPlayer.attributes);
        console.log('📺 Available keys:', Object.keys(masterPlayer.attributes || {}));
    }


    const handlePlayPause = (id: string) => {
        if (onMediaControl) {
            onMediaControl(id, 'play_pause');
        }
    };

    const handleVolumeChange = (id: string, volume: number) => {
        haService.callService('media_player', 'volume_set', id, { volume_level: volume });
    };

    const handleSeek = (id: string, position: number) => {
        haService.callService('media_player', 'media_seek', id, { seek_position: position });
    };

    const handleBrowse = (id: string) => {
        setBrowserState({ isOpen: true, entityId: id });
    };

    if (allPlayers.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <i className="fa-solid fa-music text-6xl text-gray-700 mb-4"></i>
                    <h3 className="text-xl font-bold text-gray-400">Keine Mediaplayer gefunden</h3>
                    <p className="text-sm text-gray-600 mt-2">Verbinden Sie sich mit Home Assistant, um Ihre Mediaplayer zu sehen</p>
                </div>
            </div>
        );
    }

    // Format time (seconds to MM:SS)
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Master Player - Full Width */}
            {masterPlayer && (
                <div className="relative glass-panel rounded-3xl overflow-hidden group min-h-[350px] md:min-h-[450px] flex flex-col justify-end p-6 md:p-12">
                    {/* Background Image */}
                    {masterPlayer.attributes?.entity_picture && (
                        <div className="absolute inset-0 opacity-30 group-hover:scale-105 transition-transform duration-700">
                            <img
                                src={masterPlayer.attributes.entity_picture}
                                className="w-full h-full object-cover blur-md"
                                alt="Background"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                        </div>
                    )}
                    {!masterPlayer.attributes?.entity_picture && (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-950 to-black opacity-50"></div>
                    )}

                    {/* Player Selection Dropdown */}
                    <div className="absolute top-6 right-6 z-20">
                        <div className="relative">
                            <button
                                onClick={() => setShowPlayerDropdown(!showPlayerDropdown)}
                                className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-blue-500/30 transition-all"
                            >
                                <i className="fa-solid fa-tower-broadcast text-blue-500"></i>
                                <span className="text-sm font-bold max-w-[150px] truncate">{masterPlayer.name}</span>
                                <i className={`fa-solid fa-chevron-down text-xs transition-transform ${showPlayerDropdown ? 'rotate-180' : ''}`}></i>
                            </button>

                            {/* Dropdown Menu */}
                            {showPlayerDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                                    <div className="p-2">
                                        <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            Player auswählen ({allPlayers.length})
                                        </div>
                                        {allPlayers.map(player => (
                                            <button
                                                key={player.id}
                                                onClick={() => {
                                                    setSelectedPlayerId(player.id);
                                                    setShowPlayerDropdown(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${player.id === masterPlayer.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-white/5 text-gray-300'
                                                    }`}
                                            >
                                                <i className={`fa-solid ${player.state === 'playing' ? 'fa-play text-green-400' :
                                                    player.state === 'paused' ? 'fa-pause text-yellow-400' :
                                                        'fa-circle text-gray-600'
                                                    } text-sm`}></i>
                                                <span className="flex-1 text-left text-sm font-bold truncate">{player.name}</span>
                                                {player.id === masterPlayer.id && (
                                                    <i className="fa-solid fa-check text-sm"></i>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${masterPlayer.state === 'playing'
                                ? 'bg-green-500 text-black'
                                : masterPlayer.state === 'paused'
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-gray-500 text-black'
                                }`}>
                                {masterPlayer.state === 'playing' ? '● Live Playing' :
                                    masterPlayer.state === 'paused' ? '❚❚ Paused' :
                                        '○ Idle'}
                            </span>
                            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-[10px] font-bold text-blue-300 uppercase tracking-widest">
                                <i className="fa-solid fa-tower-broadcast mr-1.5"></i>
                                {masterPlayer.name}
                            </span>
                        </div>

                        <h2 className="text-3xl md:text-5xl xl:text-6xl font-black tracking-tighter mb-2 md:mb-4">
                            {masterPlayer.attributes?.media_title ||
                                masterPlayer.attributes?.title ||
                                masterPlayer.attributes?.media_series_title ||
                                'Kein Titel'}
                        </h2>

                        {masterPlayer.attributes?.media_artist && (
                            <p className="text-gray-300 text-lg md:text-xl mb-6 md:mb-8 opacity-90">
                                {masterPlayer.attributes.media_artist}
                            </p>
                        )}

                        {/* Progress Bar */}
                        {masterPlayer.attributes?.media_duration && masterPlayer.attributes.media_duration > 0 && (
                            <div className="flex items-center gap-4 md:gap-6">
                                <div className="flex-1 space-y-2">
                                    <div
                                        className="w-full h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer group/progress"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const clickX = e.clientX - rect.left;
                                            const percentage = clickX / rect.width;
                                            const newPosition = (masterPlayer.attributes?.media_duration || 0) * percentage;
                                            handleSeek(masterPlayer.id, newPosition);
                                        }}
                                    >
                                        <div
                                            className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover/progress:bg-blue-400 transition-all"
                                            style={{
                                                width: `${((masterPlayer.attributes?.media_position || 0) / (masterPlayer.attributes?.media_duration || 1)) * 100}%`
                                            }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tabular-nums">
                                        <span>{formatTime(masterPlayer.attributes?.media_position || 0)}</span>
                                        <span>{formatTime(masterPlayer.attributes?.media_duration || 0)}</span>
                                    </div>
                                </div>

                                {/* Play/Pause Button */}
                                <button
                                    onClick={() => handlePlayPause(masterPlayer.id)}
                                    className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-2xl"
                                >
                                    <i className={`fa-solid ${masterPlayer.state === 'playing' ? 'fa-pause' : 'fa-play'
                                        } text-2xl md:text-3xl ${masterPlayer.state === 'playing' ? '' : 'ml-1'}`}></i>
                                </button>
                            </div>
                        )}

                        {/* Browse Button for Master Player */}
                        <div className="mt-6 flex justify-center md:justify-start">
                            <button
                                onClick={() => handleBrowse(masterPlayer.id)}
                                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold text-sm"
                            >
                                <i className="fa-solid fa-folder-open text-blue-400"></i>
                                Medien durchsuchen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Groups */}
            <div className="space-y-6">
                <MediaGroup
                    title="Lautsprecher"
                    icon="fa-speaker-deck"
                    players={speakers}
                    onPlayPause={handlePlayPause}
                    onVolumeChange={handleVolumeChange}
                    onSeek={handleSeek}
                    onBrowse={handleBrowse}
                    defaultOpen={false}
                />

                <MediaGroup
                    title="Gruppen"
                    icon="fa-layer-group"
                    players={groups}
                    onPlayPause={handlePlayPause}
                    onVolumeChange={handleVolumeChange}
                    onSeek={handleSeek}
                    onBrowse={handleBrowse}
                    defaultOpen={false}
                />

                <MediaGroup
                    title="Fernseher"
                    icon="fa-tv"
                    players={tvs}
                    onPlayPause={handlePlayPause}
                    onVolumeChange={handleVolumeChange}
                    onSeek={handleSeek}
                    onBrowse={handleBrowse}
                    defaultOpen={false}
                />
            </div>

            <MediaBrowserModal
                isOpen={browserState.isOpen}
                onClose={() => setBrowserState({ ...browserState, isOpen: false })}
                entityId={browserState.entityId}
                haService={haService}
            />
        </div>
    );
};

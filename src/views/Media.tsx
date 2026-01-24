import React, { useMemo } from 'react';
import { EntityState } from '../types';
import { MediaPlayerCard } from '../components/MediaPlayerCard';

interface MediaProps {
    entities: EntityState[];
}

export const Media: React.FC<MediaProps> = ({ entities }) => {
    // Filter only media_player entities
    const mediaPlayers = useMemo(() => {
        return entities.filter(e => e.type === 'media_player');
    }, [entities]);

    // Find the currently playing or most recently active player for hero section
    const featuredPlayer = useMemo(() => {
        const playing = mediaPlayers.find(p => p.state === 'playing');
        if (playing) return playing;

        const paused = mediaPlayers.find(p => p.state === 'paused');
        if (paused) return paused;

        return mediaPlayers[0]; // Fallback to first player
    }, [mediaPlayers]);

    const handlePlayPause = (id: string) => {
        console.log(`Toggle play/pause for ${id}`);
        // TODO: Call HA service media_player.media_play_pause
    };

    const handleVolumeChange = (id: string, volume: number) => {
        console.log(`Set volume for ${id} to ${volume}`);
        // TODO: Call HA service media_player.volume_set with volume_level
    };

    const handleSeek = (id: string, position: number) => {
        console.log(`Seek ${id} to position ${position}`);
        // TODO: Call HA service media_player.media_seek with seek_position
    };

    if (mediaPlayers.length === 0) {
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

    return (
        <div className="space-y-10 pb-20">
            {/* Hero Section - Featured/Currently Playing */}
            {featuredPlayer && featuredPlayer.state !== 'off' && featuredPlayer.state !== 'unavailable' && (
                <div className="relative glass-panel rounded-3xl overflow-hidden group min-h-[300px] md:min-h-[400px] flex flex-col justify-end p-6 md:p-12">
                    {/* Background Image */}
                    {featuredPlayer.attributes?.entity_picture && (
                        <div className="absolute inset-0 opacity-40 group-hover:scale-105 transition-transform duration-700">
                            <img
                                src={featuredPlayer.attributes.entity_picture}
                                className="w-full h-full object-cover blur-sm"
                                alt="Background"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                        </div>
                    )}
                    {!featuredPlayer.attributes?.entity_picture && (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-950 to-black opacity-50"></div>
                    )}

                    {/* Content */}
                    <div className="relative z-10 w-full lg:w-2/3">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${featuredPlayer.state === 'playing'
                                    ? 'bg-green-500 text-black'
                                    : 'bg-yellow-500 text-black'
                                }`}>
                                {featuredPlayer.state === 'playing' ? '● Live Playing' : '❚❚ Paused'}
                            </span>
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-gray-300 uppercase tracking-wide">
                                {featuredPlayer.name}
                            </span>
                        </div>

                        <h2 className="text-3xl md:text-5xl xl:text-6xl font-black tracking-tighter mb-2 md:mb-4">
                            {featuredPlayer.attributes?.media_title || 'Kein Titel'}
                        </h2>

                        {featuredPlayer.attributes?.media_artist && (
                            <p className="text-gray-300 text-lg md:text-xl mb-6 md:mb-8 opacity-90">
                                {featuredPlayer.attributes.media_artist}
                            </p>
                        )}

                        {/* Progress Bar */}
                        {featuredPlayer.attributes?.media_duration && (
                            <div className="flex items-center gap-4 md:gap-6">
                                <div className="flex-1 space-y-2">
                                    <div
                                        className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const clickX = e.clientX - rect.left;
                                            const percentage = clickX / rect.width;
                                            const newPosition = (featuredPlayer.attributes?.media_duration || 0) * percentage;
                                            handleSeek(featuredPlayer.id, newPosition);
                                        }}
                                    >
                                        <div
                                            className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                            style={{
                                                width: `${((featuredPlayer.attributes?.media_position || 0) / (featuredPlayer.attributes?.media_duration || 1)) * 100}%`
                                            }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tabular-nums">
                                        <span>
                                            {Math.floor((featuredPlayer.attributes?.media_position || 0) / 60)}:{String(Math.floor((featuredPlayer.attributes?.media_position || 0) % 60)).padStart(2, '0')}
                                        </span>
                                        <span>
                                            {Math.floor((featuredPlayer.attributes?.media_duration || 0) / 60)}:{String(Math.floor((featuredPlayer.attributes?.media_duration || 0) % 60)).padStart(2, '0')}
                                        </span>
                                    </div>
                                </div>

                                {/* Play/Pause Button */}
                                <button
                                    onClick={() => handlePlayPause(featuredPlayer.id)}
                                    className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-2xl"
                                >
                                    <i className={`fa-solid ${featuredPlayer.state === 'playing' ? 'fa-pause' : 'fa-play'
                                        } text-xl md:text-2xl`}></i>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Media Player Cards Grid */}
            <div>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <i className="fa-solid fa-music text-blue-500"></i>
                    Alle Medienplayer
                    <span className="text-sm font-normal text-gray-500">({mediaPlayers.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {mediaPlayers.map(player => (
                        <MediaPlayerCard
                            key={player.id}
                            player={player}
                            onPlayPause={handlePlayPause}
                            onVolumeChange={handleVolumeChange}
                            onSeek={handleSeek}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

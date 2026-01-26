import React, { useState, useEffect } from 'react';
import { EntityState } from '../types';

interface MediaPlayerCardProps {
    player: EntityState;
    onPlayPause: (id: string) => void;
    onVolumeChange: (id: string, volume: number) => void;
    onSeek: (id: string, position: number) => void;
    onBrowse?: (id: string) => void;
}

export const MediaPlayerCard: React.FC<MediaPlayerCardProps> = ({ player, onPlayPause, onVolumeChange, onSeek, onBrowse }) => {
    const [showVolume, setShowVolume] = useState(false);

    // Volume State Management
    const serverVolume = player.attributes?.volume_level != null
        ? Math.round(player.attributes.volume_level * 100)
        : undefined;

    // Local volume state (optimistic)
    const [localVolume, setLocalVolume] = useState(serverVolume ?? 0);
    const [isDragging, setIsDragging] = useState(false);

    // Sync with server only if not dragging and server has value
    useEffect(() => {
        if (!isDragging && serverVolume !== undefined) {
            setLocalVolume(serverVolume);
        }
    }, [serverVolume, isDragging]);

    const handleVolumeChange = (newVal: number) => {
        setLocalVolume(newVal);
        // Debouncing could be added here if needed, but simple throttle is usually fine
        onVolumeChange(player.id, newVal / 100);
    };

    const isPlaying = player.state === 'playing';
    const isPaused = player.state === 'paused';
    const isIdle = player.state === 'idle' || player.state === 'off';

    const mediaTitle = player.attributes?.media_title || 'No Media';
    const mediaArtist = player.attributes?.media_artist || '';
    const mediaDuration = player.attributes?.media_duration || 0;
    const mediaPosition = player.attributes?.media_position || 0;
    const mediaContentType = player.attributes?.media_content_type || '';
    const entityPicture = player.attributes?.entity_picture;

    // Calculate progress percentage
    const progress = mediaDuration > 0 ? (mediaPosition / mediaDuration) * 100 : 0;

    // Format time (seconds to MM:SS)
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Get appropriate icon based on content type
    const getContentIcon = () => {
        if (mediaContentType?.includes('music')) return 'fa-music';
        if (mediaContentType?.includes('tvshow') || mediaContentType?.includes('movie')) return 'fa-tv';
        if (mediaContentType?.includes('podcast')) return 'fa-podcast';
        return 'fa-play-circle';
    };

    return (
        <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col gap-4 hover:border-blue-500/30 transition-all group">
            {/* Header with Album Art or Icon */}
            <div className="flex gap-4">
                {entityPicture ? (
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                        <img
                            src={entityPicture}
                            className="w-full h-full object-cover"
                            alt={mediaTitle}
                        />
                    </div>
                ) : (
                    <div className="w-20 h-20 rounded-xl bg-white/5 flex-shrink-0 flex items-center justify-center">
                        <i className={`fa-solid ${getContentIcon()} text-3xl text-blue-500/50`}></i>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-base leading-tight truncate">{player.name}</h4>
                    <p className="text-gray-400 text-sm truncate mt-1">{mediaTitle}</p>
                    {mediaArtist && (
                        <p className="text-gray-500 text-xs truncate">{mediaArtist}</p>
                    )}
                    <div className="mt-2">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${isPlaying ? 'text-green-400 bg-green-400/10' :
                            isPaused ? 'text-yellow-400 bg-yellow-400/10' :
                                'text-gray-500 bg-gray-500/10'
                            }`}>
                            {isPlaying ? '● Spielt' : isPaused ? '❚❚ Pausiert' : '○ Bereit'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Progress Bar (only if media is loaded) */}
            {mediaDuration > 0 && (
                <div className="space-y-1">
                    <div
                        className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percentage = clickX / rect.width;
                            const newPosition = mediaDuration * percentage;
                            onSeek(player.id, newPosition);
                        }}
                    >
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                        <span>{formatTime(mediaPosition)}</span>
                        <span>{formatTime(mediaDuration)}</span>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between gap-3">
                {/* Volume Control */}
                <div className="relative flex items-center gap-2">
                    <button
                        onClick={() => setShowVolume(!showVolume)}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-95"
                        title={`Volume: ${localVolume}%`}
                    >
                        <i className={`fa-solid ${localVolume === 0 ? 'fa-volume-xmark' :
                            localVolume < 50 ? 'fa-volume-low' :
                                'fa-volume-high'
                            } text-sm`}></i>
                    </button>

                    {showVolume && (
                        <div className="absolute left-12 bottom-0 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl z-10">
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={localVolume}
                                    onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                                    onMouseDown={() => setIsDragging(true)}
                                    onMouseUp={() => setIsDragging(false)}
                                    onTouchStart={() => setIsDragging(true)}
                                    onTouchEnd={() => setIsDragging(false)}
                                    className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${localVolume}%, rgba(255,255,255,0.2) ${localVolume}%, rgba(255,255,255,0.2) 100%)`
                                    }}
                                />
                                <span className="text-xs font-bold w-8 text-right">{localVolume}%</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Play/Pause Button */}
                <button
                    onClick={() => onPlayPause(player.id)}
                    disabled={isIdle}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isIdle
                        ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-lg shadow-blue-600/20'
                        }`}
                >
                    <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-lg`}></i>
                </button>

                {/* Additional Controls */}
                <div className="flex gap-2">
                    <button
                        onClick={() => onBrowse?.(player.id)}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-95"
                        title="Medien durchsuchen"
                    >
                        <i className="fa-solid fa-folder-open text-sm text-blue-400"></i>
                    </button>
                    <button
                        disabled={isIdle}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => {/* Previous track - implement if supported */ }}
                    >
                        <i className="fa-solid fa-backward text-sm"></i>
                    </button>
                    <button
                        disabled={isIdle}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => {/* Next track - implement if supported */ }}
                    >
                        <i className="fa-solid fa-forward text-sm"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

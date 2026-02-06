import React from 'react';
import { EntityState } from '../types';

interface CoversControlProps {
    covers: EntityState[];
    onOpen: (id: string) => void;
    onClose: (id: string) => void;
    onSetPosition?: (id: string, position: number) => void;
    onSetTilt?: (id: string, tilt: number) => void;
    onTriggerMyPosition?: (id: string) => void;
}

export const CoversControl: React.FC<CoversControlProps> = ({
    covers,
    onOpen,
    onClose,
    onSetPosition,
    onSetTilt,
    onTriggerMyPosition
}) => {
    const handlePositionChange = (id: string, value: string) => {
        if (onSetPosition) {
            onSetPosition(id, parseInt(value));
        }
    };

    const getStateIcon = (state: string) => {
        switch (state) {
            case 'open': return 'fa-arrow-up';
            case 'closed': return 'fa-arrow-down';
            case 'opening': return 'fa-spinner fa-spin';
            case 'closing': return 'fa-spinner fa-spin';
            default: return 'fa-window-shutter';
        }
    };

    const getStateColor = (state: string) => {
        switch (state) {
            case 'open': return 'text-blue-400';
            case 'closed': return 'text-gray-600';
            case 'opening': return 'text-blue-400 animate-pulse';
            case 'closing': return 'text-gray-400 animate-pulse';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-2xl font-bold">🪟 Storen & Rolläden</h3>
                    <p className="text-sm text-gray-400 mt-1">
                        {covers.filter(c => c.state === 'open').length} von {covers.length} offen
                    </p>
                </div>
            </div>

            {covers.length === 0 ? (
                <div className="glass-card p-8 rounded-3xl text-center">
                    <i className="fa-solid fa-window-shutter text-4xl text-gray-600 mb-3"></i>
                    <p className="text-gray-500">Keine Storen gefunden</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {covers.map(cover => (
                        <div
                            key={cover.id}
                            className="glass-card p-5 rounded-2xl hover:scale-[1.02] transition-transform"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <i className={`fa-solid ${getStateIcon(String(cover.state))} text-xl ${getStateColor(String(cover.state))}`}></i>
                                    <div>
                                        <p className="font-bold text-lg">{cover.name}</p>
                                        <p className="text-xs text-gray-500 capitalize">
                                            {cover.room || 'Kein Raum'} • {cover.state === 'open' ? 'Offen' : cover.state === 'closed' ? 'Geschlossen' : cover.state}
                                        </p>
                                    </div>
                                </div>

                                {/* Position Badge */}
                                {cover.position !== undefined && (
                                    <div className="glass-card px-3 py-1 rounded-full">
                                        <span className="text-sm font-bold text-blue-400">
                                            {cover.position}%
                                        </span>
                                    </div>
                                )}

                                {/* My Position Button */}
                                {onTriggerMyPosition && (
                                    <button
                                        onClick={() => onTriggerMyPosition(cover.id)}
                                        className="glass-card w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-amber-500 bg-amber-500/10 border-amber-500/20"
                                        title="My Position"
                                    >
                                        <i className="fa-solid fa-star"></i>
                                    </button>
                                )}
                            </div>

                            {/* Control Buttons */}
                            <div className="flex gap-3 mb-4">
                                <button
                                    onClick={() => onOpen(cover.id)}
                                    disabled={cover.state === 'opening' || cover.state === 'open'}
                                    className="
                                        flex-1 glass-card p-3 rounded-xl font-bold
                                        hover:scale-105 active:scale-95 transition-all
                                        bg-gradient-to-r from-blue-500/20 to-cyan-500/20
                                        hover:from-blue-500/30 hover:to-cyan-500/30
                                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                                    "
                                >
                                    <i className="fa-solid fa-arrow-up mr-2"></i>
                                    Öffnen
                                </button>
                                <button
                                    onClick={() => onClose(cover.id)}
                                    disabled={cover.state === 'closing' || cover.state === 'closed'}
                                    className="
                                        flex-1 glass-card p-3 rounded-xl font-bold
                                        hover:scale-105 active:scale-95 transition-all
                                        bg-gradient-to-r from-gray-500/20 to-gray-700/20
                                        hover:from-gray-500/30 hover:to-gray-700/30
                                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                                    "
                                >
                                    <i className="fa-solid fa-arrow-down mr-2"></i>
                                    Schließen
                                </button>
                            </div>

                            {/* Tilt Buttons */}
                            {onSetTilt && (
                                <div className="flex gap-3 mb-4">
                                    <button
                                        onClick={() => onSetTilt(cover.id, 50)}
                                        className="
                                            flex-1 glass-card p-2 rounded-xl text-sm font-bold
                                            hover:scale-105 active:scale-95 transition-all
                                            bg-gradient-to-r from-amber-500/20 to-orange-500/20
                                            hover:from-amber-500/30 hover:to-orange-500/30
                                        "
                                    >
                                        <i className="fa-solid fa-angles-up mr-2 text-amber-400"></i>
                                        Schräg auf
                                    </button>
                                    <button
                                        onClick={() => onSetTilt(cover.id, 10)}
                                        className="
                                            flex-1 glass-card p-2 rounded-xl text-sm font-bold
                                            hover:scale-105 active:scale-95 transition-all
                                            bg-gradient-to-r from-teal-500/20 to-emerald-500/20
                                            hover:from-teal-500/30 hover:to-emerald-500/30
                                        "
                                    >
                                        <i className="fa-solid fa-angles-down mr-2 text-teal-400"></i>
                                        Schräg zu
                                    </button>
                                </div>
                            )}

                            {/* Position Slider */}
                            {onSetPosition && (
                                <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-400">Position</span>
                                        <span className="text-xs font-bold text-blue-400">
                                            {cover.position || 0}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={cover.position || 0}
                                        onChange={(e) => handlePositionChange(cover.id, e.target.value)}
                                        className="
                                            w-full h-2 rounded-full appearance-none cursor-pointer
                                            bg-gradient-to-r from-gray-700 to-blue-500
                                            [&::-webkit-slider-thumb]:appearance-none
                                            [&::-webkit-slider-thumb]:w-4
                                            [&::-webkit-slider-thumb]:h-4
                                            [&::-webkit-slider-thumb]:rounded-full
                                            [&::-webkit-slider-thumb]:bg-white
                                            [&::-webkit-slider-thumb]:shadow-lg
                                            [&::-webkit-slider-thumb]:cursor-pointer
                                            [&::-webkit-slider-thumb]:hover:scale-110
                                            [&::-webkit-slider-thumb]:transition-transform
                                            [&::-moz-range-thumb]:w-4
                                            [&::-moz-range-thumb]:h-4
                                            [&::-moz-range-thumb]:rounded-full
                                            [&::-moz-range-thumb]:bg-white
                                            [&::-moz-range-thumb]:shadow-lg
                                            [&::-moz-range-thumb]:cursor-pointer
                                            [&::-moz-range-thumb]:border-0
                                            [&::-moz-range-thumb]:hover:scale-110
                                            [&::-moz-range-thumb]:transition-transform
                                        "
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Actions Footer */}
            {covers.length > 0 && (
                <div className="flex gap-3 pt-4">
                    <button
                        onClick={() => covers.forEach(c => onOpen(c.id))}
                        className="flex-1 glass-card p-4 rounded-2xl font-bold hover:scale-105 transition-transform
                                 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30"
                    >
                        <i className="fa-solid fa-arrow-up mr-2"></i>
                        Alle Öffnen
                    </button>
                    <button
                        onClick={() => covers.forEach(c => onClose(c.id))}
                        className="flex-1 glass-card p-4 rounded-2xl font-bold hover:scale-105 transition-transform
                                 bg-gradient-to-r from-gray-500/20 to-gray-700/20 hover:from-gray-500/30 hover:to-gray-700/30"
                    >
                        <i className="fa-solid fa-arrow-down mr-2"></i>
                        Alle Schließen
                    </button>
                </div>
            )}
        </div>
    );
};

import React from 'react';
import { EntityState } from '../types';

interface LightsControlProps {
    lights: EntityState[];
    onToggle: (id: string) => void;
    onBrightnessChange?: (id: string, brightness: number) => void;
}

export const LightsControl: React.FC<LightsControlProps> = ({
    lights,
    onToggle,
    onBrightnessChange
}) => {
    const handleBrightnessChange = (id: string, value: string) => {
        if (onBrightnessChange) {
            onBrightnessChange(id, parseInt(value));
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-2xl font-bold">💡 Lichter</h3>
                    <p className="text-sm text-gray-400 mt-1">
                        {lights.filter(l => l.state === 'on').length} von {lights.length} an
                    </p>
                </div>
            </div>

            {lights.length === 0 ? (
                <div className="glass-card p-8 rounded-3xl text-center">
                    <i className="fa-solid fa-lightbulb text-4xl text-gray-600 mb-3"></i>
                    <p className="text-gray-500">Keine Lichter gefunden</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {lights.map(light => (
                        <div
                            key={light.id}
                            className="glass-card p-5 rounded-2xl hover:scale-[1.02] transition-transform"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <i className={`fa-solid fa-lightbulb text-xl ${light.state === 'on'
                                            ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                                            : 'text-gray-600'
                                        }`}></i>
                                    <div>
                                        <p className="font-bold text-lg">{light.name}</p>
                                        <p className="text-xs text-gray-500 capitalize">
                                            {light.room || 'Kein Raum'}
                                        </p>
                                    </div>
                                </div>

                                {/* Toggle Switch */}
                                <button
                                    onClick={() => onToggle(light.id)}
                                    className={`
                                        relative w-14 h-7 rounded-full transition-all duration-300
                                        ${light.state === 'on'
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                                            : 'bg-gray-700'
                                        }
                                    `}
                                >
                                    <div className={`
                                        absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg
                                        transition-transform duration-300
                                        ${light.state === 'on' ? 'translate-x-8' : 'translate-x-1'}
                                    `}></div>
                                </button>
                            </div>

                            {/* Brightness Slider (only when light is on) */}
                            {light.state === 'on' && onBrightnessChange && (
                                <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-400">Helligkeit</span>
                                        <span className="text-xs font-bold text-amber-400">
                                            {light.brightness || 100}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={light.brightness || 100}
                                        onChange={(e) => handleBrightnessChange(light.id, e.target.value)}
                                        className="
                                            w-full h-2 rounded-full appearance-none cursor-pointer
                                            bg-gradient-to-r from-gray-700 to-amber-500
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
            {lights.length > 0 && (
                <div className="flex gap-3 pt-4">
                    <button
                        onClick={() => lights.forEach(l => l.state === 'off' && onToggle(l.id))}
                        className="flex-1 glass-card p-4 rounded-2xl font-bold hover:scale-105 transition-transform
                                 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30"
                    >
                        <i className="fa-solid fa-sun mr-2"></i>
                        Alle An
                    </button>
                    <button
                        onClick={() => lights.forEach(l => l.state === 'on' && onToggle(l.id))}
                        className="flex-1 glass-card p-4 rounded-2xl font-bold hover:scale-105 transition-transform
                                 bg-gradient-to-r from-gray-500/20 to-gray-700/20 hover:from-gray-500/30 hover:to-gray-700/30"
                    >
                        <i className="fa-solid fa-moon mr-2"></i>
                        Alle Aus
                    </button>
                </div>
            )}
        </div>
    );
};

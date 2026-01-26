import React from 'react';
import { EntityState } from '../types';

interface LightsControlProps {
    lights: EntityState[];
    onToggle: (id: string) => void;
    onBrightnessChange?: (id: string, brightness: number) => void;
    onColorChange?: (id: string, color: string) => void;
    onTempChange?: (id: string, temp: number) => void;
}

export const LightsControl: React.FC<LightsControlProps> = ({
    lights,
    onToggle,
    onBrightnessChange,
    onColorChange,
    onTempChange
}) => {
    // Strict whitelist configuration
    const LIGHT_CONFIG: Record<string, string> = {
        'light.wohnzimmer': 'Wohnzimmer',
        'light.essbereich': 'Essbereich',
        'light.kuche': 'Küche',
        'light.linas_zimmer': 'Linas Zimmer',
        'light.levins_zimmer': 'Levins Zimmer',
        'light.schlafzimmer': 'Schlafzimmer',
        'light.badezimmer': 'Badezimmer',
        'light.licht_garage': 'Gäste WC',
        'light.deckenbeleuchtung_buro': 'Büro'
    };

    const filteredLights = lights
        .filter(l => Object.keys(LIGHT_CONFIG).includes(l.id))
        .map(l => ({ ...l, name: LIGHT_CONFIG[l.id] }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-2xl font-bold">💡 Lichter</h3>
                    <p className="text-sm text-gray-400 mt-1">
                        {filteredLights.filter(l => l.state === 'on').length} von {filteredLights.length} an
                    </p>
                </div>
            </div>

            {filteredLights.length === 0 ? (
                <div className="glass-card p-8 rounded-3xl text-center">
                    <i className="fa-solid fa-lightbulb text-4xl text-gray-600 mb-3"></i>
                    <p className="text-gray-500">Keine Lichter gefunden</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredLights.map(light => (
                        <LightControlItem
                            key={light.id}
                            light={light}
                            onToggle={onToggle}
                            onBrightnessChange={onBrightnessChange}
                            onColorChange={onColorChange}
                            onTempChange={onTempChange}
                        />
                    ))}
                </div>
            )}

            {/* Quick Actions Footer */}
            {filteredLights.length > 0 && (
                <div className="flex gap-3 pt-4">
                    <button
                        onClick={() => filteredLights.forEach(l => l.state === 'off' && onToggle(l.id))}
                        className="flex-1 glass-card p-4 rounded-2xl font-bold hover:scale-105 transition-transform
                                 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30"
                    >
                        <i className="fa-solid fa-sun mr-2"></i>
                        Alle An
                    </button>
                    <button
                        onClick={() => filteredLights.forEach(l => l.state === 'on' && onToggle(l.id))}
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

export interface LightControlItemProps {
    light: EntityState & { name: string };
    onToggle: (id: string) => void;
    onBrightnessChange?: (id: string, brightness: number) => void;
    onColorChange?: (id: string, color: string) => void;
    onTempChange?: (id: string, temp: number) => void;
}

export const LightControlItem: React.FC<LightControlItemProps> = ({
    light,
    onToggle,
    onBrightnessChange,
    onColorChange,
    onTempChange
}) => {
    // Local state for smooth sliding
    // We initialize with the prop value (normalized to 0-100)
    const normalizeBrightness = (val: number | undefined) => Math.round(((val || 0) / 255) * 100);

    const [localBrightness, setLocalBrightness] = React.useState(normalizeBrightness(light.attributes?.brightness));
    const [localTemp, setLocalTemp] = React.useState(light.attributes?.color_temp || 300);

    // Interaction lock to prevent prop updates from interrupting sliding
    const isDragging = React.useRef(false);
    // Timestamp of last user interaction to ignore "echo" updates while light transitions
    const lastInteraction = React.useRef(0);

    // Sync local state when prop changes externally
    React.useEffect(() => {
        const isInteracting = isDragging.current || (Date.now() - lastInteraction.current < 3000);

        if (!isInteracting) {
            const newVal = normalizeBrightness(light.attributes?.brightness);
            if (Math.abs(newVal - localBrightness) > 1) {
                setLocalBrightness(newVal);
            }
        }
    }, [light.attributes?.brightness]);

    React.useEffect(() => {
        const isInteracting = isDragging.current || (Date.now() - lastInteraction.current < 3000);

        if (!isInteracting && light.attributes?.color_temp) {
            setLocalTemp(light.attributes.color_temp);
        }
    }, [light.attributes?.color_temp]);

    const handleBrightnessChange = (value: string) => {
        const val = parseInt(value);
        lastInteraction.current = Date.now();
        setLocalBrightness(val); // Update UI immediately
        if (onBrightnessChange) onBrightnessChange(light.id, val);
    };

    const handleTempChange = (value: string) => {
        const val = parseInt(value);
        lastInteraction.current = Date.now();
        setLocalTemp(val); // Update UI immediately
        if (onTempChange) onTempChange(light.id, val);
    };

    const handleDragStart = () => {
        isDragging.current = true;
        lastInteraction.current = Date.now();
    };

    const handleDragEnd = () => {
        isDragging.current = false;
        lastInteraction.current = Date.now();
    };

    return (
        <div className="glass-card p-5 rounded-2xl hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <i className={`fa-solid fa-lightbulb text-xl ${light.state === 'on'
                        ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                        : 'text-gray-600'
                        }`}></i>
                    <div>
                        <p className="font-bold text-lg">{light.name}</p>
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

            {/* Controls (only when light is on) */}
            {light.state === 'on' && (
                <div className="space-y-4 mt-4">
                    {/* Brightness */}
                    {onBrightnessChange && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-400">Helligkeit</span>
                                <span className="text-xs font-bold text-amber-400">
                                    {localBrightness}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={localBrightness}
                                onInput={(e) => handleBrightnessChange((e.target as HTMLInputElement).value)}
                                onPointerDown={handleDragStart}
                                onPointerUp={handleDragEnd}
                                onTouchStart={handleDragStart}
                                onTouchEnd={handleDragEnd}
                                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-700 accent-amber-500"
                            />
                        </div>
                    )}

                    {/* Color Temperature */}
                    {onTempChange && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-400">Weißton</span>
                            </div>
                            <input
                                type="range"
                                min="150"
                                max="500"
                                value={localTemp}
                                onInput={(e) => handleTempChange((e.target as HTMLInputElement).value)}
                                onPointerDown={handleDragStart}
                                onPointerUp={handleDragEnd}
                                onTouchStart={handleDragStart}
                                onTouchEnd={handleDragEnd}
                                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-blue-200 via-white to-amber-200 accent-white"
                            />
                        </div>
                    )}

                    {/* RGB Color */}
                    {onColorChange && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-400">Farbe</span>
                            </div>
                            <div className="flex gap-2">
                                {['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ffffff'].map(color => (
                                    <button
                                        key={color}
                                        className="w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                        onClick={() => onColorChange(light.id, color)}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={(() => {
                                        const rgb = light.attributes?.rgb_color;
                                        if (Array.isArray(rgb) && rgb.length === 3) {
                                            return `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`;
                                        }
                                        return '#ffffff';
                                    })()}
                                    onChange={(e) => onColorChange(light.id, e.target.value)}
                                    className="w-8 h-8 rounded-full overflow-hidden border-0 p-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

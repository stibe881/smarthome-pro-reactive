import React, { useState } from 'react';

interface VacuumRoom {
    id: string;
    name: string;
    icon: string;
}

interface VacuumControlProps {
    state: 'cleaning' | 'docked' | 'paused' | 'returning';
    battery: number;
    mapUrl?: string;
    onCleanRoom: (roomId: string) => void;
    onStartCleaning: () => void;
    onPause: () => void;
    onReturn: () => void;
}

const VACUUM_ROOMS: VacuumRoom[] = [
    { id: '1', name: 'Bad', icon: 'fa-bath' },
    { id: '2', name: 'Gäste WC', icon: 'fa-toilet' },
    { id: '3', name: 'Wohnzimmer', icon: 'fa-couch' },
    { id: '4', name: 'Reduit', icon: 'fa-broom' },
    { id: '5', name: 'Büro', icon: 'fa-desktop' },
    { id: '6', name: 'Küche', icon: 'fa-utensils' },
    { id: '7', name: 'Schlafzimmer', icon: 'fa-bed' },
    { id: '8', name: 'Vorraum', icon: 'fa-cube' },
    { id: '9', name: 'Levin', icon: 'fa-child' },
    { id: '10', name: 'Lina', icon: 'fa-baby' },
    { id: '11', name: 'Essen', icon: 'fa-plate-wheat' },
    { id: '12', name: 'Eingang', icon: 'fa-door-open' },
    { id: '13', name: 'Gang', icon: 'fa-arrows-left-right' },
];

export const VacuumControl: React.FC<VacuumControlProps> = ({
    state,
    battery,
    mapUrl,
    onCleanRoom,
    onStartCleaning,
    onPause,
    onReturn,
}) => {
    const [selectedRooms, setSelectedRooms] = useState<string[]>([]);

    const toggleRoom = (roomId: string) => {
        setSelectedRooms(prev =>
            prev.includes(roomId)
                ? prev.filter(id => id !== roomId)
                : [...prev, roomId]
        );
    };

    const cleanSelectedRooms = () => {
        selectedRooms.forEach(roomId => onCleanRoom(roomId));
        setSelectedRooms([]);
    };

    const stateConfig = {
        cleaning: { label: 'Am Saugen', color: 'green', icon: 'fa-broom' },
        docked: { label: 'Gedockt', color: 'blue', icon: 'fa-charging-station' },
        paused: { label: 'Pausiert', color: 'yellow', icon: 'fa-pause' },
        returning: { label: 'Kehrt zurück', color: 'cyan', icon: 'fa-arrow-left' },
    };

    const config = stateConfig[state];
    const isCleaning = state === 'cleaning';

    return (
        <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-${config.color}-500/20 flex items-center justify-center`}>
                        <i className={`fa-solid ${config.icon} text-${config.color}-400 text-xl ${isCleaning ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">🤖 Röbi Staubsauger</h3>
                        <p className={`text-sm font-semibold text-${config.color}-400`}>{config.label}</p>
                    </div>
                </div>

                {/* Battery */}
                <div className="flex items-center gap-2">
                    <i className={`fa-solid fa-battery-${battery > 75 ? 'full' : battery > 50 ? 'three-quarters' : battery > 25 ? 'half' : 'quarter'} text-gray-400`} />
                    <span className="text-sm font-bold text-gray-400">{battery}%</span>
                </div>
            </div>

            {/* Map (if available) */}
            {mapUrl && (
                <div className="aspect-square bg-black/30 rounded-2xl overflow-hidden border border-white/5">
                    <img
                        src={mapUrl}
                        alt="Vacuum Map"
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            {/* Control Buttons */}
            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={onStartCleaning}
                    disabled={isCleaning}
                    className="btn-gradient p-3 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <i className="fa-solid fa-play mr-2" />
                    Start
                </button>
                <button
                    onClick={onPause}
                    disabled={state !== 'cleaning'}
                    className="glass-panel p-3 rounded-xl text-sm font-bold border border-white/10 hover:bg-white/5 disabled:opacity-50"
                >
                    <i className="fa-solid fa-pause mr-2" />
                    Pause
                </button>
                <button
                    onClick={onReturn}
                    disabled={state === 'docked'}
                    className="glass-panel p-3 rounded-xl text-sm font-bold border border-white/10 hover:bg-white/5 disabled:opacity-50"
                >
                    <i className="fa-solid fa-home mr-2" />
                    Dock
                </button>
            </div>

            {/* Room Selection */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Räume auswählen</p>
                    {selectedRooms.length > 0 && (
                        <button
                            onClick={cleanSelectedRooms}
                            className="text-xs font-bold text-green-400 hover:text-green-300 px-3 py-1 bg-green-500/10 rounded-full"
                        >
                            {selectedRooms.length} Raum{selectedRooms.length > 1 ? 'e' : ''} saugen
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto no-scrollbar">
                    {VACUUM_ROOMS.map(room => (
                        <button
                            key={room.id}
                            onClick={() => toggleRoom(room.id)}
                            className={`
                p-3 rounded-xl border transition-all text-center
                ${selectedRooms.includes(room.id)
                                    ? 'bg-green-500/20 border-green-500/50 ring-2 ring-green-500/30'
                                    : 'glass-panel border-white/10 hover:border-white/20'
                                }
              `}
                        >
                            <i className={`fa-solid ${room.icon} text-lg mb-1 ${selectedRooms.includes(room.id) ? 'text-green-400' : 'text-gray-400'
                                }`} />
                            <p className="text-[10px] font-bold truncate">{room.name}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

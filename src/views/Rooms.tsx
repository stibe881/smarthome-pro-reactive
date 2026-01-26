import React, { useMemo, useState } from 'react';
import { EntityState } from '../types';
import { EntityWidget } from '../components/EntityWidget';
import { LightControlItem } from '../components/LightsControl';

interface RoomsProps {
    entities: EntityState[];
    onToggle: (id: string) => void;
    onBrightnessChange?: (id: string, brightness: number) => void;
    onColorChange?: (id: string, color: string) => void;
    onTempChange?: (id: string, temp: number) => void;
}

interface Room {
    id: string;
    name: string;
    icon: string;
    entities: string[];
}

export const Rooms: React.FC<RoomsProps> = ({
    entities,
    onToggle,
    onBrightnessChange,
    onColorChange,
    onTempChange
}) => {
    const [selectedRoom, setSelectedRoom] = useState<string>('all');

    // Strict whitelist configuration from user
    const ROOM_CONFIG: Record<string, { id: string; name: string; icon: string; entityIcon: string }> = {
        'light.wohnzimmer': { id: 'wohnzimmer', name: 'Wohnzimmer', icon: 'fa-couch', entityIcon: 'fa-lightbulb' },
        'light.essbereich': { id: 'essbereich', name: 'Essbereich', icon: 'fa-plate-utensils', entityIcon: 'fa-lightbulb' },
        'light.kuche': { id: 'kueche', name: 'Küche', icon: 'fa-utensils', entityIcon: 'fa-lightbulb' },
        'light.linas_zimmer': { id: 'linas_zimmer', name: 'Linas Zimmer', icon: 'fa-child', entityIcon: 'fa-lightbulb' },
        'light.levins_zimmer': { id: 'levins_zimmer', name: 'Levins Zimmer', icon: 'fa-child', entityIcon: 'fa-lightbulb' },
        'light.schlafzimmer': { id: 'schlafzimmer', name: 'Schlafzimmer', icon: 'fa-bed', entityIcon: 'fa-lightbulb' },
        'light.badezimmer': { id: 'badezimmer', name: 'Badezimmer', icon: 'fa-shower', entityIcon: 'fa-lightbulb' },
        'light.licht_garage': { id: 'gaeste_wc', name: 'Gäste WC', icon: 'fa-user', entityIcon: 'fa-lightbulb' },
        'light.deckenbeleuchtung_buro': { id: 'buero', name: 'Büro', icon: 'fa-briefcase', entityIcon: 'fa-lightbulb' }
    };

    const SCENE_CONFIG: Record<string, { name: string; icon: string; entityId: string }[]> = {
        'wohnzimmer': [
            { name: 'Kino', icon: 'fa-film', entityId: 'script.movie_night' },
            { name: 'Romantisch', icon: 'fa-heart', entityId: 'script.sex_wohnzimmer' }
        ],
        'essbereich': [
            { name: 'Essen', icon: 'fa-utensils', entityId: 'scene.essbereich_essen' },
            { name: 'Frühstück', icon: 'fa-mug-hot', entityId: 'script.essbereich_alles_aus' }
        ],
        'kueche': [
            { name: 'Kochen', icon: 'fa-fire-burner', entityId: 'script.kochen' }
        ],
        'schlafzimmer': [
            { name: 'Schlafen', icon: 'fa-bed', entityId: 'script.bed_time' },
            { name: 'Romantisch', icon: 'fa-heart', entityId: 'script.sex_schlafzimmer' }
        ],
        'levins_zimmer': [
            { name: 'Spielen', icon: 'fa-gamepad', entityId: 'scene.levins_zimmer_konzentrieren' },
            { name: 'Schlafen', icon: 'fa-bed', entityId: 'script.bed_time_levin' },
            { name: 'Aufwachen', icon: 'fa-sun', entityId: 'scene.levins_zimmer_herbsternte' },
            { name: 'Party', icon: 'fa-music', entityId: 'script.levin_party' }
        ],
        'buero': [
            { name: 'Arbeiten', icon: 'fa-briefcase', entityId: 'script.arbeiten_mit_musik' },
            { name: 'Konzentrieren', icon: 'fa-brain', entityId: 'scene.buro_konzentration' },
            { name: 'Zocken', icon: 'fa-gamepad', entityId: 'scene.turn_on' },
            { name: 'Abend', icon: 'fa-moon', entityId: 'scene.buro_abend' },
            { name: 'Kino', icon: 'fa-film', entityId: 'script.kino_buro' }
        ]
    };

    // Dynamically extract rooms from entities
    const rooms = useMemo(() => {
        const roomMap = new Map<string, { name: string; icon: string; entities: string[] }>();

        entities.forEach(entity => {
            // Only process lights that are in our config
            const config = ROOM_CONFIG[entity.id];
            if (!config) return;

            if (!roomMap.has(config.id)) {
                roomMap.set(config.id, {
                    name: config.name,
                    icon: config.icon,
                    entities: []
                });
            }
            roomMap.get(config.id)!.entities.push(entity.id);
        });

        // Convert to array preserving the defined order
        const roomsArray: Room[] = [];

        roomMap.forEach((data, id) => {
            roomsArray.push({
                id: id,
                name: data.name,
                icon: data.icon,
                entities: data.entities
            });
        });

        roomsArray.sort((a, b) => a.name.localeCompare(b.name));

        return roomsArray;
    }, [entities]);

    const scrollToRoom = (id: string) => {
        const element = document.getElementById(`room-${id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const filteredRooms = selectedRoom === 'all'
        ? rooms
        : rooms.filter(r => r.id === selectedRoom);

    return (
        <div className="relative">
            {/* Room Navigation */}
            <div className="flex sticky top-0 z-20 bg-[#06080c]/80 backdrop-blur-xl py-4 px-2 mb-12 gap-4 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setSelectedRoom('all')}
                    className={`flex items-center gap-3 whitespace-nowrap px-6 py-3 rounded-2xl border transition-all text-xs font-black uppercase tracking-widest ${selectedRoom === 'all'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                >
                    <i className="fa-solid fa-house text-blue-400"></i>
                    Alle Räume ({rooms.length})
                </button>
                {rooms.map(room => (
                    <button
                        key={room.id}
                        onClick={() => {
                            setSelectedRoom(room.id);
                            scrollToRoom(room.id);
                        }}
                        className={`flex items-center gap-3 whitespace-nowrap px-6 py-3 rounded-2xl border transition-all text-xs font-black uppercase tracking-widest ${selectedRoom === room.id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                            }`}
                    >
                        <i className={`fa-solid ${room.icon} text-blue-400`}></i>
                        {room.name} ({room.entities.length})
                    </button>
                ))}
            </div>

            {/* Room Sections */}
            <div className="space-y-24 pb-32">
                {filteredRooms.map(room => (
                    <section key={room.id} id={`room-${room.id}`} className="scroll-mt-32">
                        <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-6">
                            <div>
                                <h2 className="text-4xl font-black tracking-tighter">{room.name}</h2>
                                <p className="text-sm text-gray-500 mt-2">
                                    {room.entities.length} {room.entities.length === 1 ? 'Gerät' : 'Geräte'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {room.entities.map(entityId => {
                                const entity = entities.find(e => e.id === entityId);
                                if (!entity) return null;

                                // Override with custom icon from config
                                const config = ROOM_CONFIG[entityId];
                                const entityWithIcon = {
                                    ...entity,
                                    icon: config?.entityIcon || 'fa-lightbulb',
                                    name: config?.name || entity.name // Ensure name is passed correctly
                                };

                                if (entity.id.startsWith('light.')) {
                                    return (
                                        <LightControlItem
                                            key={entityId}
                                            light={{ ...entityWithIcon, name: entityWithIcon.name }}
                                            onToggle={onToggle}
                                            onBrightnessChange={onBrightnessChange}
                                            onColorChange={onColorChange}
                                            onTempChange={onTempChange}
                                        />
                                    );
                                }

                                return <EntityWidget key={entityId} entity={entityWithIcon} onToggle={onToggle} />;
                            })}
                        </div>

                        {/* Scenes Section */}
                        {SCENE_CONFIG[room.id] && (
                            <div className="mt-8">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Szenen & Aktionen</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {SCENE_CONFIG[room.id].map(scene => (
                                        <button
                                            key={scene.entityId}
                                            onClick={() => onToggle(scene.entityId)}
                                            className="glass-card p-4 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-colors group text-left"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                                <i className={`fa-solid ${scene.icon}`}></i>
                                            </div>
                                            <span className="font-medium text-sm">{scene.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                ))}
            </div>
        </div >
    );
};

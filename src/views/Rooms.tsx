import React, { useMemo, useState } from 'react';
import { EntityState } from '../types';
import { EntityWidget } from '../components/EntityWidget';

interface RoomsProps {
    entities: EntityState[];
    onToggle: (id: string) => void;
}

interface Room {
    id: string;
    name: string;
    icon: string;
    entities: string[];
}

// Helper function to get room-specific icons
const getRoomIcon = (roomName: string): string => {
    const name = roomName.toLowerCase();
    if (name.includes('bad') || name.includes('wc')) return 'fa-shower';
    if (name.includes('küche')) return 'fa-utensils';
    if (name.includes('wohnzimmer')) return 'fa-couch';
    if (name.includes('schlafzimmer')) return 'fa-bed';
    if (name.includes('büro')) return 'fa-briefcase';
    if (name.includes('kinderzimmer') || name.includes('levin') || name.includes('lina')) return 'fa-child';
    if (name.includes('gästezimmer') || name.includes('gast')) return 'fa-user';
    if (name.includes('flur') || name.includes('gang')) return 'fa-arrows-left-right';
    if (name.includes('keller')) return 'fa-stairs';
    if (name.includes('dachboden')) return 'fa-house-chimney';
    if (name.includes('garage')) return 'fa-car';
    if (name.includes('terrasse') || name.includes('balkon')) return 'fa-umbrella-beach';
    if (name.includes('garten')) return 'fa-tree';
    if (name.includes('waschküche') || name.includes('hauswirtschaft')) return 'fa-soap';
    if (name.includes('esszimmer')) return 'fa-plate-utensils';
    return 'fa-door-open';
};

export const Rooms: React.FC<RoomsProps> = ({ entities, onToggle }) => {
    const [selectedRoom, setSelectedRoom] = useState<string>('all');

    // Dynamically extract rooms from entities
    const rooms = useMemo(() => {
        const roomMap = new Map<string, Set<string>>();

        entities.forEach(entity => {
            // Try to extract room from entity attributes
            let roomName = entity.room || entity.attributes?.area_id || entity.attributes?.room;

            // If no explicit room, try to extract from friendly_name
            if (!roomName && entity.attributes?.friendly_name) {
                const name = entity.attributes.friendly_name;
                // Common room names in German
                const roomPatterns = [
                    /bad/i, /wc/i, /küche/i, /wohnzimmer/i, /schlafzimmer/i,
                    /büro/i, /kinderzimmer/i, /gästezimmer/i, /flur/i, /keller/i,
                    /dachboden/i, /garage/i, /terrasse/i, /balkon/i, /garten/i,
                    /waschküche/i, /hauswirtschaftsraum/i, /esszimmer/i, /zimmer/i,
                    /levin/i, /lina/i, /gast/i, /spielzimmer/i, /hobbyraum/i
                ];

                for (const pattern of roomPatterns) {
                    const match = name.match(pattern);
                    if (match) {
                        roomName = match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
                        break;
                    }
                }
            }

            // Default to "Unassigned" if no room found
            if (!roomName) {
                roomName = 'Nicht zugeordnet';
            }

            if (!roomMap.has(roomName)) {
                roomMap.set(roomName, new Set());
            }
            roomMap.get(roomName)!.add(entity.id);
        });

        // Convert to array and sort
        const roomsArray: Room[] = Array.from(roomMap.entries())
            .map(([name, entityIds]) => ({
                id: name.toLowerCase().replace(/\s+/g, '_'),
                name: name,
                icon: getRoomIcon(name),
                entities: Array.from(entityIds)
            }))
            .sort((a, b) => {
                // Sort "Nicht zugeordnet" to the end
                if (a.name === 'Nicht zugeordnet') return 1;
                if (b.name === 'Nicht zugeordnet') return -1;
                return a.name.localeCompare(b.name);
            });

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

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {room.entities.map(entityId => {
                                const entity = entities.find(e => e.id === entityId);
                                if (!entity) return null;
                                return <EntityWidget key={entityId} entity={entity} onToggle={onToggle} />;
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

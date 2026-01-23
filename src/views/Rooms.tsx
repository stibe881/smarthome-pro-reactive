import React from 'react';
import { EntityState } from '../types';
import { EntityWidget } from '../components/EntityWidget';
import { ROOMS } from '../mockData';

interface RoomsProps {
    entities: EntityState[];
    onToggle: (id: string) => void;
}

export const Rooms: React.FC<RoomsProps> = ({ entities, onToggle }) => {
    const scrollToRoom = (id: string) => {
        const element = document.getElementById(`room-${id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="relative">
            <div className="flex sticky top-0 z-20 bg-[#06080c]/80 backdrop-blur-xl py-4 px-2 mb-12 gap-4 overflow-x-auto no-scrollbar">
                {ROOMS.map(room => (
                    <button
                        key={room.id}
                        onClick={() => scrollToRoom(room.id)}
                        className="flex items-center gap-3 whitespace-nowrap px-6 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-xs font-black uppercase tracking-widest"
                    >
                        <i className={`fa-solid ${room.icon} text-blue-400`}></i>
                        {room.name}
                    </button>
                ))}
            </div>

            <div className="space-y-24 pb-32">
                {ROOMS.map(room => (
                    <section key={room.id} id={`room-${room.id}`} className="scroll-mt-32">
                        <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-6">
                            <div>
                                <h2 className="text-4xl font-black tracking-tighter">{room.name}</h2>
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

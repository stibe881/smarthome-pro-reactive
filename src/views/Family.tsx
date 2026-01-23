import React from 'react';
import { EntityState } from '../types';

interface FamilyProps {
    entities: EntityState[];
}

export const Family: React.FC<FamilyProps> = () => {
    const familyMembers = [
        { name: 'Stibe', status: 'Zuhause', location: 'Arbeitszimmer', battery: '85%', avatar: 'https://picsum.photos/seed/stibe/200/200' },
        { name: 'Bine', status: 'Abwesend', location: 'Arbeit', battery: '42%', avatar: 'https://picsum.photos/seed/bine/200/200' },
        { name: 'Levin', status: 'Zuhause', location: 'Kinderzimmer', battery: '100%', avatar: 'https://picsum.photos/seed/levin/200/200' },
        { name: 'Lina', status: 'Zuhause', location: 'Schlafzimmer', battery: '60%', avatar: 'https://picsum.photos/seed/lina/200/200' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {familyMembers.map((person, i) => (
                <div key={i} className="cyber-panel p-6 rounded-[2.5rem] relative overflow-hidden group border border-white/5">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-[4rem]"></div>

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className={`w-32 h-32 rounded-full p-1 border-4 ${person.status === 'Zuhause' ? 'border-neon-cyan' : 'border-slate-700'} mb-6 group-hover:scale-105 transition-transform duration-300 shadow-[0_0_20px_rgba(0,242,255,0.1)]`}>
                            <img src={person.avatar} className="w-full h-full rounded-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all" alt={person.name} />
                        </div>

                        <h3 className="text-2xl font-bold">{person.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${person.status === 'Zuhause' ? 'bg-neon-cyan' : 'bg-slate-500'}`}></div>
                            <span className={`text-sm font-bold uppercase tracking-widest ${person.status === 'Zuhause' ? 'text-neon-cyan' : 'text-slate-500'}`}>
                                {person.status}
                            </span>
                        </div>

                        <div className="mt-8 w-full space-y-3">
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Zone</span>
                                <span className="text-sm font-semibold">{person.location}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Power</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">{person.battery}</span>
                                    <i className={`fa-solid fa-battery-${parseInt(person.battery) > 50 ? 'three-quarters' : 'quarter'} text-xs ${parseInt(person.battery) < 20 ? 'text-red-500' : 'text-slate-400'}`}></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

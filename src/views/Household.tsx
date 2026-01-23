import React from 'react';
import { EntityState } from '../types';

interface HouseholdProps {
    entities: EntityState[];
    onToggle: (id: string) => void;
}

export const Household: React.FC<HouseholdProps> = ({ onToggle }) => {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-panel p-10 rounded-[3rem]">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-black uppercase tracking-[0.4em]">Einkaufsliste</h2>
                        <i className="fa-solid fa-cart-shopping text-blue-500 text-2xl"></i>
                    </div>
                    <div className="space-y-4">
                        {['Milch', 'Eier', 'Brot', 'Waschmittel'].map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition-colors cursor-pointer group">
                                <div className="flex items-center gap-6">
                                    <div className="w-6 h-6 rounded-lg border-2 border-slate-700 group-hover:border-blue-500 transition-colors"></div>
                                    <span className="text-lg font-bold text-slate-200">{item}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-8 rounded-[3rem]">
                        <h2 className="text-xs font-black mb-8 uppercase tracking-widest text-slate-500">Saugroboter</h2>
                        <button
                            onClick={() => onToggle('vacuum.robi')}
                            className="w-full p-8 bg-blue-600 rounded-[2rem] flex flex-col items-center gap-4 text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                        >
                            <i className="fa-solid fa-map-location-dot text-4xl"></i>
                            <span className="font-black uppercase tracking-widest text-xs">Map öffnen</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

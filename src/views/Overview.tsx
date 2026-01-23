import React from 'react';
import { EntityState } from '../types';

interface OverviewProps {
    entities: EntityState[];
    onToggle: (id: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ entities, onToggle }) => {
    const lights = entities.filter(e => e.type === 'light');
    const activeLightsCount = lights.filter(l => l.state === 'on').length;

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Aktive Lichter', value: activeLightsCount, icon: 'fa-lightbulb', color: 'text-yellow-500' },
                    { label: 'Temperatur Innen', value: '21.5°', icon: 'fa-temperature-half', color: 'text-orange-500' },
                    { label: 'Energieverbrauch', value: '342W', icon: 'fa-bolt', color: 'text-emerald-500' },
                    { label: 'Solar Ertrag', value: '1.2kW', icon: 'fa-sun', color: 'text-amber-500' },
                ].map((stat, i) => (
                    <div key={i} className="bg-[#161616] border border-[#262626] p-5 rounded-2xl flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${stat.color}`}>
                            <i className={`fa-solid ${stat.icon}`}></i>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{stat.label}</p>
                            <p className="text-xl font-bold">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <section>
                <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">Schnellzugriff Lichter</h2>
                    <div className="h-px flex-1 bg-[#262626]"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {lights.map(light => (
                        <button
                            key={light.id}
                            onClick={() => onToggle(light.id)}
                            className={`p-5 rounded-2xl border transition-all text-left group flex flex-col gap-4 ${light.state === 'on'
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-[#161616] border-[#262626] hover:border-gray-600'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${light.state === 'on' ? 'bg-white/20' : 'bg-white/5 text-gray-400 group-hover:text-white'
                                }`}>
                                <i className={`fa-solid ${light.icon}`}></i>
                            </div>
                            <div>
                                <p className="font-bold text-sm truncate">{light.name}</p>
                                <p className={`text-[10px] mt-0.5 uppercase tracking-widest font-bold ${light.state === 'on' ? 'text-white/60' : 'text-gray-500'
                                    }`}>
                                    {light.state === 'on' ? 'Eingeschaltet' : 'Aus'}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="bg-[#161616] border border-[#262626] rounded-2xl p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6">System Status</h3>
                    <div className="space-y-4">
                        {entities.filter(e => e.type === 'appliance' || e.type === 'vacuum').map(app => (
                            <div key={app.id} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <i className={`fa-solid ${app.icon} text-gray-400`}></i>
                                    <span className="text-sm font-medium">{app.name}</span>
                                </div>
                                <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded tracking-widest uppercase">
                                    {app.state}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

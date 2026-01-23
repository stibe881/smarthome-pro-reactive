import React from 'react';
import { EntityState } from '../types';

interface MediaProps {
    entities: EntityState[];
}

export const Media: React.FC<MediaProps> = () => {
    const players = [
        { name: 'Wohnzimmer TV', device: 'Sony OLED', status: 'Playing', content: 'Inception', poster: 'https://picsum.photos/seed/movie/400/600' },
        { name: 'Küche Speaker', device: 'Sonos One', status: 'Paused', content: 'SWR3 Live', poster: 'https://picsum.photos/seed/radio/400/400' },
        { name: 'Levin Tablet', device: 'iPad Air', status: 'Idle', content: 'YouTube Kids', poster: 'https://picsum.photos/seed/kids/400/400' },
    ];

    return (
        <div className="space-y-10 pb-20">
            <div className="relative cyber-panel cyber-border rounded-[3rem] overflow-hidden group min-h-[400px] flex flex-col justify-end p-8 md:p-12">
                <div className="absolute inset-0 opacity-40 group-hover:scale-105 transition-transform duration-700">
                    <img src="https://picsum.photos/seed/cinema/1920/1080" className="w-full h-full object-cover" alt="Background" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                </div>

                <div className="relative z-10 w-full lg:w-2/3">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-neon-cyan text-black rounded-full text-[10px] font-black uppercase tracking-widest">Transmission Active</span>
                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-slate-300 uppercase">Wohnzimmer_Node</span>
                    </div>
                    <h2 className="text-5 xl md:text-6xl font-black tracking-tighter mb-4 glitch-text">Inception</h2>
                    <p className="text-slate-300 text-lg mb-8 max-w-xl opacity-70">Extraction protocol initialized. Dreaming layer 3 reached. Monitoring neuro-signals.</p>

                    <div className="flex items-center gap-6">
                        <div className="flex-1 space-y-2">
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="w-[65%] h-full bg-neon-cyan shadow-[0_0_15px_var(--neon-cyan)]"></div>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase">
                                <span>1:12:45</span>
                                <span>2:28:00</span>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button className="w-14 h-14 rounded-full bg-white text-slate-950 flex items-center justify-center hover:scale-110 transition-transform">
                                <i className="fa-solid fa-pause text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {players.map((player, i) => (
                    <div key={i} className="cyber-panel p-5 rounded-[2rem] border border-white/5 flex gap-5 hover:border-neon-cyan/30 transition-all">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl grayscale hover:grayscale-0 transition-all">
                            <img src={player.poster} className="w-full h-full object-cover" alt={player.content} />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                                <h4 className="font-bold text-lg leading-tight uppercase tracking-tight">{player.name}</h4>
                                <p className="text-slate-400 text-xs mt-1">{player.content}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${player.status === 'Playing' ? 'text-neon-cyan' : 'text-slate-500'}`}>
                                    {player.status}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

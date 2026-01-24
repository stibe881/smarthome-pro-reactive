import React, { useState, useEffect, useMemo } from 'react';
import { ViewType, EntityState } from './types';
import { INITIAL_ENTITIES } from './mockData';
import { HomeAssistantService } from './services/homeAssistant';
import { geminiService } from './services/gemini';
import { GeminiAssistant } from './components/GeminiAssistant';
import { BottomNav } from './components/BottomNav';
import { useDeviceType } from './hooks/useDeviceType';
import { Overview } from './views/Overview';
import { Rooms } from './views/Rooms';
import { Media } from './views/Media';
import { Family } from './views/Family';
import { Household } from './views/Household';
import { Settings } from './views/Settings';

const App: React.FC = () => {
    const deviceInfo = useDeviceType();
    const [activeView, setActiveView] = useState<ViewType>('overview');
    const [entities, setEntities] = useState<EntityState[]>(INITIAL_ENTITIES);
    const [isConnected, setIsConnected] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [time, setTime] = useState(new Date());

    const haService = useMemo(() => new HomeAssistantService((raw) => {
        const mapped: EntityState[] = raw.map((ent: any) => ({
            id: ent.entity_id,
            name: ent.attributes.friendly_name || ent.entity_id,
            state: ent.state,
            attributes: ent.attributes,
            icon: ent.attributes.icon?.replace('mdi:', 'fa-') || 'fa-circle',
            type: ent.entity_id.split('.')[0] as any,
        }));
        setEntities(mapped);
        setIsConnected(true);
    }), []);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        const savedUrl = localStorage.getItem('ha_url');
        const savedToken = localStorage.getItem('ha_token');
        if (savedUrl && savedToken) {
            haService.connect(savedUrl, savedToken).catch(() => setIsConnected(false));
        }

        // Initialize Gemini if API key is available
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            geminiService.init(apiKey);
        }

        return () => clearInterval(timer);
    }, [haService]);

    const handleToggle = (id: string) => {
        if (isConnected) {
            haService.callService(id.split('.')[0], 'toggle', id);
        } else {
            setEntities(prev => prev.map(e => e.id === id ? { ...e, state: e.state === 'on' ? 'off' : 'on' } : e));
        }
    };

    const menu = [
        { id: 'overview', icon: 'fa-table-cells-large', label: 'Dashboard' },
        { id: 'rooms', icon: 'fa-door-open', label: 'Räume' },
        { id: 'media', icon: 'fa-play-circle', label: 'Medien' },
        { id: 'family', icon: 'fa-user-group', label: 'Familie' },
        { id: 'household', icon: 'fa-broom', label: 'Service' },
        { id: 'settings', icon: 'fa-sliders', label: 'Optionen' },
    ];

    return (
        <div className="flex h-screen w-full bg-black text-white">
            {/* Sidebar - Hidden on Mobile, Compact on Tablet, Full on Desktop */}
            {!deviceInfo.isMobile && (
                <aside className={`border-r border-[#1a1a1a] bg-[#050505] flex flex-col shrink-0 ${deviceInfo.isTablet ? 'w-20' : 'w-64'
                    }`}>
                    {/* Logo */}
                    <div className={deviceInfo.isTablet ? 'p-4' : 'p-8 pb-12'}>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center">
                                <i className="fa-solid fa-house-chimney-window text-white text-sm"></i>
                            </div>
                            {!deviceInfo.isTablet && (
                                <h1 className="text-lg font-black tracking-tight">SMARTHOME <span className="text-blue-500">PRO</span></h1>
                            )}
                        </div>
                        {!deviceInfo.isTablet && (
                            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest ml-11">Powered by HA</p>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 space-y-1">
                        {menu.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id as ViewType)}
                                className={`w-full flex items-center gap-4 ${deviceInfo.isTablet ? 'justify-center px-3' : 'px-5'} py-4 rounded-xl transition-all duration-200 group ${activeView === item.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                                title={deviceInfo.isTablet ? item.label : undefined}
                            >
                                <i className={`fa-solid ${item.icon} text-lg w-6 ${activeView === item.id ? 'scale-110' : 'group-hover:scale-110'
                                    } transition-transform`}></i>
                                {!deviceInfo.isTablet && (
                                    <span className="font-bold text-sm tracking-wide">{item.label}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* AI Button */}
                    {!deviceInfo.isTablet && (
                        <div className="p-6">
                            <button
                                onClick={() => setIsAiOpen(true)}
                                className="w-full py-4 bg-[#0d0d0d] hover:bg-[#151515] border border-[#1f1f1f] rounded-2xl flex items-center justify-center gap-3 text-xs font-black transition-all active:scale-95"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles text-blue-500"></i>
                                SMART AI
                            </button>
                        </div>
                    )}
                </aside>
            )}

            {/* Content */}
            <main className={`flex-1 flex flex-col min-w-0 bg-[#000] ${deviceInfo.isMobile ? 'pb-20' : ''}`}>
                <header className={`${deviceInfo.isMobile ? 'h-16 px-4' : 'h-20 px-10'} flex items-center justify-between border-b border-[#1a1a1a] bg-black/50 backdrop-blur-xl z-10`}>
                    <div className="flex flex-col">
                        <span className={`${deviceInfo.isMobile ? 'text-xl' : 'text-2xl'} font-black tabular-nums tracking-tighter`}>
                            {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
                            {time.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`${deviceInfo.isMobile ? 'px-2' : 'px-4'} py-1.5 rounded-full border ${deviceInfo.isMobile ? 'text-[8px]' : 'text-[9px]'} font-black tracking-widest flex items-center gap-2 ${isConnected ? 'bg-blue-500/5 border-blue-500/20 text-blue-500' : 'bg-red-500/5 border-red-500/20 text-red-500'
                            }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
                            {deviceInfo.isMobile ? (isConnected ? 'ON' : 'OFF') : (isConnected ? 'NODE CONNECTED' : 'OFFLINE')}
                        </div>
                        {deviceInfo.isMobile && (
                            <button
                                onClick={() => setIsAiOpen(true)}
                                className="p-2 text-blue-500 active:scale-95 transition-transform"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
                            </button>
                        )}
                    </div>
                </header>

                <div className={`flex-1 overflow-y-auto ${deviceInfo.isMobile ? 'p-4' : 'p-10'} no-scrollbar`}>
                    <div className="max-w-6xl mx-auto">
                        {activeView === 'overview' && <Overview entities={entities} onToggle={handleToggle} haService={haService} />}
                        {activeView === 'rooms' && <Rooms entities={entities} onToggle={handleToggle} />}
                        {activeView === 'media' && <Media entities={entities} />}
                        {activeView === 'family' && <Family entities={entities} />}
                        {activeView === 'household' && <Household entities={entities} onToggle={handleToggle} />}
                        {activeView === 'settings' && <Settings isConnected={isConnected} onConnect={haService.connect.bind(haService)} />}
                    </div>
                </div>
            </main>

            {/* Bottom Navigation for Mobile */}
            {deviceInfo.isMobile && (
                <BottomNav
                    activeView={activeView}
                    onNavigate={(view) => setActiveView(view as ViewType)}
                    menu={menu}
                />
            )}

            <GeminiAssistant isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} entities={entities} />
        </div>
    );
};

export default App;

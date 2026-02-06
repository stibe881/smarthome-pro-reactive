import React, { useState, useEffect, useMemo } from 'react';
import { ViewType, EntityState } from './types';
import { HomeAssistantService } from './services/homeAssistant';
import { geminiService } from './services/gemini';
import { GeminiAssistant } from './components/GeminiAssistant';
import { BottomNav } from './components/BottomNav';
import { useDeviceType } from './hooks/useDeviceType';
import { useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Overview } from './views/Overview';
import { Rooms } from './views/Rooms';
import { Media } from './views/Media';
import { Family } from './views/Family';
import { Household } from './views/Household';
import { Settings } from './views/Settings';
import { AdminPanel } from './views/AdminPanel';
import SpotifyCallback from './views/SpotifyCallback';

import { CalendarModal } from './components/CalendarModal';

const App: React.FC = () => {
    const { user, isLoading: authLoading, userRole } = useAuth();
    const deviceInfo = useDeviceType();
    const [activeView, setActiveView] = useState<ViewType>('overview');
    const [entities, setEntities] = useState<EntityState[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoadingHA, setIsLoadingHA] = useState(true);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [time, setTime] = useState(new Date());

    // Spotify callback detection
    const [isSpotifyCallback, setIsSpotifyCallback] = useState(
        window.location.pathname.includes('spotify-callback') ||
        window.location.search.includes('code=')
    );

    // Calendar Modal State
    const [calendarModal, setCalendarModal] = useState<{
        isOpen: boolean;
        title: string;
        entityId: string;
        daysToFetch?: number;
        maxEvents?: number;
    }>({
        isOpen: false,
        title: '',
        entityId: ''
    });

    const haService = useMemo(() => new HomeAssistantService((raw) => {
        const MY_POSITION_MAPPING: Record<string, string> = {
            'Essbereich': 'button.evb_essbereich_my_position',
            'Küche Balkon': 'button.evb_kuche_balkon_my_position',
            'Küche': 'button.evb_kuchenfenster_my_position',
            'Wohnzimmer': 'button.evb_sofa_my_position',
            'Spielplätzchen': 'button.evb_spielplatz_my_position',
            'Terrasse': 'button.evb_terrasse_my_position',
        };

        const mapped: EntityState[] = raw.map((ent: any) => {
            let name = ent.attributes.friendly_name || ent.entity_id;

            // Renaming logic
            if (name === 'Küche') name = 'Küchenfenster';
            if (name === 'Wohnzimmer') name = 'Sofa';

            return {
                id: ent.entity_id,
                name: name,
                state: ent.state,
                attributes: ent.attributes,
                icon: ent.attributes.icon?.replace('mdi:', 'fa-') || 'fa-circle',
                type: ent.entity_id.split('.')[0] as any,
                myPositionEntity: MY_POSITION_MAPPING[ent.attributes.friendly_name] || MY_POSITION_MAPPING[name]
            };
        });
        setEntities(mapped);
        setIsConnected(true);
        setIsLoadingHA(false);
    }), []);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);

        // Load settings from Supabase if user is logged in
        const loadSettings = async () => {
            if (user) {
                try {
                    const { supabase } = await import('./lib/supabase');
                    const { data, error } = await supabase
                        .from('user_settings')
                        .select('*')
                        .eq('user_id', user.id)
                        .single();

                    if (error && error.code !== 'PGRST116') {
                        console.error('Failed to load settings:', error);
                        setIsLoadingHA(false);
                        return;
                    }

                    if (data && data.ha_url && data.ha_token) {
                        const success = await haService.connect(data.ha_url, data.ha_token);
                        if (!success) {
                            setIsConnected(false);
                            setIsLoadingHA(false);
                        }
                    } else {
                        // No HA settings configured yet
                        setIsLoadingHA(false);
                    }
                } catch (err) {
                    console.error('Failed to load settings:', err);
                    setIsLoadingHA(false);
                }
            } else {
                setIsLoadingHA(false);
            }
        };

        loadSettings();

        // Initialize Gemini if API key is available
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            geminiService.init(apiKey);
        }

        return () => clearInterval(timer);
    }, [haService, user]);

    const handleToggle = (id: string) => {
        if (isConnected) {
            haService.callService(id.split('.')[0], 'toggle', id);
        } else {
            setEntities(prev => prev.map(e => e.id === id ? { ...e, state: e.state === 'on' ? 'off' : 'on' } : e));
        }
    };

    const handleMediaControl = (id: string, action: 'play' | 'pause' | 'play_pause') => {
        if (isConnected) {
            const serviceName = action === 'play_pause' ? 'media_play_pause' : action === 'play' ? 'media_play' : 'media_pause';
            haService.callService('media_player', serviceName, id);
        } else {
            // Toggle local state for media players
            setEntities(prev => prev.map(e =>
                e.id === id && e.type === 'media_player'
                    ? { ...e, state: e.state === 'playing' ? 'paused' : 'playing' }
                    : e
            ));
        }
    };

    const handleLightBrightness = (id: string, brightness: number) => {
        if (isConnected) {
            haService.callService('light', 'turn_on', id, { brightness_pct: brightness });
        }
        // Update local state universally (optimistic update)
        setEntities(prev => prev.map(e => e.id === id ? {
            ...e,
            attributes: { ...e.attributes, brightness }
        } : e));
    };

    const handleLightColor = (id: string, color: string) => {
        // Convert hex to rgb
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
        const rgb_color = result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [255, 255, 255];

        if (isConnected) {
            haService.callService('light', 'turn_on', id, { rgb_color });
        }
        setEntities(prev => prev.map(e => e.id === id ? {
            ...e,
            attributes: { ...e.attributes, rgb_color }
        } : e));
    };

    const handleLightTemp = (id: string, temp: number) => {
        if (isConnected) {
            haService.callService('light', 'turn_on', id, { color_temp: temp });
        }
        setEntities(prev => prev.map(e => e.id === id ? {
            ...e,
            attributes: { ...e.attributes, color_temp: temp }
        } : e));
    };

    const handleCoverPosition = (id: string, position: number) => {
        if (isConnected) {
            haService.setCoverPosition(id, position);
        }
        // Update local state (optimistic)
        setEntities(prev => prev.map(e => e.id === id ? {
            ...e,
            attributes: { ...e.attributes, current_position: position }
        } : e));
    };

    const handleCoverTilt = (id: string, tilt: number) => {
        if (isConnected) {
            haService.setCoverTiltPosition(id, tilt);
        }
        // Update local state (optimistic)
        setEntities(prev => prev.map(e => e.id === id ? {
            ...e,
            attributes: { ...e.attributes, current_tilt_position: tilt }
        } : e));
    };

    const handleTriggerMyPosition = (id: string) => {
        const entity = entities.find(e => e.id === id);
        if (entity?.myPositionEntity && isConnected) {
            haService.pressButton(entity.myPositionEntity);
        }
    };

    const menu = [
        { id: 'overview', icon: 'fa-table-cells-large', label: 'Dashboard' },
        { id: 'rooms', icon: 'fa-door-open', label: 'Räume' },
        { id: 'media', icon: 'fa-play-circle', label: 'Medien' },
        { id: 'family', icon: 'fa-user-group', label: 'Familie' },
        { id: 'household', icon: 'fa-broom', label: 'Haushalt' },
        { id: 'settings', icon: 'fa-sliders', label: 'Optionen' },
    ];

    // Debug log
    console.log('[App] User role:', userRole, 'Menu items:', menu.length);

    // Show loading state while checking authentication
    if (authLoading) {
        return (
            <div className="flex h-screen w-full bg-black items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <i className="fa-solid fa-house-chimney-window text-white text-2xl"></i>
                    </div>
                    <i className="fa-solid fa-circle-notch animate-spin text-blue-500 text-2xl"></i>
                </div>
            </div>
        );
    }

    // Show login form if not authenticated
    if (!user) {
        return <AuthForm />;
    }

    // Handle Spotify OAuth callback
    if (isSpotifyCallback) {
        return (
            <SpotifyCallback
                onComplete={() => {
                    setIsSpotifyCallback(false);
                    window.history.replaceState({}, '', '/');
                    setActiveView('media');
                }}
            />
        );
    }

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

                    {/* Next Birthday Widget */}
                    {(() => {
                        const nextBday = entities.find(e => e.id === 'sensor.nachster_geburtstag');
                        const daysToBday = entities.find(e => e.id === 'sensor.tage_bis_geburtstag');
                        if (!nextBday || !daysToBday) return null;

                        return (
                            <div
                                onClick={() => {
                                    console.log('Birthday clicked');
                                    setCalendarModal({
                                        isOpen: true,
                                        title: 'Geburtstage',
                                        entityId: 'calendar.geburtstage_2',
                                        daysToFetch: 365, // Fetch full year to find birthdays
                                        maxEvents: 7 // Show next 7 birthdays
                                    });
                                }}
                                className="hidden lg:flex flex-col items-center mx-6 cursor-pointer hover:bg-white/5 px-4 py-2 rounded-xl transition-colors z-50 pointer-events-auto"
                            >
                                <div className="flex items-center gap-3">
                                    <i className="fa-solid fa-cake-candles text-pink-500 text-lg"></i>
                                    <span className="text-sm font-bold">{nextBday.state}</span>
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                    Noch {daysToBday.state} Tage
                                </span>
                            </div>
                        );
                    })()}

                    {/* Next Appointment Widget */}
                    {(() => {
                        const calendar = entities.find(e => e.id === 'calendar.stefan_gross_stibe_me');
                        if (!calendar) return null;

                        const message = calendar.attributes.message;
                        const startTimeStr = calendar.attributes.start_time;

                        if (!message || !startTimeStr) return null;

                        // Format: dd.mm. HH:mm
                        const startDate = new Date(startTimeStr);
                        const formattedDate = startDate.toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        }).replace(',', '.'); // Ensure dot format if locale differs

                        return (
                            <div
                                onClick={() => {
                                    console.log('Appointment clicked');
                                    setCalendarModal({
                                        isOpen: true,
                                        title: 'Termine',
                                        entityId: 'calendar.stefan_gross_stibe_me',
                                        daysToFetch: 14 // Show next 14 days
                                    });
                                }}
                                className="hidden md:flex flex-col items-start mx-6 max-w-[200px] cursor-pointer hover:bg-white/5 px-4 py-2 rounded-xl transition-colors z-50 pointer-events-auto"
                            >
                                <div className="flex items-center gap-3 w-full">
                                    <i className="fa-solid fa-calendar-day text-blue-500 text-lg flex-shrink-0"></i>
                                    <span className="text-sm font-bold truncate">{message}</span>
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-8">
                                    {formattedDate}
                                </span>
                            </div>
                        );
                    })()}

                    {/* Spacer to push Weather to right if needed, or let justify-between handle it */}
                    <div className="flex-1"></div>

                    {/* Weather Display */}
                    {(() => {
                        const weatherEntity = entities.find(e => e.id === 'weather.forecast_familie_gross');
                        const tempEntity = entities.find(e => e.id === 'sensor.wetterstation_actual_temperature');

                        // Debug logs
                        if (!weatherEntity) console.log('Missing weather entity: weather.forecast_familie_gross');
                        if (!tempEntity) console.log('Missing temp entity: sensor.wetterstation_actual_temperature');

                        if (!weatherEntity && !tempEntity) return null;

                        // Use specific temp sensor if available, otherwise fallback to weather attribute
                        const temp = tempEntity ? tempEntity.state : weatherEntity?.attributes.temperature;

                        // Determine icon from weather entity state
                        const state = weatherEntity?.state || 'sunny';
                        const icon = state === 'sunny' ? 'fa-sun' :
                            state === 'cloudy' ? 'fa-cloud' :
                                state === 'partlycloudy' ? 'fa-cloud-sun' :
                                    state === 'rainy' ? 'fa-cloud-rain' :
                                        'fa-cloud';

                        const label = 'Zell LU';

                        return (
                            <div className="hidden md:flex flex-col items-end mr-8">
                                <div className="flex items-center gap-3">
                                    <i className={`fa-solid ${icon} text-yellow-500 text-xl`}></i>
                                    <span className="text-2xl font-black">{temp}°C</span>
                                </div>
                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
                                    {label}
                                </span>
                            </div>
                        );
                    })()}

                    <div className="flex items-center gap-4">
                        {userRole === 'admin' && (
                            <div className={`${deviceInfo.isMobile ? 'px-2' : 'px-4'} py-1.5 rounded-full border ${deviceInfo.isMobile ? 'text-[8px]' : 'text-[9px]'} font-black tracking-widest flex items-center gap-2 ${isConnected ? 'bg-blue-500/5 border-blue-500/20 text-blue-500' : 'bg-red-500/5 border-red-500/20 text-red-500'
                                }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
                                {deviceInfo.isMobile ? (isConnected ? 'ON' : 'OFF') : (isConnected ? 'NODE CONNECTED' : 'OFFLINE')}
                            </div>
                        )}
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
                    {/* No HA Connection Banner */}
                    {!isConnected && !isLoadingHA && entities.length === 0 && (
                        <div className="mb-6 p-6 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-3xl">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i className="fa-solid fa-plug-circle-xmark text-yellow-500 text-xl"></i>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-black text-yellow-400 mb-2">
                                        Keine Home Assistant Verbindung
                                    </h3>
                                    <p className="text-sm text-yellow-300/80 mb-4">
                                        Konfiguriere deine Home Assistant Instanz in den Optionen, um echte Daten anzuzeigen.
                                    </p>
                                    <button
                                        onClick={() => setActiveView('settings')}
                                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-all"
                                    >
                                        <i className="fa-solid fa-sliders mr-2"></i>
                                        Zu den Optionen
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="max-w-6xl mx-auto">
                        {activeView === 'overview' && (
                            <Overview
                                entities={entities}
                                onToggle={handleToggle}
                                onBrightnessChange={handleLightBrightness}
                                onColorChange={handleLightColor}
                                onTempChange={handleLightTemp}
                                onSetPosition={handleCoverPosition}
                                onSetTilt={handleCoverTilt}
                                onTriggerMyPosition={handleTriggerMyPosition}
                            />
                        )}
                        {activeView === 'rooms' && (
                            <Rooms
                                entities={entities}
                                onToggle={handleToggle}
                                onBrightnessChange={handleLightBrightness}
                                onColorChange={handleLightColor}
                                onTempChange={handleLightTemp}
                            />
                        )}
                        {activeView === 'media' && <Media entities={entities} onMediaControl={handleMediaControl} haService={haService} />}
                        {activeView === 'family' && <Family entities={entities} />}
                        {activeView === 'household' && <Household entities={entities} onToggle={handleToggle} />}
                        {activeView === 'admin' && <AdminPanel />}
                        {activeView === 'settings' && <Settings />}
                    </div>
                </div>
            </main>

            {/* Bottom Navigation for Mobile */}
            {
                deviceInfo.isMobile && (
                    <BottomNav
                        activeView={activeView}
                        onNavigate={(view) => setActiveView(view as ViewType)}
                        menu={menu}
                    />
                )
            }

            <GeminiAssistant isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} entities={entities} />
            <CalendarModal
                isOpen={calendarModal.isOpen}
                onClose={() => setCalendarModal(prev => ({ ...prev, isOpen: false }))}
                title={calendarModal.title}
                entityId={calendarModal.entityId}
                haService={haService}
                currentEntity={entities.find(e => e.id === calendarModal.entityId)}
                daysToFetch={calendarModal.daysToFetch}
                maxEvents={calendarModal.maxEvents}
            />
        </div >
    );
};

export default App;


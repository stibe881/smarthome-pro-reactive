import React, { useState } from 'react';
import { EntityState } from '../types';
import { QuickActionChip, SceneButton } from '../components/QuickActions';
import { AppliancesSection } from '../components/AppliancesStatus';
import { VacuumControl } from '../components/VacuumControl';
import { ShoppingList } from '../components/ShoppingList';
import { LightsControl } from '../components/LightsControl';
import { CoversControl } from '../components/CoversControl';
import { Modal } from '../components/Modal';

interface OverviewProps {
    entities: EntityState[];
    onToggle: (id: string) => void;
    onBrightnessChange: (id: string, brightness: number) => void;
    onColorChange: (id: string, color: string) => void;
    onTempChange: (id: string, temp: number) => void;
    onSetPosition?: (id: string, position: number) => void;
    onSetTilt?: (id: string, tilt: number) => void;
    onTriggerMyPosition?: (id: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({
    entities,
    onToggle,
    onBrightnessChange,
    onColorChange,
    onTempChange,
    onSetPosition,
    onSetTilt,
    onTriggerMyPosition
}) => {
    const lights = entities.filter(e => e.type === 'light');
    const covers = entities.filter(e => e.type === 'cover');

    // Strict whitelist for active lights count
    const COUNT_WHITELIST = [
        'light.wohnzimmer',
        'light.essbereich',
        'light.kuche',
        'light.linas_zimmer',
        'light.levins_zimmer',
        'light.schlafzimmer',
        'light.badezimmer',
        'light.licht_garage',
        'light.deckenbeleuchtung_buro'
    ];

    const activeLightsCount = lights
        .filter(l => COUNT_WHITELIST.includes(l.id))
        .filter(l => l.state === 'on')
        .length;

    // Modal states
    const [showVacuumModal, setShowVacuumModal] = useState(false);
    const [showShoppingModal, setShowShoppingModal] = useState(false);
    const [showLightsModal, setShowLightsModal] = useState(false);
    const [showCoversModal, setShowCoversModal] = useState(false);

    // Mock shopping list - will be replaced with real HA entity
    const [shoppingItems, setShoppingItems] = useState([
        { id: '1', text: 'Milch', completed: false },
        { id: '2', text: 'Brot', completed: false },
        { id: '3', text: 'Käse', completed: true },
    ]);



    const handleSceneActivate = (sceneName: string) => {
        console.log('Activating scene:', sceneName);
        // TODO: Call HA service to activate scene
    };

    // Shopping list handlers
    const handleToggleTodo = (id: string) => {
        setShoppingItems(prev => prev.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
    };

    const handleAddTodo = (text: string) => {
        setShoppingItems(prev => [...prev, {
            id: Date.now().toString(),
            text,
            completed: false
        }]);
    };

    const handleDeleteTodo = (id: string) => {
        setShoppingItems(prev => prev.filter(item => item.id !== id));
    };

    // Vacuum handlers
    const handleCleanRoom = (roomId: string) => {
        console.log('Cleaning room:', roomId);
        // TODO: Call HA vacuum service
    };

    const activeShoppingCount = shoppingItems.filter(i => !i.completed).length;

    return (
        <>
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Quick-Action Chips */}
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    <QuickActionChip
                        icon="fa-lightbulb"
                        label="Lichter"
                        active={activeLightsCount > 0}
                        color="amber"
                        onClick={() => setShowLightsModal(true)}
                    />
                    <QuickActionChip
                        icon="fa-window-maximize"
                        label="Storen"
                        color="blue"
                        onClick={() => setShowCoversModal(true)}
                    />
                    <QuickActionChip
                        icon="fa-robot"
                        label="Röbi"
                        color="green"
                        onClick={() => setShowVacuumModal(true)}
                    />
                    <QuickActionChip
                        icon="fa-cart-shopping"
                        label="Einkaufsliste"
                        badge={activeShoppingCount}
                        color="red"
                        onClick={() => setShowShoppingModal(true)}
                    />
                    <QuickActionChip
                        icon="fa-door-open"
                        label="Türen"
                        color="orange"
                        onClick={() => console.log('Unlock Doors')}
                    />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    {[
                        { label: 'Aktive Lichter', value: activeLightsCount, icon: 'fa-lightbulb', color: 'text-yellow-500' },
                        { label: 'Temperatur Innen', value: '21.5°', icon: 'fa-temperature-half', color: 'text-orange-500' },
                    ].map((stat, i) => (
                        <div key={i} className="glass-card p-5 rounded-2xl flex items-center gap-4 hover:scale-105 transition-all">
                            <div className={`w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center ${stat.color}`}>
                                <i className={`fa-solid ${stat.icon} text-xl`}></i>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{stat.label}</p>
                                <p className="text-2xl font-bold">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Haushaltsgeräte Status */}
                    <AppliancesSection entities={entities} />

                    {/* System Status */}
                    <section className="glass-card rounded-2xl p-6 border border-white/10">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6">System Status</h3>
                        <div className="space-y-4">
                            {entities.filter(e => e.id === 'vacuum.robi').map(app => (
                                <button
                                    key={app.id}
                                    onClick={() => setShowVacuumModal(true)}
                                    className="w-full flex items-center justify-between p-4 glass-panel rounded-xl border border-white/5 hover:bg-white/5 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <i className={`fa-solid ${app.icon} text-gray-400`}></i>
                                        <span className="text-sm font-medium">{app.name}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded tracking-widest uppercase">
                                        {app.state}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Szenen & Modi - full width */}
                <div className="glass-card p-6 rounded-3xl border border-white/10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-5">
                        🎬 Szenen & Modi
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        <SceneButton
                            name="Essen"
                            icon="fa-utensils"
                            color="orange"
                            onClick={() => handleSceneActivate('essen')}
                        />
                        <SceneButton
                            name="Kino"
                            icon="fa-film"
                            color="purple"
                            onClick={() => handleSceneActivate('movie_night')}
                        />
                        <SceneButton
                            name="Schlafen"
                            icon="fa-bed"
                            color="gray"
                            onClick={() => handleSceneActivate('bed_time')}
                        />
                    </div>
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={showVacuumModal} onClose={() => setShowVacuumModal(false)} title="🤖 Röbi Staubsauger">
                {(() => {
                    const vacuum = entities.find(e => e.id === 'vacuum.robi') || entities.find(e => e.type === 'vacuum');
                    // Fallback state if no entity found
                    const state = (vacuum?.state as any) || 'docked';
                    const battery = vacuum?.attributes?.battery || 0;

                    return (
                        <VacuumControl
                            state={state}
                            battery={battery}
                            onCleanRoom={handleCleanRoom}
                            onStartCleaning={() => console.log('Start cleaning')}
                            onPause={() => console.log('Pause')}
                            onReturn={() => console.log('Return to dock')}
                        />
                    );
                })()}
            </Modal>

            <Modal isOpen={showShoppingModal} onClose={() => setShowShoppingModal(false)} title="🛒 Einkaufsliste">
                <ShoppingList
                    items={shoppingItems}
                    onToggle={handleToggleTodo}
                    onAdd={handleAddTodo}
                    onDelete={handleDeleteTodo}
                />
            </Modal>

            <Modal isOpen={showLightsModal} onClose={() => setShowLightsModal(false)} title="💡 Lichter">
                <LightsControl
                    lights={lights}
                    onToggle={onToggle}
                    onBrightnessChange={onBrightnessChange}
                    onColorChange={onColorChange}
                    onTempChange={onTempChange}
                />
            </Modal>

            <Modal isOpen={showCoversModal} onClose={() => setShowCoversModal(false)} title="🪟 Storen & Rolläden">
                <CoversControl
                    covers={covers}
                    onOpen={(id) => {
                        console.log(`Opening cover ${id}`);
                        // TODO: Call HA service to open cover
                    }}
                    onClose={(id) => {
                        console.log(`Closing cover ${id}`);
                        // TODO: Call HA service to close cover
                    }}
                    onSetPosition={onSetPosition}
                    onSetTilt={onSetTilt}
                    onTriggerMyPosition={onTriggerMyPosition}
                />
            </Modal>
        </>
    );
};

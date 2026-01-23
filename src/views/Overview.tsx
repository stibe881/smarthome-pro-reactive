import React, { useState } from 'react';
import { EntityState } from '../types';
import { QuickActionChip, SceneButton } from '../components/QuickActions';
import { AppliancesSection } from '../components/AppliancesStatus';
import { VacuumControl } from '../components/VacuumControl';
import { ShoppingList } from '../components/ShoppingList';
import { Modal } from '../components/Modal';

interface OverviewProps {
    entities: EntityState[];
    onToggle: (id: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ entities, onToggle }) => {
    const lights = entities.filter(e => e.type === 'light');
    const activeLightsCount = lights.filter(l => l.state === 'on').length;

    // Modal states
    const [showVacuumModal, setShowVacuumModal] = useState(false);
    const [showShoppingModal, setShowShoppingModal] = useState(false);

    // Mock shopping list - will be replaced with real HA entity
    const [shoppingItems, setShoppingItems] = useState([
        { id: '1', text: 'Milch', completed: false },
        { id: '2', text: 'Brot', completed: false },
        { id: '3', text: 'Käse', completed: true },
    ]);

    // Mock appliances data - will be replaced with real HA entities
    const dishwasher = {
        state: 'running' as const,
        remainingTime: '42 min',
        program: 'Eco'
    };

    const washingMachine = {
        state: 'finished' as const,
        remainingTime: undefined,
    };

    const dryer = {
        state: 'finished' as const,
        current: 8
    };

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
                        icon="fa-coffee-maker"
                        label="Kaffee"
                        color="brown"
                        onClick={() => console.log('Open Kaffee')}
                    />
                    <QuickActionChip
                        icon="fa-lightbulb"
                        label="Lichter"
                        active={activeLightsCount > 0}
                        color="amber"
                        onClick={() => console.log('Open Lights')}
                    />
                    <QuickActionChip
                        icon="fa-window-shutter"
                        label="Storen"
                        color="blue"
                        onClick={() => console.log('Open Storen')}
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
                        icon="fa-bell-ring"
                        label="Türen"
                        color="orange"
                        onClick={() => console.log('Unlock Doors')}
                    />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Aktive Lichter', value: activeLightsCount, icon: 'fa-lightbulb', color: 'text-yellow-500' },
                        { label: 'Temperatur Innen', value: '21.5°', icon: 'fa-temperature-half', color: 'text-orange-500' },
                        { label: 'Energieverbrauch', value: '342W', icon: 'fa-bolt', color: 'text-emerald-500' },
                        { label: 'Solar Ertrag', value: '1.2kW', icon: 'fa-sun', color: 'text-amber-500' },
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
                    <AppliancesSection
                        dishwasher={dishwasher}
                        washingMachine={washingMachine}
                        dryer={dryer}
                    />

                    {/* Szenen & Modi */}
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

                {/* Schnellzugriff Lichter */}
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
                                className={`p-5 rounded-2xl border transition-all text-left group flex flex-col gap-4 card-interactive ${light.state === 'on'
                                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 text-white shadow-xl shadow-blue-500/20'
                                    : 'glass-card border-white/10 hover:border-gray-600'
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

                {/* System Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <section className="glass-card rounded-2xl p-6 border border-white/10">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6">System Status</h3>
                        <div className="space-y-4">
                            {entities.filter(e => e.type === 'appliance' || e.type === 'vacuum').map(app => (
                                <div key={app.id} className="flex items-center justify-between p-4 glass-panel rounded-xl border border-white/5">
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

            {/* Modals */}
            <Modal isOpen={showVacuumModal} onClose={() => setShowVacuumModal(false)} title="🤖 Röbi Staubsauger">
                <VacuumControl

                    state="docked"
                    battery={85}
                    onCleanRoom={handleCleanRoom}
                    onStartCleaning={() => console.log('Start cleaning')}
                    onPause={() => console.log('Pause')}
                    onReturn={() => console.log('Return to dock')}
                />
            </Modal>

            <Modal isOpen={showShoppingModal} onClose={() => setShowShoppingModal(false)} title="🛒 Einkaufsliste">
                <ShoppingList
                    items={shoppingItems}
                    onToggle={handleToggleTodo}
                    onAdd={handleAddTodo}
                    onDelete={handleDeleteTodo}
                />
            </Modal>
        </>
    );
};

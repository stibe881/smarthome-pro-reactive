import React, { useMemo } from 'react';
import { EntityState } from '../types';

interface ApplianceStatusProps {
    name: string;
    icon: string;
    state: 'running' | 'finished' | 'standby';
    remainingTime?: string;
    program?: string;
}

export const ApplianceStatus: React.FC<ApplianceStatusProps> = ({
    name,
    icon,
    state,
    remainingTime,
    program
}) => {
    const isRunning = state === 'running' && remainingTime;
    const isFinished = state === 'finished' || (state !== 'running' && !remainingTime);

    return (
        <div className={`
      p-4 rounded-2xl border transition-all duration-300
      ${isRunning ? 'bg-blue-500/10 border-blue-500/30' :
                isFinished ? 'bg-green-500/10 border-green-500/30' :
                    'bg-white/5 border-white/10'}
    `}>
            <div className="flex items-center gap-4">
                <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center
          ${isRunning ? 'bg-blue-500/20 text-blue-400' :
                        isFinished ? 'bg-green-500/20 text-green-400' :
                            'bg-white/10 text-gray-400'}
        `}>
                    <i className={`fa-solid ${icon} text-xl ${isRunning ? 'animate-pulse' : ''}`} />
                </div>

                <div className="flex-1">
                    <p className="font-bold text-sm">{name}</p>
                    {isRunning && remainingTime && (
                        <p className="text-xs text-blue-400 font-semibold mt-0.5">
                            🕐 noch {remainingTime}
                        </p>
                    )}
                    {isRunning && program && (
                        <p className="text-xs text-gray-400 mt-0.5">{program}</p>
                    )}
                    {isFinished && (
                        <p className="text-xs text-green-400 font-semibold mt-0.5">
                            ✨ Fertig!
                        </p>
                    )}
                </div>

                {isRunning && (
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                )}
                {isFinished && (
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <i className="fa-solid fa-check text-green-400 text-sm" />
                    </div>
                )}
            </div>
        </div>
    );
};

interface AppliancesSectionProps {
    entities: EntityState[];
}

export const AppliancesSection: React.FC<AppliancesSectionProps> = ({ entities }) => {
    // Extract appliance data from HA entities
    const appliances = useMemo(() => {
        const result: {
            dishwasher?: { state: 'running' | 'finished' | 'standby'; remainingTime?: string; program?: string };
            washingMachine?: { state: 'running' | 'finished' | 'standby'; remainingTime?: string; program?: string };
            dryer?: { state: 'running' | 'finished' | 'standby'; current?: number };
        } = {};

        // Geschirrspüler (Dishwasher)
        const dishwasherEntity = entities.find(e =>
            e.id.includes('dishwasher') ||
            e.id.includes('geschirrspuler') ||
            e.name.toLowerCase().includes('geschirrspüler') ||
            e.name.toLowerCase().includes('dishwasher')
        );

        if (dishwasherEntity) {
            const isRunning = dishwasherEntity.state === 'on' || dishwasherEntity.state === 'running';
            const isOff = dishwasherEntity.state === 'off' || dishwasherEntity.state === 'idle';

            result.dishwasher = {
                state: isRunning ? 'running' : isOff ? 'standby' : 'finished',
                remainingTime: dishwasherEntity.attributes?.remaining_time,
                program: dishwasherEntity.attributes?.program || dishwasherEntity.attributes?.current_program
            };
        }

        // Waschmaschine (Washing Machine)
        const washingMachineEntity = entities.find(e =>
            e.id.includes('washing') ||
            e.id.includes('waschmaschine') ||
            e.name.toLowerCase().includes('waschmaschine') ||
            e.name.toLowerCase().includes('washing machine')
        );

        if (washingMachineEntity) {
            const isRunning = washingMachineEntity.state === 'on' || washingMachineEntity.state === 'running';
            const isOff = washingMachineEntity.state === 'off' || washingMachineEntity.state === 'idle';

            result.washingMachine = {
                state: isRunning ? 'running' : isOff ? 'standby' : 'finished',
                remainingTime: washingMachineEntity.attributes?.remaining_time,
                program: washingMachineEntity.attributes?.program || washingMachineEntity.attributes?.current_program
            };
        }

        // Tumbler/Trockner (Dryer)
        const dryerEntity = entities.find(e =>
            e.id.includes('dryer') ||
            e.id.includes('tumbler') ||
            e.id.includes('trockner') ||
            e.name.toLowerCase().includes('trockner') ||
            e.name.toLowerCase().includes('tumbler') ||
            e.name.toLowerCase().includes('dryer')
        );

        if (dryerEntity) {
            const current = typeof dryerEntity.state === 'number' ? dryerEntity.state : parseInt(dryerEntity.state);
            const isRunning = dryerEntity.state === 'on' || dryerEntity.state === 'running' || current >= 12;
            const isOff = dryerEntity.state === 'off' || dryerEntity.state === 'idle';

            result.dryer = {
                state: isRunning ? 'running' : isOff ? 'standby' : 'finished',
                current: !isNaN(current) ? current : undefined
            };
        }

        return result;
    }, [entities]);

    const { dishwasher, washingMachine, dryer } = appliances;

    // Check if any appliance is running
    const anyRunning =
        dishwasher?.state === 'running' ||
        washingMachine?.state === 'running' ||
        (dryer?.current && dryer.current >= 12);

    // Don't show section if no appliances found
    if (!dishwasher && !washingMachine && !dryer) {
        return null;
    }

    return (
        <div className={`
      glass-card p-6 rounded-3xl border transition-all duration-300
      ${anyRunning ? 'border-blue-500/30 ring-2 ring-blue-500/10' : 'border-white/10'}
    `}>
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                    🧺 Haushaltsgeräte
                </h3>
                {anyRunning && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">In Betrieb</span>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                {dishwasher && (
                    <ApplianceStatus
                        name="Geschirrspüler"
                        icon="fa-soap"
                        state={dishwasher.state}
                        remainingTime={dishwasher.remainingTime}
                        program={dishwasher.program}
                    />
                )}

                {washingMachine && (
                    <ApplianceStatus
                        name="Waschmaschine"
                        icon="fa-shirt"
                        state={washingMachine.state}
                        remainingTime={washingMachine.remainingTime}
                        program={washingMachine.program}
                    />
                )}

                {dryer && (
                    <ApplianceStatus
                        name="Tumbler"
                        icon="fa-wind"
                        state={dryer.current && dryer.current >= 12 ? 'running' : dryer.state}
                        remainingTime={dryer.current && dryer.current >= 12 ? 'Trocknen...' : undefined}
                    />
                )}
            </div>
        </div>
    );
};

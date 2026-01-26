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
    // Extract appliance data using specific logic
    const appliances = useMemo(() => {
        const result: {
            dishwasher?: { state: 'running' | 'finished' | 'standby'; remainingTime?: string; program?: string };
            washingMachine?: { state: 'running' | 'finished' | 'standby'; remainingTime?: string; program?: string };
            dryer?: { state: 'running' | 'finished' | 'standby'; current?: number };
        } = {};

        // --- DISHWASHER ---
        const dwEnde = entities.find(e => e.id === 'sensor.adoradish_v2000_programm_ende');
        const dwProg = entities.find(e => e.id === 'sensor.adoradish_v2000_programm');

        if (dwEnde && dwEnde.state && !['unknown', 'unavailable', 'None', ''].includes(String(dwEnde.state))) {
            const endDate = new Date(String(dwEnde.state));
            const now = new Date();
            const diffMs = endDate.getTime() - now.getTime();

            if (diffMs > 0) {
                const hours = Math.floor(diffMs / 3600000);
                const minutes = Math.floor((diffMs % 3600000) / 60000);
                result.dishwasher = {
                    state: 'running',
                    remainingTime: `${hours > 0 ? `${hours} Std ` : ''}${minutes} Min`
                };
            } else {
                result.dishwasher = { state: 'finished' };
            }
        } else if (dwProg && String(dwProg.state) !== 'standby') {
            result.dishwasher = {
                state: 'running',
                program: String(dwProg.state)
            };
        } else {
            // Default check: if not running/known, logic says "Fertig!"
            result.dishwasher = { state: 'finished' };
        }

        // --- WASHING MACHINE ---
        const wmEndeRoh = entities.find(e => e.id === 'sensor.adorawash_v4000_program_ende_rohwert');
        const wmEnde = entities.find(e => e.id === 'sensor.adorawash_v4000_programm_ende');

        if (wmEndeRoh && !['unknown', 'unavailable', 'None', '', '0h00'].includes(String(wmEndeRoh.state))) {
            const raw = String(wmEndeRoh.state); // Expecting "1h30" or similar
            const parts = raw.split('h');
            if (parts.length === 2) {
                const hours = parseInt(parts[0]);
                const minutes = parseInt(parts[1]);
                if (hours > 0 || minutes > 0) {
                    result.washingMachine = {
                        state: 'running',
                        remainingTime: `${hours > 0 ? `${hours} Std ` : ''}${minutes} Min`
                    };
                }
            }
        } else if (wmEnde && (String(wmEnde.state) === 'unknown' || String(wmEnde.state) === 'unavailable')) {
            result.washingMachine = { state: 'finished' };
        }

        // --- DRYER ---
        const dryerCurrent = entities.find(e => e.id === 'sensor.001015699ea263_current');
        if (dryerCurrent) {
            const current = parseFloat(String(dryerCurrent.state));
            if (!isNaN(current)) {
                if (current >= 12) {
                    result.dryer = { state: 'running' };
                } else {
                    result.dryer = { state: 'finished' }; // Or standby, technically logic says "fertig" if else
                }
            }
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
                        state={dryer.state === 'running' ? 'running' : dryer.state}
                        remainingTime={dryer.state === 'running' ? 'Trocknen...' : undefined}
                    />
                )}
            </div>
        </div>
    );
};

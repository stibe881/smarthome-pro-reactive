import React from 'react';

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
    dishwasher?: {
        state: 'running' | 'finished' | 'standby';
        remainingTime?: string;
        program?: string;
    };
    washingMachine?: {
        state: 'running' | 'finished' | 'standby';
        remainingTime?: string;
        program?: string;
    };
    dryer?: {
        state: 'running' | 'finished' | 'standby';
        current?: number;
    };
}

export const AppliancesSection: React.FC<AppliancesSectionProps> = ({
    dishwasher,
    washingMachine,
    dryer
}) => {
    const anyRunning =
        dishwasher?.state === 'running' ||
        washingMachine?.state === 'running' ||
        (dryer?.current && dryer.current >= 12);

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
                        state={dryer.current && dryer.current >= 12 ? 'running' : 'finished'}
                        remainingTime={dryer.current && dryer.current >= 12 ? 'Trocknen...' : undefined}
                    />
                )}
            </div>
        </div>
    );
};

import React from 'react';
import { EntityState } from '../types';

interface EntityWidgetProps {
    entity: EntityState;
    onToggle: (id: string) => void;
}

export const EntityWidget: React.FC<EntityWidgetProps> = ({ entity, onToggle }) => {
    const isOn = entity.state === 'on';

    return (
        <button
            onClick={() => onToggle(entity.id)}
            className={`p-5 rounded-2xl border transition-all text-left group flex flex-col gap-4 ${isOn
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#161616] border-[#262626] hover:border-gray-600'
                }`}
        >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isOn ? 'bg-white/20' : 'bg-white/5 text-gray-400 group-hover:text-white'
                }`}>
                <i className={`fa-solid ${entity.icon}`}></i>
            </div>
            <div>
                <p className="font-bold text-sm truncate">{entity.name}</p>
                <p className={`text-[10px] mt-0.5 uppercase tracking-widest font-bold ${isOn ? 'text-white/60' : 'text-gray-500'
                    }`}>
                    {isOn ? 'Eingeschaltet' : 'Aus'}
                </p>
            </div>
        </button>
    );
};

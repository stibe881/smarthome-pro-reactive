import React from 'react';

interface QuickActionChipProps {
    icon: string;
    label: string;
    active?: boolean;
    badge?: number;
    color?: string;
    onClick: () => void;
}

export const QuickActionChip: React.FC<QuickActionChipProps> = ({
    icon,
    label,
    active = false,
    badge,
    color = 'blue',
    onClick
}) => {
    return (
        <button
            onClick={onClick}
            className={`
        relative flex items-center gap-2.5 px-5 py-3 rounded-full
        glass-card hover:scale-105 active:scale-95 transition-all duration-200
        ${active ? `ring-2 ring-${color}-400 animate-glow bg-${color}-500/10` : ''}
        group
      `}
        >
            <i className={`fa-solid ${icon} text-lg transition-transform group-hover:scale-110 ${active ? `text-${color}-400` : 'text-gray-400'
                }`} />
            <span className={`text-sm font-bold tracking-wide ${active ? `text-${color}-300` : 'text-gray-300'
                }`}>
                {label}
            </span>
            {badge !== undefined && badge > 0 && (
                <span className={`
          absolute -top-1 -right-1 
          min-w-[20px] h-5 px-1.5
          flex items-center justify-center
          text-xs font-black
          bg-red-500 text-white
          rounded-full
          animate-pulse
          shadow-lg shadow-red-500/50
        `}>
                    {badge}
                </span>
            )}
        </button>
    );
};

interface SceneButtonProps {
    name: string;
    icon: string;
    color: string;
    onClick: () => void;
}

export const SceneButton: React.FC<SceneButtonProps> = ({ name, icon, color, onClick }) => {
    const colorMap: Record<string, string> = {
        orange: 'from-orange-500 to-red-500',
        purple: 'from-purple-500 to-pink-500',
        gray: 'from-gray-600 to-gray-800',
        blue: 'from-blue-500 to-cyan-500',
        green: 'from-green-500 to-emerald-500',
    };

    return (
        <button
            onClick={onClick}
            className={`
        relative p-6 rounded-3xl overflow-hidden
        bg-gradient-to-br ${colorMap[color] || colorMap.blue}
        hover:scale-105 active:scale-95
        transition-all duration-300
        group
        shadow-xl hover:shadow-2xl
      `}
        >
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
            <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i className={`fa-solid ${icon} text-3xl text-white`} />
                </div>
                <span className="text-white font-bold text-lg tracking-wide">{name}</span>
            </div>
        </button>
    );
};

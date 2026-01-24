import React from 'react';

interface BottomNavProps {
    activeView: string;
    onNavigate: (view: string) => void;
    menu: Array<{ id: string; icon: string; label: string }>;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeView, onNavigate, menu }) => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-white/10 safe-area-bottom">
            <div className="flex justify-around items-center px-2 py-1">
                {menu.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-xl transition-all duration-200 ${activeView === item.id
                            ? 'text-blue-500'
                            : 'text-gray-500 active:text-gray-300'
                            }`}
                    >
                        <i className={`fa-solid ${item.icon} text-xl mb-1 ${activeView === item.id ? 'scale-110' : ''
                            } transition-transform`}></i>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>
        </nav>
    );
};

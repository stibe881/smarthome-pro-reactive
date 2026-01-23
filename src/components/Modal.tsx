import React, { ReactNode } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden glass-card rounded-3xl border border-white/20 shadow-2xl animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 className="text-2xl font-bold gradient-text">{title}</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl glass-panel hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center justify-center group"
                    >
                        <i className="fa-solid fa-times text-gray-400 group-hover:text-red-400 transition-colors" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)] no-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};

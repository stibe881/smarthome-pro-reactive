import React, { useState } from 'react';

interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
}

interface ShoppingListProps {
    items?: TodoItem[];
    onToggle?: (id: string) => void;
    onAdd?: (text: string) => void;
    onDelete?: (id: string) => void;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({
    items = [],
    onToggle = () => { },
    onAdd = () => { },
    onDelete = () => { },
}) => {
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (newItem.trim()) {
            onAdd(newItem.trim());
            setNewItem('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAdd();
        }
    };

    const activeItems = items.filter(item => !item.completed);
    const completedItems = items.filter(item => item.completed);

    return (
        <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">🛒 Einkaufsliste</h3>
                {items.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="badge badge-info text-xs">{activeItems.length} offen</span>
                        {completedItems.length > 0 && (
                            <span className="badge badge-success text-xs">{completedItems.length} erledigt</span>
                        )}
                    </div>
                )}
            </div>

            {/* Add New Item */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Neues Item hinzufügen..."
                    className="flex-1 glass-panel rounded-2xl px-4 py-3 text-sm border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                    onClick={handleAdd}
                    disabled={!newItem.trim()}
                    className="btn-gradient px-6 py-3 rounded-2xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <i className="fa-solid fa-plus" />
                </button>
            </div>

            {/* Items List */}
            <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
                {/* Active Items */}
                {activeItems.length > 0 && (
                    <div className="space-y-2">
                        {activeItems.map(item => (
                            <div
                                key={item.id}
                                className="flex items-center gap-3 p-3 glass-panel rounded-2xl border border-white/10 group hover:border-white/20 transition-all"
                            >
                                <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() => onToggle(item.id)}
                                    className="w-5 h-5 rounded border-2 border-gray-500 bg-transparent checked:bg-green-500 checked:border-green-500 cursor-pointer transition-all"
                                />
                                <span className="flex-1 font-medium text-sm">{item.text}</span>
                                <button
                                    onClick={() => onDelete(item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                                >
                                    <i className="fa-solid fa-trash text-xs" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Completed Items */}
                {completedItems.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Erledigt</p>
                        {completedItems.map(item => (
                            <div
                                key={item.id}
                                className="flex items-center gap-3 p-3 glass-panel rounded-2xl border border-white/5 group opacity-60 hover:opacity-100 transition-all"
                            >
                                <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() => onToggle(item.id)}
                                    className="w-5 h-5 rounded border-2 border-green-500 bg-green-500 cursor-pointer"
                                />
                                <span className="flex-1 font-medium text-sm line-through text-gray-500">{item.text}</span>
                                <button
                                    onClick={() => onDelete(item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                                >
                                    <i className="fa-solid fa-trash text-xs" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {items.length === 0 && (
                    <div className="text-center py-8">
                        <i className="fa-solid fa-cart-shopping text-4xl text-gray-600 mb-3" />
                        <p className="text-gray-500 text-sm">Keine Items in der Einkaufsliste</p>
                        <p className="text-gray-600 text-xs mt-1">Füge dein erstes Item hinzu!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

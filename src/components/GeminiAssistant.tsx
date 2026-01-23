import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/gemini';
import { EntityState } from '../types';

interface GeminiAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    entities: EntityState[];
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ isOpen, onClose, entities }) => {
    const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!isOpen) return null;

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const response = await geminiService.generateResponse(userMessage, entities);
            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: "Fehler bei der Kommunikation." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-end p-6 pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>

            <div className="relative w-full max-w-md h-[80vh] glass-panel rounded-[2.5rem] flex flex-col overflow-hidden border border-white/10 shadow-2xl pointer-events-auto animate-in">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight">Gemini Assistant</h2>
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">AI Core Connected</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                            <i className="fa-solid fa-comment-dots text-4xl mb-4"></i>
                            <p className="text-sm font-medium">Was kann ich heute für Sie tun?</p>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${m.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white/5 text-slate-200 border border-white/5'
                                }`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/5 bg-black/20">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Fragen Sie etwas über Ihr Zuhause..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className={`absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${input.trim() ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 bg-white/5'
                                }`}
                        >
                            <i className="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

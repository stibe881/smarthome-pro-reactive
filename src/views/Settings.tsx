import React, { useState, useEffect } from 'react';

interface SettingsProps {
    onConnect?: (url: string, token: string) => Promise<boolean>;
    isConnected?: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ onConnect, isConnected }) => {
    const [url, setUrl] = useState(localStorage.getItem('ha_url') || '');
    const [token, setToken] = useState(localStorage.getItem('ha_token') || '');
    const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');

    useEffect(() => {
        if (isConnected) setStatus('success');
    }, [isConnected]);

    const handleSave = async () => {
        if (!url || !token) {
            alert('Bitte URL und Token eingeben');
            return;
        }

        setStatus('connecting');
        localStorage.setItem('ha_url', url);
        localStorage.setItem('ha_token', token);

        try {
            const success = await onConnect?.(url, token);
            if (success) {
                setStatus('success');
            } else {
                setStatus('error');
            }
        } catch (err) {
            setStatus('error');
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-in fade-in">
            <div className="glass-card p-8 md:p-12 rounded-[3rem] border-2 border-white/5 space-y-8 relative overflow-hidden">
                <div className="absolute top-8 right-8">
                    {status === 'connecting' && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Verbinden...</span>
                        </div>
                    )}
                    {status === 'success' && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Verbunden</span>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Fehler</span>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="text-3xl font-black flex items-center gap-4">
                        <i className="fa-solid fa-link text-blue-400"></i>
                        Home Assistant
                    </h3>
                    <p className="text-slate-400 text-sm max-w-xl">
                        Verbinden Sie Ihr Dashboard mit Ihrer Home Assistant Instanz. Erstellen Sie dazu unter Ihrem Profil in HA einen "Langlebigen Zugangs-Token".
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Instanz URL</label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="http://192.168.1.50:8123"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Langlebiger Zugangs-Token</label>
                            <textarea
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all h-40 font-mono text-xs leading-relaxed"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={status === 'connecting'}
                        className={`w-full py-5 rounded-2xl font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 ${status === 'connecting' ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:scale-[1.01] active:scale-[0.99] hover:bg-blue-500 shadow-blue-500/20'
                            }`}
                    >
                        {status === 'connecting' ? (
                            <i className="fa-solid fa-circle-notch animate-spin"></i>
                        ) : (
                            <i className="fa-solid fa-plug-circle-check"></i>
                        )}
                        {status === 'connecting' ? 'PRÜFE VERBINDUNG...' : 'KONFIGURATION SPEICHERN'}
                    </button>

                    {status === 'error' && (
                        <p className="text-center text-red-400 text-xs font-bold animate-bounce mt-4">
                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                            Verbindung fehlgeschlagen. Prüfe URL und Token!
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
                    <h4 className="font-bold mb-4 flex items-center gap-3 text-amber-400">
                        <i className="fa-solid fa-circle-info"></i>
                        Hilfe benötigt?
                    </h4>
                    <ul className="text-xs text-slate-400 space-y-3 leading-relaxed">
                        <li className="flex gap-3"><span className="text-blue-400 font-bold">1.</span> Die URL muss inkl. Port (meist :8123) angegeben werden.</li>
                        <li className="flex gap-3"><span className="text-blue-400 font-bold">2.</span> Achte auf http:// oder https:// je nach deiner HA Konfiguration.</li>
                        <li className="flex gap-3"><span className="text-blue-400 font-bold">3.</span> Den Token findest du in HA ganz unten auf deiner Profil-Seite.</li>
                    </ul>
                </div>
                <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-center items-center text-center">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Version 2.0.0</p>
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400">
                        <i className="fa-solid fa-shield-halved"></i>
                    </div>
                    <p className="text-slate-400 text-xs mt-4">Deine Daten werden lokal in deinem Browser gespeichert.</p>
                </div>
            </div>
        </div>
    );
};

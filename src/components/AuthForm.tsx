import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getInvitationByToken, acceptInvitation } from '../services/invitations';

export const AuthForm: React.FC = () => {
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState<string | null>(null);

    useEffect(() => {
        // Check for invitation token in URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get('invite');

        if (token) {
            setInviteToken(token);
            setIsLogin(false); // Switch to registration mode

            // Validate and load invitation
            getInvitationByToken(token).then(invitation => {
                if (invitation) {
                    setInviteEmail(invitation.email);
                    setEmail(invitation.email);
                } else {
                    setError('Einladung ungültig oder abgelaufen');
                }
            });
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (loginError) throw loginError;
                await login();
            } else {
                // Registration requires invitation
                if (!inviteToken) {
                    throw new Error('Registrierung nur mit Einladung möglich');
                }

                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (signUpError) throw signUpError;

                // Mark invitation as accepted
                await acceptInvitation(inviteToken);

                // Auto-login
                await login();

                // Clear URL parameter
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch (err: any) {
            setError(err.message || 'Ein Fehler ist aufgetreten');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-house-chimney-window text-white text-2xl"></i>
                        </div>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">
                        SMARTHOME <span className="text-blue-500">PRO</span>
                    </h1>
                    <p className="text-gray-600 text-sm font-bold uppercase tracking-widest">Powered by HA</p>
                </div>

                {/* Form */}
                <div className="glass-card p-8 rounded-[3rem] border-2 border-white/5">
                    <h1 className="text-3xl font-black mb-2 text-center">
                        {isLogin ? 'Willkommen zurück!' : 'Einladung annehmen'}
                    </h1>
                    <p className="text-slate-400 text-center mb-8">
                        {isLogin ? 'Melde dich an' : (inviteEmail ? `Konto für ${inviteEmail}` : 'Registrierung nur mit Einladung')}
                    </p>

                    {inviteToken && !isLogin && (
                        <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                            <p className="text-purple-400 text-sm text-center">
                                <i className="fa-solid fa-envelope-open mr-2"></i>
                                Du wurdest eingeladen! Erstelle dein Passwort.
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-400 px-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@beispiel.de"
                                disabled={!!inviteEmail && !isLogin}
                                className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white ${inviteEmail && !isLogin ? 'opacity-50 cursor-not-allowed' : ''
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all`}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-400 px-1">
                                Passwort
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                                <p className="text-red-400 text-sm">
                                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                    {error}
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-5 rounded-2xl font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 ${loading
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:scale-[1.01] active:scale-[0.99] hover:bg-blue-500 shadow-blue-500/20'
                                }`}
                        >
                            {loading ? (
                                <i className="fa-solid fa-circle-notch animate-spin"></i>
                            ) : (
                                <i className="fa-solid fa-right-to-bracket"></i>
                            )}
                            {loading ? 'BITTE WARTEN...' : (isLogin ? 'ANMELDEN' : 'REGISTRIEREN')}
                        </button>
                    </form>

                    {/* Toggle Login/Register - only show Register if invite token present */}
                    <div className="mt-6 flex gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(true);
                                setError('');
                            }}
                            className={`flex-1 py-3 rounded-xl font-bold transition-all ${isLogin
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                }`}
                        >
                            Anmelden
                        </button>

                        {inviteToken && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(false);
                                    setError('');
                                }}
                                className={`flex-1 py-3 rounded-xl font-bold transition-all ${!isLogin
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                Registrieren
                            </button>
                        )}
                    </div>
                </div>

                {!isLogin && inviteToken && (
                    <div className="mt-6 text-center text-xs text-slate-500">
                        <p>Passwort muss mindestens 6 Zeichen lang sein</p>
                    </div>
                )}
            </div>
        </div>
    );
};

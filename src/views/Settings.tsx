import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { changePassword, deactivateUserAccount } from '../services/userManagement';

import { AdminPanel } from './AdminPanel';

export const Settings: React.FC = () => {
    const { user, logout, userRole } = useAuth();

    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    // Password change states
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Account deletion states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Load settings from Supabase on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (!user) return;

            try {
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    // PGRST116 = no rows returned, which is OK
                    throw error;
                }

                if (data) {
                    // URL and Token loading logic removed as state variables are gone
                }
            } catch (err) {
                console.error('Failed to load settings:', err);
            } finally {
                setIsLoadingSettings(false);
            }
        };
        loadSettings();
    }, [user]);





    const handleLogout = async () => {
        try {
            await logout();
            window.location.reload();
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    if (isLoadingSettings) {
        return (
            <div className="flex items-center justify-center h-64">
                <i className="fa-solid fa-circle-notch animate-spin text-blue-500 text-2xl"></i>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-in fade-in">
            {/* User Info Card */}
            <div className="glass-card p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center">
                        <i className="fa-solid fa-user text-white text-lg"></i>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Angemeldet als</p>
                        <p className="text-white font-bold">{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-2xl text-red-400 font-black text-sm transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-right-from-bracket"></i>
                    Abmelden
                </button>
            </div>

            {/* Admin Section - Only for Admins */}
            {userRole === 'admin' && (
                <div className="glass-card p-8 rounded-[2.5rem] border border-blue-500/20">
                    <button
                        onClick={() => setShowAdminPanel(!showAdminPanel)}
                        className="w-full flex items-center justify-between group"
                    >
                        <h4 className="font-bold flex items-center gap-3 text-blue-400 group-hover:text-blue-300 transition-colors">
                            <i className="fa-solid fa-users-gear"></i>
                            Administration
                        </h4>
                        <i className={`fa-solid fa-chevron-down text-gray-500 transition-transform duration-300 ${showAdminPanel ? 'rotate-180' : ''}`}></i>
                    </button>

                    <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${showAdminPanel ? 'max-h-[2000px] mt-6' : 'max-h-0'}`}>
                        <AdminPanel />
                    </div>
                </div>
            )}

            {/* Password Change Section */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
                <h4 className="font-bold mb-6 flex items-center gap-3 text-blue-400">
                    <i className="fa-solid fa-key"></i>
                    Passwort ändern
                </h4>

                {!showPasswordChange ? (
                    <button
                        onClick={() => setShowPasswordChange(true)}
                        className="px-6 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl text-blue-400 font-bold text-sm transition-all"
                    >
                        <i className="fa-solid fa-lock mr-2"></i>
                        Passwort ändern
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Neues Passwort</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Mindestens 8 Zeichen"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Passwort bestätigen</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Passwort wiederholen"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                        {passwordError && (
                            <p className="text-red-400 text-sm">
                                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                {passwordError}
                            </p>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPasswordChange(false);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                    setPasswordError('');
                                }}
                                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={async () => {
                                    setPasswordError('');
                                    if (newPassword.length < 8) {
                                        setPasswordError('Passwort muss mindestens 8 Zeichen lang sein');
                                        return;
                                    }
                                    if (newPassword !== confirmPassword) {
                                        setPasswordError('Passwörter stimmen nicht überein');
                                        return;
                                    }
                                    try {
                                        await changePassword(newPassword);
                                        alert('Passwort erfolgreich geändert!');
                                        setShowPasswordChange(false);
                                        setNewPassword('');
                                        setConfirmPassword('');
                                    } catch (err: any) {
                                        setPasswordError(err.message);
                                    }
                                }}
                                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all"
                            >
                                Speichern
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Account Deletion Section */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-red-500/20">
                <h4 className="font-bold mb-4 flex items-center gap-3 text-red-400">
                    <i className="fa-solid fa-user-slash"></i>
                    Account löschen
                </h4>
                <p className="text-slate-400 text-sm mb-6">
                    Wenn du deinen Account löschst, werden alle deine Daten unwiderruflich gelöscht.
                </p>
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-red-400 font-bold text-sm transition-all"
                >
                    <i className="fa-solid fa-trash mr-2"></i>
                    Account löschen
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card p-8 rounded-[3rem] border-2 border-red-500/20 max-w-md w-full">
                        <i className="fa-solid fa-triangle-exclamation text-red-400 text-5xl mb-4 block text-center"></i>
                        <h2 className="text-2xl font-black mb-4 text-center">Account löschen?</h2>
                        <p className="text-slate-400 text-center mb-6">
                            Diese Aktion kann <span className="text-red-400 font-bold">nicht</span> rückgängig gemacht werden!
                            Bitte gib zur Bestätigung <span className="text-white font-bold">"LÖSCHEN"</span> ein:
                        </p>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="LÖSCHEN"
                            className="w-full bg-white/5 border border-red-500/20 rounded-2xl px-6 py-3 text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all mb-6"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteConfirmText('');
                                }}
                                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={async () => {
                                    if (deleteConfirmText !== 'LÖSCHEN') {
                                        alert('Bitte gib "LÖSCHEN" zur Bestätigung ein');
                                        return;
                                    }
                                    try {
                                        if (!user) return;
                                        await deactivateUserAccount(user.id);
                                        await logout();
                                        window.location.reload();
                                    } catch (err: any) {
                                        alert('Fehler beim Löschen: ' + err.message);
                                    }
                                }}
                                disabled={deleteConfirmText !== 'LÖSCHEN'}
                                className={`flex-1 py-3 rounded-2xl font-bold transition-all ${deleteConfirmText === 'LÖSCHEN'
                                    ? 'bg-red-600 hover:bg-red-500 text-white'
                                    : 'bg-red-600/30 text-red-400/50 cursor-not-allowed'
                                    }`}
                            >
                                Account löschen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

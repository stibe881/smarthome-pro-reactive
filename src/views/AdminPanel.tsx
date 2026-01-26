import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers, updateUserRole, deactivateUserAccount, getCurrentUserRole, type UserProfile } from '../services/userManagement';
import { getAllInvitations, createInvitation, deleteInvitation, type Invitation } from '../services/invitations';
import { supabase } from '../lib/supabase';
import { createUserWithPassword } from '../services/userCreation';

export const AdminPanel: React.FC = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // User Creation states
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [showUserForm, setShowUserForm] = useState(false);
    const [userFormError, setUserFormError] = useState('');

    // HA Configuration states
    const [haUrl, setHaUrl] = useState('');
    const [haToken, setHaToken] = useState('');
    const [haStatus, setHaStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const role = await getCurrentUserRole();
            setIsAdmin(role === 'admin');

            if (role === 'admin') {
                const [userList, inviteList] = await Promise.all([
                    getAllUsers(),
                    getAllInvitations(),
                ]);
                setUsers(userList);
                setInvitations(inviteList);

                // Load HA settings
                if (user) {
                    const { data } = await supabase
                        .from('user_settings')
                        .select('*')
                        .eq('user_id', user.id)
                        .single();

                    if (data) {
                        if (data.ha_url) setHaUrl(data.ha_url);
                        if (data.ha_token) setHaToken(data.ha_token);
                    }
                }
            }
        } catch (err) {
            console.error('Error loading admin data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
        try {
            await updateUserRole(userId, newRole);
            await loadData();
        } catch (err: any) {
            alert('Fehler beim Ändern der Rolle: ' + err.message);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;

        try {
            await deactivateUserAccount(selectedUser.id);
            setShowDeleteConfirm(false);
            setSelectedUser(null);
            await loadData();
        } catch (err: any) {
            alert('Fehler beim Deaktivieren: ' + err.message);
        }
    };

    const handleCreateUser = async () => {
        setUserFormError('');
        if (!newUserEmail || !newUserEmail.includes('@')) {
            setUserFormError('Bitte gültige Email-Adresse eingeben');
            return;
        }

        try {
            if (newUserPassword) {
                // Create user directly with password
                const { user } = await createUserWithPassword(newUserEmail, newUserPassword);

                if (user) {
                    // Critical: Assign default role so user appears in lists and has access
                    await updateUserRole(user.id, 'user');

                    // Inherit HA settings from current admin
                    if (haUrl || haToken) {
                        await supabase.from('user_settings').upsert({
                            user_id: user.id,
                            ha_url: haUrl,
                            ha_token: haToken,
                            updated_at: new Date().toISOString()
                        });
                    }

                    alert('Benutzer erfolgreich erstellt!');
                } else {
                    throw new Error('Benutzer wurde nicht erstellt (keine ID zurückerhalten)');
                }
            } else {
                // Determine logic for invitation-only if regular create is not desired
                await createInvitation(newUserEmail);
                alert('Einladung gesendet!');
            }

            setNewUserEmail('');
            setNewUserPassword('');
            setShowUserForm(false);
            await loadData();
        } catch (err: any) {
            setUserFormError(err.message || 'Fehler beim Erstellen des Benutzers');
        }
    };

    // Recover User Logic
    const [showRecoverForm, setShowRecoverForm] = useState(false);
    const [recoverEmail, setRecoverEmail] = useState('');
    const [recoverPassword, setRecoverPassword] = useState('');

    const handleRecoverUser = async () => {
        if (!recoverEmail || !recoverPassword) {
            alert('Bitte Email und Passwort angeben');
            return;
        }

        try {
            const { recoverUser } = await import('../services/userCreation');
            const { user } = await recoverUser(recoverEmail, recoverPassword);

            if (user) {
                await updateUserRole(user.id, 'user');

                // Inherit HA settings from current admin (restore missing config)
                if (haUrl || haToken) {
                    await supabase.from('user_settings').upsert({
                        user_id: user.id,
                        ha_url: haUrl,
                        ha_token: haToken,
                        updated_at: new Date().toISOString()
                    });
                }

                alert(`Benutzer ${user.email} erfolgreich repariert! Er sollte jetzt in der Liste erscheinen.`);
                setRecoverEmail('');
                setRecoverPassword('');
                setShowRecoverForm(false);
                await loadData();
            }
        } catch (err: any) {
            alert('Fehler: ' + (err.message || 'Konnte Benutzer nicht authentifizieren'));
        }
    };

    const handleDeleteInvite = async (id: string) => {
        try {
            await deleteInvitation(id);
            await loadData();
        } catch (err: any) {
            alert('Fehler beim Löschen: ' + err.message);
        }
    };

    const copyInviteLink = (token: string) => {
        const link = `${window.location.origin}?invite=${token}`;
        navigator.clipboard.writeText(link);
        alert('Einladungslink kopiert!');
    };

    const handleSaveHaConfig = async () => {
        if (!user) return;

        setHaStatus('saving');

        try {
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    ha_url: haUrl,
                    ha_token: haToken,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;

            setHaStatus('success');
            setTimeout(() => setHaStatus('idle'), 3000);
        } catch (err: any) {
            console.error('Error saving HA config:', err);
            setHaStatus('error');
            setTimeout(() => setHaStatus('idle'), 3000);
        }
    };

    const handleSyncHaConfig = async (targetUserId: string) => {
        if (!haUrl || !haToken) {
            alert('Bitte zuerst die Home Assistant Konfiguration (URL & Token) oben eingeben und speichern.');
            return;
        }

        try {
            await supabase.from('user_settings').upsert({
                user_id: targetUserId,
                ha_url: haUrl,
                ha_token: haToken,
                updated_at: new Date().toISOString(),
            });
            alert('Konfiguration erfolgreich an Benutzer übertragen!');
        } catch (err: any) {
            alert('Fehler beim Übertragen: ' + err.message);
        }
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <i className="fa-solid fa-circle-notch animate-spin text-blue-500 text-2xl"></i>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="max-w-5xl mx-auto">
                <div className="glass-card p-12 rounded-[3rem] border-2 border-red-500/20 text-center">
                    <i className="fa-solid fa-shield-halved text-red-400 text-6xl mb-6"></i>
                    <h2 className="text-3xl font-black mb-4">Keine Berechtigung</h2>
                    <p className="text-slate-400">Nur Administratoren können auf die Benutzerverwaltung zugreifen.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in">
            {/* System Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Version Card */}
                <div className="glass-card p-6 rounded-[2rem] border border-white/5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4">
                        <i className="fa-solid fa-shield-halved text-blue-400 text-xl"></i>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Version</p>
                    <p className="text-white font-bold text-lg">2.0.0</p>
                    <p className="text-slate-400 text-xs mt-2">Multi-User Edition</p>
                </div>

                {/* Users Count Card */}
                <div className="glass-card p-6 rounded-[2rem] border border-white/5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4">
                        <i className="fa-solid fa-users text-purple-400 text-xl"></i>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Benutzer</p>
                    <p className="text-white font-bold text-lg">{users.length}</p>
                    <p className="text-slate-400 text-xs mt-2">{users.filter(u => u.role === 'admin').length} Admin(s)</p>
                </div>

                {/* Database Card */}
                <div className="glass-card p-6 rounded-[2rem] border border-white/5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center mb-4">
                        <i className="fa-solid fa-database text-green-400 text-xl"></i>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Datenbank</p>
                    <p className="text-white font-bold text-sm">Supabase</p>
                    <p className="text-slate-400 text-xs mt-2">PostgreSQL RLS</p>
                </div>
            </div>
            {/* User Management Section */}
            <div className="glass-card p-8 rounded-[3rem] border-2 border-white/5">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-400 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-users-gear text-white text-2xl"></i>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black">Benutzerverwaltung</h1>
                            <p className="text-slate-400 text-sm">Rollen verwalten und Zugriff kontrollieren</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <i className="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <input
                        type="text"
                        placeholder="Benutzer suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    />
                </div>
            </div>

            {/* Invitations/User Section */}
            <div className="glass-card p-8 rounded-[3rem] border-2 border-white/5">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-black">Benutzer & Einladungen</h2>
                        <p className="text-slate-400 text-sm">{invitations.filter(i => i.status === 'pending').length} ausstehend</p>
                    </div>
                    <button
                        onClick={() => setShowUserForm(!showUserForm)}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-2xl text-white font-bold transition-all"
                    >
                        <i className="fa-solid fa-user-plus mr-2"></i>
                        Neuer Benutzer
                    </button>
                </div>

                {showUserForm && (
                    <div className="mb-6 p-6 bg-white/5 rounded-2xl border border-white/10">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-2">Email-Adresse</label>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    placeholder="name@beispiel.de"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-2">Initial-Passwort (Optional)</label>
                                <input
                                    type="password"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    placeholder="Mindestens 6 Zeichen"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Wenn leer, wird eine Einladung per Email gesendet (erfordert Email-Dienst).
                                    Mit Passwort wird der Benutzer sofort erstellt.
                                </p>
                            </div>
                            {userFormError && (
                                <p className="text-red-400 text-sm">
                                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                    {userFormError}
                                </p>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowUserForm(false);
                                        setNewUserEmail('');
                                        setNewUserPassword('');
                                        setUserFormError('');
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleCreateUser}
                                    className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all"
                                >
                                    {newUserPassword ? 'Benutzer erstellen' : 'Einladen'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Repair User Modal/Form */}
                {showRecoverForm && (
                    <div className="mb-6 p-6 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                        <h3 className="text-yellow-400 font-bold mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-wrench"></i>
                            Benutzer reparieren (Unsichtbaren User finden)
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-2">Email-Adresse des "unsichtbaren" Benutzers</label>
                                <input
                                    type="email"
                                    value={recoverEmail}
                                    onChange={(e) => setRecoverEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-2">Passwort</label>
                                <input
                                    type="password"
                                    value={recoverPassword}
                                    onChange={(e) => setRecoverPassword(e.target.value)}
                                    placeholder="Das Passwort dieses Benutzers"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                />
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => {
                                        setShowRecoverForm(false);
                                        setRecoverEmail('');
                                        setRecoverPassword('');
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleRecoverUser}
                                    className="flex-1 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold transition-all"
                                >
                                    Reparieren
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!showUserForm && !showRecoverForm && (
                    <div className="flex justify-end mb-4 px-2">
                        <button
                            onClick={() => setShowRecoverForm(true)}
                            className="text-xs text-slate-500 hover:text-slate-300 underline flex items-center gap-1 transition-colors"
                        >
                            <i className="fa-solid fa-ghost"></i>
                            Benutzer erstellt aber nicht sichtbar?
                        </button>
                    </div>
                )}

                <div className="space-y-3">
                    {invitations.filter(i => i.status === 'pending').map(invite => (
                        <div key={invite.id} className="glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-white font-bold">{invite.email}</p>
                                <p className="text-slate-400 text-xs mt-1">
                                    Läuft ab: {new Date(invite.expires_at).toLocaleDateString('de-DE')}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => copyInviteLink(invite.token)}
                                    className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-400 text-sm font-bold transition-all"
                                >
                                    <i className="fa-solid fa-copy"></i>
                                </button>
                                <button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold transition-all"
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}

                    {invitations.filter(i => i.status === 'pending').length === 0 && !showUserForm && (
                        <div className="text-center py-12">
                            <i className="fa-solid fa-envelope text-slate-600 text-5xl mb-4"></i>
                            <p className="text-slate-400">Keine ausstehenden Einladungen</p>
                            <p className="text-slate-500 text-sm mt-2">Klicke auf "Neuer Benutzer" um jemanden einzuladen</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Home Assistant Configuration Section */}
            <div className="glass-card p-8 rounded-[3rem] border-2 border-white/5">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center">
                        <i className="fa-solid fa-home text-white text-2xl"></i>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black">Home Assistant</h2>
                        <p className="text-slate-400 text-sm">System-weite HA-Konfiguration</p>
                    </div>
                </div>

                <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                    <p className="text-blue-400 text-sm">
                        <i className="fa-solid fa-info-circle mr-2"></i>
                        Diese Einstellungen werden für alle Benutzer verwendet. Jeder Benutzer kann die Verbindung individuell in den Optionen testen.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 px-1">
                            Instanz URL
                        </label>
                        <input
                            type="text"
                            value={haUrl}
                            onChange={(e) => setHaUrl(e.target.value)}
                            placeholder="http://192.168.1.50:8123"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 px-1">
                            Long-Lived Access Token
                        </label>
                        <textarea
                            value={haToken}
                            onChange={(e) => setHaToken(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all h-32 font-mono text-xs resize-none"
                        />
                    </div>

                    <button
                        onClick={handleSaveHaConfig}
                        disabled={haStatus === 'saving'}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${haStatus === 'saving'
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:scale-[1.01] active:scale-[0.99] hover:bg-blue-500 shadow-blue-500/20'
                            }`}
                    >
                        {haStatus === 'saving' ? (
                            <>
                                <i className="fa-solid fa-circle-notch animate-spin"></i>
                                <span>SPEICHERN...</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-save"></i>
                                <span>KONFIGURATION SPEICHERN</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* User List */}
            <div className="space-y-4">
                {filteredUsers.map(u => (
                    <div key={u.id} className="glass-card p-6 rounded-[2rem] border border-white/5 hover:border-purple-500/20 transition-all">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${u.role === 'admin' ? 'bg-gradient-to-br from-purple-600 to-purple-400' : 'bg-gradient-to-br from-blue-600 to-blue-400'}`}>
                                    <i className={`fa-solid ${u.role === 'admin' ? 'fa-crown' : 'fa-user'} text-white`}></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white truncate">{u.email}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {u.role === 'admin' ? 'Admin' : 'Benutzer'}
                                        </span>
                                        {u.id === user?.id && (
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                                                Du
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {u.id !== user?.id && (
                                    <>
                                        <button
                                            onClick={() => handleSyncHaConfig(u.id)}
                                            title="HA Konfiguration senden"
                                            className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-400 text-sm font-bold transition-all"
                                        >
                                            <i className="fa-solid fa-sync"></i>
                                        </button>
                                        <button
                                            onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                            className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-purple-400 text-sm font-bold transition-all"
                                        >
                                            <i className="fa-solid fa-user-shield mr-2"></i>
                                            {u.role === 'admin' ? 'Zu User' : 'Zu Admin'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedUser(u);
                                                setShowDeleteConfirm(true);
                                            }}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold transition-all"
                                        >
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredUsers.length === 0 && (
                    <div className="glass-card p-12 rounded-[2rem] border border-white/5 text-center">
                        <i className="fa-solid fa-user-slash text-slate-600 text-5xl mb-4"></i>
                        <p className="text-slate-400">Keine Benutzer gefunden</p>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card p-8 rounded-[3rem] border-2 border-red-500/20 max-w-md w-full">
                        <i className="fa-solid fa-triangle-exclamation text-red-400 text-5xl mb-4 block text-center"></i>
                        <h2 className="text-2xl font-black mb-4 text-center">Benutzer deaktivieren?</h2>
                        <p className="text-slate-400 text-center mb-6">
                            Möchtest du <span className="text-white font-bold">{selectedUser.email}</span> wirklich deaktivieren?
                            Der Benutzer kann sich nicht mehr anmelden und alle Daten werden gelöscht.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setSelectedUser(null);
                                }}
                                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all"
                            >
                                Deaktivieren
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

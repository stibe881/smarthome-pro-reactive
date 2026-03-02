import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Alert, KeyboardAvoidingView, Platform, StyleSheet, Switch, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, Mail, Crown, X, Send, Lock, Eye, EyeOff, Trash2, Key, Shield, ShieldOff, MoreVertical, Camera, UserCheck, CalendarDays, ChevronRight, ChevronDown, Plus, Link2, Baby, Smartphone } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { GuestPermissionsModal } from './GuestPermissionsModal';

// Platform-aware alert helpers (Alert.alert doesn't work on web)
const platformAlert = (title: string, msg: string) => {
    Platform.OS === 'web' ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);
};

const platformConfirm = (title: string, msg: string, onOk: () => void) => {
    if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n${msg}`)) onOk();
    } else {
        Alert.alert(title, msg, [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'OK', onPress: onOk },
        ]);
    }
};

const platformConfirmDestructive = (title: string, msg: string, actionLabel: string, onOk: () => void) => {
    if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n${msg}`)) onOk();
    } else {
        Alert.alert(title, msg, [
            { text: 'Abbrechen', style: 'cancel' },
            { text: actionLabel, style: 'destructive', onPress: onOk },
        ]);
    }
};

interface FamilyMember {
    id: string;
    user_id: string;
    email: string;
    display_name?: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
    avatar_url?: string;
    planner_access?: boolean;
    allowed_modules?: string[] | null;
}

const ALL_FAMILY_MODULES: { key: string; label: string }[] = [
    { key: 'calendar', label: 'Kalender' },
    { key: 'todos', label: 'Aufgaben' },
    { key: 'shopping', label: 'Einkaufsliste' },
    { key: 'meals', label: 'Essensplaner' },
    { key: 'pinboard', label: 'Pinnwand' },
    { key: 'rewards', label: 'Belohnungen' },
    { key: 'contacts', label: 'Kontakte' },
    { key: 'routines', label: 'Routinen' },
    { key: 'locations', label: 'Standort' },
    { key: 'celebrations', label: 'Geburtstage' },
    { key: 'packing', label: 'Packlisten' },
    { key: 'countdowns', label: 'Countdowns' },
    { key: 'weekly', label: 'Wochenübersicht' },
    { key: 'recipes', label: 'Rezeptbuch' },
    { key: 'documents', label: 'Dokumentsafe' },
];

interface Invitation {
    id: string;
    email: string;
    status: string;
    created_at: string;
}

interface FamilyManagementProps {
    colors: any;
    onClose?: () => void;
}

export const FamilyManagement = ({ colors, onClose }: FamilyManagementProps) => {
    const { user, userRole, resetMemberPassword, removeMember, toggleMemberAccess, startImpersonation, impersonatedRole } = useAuth();
    const router = useRouter();
    const { householdId } = useHousehold();
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showInviteFlow, setShowInviteFlow] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [inviteRole, setInviteRole] = useState<'member' | 'guest'>('member');
    const [invitePlannerAccess, setInvitePlannerAccess] = useState(true);

    // Child creation
    const [showAddChildModal, setShowAddChildModal] = useState(false);
    const [childName, setChildName] = useState('');
    const [isAddingChild, setIsAddingChild] = useState(false);

    // Administrative Modals
    const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [newMemberPassword, setNewMemberPassword] = useState('');
    const [forcePasswordChange, setForcePasswordChange] = useState(true);
    const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [showGuestPermissions, setShowGuestPermissions] = useState(false);
    const [dismissingForImpersonate, setDismissingForImpersonate] = useState(false);
    const [editDisplayName, setEditDisplayName] = useState('');
    const [modulesExpanded, setModulesExpanded] = useState(false);

    useEffect(() => {
        loadFamilyData();
    }, []);

    const loadFamilyData = async () => {
        try {
            const { data: myMemberData } = await supabase
                .from('family_members')
                .select('household_id')
                .eq('user_id', user?.id)
                .single();

            const myHouseholdId = myMemberData?.household_id;

            if (myHouseholdId) {
                const { data: membersData } = await supabase
                    .from('family_members')
                    .select('*')
                    .eq('household_id', myHouseholdId)
                    .order('created_at', { ascending: true });

                if (membersData) setMembers(membersData);
            } else {
                // No household yet - only show the current user
                setMembers([]);
            }

            if (myHouseholdId) {
                const { data: invitesData } = await supabase
                    .from('family_invitations')
                    .select('*')
                    .eq('household_id', myHouseholdId)
                    .eq('status', 'pending');
                if (invitesData) setInvitations(invitesData);
            }
        } catch (e) {
            console.error('Error loading family data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddChild = async () => {
        if (!childName.trim()) {
            platformAlert('Fehler', 'Bitte einen Namen eingeben.');
            return;
        }
        setIsAddingChild(true);
        try {
            // Get household ID
            const { data: myMember } = await supabase
                .from('family_members')
                .select('household_id')
                .eq('user_id', user?.id)
                .single();

            if (!myMember?.household_id) {
                platformAlert('Fehler', 'Kein Haushalt gefunden.');
                return;
            }

            // Create a child entry - no auth user needed
            const { error } = await supabase.from('family_members').insert({
                household_id: myMember.household_id,
                user_id: null,
                email: `${childName.trim().toLowerCase().replace(/\s+/g, '.')}@kind.lokal`,
                display_name: childName.trim(),
                role: 'child',
                is_active: true,
                planner_access: true,
            });

            if (error) {
                console.error('Error adding child:', error);
                platformAlert('Fehler', error.message);
                return;
            }

            platformAlert('Erfolgreich', `${childName.trim()} wurde hinzugefügt.`);
            setChildName('');
            setShowAddChildModal(false);
            loadFamilyData();
        } catch (e: any) {
            platformAlert('Fehler', e?.message || 'Unbekannter Fehler');
        } finally {
            setIsAddingChild(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim() || invitePassword.length < 6) {
            platformAlert('Fehler', 'Ungültige Eingaben');
            return;
        }

        setIsInviting(true);
        try {
            console.log('[FamilyManagement] Invoking create-family-member...');
            const { data, error } = await supabase.functions.invoke('create-family-member', {
                body: { email: inviteEmail.trim(), password: invitePassword, role: inviteRole, planner_access: invitePlannerAccess, display_name: inviteName.trim() || undefined },
            });

            console.log('[FamilyManagement] Response data:', JSON.stringify(data));
            console.log('[FamilyManagement] Response error:', JSON.stringify(error));

            if (error) {
                const errorDetail = error?.message || 'Unbekannter Fehler';
                let responseBody = '';
                try {
                    if ((error as any)?.context?.body) {
                        const reader = (error as any).context.body.getReader();
                        const { value } = await reader.read();
                        responseBody = new TextDecoder().decode(value);
                    }
                } catch (e) { /* ignore */ }
                console.log('[FamilyManagement] Error detail:', errorDetail, 'Body:', responseBody);
                platformAlert('Fehler', responseBody || errorDetail);
                return;
            }

            if (data && data.error) {
                platformAlert('Fehler', data.error);
                return;
            }

            platformAlert('Erfolgreich', `${inviteName.trim() || inviteEmail} wurde hinzugefügt.`);
            // Save display_name if provided
            if (inviteName.trim() && data?.user_id && householdId) {
                await supabase.from('family_members')
                    .update({ display_name: inviteName.trim() })
                    .eq('household_id', householdId)
                    .eq('user_id', data.user_id);
            }
            setShowInviteModal(false);
            setInviteEmail('');
            setInvitePassword('');
            setInviteName('');
            setInviteRole('member');
            setInvitePlannerAccess(true);
            loadFamilyData();
        } catch (error: any) {
            console.error('[FamilyManagement] Catch error:', error);
            platformAlert('Fehler', error?.message || 'Verbindungsfehler');
        } finally {
            setIsInviting(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedMember || newMemberPassword.length < 6) {
            platformAlert('Fehler', 'Passwort muss mind. 6 Zeichen haben.');
            return;
        }
        setIsAdminActionLoading(true);
        try {
            await resetMemberPassword(selectedMember.user_id || selectedMember.id, newMemberPassword, forcePasswordChange);
            platformAlert('Erfolg', forcePasswordChange ? 'Passwort wurde zurückgesetzt. Der User muss es beim nächsten Login ändern.' : 'Passwort wurde zurückgesetzt.');
            setNewMemberPassword('');
        } catch (e: any) {
            platformAlert('Fehler', e.message);
        } finally {
            setIsAdminActionLoading(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!selectedMember) return;
        const memberLabel = selectedMember.display_name || selectedMember.email || 'Mitglied';
        platformConfirmDestructive(
            'Mitglied endgültig entfernen',
            `"${memberLabel}" wird aus der Familie entfernt und alle zugehörigen Daten (Aufgaben, Punkte, Verlauf) werden gelöscht. Fortfahren?`,
            'Endgültig entfernen',
            async () => {
                setIsAdminActionLoading(true);
                try {
                    const memberId = selectedMember.id;
                    const memberName = selectedMember.display_name || selectedMember.email?.split('@')[0] || '';

                    // 1. Clean up todos assigned to this member
                    await supabase.from('family_todos')
                        .update({ assigned_to: null })
                        .eq('assigned_to', memberId);

                    // 2. Clean up reward_points
                    if (householdId && memberName) {
                        await supabase.from('reward_points')
                            .delete()
                            .eq('household_id', householdId)
                            .eq('member_name', memberName);

                        // 3. Clean up reward_history
                        await supabase.from('reward_history')
                            .delete()
                            .eq('household_id', householdId)
                            .eq('member_name', memberName);
                    }

                    // 4. Delete the family member itself
                    const { error } = await supabase.from('family_members')
                        .delete()
                        .eq('id', memberId);
                    if (error) throw error;

                    loadFamilyData();
                    setShowAdminModal(false);
                } catch (e: any) {
                    platformAlert('Fehler', e.message);
                } finally {
                    setIsAdminActionLoading(false);
                }
            }
        );
    };

    const handleToggleAccess = async (active: boolean) => {
        if (!selectedMember) return;
        setIsAdminActionLoading(true);
        try {
            await toggleMemberAccess(selectedMember.user_id || selectedMember.id, active);
            loadFamilyData();
            setSelectedMember({ ...selectedMember, is_active: active });
        } catch (e: any) {
            platformAlert('Fehler', e.message);
        } finally {
            setIsAdminActionLoading(false);
        }
    };

    const handleTogglePlannerAccess = async (enabled: boolean) => {
        if (!selectedMember) return;
        const memberName = selectedMember.display_name || selectedMember.email?.split('@')[0] || '';

        if (!enabled) {
            // Show warning before deactivating
            platformConfirmDestructive(
                'Familienplaner deaktivieren',
                `Wenn du den Familienplaner für "${memberName}" deaktivierst, werden auch alle Belohnungspunkte und der Verlauf dieses Mitglieds gelöscht. Fortfahren?`,
                'Deaktivieren',
                async () => {
                    try {
                        // 1. Remove reward data
                        if (householdId && memberName) {
                            await supabase.from('reward_points')
                                .delete()
                                .eq('household_id', householdId)
                                .eq('member_name', memberName);
                            await supabase.from('reward_history')
                                .delete()
                                .eq('household_id', householdId)
                                .eq('member_name', memberName);
                        }
                        // 2. Disable planner access
                        await supabase
                            .from('family_members')
                            .update({ planner_access: false })
                            .eq('user_id', selectedMember.user_id);
                        setSelectedMember({ ...selectedMember, planner_access: false });
                        loadFamilyData();
                    } catch (e: any) {
                        platformAlert('Fehler', e.message);
                    }
                }
            );
        } else {
            // Enabling — no warning needed
            try {
                await supabase
                    .from('family_members')
                    .update({ planner_access: true })
                    .eq('user_id', selectedMember.user_id);
                setSelectedMember({ ...selectedMember, planner_access: true });
                loadFamilyData();
            } catch (e: any) {
                platformAlert('Fehler', e.message);
            }
        }
    };

    const handleToggleModule = async (moduleKey: string, enabled: boolean) => {
        if (!selectedMember) return;
        const currentModules = selectedMember.allowed_modules || ALL_FAMILY_MODULES.map(m => m.key);
        const memberName = selectedMember.display_name || selectedMember.email?.split('@')[0] || '';

        // Special handling: warn when disabling 'rewards'
        if (moduleKey === 'rewards' && !enabled) {
            platformConfirmDestructive(
                'Belohnungen deaktivieren',
                `Alle Punkte und der Verlauf von "${memberName}" werden gelöscht. Fortfahren?`,
                'Deaktivieren',
                async () => {
                    try {
                        // 1. Remove reward data
                        if (householdId && memberName) {
                            await supabase.from('reward_points')
                                .delete()
                                .eq('household_id', householdId)
                                .eq('member_name', memberName);
                            await supabase.from('reward_history')
                                .delete()
                                .eq('household_id', householdId)
                                .eq('member_name', memberName);
                        }
                        // 2. Update modules
                        const newModules = currentModules.filter(m => m !== moduleKey);
                        await supabase
                            .from('family_members')
                            .update({ allowed_modules: newModules })
                            .eq('user_id', selectedMember.user_id);
                        setSelectedMember({ ...selectedMember, allowed_modules: newModules });
                        loadFamilyData();
                    } catch (e: any) {
                        platformAlert('Fehler', e.message);
                    }
                }
            );
            return;
        }

        // Normal toggle for other modules
        const newModules = enabled
            ? [...currentModules, moduleKey]
            : currentModules.filter(m => m !== moduleKey);
        try {
            await supabase
                .from('family_members')
                .update({ allowed_modules: newModules })
                .eq('user_id', selectedMember.user_id);
            setSelectedMember({ ...selectedMember, allowed_modules: newModules });
            loadFamilyData();
        } catch (e: any) {
            platformAlert('Fehler', e.message);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };
    const getAvatarColor = (index: number) => {
        const palettes = [['#EC4899', '#DB2777'], ['#3B82F6', '#1D4ED8'], ['#8B5CF6', '#6D28D9'], ['#10B981', '#059669'], ['#F59E0B', '#D97706']];
        return palettes[index % palettes.length];
    };
    const getRoleLabel = (member: FamilyMember) => {
        if (member.email === user?.email && member.role === 'admin') return 'Gründer';
        if (member.role === 'admin') return 'Admin';
        if (member.role === 'guest') return 'Gast';
        if (member.role === 'child') return 'Kind';
        return 'Mitglied';
    };

    const getAvatarPublicUrl = (avatarPath: string) => {
        const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
        return data.publicUrl;
    };

    const handleUploadMemberAvatar = async () => {
        if (!selectedMember) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (result.canceled) return;
            setIsUploadingAvatar(true);

            const uri = result.assets[0].uri;
            const file = new FileSystem.File(uri);
            const arrayBuffer = await file.arrayBuffer();

            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpeg';
            const fileName = `${selectedMember.user_id}-${Date.now()}.${fileExt}`;
            const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, arrayBuffer, { contentType, upsert: true });

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase
                .from('family_members')
                .update({ avatar_url: fileName })
                .eq('user_id', selectedMember.user_id);

            if (dbError) throw dbError;

            platformAlert('Erfolg', 'Profilbild aktualisiert.');
            setSelectedMember({ ...selectedMember, avatar_url: fileName });
            loadFamilyData();
        } catch (e: any) {
            console.error('Avatar upload error:', e);
            platformAlert('Fehler', e.message || 'Upload fehlgeschlagen.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    if (isLoading) return <ActivityIndicator size="small" color={colors.accent} style={{ padding: 20 }} />;

    return (
        <View style={styles.container}>
            {/* Section: Members */}
            <Text style={[styles.sectionHeader, { color: colors.subtext, borderBottomColor: colors.border }]}>MITGLIEDER DIESES CIRCLES</Text>
            <View style={styles.list}>
                {members.map((member, index) => (
                    <Pressable
                        key={member.id}
                        style={[styles.memberCard, { backgroundColor: colors.card, opacity: member.is_active === false ? 0.6 : 1 }]}
                        onPress={() => {
                            if (userRole === 'admin') {
                                setSelectedMember(member);
                                setEditDisplayName(member.display_name || '');
                                setShowAdminModal(true);
                            }
                        }}
                    >
                        {member.avatar_url ? (
                            <Image source={{ uri: getAvatarPublicUrl(member.avatar_url) }} style={styles.avatar} />
                        ) : (
                            <LinearGradient colors={getAvatarColor(index) as any} style={styles.avatar}>
                                <Text style={styles.avatarText}>{getInitials(member.display_name || member.email)}</Text>
                            </LinearGradient>
                        )}
                        <View style={styles.memberInfo}>
                            <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{member.display_name || member.email}</Text>
                            <Text style={[styles.memberRole, { color: colors.subtext }]}>{getRoleLabel(member)}{member.email === user?.email ? ' · Du' : ''}{member.is_active === false ? ' · Deaktiviert' : ''}</Text>
                        </View>
                        {member.is_active !== false && (
                            <View style={{ alignItems: 'center' }}>
                                <Smartphone size={16} color={colors.subtext} />
                                <Text style={{ color: colors.subtext, fontSize: 9, marginTop: 2 }}>Online</Text>
                            </View>
                        )}
                    </Pressable>
                ))}

                {invitations.map(invite => (
                    <View key={invite.id} style={[styles.memberCard, { backgroundColor: colors.card }]}>
                        <View style={[styles.avatar, { backgroundColor: '#F59E0B30' }]}>
                            <Mail size={16} color="#F59E0B" />
                        </View>
                        <View style={styles.memberInfo}>
                            <Text style={[styles.memberName, { color: colors.text }]}>{invite.email}</Text>
                            <Text style={{ color: '#F59E0B', fontSize: 12 }}>Einladung ausstehend</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Section: Invite */}
            {userRole === 'admin' && (
                <>
                    <Text style={[styles.sectionHeader, { color: colors.subtext, borderBottomColor: colors.border }]}>NEUE MITGLIEDER EINLADEN</Text>
                    <Pressable onPress={() => setShowInviteFlow(true)} style={[styles.memberCard, { backgroundColor: colors.card }]}>
                        <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                            <Plus size={20} color={colors.text} />
                        </View>
                        <View style={styles.memberInfo}>
                            <Text style={[styles.memberName, { color: colors.text }]}>Neue Mitglieder einladen</Text>
                            <Text style={[styles.memberRole, { color: colors.subtext }]}>Alle Geliebten sind willkommen</Text>
                        </View>
                    </Pressable>
                </>
            )}

            {/* Admin Modal */}
            <Modal visible={showAdminModal} animationType={dismissingForImpersonate ? 'none' : 'slide'} presentationStyle={dismissingForImpersonate ? 'overFullScreen' : 'pageSheet'} onRequestClose={() => setShowAdminModal(false)}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Mitglied verwalten</Text>
                        <Pressable onPress={() => setShowAdminModal(false)}><X size={24} color={colors.subtext} /></Pressable>
                    </View>
                    {selectedMember && (
                        <ScrollView style={{ padding: 16 }}>
                            <View style={styles.selectedHeader}>
                                <Pressable onPress={handleUploadMemberAvatar} disabled={isUploadingAvatar}>
                                    {selectedMember.avatar_url ? (
                                        <Image source={{ uri: getAvatarPublicUrl(selectedMember.avatar_url) }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                                    ) : (
                                        <LinearGradient colors={getAvatarColor(0) as any} style={[styles.avatar, { width: 64, height: 64, borderRadius: 32 }]}>
                                            <Text style={[styles.avatarText, { fontSize: 24 }]}>{getInitials(selectedMember.email)}</Text>
                                        </LinearGradient>
                                    )}
                                    <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.accent, borderRadius: 12, padding: 4 }}>
                                        {isUploadingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={14} color="#fff" />}
                                    </View>
                                </Pressable>
                                <Text style={[styles.selectedEmail, { color: colors.text }]}>{selectedMember.display_name || selectedMember.email}</Text>
                                <Text style={[styles.memberRole, { color: colors.subtext }]}>{selectedMember.role === 'admin' ? 'Administrator' : selectedMember.role === 'guest' ? 'Gast' : selectedMember.role === 'child' ? 'Kind' : 'Familienmitglied'}</Text>
                                {selectedMember.email && selectedMember.display_name && !selectedMember.email.endsWith('@kind.lokal') && (
                                    <Text style={[styles.memberRole, { color: colors.subtext, fontSize: 12, marginTop: 2 }]}>{selectedMember.email}</Text>
                                )}
                            </View>

                            {/* Display Name Editor */}
                            <View style={[styles.adminSection, { borderTopColor: colors.border }]}>
                                <Text style={[styles.label, { color: colors.subtext }]}>Anzeigename</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                    <TextInput
                                        style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                                        value={editDisplayName}
                                        onChangeText={setEditDisplayName}
                                        placeholder="Anzeigename eingeben"
                                        placeholderTextColor={colors.subtext}
                                    />
                                    <Pressable
                                        onPress={async () => {
                                            if (!editDisplayName.trim()) {
                                                platformAlert('Fehler', 'Bitte einen Namen eingeben.');
                                                return;
                                            }
                                            try {
                                                const updateFilter = selectedMember.user_id
                                                    ? { user_id: selectedMember.user_id }
                                                    : { id: selectedMember.id };
                                                await supabase.from('family_members')
                                                    .update({ display_name: editDisplayName.trim() })
                                                    .match(updateFilter);
                                                setSelectedMember({ ...selectedMember, display_name: editDisplayName.trim() });
                                                loadFamilyData();
                                                platformAlert('Gespeichert', 'Anzeigename wurde aktualisiert.');
                                            } catch (e: any) {
                                                platformAlert('Fehler', e.message);
                                            }
                                        }}
                                        style={[styles.actionBtn, { backgroundColor: colors.accent, paddingHorizontal: 16 }]}
                                    >
                                        <Text style={styles.actionBtnText}>Speichern</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View style={[styles.adminSection, { borderTopColor: colors.border }]}>
                                <View style={styles.adminRow}>
                                    <Text style={[styles.label, { color: colors.text }]}>Zugriff erlaubt</Text>
                                    <Switch
                                        value={selectedMember.is_active !== false}
                                        onValueChange={handleToggleAccess}
                                        trackColor={{ false: '#334155', true: colors.accent }}
                                    />
                                </View>
                                <View style={[styles.adminRow, { marginTop: 12 }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <CalendarDays size={16} color={colors.subtext} />
                                        <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Familienplaner</Text>
                                    </View>
                                    <Switch
                                        value={selectedMember.planner_access !== false}
                                        onValueChange={handleTogglePlannerAccess}
                                        trackColor={{ false: '#334155', true: '#10B981' }}
                                    />
                                </View>
                            </View>

                            {/* Module Access Toggles – shown when planner access is enabled */}
                            {selectedMember.planner_access !== false && (
                                <View style={[styles.adminSection, { borderTopColor: colors.border }]}>
                                    <Pressable onPress={() => setModulesExpanded(!modulesExpanded)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={[styles.label, { color: colors.subtext, marginBottom: 0 }]}>Family-Hub Module</Text>
                                        {modulesExpanded ? <ChevronDown size={18} color={colors.subtext} /> : <ChevronRight size={18} color={colors.subtext} />}
                                    </Pressable>
                                    {modulesExpanded && (
                                        <View style={{ marginTop: 12 }}>
                                            {ALL_FAMILY_MODULES.map((mod, idx) => {
                                                const memberModules = selectedMember.allowed_modules || ALL_FAMILY_MODULES.map(m => m.key);
                                                const isEnabled = memberModules.includes(mod.key);
                                                return (
                                                    <View key={mod.key} style={[styles.adminRow, idx > 0 && { marginTop: 8 }]}>
                                                        <Text style={[styles.label, { color: colors.text, marginBottom: 0, fontSize: 14 }]}>{mod.label}</Text>
                                                        <Switch
                                                            value={isEnabled}
                                                            onValueChange={(val) => handleToggleModule(mod.key, val)}
                                                            trackColor={{ false: '#334155', true: '#10B981' }}
                                                        />
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={[styles.adminSection, { borderTopColor: colors.border }]}>
                                <Text style={[styles.label, { color: colors.subtext }]}>Passwort zurücksetzen</Text>
                                <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', borderColor: colors.border, backgroundColor: colors.card, marginTop: 8 }]}>
                                    <TextInput
                                        style={{ flex: 1, color: colors.text }}
                                        value={newMemberPassword}
                                        onChangeText={setNewMemberPassword}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                        placeholder="Neues Passwort (min. 6)"
                                        placeholderTextColor={colors.subtext}
                                    />
                                    <Pressable onPress={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} color={colors.subtext} /> : <Eye size={18} color={colors.subtext} />}</Pressable>
                                </View>
                                <View style={[styles.adminRow, { marginTop: 12 }]}>
                                    <Text style={[styles.label, { color: colors.text, marginBottom: 0, fontSize: 14 }]}>Passwortänderung erzwingen</Text>
                                    <Switch
                                        value={forcePasswordChange}
                                        onValueChange={setForcePasswordChange}
                                        trackColor={{ false: '#334155', true: colors.accent }}
                                    />
                                </View>
                                <Pressable onPress={handleResetPassword} disabled={isAdminActionLoading} style={[styles.actionBtn, { backgroundColor: colors.accent, marginTop: 12 }]}>
                                    <Key size={18} color="#fff" />
                                    <Text style={styles.actionBtnText}>Daten aktualisieren</Text>
                                </Pressable>
                            </View>

                            {/* Guest Permissions Button */}
                            {selectedMember.role === 'guest' && (
                                <View style={[styles.adminSection, { borderTopColor: colors.border }]}>
                                    <Pressable
                                        onPress={() => {
                                            setShowAdminModal(false);
                                            setTimeout(() => setShowGuestPermissions(true), 350);
                                        }}
                                        style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
                                    >
                                        <Shield size={18} color="#fff" />
                                        <Text style={styles.actionBtnText}>Gast-Berechtigungen verwalten</Text>
                                    </Pressable>
                                </View>
                            )}

                            {/* View as this member */}
                            <View style={[styles.adminSection, { borderTopColor: colors.border }]}>
                                <Pressable
                                    onPress={() => {
                                        // Map DB roles to AuthContext roles: 'member' and 'child' -> 'user'
                                        const memberRole = (selectedMember.role === 'admin' || selectedMember.role === 'guest') ? selectedMember.role : 'user';
                                        const memberName = selectedMember.display_name || selectedMember.email?.split('@')[0] || 'Mitglied';
                                        // Step 1: Switch admin modal to no-animation mode
                                        setDismissingForImpersonate(true);
                                        // Step 2: After next render (no-animation applied), close all modals + navigate
                                        setTimeout(() => {
                                            setShowAdminModal(false);
                                            if (onClose) onClose(); // triggers family modal instant-dismiss
                                            // Step 3: After modals dismissed, navigate and impersonate
                                            setTimeout(() => {
                                                startImpersonation(memberRole, memberName, selectedMember.user_id);
                                                router.replace('/(tabs)/');
                                            }, 100);
                                        }, 50);
                                    }}
                                    style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
                                >
                                    <Eye size={18} color="#fff" />
                                    <Text style={styles.actionBtnText}>Ansicht als {selectedMember.display_name || selectedMember.email?.split('@')[0]}</Text>
                                </Pressable>
                            </View>

                            <View style={[styles.adminSection, { borderTopColor: colors.border, marginTop: 20 }]}>
                                <Pressable onPress={handleRemoveMember} disabled={isAdminActionLoading} style={[styles.actionBtn, { backgroundColor: '#ef4444', opacity: 0.9 }]}>
                                    <Trash2 size={18} color="#fff" />
                                    <Text style={styles.actionBtnText}>Mitglied permanent entfernen</Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </Modal>

            {/* Guest Permissions Modal */}
            {selectedMember && selectedMember.role === 'guest' && (
                <GuestPermissionsModal
                    visible={showGuestPermissions}
                    onClose={() => setShowGuestPermissions(false)}
                    guestUserId={selectedMember.user_id}
                    guestEmail={selectedMember.email}
                    colors={colors}
                />
            )}

            {/* Invite Flow Modal */}
            <Modal visible={showInviteFlow} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInviteFlow(false)}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Freunde & Familie einladen</Text>
                        <Pressable onPress={() => setShowInviteFlow(false)}><X size={24} color={colors.subtext} /></Pressable>
                    </View>
                    <ScrollView style={{ flex: 1 }}>
                        {/* Invite Methods */}
                        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                            <Pressable onPress={() => { setShowInviteFlow(false); setTimeout(() => setShowInviteModal(true), 350); }} style={[styles.inviteMethodRow, { borderBottomColor: colors.border }]}>
                                <View style={[styles.inviteMethodIcon, { backgroundColor: '#3B82F620' }]}><Mail size={20} color="#3B82F6" /></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inviteMethodTitle, { color: colors.text }]}>Neues Mitglied einladen</Text>
                                    <Text style={[styles.inviteMethodSub, { color: colors.subtext }]}>Per E-Mail-Adresse einladen</Text>
                                </View>
                                <ChevronRight size={18} color={colors.subtext} />
                            </Pressable>
                            <Pressable onPress={() => { setShowInviteFlow(false); setTimeout(() => setShowAddChildModal(true), 350); }} style={[styles.inviteMethodRow, { borderBottomColor: colors.border }]}>
                                <View style={[styles.inviteMethodIcon, { backgroundColor: '#10B98120' }]}><Baby size={20} color="#10B981" /></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inviteMethodTitle, { color: colors.text }]}>Erstelle ein Konto für ein Kind</Text>
                                    <Text style={[styles.inviteMethodSub, { color: colors.subtext }]}>Für Kinder ohne E-Mail-Adresse</Text>
                                </View>
                                <ChevronRight size={18} color={colors.subtext} />
                            </Pressable>
                            <Pressable style={[styles.inviteMethodRow, { borderBottomWidth: 0 }]}>
                                <View style={[styles.inviteMethodIcon, { backgroundColor: '#8B5CF620' }]}><Link2 size={20} color="#8B5CF6" /></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inviteMethodTitle, { color: colors.text }]}>Über einen Link einladen</Text>
                                    <Text style={[styles.inviteMethodSub, { color: colors.subtext }]}>Teilen Sie Ihren Einladungslink</Text>
                                </View>
                                <ChevronRight size={18} color={colors.subtext} />
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Invite Modal - Centered form */}
            <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.centeredOverlay}>
                        <View style={[styles.centeredCard, { backgroundColor: colors.card }]}>
                            <Pressable onPress={() => setShowInviteModal(false)} style={styles.closeCircle}><X size={18} color="#fff" /></Pressable>
                            <Text style={[styles.centeredTitle, { color: colors.text }]}>Mitglied einladen</Text>
                            <Text style={[styles.centeredSub, { color: colors.subtext }]}>Laden Sie Personen ein, die Ihnen am nächsten stehen.</Text>
                            <TextInput style={[styles.centeredInput, { color: colors.text, backgroundColor: colors.background }]} value={inviteName} onChangeText={setInviteName} placeholder="Vorname" placeholderTextColor={colors.subtext} />
                            <TextInput style={[styles.centeredInput, { color: colors.text, backgroundColor: colors.background }]} value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" placeholder="E-Mail-Adresse" placeholderTextColor={colors.subtext} />
                            <TextInput style={[styles.centeredInput, { color: colors.text, backgroundColor: colors.background }]} value={invitePassword} onChangeText={setInvitePassword} secureTextEntry autoCapitalize="none" placeholder="Passwort (mind. 6 Zeichen)" placeholderTextColor={colors.subtext} />
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                <Pressable onPress={() => setInviteRole('member')} style={[styles.roleChip, { borderColor: inviteRole === 'member' ? colors.accent : colors.border, backgroundColor: inviteRole === 'member' ? colors.accent + '20' : 'transparent' }]}>
                                    <Text style={{ color: inviteRole === 'member' ? colors.accent : colors.subtext, fontSize: 13, fontWeight: '600' }}>Mitglied</Text>
                                </Pressable>
                                <Pressable onPress={() => setInviteRole('guest')} style={[styles.roleChip, { borderColor: inviteRole === 'guest' ? '#8B5CF6' : colors.border, backgroundColor: inviteRole === 'guest' ? '#8B5CF620' : 'transparent' }]}>
                                    <Text style={{ color: inviteRole === 'guest' ? '#8B5CF6' : colors.subtext, fontSize: 13, fontWeight: '600' }}>Gast</Text>
                                </Pressable>
                            </View>
                            <Pressable onPress={handleInvite} disabled={isInviting} style={[styles.submitBtn, { backgroundColor: colors.accent }]}>
                                {isInviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Einladen</Text>}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Add Child Modal - Centered form */}
            <Modal visible={showAddChildModal} transparent animationType="fade" onRequestClose={() => setShowAddChildModal(false)}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.centeredOverlay}>
                        <View style={[styles.centeredCard, { backgroundColor: colors.card }]}>
                            <Pressable onPress={() => setShowAddChildModal(false)} style={styles.closeCircle}><X size={18} color="#fff" /></Pressable>
                            <Text style={[styles.centeredTitle, { color: colors.text }]}>Wie heisst dein Kind?</Text>
                            <Text style={[styles.centeredSub, { color: colors.subtext }]}>Diese Informationen sind nur für Sie und die Mitglieder Ihres privaten Kreises sichtbar.</Text>
                            <TextInput style={[styles.centeredInput, { color: colors.text, backgroundColor: colors.background }]} value={childName} onChangeText={setChildName} placeholder="Vorname" placeholderTextColor={colors.subtext} autoCapitalize="words" />
                            <Pressable onPress={handleAddChild} disabled={isAddingChild} style={[styles.submitBtn, { backgroundColor: colors.accent }]}>
                                {isAddingChild ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Fortfahren</Text>}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { padding: 8 },
    sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, marginTop: 8 },
    list: { gap: 4, marginTop: 4 },
    memberCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    memberInfo: { flex: 1, marginLeft: 12 },
    memberName: { fontSize: 16, fontWeight: '600' },
    memberRole: { fontSize: 13, marginTop: 1 },
    // Modals
    modalContent: { flex: 1 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    label: { fontSize: 12, marginBottom: 4 },
    input: { borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 15 },
    submitBtn: { padding: 16, borderRadius: 24, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    // Invite methods
    inviteMethodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 14 },
    inviteMethodIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    inviteMethodTitle: { fontSize: 15, fontWeight: '600' },
    inviteMethodSub: { fontSize: 12, marginTop: 2 },
    // Centered modals
    centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    centeredCard: { borderRadius: 24, padding: 28, paddingTop: 48 },
    closeCircle: { position: 'absolute', top: 16, left: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    centeredTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
    centeredSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    centeredInput: { padding: 16, borderRadius: 16, fontSize: 16, marginBottom: 12 },
    roleChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1.5 },
    // Admin specific
    selectedHeader: { alignItems: 'center', marginVertical: 20 },
    selectedEmail: { fontSize: 18, fontWeight: 'bold', marginTop: 12 },
    adminSection: { borderTopWidth: 1, paddingTop: 16, marginTop: 16 },
    adminRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8 },
    actionBtnText: { color: '#fff', fontWeight: 'bold' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Alert, KeyboardAvoidingView, Platform, StyleSheet, Switch } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Mail, Crown, X, Send, Lock, Eye, EyeOff, Trash2, Key, Shield, ShieldOff, MoreVertical } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface FamilyMember {
    id: string;
    user_id: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

interface Invitation {
    id: string;
    email: string;
    status: string;
    created_at: string;
}

interface FamilyManagementProps {
    colors: any;
}

export const FamilyManagement = ({ colors }: FamilyManagementProps) => {
    const { user, userRole, resetMemberPassword, removeMember, toggleMemberAccess } = useAuth();
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isInviting, setIsInviting] = useState(false);

    // Administrative Modals
    const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [newMemberPassword, setNewMemberPassword] = useState('');
    const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);

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

    const handleInvite = async () => {
        if (!inviteEmail.trim() || invitePassword.length < 6) {
            Alert.alert('Fehler', 'Ungültige Eingaben');
            return;
        }

        setIsInviting(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-family-member', {
                body: { email: inviteEmail.trim(), password: invitePassword },
            });

            if (error || (data && data.error)) {
                Alert.alert('Fehler', error?.message || data?.error);
                return;
            }

            Alert.alert('Erfolgreich', `${inviteEmail} wurde hinzugefügt.`);
            setShowInviteModal(false);
            setInviteEmail('');
            setInvitePassword('');
            loadFamilyData();
        } catch (error) {
            Alert.alert('Fehler', 'Verbindungsfehler');
        } finally {
            setIsInviting(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedMember || newMemberPassword.length < 6) {
            Alert.alert('Fehler', 'Passwort muss mind. 6 Zeichen haben.');
            return;
        }
        setIsAdminActionLoading(true);
        try {
            await resetMemberPassword(selectedMember.user_id || selectedMember.id, newMemberPassword);
            Alert.alert('Erfolg', 'Passwort wurde zurückgesetzt. Der User muss es beim nächsten Login ändern.');
            setNewMemberPassword('');
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsAdminActionLoading(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!selectedMember) return;
        Alert.alert(
            'Mitglied entfernen',
            `Möchtest du ${selectedMember.email} wirklich aus der Familie entfernen?`,
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: 'Entfernen',
                    style: 'destructive',
                    onPress: async () => {
                        setIsAdminActionLoading(true);
                        try {
                            await removeMember(selectedMember.user_id || selectedMember.id);
                            loadFamilyData();
                            setShowAdminModal(false);
                        } catch (e: any) {
                            Alert.alert('Fehler', e.message);
                        } finally {
                            setIsAdminActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleToggleAccess = async (active: boolean) => {
        if (!selectedMember) return;
        setIsAdminActionLoading(true);
        try {
            await toggleMemberAccess(selectedMember.user_id || selectedMember.id, active);
            loadFamilyData();
            // Update local state for immediate feedback in the modal
            setSelectedMember({ ...selectedMember, is_active: active });
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsAdminActionLoading(false);
        }
    };

    const getInitials = (email: string) => (email || '??').substring(0, 2).toUpperCase();
    const getAvatarColor = (index: number) => {
        const palettes = [['#3B82F6', '#1D4ED8'], ['#8B5CF6', '#6D28D9'], ['#EC4899', '#DB2777'], ['#10B981', '#059669']];
        return palettes[index % palettes.length];
    };

    if (isLoading) return <ActivityIndicator size="small" color={colors.accent} style={{ padding: 20 }} />;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.subtext }]}>{members.length} Mitglieder</Text>
                {userRole === 'admin' && (
                    <Pressable onPress={() => setShowInviteModal(true)} style={[styles.inviteBtn, { backgroundColor: colors.accent }]}>
                        <UserPlus size={18} color="#fff" />
                        <Text style={styles.inviteBtnText}>Einladen</Text>
                    </Pressable>
                )}
            </View>

            <View style={styles.list}>
                {members.map((member, index) => (
                    <Pressable
                        key={member.id}
                        style={[styles.memberCard, { backgroundColor: colors.background, borderColor: colors.border, opacity: member.is_active === false ? 0.6 : 1 }]}
                        onPress={() => {
                            if (userRole === 'admin' && member.email !== user?.email) {
                                setSelectedMember(member);
                                setShowAdminModal(true);
                            }
                        }}
                    >
                        <LinearGradient colors={getAvatarColor(index) as any} style={styles.avatar}>
                            <Text style={styles.avatarText}>{getInitials(member.email)}</Text>
                        </LinearGradient>
                        <View style={styles.memberInfo}>
                            <Text style={[styles.memberEmail, { color: colors.text }]} numberOfLines={1}>{member.email}</Text>
                            <View style={styles.roleRow}>
                                {member.role === 'admin' ? (
                                    <View style={styles.adminBadge}><Crown size={10} color="#FBBF24" /><Text style={styles.adminText}>Admin</Text></View>
                                ) : <Text style={[styles.memberRole, { color: colors.subtext }]}>Mitglied</Text>}
                                {member.email === user?.email && <Text style={[styles.meTag, { color: colors.subtext }]}>• Du</Text>}
                                {member.is_active === false && <Text style={[styles.meTag, { color: colors.error }]}>• Deaktiviert</Text>}
                            </View>
                        </View>
                        {userRole === 'admin' && member.email !== user?.email && <MoreVertical size={18} color={colors.subtext} />}
                    </Pressable>
                ))}

                {invitations.map(invite => (
                    <View key={invite.id} style={[styles.memberCard, { backgroundColor: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                        <View style={[styles.avatar, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                            <Mail size={16} color="#F59E0B" />
                        </View>
                        <View style={styles.memberInfo}>
                            <Text style={[styles.memberEmail, { color: colors.text }]}>{invite.email}</Text>
                            <Text style={{ color: '#F59E0B', fontSize: 11 }}>Einladung ausstehend</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Admin Modal */}
            <Modal visible={showAdminModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdminModal(false)}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Mitglied verwalten</Text>
                        <Pressable onPress={() => setShowAdminModal(false)}><X size={24} color={colors.subtext} /></Pressable>
                    </View>
                    {selectedMember && (
                        <ScrollView style={{ padding: 16 }}>
                            <View style={styles.selectedHeader}>
                                <LinearGradient colors={getAvatarColor(0) as any} style={[styles.avatar, { width: 64, height: 64, borderRadius: 32 }]}>
                                    <Text style={[styles.avatarText, { fontSize: 24 }]}>{getInitials(selectedMember.email)}</Text>
                                </LinearGradient>
                                <Text style={[styles.selectedEmail, { color: colors.text }]}>{selectedMember.email}</Text>
                                <Text style={[styles.memberRole, { color: colors.subtext }]}>{selectedMember.role === 'admin' ? 'Administrator' : 'Familienmitglied'}</Text>
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
                            </View>

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
                                <Pressable onPress={handleResetPassword} disabled={isAdminActionLoading} style={[styles.actionBtn, { backgroundColor: colors.accent, marginTop: 12 }]}>
                                    <Key size={18} color="#fff" />
                                    <Text style={styles.actionBtnText}>Daten aktualisieren</Text>
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

            {/* Invite Modal (same as before) */}
            <Modal visible={showInviteModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInviteModal(false)}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Mitglied einladen</Text>
                        <Pressable onPress={() => setShowInviteModal(false)}><X size={24} color={colors.subtext} /></Pressable>
                    </View>
                    <ScrollView style={{ padding: 16 }}>
                        <Text style={[styles.label, { color: colors.subtext }]}>E-Mail</Text>
                        <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" placeholder="email@example.com" placeholderTextColor={colors.subtext} />
                        <Text style={[styles.label, { color: colors.subtext, marginTop: 16 }]}>Initialpasswort</Text>
                        <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', borderColor: colors.border, backgroundColor: colors.card }]}>
                            <TextInput style={{ flex: 1, color: colors.text }} value={invitePassword} onChangeText={setInvitePassword} secureTextEntry={!showPassword} autoCapitalize="none" placeholder="Mind. 6 Zeichen" placeholderTextColor={colors.subtext} />
                            <Pressable onPress={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} color={colors.subtext} /> : <Eye size={18} color={colors.subtext} />}</Pressable>
                        </View>
                        <Pressable onPress={handleInvite} disabled={isInviting} style={[styles.submitBtn, { backgroundColor: colors.accent, marginTop: 24 }]}>
                            {isInviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Hinzufügen</Text>}
                        </Pressable>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { padding: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 13, fontWeight: '600' },
    inviteBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
    inviteBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    list: { gap: 8 },
    memberCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1 },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    memberInfo: { flex: 1, marginLeft: 10 },
    memberEmail: { fontSize: 14, fontWeight: '500' },
    roleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    memberRole: { fontSize: 11 },
    meTag: { fontSize: 11, marginLeft: 4 },
    adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, gap: 2 },
    adminText: { color: '#F59E0B', fontSize: 10, fontWeight: 'bold' },
    modalContent: { flex: 1 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    label: { fontSize: 12, marginBottom: 4 },
    input: { borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 15 },
    submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    // Admin specific
    selectedHeader: { alignItems: 'center', marginVertical: 20 },
    selectedEmail: { fontSize: 18, fontWeight: 'bold', marginTop: 12 },
    adminSection: { borderTopWidth: 1, paddingTop: 16, marginTop: 16 },
    adminRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8 },
    actionBtnText: { color: '#fff', fontWeight: 'bold' }
});

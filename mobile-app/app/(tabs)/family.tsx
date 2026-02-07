import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions, TextInput, Modal, Alert, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, UserPlus, Mail, Crown, X, Send, Lock, Eye, EyeOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { Image } from 'react-native';

interface FamilyMember {
    id: string;
    email: string;
    role: string;
    created_at: string;
}

interface Invitation {
    id: string;
    email: string;
    status: string;
    created_at: string;
}

export default function Family() {
    const { width } = useWindowDimensions();
    const { colors } = useTheme();
    const isTablet = width >= 768;

    const { user } = useAuth();
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isInviting, setIsInviting] = useState(false);

    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadFamilyData();
    }, []);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        loadFamilyData().then(() => setRefreshing(false));
    }, []);

    const loadFamilyData = async () => {
        // setIsLoading(true); // Don't show full loader on refresh
        try {
            // 1. Get current user's household_id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log("LOG: No user found");
                return;
            }

            const { data: myMemberData, error: memberError } = await supabase
                .from('family_members')
                .select('household_id')
                .eq('user_id', user.id)
                .single();

            const myHouseholdId = myMemberData?.household_id;
            console.log("LOG: My Household ID:", myHouseholdId, "Error:", memberError);

            // 2. Fetch Members
            const { data: membersData, error: membersError } = await supabase
                .from('family_members')
                .select('*')
                .order('created_at', { ascending: true });

            if (membersData) {
                setMembers(membersData);
            } else {
                console.log("LOG: Members Error:", membersError);
            }

            // 3. Fetch Invitations (Filtered by Household)
            if (myHouseholdId) {
                const { data: invitesData, error: invitesError } = await supabase
                    .from('family_invitations')
                    .select('*')
                    .eq('household_id', myHouseholdId)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });

                console.log("LOG: Invites Data:", invitesData?.length, "Error:", invitesError);

                if (invitesData) {
                    setInvitations(invitesData);
                }
            } else {
                console.log("LOG: No Household ID, skipping invites fetch");
            }
        } catch (e) {
            console.error('Error loading family data:', e);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            Alert.alert('Fehler', 'Bitte E-Mail eingeben');
            return;
        }
        if (!invitePassword.trim() || invitePassword.length < 6) {
            Alert.alert('Fehler', 'Passwort muss mindestens 6 Zeichen haben');
            return;
        }

        setIsInviting(true);
        try {
            // Get current session for authorization
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                Alert.alert('Fehler', 'Nicht angemeldet');
                return;
            }


            const { data, error } = await supabase.functions.invoke('create-family-member', {
                body: {
                    email: inviteEmail.trim(),
                    password: invitePassword,
                },
            });

            if (error) {
                console.log('Invite failed:', error);
                let errorMessage = error.message;
                const statusCode = error.status || (error as any).statusCode;

                try {
                    const parsed = JSON.parse(errorMessage);
                    if (parsed.error) errorMessage = parsed.error;
                } catch (e) { /* ignore */ }

                Alert.alert('Fehler', `Status: ${statusCode}\n\n${errorMessage || 'Unbekannter Fehler'}`);
                return;
            }

            // Check if application level error came back in data
            if (data && data.error) {
                Alert.alert('Fehler', data.error);
                return;
            }


            Alert.alert(
                'Erfolgreich',
                `${inviteEmail} wurde zur Familie hinzugefügt.\n\nInitialpasswort: ${invitePassword}\n\nDie Person muss das Passwort beim ersten Login ändern.`
            );
            setShowInviteModal(false);
            setInviteEmail('');
            setInvitePassword('');
            loadFamilyData();
        } catch (error) {
            console.error('Invite error:', error);
            Alert.alert('Fehler', 'Verbindungsfehler');
        } finally {
            setIsInviting(false);
        }
    };

    const getInitials = (email: string) => {
        return email.substring(0, 2).toUpperCase();
    };

    const getAvatarColor = (index: number): string[] => {
        const colors = [
            ['#3B82F6', '#1D4ED8'],
            ['#8B5CF6', '#6D28D9'],
            ['#EC4899', '#DB2777'],
            ['#10B981', '#059669'],
            ['#F59E0B', '#D97706'],
        ];
        return colors[index % colors.length];
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {colors.backgroundImage && (
                <View style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
                    <Image
                        source={colors.backgroundImage}
                        style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                    />
                </View>
            )}
            <ScrollView
                style={styles.flex1}
                contentContainerStyle={{ padding: isTablet ? 24 : 16 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Familie</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.subtext }]}>
                            {members.length} Mitglieder
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => setShowInviteModal(true)}
                        style={styles.inviteButton}
                    >
                        <UserPlus size={22} color="#fff" />
                    </Pressable>
                </View>

                {/* Members Grid */}
                {members.length === 0 ? (
                    <View style={[styles.emptyStateContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.emptyStateIcon, { backgroundColor: colors.background }]}>
                            <Users size={36} color={colors.subtext} />
                        </View>
                        <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Keine Familienmitglieder</Text>
                        <Text style={[styles.emptyStateText, { color: colors.subtext }]}>
                            Lade deine Familie ein, um gemeinsam das Smart Home zu steuern
                        </Text>
                    </View>
                ) : (
                    <View style={[styles.membersGrid, isTablet && styles.membersGridTablet]}>
                        {members.map((member, index) => (
                            <View
                                key={member.id}
                                style={[styles.memberCard, isTablet && styles.width48, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                                <View style={styles.memberCardContent}>
                                    <View style={styles.avatarContainer}>
                                        <LinearGradient
                                            colors={getAvatarColor(index) as any}
                                            style={styles.avatarGradient}
                                        >
                                            <Text style={styles.avatarText}>
                                                {getInitials(member.email)}
                                            </Text>
                                        </LinearGradient>
                                    </View>
                                    <View style={styles.memberInfo}>
                                        <View style={styles.memberEmailRow}>
                                            <Text style={[styles.memberEmail, { color: colors.text }]} numberOfLines={1}>
                                                {member.email}
                                            </Text>
                                            {member.email === user?.email && (
                                                <Text style={styles.meTag}>(Du)</Text>
                                            )}
                                        </View>
                                        <View style={styles.roleContainer}>
                                            {member.role === 'admin' && (
                                                <View style={styles.adminBadge}>
                                                    <Crown size={12} color="#FBBF24" />
                                                    <Text style={styles.adminText}>Admin</Text>
                                                </View>
                                            )}
                                            {member.role !== 'admin' && (
                                                <Text style={styles.memberRole}>Mitglied</Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Pending Invitations */}
                {invitations.length > 0 && (
                    <View>
                        <Text style={styles.sectionTitle}>
                            Ausstehende Einladungen
                        </Text>
                        <View style={styles.invitesList}>
                            {invitations.map(invite => (
                                <View
                                    key={invite.id}
                                    style={[styles.inviteCard, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30' }]}
                                >
                                    <View style={[styles.inviteIcon, { backgroundColor: colors.warning + '20' }]}>
                                        <Mail size={18} color={colors.warning} />
                                    </View>
                                    <View style={styles.inviteInfo}>
                                        <Text style={[styles.inviteEmail, { color: colors.text }]}>{invite.email}</Text>
                                        <Text style={[styles.inviteStatus, { color: colors.warning }]}>Einladung ausstehend</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Invite Modal */}
            <Modal visible={showInviteModal} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Mitglied einladen</Text>
                            <Pressable
                                onPress={() => setShowInviteModal(false)}
                                style={[styles.closeButton, { backgroundColor: colors.background }]}
                            >
                                <X size={20} color={colors.subtext} />
                            </Pressable>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={[styles.inputLabel, { color: colors.subtext }]}>E-Mail-Adresse</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <View style={styles.inputIcon}>
                                    <Mail size={18} color={colors.subtext} />
                                </View>
                                <TextInput
                                    style={[styles.textInput, { color: colors.text }]}
                                    placeholder="email@example.com"
                                    placeholderTextColor={colors.subtext}
                                    value={inviteEmail}
                                    onChangeText={setInviteEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Initialpasswort</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <View style={styles.inputIcon}>
                                    <Lock size={18} color={colors.subtext} />
                                </View>
                                <TextInput
                                    style={[styles.textInput, { color: colors.text }]}
                                    placeholder="Mindestens 6 Zeichen"
                                    placeholderTextColor={colors.subtext}
                                    value={invitePassword}
                                    onChangeText={setInvitePassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                />
                                <Pressable
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.inputIcon}
                                >
                                    {showPassword ? <EyeOff size={18} color={colors.subtext} /> : <Eye size={18} color={colors.subtext} />}
                                </Pressable>
                            </View>
                            <Text style={[styles.helperText, { color: colors.subtext }]}>
                                Die Person muss das Passwort beim ersten Login ändern.
                            </Text>
                            <Pressable
                                onPress={handleInvite}
                                style={[styles.sendButton, isInviting && styles.sendButtonDisabled, { backgroundColor: colors.accent }]}
                                disabled={isInviting}
                            >
                                {isInviting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Send size={18} color="#fff" />
                                        <Text style={styles.sendButtonText}>Mitglied hinzufügen</Text>
                                    </>
                                )}
                            </Pressable>
                        </ScrollView>
                        <View style={styles.modalFooter} />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flex1: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 30,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#94A3B8',
        marginTop: 4,
    },
    inviteButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateContainer: {
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderColor: '#1E293B',
        borderWidth: 1,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
    },
    emptyStateIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyStateTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
    },
    emptyStateText: {
        color: '#64748B',
        textAlign: 'center',
        marginTop: 8,
    },
    membersGrid: {
        gap: 12,
        marginBottom: 24,
    },
    membersGridTablet: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    memberCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderColor: '#1E293B',
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
    },
    width48: {
        width: '48%',
    },
    memberCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    avatarGradient: {
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    memberInfo: {
        flex: 1,
        marginLeft: 12,
    },
    memberEmailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    memberEmail: {
        color: '#fff',
        fontWeight: '500',
    },
    meTag: {
        color: '#64748B',
        fontSize: 12,
        marginLeft: 8,
    },
    roleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    adminBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    adminText: {
        color: '#F59E0B',
        fontSize: 12,
        marginLeft: 4,
    },
    memberRole: {
        color: '#64748B',
        fontSize: 14,
    },
    sectionTitle: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 12,
        letterSpacing: 2,
    },
    invitesList: {
        gap: 8,
    },
    inviteCard: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.2)',
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    inviteIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inviteInfo: {
        flex: 1,
        marginLeft: 12,
    },
    inviteEmail: {
        color: '#fff',
    },
    inviteStatus: {
        color: 'rgba(245, 158, 11, 0.6)',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        padding: 16,
    },
    inputLabel: {
        color: '#94A3B8',
        fontSize: 14,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 16,
    },
    inputIcon: {
        padding: 12,
    },
    textInput: {
        flex: 1,
        color: '#fff',
        paddingVertical: 12,
        paddingRight: 12,
    },
    sendButton: {
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    modalFooter: {
        height: 32,
    },
    helperText: {
        color: '#64748B',
        fontSize: 12,
        marginBottom: 16,
        marginTop: -8,
    },
    sendButtonDisabled: {
        opacity: 0.6,
    },
});

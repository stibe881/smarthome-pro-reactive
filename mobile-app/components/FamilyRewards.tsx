import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Platform, Animated,
} from 'react-native';
import { X, Plus, Trash2, Trophy, Star, Gift, Check, Clock, ChevronRight, Award, Sparkles, TrendingUp } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface Reward {
    id: string;
    household_id: string;
    member_name: string;
    points: number;
    created_at: string;
}

interface RewardItem {
    id: string;
    household_id: string;
    title: string;
    points_required: number;
    emoji: string;
    created_at: string;
}

interface HistoryEntry {
    id: string; member_name: string; points: number;
    reason: string; type: string; created_at: string;
}

interface RewardsProps { visible: boolean; onClose: () => void; }

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#6366F1', '#EC4899', '#14B8A6'];
const RANK_EMOJIS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
const EMOJI_OPTIONS = ['🎁', '🍦', '🎮', '📱', '🎬', '🏊', '⚽', '🎨', '📚', '🧸', '🎵', '🎯', '🎪', '🚀', '🌟', '🍕'];

export const FamilyRewards: React.FC<RewardsProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [members, setMembers] = useState<Reward[]>([]);
    const [rewards, setRewards] = useState<RewardItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState<'points' | 'rewards'>('points');
    const [showAddReward, setShowAddReward] = useState(false);
    const [newRewardTitle, setNewRewardTitle] = useState('');
    const [newRewardPoints, setNewRewardPoints] = useState('');
    const [newRewardEmoji, setNewRewardEmoji] = useState('🎁');

    // History
    const [historyMember, setHistoryMember] = useState<Reward | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Manual points with reason
    const [pointsMember, setPointsMember] = useState<Reward | null>(null);
    const [pointsAmount, setPointsAmount] = useState(0);
    const [pointsReason, setPointsReason] = useState('');

    const loadData = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            // Only load members who have planner access enabled
            const { data: familyData } = await supabase
                .from('family_members')
                .select('user_id, email, display_name, planner_access, allowed_modules')
                .eq('household_id', householdId)
                .eq('is_active', true);

            // Filter: must have planner_access AND 'rewards' in allowed_modules (or null = all allowed)
            const eligibleMembers = (familyData || []).filter(m => {
                if (m.planner_access === false) return false;
                if (m.allowed_modules && !m.allowed_modules.includes('rewards')) return false;
                return true;
            });

            const eligibleNames = new Set(eligibleMembers.map(m => m.display_name || m.email.split('@')[0]));

            const { data: rewardData } = await supabase
                .from('reward_points')
                .select('*')
                .eq('household_id', householdId)
                .order('points', { ascending: false });

            // 1. Remove entries for members who no longer qualify
            const staleEntries = (rewardData || []).filter(r => !eligibleNames.has(r.member_name));
            for (const stale of staleEntries) {
                await supabase.from('reward_points').delete().eq('id', stale.id);
                await supabase.from('reward_history')
                    .delete()
                    .eq('household_id', householdId)
                    .eq('member_name', stale.member_name);
            }

            // 2. Deduplicate: keep only the entry with the most points per member_name
            const validEntries = (rewardData || []).filter(r => eligibleNames.has(r.member_name));
            const bestPerMember = new Map<string, typeof validEntries[0]>();
            const duplicateIds: string[] = [];
            for (const entry of validEntries) {
                const existing = bestPerMember.get(entry.member_name);
                if (!existing) {
                    bestPerMember.set(entry.member_name, entry);
                } else {
                    // Keep the one with more points, delete the other
                    if (entry.points > existing.points) {
                        duplicateIds.push(existing.id);
                        bestPerMember.set(entry.member_name, entry);
                    } else {
                        duplicateIds.push(entry.id);
                    }
                }
            }
            for (const dupId of duplicateIds) {
                await supabase.from('reward_points').delete().eq('id', dupId);
            }

            // 3. Auto-create entries for eligible members who don't have one yet
            const existingNames = new Set(bestPerMember.keys());
            const newEntries: { household_id: string; member_name: string; points: number }[] = [];
            eligibleMembers.forEach(m => {
                const name = m.display_name || m.email.split('@')[0];
                if (!existingNames.has(name)) {
                    newEntries.push({ household_id: householdId, member_name: name, points: 0 });
                }
            });

            // 4. Final reload if anything changed, otherwise use cleaned data
            const needsReload = staleEntries.length > 0 || duplicateIds.length > 0 || newEntries.length > 0;
            if (newEntries.length > 0) {
                await supabase.from('reward_points').insert(newEntries);
            }
            if (needsReload) {
                const { data: updatedData } = await supabase
                    .from('reward_points')
                    .select('*')
                    .eq('household_id', householdId)
                    .order('points', { ascending: false });
                setMembers((updatedData || []).filter(r => eligibleNames.has(r.member_name) || newEntries.some(n => n.member_name === r.member_name)));
            } else {
                setMembers(Array.from(bestPerMember.values()));
            }

            const { data: catalogData } = await supabase
                .from('reward_catalog')
                .select('*')
                .eq('household_id', householdId)
                .order('points_required');
            setRewards(catalogData || []);
        } catch (e) {
            console.error('Error loading rewards:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => { if (visible) loadData(); }, [visible, loadData]);

    const platformConfirm = (title: string, msg: string, onOk: () => void) => {
        if ((Platform.OS as string) === 'web') {
            if (window.confirm(`${title}\n${msg}`)) onOk();
        } else {
            Alert.alert(title, msg, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'OK', style: 'destructive', onPress: onOk },
            ]);
        }
    };

    const platformAlert = (title: string, msg: string) => {
        if ((Platform.OS as string) === 'web') window.alert(`${title}: ${msg}`);
        else Alert.alert(title, msg);
    };

    const addReward = async () => {
        if (!newRewardTitle.trim() || !householdId) return;
        try {
            const { error } = await supabase.from('reward_catalog').insert({
                household_id: householdId, title: newRewardTitle.trim(),
                points_required: parseInt(newRewardPoints) || 10, emoji: newRewardEmoji,
            });
            if (error) { platformAlert('Fehler', error.message); return; }
            setNewRewardTitle(''); setNewRewardPoints(''); setShowAddReward(false); loadData();
        } catch (e: any) { platformAlert('Fehler', e.message); }
    };

    const addPoints = (member: Reward, pts: number) => {
        setPointsMember(member);
        setPointsAmount(pts);
        setPointsReason('');
    };

    const confirmAddPoints = async () => {
        if (!pointsMember || !pointsReason.trim()) {
            platformAlert('Fehler', 'Bitte einen Grund angeben.');
            return;
        }
        try {
            const { error } = await supabase.from('reward_points')
                .update({ points: pointsMember.points + pointsAmount })
                .eq('id', pointsMember.id);
            if (error) throw error;
            if (householdId) {
                await supabase.from('reward_history').insert({
                    household_id: householdId,
                    member_name: pointsMember.member_name,
                    points: pointsAmount,
                    reason: pointsReason.trim(),
                    type: 'manual',
                });
            }
            setPointsMember(null);
            loadData();
        } catch (e: any) { platformAlert('Fehler', e.message); }
    };

    const redeemReward = (member: Reward, reward: RewardItem) => {
        if (member.points < reward.points_required) {
            platformAlert('Nicht genug Punkte', `${member.member_name} braucht noch ${reward.points_required - member.points} Punkte.`);
            return;
        }
        platformConfirm(
            'Belohnung einlösen',
            `${reward.emoji} "${reward.title}" für ${member.member_name} einlösen? (${reward.points_required} Punkte)`,
            async () => {
                await supabase.from('reward_points')
                    .update({ points: member.points - reward.points_required })
                    .eq('id', member.id);
                if (householdId) {
                    await supabase.from('reward_history').insert({
                        household_id: householdId,
                        member_name: member.member_name,
                        points: -reward.points_required,
                        reason: `${reward.emoji} ${reward.title} eingelöst`,
                        type: 'redeem',
                    });
                }
                loadData();
            }
        );
    };

    const openHistory = async (member: Reward) => {
        setHistoryMember(member);
        setHistoryLoading(true);
        try {
            const { data } = await supabase.from('reward_history')
                .select('*')
                .eq('household_id', householdId!)
                .eq('member_name', member.member_name)
                .order('created_at', { ascending: false })
                .limit(50);
            setHistory(data || []);
        } catch (e) { console.error('Error loading history:', e); }
        finally { setHistoryLoading(false); }
    };

    const formatDate = (d: string) => {
        const date = new Date(d);
        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}. ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const maxPoints = Math.max(...members.map(m => m.points), 1);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Premium Header */}
                <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                            <View style={[styles.titleIcon, { backgroundColor: colors.accent + '18' }]}>
                                <Trophy size={22} color={colors.accent} />
                            </View>
                            <View>
                                <Text style={[styles.headerTitle, { color: colors.text }]}>Belohnungen</Text>
                                <Text style={[styles.headerSub, { color: colors.subtext }]}>
                                    {members.length} Teilnehmer · {rewards.length} Belohnungen
                                </Text>
                            </View>
                        </View>
                    </View>
                    <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border + '80' }]}>
                        <X size={20} color={colors.subtext} />
                    </Pressable>
                </View>

                {/* Segmented Tab Bar */}
                <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
                    <Pressable
                        style={[styles.tabItem, tab === 'points' && [styles.tabItemActive, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]]}
                        onPress={() => setTab('points')}
                    >
                        <Star size={16} color={tab === 'points' ? colors.accent : colors.subtext} />
                        <Text style={[styles.tabText, { color: tab === 'points' ? colors.accent : colors.subtext }]}>Punktestand</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tabItem, tab === 'rewards' && [styles.tabItemActive, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]]}
                        onPress={() => setTab('rewards')}
                    >
                        <Gift size={16} color={tab === 'rewards' ? colors.accent : colors.subtext} />
                        <Text style={[styles.tabText, { color: tab === 'rewards' ? colors.accent : colors.subtext }]}>Katalog</Text>
                    </Pressable>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> : tab === 'points' ? (
                        <>
                            {members.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <View style={[styles.emptyIcon, { backgroundColor: colors.accent + '12' }]}>
                                        <Trophy size={36} color={colors.accent} />
                                    </View>
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Teilnehmer</Text>
                                    <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                        Erstelle Familienmitglieder unter{'\n'}"Familie" um Belohnungen zu nutzen.
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    {/* Leaderboard Cards */}
                                    {members.map((m, idx) => {
                                        const rankColor = RANK_COLORS[idx] || colors.accent;
                                        const barWidth = maxPoints > 0 ? (m.points / maxPoints) * 100 : 0;
                                        return (
                                            <Pressable key={m.id} onPress={() => openHistory(m)}
                                                style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: rankColor, borderLeftWidth: 3 }]}
                                            >
                                                <View style={[styles.rankBadge, { backgroundColor: rankColor + '18' }]}>
                                                    <Text style={styles.rankEmoji}>{RANK_EMOJIS[idx] || '⭐'}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Text style={[styles.memberName, { color: colors.text }]}>{m.member_name}</Text>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Text style={[styles.pointsBadge, { color: colors.accent }]}>{m.points}</Text>
                                                            <Star size={14} color={colors.accent} fill={colors.accent} />
                                                        </View>
                                                    </View>
                                                    {/* Progress bar */}
                                                    <View style={[styles.progressTrack, { backgroundColor: colors.border + '50' }]}>
                                                        <View style={[styles.progressFill, { width: `${barWidth}%`, backgroundColor: rankColor }]} />
                                                    </View>
                                                    {/* Quick action buttons */}
                                                    <View style={styles.pointBtns}>
                                                        <Pressable style={[styles.ptBtn, { backgroundColor: '#10B981' + '15', borderColor: '#10B981' + '30' }]} onPress={() => addPoints(m, 1)}>
                                                            <Text style={[styles.ptBtnText, { color: '#10B981' }]}>+1</Text>
                                                        </Pressable>
                                                        <Pressable style={[styles.ptBtn, { backgroundColor: '#3B82F6' + '15', borderColor: '#3B82F6' + '30' }]} onPress={() => addPoints(m, 5)}>
                                                            <Text style={[styles.ptBtnText, { color: '#3B82F6' }]}>+5</Text>
                                                        </Pressable>
                                                        <Pressable style={[styles.ptBtn, { backgroundColor: '#F59E0B' + '15', borderColor: '#F59E0B' + '30' }]} onPress={() => addPoints(m, 10)}>
                                                            <Text style={[styles.ptBtnText, { color: '#F59E0B' }]}>+10</Text>
                                                        </Pressable>
                                                        <Pressable style={[styles.ptBtn, { backgroundColor: '#EF4444' + '15', borderColor: '#EF4444' + '30' }]} onPress={() => addPoints(m, -1)}>
                                                            <Text style={[styles.ptBtnText, { color: '#EF4444' }]}>-1</Text>
                                                        </Pressable>
                                                        <View style={{ flex: 1 }} />
                                                        <ChevronRight size={16} color={colors.subtext} />
                                                    </View>
                                                </View>
                                            </Pressable>
                                        );
                                    })}

                                    {/* Redeem Section */}
                                    {rewards.length > 0 && (
                                        <View style={{ marginTop: 24 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                                <Gift size={18} color={colors.accent} />
                                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Belohnung einlösen</Text>
                                            </View>
                                            {rewards.map(r => (
                                                <View key={r.id} style={[styles.redeemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                    <View style={styles.redeemHeader}>
                                                        <View style={[styles.redeemEmojiWrap, { backgroundColor: colors.accent + '12' }]}>
                                                            <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[styles.redeemTitle, { color: colors.text }]} numberOfLines={1}>{r.title}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                                <Star size={12} color={colors.accent} fill={colors.accent} />
                                                                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>{r.points_required} Punkte</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
                                                        {members.map(m => {
                                                            const canRedeem = m.points >= r.points_required;
                                                            return (
                                                                <Pressable key={m.id}
                                                                    style={[styles.redeemMemberBtn, {
                                                                        borderColor: canRedeem ? '#10B981' : colors.border,
                                                                        backgroundColor: canRedeem ? '#10B981' + '10' : 'transparent',
                                                                    }]}
                                                                    onPress={() => redeemReward(m, r)}
                                                                >
                                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: canRedeem ? '#10B981' : colors.subtext }}>{m.member_name}</Text>
                                                                    {canRedeem && <Check size={12} color="#10B981" />}
                                                                </Pressable>
                                                            );
                                                        })}
                                                    </ScrollView>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {rewards.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <View style={[styles.emptyIcon, { backgroundColor: colors.accent + '12' }]}>
                                        <Gift size={36} color={colors.accent} />
                                    </View>
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Belohnungen</Text>
                                    <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                        Erstelle Belohnungen, die mit{'\n'}gesammelten Punkten eingelöst werden können.
                                    </Text>
                                </View>
                            ) : (
                                rewards.map(r => (
                                    <View key={r.id} style={[styles.catalogCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        <View style={[styles.catalogEmoji, { backgroundColor: colors.accent + '12' }]}>
                                            <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.catalogTitle, { color: colors.text }]}>{r.title}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                                <Star size={12} color={colors.accent} fill={colors.accent} />
                                                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>{r.points_required} Punkte</Text>
                                            </View>
                                        </View>
                                        <Pressable
                                            onPress={() => {
                                                platformConfirm('Entfernen', `"${r.title}" entfernen?`, async () => {
                                                    await supabase.from('reward_catalog').delete().eq('id', r.id);
                                                    loadData();
                                                });
                                            }}
                                            style={[styles.deleteBtn, { backgroundColor: '#EF4444' + '10' }]}
                                            hitSlop={8}
                                        >
                                            <Trash2 size={16} color="#EF4444" />
                                        </Pressable>
                                    </View>
                                ))
                            )}
                            <Pressable style={[styles.addFullBtn, { backgroundColor: colors.accent }]} onPress={() => setShowAddReward(true)}>
                                <Plus size={18} color="#fff" />
                                <Text style={styles.addFullBtnText}>Belohnung erstellen</Text>
                            </Pressable>
                        </>
                    )}
                </ScrollView>

                {/* Add Reward Modal */}
                <Modal visible={showAddReward} transparent animationType="fade">
                    <Pressable style={styles.overlay} onPress={() => setShowAddReward(false)}>
                        <Pressable style={[styles.popup, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <View style={[styles.popupIcon, { backgroundColor: colors.accent + '15' }]}>
                                    <Gift size={20} color={colors.accent} />
                                </View>
                                <Text style={[styles.popupTitle, { color: colors.text }]}>Neue Belohnung</Text>
                            </View>
                            <Text style={[styles.popupLabel, { color: colors.subtext }]}>Emoji wählen</Text>
                            <View style={styles.emojiGrid}>
                                {EMOJI_OPTIONS.map(e => (
                                    <Pressable key={e} style={[styles.emojiBtn, newRewardEmoji === e && { backgroundColor: colors.accent + '20', borderColor: colors.accent + '40' }]} onPress={() => setNewRewardEmoji(e)}>
                                        <Text style={{ fontSize: 22 }}>{e}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={[styles.popupLabel, { color: colors.subtext, marginTop: 14 }]}>Details</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={newRewardTitle} onChangeText={setNewRewardTitle}
                                placeholder="z.B. 30 Min. Bildschirmzeit" placeholderTextColor={colors.subtext + '80'}
                            />
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
                                value={newRewardPoints} onChangeText={setNewRewardPoints}
                                placeholder="Punkte (z.B. 10)" placeholderTextColor={colors.subtext + '80'}
                                keyboardType="numeric"
                            />
                            <View style={styles.popupActions}>
                                <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowAddReward(false)}>
                                    <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                                </Pressable>
                                <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: newRewardTitle.trim() ? 1 : 0.4 }]} onPress={addReward}>
                                    <Plus size={16} color="#fff" />
                                    <Text style={{ color: '#fff', fontWeight: '700' }}>Erstellen</Text>
                                </Pressable>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Points Reason Modal */}
                <Modal visible={!!pointsMember} transparent animationType="fade">
                    <Pressable style={styles.overlay} onPress={() => setPointsMember(null)}>
                        <Pressable style={[styles.popup, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <View style={[styles.popupIcon, { backgroundColor: pointsAmount > 0 ? '#10B981' + '15' : '#EF4444' + '15' }]}>
                                    <TrendingUp size={20} color={pointsAmount > 0 ? '#10B981' : '#EF4444'} />
                                </View>
                                <View>
                                    <Text style={[styles.popupTitle, { color: colors.text }]}>
                                        {pointsAmount > 0 ? '+' : ''}{pointsAmount} Punkte
                                    </Text>
                                    <Text style={{ color: colors.subtext, fontSize: 13 }}>für {pointsMember?.member_name}</Text>
                                </View>
                            </View>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={pointsReason} onChangeText={setPointsReason}
                                placeholder="Grund angeben..." placeholderTextColor={colors.subtext + '80'}
                                autoFocus
                            />
                            <View style={styles.popupActions}>
                                <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setPointsMember(null)}>
                                    <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                                </Pressable>
                                <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: pointsReason.trim() ? 1 : 0.4 }]} onPress={confirmAddPoints}>
                                    <Check size={16} color="#fff" />
                                    <Text style={{ color: '#fff', fontWeight: '700' }}>Bestätigen</Text>
                                </Pressable>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* History Modal */}
                <Modal visible={!!historyMember} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryMember(null)}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.titleRow}>
                                    <View style={[styles.titleIcon, { backgroundColor: colors.accent + '18' }]}>
                                        <Clock size={22} color={colors.accent} />
                                    </View>
                                    <View>
                                        <Text style={[styles.headerTitle, { color: colors.text }]}>{historyMember?.member_name}</Text>
                                        <Text style={[styles.headerSub, { color: colors.subtext }]}>Verlauf & Statistik</Text>
                                    </View>
                                </View>
                            </View>
                            <Pressable onPress={() => setHistoryMember(null)} style={[styles.closeBtn, { backgroundColor: colors.border + '80' }]}>
                                <X size={20} color={colors.subtext} />
                            </Pressable>
                        </View>

                        {/* Points Summary Card */}
                        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={{ alignItems: 'center' }}>
                                <View style={[styles.pointsCircle, { borderColor: colors.accent + '40' }]}>
                                    <Text style={[styles.pointsLarge, { color: colors.accent }]}>{historyMember?.points}</Text>
                                    <Star size={16} color={colors.accent} fill={colors.accent} />
                                </View>
                                <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 6 }}>Aktueller Stand</Text>
                            </View>
                            <Pressable
                                style={[styles.resetBtn, { backgroundColor: '#EF4444' + '10', borderColor: '#EF4444' + '20' }]}
                                onPress={() => {
                                    if (!historyMember || !householdId) return;
                                    platformConfirm('Zurücksetzen', `Punkte von ${historyMember.member_name} auf 0 setzen?`, async () => {
                                        await supabase.from('reward_points').update({ points: 0 }).eq('id', historyMember.id);
                                        await supabase.from('reward_history').insert({
                                            household_id: householdId,
                                            member_name: historyMember.member_name,
                                            points: -historyMember.points,
                                            reason: '🔄 Punkte zurückgesetzt',
                                            type: 'manual',
                                        });
                                        setHistoryMember({ ...historyMember, points: 0 });
                                        openHistory({ ...historyMember, points: 0 });
                                        loadData();
                                    });
                                }}
                            >
                                <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>🔄 Zurücksetzen</Text>
                            </Pressable>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                            {historyLoading ? (
                                <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                            ) : history.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <View style={[styles.emptyIcon, { backgroundColor: colors.accent + '12' }]}>
                                        <Clock size={32} color={colors.accent} />
                                    </View>
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Noch kein Verlauf</Text>
                                    <Text style={[styles.emptyText, { color: colors.subtext }]}>Vergib Punkte um den Verlauf zu sehen</Text>
                                </View>
                            ) : (
                                history.map((h, idx) => (
                                    <View key={h.id} style={[styles.historyItem, { borderLeftColor: h.points > 0 ? '#10B981' : '#EF4444' }]}>
                                        <View style={[styles.historyDot, { backgroundColor: h.points > 0 ? '#10B981' : '#EF4444' }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.historyReason, { color: colors.text }]}>{h.reason}</Text>
                                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
                                                <Text style={[styles.historyMeta, { color: colors.subtext }]}>{formatDate(h.created_at)}</Text>
                                                <Text style={[styles.historyType, { color: colors.subtext }]}>
                                                    {h.type === 'manual' ? '🔧 Manuell' : h.type === 'task' ? '✅ Aufgabe' : '🎁 Eingelöst'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[styles.historyPoints, { backgroundColor: h.points > 0 ? '#10B981' + '12' : '#EF4444' + '12' }]}>
                                            <Text style={{ fontSize: 15, fontWeight: '800', color: h.points > 0 ? '#10B981' : '#EF4444' }}>
                                                {h.points > 0 ? '+' : ''}{h.points}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    titleIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
    headerSub: { fontSize: 13, marginTop: 1 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    // Tabs
    tabBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 4, gap: 4 },
    tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
    tabItemActive: {},
    tabText: { fontWeight: '700', fontSize: 13 },
    // Empty
    emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyIcon: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    emptyTitle: { fontSize: 17, fontWeight: '700' },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    // Member Cards
    memberCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 8 },
    rankBadge: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    rankEmoji: { fontSize: 22 },
    memberName: { fontSize: 16, fontWeight: '700' },
    pointsBadge: { fontSize: 18, fontWeight: '800' },
    progressTrack: { height: 4, borderRadius: 2, marginTop: 8, marginBottom: 8, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    pointBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    ptBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
    ptBtnText: { fontWeight: '800', fontSize: 13 },
    // Sections
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    // Redeem
    redeemCard: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    redeemHeader: { flexDirection: 'row', alignItems: 'center' },
    redeemEmojiWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    redeemTitle: { fontSize: 15, fontWeight: '600' },
    redeemMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
    // Catalog
    catalogCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    catalogEmoji: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    catalogTitle: { fontSize: 16, fontWeight: '600' },
    deleteBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    addFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14, marginTop: 12 },
    addFullBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    // Modals
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    popup: { borderRadius: 22, padding: 22 },
    popupIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    popupTitle: { fontSize: 18, fontWeight: '800' },
    popupLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { borderWidth: 1, padding: 14, borderRadius: 12, fontSize: 15 },
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    emojiBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    popupActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
    saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12 },
    // Summary
    summaryCard: { marginHorizontal: 16, marginTop: 12, padding: 20, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pointsCircle: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    pointsLarge: { fontSize: 28, fontWeight: '800' },
    resetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    // History
    historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, borderLeftWidth: 2, marginBottom: 2 },
    historyDot: { width: 8, height: 8, borderRadius: 4 },
    historyReason: { fontSize: 14, fontWeight: '600' },
    historyMeta: { fontSize: 11 },
    historyType: { fontSize: 11 },
    historyPoints: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
});

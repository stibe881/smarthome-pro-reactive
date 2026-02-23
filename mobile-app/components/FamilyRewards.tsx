import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal,
} from 'react-native';
import { X, Plus, Trash2, Trophy, Star, Gift, Check } from 'lucide-react-native';
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

interface RewardsProps { visible: boolean; onClose: () => void; }

const RANK_EMOJIS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];

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

    const EMOJI_OPTIONS = ['🎁', '🍦', '🎮', '📱', '🎬', '🏊', '⚽', '🎨', '📚', '🧸', '🎵', '🎯'];

    const loadData = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            // 1. Get all family members
            const { data: familyData } = await supabase
                .from('family_members')
                .select('user_id, email, display_name')
                .eq('household_id', householdId)
                .eq('is_active', true);

            // 2. Get existing reward_points entries
            const { data: rewardData } = await supabase
                .from('reward_points')
                .select('*')
                .eq('household_id', householdId)
                .order('points', { ascending: false });

            // 3. Auto-create reward_points entries for family members that don't have one
            const existingNames = new Set((rewardData || []).map(r => r.member_name));
            const newEntries: { household_id: string; member_name: string; points: number }[] = [];
            (familyData || []).forEach(m => {
                const name = m.display_name || m.email.split('@')[0];
                if (!existingNames.has(name)) {
                    newEntries.push({ household_id: householdId, member_name: name, points: 0 });
                }
            });

            if (newEntries.length > 0) {
                await supabase.from('reward_points').insert(newEntries);
                // Re-fetch after insert
                const { data: updatedData } = await supabase
                    .from('reward_points')
                    .select('*')
                    .eq('household_id', householdId)
                    .order('points', { ascending: false });
                setMembers(updatedData || []);
            } else {
                setMembers(rewardData || []);
            }

            // 4. Load rewards catalog
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

    const addReward = async () => {
        if (!newRewardTitle.trim() || !householdId) return;
        try {
            const { error } = await supabase.from('reward_catalog').insert({
                household_id: householdId, title: newRewardTitle.trim(),
                points_required: parseInt(newRewardPoints) || 10, emoji: newRewardEmoji,
            });
            if (error) {
                console.error('Error adding reward:', error);
                Alert.alert('Fehler', error.message);
                return;
            }
            setNewRewardTitle(''); setNewRewardPoints(''); setShowAddReward(false); loadData();
        } catch (e: any) {
            console.error('Error adding reward:', e);
            Alert.alert('Fehler', e.message);
        }
    };

    const addPoints = (member: Reward, pts: number) => {
        Alert.alert('Punkte', `${pts > 0 ? '+' : ''}${pts} Punkte für ${member.member_name}?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'OK', onPress: async () => {
                    const { error } = await supabase.from('reward_points').update({ points: member.points + pts }).eq('id', member.id);
                    if (error) console.error('Error updating points:', error);
                    loadData();
                }
            },
        ]);
    };

    const redeemReward = (member: Reward, reward: RewardItem) => {
        if (member.points < reward.points_required) {
            Alert.alert('Nicht genug Punkte', `${member.member_name} braucht noch ${reward.points_required - member.points} Punkte.`);
            return;
        }
        Alert.alert('Belohnung einlösen', `${reward.emoji} "${reward.title}" für ${member.member_name} einlösen? (${reward.points_required} Punkte)`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Einlösen', onPress: async () => {
                    const { error } = await supabase.from('reward_points').update({ points: member.points - reward.points_required }).eq('id', member.id);
                    if (error) console.error('Error redeeming reward:', error);
                    loadData();
                }
            },
        ]);
    };

    const deleteMember = (member: Reward) => {
        Alert.alert('Entfernen', `${member.member_name} aus Belohnungen entfernen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Entfernen', style: 'destructive', onPress: async () => {
                    await supabase.from('reward_points').delete().eq('id', member.id);
                    loadData();
                }
            },
        ]);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Belohnungen</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Tabs */}
                <View style={[styles.tabs, { borderColor: colors.border }]}>
                    <Pressable style={[styles.tab, tab === 'points' && { backgroundColor: colors.accent + '20' }]} onPress={() => setTab('points')}>
                        <Star size={16} color={tab === 'points' ? colors.accent : colors.subtext} />
                        <Text style={{ color: tab === 'points' ? colors.accent : colors.subtext, fontWeight: '700', fontSize: 13 }}>Punkte</Text>
                    </Pressable>
                    <Pressable style={[styles.tab, tab === 'rewards' && { backgroundColor: colors.accent + '20' }]} onPress={() => setTab('rewards')}>
                        <Gift size={16} color={tab === 'rewards' ? colors.accent : colors.subtext} />
                        <Text style={{ color: tab === 'rewards' ? colors.accent : colors.subtext, fontWeight: '700', fontSize: 13 }}>Belohnungen</Text>
                    </Pressable>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> : tab === 'points' ? (
                        <>
                            {members.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Trophy size={40} color={colors.subtext} />
                                    <Text style={[styles.emptyText, { color: colors.subtext }]}>Erstelle Familienmitglieder unter{'\n'}"Familie" um Belohnungen zu nutzen.</Text>
                                </View>
                            ) : (
                                members.map((m, idx) => (
                                    <View key={m.id} style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        <Text style={styles.rank}>{RANK_EMOJIS[idx] || '⭐'}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.memberName, { color: colors.text }]}>{m.member_name}</Text>
                                            <Text style={[styles.memberPoints, { color: colors.accent }]}>{m.points} ⭐</Text>
                                        </View>
                                        <View style={styles.pointBtns}>
                                            <Pressable style={[styles.ptBtn, { backgroundColor: '#10B98120' }]} onPress={() => addPoints(m, 1)}>
                                                <Text style={{ color: '#10B981', fontWeight: '800' }}>+1</Text>
                                            </Pressable>
                                            <Pressable style={[styles.ptBtn, { backgroundColor: '#3B82F620' }]} onPress={() => addPoints(m, 5)}>
                                                <Text style={{ color: '#3B82F6', fontWeight: '800' }}>+5</Text>
                                            </Pressable>
                                            <Pressable style={[styles.ptBtn, { backgroundColor: '#EF444420' }]} onPress={() => addPoints(m, -1)}>
                                                <Text style={{ color: '#EF4444', fontWeight: '800' }}>-1</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ))
                            )}

                            {/* Redeem Section */}
                            {rewards.length > 0 && members.length > 0 && (
                                <View style={{ marginTop: 24 }}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Belohnung einlösen</Text>
                                    {rewards.map(r => (
                                        <View key={r.id} style={[styles.rewardRedeemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                            <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={[{ fontSize: 15, fontWeight: '600' }, { color: colors.text }]}>{r.title}</Text>
                                                <Text style={{ color: colors.subtext, fontSize: 12 }}>{r.points_required} ⭐ benötigt</Text>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                {members.map(m => (
                                                    <Pressable key={m.id} style={[styles.redeemBtn, { borderColor: m.points >= r.points_required ? '#10B981' : colors.border }]} onPress={() => redeemReward(m, r)}>
                                                        <Text style={{ fontSize: 10, color: m.points >= r.points_required ? '#10B981' : colors.subtext }}>{m.member_name}</Text>
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <>
                            {rewards.map(r => (
                                <View key={r.id} style={[styles.rewardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={{ fontSize: 28 }}>{r.emoji}</Text>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={[styles.rewardTitle, { color: colors.text }]}>{r.title}</Text>
                                        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>{r.points_required} ⭐</Text>
                                    </View>
                                    <Pressable onPress={async () => { await supabase.from('reward_catalog').delete().eq('id', r.id); loadData(); }}>
                                        <Trash2 size={14} color={colors.subtext} />
                                    </Pressable>
                                </View>
                            ))}
                            <Pressable style={[styles.addFullBtn, { backgroundColor: colors.accent }]} onPress={() => setShowAddReward(true)}>
                                <Plus size={18} color="#fff" /><Text style={styles.addFullBtnText}>Belohnung erstellen</Text>
                            </Pressable>
                        </>
                    )}
                </ScrollView>

                {/* Add Reward Modal */}
                <Modal visible={showAddReward} transparent animationType="fade">
                    <View style={styles.overlay}><View style={[styles.popup, { backgroundColor: colors.card }]}>
                        <Text style={[styles.popupTitle, { color: colors.text }]}>Neue Belohnung</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <Pressable key={e} style={[styles.emojiBtn, newRewardEmoji === e && { backgroundColor: colors.accent + '20' }]} onPress={() => setNewRewardEmoji(e)}>
                                    <Text style={{ fontSize: 20 }}>{e}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={newRewardTitle} onChangeText={setNewRewardTitle} placeholder="z.B. 30 Min. Bildschirmzeit" placeholderTextColor={colors.subtext} />
                        <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]} value={newRewardPoints} onChangeText={setNewRewardPoints} placeholder="Punkte (z.B. 10)" placeholderTextColor={colors.subtext} keyboardType="numeric" />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                            <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowAddReward(false)}><Text style={{ color: colors.subtext }}>Abbrechen</Text></Pressable>
                            <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={addReward}><Text style={{ color: '#fff', fontWeight: '700' }}>Erstellen</Text></Pressable>
                        </View>
                    </View></View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
    emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    memberCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    rank: { fontSize: 24, marginRight: 10 },
    memberName: { fontSize: 16, fontWeight: '700' },
    memberPoints: { fontSize: 20, fontWeight: '800', marginTop: 2 },
    pointBtns: { flexDirection: 'row', gap: 4 },
    ptBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
    rewardRedeemCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
    redeemBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginLeft: 4 },
    rewardCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    rewardTitle: { fontSize: 15, fontWeight: '600' },
    addFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
    addFullBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    popup: { borderRadius: 20, padding: 20 },
    popupTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    emojiBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
});

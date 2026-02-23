import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Image, Dimensions, Platform,
} from 'react-native';
import { Plus, X, Send, ImagePlus, Trash2, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface PinItem {
    id: string;
    household_id: string;
    created_by: string | null;
    content: string | null;
    image_url: string | null;
    pin_type: string;
    created_at: string;
}

interface FamilyMemberPush {
    user_id: string;
    email: string;
    display_name: string | null;
}

interface FamilyPinboardProps {
    visible: boolean;
    onClose: () => void;
}

const PIN_COLORS_LIGHT = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#C9B1FF', '#FFD93D', '#6BCB77'];

export const FamilyPinboard: React.FC<FamilyPinboardProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [pins, setPins] = useState<PinItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newContent, setNewContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [members, setMembers] = useState<Record<string, string>>({});
    const [familyMembers, setFamilyMembers] = useState<FamilyMemberPush[]>([]);
    const [selectedNotifyMembers, setSelectedNotifyMembers] = useState<Set<string>>(new Set());
    const [showNotifyPicker, setShowNotifyPicker] = useState(false);

    const loadPins = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_pins')
                .select('*')
                .eq('household_id', householdId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setPins(data || []);
        } catch (e: any) {
            console.error('Error loading pins:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    const loadMembers = useCallback(async () => {
        if (!householdId) return;
        try {
            const { data } = await supabase
                .from('family_members')
                .select('user_id, email, display_name')
                .eq('household_id', householdId)
                .eq('is_active', true);
            const map: Record<string, string> = {};
            const memberList: FamilyMemberPush[] = [];
            (data || []).forEach(m => {
                const name = m.display_name || m.email.split('@')[0];
                map[m.user_id] = name;
                memberList.push(m);
            });
            setMembers(map);
            setFamilyMembers(memberList);
            const allOthers = new Set((data || []).filter(m => m.user_id !== user?.id).map(m => m.user_id));
            setSelectedNotifyMembers(allOthers);
        } catch (e) { console.error(e); }
    }, [householdId, user?.id]);

    useEffect(() => {
        if (visible) { loadPins(); loadMembers(); }
    }, [visible, loadPins, loadMembers]);

    const sendPushNotifications = async (message: string) => {
        if (selectedNotifyMembers.size === 0) return;
        try {
            const { data: tokens } = await supabase
                .from('push_tokens')
                .select('token')
                .in('user_id', Array.from(selectedNotifyMembers));

            if (!tokens || tokens.length === 0) return;
            const expoPushTokens = tokens.map(t => t.token).filter(Boolean);
            if (expoPushTokens.length === 0) return;

            const senderName = members[user?.id || ''] || 'Jemand';
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expoPushTokens.map(token => ({
                    to: token,
                    title: '📌 Pinnwand',
                    body: `${senderName}: ${message.substring(0, 100)}`,
                    sound: 'default',
                    data: { type: 'pinboard' },
                }))),
            });
        } catch (e) {
            console.warn('Push notification failed:', e);
        }
    };

    const handlePostNote = async () => {
        if (!newContent.trim() || !householdId) return;
        setIsPosting(true);
        try {
            const { error } = await supabase.from('family_pins').insert({
                household_id: householdId,
                created_by: user?.id,
                content: newContent.trim(),
                pin_type: 'note',
            });
            if (error) throw error;
            sendPushNotifications(newContent.trim());
            setNewContent('');
            setShowNotifyPicker(false);
            loadPins();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsPosting(false);
        }
    };

    const handlePostImage = async () => {
        if (!householdId) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                allowsEditing: true,
            });
            if (result.canceled || !result.assets[0]) return;

            setIsPosting(true);
            const uri = result.assets[0].uri;
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpeg';
            const fileName = `pin-${householdId}-${Date.now()}.${fileExt}`;
            const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

            if (Platform.OS === 'web') {
                Alert.alert('Fehler', 'Foto-Upload nur auf dem Handy verfügbar.');
                return;
            }

            const file = new FileSystem.File(uri);
            const arrayBuffer = await file.arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('family-pins')
                .upload(fileName, arrayBuffer, { contentType, upsert: true });

            if (uploadError) {
                console.warn('Upload failed, posting as note:', uploadError.message);
                const { error } = await supabase.from('family_pins').insert({
                    household_id: householdId,
                    created_by: user?.id,
                    content: '📷 Foto',
                    pin_type: 'note',
                });
                if (error) throw error;
            } else {
                const { data: publicData } = supabase.storage.from('family-pins').getPublicUrl(fileName);
                const { error } = await supabase.from('family_pins').insert({
                    household_id: householdId,
                    created_by: user?.id,
                    image_url: publicData.publicUrl,
                    pin_type: 'photo',
                });
                if (error) throw error;
            }

            sendPushNotifications('📷 Neues Foto');
            loadPins();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsPosting(false);
        }
    };

    const handleDelete = (pin: PinItem) => {
        Alert.alert('Löschen', 'Beitrag löschen?', [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen', style: 'destructive', onPress: async () => {
                    await supabase.from('family_pins').delete().eq('id', pin.id);
                    loadPins();
                }
            }
        ]);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Gerade eben';
        if (diffMins < 60) return `vor ${diffMins} Min.`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `vor ${diffHours} Std.`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
        return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    };

    const toggleNotifyMember = (userId: string) => {
        setSelectedNotifyMembers(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const getPinColor = (index: number) => PIN_COLORS_LIGHT[index % PIN_COLORS_LIGHT.length];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18 }}>📌</Text>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Pinnwand</Text>
                    </View>
                    <Pressable onPress={handlePostImage}>
                        <ImagePlus size={22} color={colors.accent} />
                    </Pressable>
                </View>

                {/* Compose */}
                <View style={[styles.composeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                        style={[styles.composeInput, { color: colors.text }]}
                        value={newContent}
                        onChangeText={setNewContent}
                        placeholder="Nachricht an die Familie..."
                        placeholderTextColor={colors.subtext}
                        multiline
                        maxLength={500}
                    />
                    <Pressable
                        onPress={handlePostNote}
                        disabled={isPosting || !newContent.trim()}
                        style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: newContent.trim() ? 1 : 0.4 }]}
                    >
                        {isPosting ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color="#fff" />}
                    </Pressable>
                </View>

                {/* Notify picker */}
                {newContent.trim().length > 0 && (
                    <Pressable style={[styles.notifyToggle]} onPress={() => setShowNotifyPicker(!showNotifyPicker)}>
                        <Text style={[styles.notifyLabel, { color: colors.subtext }]}>🔔 Benachrichtigen ({selectedNotifyMembers.size})</Text>
                    </Pressable>
                )}
                {showNotifyPicker && (
                    <View style={styles.notifyPicker}>
                        {familyMembers.filter(m => m.user_id !== user?.id).map(m => {
                            const name = m.display_name || m.email.split('@')[0];
                            const isSelected = selectedNotifyMembers.has(m.user_id);
                            return (
                                <Pressable key={m.user_id} style={[styles.notifyChip, { backgroundColor: isSelected ? colors.accent + '15' : colors.card, borderColor: isSelected ? colors.accent : colors.border }]} onPress={() => toggleNotifyMember(m.user_id)}>
                                    <View style={[styles.notifyCheck, isSelected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                        {isSelected && <Check size={10} color="#fff" />}
                                    </View>
                                    <Text style={[styles.notifyName, { color: isSelected ? colors.text : colors.subtext }]}>{name}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {/* Pins Grid - Masonry-style */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40, width: '100%' }} />
                    ) : pins.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={{ fontSize: 40 }}>📌</Text>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                Noch keine Einträge.{'\n'}Teile etwas mit deiner Familie!
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.masonryContainer}>
                            {/* Left column */}
                            <View style={styles.masonryColumn}>
                                {pins.filter((_, i) => i % 2 === 0).map((pin, index) => renderPin(pin, index * 2))}
                            </View>
                            {/* Right column */}
                            <View style={styles.masonryColumn}>
                                {pins.filter((_, i) => i % 2 === 1).map((pin, index) => renderPin(pin, index * 2 + 1))}
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );

    function renderPin(pin: PinItem, index: number) {
        const pinColor = getPinColor(index);
        const isPhoto = pin.pin_type === 'photo' && pin.image_url;

        return (
            <View
                key={pin.id}
                style={[
                    styles.pinCard,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                {/* Colored pin indicator */}
                <View style={[styles.pinDot, { backgroundColor: pinColor }]} />

                {/* Photo displayed directly */}
                {isPhoto && (
                    <Image source={{ uri: pin.image_url! }} style={styles.pinImage} resizeMode="cover" />
                )}

                {/* Text content */}
                {pin.content && (
                    <Text style={[styles.pinContent, { color: colors.text }]}>{pin.content}</Text>
                )}

                {/* Footer */}
                <View style={styles.pinFooter}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.pinAuthor, { color: pinColor }]}>
                            {members[pin.created_by || ''] || 'Unbekannt'}
                        </Text>
                        <Text style={[styles.pinTime, { color: colors.subtext }]}>{formatDate(pin.created_at)}</Text>
                    </View>
                    {pin.created_by === user?.id && (
                        <Pressable onPress={() => handleDelete(pin)} hitSlop={12}>
                            <Trash2 size={13} color={colors.subtext} />
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },

    composeRow: {
        flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 12, marginTop: 12,
        borderRadius: 16, borderWidth: 1, paddingLeft: 14, paddingRight: 4, paddingVertical: 4,
    },
    composeInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
    sendBtn: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },

    notifyToggle: { marginHorizontal: 12, marginTop: 6, paddingVertical: 6, paddingHorizontal: 12 },
    notifyLabel: { fontSize: 12, fontWeight: '700' },
    notifyPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 12, marginBottom: 4 },
    notifyChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1,
    },
    notifyCheck: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#999', justifyContent: 'center', alignItems: 'center' },
    notifyName: { fontSize: 12, fontWeight: '600' },

    gridContainer: { padding: 12, paddingBottom: 40 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12, width: '100%' },
    emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

    masonryContainer: { flexDirection: 'row', gap: 10 },
    masonryColumn: { flex: 1, gap: 10 },

    pinCard: {
        borderRadius: 16, overflow: 'hidden', borderWidth: 1,
    },
    pinDot: {
        position: 'absolute', top: 10, right: 10, width: 8, height: 8,
        borderRadius: 4, zIndex: 2,
    },
    pinImage: {
        width: '100%', height: 160, backgroundColor: '#f0f0f0',
    },
    pinContent: {
        fontSize: 14, lineHeight: 20, padding: 12, paddingBottom: 4,
    },
    pinFooter: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
        paddingVertical: 8, paddingTop: 4,
    },
    pinAuthor: { fontSize: 12, fontWeight: '700' },
    pinTime: { fontSize: 10 },
});

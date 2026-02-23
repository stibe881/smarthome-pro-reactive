import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Image, Dimensions, Platform,
} from 'react-native';
import { Plus, X, Send, ImagePlus, Trash2, MessageCircle, Heart, Pin, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const PIN_TAPE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#C9B1FF', '#FFD93D', '#6BCB77'];
const NOTE_COLORS = ['#FFF9C4', '#FFECB3', '#F8BBD0', '#C8E6C9', '#B3E5FC', '#D1C4E9', '#FFCCBC', '#B2DFDB'];

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
            // Select all by default except current user
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
            // Get push tokens for selected members
            const { data: tokens } = await supabase
                .from('push_tokens')
                .select('token')
                .in('user_id', Array.from(selectedNotifyMembers));

            if (!tokens || tokens.length === 0) return;

            const expoPushTokens = tokens.map(t => t.token).filter(Boolean);
            if (expoPushTokens.length === 0) return;

            const senderName = members[user?.id || ''] || 'Jemand';

            // Send via Expo Push API
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

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: '#C4A882' }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: '#8B6914', borderBottomColor: '#A07D1A' }]}>
                    <Pressable onPress={onClose}><X size={24} color="#FFF8E7" /></Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18 }}>📌</Text>
                        <Text style={[styles.headerTitle, { color: '#FFF8E7' }]}>Pinnwand</Text>
                    </View>
                    <Pressable onPress={handlePostImage}>
                        <ImagePlus size={22} color="#FFF8E7" />
                    </Pressable>
                </View>

                {/* Compose */}
                <View style={[styles.composeRow, { backgroundColor: '#FFF9C4', borderColor: '#D4A76A' }]}>
                    <TextInput
                        style={[styles.composeInput, { color: '#5D4037' }]}
                        value={newContent}
                        onChangeText={setNewContent}
                        placeholder="Nachricht an die Familie..."
                        placeholderTextColor="#A1887F"
                        multiline
                        maxLength={500}
                    />
                    <Pressable
                        onPress={handlePostNote}
                        disabled={isPosting || !newContent.trim()}
                        style={[styles.sendBtn, { backgroundColor: '#8B6914', opacity: newContent.trim() ? 1 : 0.4 }]}
                    >
                        {isPosting ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color="#fff" />}
                    </Pressable>
                </View>

                {/* Notify picker */}
                {newContent.trim().length > 0 && (
                    <Pressable style={styles.notifyToggle} onPress={() => setShowNotifyPicker(!showNotifyPicker)}>
                        <Text style={styles.notifyLabel}>🔔 Benachrichtigen ({selectedNotifyMembers.size})</Text>
                    </Pressable>
                )}
                {showNotifyPicker && (
                    <View style={styles.notifyPicker}>
                        {familyMembers.filter(m => m.user_id !== user?.id).map(m => {
                            const name = m.display_name || m.email.split('@')[0];
                            const isSelected = selectedNotifyMembers.has(m.user_id);
                            return (
                                <Pressable key={m.user_id} style={styles.notifyChip} onPress={() => toggleNotifyMember(m.user_id)}>
                                    <View style={[styles.notifyCheck, isSelected && { backgroundColor: '#8B6914' }]}>
                                        {isSelected && <Check size={10} color="#fff" />}
                                    </View>
                                    <Text style={[styles.notifyName, { color: isSelected ? '#5D4037' : '#A1887F' }]}>{name}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {/* Pins Feed - Cork Board */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    {isLoading ? (
                        <ActivityIndicator color="#8B6914" style={{ paddingVertical: 40 }} />
                    ) : pins.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={{ fontSize: 40 }}>📌</Text>
                            <Text style={[styles.emptyText, { color: '#8B7355' }]}>
                                Noch keine Einträge.{'\n'}Teile etwas mit deiner Familie!
                            </Text>
                        </View>
                    ) : (
                        pins.map((pin, index) => {
                            const rotation = ((index * 7 + 3) % 7) - 3;
                            const noteColor = NOTE_COLORS[index % NOTE_COLORS.length];
                            const tapeColor = PIN_TAPE_COLORS[index % PIN_TAPE_COLORS.length];
                            return (
                                <View
                                    key={pin.id}
                                    style={[
                                        styles.pinCard,
                                        {
                                            backgroundColor: noteColor,
                                            transform: [{ rotate: `${rotation}deg` }],
                                        },
                                    ]}
                                >
                                    {/* Pin/tape at top */}
                                    <View style={[styles.pinTape, { backgroundColor: tapeColor }]} />
                                    <View style={styles.pinHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.pinAuthor, { color: '#5D4037' }]}>
                                                {members[pin.created_by || ''] || 'Unbekannt'}
                                            </Text>
                                            <Text style={[styles.pinTime, { color: '#8D6E63' }]}>{formatDate(pin.created_at)}</Text>
                                        </View>
                                        {pin.created_by === user?.id && (
                                            <Pressable onPress={() => handleDelete(pin)} hitSlop={12}>
                                                <Trash2 size={14} color="#A1887F" />
                                            </Pressable>
                                        )}
                                    </View>
                                    {pin.content && (
                                        <Text style={[styles.pinContent, { color: '#3E2723' }]}>{pin.content}</Text>
                                    )}
                                    {pin.image_url && (
                                        <Image source={{ uri: pin.image_url }} style={styles.pinImage} resizeMode="cover" />
                                    )}
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
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
        borderRadius: 4, borderWidth: 1, paddingLeft: 14, paddingRight: 4, paddingVertical: 4,
        shadowColor: '#000', shadowOffset: { width: 1, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3,
        elevation: 3,
    },
    composeInput: { flex: 1, fontSize: 15, paddingVertical: 8, fontFamily: Platform.OS === 'ios' ? 'Noteworthy' : undefined },
    sendBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },

    notifyToggle: { marginHorizontal: 12, marginTop: 6, paddingVertical: 6, paddingHorizontal: 12 },
    notifyLabel: { fontSize: 12, fontWeight: '700', color: '#5D4037' },
    notifyPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 12, marginBottom: 4 },
    notifyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF9C4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    notifyCheck: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#A1887F', justifyContent: 'center', alignItems: 'center' },
    notifyName: { fontSize: 12, fontWeight: '600' },

    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

    pinCard: {
        borderRadius: 2, padding: 14, marginBottom: 16, marginHorizontal: 4,
        shadowColor: '#000', shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4,
        elevation: 4,
    },
    pinTape: {
        position: 'absolute', top: -4, alignSelf: 'center', left: '40%',
        width: 50, height: 12, borderRadius: 1, opacity: 0.7,
    },
    pinHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 4 },
    pinAuthor: { fontSize: 14, fontWeight: '700' },
    pinTime: { fontSize: 11 },
    pinContent: { fontSize: 15, lineHeight: 22, marginBottom: 4 },
    pinImage: { width: '100%', height: 200, borderRadius: 4, marginTop: 8 },
});

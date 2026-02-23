import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Image, Dimensions, Platform,
} from 'react-native';
import { Plus, X, Send, ImagePlus, Trash2, MessageCircle, Heart } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Pin {
    id: string;
    household_id: string;
    created_by: string | null;
    content: string | null;
    image_url: string | null;
    pin_type: string;
    created_at: string;
}

interface FamilyPinboardProps {
    visible: boolean;
    onClose: () => void;
}

export const FamilyPinboard: React.FC<FamilyPinboardProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [pins, setPins] = useState<Pin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newContent, setNewContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [members, setMembers] = useState<Record<string, string>>({});

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
                .select('user_id, email')
                .eq('household_id', householdId);
            const map: Record<string, string> = {};
            (data || []).forEach(m => { map[m.user_id] = m.email.split('@')[0]; });
            setMembers(map);
        } catch (e) { console.error(e); }
    }, [householdId]);

    useEffect(() => {
        if (visible) { loadPins(); loadMembers(); }
    }, [visible, loadPins, loadMembers]);

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
            setNewContent('');
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
                // If bucket doesn't exist, save without image
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

            loadPins();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setIsPosting(false);
        }
    };

    const handleDelete = (pin: Pin) => {
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

    const PIN_COLORS = ['#3B82F620', '#10B98120', '#F59E0B20', '#EC489920', '#8B5CF620', '#06B6D420'];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Pinnwand</Text>
                    <Pressable onPress={handlePostImage}>
                        <ImagePlus size={22} color={colors.accent} />
                    </Pressable>
                </View>

                {/* Compose */}
                <View style={[styles.composeRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
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

                {/* Pins Feed */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                    ) : pins.length === 0 ? (
                        <View style={styles.empty}>
                            <MessageCircle size={40} color={colors.subtext} />
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                Noch keine Einträge.{'\n'}Teile etwas mit deiner Familie!
                            </Text>
                        </View>
                    ) : (
                        pins.map((pin, index) => (
                            <View
                                key={pin.id}
                                style={[
                                    styles.pinCard,
                                    { backgroundColor: colors.card, borderColor: colors.border },
                                ]}
                            >
                                <View style={styles.pinHeader}>
                                    <View style={[styles.pinAvatar, { backgroundColor: PIN_COLORS[index % PIN_COLORS.length] }]}>
                                        <Text style={styles.pinAvatarText}>
                                            {(members[pin.created_by || ''] || '??').substring(0, 2).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.pinAuthor, { color: colors.text }]}>
                                            {members[pin.created_by || ''] || 'Unbekannt'}
                                        </Text>
                                        <Text style={[styles.pinTime, { color: colors.subtext }]}>{formatDate(pin.created_at)}</Text>
                                    </View>
                                    {pin.created_by === user?.id && (
                                        <Pressable onPress={() => handleDelete(pin)} hitSlop={12}>
                                            <Trash2 size={14} color={colors.subtext} />
                                        </Pressable>
                                    )}
                                </View>
                                {pin.content && (
                                    <Text style={[styles.pinContent, { color: colors.text }]}>{pin.content}</Text>
                                )}
                                {pin.image_url && (
                                    <Image source={{ uri: pin.image_url }} style={styles.pinImage} resizeMode="cover" />
                                )}
                            </View>
                        ))
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
        flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 16, marginTop: 12,
        borderRadius: 16, borderWidth: 1, paddingLeft: 14, paddingRight: 4, paddingVertical: 4,
    },
    composeInput: { flex: 1, fontSize: 15, paddingVertical: 8, maxHeight: 80 },
    sendBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },

    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

    pinCard: {
        borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12, overflow: 'hidden',
    },
    pinHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    pinAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    pinAvatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    pinAuthor: { fontSize: 14, fontWeight: '600' },
    pinTime: { fontSize: 11 },
    pinContent: { fontSize: 15, lineHeight: 21, marginBottom: 4 },
    pinImage: { width: '100%', height: 200, borderRadius: 12, marginTop: 8 },
});

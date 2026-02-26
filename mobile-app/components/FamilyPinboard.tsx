import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Image, Dimensions, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Plus, X, Send, ImagePlus, Trash2, Check, Heart, MessageCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_MAX_WIDTH = SCREEN_WIDTH - 24 - 2; // card margin + border

// Component for auto-sizing pinboard images
const PinImage: React.FC<{ uri: string }> = React.memo(({ uri }) => {
    const [ratio, setRatio] = useState(4 / 3);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        console.log('[PinImage] Loading image:', uri);
        Image.getSize(
            uri,
            (w, h) => {
                console.log('[PinImage] Got size:', w, h);
                if (w && h) setRatio(w / h);
            },
            (err) => {
                console.warn('[PinImage] getSize failed:', err);
            },
        );
    }, [uri]);

    // Clamp aspect ratio so images aren't absurdly tall or wide
    const clampedRatio = Math.max(0.5, Math.min(ratio, 2.0));

    if (error) {
        return (
            <View style={[styles.postImage, { aspectRatio: clampedRatio, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2a2a2a' }]}>
                <Text style={{ color: '#999', fontSize: 13 }}>📷 Foto konnte nicht geladen werden</Text>
                <Text style={{ color: '#666', fontSize: 10, marginTop: 4 }} numberOfLines={1}>{uri}</Text>
            </View>
        );
    }

    return (
        <View>
            {loading && (
                <ActivityIndicator style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} color="#999" />
            )}
            <Image
                source={{ uri }}
                style={[styles.postImage, { aspectRatio: clampedRatio }]}
                resizeMode="cover"
                onLoad={() => { console.log('[PinImage] Image loaded OK'); setLoading(false); }}
                onError={(e) => { console.warn('[PinImage] Image load error:', e.nativeEvent?.error, uri); setError(true); setLoading(false); }}
            />
        </View>
    );
});

interface PinItem {
    id: string;
    household_id: string;
    created_by: string | null;
    content: string | null;
    image_url: string | null;
    pin_type: string;
    created_at: string;
    likes_count: number;
    liked_by_me: boolean;
    comments_count: number;
}

interface CommentItem {
    id: string;
    pin_id: string;
    user_id: string | null;
    content: string;
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

    // Comments state
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
    const [commentsByPin, setCommentsByPin] = useState<Record<string, CommentItem[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
    const [postingComment, setPostingComment] = useState<string | null>(null);

    const loadPins = useCallback(async () => {
        if (!householdId || !user?.id) return;
        setIsLoading(true);
        try {
            const { data: pinsData, error } = await supabase
                .from('family_pins')
                .select('*')
                .eq('household_id', householdId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            if (!pinsData) { setPins([]); return; }

            // Debug: log all pins with images
            pinsData.forEach(p => {
                console.log('[Pinboard] Pin:', p.id, 'type:', p.pin_type, 'image_url:', p.image_url, 'content:', p.content?.substring(0, 30));
            });

            // Fetch likes counts & my likes
            const pinIds = pinsData.map(p => p.id);

            const [likesRes, myLikesRes, commentsRes] = await Promise.all([
                supabase
                    .from('pin_likes')
                    .select('pin_id')
                    .in('pin_id', pinIds),
                supabase
                    .from('pin_likes')
                    .select('pin_id')
                    .in('pin_id', pinIds)
                    .eq('user_id', user.id),
                supabase
                    .from('pin_comments')
                    .select('pin_id')
                    .in('pin_id', pinIds),
            ]);

            // Count likes per pin
            const likesMap: Record<string, number> = {};
            (likesRes.data || []).forEach(l => {
                likesMap[l.pin_id] = (likesMap[l.pin_id] || 0) + 1;
            });

            // My likes set
            const myLikesSet = new Set((myLikesRes.data || []).map(l => l.pin_id));

            // Count comments per pin
            const commentsMap: Record<string, number> = {};
            (commentsRes.data || []).forEach(c => {
                commentsMap[c.pin_id] = (commentsMap[c.pin_id] || 0) + 1;
            });

            const enriched: PinItem[] = pinsData.map(p => ({
                ...p,
                likes_count: likesMap[p.id] || 0,
                liked_by_me: myLikesSet.has(p.id),
                comments_count: commentsMap[p.id] || 0,
            }));

            setPins(enriched);
        } catch (e: any) {
            console.error('Error loading pins:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId, user?.id]);

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
            const asset = result.assets[0];
            const uri = asset.uri;
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpeg';
            const fileName = `pin-${householdId}-${Date.now()}.${fileExt}`;
            const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

            console.log('[Pinboard] Starting upload:', fileName, 'from:', uri);

            // Upload directly via Supabase Storage REST API using FormData
            // (supabase-js client produces 0-byte files on React Native)
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;
            const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

            const formData = new FormData();
            formData.append('', {
                uri: uri,
                name: fileName,
                type: mimeType,
            } as any);

            const uploadUrl = `${supabaseUrl}/storage/v1/object/family-pins/${fileName}`;
            console.log('[Pinboard] Uploading to:', uploadUrl);

            const uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken || anonKey}`,
                    'apikey': anonKey,
                    'x-upsert': 'true',
                },
                body: formData,
            });

            const uploadResult = await uploadRes.json();
            console.log('[Pinboard] Upload response:', uploadRes.status, JSON.stringify(uploadResult));

            if (!uploadRes.ok) {
                console.error('[Pinboard] Upload failed:', uploadResult.message || uploadResult.error);
                Alert.alert('Upload Fehler', `Foto konnte nicht hochgeladen werden:\n${uploadResult.message || uploadResult.error || 'Unbekannter Fehler'}`);
                return;
            }

            // Upload succeeded — get public URL
            const { data: publicData } = supabase.storage.from('family-pins').getPublicUrl(fileName);
            console.log('[Pinboard] Upload success! Public URL:', publicData.publicUrl);

            const caption = newContent.trim() || null;
            const { error: insertError } = await supabase.from('family_pins').insert({
                household_id: householdId,
                created_by: user?.id,
                image_url: publicData.publicUrl,
                content: caption,
                pin_type: 'photo',
            });
            if (insertError) throw insertError;
            if (caption) setNewContent('');

            sendPushNotifications('📷 Neues Foto');
            loadPins();
        } catch (e: any) {
            console.error('[Pinboard] handlePostImage error:', e);
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

    // --- Like ---
    const handleToggleLike = async (pin: PinItem) => {
        if (!user?.id) return;
        // Optimistic update
        setPins(prev => prev.map(p => p.id === pin.id ? {
            ...p,
            liked_by_me: !p.liked_by_me,
            likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1,
        } : p));

        try {
            if (pin.liked_by_me) {
                await supabase.from('pin_likes').delete()
                    .eq('pin_id', pin.id).eq('user_id', user.id);
            } else {
                await supabase.from('pin_likes').insert({
                    pin_id: pin.id, user_id: user.id,
                });
            }
        } catch (e) {
            // Revert on error
            setPins(prev => prev.map(p => p.id === pin.id ? {
                ...p,
                liked_by_me: pin.liked_by_me,
                likes_count: pin.likes_count,
            } : p));
        }
    };

    // --- Comments ---
    const toggleComments = async (pinId: string) => {
        setExpandedComments(prev => {
            const next = new Set(prev);
            if (next.has(pinId)) {
                next.delete(pinId);
            } else {
                next.add(pinId);
                loadComments(pinId);
            }
            return next;
        });
    };

    const loadComments = async (pinId: string) => {
        try {
            const { data } = await supabase
                .from('pin_comments')
                .select('*')
                .eq('pin_id', pinId)
                .order('created_at', { ascending: true })
                .limit(50);
            setCommentsByPin(prev => ({ ...prev, [pinId]: data || [] }));
        } catch (e) { console.error(e); }
    };

    const handlePostComment = async (pinId: string) => {
        const text = (commentInputs[pinId] || '').trim();
        if (!text || !user?.id) return;
        setPostingComment(pinId);
        try {
            const { error } = await supabase.from('pin_comments').insert({
                pin_id: pinId, user_id: user.id, content: text,
            });
            if (error) throw error;
            setCommentInputs(prev => ({ ...prev, [pinId]: '' }));
            loadComments(pinId);
            // Update comments count
            setPins(prev => prev.map(p => p.id === pinId ? {
                ...p, comments_count: p.comments_count + 1,
            } : p));
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        } finally {
            setPostingComment(null);
        }
    };

    const handleDeleteComment = async (comment: CommentItem) => {
        await supabase.from('pin_comments').delete().eq('id', comment.id);
        loadComments(comment.pin_id);
        setPins(prev => prev.map(p => p.id === comment.pin_id ? {
            ...p, comments_count: Math.max(0, p.comments_count - 1),
        } : p));
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

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const getPinTypeLabel = (pin: PinItem) => {
        if (pin.pin_type === 'photo') return 'hat ein Foto geteilt';
        return 'Notiz hinzufügen';
    };

    const renderPost = (pin: PinItem) => {
        const authorName = members[pin.created_by || ''] || 'Unbekannt';
        const initials = getInitials(authorName);
        const isPhoto = !!pin.image_url;
        const isExpanded = expandedComments.has(pin.id);
        const comments = commentsByPin[pin.id] || [];

        if (pin.image_url) {
            console.log('[Pinboard] Rendering pin with image:', pin.id, 'type:', pin.pin_type, 'url:', pin.image_url);
        }

        return (
            <View key={pin.id} style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Post header - avatar + name + time */}
                <View style={styles.postHeader}>
                    <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.authorName, { color: colors.text }]}>
                            <Text style={{ fontWeight: '700' }}>{authorName}</Text>
                            <Text style={{ fontWeight: '400', color: colors.subtext }}> {getPinTypeLabel(pin)}</Text>
                        </Text>
                        <Text style={[styles.postTime, { color: colors.subtext }]}>{formatDate(pin.created_at)}</Text>
                    </View>
                    {pin.created_by === user?.id && (
                        <Pressable onPress={() => handleDelete(pin)} hitSlop={12}>
                            <Trash2 size={16} color={colors.subtext} />
                        </Pressable>
                    )}
                </View>

                {/* Text content */}
                {pin.content && (
                    <Text style={[styles.postContent, { color: colors.text }]}>{pin.content}</Text>
                )}

                {/* Photo – directly visible */}
                {isPhoto && (
                    <PinImage uri={pin.image_url!} />
                )}

                {/* Action bar - Like + Comment */}
                <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
                    <Pressable
                        style={styles.actionBtn}
                        onPress={() => handleToggleLike(pin)}
                    >
                        <Heart
                            size={20}
                            color={pin.liked_by_me ? '#EF4444' : colors.subtext}
                            fill={pin.liked_by_me ? '#EF4444' : 'transparent'}
                        />
                        {pin.likes_count > 0 && (
                            <Text style={[styles.actionCount, { color: pin.liked_by_me ? '#EF4444' : colors.subtext }]}>
                                {pin.likes_count}
                            </Text>
                        )}
                    </Pressable>

                    <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

                    <Pressable
                        style={styles.actionBtn}
                        onPress={() => toggleComments(pin.id)}
                    >
                        <MessageCircle
                            size={20}
                            color={isExpanded ? colors.accent : colors.subtext}
                        />
                        {pin.comments_count > 0 && (
                            <Text style={[styles.actionCount, { color: isExpanded ? colors.accent : colors.subtext }]}>
                                {pin.comments_count}
                            </Text>
                        )}
                    </Pressable>
                </View>

                {/* Comments section */}
                {isExpanded && (
                    <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
                        {comments.map(comment => {
                            const cName = members[comment.user_id || ''] || 'Unbekannt';
                            return (
                                <View key={comment.id} style={styles.commentRow}>
                                    <View style={[styles.commentAvatar, { backgroundColor: colors.accent + '30' }]}>
                                        <Text style={[styles.commentAvatarText, { color: colors.accent }]}>
                                            {getInitials(cName)}
                                        </Text>
                                    </View>
                                    <View style={[styles.commentBubble, { backgroundColor: colors.background }]}>
                                        <Text style={[styles.commentAuthor, { color: colors.text }]}>{cName}</Text>
                                        <Text style={[styles.commentText, { color: colors.text }]}>{comment.content}</Text>
                                        <Text style={[styles.commentTime, { color: colors.subtext }]}>{formatDate(comment.created_at)}</Text>
                                    </View>
                                    {comment.user_id === user?.id && (
                                        <Pressable onPress={() => handleDeleteComment(comment)} hitSlop={12} style={{ paddingTop: 4 }}>
                                            <Trash2 size={12} color={colors.subtext} />
                                        </Pressable>
                                    )}
                                </View>
                            );
                        })}

                        {/* Comment input */}
                        <View style={[styles.commentInputRow, { borderTopColor: comments.length > 0 ? colors.border : 'transparent' }]}>
                            <TextInput
                                style={[styles.commentInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                                value={commentInputs[pin.id] || ''}
                                onChangeText={t => setCommentInputs(prev => ({ ...prev, [pin.id]: t }))}
                                placeholder="Kommentar schreiben..."
                                placeholderTextColor={colors.subtext}
                                maxLength={300}
                            />
                            <Pressable
                                onPress={() => handlePostComment(pin.id)}
                                disabled={postingComment === pin.id || !(commentInputs[pin.id] || '').trim()}
                                style={[styles.commentSendBtn, {
                                    backgroundColor: colors.accent,
                                    opacity: (commentInputs[pin.id] || '').trim() ? 1 : 0.4,
                                }]}
                            >
                                {postingComment === pin.id
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Send size={14} color="#fff" />
                                }
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: colors.background }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 22 }}>📌</Text>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Pinnwand</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Pressable onPress={handlePostImage}>
                            <ImagePlus size={22} color={colors.accent} />
                        </Pressable>
                        <Pressable onPress={onClose} style={{ padding: 4, borderRadius: 20, backgroundColor: colors.border }}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>
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

                {/* Posts Feed */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.feedContainer} showsVerticalScrollIndicator={false}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                    ) : pins.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={{ fontSize: 40 }}>📌</Text>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                Noch keine Einträge.{'\n'}Teile etwas mit deiner Familie!
                            </Text>
                        </View>
                    ) : (
                        pins.map(pin => renderPost(pin))
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },

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

    feedContainer: { padding: 12, paddingBottom: 40, gap: 16 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

    // Post card
    postCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 10,
    },
    avatar: {
        width: 42, height: 42, borderRadius: 21,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: {
        color: '#fff', fontSize: 14, fontWeight: '700',
    },
    authorName: { fontSize: 14, lineHeight: 18 },
    postTime: { fontSize: 12, marginTop: 1 },

    postContent: {
        fontSize: 15, lineHeight: 22,
        paddingHorizontal: 14, paddingBottom: 12,
    },
    postImage: {
        width: '100%',
        height: undefined,
        aspectRatio: 4 / 3,
        borderRadius: 0,
    },

    // Action bar
    actionBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 6,
    },
    actionCount: { fontSize: 13, fontWeight: '600' },
    actionDivider: { width: 1, marginVertical: 8 },

    // Comments
    commentsSection: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    commentRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
        alignItems: 'flex-start',
    },
    commentAvatar: {
        width: 28, height: 28, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
        marginTop: 2,
    },
    commentAvatarText: { fontSize: 10, fontWeight: '700' },
    commentBubble: {
        flex: 1,
        borderRadius: 12,
        padding: 10,
    },
    commentAuthor: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
    commentText: { fontSize: 13, lineHeight: 18 },
    commentTime: { fontSize: 10, marginTop: 4 },

    commentInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    commentInput: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 13,
    },
    commentSendBtn: {
        width: 32, height: 32, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
});

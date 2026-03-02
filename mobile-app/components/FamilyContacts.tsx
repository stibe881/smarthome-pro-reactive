import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Linking, Image, Platform,
} from 'react-native';
import { X, Plus, Trash2, Phone, MapPin, User, Edit3, Siren, Hospital, GraduationCap, Baby, Users, ClipboardList, Heart, Camera } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

interface Contact {
    id: string;
    household_id: string;
    name: string;
    phone: string;
    category: string;
    notes: string | null;
    image_url: string | null;
    created_at: string;
}

const CATEGORIES = [
    { key: 'emergency', label: 'Notfall', icon: Siren, color: '#EF4444' },
    { key: 'doctor', label: 'Arzt', icon: Hospital, color: '#3B82F6' },
    { key: 'school', label: 'Schule', icon: GraduationCap, color: '#F59E0B' },
    { key: 'babysitter', label: 'Babysitter', icon: Baby, color: '#EC4899' },
    { key: 'family', label: 'Familie', icon: Users, color: '#10B981' },
    { key: 'mami', label: 'Mami', icon: Heart, color: '#F472B6' },
    { key: 'papi', label: 'Papi', icon: User, color: '#6366F1' },
    { key: 'other', label: 'Sonstige', icon: ClipboardList, color: '#6B7280' },
];

const STORAGE_BUCKET = 'avatars'; // Reuse existing bucket

interface ContactsProps { visible: boolean; onClose: () => void; }

export const FamilyContacts: React.FC<ContactsProps> = ({ visible, onClose }) => {
    const { colors } = useTheme();
    const { householdId } = useHousehold();

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formCategory, setFormCategory] = useState('other');
    const [formNotes, setFormNotes] = useState('');
    const [formImageUri, setFormImageUri] = useState<string | null>(null); // Local picked URI
    const [formImageUrl, setFormImageUrl] = useState<string | null>(null); // Existing Supabase URL
    const [editId, setEditId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const loadContacts = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_contacts')
                .select('*')
                .eq('household_id', householdId)
                .order('category')
                .order('name');
            if (error) throw error;
            setContacts(data || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [householdId]);

    useEffect(() => { if (visible) loadContacts(); }, [visible, loadContacts]);

    // ── Image Picker ──
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled && result.assets.length > 0) {
            setFormImageUri(result.assets[0].uri);
        }
    };

    // ── Upload Image to Supabase Storage ──
    const uploadImage = async (contactId: string): Promise<string | null> => {
        if (!formImageUri) return formImageUrl; // Keep existing

        try {
            if (Platform.OS === 'web') return null;
            const file = new FileSystem.File(formImageUri);
            const arrayBuffer = await file.arrayBuffer();

            const fileExt = formImageUri.split('.').pop()?.toLowerCase() || 'jpeg';
            const fileName = `contact-${contactId}-${Date.now()}.${fileExt}`;
            const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(fileName, arrayBuffer, { contentType, upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (e) {
            console.warn('Image upload failed:', e);
            return formImageUrl;
        }
    };

    // ── Save Contact ──
    const handleSave = async () => {
        if (!formName.trim() || !formPhone.trim() || !householdId) return;
        setIsUploading(true);
        try {
            const payload: any = {
                household_id: householdId,
                name: formName.trim(),
                phone: formPhone.trim(),
                category: formCategory,
                notes: formNotes.trim() || null,
            };

            if (editId) {
                // Upload image if changed
                const imageUrl = await uploadImage(editId);
                payload.image_url = imageUrl;
                await supabase.from('family_contacts').update(payload).eq('id', editId);
            } else {
                // Insert first to get ID, then upload
                const { data, error } = await supabase
                    .from('family_contacts')
                    .insert(payload)
                    .select('id')
                    .single();
                if (error) throw error;
                if (data && formImageUri) {
                    const imageUrl = await uploadImage(data.id);
                    await supabase.from('family_contacts')
                        .update({ image_url: imageUrl })
                        .eq('id', data.id);
                }
            }
            resetForm(); loadContacts();
        } catch (e: any) { Alert.alert('Fehler', e.message); }
        finally { setIsUploading(false); }
    };

    const resetForm = () => {
        setFormName(''); setFormPhone(''); setFormCategory('other');
        setFormNotes(''); setFormImageUri(null); setFormImageUrl(null);
        setEditId(null); setShowAdd(false);
    };

    const openEdit = (c: Contact) => {
        setFormName(c.name); setFormPhone(c.phone); setFormCategory(c.category);
        setFormNotes(c.notes || ''); setFormImageUri(null);
        setFormImageUrl(c.image_url || null);
        setEditId(c.id); setShowAdd(true);
    };

    const handleDelete = (c: Contact) => {
        Alert.alert('Löschen', `"${c.name}" löschen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: async () => { await supabase.from('family_contacts').delete().eq('id', c.id); loadContacts(); } },
        ]);
    };

    const getCategory = (key: string) => CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

    const groupedContacts = CATEGORIES.map(cat => ({
        ...cat,
        items: contacts.filter(c => c.category === cat.key),
    })).filter(g => g.items.length > 0);

    // Determine which image to show in form
    const formDisplayImage = formImageUri || formImageUrl;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.titleRow}>
                        <Phone size={24} color={colors.accent} />
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Wichtige Kontakte</Text>
                    </View>
                    <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                        <X size={24} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                    {isLoading ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} /> :
                        contacts.length === 0 ? (
                            <View style={styles.empty}>
                                <Phone size={40} color={colors.subtext} />
                                <Text style={[styles.emptyText, { color: colors.subtext }]}>Noch keine Kontakte.{'\n'}Füge wichtige Nummern hinzu!</Text>
                            </View>
                        ) : (
                            groupedContacts.map(group => (
                                <View key={group.key} style={{ marginBottom: 20 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <group.icon size={16} color={group.color} />
                                        <Text style={[styles.groupTitle, { color: colors.subtext }]}>{group.label}</Text>
                                    </View>
                                    {group.items.map(c => {
                                        const cat = getCategory(c.category);
                                        return (
                                            <Pressable key={c.id} style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                                                {c.image_url ? (
                                                    <Image source={{ uri: c.image_url }} style={styles.contactImage} />
                                                ) : (
                                                    <View style={[styles.contactIcon, { backgroundColor: cat.color + '15' }]}>
                                                        <cat.icon size={20} color={cat.color} />
                                                    </View>
                                                )}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.contactName, { color: colors.text }]}>{c.name}</Text>
                                                    <Text style={[styles.contactPhone, { color: colors.accent }]}>{c.phone}</Text>
                                                    {c.notes && <Text style={[styles.contactNotes, { color: colors.subtext }]}>{c.notes}</Text>}
                                                </View>
                                                <View style={styles.contactActions}>
                                                    <Pressable onPress={() => openEdit(c)} hitSlop={8}><Edit3 size={14} color={colors.subtext} /></Pressable>
                                                    <Pressable onPress={() => handleDelete(c)} hitSlop={8}><Trash2 size={14} color={colors.subtext} /></Pressable>
                                                </View>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            ))
                        )}
                </ScrollView>

                {/* FAB */}
                <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={() => { resetForm(); setShowAdd(true); }}>
                    <Plus size={24} color="#fff" />
                </Pressable>

                {/* Add/Edit Modal */}
                <Modal visible={showAdd} transparent animationType="fade">
                    <View style={styles.overlay}><View style={[styles.popup, { backgroundColor: colors.card }]}>
                        <Text style={[styles.popupTitle, { color: colors.text }]}>{editId ? 'Bearbeiten' : 'Neuer Kontakt'}</Text>

                        {/* Image Picker */}
                        <Pressable onPress={pickImage} style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.background }]}>
                            {formDisplayImage ? (
                                <Image source={{ uri: formDisplayImage }} style={styles.imagePreview} />
                            ) : (
                                <View style={styles.imagePickerPlaceholder}>
                                    <Camera size={24} color={colors.subtext} />
                                    <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 4 }}>Foto</Text>
                                </View>
                            )}
                        </Pressable>

                        <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={formName} onChangeText={setFormName} placeholder="Name" placeholderTextColor={colors.subtext} />
                        <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]} value={formPhone} onChangeText={setFormPhone} placeholder="Telefonnummer" placeholderTextColor={colors.subtext} keyboardType="phone-pad" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, maxHeight: 44 }}>
                            {CATEGORIES.map(cat => (
                                <Pressable key={cat.key} style={[styles.catBtn, formCategory === cat.key && { backgroundColor: cat.color + '20', borderColor: cat.color }]} onPress={() => setFormCategory(cat.key)}>
                                    <cat.icon size={16} color={formCategory === cat.key ? cat.color : colors.subtext} />
                                    <Text style={{ fontSize: 10, color: formCategory === cat.key ? cat.color : colors.subtext }}>{cat.label}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                        <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, marginTop: 10 }]} value={formNotes} onChangeText={setFormNotes} placeholder="Notizen (optional)" placeholderTextColor={colors.subtext} />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                            <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetForm}><Text style={{ color: colors.subtext }}>Abbrechen</Text></Pressable>
                            <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: isUploading ? 0.6 : 1 }]} onPress={handleSave} disabled={isUploading}>
                                {isUploading
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={{ color: '#fff', fontWeight: '700' }}>Speichern</Text>
                                }
                            </Pressable>
                        </View>
                    </View></View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4, borderRadius: 20 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    groupTitle: { fontSize: 14, fontWeight: '700' },
    contactCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
    contactIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    contactImage: { width: 40, height: 40, borderRadius: 12, marginRight: 12 },
    contactName: { fontSize: 15, fontWeight: '600' },
    contactPhone: { fontSize: 14, fontWeight: '600', marginTop: 2 },
    contactNotes: { fontSize: 12, marginTop: 2 },
    contactActions: { gap: 12 },
    fab: {
        position: 'absolute', bottom: 30, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 6, shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    popup: { borderRadius: 20, padding: 20 },
    popupTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
    imagePicker: {
        alignSelf: 'center', width: 72, height: 72, borderRadius: 36,
        borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden',
        marginBottom: 14, justifyContent: 'center', alignItems: 'center',
    },
    imagePreview: { width: 72, height: 72, borderRadius: 36 },
    imagePickerPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    catBtn: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginRight: 6 },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
});

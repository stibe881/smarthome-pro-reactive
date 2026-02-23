import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Platform,
} from 'react-native';
import {
    X, Plus, Search, FileText, Image, File, Trash2, Download,
    FolderOpen, Lock, Upload, Tag,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHousehold } from '../hooks/useHousehold';
import { supabase } from '../lib/supabase';

interface FamilyDocument {
    id: string;
    household_id: string;
    uploaded_by: string | null;
    file_name: string;
    file_url: string;
    file_size: number;
    file_type: string;
    category: string;
    description: string | null;
    created_at: string;
}

const DOC_CATEGORIES = [
    { key: 'all', label: 'Alle', emoji: '📁' },
    { key: 'insurance', label: 'Versicherung', emoji: '🛡️' },
    { key: 'health', label: 'Gesundheit', emoji: '🏥' },
    { key: 'finance', label: 'Finanzen', emoji: '💰' },
    { key: 'school', label: 'Schule', emoji: '🎓' },
    { key: 'contract', label: 'Verträge', emoji: '📝' },
    { key: 'id', label: 'Ausweise', emoji: '🪪' },
    { key: 'other', label: 'Sonstiges', emoji: '📎' },
];

interface FamilyDocumentsProps {
    visible: boolean;
    onClose: () => void;
}

export function FamilyDocuments({ visible, onClose }: FamilyDocumentsProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [documents, setDocuments] = useState<FamilyDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [uploadCategory, setUploadCategory] = useState('other');
    const [uploadDescription, setUploadDescription] = useState('');
    const [showUploadOptions, setShowUploadOptions] = useState(false);

    const loadDocuments = useCallback(async () => {
        if (!householdId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('family_documents')
                .select('*')
                .eq('household_id', householdId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setDocuments(data || []);
        } catch (e: any) {
            console.error('Error loading documents:', e);
        } finally {
            setIsLoading(false);
        }
    }, [householdId]);

    useEffect(() => { if (visible) loadDocuments(); }, [visible, loadDocuments]);

    const filtered = documents.filter(d => {
        const matchCat = selectedCategory === 'all' || d.category === selectedCategory;
        const matchSearch = !searchQuery || d.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    const getFileIcon = (type: string) => {
        if (type.includes('image')) return '🖼️';
        if (type.includes('pdf')) return '📄';
        if (type.includes('spreadsheet') || type.includes('excel')) return '📊';
        if (type.includes('word') || type.includes('document')) return '📝';
        return '📎';
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleUpload = async () => {
        if (!householdId) return;

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets?.length) return;
            const file = result.assets[0];

            setShowUploadOptions(true);

            // Store selected file info for later upload after category selection
            (handleUpload as any)._pendingFile = file;
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    const confirmUpload = async () => {
        const file = (handleUpload as any)._pendingFile;
        if (!file || !householdId) return;

        setIsUploading(true);
        setShowUploadOptions(false);

        try {
            const fileExt = file.name.split('.').pop() || 'bin';
            const filePath = `${householdId}/${Date.now()}.${fileExt}`;

            // Read file as base64
            const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
            const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('family-documents')
                .upload(filePath, binaryData, {
                    contentType: file.mimeType || 'application/octet-stream',
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage.from('family-documents').getPublicUrl(filePath);

            // Save metadata
            const { error: dbError } = await supabase.from('family_documents').insert({
                household_id: householdId,
                uploaded_by: user?.id,
                file_name: file.name,
                file_url: urlData.publicUrl,
                file_size: file.size || 0,
                file_type: file.mimeType || 'application/octet-stream',
                category: uploadCategory,
                description: uploadDescription.trim() || null,
            });

            if (dbError) throw dbError;

            setUploadDescription('');
            setUploadCategory('other');
            loadDocuments();
        } catch (e: any) {
            Alert.alert('Fehler beim Hochladen', e.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownload = async (doc: FamilyDocument) => {
        try {
            const fileUri = FileSystem.cacheDirectory + doc.file_name;
            const downloadRes = await FileSystem.downloadAsync(doc.file_url, fileUri);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(downloadRes.uri);
            } else {
                Alert.alert('Erfolg', 'Datei wurde heruntergeladen.');
            }
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    const handleDelete = (doc: FamilyDocument) => {
        Alert.alert('Löschen', `"${doc.file_name}" wirklich löschen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen', style: 'destructive', onPress: async () => {
                    // Delete from storage
                    const pathParts = doc.file_url.split('/family-documents/');
                    if (pathParts[1]) {
                        await supabase.storage.from('family-documents').remove([pathParts[1]]);
                    }
                    // Delete metadata
                    await supabase.from('family_documents').delete().eq('id', doc.id);
                    loadDocuments();
                }
            },
        ]);
    };

    const getCatEmoji = (key: string) => DOC_CATEGORIES.find(c => c.key === key)?.emoji || '📎';
    const getCatLabel = (key: string) => DOC_CATEGORIES.find(c => c.key === key)?.label || 'Sonstiges';

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose}><X size={24} color={colors.subtext} /></Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Dokumentsafe</Text>
                    <Pressable onPress={handleUpload}><Upload size={22} color={colors.accent} /></Pressable>
                </View>

                {/* Search */}
                <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Search size={16} color={colors.subtext} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Dokument suchen..."
                        placeholderTextColor={colors.subtext}
                    />
                </View>

                {/* Categories */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                    {DOC_CATEGORIES.map(cat => (
                        <Pressable
                            key={cat.key}
                            style={[styles.catChip, {
                                backgroundColor: selectedCategory === cat.key ? colors.accent + '20' : colors.card,
                                borderColor: selectedCategory === cat.key ? colors.accent : colors.border,
                            }]}
                            onPress={() => setSelectedCategory(cat.key)}
                        >
                            <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                            <Text style={[styles.catLabel, { color: selectedCategory === cat.key ? colors.accent : colors.text }]}>{cat.label}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {isUploading && (
                    <View style={[styles.uploadingBar, { backgroundColor: colors.accent + '10' }]}>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Wird hochgeladen...</Text>
                    </View>
                )}

                {/* Documents List */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                    ) : filtered.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={{ fontSize: 48 }}>🔒</Text>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                {searchQuery ? 'Keine Dokumente gefunden' : 'Noch keine Dokumente.\nLade dein erstes Dokument hoch!'}
                            </Text>
                        </View>
                    ) : (
                        filtered.map(doc => (
                            <View key={doc.id} style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={{ fontSize: 28 }}>{getFileIcon(doc.file_type)}</Text>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.docName, { color: colors.text }]} numberOfLines={1}>{doc.file_name}</Text>
                                    {doc.description ? (
                                        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{doc.description}</Text>
                                    ) : null}
                                    <View style={styles.docMeta}>
                                        <View style={[styles.catBadge, { backgroundColor: colors.accent + '10' }]}>
                                            <Text style={{ fontSize: 10 }}>{getCatEmoji(doc.category)}</Text>
                                            <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '600' }}>{getCatLabel(doc.category)}</Text>
                                        </View>
                                        <Text style={{ color: colors.subtext, fontSize: 10 }}>{formatFileSize(doc.file_size)}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Pressable onPress={() => handleDownload(doc)} hitSlop={12}>
                                        <Download size={18} color={colors.accent} />
                                    </Pressable>
                                    <Pressable onPress={() => handleDelete(doc)} hitSlop={12}>
                                        <Trash2 size={18} color="#EF4444" />
                                    </Pressable>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Upload Options Modal */}
            <Modal visible={showUploadOptions} transparent animationType="fade" onRequestClose={() => setShowUploadOptions(false)}>
                <View style={styles.overlay}>
                    <View style={[styles.optionsSheet, { backgroundColor: colors.background }]}>
                        <Text style={[styles.headerTitle, { color: colors.text, marginBottom: 16 }]}>Dokument kategorisieren</Text>

                        <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 6 }}>Kategorie:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                            {DOC_CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                                <Pressable
                                    key={cat.key}
                                    style={[styles.catChip, {
                                        backgroundColor: uploadCategory === cat.key ? colors.accent + '20' : colors.card,
                                        borderColor: uploadCategory === cat.key ? colors.accent : colors.border,
                                    }]}
                                    onPress={() => setUploadCategory(cat.key)}
                                >
                                    <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                                    <Text style={{ fontSize: 11, color: uploadCategory === cat.key ? colors.accent : colors.text }}>{cat.label}</Text>
                                </Pressable>
                            ))}
                        </View>

                        <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 6 }}>Beschreibung (optional):</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            value={uploadDescription}
                            onChangeText={setUploadDescription}
                            placeholder="z.B. Krankenversicherung 2025"
                            placeholderTextColor={colors.subtext}
                        />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                            <Pressable style={[styles.btnSecondary, { borderColor: colors.border }]} onPress={() => setShowUploadOptions(false)}>
                                <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                            </Pressable>
                            <Pressable style={[styles.btnPrimary, { backgroundColor: colors.accent }]} onPress={confirmUpload}>
                                <Upload size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Hochladen</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: '800' },

    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
    searchInput: { flex: 1, fontSize: 15 },

    catRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    catLabel: { fontSize: 12, fontWeight: '600' },

    uploadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },

    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 },

    docCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    docName: { fontSize: 15, fontWeight: '700' },
    docMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    catBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    optionsSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },

    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    btnSecondary: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
    btnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
});

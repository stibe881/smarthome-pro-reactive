import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput,
    ActivityIndicator, Alert, Modal, Platform, Dimensions, Linking,
} from 'react-native';
import {
    X, Plus, Search, Trash2, Download, Upload, ArrowLeft,
    MoreHorizontal, Home, FolderPlus, File, Image as ImageIcon,
    Camera, List, ArrowUpDown, MessageCircle,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
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

const FOLDERS = [
    { key: 'private', label: 'Privat', emoji: '🔒', bgColor: '#4ABA5A', folderColor: '#3DA34D' },
    { key: 'education', label: 'Bildung', emoji: '🎓', bgColor: '#E8B84A', folderColor: '#D4A63E' },
    { key: 'household', label: 'Haushalt', emoji: '🏠', bgColor: '#E89A6A', folderColor: '#D4894E' },
    { key: 'family', label: 'Familie', emoji: '❤️', bgColor: '#6A8AE8', folderColor: '#5A7AD4' },
];

interface FamilyDocumentsProps {
    visible: boolean;
    onClose: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const FOLDER_COLS = 3;
const FOLDER_GAP = 16;
const FOLDER_SIZE = (SCREEN_WIDTH - 40 - FOLDER_GAP * (FOLDER_COLS - 1)) / FOLDER_COLS;

export function FamilyDocuments({ visible, onClose }: FamilyDocumentsProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [documents, setDocuments] = useState<FamilyDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [activeFolder, setActiveFolder] = useState<string | null>(null);
    const [showUploadSheet, setShowUploadSheet] = useState(false);
    const [showOptionsSheet, setShowOptionsSheet] = useState(false);
    const [showCategorize, setShowCategorize] = useState(false);
    const [uploadCategory, setUploadCategory] = useState('private');
    const [uploadDescription, setUploadDescription] = useState('');
    const [sortMode, setSortMode] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'>('date_desc');
    const [viewAsList, setViewAsList] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

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

    useEffect(() => {
        if (visible) {
            loadDocuments();
            setActiveFolder(null);
        }
    }, [visible, loadDocuments]);

    const getDocCount = (folderKey: string) => documents.filter(d => d.category === folderKey).length;
    const folderDocs = activeFolder ? documents.filter(d => d.category === activeFolder).sort((a, b) => {
        switch (sortMode) {
            case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            case 'name_asc': return a.file_name.localeCompare(b.file_name);
            case 'name_desc': return b.file_name.localeCompare(a.file_name);
            default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
    }) : [];

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

    // Upload file document
    const handlePickDocument = async () => {
        setShowUploadSheet(false);
        setShowOptionsSheet(false);
        if (!householdId) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;
            const file = result.assets[0];
            (handlePickDocument as any)._pendingFile = file;
            setUploadCategory(activeFolder || 'private');
            setUploadDescription('');
            setShowCategorize(true);
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    // Upload from camera roll
    const handlePickImage = async () => {
        setShowUploadSheet(false);
        setShowOptionsSheet(false);
        if (!householdId) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                quality: 0.8,
            });
            if (result.canceled || !result.assets?.length) return;
            const asset = result.assets[0];
            const fileName = asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;
            (handlePickDocument as any)._pendingFile = {
                uri: asset.uri,
                name: fileName,
                size: asset.fileSize || 0,
                mimeType: asset.mimeType || 'image/jpeg',
            };
            setUploadCategory(activeFolder || 'private');
            setUploadDescription('');
            setShowCategorize(true);
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    // Take photo/video
    const handleTakePhoto = async () => {
        setShowUploadSheet(false);
        setShowOptionsSheet(false);
        if (!householdId) return;
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Berechtigung', 'Kamerazugriff wird benötigt.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                quality: 0.8,
            });
            if (result.canceled || !result.assets?.length) return;
            const asset = result.assets[0];
            const fileName = `photo_${Date.now()}.jpg`;
            (handlePickDocument as any)._pendingFile = {
                uri: asset.uri,
                name: fileName,
                size: asset.fileSize || 0,
                mimeType: asset.mimeType || 'image/jpeg',
            };
            setUploadCategory(activeFolder || 'private');
            setUploadDescription('');
            setShowCategorize(true);
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    // Create folder
    const handleCreateFolder = () => {
        setShowUploadSheet(false);
        setShowOptionsSheet(false);
        setNewFolderName('');
        setShowCreateFolder(true);
    };

    const confirmCreateFolder = () => {
        const name = newFolderName.trim();
        if (!name) {
            Alert.alert('Fehler', 'Bitte gib einen Ordnernamen ein.');
            return;
        }
        // Use the folder name as category key - jump into it
        setShowCreateFolder(false);
        setActiveFolder(name.toLowerCase().replace(/\s+/g, '_'));
        Alert.alert('Ordner erstellt', `Der Ordner "${name}" wurde erstellt.`);
    };

    const getSortLabel = () => {
        switch (sortMode) {
            case 'date_desc': return 'Datum (neueste)';
            case 'date_asc': return 'Datum (älteste)';
            case 'name_asc': return 'Name (A-Z)';
            case 'name_desc': return 'Name (Z-A)';
        }
    };

    const cycleSortMode = () => {
        const modes: typeof sortMode[] = ['date_desc', 'date_asc', 'name_asc', 'name_desc'];
        const idx = modes.indexOf(sortMode);
        setSortMode(modes[(idx + 1) % modes.length]);
    };

    const handleFeedback = () => {
        setShowOptionsSheet(false);
        Linking.openURL('mailto:info@gross-ict.ch?subject=Feedback%20HomePilot%20Dokumenten-Safe');
    };

    const confirmUpload = async () => {
        const file = (handlePickDocument as any)._pendingFile;
        if (!file || !householdId) return;
        setIsUploading(true);
        setShowCategorize(false);
        try {
            const fileExt = file.name.split('.').pop() || 'bin';
            const filePath = `${householdId}/${Date.now()}.${fileExt}`;
            const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
            const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const { error: uploadError } = await supabase.storage
                .from('family-documents')
                .upload(filePath, binaryData, {
                    contentType: file.mimeType || 'application/octet-stream',
                });
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('family-documents').getPublicUrl(filePath);
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
                    const pathParts = doc.file_url.split('/family-documents/');
                    if (pathParts[1]) {
                        await supabase.storage.from('family-documents').remove([pathParts[1]]);
                    }
                    await supabase.from('family_documents').delete().eq('id', doc.id);
                    loadDocuments();
                }
            },
        ]);
    };

    if (!visible) return null;

    const activeFolderInfo = FOLDERS.find(f => f.key === activeFolder);

    // --- Upload Bottom Sheet ---
    const renderUploadSheet = () => (
        <Modal visible={showUploadSheet} transparent animationType="slide" onRequestClose={() => setShowUploadSheet(false)}>
            <Pressable style={styles.overlay} onPress={() => setShowUploadSheet(false)}>
                <View style={[styles.bottomSheet, { backgroundColor: colors.background }]}>
                    <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                    <Text style={[styles.sheetTitle, { color: colors.text, borderBottomColor: colors.border }]}>Hochladen</Text>

                    <Pressable style={styles.sheetRow} onPress={handleCreateFolder}>
                        <FolderPlus size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Einen Ordner erstellen</Text>
                    </Pressable>

                    <Pressable style={styles.sheetRow} onPress={handlePickDocument}>
                        <File size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Datei</Text>
                    </Pressable>

                    <Pressable style={styles.sheetRow} onPress={handlePickImage}>
                        <ImageIcon size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Aus Kamerarolle</Text>
                    </Pressable>

                    <Pressable style={styles.sheetRow} onPress={handleTakePhoto}>
                        <Camera size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Foto oder Video aufnehmen</Text>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );

    // --- Options Bottom Sheet ---
    const renderOptionsSheet = () => (
        <Modal visible={showOptionsSheet} transparent animationType="slide" onRequestClose={() => setShowOptionsSheet(false)}>
            <Pressable style={styles.overlay} onPress={() => setShowOptionsSheet(false)}>
                <View style={[styles.bottomSheet, { backgroundColor: colors.background }]}>
                    <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                    <Text style={[styles.sheetTitle, { color: colors.text, borderBottomColor: colors.border }]}>Optionen</Text>

                    <Pressable style={styles.sheetRow} onPress={() => { setShowOptionsSheet(false); setShowUploadSheet(true); }}>
                        <Upload size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Hochladen</Text>
                    </Pressable>

                    <Pressable style={styles.sheetRow} onPress={handleCreateFolder}>
                        <FolderPlus size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Einen Ordner erstellen</Text>
                    </Pressable>

                    <Pressable style={styles.sheetRow} onPress={() => { setViewAsList(!viewAsList); setShowOptionsSheet(false); }}>
                        <List size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Ansicht: {viewAsList ? 'Raster' : 'Liste'}</Text>
                    </Pressable>

                    <Pressable style={styles.sheetRow} onPress={() => { cycleSortMode(); setShowOptionsSheet(false); }}>
                        <ArrowUpDown size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Sortieren: {getSortLabel()}</Text>
                    </Pressable>

                    <Pressable style={styles.sheetRow} onPress={handleFeedback}>
                        <MessageCircle size={20} color={colors.subtext} />
                        <Text style={[styles.sheetRowLabel, { color: colors.text }]}>Feedback geben</Text>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );

    // --- Folder Grid View ---
    const renderFolderGrid = () => (
        <>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={onClose}>
                    <Home size={22} color={colors.accent} />
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable hitSlop={12} onPress={() => setShowOptionsSheet(true)}>
                    <MoreHorizontal size={22} color={colors.accent} />
                </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.gridScrollContent}>
                <Text style={[styles.pageTitle, { color: colors.text }]}>Dokumente</Text>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {isLoading ? (
                    <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
                ) : (
                    <View style={styles.folderGrid}>
                        {FOLDERS.map(folder => {
                            const count = getDocCount(folder.key);
                            return (
                                <View key={folder.key} style={styles.folderCell}>
                                    <Pressable
                                        style={styles.folderPressable}
                                        onPress={() => setActiveFolder(folder.key)}
                                    >
                                        {/* Folder icon */}
                                        <View style={styles.folderIconWrap}>
                                            {/* Folder tab */}
                                            <View style={[styles.folderTab, { backgroundColor: folder.folderColor }]} />
                                            {/* Folder body */}
                                            <View style={[styles.folderBody, { backgroundColor: folder.bgColor }]}>
                                                <Text style={styles.folderEmoji}>{folder.emoji}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.folderLabel, { color: colors.text }]}>{folder.label}</Text>
                                        <Text style={[styles.folderCount, { color: colors.subtext }]}>
                                            👥 {count === 0 ? 'Leer' : `${count} ${count === 1 ? 'Datei' : 'Dateien'}`}
                                        </Text>
                                        <Pressable style={styles.folderMenu} hitSlop={12} onPress={() => setShowOptionsSheet(true)}>
                                            <MoreHorizontal size={16} color={colors.subtext} />
                                        </Pressable>
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* FAB */}
            <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={() => setShowUploadSheet(true)}>
                <Plus size={24} color="#fff" />
            </Pressable>
        </>
    );

    // --- Document List View (inside folder) ---
    const renderDocList = () => (
        <>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setActiveFolder(null)}>
                    <ArrowLeft size={22} color={colors.accent} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{activeFolderInfo?.label}</Text>
                <Pressable onPress={() => setShowOptionsSheet(true)}>
                    <MoreHorizontal size={20} color={colors.accent} />
                </Pressable>
            </View>

            {isUploading && (
                <View style={[styles.uploadingBar, { backgroundColor: colors.accent + '10' }]}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Wird hochgeladen...</Text>
                </View>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                {folderDocs.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={{ fontSize: 48 }}>{activeFolderInfo?.emoji}</Text>
                        <Text style={[styles.emptyText, { color: colors.subtext }]}>
                            Noch keine Dokumente.{'\n'}Lade dein erstes Dokument hoch!
                        </Text>
                    </View>
                ) : (
                    folderDocs.map(doc => (
                        <View key={doc.id} style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={{ fontSize: 28 }}>{getFileIcon(doc.file_type)}</Text>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.docName, { color: colors.text }]} numberOfLines={1}>{doc.file_name}</Text>
                                {doc.description ? (
                                    <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{doc.description}</Text>
                                ) : null}
                                <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 4 }}>{formatFileSize(doc.file_size)}</Text>
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

            {/* FAB */}
            <Pressable style={[styles.fab, { backgroundColor: colors.accent }]} onPress={() => setShowUploadSheet(true)}>
                <Plus size={24} color="#fff" />
            </Pressable>
        </>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {activeFolder ? renderDocList() : renderFolderGrid()}
            </View>

            {/* Upload Sheet */}
            {renderUploadSheet()}

            {/* Options Sheet */}
            {renderOptionsSheet()}

            {/* Create Folder Modal */}
            <Modal visible={showCreateFolder} transparent animationType="fade" onRequestClose={() => setShowCreateFolder(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowCreateFolder(false)}>
                    <View style={[styles.categorizeSheet, { backgroundColor: colors.background }]}>
                        <Text style={[styles.categorizeTitle, { color: colors.text }]}>Neuer Ordner</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            placeholder="Ordnername"
                            placeholderTextColor={colors.subtext}
                            autoFocus
                            maxLength={50}
                        />
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                            <Pressable
                                style={[styles.btnSecondary, { borderColor: colors.border }]}
                                onPress={() => setShowCreateFolder(false)}
                            >
                                <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.btnPrimary, { backgroundColor: colors.accent }]}
                                onPress={confirmCreateFolder}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Erstellen</Text>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* Categorize File Modal */}
            <Modal visible={showCategorize} transparent animationType="fade" onRequestClose={() => setShowCategorize(false)}>
                <View style={styles.overlay}>
                    <View style={[styles.categorizeSheet, { backgroundColor: colors.background }]}>
                        <Text style={[styles.categorizeTitle, { color: colors.text }]}>Dokument kategorisieren</Text>

                        <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 6 }}>Ordner:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                            {FOLDERS.map(folder => (
                                <Pressable
                                    key={folder.key}
                                    style={[styles.catChip, {
                                        backgroundColor: uploadCategory === folder.key ? folder.bgColor + '30' : colors.card,
                                        borderColor: uploadCategory === folder.key ? folder.bgColor : colors.border,
                                    }]}
                                    onPress={() => setUploadCategory(folder.key)}
                                >
                                    <Text style={{ fontSize: 14 }}>{folder.emoji}</Text>
                                    <Text style={{ fontSize: 11, color: uploadCategory === folder.key ? folder.bgColor : colors.text, fontWeight: '600' }}>
                                        {folder.label}
                                    </Text>
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
                            <Pressable style={[styles.btnSecondary, { borderColor: colors.border }]} onPress={() => setShowCategorize(false)}>
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

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },

    // Folder grid
    gridScrollContent: { padding: 20, paddingBottom: 100 },
    pageTitle: { fontSize: 28, fontWeight: '900', marginBottom: 12 },
    divider: { height: 1, marginBottom: 20 },

    folderGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        gap: FOLDER_GAP,
    },
    folderCell: {
        width: FOLDER_SIZE,
        alignItems: 'center',
        marginBottom: 8,
    },
    folderPressable: {
        alignItems: 'center',
        width: '100%',
    },
    folderIconWrap: {
        width: FOLDER_SIZE * 0.8,
        height: FOLDER_SIZE * 0.7,
        marginBottom: 8,
    },
    folderTab: {
        width: '40%',
        height: 12,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
    },
    folderBody: {
        flex: 1,
        borderRadius: 8,
        borderTopLeftRadius: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    folderEmoji: { fontSize: 28 },
    folderLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    folderCount: { fontSize: 11 },
    folderMenu: { marginTop: 4 },

    // FAB
    fab: {
        position: 'absolute', bottom: 30, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 6,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8,
    },

    // Bottom sheets
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    bottomSheet: {
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 20, paddingBottom: 40,
    },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
    sheetTitle: {
        fontSize: 16, fontWeight: '800', textAlign: 'center',
        paddingBottom: 16, borderBottomWidth: 1, marginBottom: 8,
    },
    sheetRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 16,
    },
    sheetRowLabel: { fontSize: 16, fontWeight: '500' },

    // Document list
    uploadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 },
    docCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    docName: { fontSize: 15, fontWeight: '700' },

    // Categorize modal
    categorizeSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    categorizeTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    input: { borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 15 },
    btnSecondary: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
    btnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
});

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Image, useWindowDimensions, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import { X, Video, Maximize2, Settings, Pencil, Trash2, Plus, Check } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useHousehold } from '../hooks/useHousehold';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';

interface CamerasModalProps {
    visible: boolean;
    onClose: () => void;
}

interface CameraConfig {
    id: string;
    entity_id: string;
    custom_name: string | null;
    sort_order: number;
}

export default function CamerasModal({ visible, onClose }: CamerasModalProps) {
    const { entities, getEntityPictureUrl, authToken, haBaseUrl } = useHomeAssistant();
    const { userRole } = useAuth();
    const { householdId } = useHousehold();
    const [fullscreenCamera, setFullscreenCamera] = useState<any>(null);
    const [cameraConfigs, setCameraConfigs] = useState<CameraConfig[]>([]);
    const { width, height } = useWindowDimensions();
    const isTablet = width > 600;
    const [showManage, setShowManage] = useState(false);
    const [editingCamera, setEditingCamera] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // Load camera configs from Supabase
    useEffect(() => {
        if (visible && householdId) {
            loadCameraConfigs();
        }
    }, [visible, householdId]);

    const loadCameraConfigs = async () => {
        if (!householdId) return;
        try {
            const { data } = await supabase
                .from('household_cameras')
                .select('*')
                .eq('household_id', householdId)
                .order('sort_order', { ascending: true });
            if (data) setCameraConfigs(data);
        } catch (e) {
            console.warn('Failed to load camera configs:', e);
        }
    };

    // Filter Cameras: use configured cameras if available, fallback to auto-discovery
    const cameras = useMemo(() => {
        if (cameraConfigs.length > 0) {
            return cameraConfigs
                .map(cfg => {
                    const entity = entities.find(e => e.entity_id === cfg.entity_id);
                    if (!entity) return null;
                    return {
                        ...entity,
                        _configId: cfg.id,
                        attributes: {
                            ...entity.attributes,
                            friendly_name: cfg.custom_name || entity.attributes.friendly_name
                        }
                    };
                })
                .filter(Boolean);
        }
        return entities.filter(e => {
            if (!e.entity_id.startsWith('camera.') || e.attributes.hidden) return false;
            const id = e.entity_id.toLowerCase();
            const name = (e.attributes.friendly_name || '').toLowerCase();
            return !id.includes('map') && !id.includes('robi') && !name.includes('map') && !name.includes('röbi');
        });
    }, [entities, cameraConfigs]);

    // Auto-Refresh for "Live" View (snapshots in grid)
    const [refreshTrigger, setRefreshTrigger] = React.useState(Date.now());

    React.useEffect(() => {
        if (!visible || fullscreenCamera) return; // Don't refresh grid when fullscreen is open
        const interval = setInterval(() => {
            setRefreshTrigger(Date.now());
        }, 1500);
        return () => clearInterval(interval);
    }, [visible, fullscreenCamera]);

    // Handle landscape orientation for fullscreen
    const openFullscreen = useCallback(async (cam: any) => {
        setFullscreenCamera(cam);
        try {
            await ScreenOrientation.unlockAsync();
        } catch (e) {
            console.warn('Could not unlock orientation:', e);
        }
    }, []);

    const closeFullscreen = useCallback(async () => {
        setFullscreenCamera(null);
        try {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch (e) {
            console.warn('Could not lock orientation:', e);
        }
    }, []);

    useEffect(() => {
        if (!visible && fullscreenCamera) {
            closeFullscreen();
        }
    }, [visible]);

    const getCameraUri = (cam: any) => {
        if (!cam?.attributes?.entity_picture) return null;
        return `${getEntityPictureUrl(cam.attributes.entity_picture)}${cam.attributes.entity_picture?.includes('?') ? '&' : '?'}t=${refreshTrigger}`;
    };

    const imageHeaders = {
        Authorization: `Bearer ${authToken || ''}`
    };

    // Build MJPEG stream HTML for WebView (real-time fullscreen)
    const getStreamHtml = (entityId: string) => {
        if (!haBaseUrl || !authToken) return '';
        const streamUrl = `${haBaseUrl}/api/camera_proxy_stream/${entityId}`;
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <style>
                    * { margin: 0; padding: 0; }
                    body { background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; }
                    img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
                </style>
            </head>
            <body>
                <img src="${streamUrl}" />
                <script>
                    // Inject auth header via fetch for the stream
                    var img = document.querySelector('img');
                    img.onerror = function() {
                        // Fallback: try with token in URL
                        img.src = "${streamUrl}?token=${authToken}";
                    };
                </script>
            </body>
            </html>
        `;
    };

    // All camera entities for management
    const allCameraEntities = useMemo(() => {
        return entities.filter(e => e.entity_id.startsWith('camera.'));
    }, [entities]);

    // Camera management functions
    const addCamera = async (entityId: string) => {
        if (!householdId) return;
        if (cameraConfigs.some(c => c.entity_id === entityId)) return;
        try {
            const entity = entities.find(e => e.entity_id === entityId);
            await supabase.from('household_cameras').insert({
                household_id: householdId,
                entity_id: entityId,
                custom_name: entity?.attributes?.friendly_name || null,
                sort_order: cameraConfigs.length
            });
            await loadCameraConfigs();
        } catch (e) {
            console.warn('Failed to add camera:', e);
        }
    };

    const removeCamera = async (id: string) => {
        try {
            await supabase.from('household_cameras').delete().eq('id', id);
            await loadCameraConfigs();
        } catch (e) {
            console.warn('Failed to remove camera:', e);
        }
    };

    const renameCamera = async (id: string, newName: string) => {
        try {
            await supabase.from('household_cameras')
                .update({ custom_name: newName.trim() || null })
                .eq('id', id);
            await loadCameraConfigs();
            setEditingCamera(null);
            setEditName('');
        } catch (e) {
            console.warn('Failed to rename camera:', e);
        }
    };

    const startEditing = (cfg: CameraConfig) => {
        setEditingCamera(cfg.id);
        setEditName(cfg.custom_name || '');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Kameras</Text>
                            <Text style={styles.modalSubtitle}>{cameras.length} Kameras online</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {userRole === 'admin' && (
                                <Pressable onPress={() => setShowManage(!showManage)} style={[styles.closeBtn, showManage && { backgroundColor: 'rgba(59,130,246,0.3)' }]}>
                                    <Settings size={20} color="#fff" />
                                </Pressable>
                            )}
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <X size={24} color="#fff" />
                            </Pressable>
                        </View>
                    </View>

                    {/* Admin: Camera Management */}
                    {showManage && userRole === 'admin' && (
                        <View style={styles.manageSection}>
                            <Text style={styles.manageSectionTitle}>Kameras verwalten</Text>

                            {/* Configured cameras with edit/delete */}
                            {cameraConfigs.length > 0 && (
                                <View style={{ marginTop: 8, gap: 6 }}>
                                    {cameraConfigs.map(cfg => {
                                        const entity = entities.find(e => e.entity_id === cfg.entity_id);
                                        const isEditing = editingCamera === cfg.id;
                                        return (
                                            <View key={cfg.id} style={styles.manageRow}>
                                                {isEditing ? (
                                                    <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                                        <TextInput
                                                            value={editName}
                                                            onChangeText={setEditName}
                                                            style={styles.editInput}
                                                            placeholder={entity?.attributes?.friendly_name || cfg.entity_id}
                                                            placeholderTextColor="#64748B"
                                                            autoFocus
                                                            onSubmitEditing={() => renameCamera(cfg.id, editName)}
                                                        />
                                                        <Pressable onPress={() => renameCamera(cfg.id, editName)} hitSlop={8}>
                                                            <Check size={18} color="#22C55E" />
                                                        </Pressable>
                                                        <Pressable onPress={() => { setEditingCamera(null); setEditName(''); }} hitSlop={8}>
                                                            <X size={18} color="#94A3B8" />
                                                        </Pressable>
                                                    </View>
                                                ) : (
                                                    <>
                                                        <Text style={styles.manageRowText} numberOfLines={1}>
                                                            {cfg.custom_name || entity?.attributes?.friendly_name || cfg.entity_id}
                                                        </Text>
                                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                                            <Pressable onPress={() => startEditing(cfg)} hitSlop={8}>
                                                                <Pencil size={16} color="#94A3B8" />
                                                            </Pressable>
                                                            <Pressable onPress={() => removeCamera(cfg.id)} hitSlop={8}>
                                                                <Trash2 size={16} color="#EF4444" />
                                                            </Pressable>
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Add camera from available entities */}
                            <Text style={[styles.manageSectionDesc, { marginTop: 12 }]}>Kamera hinzufügen:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                                {allCameraEntities
                                    .filter(cam => !cameraConfigs.some(c => c.entity_id === cam.entity_id))
                                    .map((cam) => (
                                        <Pressable
                                            key={cam.entity_id}
                                            onPress={() => addCamera(cam.entity_id)}
                                            style={styles.addChip}
                                        >
                                            <Plus size={12} color="#3B82F6" />
                                            <Text style={styles.addChipText} numberOfLines={1}>
                                                {cam.attributes.friendly_name || cam.entity_id}
                                            </Text>
                                        </Pressable>
                                    ))
                                }
                                {allCameraEntities.filter(cam => !cameraConfigs.some(c => c.entity_id === cam.entity_id)).length === 0 && (
                                    <Text style={styles.manageSectionDesc}>Alle Kameras wurden hinzugefügt.</Text>
                                )}
                            </ScrollView>
                        </View>
                    )}

                    <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
                        <View style={[styles.cameraGrid, isTablet && styles.cameraGridTablet]}>
                            {cameras.length > 0 ? (
                                cameras.map((cam: any) => {
                                    const uri = getCameraUri(cam);
                                    return (
                                        <Pressable
                                            key={cam.entity_id}
                                            onPress={() => openFullscreen(cam)}
                                            style={({ pressed }) => [
                                                styles.cameraCard,
                                                isTablet && { width: (width - 56) / 2 },
                                                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                                            ]}
                                        >
                                            <Text style={styles.cameraTitle} numberOfLines={1}>{cam.attributes.friendly_name}</Text>
                                            <View style={[styles.cameraPreview, isTablet && { height: 160 }]}>
                                                {uri ? (
                                                    <Image
                                                        source={{ uri, headers: imageHeaders }}
                                                        style={styles.cameraImage}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View style={styles.cameraPlaceholder}>
                                                        <Video size={32} color="#475569" />
                                                    </View>
                                                )}
                                                <View style={styles.liveBadge}>
                                                    <View style={styles.liveDot} />
                                                    <Text style={styles.liveText}>LIVE</Text>
                                                </View>
                                                <View style={styles.fullscreenHint}>
                                                    <Maximize2 size={14} color="#fff" />
                                                </View>
                                            </View>
                                        </Pressable>
                                    );
                                })
                            ) : (
                                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                                    <Video size={48} color="#334155" />
                                    <Text style={styles.emptyText}>
                                        {showManage ? 'Füge Kameras über das ⚙️ Menü hinzu.' : 'Keine Kameras verfügbar.'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>

            {/* Fullscreen Camera Modal with MJPEG Stream */}
            <Modal
                visible={!!fullscreenCamera}
                animationType="fade"
                transparent={false}
                supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
                onRequestClose={closeFullscreen}
            >
                <View style={[styles.fullscreenOverlay, { width, height }]}>
                    {fullscreenCamera && haBaseUrl && authToken ? (
                        <WebView
                            source={{
                                html: getStreamHtml(fullscreenCamera.entity_id),
                            }}
                            style={{ width, height, backgroundColor: '#000' }}
                            scrollEnabled={false}
                            bounces={false}
                            javaScriptEnabled={true}
                            originWhitelist={['*']}
                            onHttpError={() => console.warn('WebView HTTP error')}
                            injectedJavaScript={`
                                // Inject auth via fetch if needed
                                document.querySelector('img').addEventListener('error', function() {
                                    this.src = '${haBaseUrl}/api/camera_proxy_stream/${fullscreenCamera?.entity_id}?token=${authToken}';
                                });
                                true;
                            `}
                        />
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={{ color: '#64748B', marginTop: 12 }}>Lade Kamerabild...</Text>
                        </View>
                    )}

                    {/* Camera name overlay */}
                    <View style={styles.fullscreenHeader} pointerEvents="box-none">
                        <Text style={styles.fullscreenTitle}>
                            {fullscreenCamera?.attributes.friendly_name}
                        </Text>
                        <Pressable
                            onPress={closeFullscreen}
                            style={styles.fullscreenClose}
                            hitSlop={12}
                        >
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {/* Live badge */}
                    <View style={styles.fullscreenLiveBadge} pointerEvents="none">
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: '#000' },
    modalContent: { flex: 1, backgroundColor: '#020617' },
    modalHeader: {
        paddingVertical: 24,
        paddingHorizontal: 20,
        paddingTop: 60,
        backgroundColor: '#1E293B',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    modalSubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    modalBody: { flex: 1, padding: 20 },

    // Manage Section
    manageSection: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
    },
    manageSectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 },
    manageSectionDesc: { fontSize: 12, color: '#94A3B8' },
    manageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
    },
    manageRowText: { color: '#fff', fontSize: 14, flex: 1, marginRight: 12 },
    editInput: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    addChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    addChipText: { fontSize: 13, color: '#3B82F6' },

    cameraGrid: { gap: 16 },
    cameraGridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
    cameraCard: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    cameraTitle: {
        padding: 12,
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        backgroundColor: 'rgba(0,0,0,0.2)'
    },
    cameraPreview: {
        height: 200,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center'
    },
    cameraImage: { width: '100%', height: '100%' },
    cameraPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    liveBadge: {
        position: 'absolute',
        top: 10, left: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
    liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    fullscreenHint: {
        position: 'absolute',
        bottom: 10, right: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 6,
        borderRadius: 6
    },
    emptyText: { color: '#64748B', fontStyle: 'italic', textAlign: 'center', marginTop: 16 },

    // Fullscreen styles
    fullscreenOverlay: {
        flex: 1,
        backgroundColor: '#000',
    },
    fullscreenHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 54,
        paddingHorizontal: 20,
        paddingBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    fullscreenTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
    },
    fullscreenClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullscreenLiveBadge: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
});

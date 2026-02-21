import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Image, useWindowDimensions, ActivityIndicator, TextInput, Alert } from 'react-native';
import { X, Video, Maximize2, Settings, Pencil, Trash2, Plus, Check, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { supabase } from '../lib/supabase';
import { useHousehold } from '../hooks/useHousehold';
import * as ScreenOrientation from 'expo-screen-orientation';

// Double-buffered camera image: keeps current frame visible while next one loads
const BufferedCameraImage = React.memo(({ uri, headers, style, resizeMode = 'cover' as any }: {
    uri: string | null;
    headers: any;
    style: any;
    resizeMode?: 'cover' | 'contain';
}) => {
    const [displayUri, setDisplayUri] = React.useState(uri);
    const [nextUri, setNextUri] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (uri && uri !== displayUri) {
            setNextUri(uri);
        }
    }, [uri]);

    return (
        <View style={[style, { overflow: 'hidden' }]}>
            {displayUri && (
                <Image
                    source={{ uri: displayUri, headers }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={resizeMode}
                />
            )}
            {nextUri && nextUri !== displayUri && (
                <Image
                    source={{ uri: nextUri, headers }}
                    style={[StyleSheet.absoluteFill, { opacity: 0 }]}
                    resizeMode={resizeMode}
                    onLoad={() => {
                        setDisplayUri(nextUri);
                        setNextUri(null);
                    }}
                />
            )}
        </View>
    );
});

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
    const { entities, getEntityPictureUrl, authToken } = useHomeAssistant();
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
            const { data, error } = await supabase
                .from('household_cameras')
                .select('*')
                .eq('household_id', householdId)
                .order('sort_order', { ascending: true });
            if (error) {
                console.warn('Load camera configs error:', error.message);
                return;
            }
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

    // Auto-Refresh for grid view
    const [refreshTrigger, setRefreshTrigger] = React.useState(Date.now());
    React.useEffect(() => {
        if (!visible || fullscreenCamera) return;
        const interval = setInterval(() => {
            setRefreshTrigger(Date.now());
        }, 1500);
        return () => clearInterval(interval);
    }, [visible, fullscreenCamera]);

    // Faster refresh for fullscreen
    const [fullscreenRefresh, setFullscreenRefresh] = React.useState(Date.now());
    React.useEffect(() => {
        if (!fullscreenCamera) return;
        const interval = setInterval(() => {
            setFullscreenRefresh(Date.now());
        }, 750);
        return () => clearInterval(interval);
    }, [fullscreenCamera]);

    // Orientation handling
    const openFullscreen = useCallback(async (cam: any) => {
        setFullscreenCamera(cam);
        try { await ScreenOrientation.unlockAsync(); } catch (e) { }
    }, []);

    const closeFullscreen = useCallback(async () => {
        setFullscreenCamera(null);
        try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); } catch (e) { }
    }, []);

    useEffect(() => {
        if (!visible && fullscreenCamera) closeFullscreen();
    }, [visible]);

    const getCameraUri = (cam: any) => {
        if (!cam?.attributes?.entity_picture) return null;
        return `${getEntityPictureUrl(cam.attributes.entity_picture)}${cam.attributes.entity_picture?.includes('?') ? '&' : '?'}t=${refreshTrigger}`;
    };

    const getFullscreenUri = (cam: any) => {
        if (!cam?.attributes?.entity_picture) return null;
        return `${getEntityPictureUrl(cam.attributes.entity_picture)}${cam.attributes.entity_picture?.includes('?') ? '&' : '?'}t=${fullscreenRefresh}`;
    };

    const imageHeaders = { Authorization: `Bearer ${authToken || ''}` };

    // All camera entities for management
    const allCameraEntities = useMemo(() => {
        return entities.filter(e => e.entity_id.startsWith('camera.'));
    }, [entities]);

    // Available cameras (not yet configured)
    const availableCameras = useMemo(() => {
        return allCameraEntities.filter(cam => !cameraConfigs.some(c => c.entity_id === cam.entity_id));
    }, [allCameraEntities, cameraConfigs]);

    // Camera management functions
    const addCamera = async (entityId: string) => {
        if (!householdId) {
            Alert.alert('Fehler', 'Kein Haushalt gefunden.');
            return;
        }
        try {
            const entity = entities.find(e => e.entity_id === entityId);
            const { error } = await supabase.from('household_cameras').insert({
                household_id: householdId,
                entity_id: entityId,
                custom_name: entity?.attributes?.friendly_name || entityId.replace('camera.', ''),
                sort_order: cameraConfigs.length
            });
            if (error) {
                Alert.alert('Fehler', error.message);
                return;
            }
            await loadCameraConfigs();
        } catch (e: any) {
            Alert.alert('Fehler', e.message);
        }
    };

    const removeCamera = async (id: string, name: string) => {
        Alert.alert('Kamera entfernen', `"${name}" wirklich entfernen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Entfernen', style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('household_cameras').delete().eq('id', id);
                    if (error) {
                        Alert.alert('Fehler', error.message);
                        return;
                    }
                    await loadCameraConfigs();
                }
            }
        ]);
    };

    const renameCamera = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        const { error } = await supabase.from('household_cameras')
            .update({ custom_name: newName.trim() })
            .eq('id', id);
        if (error) {
            Alert.alert('Fehler', error.message);
            return;
        }
        await loadCameraConfigs();
        setEditingCamera(null);
        setEditName('');
    };

    const moveCamera = async (id: string, direction: 'up' | 'down') => {
        const idx = cameraConfigs.findIndex(c => c.id === id);
        if (idx < 0) return;
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === cameraConfigs.length - 1) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const current = cameraConfigs[idx];
        const swap = cameraConfigs[swapIdx];

        // Swap sort_order
        await supabase.from('household_cameras').update({ sort_order: swap.sort_order }).eq('id', current.id);
        await supabase.from('household_cameras').update({ sort_order: current.sort_order }).eq('id', swap.id);
        await loadCameraConfigs();
    };

    const startEditing = (cfg: CameraConfig) => {
        setEditingCamera(cfg.id);
        setEditName(cfg.custom_name || '');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Kameras</Text>
                            <Text style={styles.modalSubtitle}>{cameras.length} Kameras online</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                                onPress={() => setShowManage(!showManage)}
                                style={[styles.headerBtn, showManage && { backgroundColor: 'rgba(59,130,246,0.3)' }]}
                            >
                                <Settings size={20} color="#fff" />
                            </Pressable>
                            <Pressable onPress={onClose} style={styles.headerBtn}>
                                <X size={24} color="#fff" />
                            </Pressable>
                        </View>
                    </View>

                    {/* Management Section (all users) */}
                    {showManage && (
                        <ScrollView style={styles.manageContainer} contentContainerStyle={{ paddingBottom: 16 }}>
                            <Text style={styles.manageSectionTitle}>Kameras verwalten</Text>

                            {/* Configured cameras list */}
                            {cameraConfigs.length > 0 ? (
                                <View style={{ gap: 8, marginTop: 8 }}>
                                    {cameraConfigs.map((cfg, idx) => {
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
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.manageRowName} numberOfLines={1}>
                                                                {cfg.custom_name || entity?.attributes?.friendly_name || cfg.entity_id}
                                                            </Text>
                                                            <Text style={styles.manageRowEntity} numberOfLines={1}>
                                                                {cfg.entity_id}
                                                            </Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <Pressable onPress={() => moveCamera(cfg.id, 'up')} hitSlop={6} disabled={idx === 0}>
                                                                <ChevronUp size={18} color={idx === 0 ? '#334155' : '#94A3B8'} />
                                                            </Pressable>
                                                            <Pressable onPress={() => moveCamera(cfg.id, 'down')} hitSlop={6} disabled={idx === cameraConfigs.length - 1}>
                                                                <ChevronDown size={18} color={idx === cameraConfigs.length - 1 ? '#334155' : '#94A3B8'} />
                                                            </Pressable>
                                                            <Pressable onPress={() => startEditing(cfg)} hitSlop={6}>
                                                                <Pencil size={16} color="#3B82F6" />
                                                            </Pressable>
                                                            <Pressable onPress={() => removeCamera(cfg.id, cfg.custom_name || cfg.entity_id)} hitSlop={6}>
                                                                <Trash2 size={16} color="#EF4444" />
                                                            </Pressable>
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text style={styles.manageHint}>Noch keine Kameras konfiguriert. Füge unten eine hinzu.</Text>
                            )}

                            {/* Add camera */}
                            {availableCameras.length > 0 && (
                                <View style={{ marginTop: 16 }}>
                                    <Text style={styles.manageSectionSubtitle}>Kamera hinzufügen</Text>
                                    <View style={{ gap: 6, marginTop: 8 }}>
                                        {availableCameras.map(cam => (
                                            <Pressable
                                                key={cam.entity_id}
                                                onPress={() => addCamera(cam.entity_id)}
                                                style={styles.addRow}
                                            >
                                                <Plus size={16} color="#3B82F6" />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.addRowName} numberOfLines={1}>
                                                        {cam.attributes.friendly_name || cam.entity_id}
                                                    </Text>
                                                    <Text style={styles.addRowEntity} numberOfLines={1}>{cam.entity_id}</Text>
                                                </View>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            )}
                            {availableCameras.length === 0 && cameraConfigs.length > 0 && (
                                <Text style={[styles.manageHint, { marginTop: 12 }]}>Alle verfügbaren Kameras wurden hinzugefügt.</Text>
                            )}
                        </ScrollView>
                    )}

                    {/* Camera Grid */}
                    {!showManage && (
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
                                                        <BufferedCameraImage
                                                            uri={uri}
                                                            headers={imageHeaders}
                                                            style={{ width: '100%', height: '100%' }}
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
                                        <Text style={styles.emptyText}>Keine Kameras verfügbar. Tippe auf ⚙️ um Kameras hinzuzufügen.</Text>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Fullscreen Camera */}
            <Modal
                visible={!!fullscreenCamera}
                animationType="fade"
                transparent={false}
                supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
                onRequestClose={closeFullscreen}
            >
                <View style={[styles.fullscreenOverlay, { width, height }]}>
                    {fullscreenCamera && (() => {
                        const fsUri = getFullscreenUri(fullscreenCamera);
                        return fsUri ? (
                            <BufferedCameraImage
                                uri={fsUri}
                                headers={imageHeaders}
                                style={{ width, height }}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <Text style={{ color: '#64748B', marginTop: 12 }}>Lade Kamerabild...</Text>
                            </View>
                        );
                    })()}

                    <View style={styles.fullscreenHeader} pointerEvents="box-none">
                        <Text style={styles.fullscreenTitle}>
                            {fullscreenCamera?.attributes.friendly_name}
                        </Text>
                        <Pressable onPress={closeFullscreen} style={styles.fullscreenClose} hitSlop={12}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

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
        paddingVertical: 24, paddingHorizontal: 20, paddingTop: 60,
        backgroundColor: '#1E293B',
        borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    modalSubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    modalBody: { flex: 1, padding: 20 },

    // Management
    manageContainer: { flex: 1, padding: 16 },
    manageSectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    manageSectionSubtitle: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
    manageHint: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginTop: 8 },
    manageRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    },
    manageRowName: { color: '#fff', fontSize: 15, fontWeight: '600' },
    manageRowEntity: { color: '#64748B', fontSize: 11, marginTop: 2 },
    editInput: {
        flex: 1, color: '#fff', fontSize: 14,
        backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#3B82F6',
    },
    addRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.08)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
        borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    addRowName: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
    addRowEntity: { color: '#64748B', fontSize: 11, marginTop: 1 },

    // Camera Grid
    cameraGrid: { gap: 16 },
    cameraGridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
    cameraCard: {
        backgroundColor: '#1E293B', borderRadius: 16, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    cameraTitle: { padding: 12, fontSize: 14, fontWeight: '600', color: '#fff', backgroundColor: 'rgba(0,0,0,0.2)' },
    cameraPreview: { height: 200, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
    cameraImage: { width: '100%', height: '100%' },
    cameraPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    liveBadge: {
        position: 'absolute', top: 10, left: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.9)', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 6
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
    liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    fullscreenHint: {
        position: 'absolute', bottom: 10, right: 10,
        backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 6
    },
    emptyText: { color: '#64748B', fontStyle: 'italic', textAlign: 'center', marginTop: 16 },

    // Fullscreen
    fullscreenOverlay: { flex: 1, backgroundColor: '#000' },
    fullscreenHeader: {
        position: 'absolute', top: 0, left: 0, right: 0,
        paddingTop: 54, paddingHorizontal: 20, paddingBottom: 16,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    fullscreenTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
    fullscreenClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    fullscreenLiveBadge: {
        position: 'absolute', bottom: 40, left: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.9)', paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6
    },
});

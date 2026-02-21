import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Image, useWindowDimensions, ActivityIndicator } from 'react-native';
import { X, Video, Maximize2, Settings } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useHousehold } from '../hooks/useHousehold';
import * as ScreenOrientation from 'expo-screen-orientation';

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
    const { userRole } = useAuth();
    const { householdId } = useHousehold();
    const [fullscreenCamera, setFullscreenCamera] = useState<any>(null);
    const [cameraConfigs, setCameraConfigs] = useState<CameraConfig[]>([]);
    const { width, height } = useWindowDimensions();

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
            // Use configured cameras
            return cameraConfigs
                .map(cfg => {
                    const entity = entities.find(e => e.entity_id === cfg.entity_id);
                    if (!entity) return null;
                    return {
                        ...entity,
                        attributes: {
                            ...entity.attributes,
                            friendly_name: cfg.custom_name || entity.attributes.friendly_name
                        }
                    };
                })
                .filter(Boolean);
        }
        // Fallback: auto-discover camera entities
        return entities.filter(e => {
            if (!e.entity_id.startsWith('camera.') || e.attributes.hidden) return false;
            const id = e.entity_id.toLowerCase();
            const name = (e.attributes.friendly_name || '').toLowerCase();
            return !id.includes('map') && !id.includes('robi') && !name.includes('map') && !name.includes('röbi');
        });
    }, [entities, cameraConfigs]);

    // Auto-Refresh for "Live" View
    const [refreshTrigger, setRefreshTrigger] = React.useState(Date.now());

    React.useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => {
            setRefreshTrigger(Date.now());
        }, 1500);
        return () => clearInterval(interval);
    }, [visible]);

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

    // Lock back to portrait when modal closes
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

    // Manage cameras state
    const [showManage, setShowManage] = useState(false);
    const allCameraEntities = useMemo(() => {
        return entities.filter(e => e.entity_id.startsWith('camera.'));
    }, [entities]);

    const addCamera = async (entityId: string) => {
        if (!householdId) return;
        const existing = cameraConfigs.find(c => c.entity_id === entityId);
        if (existing) return;
        try {
            await supabase.from('household_cameras').insert({
                household_id: householdId,
                entity_id: entityId,
                custom_name: null,
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
                                <Pressable onPress={() => setShowManage(!showManage)} style={styles.closeBtn}>
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
                            <Text style={styles.manageSectionDesc}>
                                Wähle aus, welche Kameras angezeigt werden sollen. {cameraConfigs.length === 0 ? '(Aktuell: Auto-Erkennung)' : `(${cameraConfigs.length} konfiguriert)`}
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                {allCameraEntities.map((cam) => {
                                    const isActive = cameraConfigs.some(c => c.entity_id === cam.entity_id);
                                    const config = cameraConfigs.find(c => c.entity_id === cam.entity_id);
                                    return (
                                        <Pressable
                                            key={cam.entity_id}
                                            onPress={() => isActive && config ? removeCamera(config.id) : addCamera(cam.entity_id)}
                                            style={[
                                                styles.manageChip,
                                                isActive && styles.manageChipActive
                                            ]}
                                        >
                                            <Text style={[styles.manageChipText, isActive && styles.manageChipTextActive]} numberOfLines={1}>
                                                {cam.attributes.friendly_name || cam.entity_id}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
                        <View style={styles.cameraGrid}>
                            {cameras.length > 0 ? (
                                cameras.map((cam: any) => {
                                    const uri = getCameraUri(cam);
                                    return (
                                        <Pressable
                                            key={cam.entity_id}
                                            onPress={() => openFullscreen(cam)}
                                            style={({ pressed }) => [
                                                styles.cameraCard,
                                                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                                            ]}
                                        >
                                            <Text style={styles.cameraTitle} numberOfLines={1}>{cam.attributes.friendly_name}</Text>
                                            <View style={styles.cameraPreview}>
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
                                <Text style={styles.emptyText}>
                                    {cameraConfigs.length === 0
                                        ? 'Keine Kameras gefunden.'
                                        : 'Keine der konfigurierten Kameras ist online.'}
                                </Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>

            {/* Fullscreen Camera Modal */}
            <Modal
                visible={!!fullscreenCamera}
                animationType="fade"
                transparent={false}
                supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
                onRequestClose={closeFullscreen}
            >
                <View style={[styles.fullscreenOverlay, { width, height }]}>
                    {fullscreenCamera && getCameraUri(fullscreenCamera) ? (
                        <Image
                            source={{
                                uri: getCameraUri(fullscreenCamera)!,
                                headers: imageHeaders
                            }}
                            style={{ width, height }}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={{ color: '#64748B', marginTop: 12 }}>Lade Kamerabild...</Text>
                        </View>
                    )}

                    {/* Camera name overlay */}
                    <View style={styles.fullscreenHeader}>
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
                    <View style={styles.fullscreenLiveBadge}>
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
    manageSectionTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
    manageSectionDesc: { fontSize: 12, color: '#94A3B8' },
    manageChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginRight: 8,
    },
    manageChipActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3B82F6',
    },
    manageChipText: { fontSize: 13, color: '#94A3B8' },
    manageChipTextActive: { color: '#3B82F6', fontWeight: '600' },

    cameraGrid: { gap: 16 },
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
    emptyText: { color: '#64748B', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },

    // Fullscreen styles
    fullscreenOverlay: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center'
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

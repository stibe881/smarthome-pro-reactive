import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Image, useWindowDimensions, ActivityIndicator, TextInput, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Video as VideoIcon, Maximize2, Settings, Pencil, Trash2, Plus, Check, ChevronUp, ChevronDown, Volume2, VolumeX } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
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
    const displayUriRef = React.useRef(displayUri);
    displayUriRef.current = displayUri;

    React.useEffect(() => {
        if (uri && uri !== displayUriRef.current) {
            setNextUri(uri);
            // Timeout: if image doesn't load in 2s, skip to direct display
            const timeout = setTimeout(() => {
                setDisplayUri(uri);
                setNextUri(null);
            }, 2000);
            return () => clearTimeout(timeout);
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
                    key={nextUri}
                    source={{ uri: nextUri, headers }}
                    style={[StyleSheet.absoluteFill, { opacity: 0 }]}
                    resizeMode={resizeMode}
                    onLoad={() => {
                        setDisplayUri(nextUri);
                        setNextUri(null);
                    }}
                    onError={() => {
                        // Skip this frame, keep showing current
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

interface ExtraEntity {
    entity_id: string;
    label: string;
}

interface CameraConfig {
    id: string;
    entity_id: string;
    custom_name: string | null;
    sort_order: number;
    extra_entities: ExtraEntity[];
}

export default function CamerasModal({ visible, onClose }: CamerasModalProps) {
    const { entities, getEntityPictureUrl, authToken, callService, getCameraStream } = useHomeAssistant();
    const { householdId } = useHousehold();
    const [fullscreenCamera, setFullscreenCamera] = useState<any>(null);
    const [cameraConfigs, setCameraConfigs] = useState<CameraConfig[]>([]);
    const { width, height } = useWindowDimensions();
    const isTablet = width > 600;
    const [showManage, setShowManage] = useState(false);
    const [editingCamera, setEditingCamera] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    // Audio / HLS stream
    const [isMuted, setIsMuted] = useState(true);
    const [hlsUrl, setHlsUrl] = React.useState<string | null>(null);
    const [hlsLoading, setHlsLoading] = useState(false);
    const player = useVideoPlayer(hlsUrl || '', (p) => {
        p.loop = true;
        p.muted = true;
        p.play();
    });

    // Sync mute state with player
    useEffect(() => {
        if (player) player.muted = isMuted;
    }, [isMuted, player]);
    // Extra entity editing
    const [addingExtraTo, setAddingExtraTo] = useState<string | null>(null);
    const [extraEntityInput, setExtraEntityInput] = useState('');
    const [extraLabelInput, setExtraLabelInput] = useState('');

    // Load camera configs from Supabase
    useEffect(() => {
        if (visible && householdId) loadCameraConfigs();
    }, [visible, householdId]);

    const loadCameraConfigs = async () => {
        if (!householdId) return;
        try {
            const { data, error } = await supabase
                .from('household_cameras')
                .select('*')
                .eq('household_id', householdId)
                .order('sort_order', { ascending: true });
            if (error) { console.warn('Load camera configs error:', error.message); return; }
            if (data) setCameraConfigs(data.map((d: any) => ({
                ...d,
                extra_entities: Array.isArray(d.extra_entities) ? d.extra_entities : []
            })));
        } catch (e) {
            console.warn('Failed to load camera configs:', e);
        }
    };

    // Only show explicitly configured cameras
    const cameras = useMemo(() => {
        return cameraConfigs
            .map(cfg => {
                const entity = entities.find(e => e.entity_id === cfg.entity_id);
                if (!entity) return null;
                return {
                    ...entity,
                    _configId: cfg.id,
                    _extraEntities: cfg.extra_entities || [],
                    attributes: {
                        ...entity.attributes,
                        friendly_name: cfg.custom_name || entity.attributes.friendly_name
                    }
                };
            })
            .filter(Boolean);
    }, [entities, cameraConfigs]);

    // Auto-Refresh for grid view
    const [refreshTrigger, setRefreshTrigger] = React.useState(Date.now());
    React.useEffect(() => {
        if (!visible || fullscreenCamera) return;
        const interval = setInterval(() => setRefreshTrigger(Date.now()), 1500);
        return () => clearInterval(interval);
    }, [visible, fullscreenCamera]);

    // Faster refresh for fullscreen
    const [fullscreenRefresh, setFullscreenRefresh] = React.useState(Date.now());
    React.useEffect(() => {
        if (!fullscreenCamera) return;
        const interval = setInterval(() => setFullscreenRefresh(Date.now()), 750);
        return () => clearInterval(interval);
    }, [fullscreenCamera]);

    // Orientation handling
    const openFullscreen = useCallback(async (cam: any) => {
        setFullscreenCamera(cam);
        setHlsUrl(null);
        setIsMuted(true);
        try { await ScreenOrientation.unlockAsync(); } catch (e) { }
        // Request HLS stream in background
        setHlsLoading(true);
        try {
            const url = await getCameraStream(cam.entity_id);
            if (url) setHlsUrl(url);
        } catch (e) {
            console.warn('HLS stream not available:', e);
        } finally {
            setHlsLoading(false);
        }
    }, [getCameraStream]);

    const closeFullscreen = useCallback(async () => {
        setFullscreenCamera(null);
        setHlsUrl(null);
        setIsMuted(true);
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
    const allCameraEntities = useMemo(() => entities.filter(e => e.entity_id.startsWith('camera.')), [entities]);
    const availableCameras = useMemo(() => allCameraEntities.filter(cam => !cameraConfigs.some(c => c.entity_id === cam.entity_id)), [allCameraEntities, cameraConfigs]);

    // --- Camera Management ---
    const addCamera = async (entityId: string) => {
        if (!householdId) { Alert.alert('Fehler', 'Kein Haushalt gefunden.'); return; }
        try {
            const entity = entities.find(e => e.entity_id === entityId);
            const { error } = await supabase.from('household_cameras').insert({
                household_id: householdId,
                entity_id: entityId,
                custom_name: entity?.attributes?.friendly_name || entityId.replace('camera.', ''),
                sort_order: cameraConfigs.length,
                extra_entities: []
            });
            if (error) { Alert.alert('Fehler', error.message); return; }
            await loadCameraConfigs();
        } catch (e: any) { Alert.alert('Fehler', e.message); }
    };

    const removeCamera = async (id: string, name: string) => {
        Alert.alert('Kamera entfernen', `"${name}" wirklich entfernen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Entfernen', style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('household_cameras').delete().eq('id', id);
                    if (error) { Alert.alert('Fehler', error.message); return; }
                    await loadCameraConfigs();
                }
            }
        ]);
    };

    const renameCamera = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        const { error } = await supabase.from('household_cameras').update({ custom_name: newName.trim() }).eq('id', id);
        if (error) { Alert.alert('Fehler', error.message); return; }
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
        await supabase.from('household_cameras').update({ sort_order: swap.sort_order }).eq('id', current.id);
        await supabase.from('household_cameras').update({ sort_order: current.sort_order }).eq('id', swap.id);
        await loadCameraConfigs();
    };

    // Extra entity management
    const addExtraEntity = async (cameraId: string) => {
        if (!extraEntityInput.trim()) return;
        const cfg = cameraConfigs.find(c => c.id === cameraId);
        if (!cfg) return;
        const newExtra: ExtraEntity = {
            entity_id: extraEntityInput.trim(),
            label: extraLabelInput.trim() || extraEntityInput.trim()
        };
        const updated = [...(cfg.extra_entities || []), newExtra];
        const { error } = await supabase.from('household_cameras').update({ extra_entities: updated }).eq('id', cameraId);
        if (error) { Alert.alert('Fehler', error.message); return; }
        setAddingExtraTo(null);
        setExtraEntityInput('');
        setExtraLabelInput('');
        await loadCameraConfigs();
    };

    const removeExtraEntity = async (cameraId: string, entityId: string) => {
        const cfg = cameraConfigs.find(c => c.id === cameraId);
        if (!cfg) return;
        const updated = (cfg.extra_entities || []).filter(e => e.entity_id !== entityId);
        const { error } = await supabase.from('household_cameras').update({ extra_entities: updated }).eq('id', cameraId);
        if (error) { Alert.alert('Fehler', error.message); return; }
        await loadCameraConfigs();
    };

    // Toggle extra entity (for switch/input_boolean/etc.)
    const toggleExtraEntity = (entityId: string) => {
        const entity = entities.find(e => e.entity_id === entityId);
        if (!entity) return;
        const domain = entityId.split('.')[0];
        if (domain === 'switch' || domain === 'input_boolean') {
            callService(domain, 'toggle', entityId);
        } else if (domain === 'button') {
            callService('button', 'press', entityId);
        } else {
            // Generic toggle for other domains
            callService('homeassistant', 'toggle', entityId);
        }
    };

    const getEntityState = (entityId: string) => {
        const entity = entities.find(e => e.entity_id === entityId);
        return entity?.state || 'unknown';
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Kameras</Text>
                            <Text style={styles.modalSubtitle}>{cameras.length} Kamera{cameras.length !== 1 ? 's' : ''} konfiguriert</Text>
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

                    {/* Management Section */}
                    {showManage ? (
                        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
                            <ScrollView style={styles.manageContainer} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                                <Text style={styles.manageSectionTitle}>Kameras verwalten</Text>

                                {cameraConfigs.length > 0 ? (
                                    <View style={{ gap: 10, marginTop: 12 }}>
                                        {cameraConfigs.map((cfg, idx) => {
                                            const entity = entities.find(e => e.entity_id === cfg.entity_id);
                                            const isEditing = editingCamera === cfg.id;
                                            const isAddingExtra = addingExtraTo === cfg.id;

                                            return (
                                                <View key={cfg.id} style={styles.manageCard}>
                                                    {/* Camera name & controls */}
                                                    {isEditing ? (
                                                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
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
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.manageRowName} numberOfLines={1}>
                                                                    {cfg.custom_name || entity?.attributes?.friendly_name || cfg.entity_id}
                                                                </Text>
                                                                <Text style={styles.manageRowEntity} numberOfLines={1}>{cfg.entity_id}</Text>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                <Pressable onPress={() => moveCamera(cfg.id, 'up')} hitSlop={6} disabled={idx === 0}>
                                                                    <ChevronUp size={18} color={idx === 0 ? '#334155' : '#94A3B8'} />
                                                                </Pressable>
                                                                <Pressable onPress={() => moveCamera(cfg.id, 'down')} hitSlop={6} disabled={idx === cameraConfigs.length - 1}>
                                                                    <ChevronDown size={18} color={idx === cameraConfigs.length - 1 ? '#334155' : '#94A3B8'} />
                                                                </Pressable>
                                                                <Pressable onPress={() => { setEditingCamera(cfg.id); setEditName(cfg.custom_name || ''); }} hitSlop={6}>
                                                                    <Pencil size={16} color="#3B82F6" />
                                                                </Pressable>
                                                                <Pressable onPress={() => removeCamera(cfg.id, cfg.custom_name || cfg.entity_id)} hitSlop={6}>
                                                                    <Trash2 size={16} color="#EF4444" />
                                                                </Pressable>
                                                            </View>
                                                        </View>
                                                    )}

                                                    {/* Extra entities for this camera */}
                                                    {(cfg.extra_entities || []).length > 0 && (
                                                        <View style={{ marginTop: 8, gap: 4 }}>
                                                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Zusätzliche Entitäten:</Text>
                                                            {cfg.extra_entities.map(extra => (
                                                                <View key={extra.entity_id} style={styles.extraRow}>
                                                                    <Text style={styles.extraLabel} numberOfLines={1}>{extra.label}</Text>
                                                                    <Text style={styles.extraEntityId} numberOfLines={1}>{extra.entity_id}</Text>
                                                                    <Pressable onPress={() => removeExtraEntity(cfg.id, extra.entity_id)} hitSlop={6}>
                                                                        <Trash2 size={14} color="#EF4444" />
                                                                    </Pressable>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}

                                                    {/* Add extra entity */}
                                                    {isAddingExtra ? (
                                                        <View style={{ marginTop: 8, gap: 6 }}>
                                                            <TextInput
                                                                value={extraEntityInput}
                                                                onChangeText={setExtraEntityInput}
                                                                style={styles.editInput}
                                                                placeholder="Entität suchen..."
                                                                placeholderTextColor="#64748B"
                                                                autoFocus
                                                            />
                                                            {extraEntityInput.length >= 2 && (
                                                                <View style={{ maxHeight: 200, gap: 4 }}>
                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                        {entities
                                                                            .filter(e => {
                                                                                const q = extraEntityInput.toLowerCase();
                                                                                return (e.entity_id.toLowerCase().includes(q) ||
                                                                                    (e.attributes.friendly_name || '').toLowerCase().includes(q)) &&
                                                                                    !(cfg.extra_entities || []).some((ex: ExtraEntity) => ex.entity_id === e.entity_id);
                                                                            })
                                                                            .slice(0, 15)
                                                                            .map(e => (
                                                                                <Pressable
                                                                                    key={e.entity_id}
                                                                                    onPress={() => {
                                                                                        setExtraEntityInput(e.entity_id);
                                                                                        setExtraLabelInput(e.attributes.friendly_name || e.entity_id);
                                                                                        // Auto-add
                                                                                        const newExtra: ExtraEntity = {
                                                                                            entity_id: e.entity_id,
                                                                                            label: e.attributes.friendly_name || e.entity_id
                                                                                        };
                                                                                        const updated = [...(cfg.extra_entities || []), newExtra];
                                                                                        supabase.from('household_cameras').update({ extra_entities: updated }).eq('id', cfg.id)
                                                                                            .then(() => { loadCameraConfigs(); setAddingExtraTo(null); setExtraEntityInput(''); setExtraLabelInput(''); });
                                                                                    }}
                                                                                    style={styles.searchResultRow}
                                                                                >
                                                                                    <Text style={styles.searchResultName} numberOfLines={1}>{e.attributes.friendly_name || e.entity_id}</Text>
                                                                                    <Text style={styles.searchResultEntity} numberOfLines={1}>{e.entity_id}</Text>
                                                                                </Pressable>
                                                                            ))}
                                                                    </ScrollView>
                                                                </View>
                                                            )}
                                                            <Pressable onPress={() => { setAddingExtraTo(null); setExtraEntityInput(''); setExtraLabelInput(''); }} style={styles.btnSmall}>
                                                                <Text style={{ color: '#94A3B8', fontSize: 12 }}>Abbrechen</Text>
                                                            </Pressable>
                                                        </View>
                                                    ) : (
                                                        <Pressable onPress={() => setAddingExtraTo(cfg.id)} style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Plus size={14} color="#3B82F6" />
                                                            <Text style={{ fontSize: 12, color: '#3B82F6' }}>Entität hinzufügen</Text>
                                                        </Pressable>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text style={styles.manageHint}>Noch keine Kameras konfiguriert. Füge unten eine hinzu.</Text>
                                )}

                                {/* Add camera from HA entities */}
                                {availableCameras.length > 0 && (
                                    <View style={{ marginTop: 20 }}>
                                        <Text style={styles.manageSectionSubtitle}>Kamera hinzufügen</Text>
                                        <View style={{ gap: 6, marginTop: 8 }}>
                                            {availableCameras.map(cam => (
                                                <Pressable key={cam.entity_id} onPress={() => addCamera(cam.entity_id)} style={styles.addRow}>
                                                    <Plus size={16} color="#3B82F6" />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.addRowName} numberOfLines={1}>{cam.attributes.friendly_name || cam.entity_id}</Text>
                                                        <Text style={styles.addRowEntity} numberOfLines={1}>{cam.entity_id}</Text>
                                                    </View>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </ScrollView>
                        </KeyboardAvoidingView>
                    ) : (
                        /* Camera Grid */
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
                                                            <VideoIcon size={32} color="#475569" />
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
                                        <VideoIcon size={48} color="#334155" />
                                        <Text style={styles.emptyText}>Keine Kameras konfiguriert.{'\n'}Tippe auf ⚙️ um Kameras hinzuzufügen.</Text>
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
                        // If HLS stream is available, use Video player (with audio)
                        if (hlsUrl && player) {
                            return (
                                <VideoView
                                    player={player}
                                    style={{ width, height }}
                                    contentFit="contain"
                                    nativeControls={false}
                                />
                            );
                        }
                        // Fallback: image snapshots
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

                    {/* Header overlay */}
                    <View style={styles.fullscreenHeader} pointerEvents="box-none">
                        <Text style={styles.fullscreenTitle}>{fullscreenCamera?.attributes.friendly_name}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            {/* Mute/Unmute toggle */}
                            <Pressable
                                onPress={() => setIsMuted(!isMuted)}
                                style={[styles.fullscreenClose, isMuted ? {} : { backgroundColor: 'rgba(59,130,246,0.5)' }]}
                                hitSlop={12}
                            >
                                {isMuted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
                            </Pressable>
                            <Pressable onPress={closeFullscreen} style={styles.fullscreenClose} hitSlop={12}>
                                <X size={24} color="#fff" />
                            </Pressable>
                        </View>
                    </View>

                    {/* Extra entity controls in fullscreen */}
                    {fullscreenCamera?._extraEntities?.length > 0 && (
                        <View style={styles.fullscreenControls}>
                            {fullscreenCamera._extraEntities.map((extra: ExtraEntity) => {
                                const state = getEntityState(extra.entity_id);
                                const isOn = state === 'on';
                                const domain = extra.entity_id.split('.')[0];
                                const isToggleable = ['switch', 'input_boolean', 'light'].includes(domain);
                                const isButton = domain === 'button';

                                return (
                                    <Pressable
                                        key={extra.entity_id}
                                        onPress={() => toggleExtraEntity(extra.entity_id)}
                                        style={[styles.extraControl, isOn && styles.extraControlActive]}
                                    >
                                        <Text style={[styles.extraControlLabel, isOn && { color: '#fff' }]} numberOfLines={1}>
                                            {extra.label}
                                        </Text>
                                        {isToggleable && (
                                            <View style={[styles.extraControlDot, isOn && styles.extraControlDotActive]} />
                                        )}
                                        {isButton && (
                                            <Text style={{ color: '#3B82F6', fontSize: 11 }}>▶</Text>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}

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
    manageHint: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginTop: 12 },
    manageCard: {
        backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
    },
    manageRowName: { color: '#fff', fontSize: 15, fontWeight: '600' },
    manageRowEntity: { color: '#64748B', fontSize: 11, marginTop: 2 },
    editInput: {
        flex: 1, color: '#fff', fontSize: 14,
        backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#334155',
    },
    addRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.06)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
        borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.15)',
    },
    addRowName: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
    addRowEntity: { color: '#64748B', fontSize: 11, marginTop: 1 },
    btnSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },

    // Extra entities
    extraRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6
    },
    extraLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '500', flex: 1 },
    extraEntityId: { color: '#475569', fontSize: 10 },

    // Camera Grid
    cameraGrid: { gap: 16 },
    cameraGridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
    cameraCard: {
        backgroundColor: '#1E293B', borderRadius: 16, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    cameraTitle: { padding: 12, fontSize: 14, fontWeight: '600', color: '#fff', backgroundColor: 'rgba(0,0,0,0.2)' },
    cameraPreview: { height: 200, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
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
    emptyText: { color: '#64748B', fontStyle: 'italic', textAlign: 'center', marginTop: 16, lineHeight: 22 },

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
    fullscreenControls: {
        position: 'absolute', bottom: 40, right: 20,
        flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 300
    },
    extraControl: {
        backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    extraControlActive: { backgroundColor: 'rgba(59, 130, 246, 0.4)' },
    extraControlLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
    extraControlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#475569' },
    extraControlDotActive: { backgroundColor: '#22C55E' },

    // Search results
    searchResultRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 4,
    },
    searchResultName: { color: '#E2E8F0', fontSize: 13, fontWeight: '500', flex: 1 },
    searchResultEntity: { color: '#64748B', fontSize: 10, marginLeft: 8 },
});

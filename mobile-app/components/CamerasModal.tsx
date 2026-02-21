import React, { useMemo, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Image, Dimensions } from 'react-native';
import { X, Video, Maximize2 } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';

interface CamerasModalProps {
    visible: boolean;
    onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CamerasModal({ visible, onClose }: CamerasModalProps) {
    const { entities, getEntityPictureUrl, authToken } = useHomeAssistant();
    const [fullscreenCamera, setFullscreenCamera] = useState<any>(null);

    // Filter Cameras
    const cameras = useMemo(() => {
        return entities.filter(e => {
            if (!e.entity_id.startsWith('camera.') || e.attributes.hidden) return false;
            const id = e.entity_id.toLowerCase();
            const name = (e.attributes.friendly_name || '').toLowerCase();
            return !id.includes('map') && !id.includes('robi') && !name.includes('map') && !name.includes('röbi');
        });
    }, [entities]);

    // Auto-Refresh for "Live" View
    const [refreshTrigger, setRefreshTrigger] = React.useState(Date.now());

    React.useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => {
            setRefreshTrigger(Date.now());
        }, 1500); // Refresh every 1.5 seconds for smoother experience
        return () => clearInterval(interval);
    }, [visible]);

    const getCameraUri = (cam: any) => {
        if (!cam.attributes.entity_picture) return null;
        return `${getEntityPictureUrl(cam.attributes.entity_picture)}${cam.attributes.entity_picture?.includes('?') ? '&' : '?'}t=${refreshTrigger}`;
    };

    const imageHeaders = {
        Authorization: `Bearer ${authToken || ''}`
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
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
                        <View style={styles.cameraGrid}>
                            {cameras.length > 0 ? (
                                cameras.map((cam) => {
                                    const uri = getCameraUri(cam);
                                    return (
                                        <Pressable
                                            key={cam.entity_id}
                                            onPress={() => setFullscreenCamera(cam)}
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
                                                {/* Live indicator */}
                                                <View style={styles.liveBadge}>
                                                    <View style={styles.liveDot} />
                                                    <Text style={styles.liveText}>LIVE</Text>
                                                </View>
                                                {/* Fullscreen hint */}
                                                <View style={styles.fullscreenHint}>
                                                    <Maximize2 size={14} color="#fff" />
                                                </View>
                                            </View>
                                        </Pressable>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyText}>Keine Kameras gefunden.</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>

            <Modal
                visible={!!fullscreenCamera}
                animationType="fade"
                transparent={false}
                statusBarTranslucent
                onRequestClose={() => setFullscreenCamera(null)}
            >
                <View style={styles.fullscreenOverlay}>
                    {fullscreenCamera && getCameraUri(fullscreenCamera) ? (
                        <Image
                            source={{
                                uri: getCameraUri(fullscreenCamera)!,
                                headers: imageHeaders
                            }}
                            style={styles.fullscreenImage}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Video size={48} color="#475569" />
                            <Text style={{ color: '#64748B', marginTop: 12 }}>Lade Kamerabild...</Text>
                        </View>
                    )}

                    {/* Camera name overlay */}
                    <View style={styles.fullscreenHeader}>
                        <Text style={styles.fullscreenTitle}>
                            {fullscreenCamera?.attributes.friendly_name}
                        </Text>
                        <Pressable
                            onPress={() => setFullscreenCamera(null)}
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
    fullscreenImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
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

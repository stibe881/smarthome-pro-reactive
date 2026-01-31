import React, { useMemo } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { X, Video } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';

interface CamerasModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function CamerasModal({ visible, onClose }: CamerasModalProps) {
    const { entities, getEntityPictureUrl, authToken } = useHomeAssistant();

    // Filter Cameras
    const cameras = useMemo(() => {
        return entities.filter(e => {
            if (!e.entity_id.startsWith('camera.') || e.attributes.hidden) return false;
            // Exclude Map and Röbi cameras
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
        }, 3000); // Refresh every 3 seconds
        return () => clearInterval(interval);
    }, [visible]);

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
                                cameras.map((cam) => (
                                    <View key={cam.entity_id} style={styles.cameraCard}>
                                        <Text style={styles.cameraTitle} numberOfLines={1}>{cam.attributes.friendly_name}</Text>
                                        <View style={styles.cameraPreview}>
                                            {cam.attributes.entity_picture ? (
                                                <Image
                                                    source={{
                                                        uri: `${getEntityPictureUrl(cam.attributes.entity_picture)}${cam.attributes.entity_picture?.includes('?') ? '&' : '?'}t=${refreshTrigger}`,
                                                        headers: {
                                                            Authorization: `Bearer ${authToken || ''}`
                                                        }
                                                    }}
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
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>Keine Kameras gefunden.</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
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
    emptyText: { color: '#64748B', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }
});

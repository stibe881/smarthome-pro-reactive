import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';
import { X, Activity, Clock } from 'lucide-react-native';

interface StatisticsModalProps {
    visible: boolean;
    onClose: () => void;
    entityName: string;
    history: any[];
    error?: string;
    isEmbedded?: boolean;
}

export default function StatisticsModal({ visible, onClose, entityName, history, error, isEmbedded }: StatisticsModalProps) {
    const formatTime = (ts: string | null) => {
        if (!ts) return 'Unbekannt';
        const d = new Date(ts);
        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr (' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ')';
    };

    const hasData = history && history.length > 0;

    // Filter and sort history (newest first), limit to last 20 changes
    const sortedHistory = hasData ? [...history]
        .filter(h => h.state === 'on' || h.state === 'off' || h.state === 'open' || h.state === 'closed')
        .sort((a, b) => new Date(b.last_changed).getTime() - new Date(a.last_changed).getTime())
        .slice(0, 20) : [];

    const content = (
        <View style={styles.modalOverlay}>
            <Pressable style={styles.overlayTouch} onPress={onClose} />
            
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.modalTitle}>Statistik</Text>
                        <Text style={styles.modalSubtitle} numberOfLines={1}>{entityName}</Text>
                    </View>
                    <Pressable onPress={onClose} style={styles.closeBtn}>
                        <X size={24} color="#FFF" />
                    </Pressable>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    {sortedHistory.length > 0 ? (
                        <View style={styles.timelineContainer}>
                            <Text style={styles.sectionTitle}>Letzte Aktivitäten (24h)</Text>
                            {sortedHistory.map((item, index) => {
                                const isOn = item.state === 'on' || item.state === 'open';
                                const isLast = index === sortedHistory.length - 1;
                                
                                return (
                                    <View key={index} style={styles.timelineRow}>
                                        <View style={styles.timelineLineContainer}>
                                            <View style={[styles.timelineDot, { backgroundColor: isOn ? '#3B82F6' : '#64748B' }]} />
                                            {!isLast && <View style={styles.timelineLine} />}
                                        </View>
                                        <View style={styles.timelineContent}>
                                            <Text style={styles.timelineTime}>{formatTime(item.last_changed)}</Text>
                                            <Text style={[styles.timelineState, { color: isOn ? '#60A5FA' : '#94A3B8' }]}>
                                                {isOn ? 'Eingeschaltet / Geöffnet' : 'Ausgeschaltet / Geschlossen'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Activity size={48} color={error ? "#EF4444" : "#475569"} style={{ marginBottom: 16 }} />
                            <Text style={styles.emptyText}>{error ? 'Fehler beim Laden' : 'Keine Daten gefunden'}</Text>
                            <Text style={styles.emptySubtext}>
                                {error ? error : 'Für dieses Gerät wurden in den letzten 24 Stunden keine Statusänderungen aufgezeichnet.'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </View>
    );

    if (isEmbedded) {
        return (
            <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}>
                {content}
            </View>
        );
    }

    return (
        <Modal visible={visible} animationType="fade" transparent>
            {content}
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    overlayTouch: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#0F172A',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 4,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
    },
    modalBody: {
        padding: 24,
    },
    statsContainer: {
        paddingBottom: 8,
    },
    statCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        padding: 16,
        borderRadius: 16,
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    statTextContainer: {
        flex: 1,
    },
    statLabel: {
        fontSize: 13,
        color: '#94A3B8',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F8FAFC',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
    },
    timelineContainer: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 16,
    },
    timelineRow: {
        flexDirection: 'row',
        marginBottom: 0,
    },
    timelineLineContainer: {
        width: 30,
        alignItems: 'center',
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        zIndex: 1,
        marginTop: 4,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: '#1E293B',
        marginTop: -6,
        marginBottom: -4,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 24,
        paddingLeft: 8,
    },
    timelineTime: {
        fontSize: 14,
        color: '#F8FAFC',
        fontWeight: '600',
    },
    timelineState: {
        fontSize: 13,
        marginTop: 2,
    }
});

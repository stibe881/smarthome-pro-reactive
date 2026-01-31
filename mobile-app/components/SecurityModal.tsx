import React, { useMemo, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { X, Lock, Unlock, Shield, ShieldAlert, ShieldCheck, Home, LogOut } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { filterSecurityEntities } from '../utils/securityHelpers';

interface SecurityModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function SecurityModal({ visible, onClose }: SecurityModalProps) {
    const { entities, callService } = useHomeAssistant();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    // Find Alarm Entity
    const alarmEntity = useMemo(() => {
        return entities.find(e => e.entity_id.startsWith('alarm_control_panel.')) || null;
    }, [entities]);

    // Filter Doors and Windows
    const doors = useMemo(() => {
        return filterSecurityEntities(entities).sort((a, b) => {
            if (a.state === 'on' && b.state !== 'on') return -1;
            if (a.state !== 'on' && b.state === 'on') return 1;
            return (a.attributes.friendly_name || '').localeCompare(b.attributes.friendly_name || '');
        });
    }, [entities]);

    const activeCount = doors.filter(d => d.state === 'on').length;

    const handleKeypadPress = (key: string) => {
        if (key === 'C') {
            setCode('');
        } else if (key === '<') {
            setCode(prev => prev.slice(0, -1));
        } else {
            if (code.length < 6) setCode(prev => prev + key);
        }
    };

    const handleAlarmAction = async (action: 'alarm_arm_home' | 'alarm_arm_away' | 'alarm_disarm') => {
        if (!alarmEntity) return;
        setLoading(true);
        try {
            await callService('alarm_control_panel', action, alarmEntity.entity_id, { code });
            setCode('');
        } catch (error) {
            Alert.alert('Fehler', 'Aktion konnte nicht ausgeführt werden.');
        } finally {
            setLoading(false);
        }
    };

    const getAlarmStatusConfig = (state: string) => {
        switch (state) {
            case 'armed_home': return { label: 'Scharf (Zuhause)', color: '#3B82F6', icon: Home };
            case 'armed_away': return { label: 'Scharf (Abwesend)', color: '#EF4444', icon: ShieldCheck };
            case 'disarmed': return { label: 'Unscharf', color: '#10B981', icon: Unlock };
            case 'triggered': return { label: 'ALARM!', color: '#EF4444', icon: ShieldAlert };
            case 'arming': return { label: 'Aktivierung...', color: '#F59E0B', icon: Shield };
            case 'pending': return { label: 'Verzögerung...', color: '#F59E0B', icon: Shield };
            default: return { label: state || 'Unbekannt', color: '#64748B', icon: Shield };
        }
    };

    const statusConfig = getAlarmStatusConfig(alarmEntity?.state || 'disarmed');
    const StatusIcon = statusConfig.icon;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={[styles.modalHeader, { backgroundColor: statusConfig.color + '20' }]}>
                        <View>
                            <Text style={styles.modalTitle}>Alarmanlage</Text>
                            <Text style={[styles.modalSubtitle, { color: statusConfig.color, fontWeight: 'bold' }]}>
                                {statusConfig.label.toUpperCase()}
                            </Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>

                        {/* Status Hero */}
                        <View style={styles.statusHero}>
                            <View style={[styles.heroIcon, { backgroundColor: statusConfig.color + '20' }]}>
                                <StatusIcon size={48} color={statusConfig.color} />
                            </View>
                            {loading && <ActivityIndicator size="small" color="#fff" style={{ marginTop: 10 }} />}
                        </View>

                        {/* Controls */}
                        {alarmEntity ? (
                            <View style={styles.controlsSection}>
                                {/* Code Display */}
                                <View style={styles.codeDisplay}>
                                    <Text style={styles.codeText}>
                                        {code.split('').map(() => '•').join(' ') || 'Code eingeben'}
                                    </Text>
                                </View>

                                {/* Keypad */}
                                <View style={styles.keypad}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '<'].map((key) => (
                                        <Pressable
                                            key={key}
                                            style={({ pressed }) => [styles.key, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                                            onPress={() => handleKeypadPress(key.toString())}
                                        >
                                            <Text style={styles.keyText}>{key}</Text>
                                        </Pressable>
                                    ))}
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.actionButtons}>
                                    <Pressable
                                        style={[styles.actionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}
                                        onPress={() => handleAlarmAction('alarm_disarm')}
                                    >
                                        <Unlock size={24} color="#10B981" />
                                        <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Unscharf</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.actionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}
                                        onPress={() => handleAlarmAction('alarm_arm_home')}
                                    >
                                        <Home size={24} color="#3B82F6" />
                                        <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Zuhause</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
                                        onPress={() => handleAlarmAction('alarm_arm_away')}
                                    >
                                        <Shield size={24} color="#EF4444" />
                                        <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Abwesend</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.noAlarm}>
                                <Text style={styles.noAlarmText}>Keine Alarmanlage gefunden (alarm_control_panel.*)</Text>
                            </View>
                        )}

                        {/* Doors & Windows Section */}
                        <Text style={styles.sectionTitle}>Sensoren ({doors.length})</Text>
                        <View style={styles.listContainer}>
                            {doors.length > 0 ? (
                                doors.map((door) => {
                                    const isOpen = door.state === 'on';
                                    return (
                                        <View key={door.entity_id} style={styles.row}>
                                            <View style={styles.rowIcon}>
                                                {isOpen ? <Unlock size={24} color="#EF4444" /> : <Lock size={24} color="#10B981" />}
                                            </View>
                                            <View style={styles.rowContent}>
                                                <Text style={styles.rowTitle}>{door.attributes.friendly_name || door.entity_id}</Text>
                                                <Text style={[styles.rowSubtitle, isOpen ? { color: '#EF4444' } : { color: '#94A3B8' }]}>
                                                    {isOpen ? 'Geöffnet' : 'Geschlossen'}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyText}>Keine Sensoren gefunden.</Text>
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

    statusHero: { alignItems: 'center', marginBottom: 32 },
    heroIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },

    controlsSection: { marginBottom: 32 },
    codeDisplay: {
        backgroundColor: '#1E293B',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    codeText: { fontSize: 24, color: '#fff', letterSpacing: 8, fontWeight: 'bold' },

    keypad: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 24
    },
    key: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    keyText: { fontSize: 24, color: '#fff', fontWeight: '500' },

    actionButtons: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8 },
    actionBtnText: { fontSize: 12, fontWeight: 'bold' },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
    listContainer: { gap: 12 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: 16
    },
    rowIcon: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center', justifyContent: 'center'
    },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
    rowSubtitle: { fontSize: 13, marginTop: 2 },
    emptyText: { color: '#64748B', fontStyle: 'italic', textAlign: 'center' },
    noAlarm: { padding: 20, alignItems: 'center' },
    noAlarmText: { color: '#EF4444' }
});

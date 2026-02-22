import React, { useMemo, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { X, Lock, Unlock, Shield, ShieldAlert, ShieldCheck, Home, LogOut, DoorOpen, DoorClosed, Eye } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';
import { filterSecurityEntities } from '../utils/securityHelpers';

interface SecurityModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function SecurityModal({ visible, onClose }: SecurityModalProps) {
    const { entities, callService, dashboardConfig } = useHomeAssistant();
    const { colors } = useTheme();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    // Find Alarm Entity (from config or auto-detect)
    const alarmEntity = useMemo(() => {
        if (dashboardConfig?.alarm) {
            return entities.find(e => e.entity_id === dashboardConfig.alarm) || null;
        }
        return entities.find(e => e.entity_id.startsWith('alarm_control_panel.')) || null;
    }, [entities, dashboardConfig?.alarm]);

    // Use configured sensors or fall back to auto-detect
    const sensors = useMemo(() => {
        const configuredIds = (dashboardConfig?.alarmSensors || []) as string[];
        if (configuredIds.length > 0) {
            return configuredIds
                .map(id => entities.find(e => e.entity_id === id))
                .filter(Boolean) as typeof entities;
        }
        // Fallback: auto-detect
        return filterSecurityEntities(entities);
    }, [entities, dashboardConfig?.alarmSensors]);

    // Sort: open first, then alphabetical
    const sortedSensors = useMemo(() => {
        return [...sensors].sort((a, b) => {
            if (a.state === 'on' && b.state !== 'on') return -1;
            if (a.state !== 'on' && b.state === 'on') return 1;
            return (a.attributes.friendly_name || '').localeCompare(b.attributes.friendly_name || '');
        });
    }, [sensors]);

    const openCount = sensors.filter(s => s.state === 'on').length;
    const closedCount = sensors.length - openCount;

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
            case 'armed_home': return { label: 'Scharf (Zuhause)', color: '#3B82F6', icon: Home, bg: 'rgba(59,130,246,0.12)' };
            case 'armed_away': return { label: 'Scharf (Abwesend)', color: '#EF4444', icon: ShieldCheck, bg: 'rgba(239,68,68,0.12)' };
            case 'disarmed': return { label: 'Unscharf', color: '#10B981', icon: Unlock, bg: 'rgba(16,185,129,0.12)' };
            case 'triggered': return { label: 'ALARM!', color: '#EF4444', icon: ShieldAlert, bg: 'rgba(239,68,68,0.2)' };
            case 'arming': return { label: 'Aktivierung...', color: '#F59E0B', icon: Shield, bg: 'rgba(245,158,11,0.12)' };
            case 'pending': return { label: 'Verzögerung...', color: '#F59E0B', icon: Shield, bg: 'rgba(245,158,11,0.12)' };
            default: return { label: state || 'Unbekannt', color: '#64748B', icon: Shield, bg: 'rgba(100,116,139,0.12)' };
        }
    };

    const statusConfig = getAlarmStatusConfig(alarmEntity?.state || 'disarmed');
    const StatusIcon = statusConfig.icon;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Compact Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Alarmanlage</Text>
                    </View>
                    <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.card }]}>
                        <X size={20} color={colors.subtext} />
                    </Pressable>
                </View>

                <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>

                    {/* Status Card */}
                    <View style={[styles.statusCard, { backgroundColor: statusConfig.bg, borderColor: statusConfig.color + '30' }]}>
                        <View style={[styles.statusIcon, { backgroundColor: statusConfig.color + '20' }]}>
                            <StatusIcon size={28} color={statusConfig.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusLabel, { color: colors.subtext }]}>Aktueller Status</Text>
                            <Text style={[styles.statusValue, { color: statusConfig.color }]}>
                                {statusConfig.label}
                            </Text>
                        </View>
                        {loading && <ActivityIndicator size="small" color={statusConfig.color} />}
                    </View>

                    {/* Sensor Summary Badges */}
                    {sensors.length > 0 && (
                        <View style={styles.badgeRow}>
                            <View style={[styles.badge, { backgroundColor: openCount > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.08)' }]}>
                                <DoorOpen size={16} color={openCount > 0 ? '#EF4444' : '#10B981'} />
                                <Text style={[styles.badgeText, { color: openCount > 0 ? '#EF4444' : '#10B981' }]}>
                                    {openCount} offen
                                </Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.08)' }]}>
                                <DoorClosed size={16} color="#10B981" />
                                <Text style={[styles.badgeText, { color: '#10B981' }]}>
                                    {closedCount} geschlossen
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Keypad & Controls */}
                    {alarmEntity ? (
                        <View style={styles.controlsSection}>
                            {/* Code Display */}
                            <View style={[styles.codeDisplay, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[styles.codeText, { color: colors.text }]}>
                                    {code.split('').map(() => '•').join(' ') || 'Code eingeben'}
                                </Text>
                            </View>

                            {/* Compact Keypad */}
                            <View style={styles.keypad}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '<'].map((key) => (
                                    <Pressable
                                        key={key}
                                        style={({ pressed }) => [
                                            styles.key,
                                            { backgroundColor: pressed ? (colors.accent + '20') : colors.card, borderColor: colors.border }
                                        ]}
                                        onPress={() => handleKeypadPress(key.toString())}
                                    >
                                        <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.actionButtons}>
                                <Pressable
                                    style={[styles.actionBtn, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }]}
                                    onPress={() => handleAlarmAction('alarm_disarm')}
                                >
                                    <Unlock size={22} color="#10B981" />
                                    <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Unscharf</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.actionBtn, { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.25)' }]}
                                    onPress={() => handleAlarmAction('alarm_arm_home')}
                                >
                                    <Home size={22} color="#3B82F6" />
                                    <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Zuhause</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}
                                    onPress={() => handleAlarmAction('alarm_arm_away')}
                                >
                                    <Shield size={22} color="#EF4444" />
                                    <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Abwesend</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <View style={[styles.noAlarm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Shield size={32} color={colors.subtext} strokeWidth={1.5} />
                            <Text style={[styles.noAlarmText, { color: colors.subtext }]}>
                                Keine Alarmanlage konfiguriert
                            </Text>
                            <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                                Gehe zu Einstellungen → Dashboard anpassen → Alarmanlage
                            </Text>
                        </View>
                    )}

                    {/* Sensor List */}
                    {sensors.length > 0 && (
                        <View style={styles.sensorSection}>
                            <View style={styles.sensorHeader}>
                                <Eye size={16} color={colors.subtext} />
                                <Text style={[styles.sensorTitle, { color: colors.text }]}>
                                    Sensoren ({sensors.length})
                                </Text>
                            </View>
                            <View style={{ gap: 6 }}>
                                {sortedSensors.map((sensor) => {
                                    const isOpen = sensor.state === 'on';
                                    return (
                                        <View
                                            key={sensor.entity_id}
                                            style={[
                                                styles.sensorRow,
                                                {
                                                    backgroundColor: isOpen ? 'rgba(239,68,68,0.08)' : colors.card,
                                                    borderColor: isOpen ? 'rgba(239,68,68,0.2)' : colors.border,
                                                }
                                            ]}
                                        >
                                            <View style={[
                                                styles.sensorDot,
                                                { backgroundColor: isOpen ? '#EF4444' : '#10B981' }
                                            ]} />
                                            <Text
                                                style={[styles.sensorName, { color: isOpen ? '#EF4444' : colors.text }]}
                                                numberOfLines={1}
                                            >
                                                {sensor.attributes.friendly_name || sensor.entity_id}
                                            </Text>
                                            <Text style={[
                                                styles.sensorState,
                                                { color: isOpen ? '#EF4444' : '#10B981' }
                                            ]}>
                                                {isOpen ? 'Offen' : 'Zu'}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: 16,
        paddingBottom: 12,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold' },
    closeBtn: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    body: { flex: 1, padding: 20 },

    // Status Card
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 14,
        marginBottom: 16,
    },
    statusIcon: {
        width: 52, height: 52, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    statusLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
    statusValue: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },

    // Badge Row
    badgeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        flex: 1,
        justifyContent: 'center',
    },
    badgeText: { fontSize: 13, fontWeight: '600' },

    // Controls
    controlsSection: { marginBottom: 24 },
    codeDisplay: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
    },
    codeText: { fontSize: 22, letterSpacing: 8, fontWeight: 'bold' },

    keypad: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 20,
    },
    key: {
        width: 64,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    keyText: { fontSize: 22, fontWeight: '500' },

    actionButtons: { flexDirection: 'row', gap: 10 },
    actionBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 6,
        borderWidth: 1,
    },
    actionBtnText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },

    // No Alarm
    noAlarm: {
        padding: 24,
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        gap: 8,
        marginBottom: 24,
    },
    noAlarmText: { fontSize: 15, fontWeight: '600' },

    // Sensor Section
    sensorSection: { marginTop: 8 },
    sensorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sensorTitle: { fontSize: 16, fontWeight: '700' },
    sensorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
    },
    sensorDot: {
        width: 8, height: 8, borderRadius: 4,
    },
    sensorName: { flex: 1, fontSize: 14, fontWeight: '500' },
    sensorState: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});

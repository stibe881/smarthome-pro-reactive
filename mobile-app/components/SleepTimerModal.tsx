import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { X, Moon, Square } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useSleepTimer } from '../hooks/useSleepTimer';

const DURATIONS = [15, 30, 45, 60, 90];

interface SleepTimerModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function SleepTimerModal({ visible, onClose }: SleepTimerModalProps) {
    const { colors } = useTheme();
    const { isRunning, remaining, activeDuration, startTimer, stopTimer } = useSleepTimer();

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.card }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={[styles.iconWrap, { backgroundColor: '#8B5CF6' + '20' }]}>
                                <Moon size={22} color="#8B5CF6" />
                            </View>
                            <Text style={[styles.title, { color: colors.text }]}>Sleep Timer</Text>
                        </View>
                        <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
                            <X size={22} color={colors.subtext} />
                        </Pressable>
                    </View>

                    {isRunning ? (
                        /* Active Timer */
                        <View style={styles.activeSection}>
                            <View style={[styles.countdownCircle, { borderColor: '#8B5CF6' }]}>
                                <Text style={[styles.countdownNumber, { color: colors.text }]}>
                                    {remaining ?? 0}
                                </Text>
                                <Text style={[styles.countdownLabel, { color: colors.subtext }]}>Min</Text>
                            </View>
                            <Text style={[styles.activeInfo, { color: colors.subtext }]}>
                                von {activeDuration} Minuten verbleibend
                            </Text>
                            <Pressable
                                onPress={stopTimer}
                                style={[styles.stopBtn, { backgroundColor: '#EF4444' + '15', borderColor: '#EF4444' + '40' }]}
                            >
                                <Square size={18} color="#EF4444" />
                                <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '600' }}>Timer stoppen</Text>
                            </Pressable>
                        </View>
                    ) : (
                        /* Duration Picker */
                        <View style={styles.pickerSection}>
                            <Text style={[styles.subtitle, { color: colors.subtext }]}>
                                TV automatisch ausschalten nach:
                            </Text>
                            <View style={styles.durationsRow}>
                                {DURATIONS.map(min => (
                                    <Pressable
                                        key={min}
                                        onPress={() => startTimer(min)}
                                        style={({ pressed }) => [
                                            styles.durationBtn,
                                            {
                                                backgroundColor: pressed ? '#8B5CF6' + '30' : '#8B5CF6' + '12',
                                                borderColor: '#8B5CF6' + '40',
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.durationNumber, { color: '#8B5CF6' }]}>
                                            {min}
                                        </Text>
                                        <Text style={[styles.durationUnit, { color: colors.subtext }]}>
                                            Min
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 24,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
    },
    // Active timer
    activeSection: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    countdownCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    countdownNumber: {
        fontSize: 42,
        fontWeight: '800',
    },
    countdownLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: -4,
    },
    activeInfo: {
        fontSize: 14,
        marginBottom: 20,
    },
    stopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 14,
        borderWidth: 1,
    },
    // Picker
    pickerSection: {
        alignItems: 'center',
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    durationsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
    },
    durationBtn: {
        width: 72,
        height: 72,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    durationNumber: {
        fontSize: 22,
        fontWeight: '700',
    },
    durationUnit: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
});

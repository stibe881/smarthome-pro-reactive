import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Blinds, X, Star, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { EntityState } from '../contexts/HomeAssistantContext';

interface ShutterControlModalProps {
    visible: boolean;
    cover: EntityState | null;
    onClose: () => void;
    setCoverPosition: (entityId: string, position: number) => void;
    setCoverTiltPosition: (entityId: string, tilt: number) => void;
    stopCover: (entityId: string) => void;
    pressButton: (entityId: string) => void;
}

export default function ShutterControlModal({
    visible,
    cover,
    onClose,
    setCoverPosition,
    setCoverTiltPosition,
    stopCover,
    pressButton,
}: ShutterControlModalProps) {
    const { colors } = useTheme();

    const [position, setPosition] = useState(cover?.attributes?.current_position ?? 0);
    const [tilt, setTilt] = useState(cover?.attributes?.current_tilt_position ?? 0);

    // Sync local state when cover changes
    useEffect(() => {
        if (cover) {
            setPosition(cover.attributes?.current_position ?? 0);
            setTilt(cover.attributes?.current_tilt_position ?? 0);
        }
    }, [cover]);

    const handlePositionChange = useCallback((value: number) => {
        setPosition(value);
    }, []);

    const handlePositionCommit = useCallback((value: number) => {
        if (cover) {
            setCoverPosition(cover.entity_id, Math.round(value));
        }
    }, [cover, setCoverPosition]);

    const handleTiltChange = useCallback((value: number) => {
        setTilt(value);
    }, []);

    const handleTiltCommit = useCallback((value: number) => {
        if (cover) {
            setCoverTiltPosition(cover.entity_id, Math.round(value));
        }
    }, [cover, setCoverTiltPosition]);

    const handleStop = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (cover) {
            stopCover(cover.entity_id);
        }
    }, [cover, stopCover]);

    const handleMyPosition = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (cover?.myPositionEntity) {
            pressButton(cover.myPositionEntity);
        }
    }, [cover, pressButton]);

    // Don't render anything if not visible or no cover
    if (!visible || !cover) return null;

    return (
        <Modal visible={true} animationType="slide" transparent statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={[styles.content, { backgroundColor: colors.card }]}>
                    {/* Header */}
                    <View style={[styles.header, { backgroundColor: colors.accent }]}>
                        <View style={styles.headerLeft}>
                            <Blinds size={24} color="#fff" />
                            <Text style={styles.headerTitle}>{cover.attributes?.friendly_name || cover.entity_id}</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {/* Body */}
                    <View style={styles.body}>
                        {/* Position Slider */}
                        <View style={styles.sliderSection}>
                            <Text style={[styles.sliderLabel, { color: colors.text }]}>Position: {Math.round(position)}%</Text>
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={100}
                                value={position}
                                onValueChange={handlePositionChange}
                                onSlidingComplete={handlePositionCommit}
                                minimumTrackTintColor={colors.accent}
                                maximumTrackTintColor={colors.border}
                                thumbTintColor={colors.accent}
                            />
                        </View>

                        {/* Tilt Slider */}
                        <View style={styles.sliderSection}>
                            <Text style={[styles.sliderLabel, { color: colors.text }]}>Neigung: {Math.round(tilt)}%</Text>
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={100}
                                value={tilt}
                                onValueChange={handleTiltChange}
                                onSlidingComplete={handleTiltCommit}
                                minimumTrackTintColor={colors.tint}
                                maximumTrackTintColor={colors.border}
                                thumbTintColor={colors.tint}
                            />
                        </View>

                        {/* Actions */}
                        <View style={styles.actions}>
                            {/* Stop Button */}
                            <Pressable onPress={handleStop} style={[styles.actionBtn, { backgroundColor: colors.error }]}>
                                <Square size={24} color="#fff" fill="#fff" />
                                <Text style={styles.actionBtnText}>Stop</Text>
                            </Pressable>

                            {/* My Position Button (only if mapped) */}
                            {cover.myPositionEntity && (
                                <Pressable onPress={handleMyPosition} style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}>
                                    <Star size={24} color="#fff" fill="#fff" />
                                    <Text style={styles.actionBtnText}>My Position</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    content: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingTop: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        padding: 20,
        paddingBottom: 40,
    },
    sliderSection: {
        marginBottom: 24,
    },
    sliderLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
});

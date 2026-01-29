import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { X, Sun, Moon, Palette, RotateCcw } from 'lucide-react-native';
import Slider from '@react-native-community/slider';

interface LightControlModalProps {
    visible: boolean;
    onClose: () => void;
    light: any; // The entity object
    callService: (domain: string, service: string, entityId: string, data?: any) => void;
}

const COLOR_PRESETS = [
    { name: 'Warm White', color: '#FDB813', type: 'temp', value: 3000, mireds: 333 }, // Warm
    { name: 'Cool White', color: '#F4F4F5', type: 'temp', value: 6000, mireds: 166 }, // Cool
    { name: 'Red', color: '#EF4444', type: 'rgb', value: [255, 0, 0] },
    { name: 'Orange', color: '#F97316', type: 'rgb', value: [255, 165, 0] },
    { name: 'Amber', color: '#F59E0B', type: 'rgb', value: [255, 191, 0] },
    { name: 'Green', color: '#22C55E', type: 'rgb', value: [0, 255, 0] },
    { name: 'Cyan', color: '#06B6D4', type: 'rgb', value: [0, 255, 255] },
    { name: 'Blue', color: '#3B82F6', type: 'rgb', value: [0, 0, 255] },
    { name: 'Purple', color: '#8B5CF6', type: 'rgb', value: [128, 0, 128] },
    { name: 'Pink', color: '#EC4899', type: 'rgb', value: [255, 192, 203] },
];

export default function LightControlModal({ visible, onClose, light, callService }: LightControlModalProps) {
    const [brightness, setBrightness] = useState(light?.attributes?.brightness || 0);
    const [isOn, setIsOn] = useState(light?.state === 'on');

    // Supported Features (Relaxed check as requested - assume most lights support dimming/color if they are in this list)
    const supportsTemp = true;
    const supportsColor = true;

    // Sync state when modal opens or light changes
    useEffect(() => {
        if (light) {
            setIsOn(light.state === 'on');
            setBrightness(light.attributes?.brightness || 0);
        }
    }, [light]);

    // Early return AFTER hooks
    if (!light) return null;

    const handleToggle = (value: boolean) => {
        setIsOn(value);
        callService('light', value ? 'turn_on' : 'turn_off', light.entity_id);
    };

    const handleBrightnessChange = (val: number) => {
        setBrightness(val); // Local update for responsiveness
    };

    const handleBrightnessComplete = (val: number) => {
        if (val === 0) {
            handleToggle(false);
        } else {
            if (!isOn) setIsOn(true);
            callService('light', 'turn_on', light.entity_id, { brightness: Math.round(val) });
        }
    };

    const applyColor = (preset: any) => {
        if (!isOn) setIsOn(true);

        const data: any = {};
        if (preset.type === 'rgb') {
            data.rgb_color = preset.value;
        } else if (preset.type === 'temp') {
            if (preset.mireds) data.color_temp = preset.mireds;
            else data.kelvin = preset.value;
        }

        callService('light', 'turn_on', light.entity_id, data);
    };

    const handleTempChange = (val: number) => {
        // Val is 153 (6500K) to 500 (2000K) usually in mireds
        // Let's assume slider gives mireds directly
        callService('light', 'turn_on', light.entity_id, { color_temp: Math.round(val) });
    };

    // Range for Mireds: 153 (Cold) - 500 (Warm)
    // Default to these if not provided by attributes
    const minMireds = light.attributes.min_mireds || 153;
    const maxMireds = light.attributes.max_mireds || 500;
    const currentMireds = light.attributes.color_temp || 370;

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
                <Pressable style={styles.overlayTouch} onPress={onClose} />

                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.modalTitle}>{light.attributes.friendly_name}</Text>
                            <Text style={styles.modalSubtitle}>{isOn ? `${Math.round(brightness / 255 * 100)}% Helligkeit` : 'Ausgeschaltet'}</Text>
                        </View>
                        <Switch
                            value={isOn}
                            onValueChange={handleToggle}
                            trackColor={{ false: '#334155', true: '#3B82F6' }}
                            thumbColor={'#FFF'}
                        />
                    </View>

                    <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 24 }}>

                        {/* Brightness Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Helligkeit</Text>
                            <View style={styles.sliderRow}>
                                <Moon size={20} color="#64748B" />
                                <Slider
                                    style={{ flex: 1, height: 40 }}
                                    value={brightness}
                                    minimumValue={0}
                                    maximumValue={255}
                                    onValueChange={handleBrightnessChange}
                                    onSlidingComplete={handleBrightnessComplete}
                                    minimumTrackTintColor="#FBBF24"
                                    maximumTrackTintColor="rgba(255,255,255,0.1)"
                                    thumbTintColor="#FFF"
                                />
                                <Sun size={20} color="#FBBF24" />
                            </View>
                        </View>

                        {/* Color Temp Section (If supported or assumed) */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Farbtemperatur</Text>
                            <View style={styles.sliderRow}>
                                <Text style={{ fontSize: 12, color: '#60A5FA' }}>Kalt</Text>
                                <Slider
                                    style={{ flex: 1, height: 40 }}
                                    value={currentMireds}
                                    minimumValue={minMireds}
                                    maximumValue={maxMireds}
                                    onSlidingComplete={handleTempChange}
                                    inverted={true} // Inverted because lower mireds = higher kelvin (colder)
                                    minimumTrackTintColor="#60A5FA" // Cold color
                                    maximumTrackTintColor="#F59E0B" // Warm color
                                    thumbTintColor="#FFF"
                                />
                                <Text style={{ fontSize: 12, color: '#F59E0B' }}>Warm</Text>
                            </View>
                        </View>

                        {/* Colors Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Farben & Presets</Text>
                            <View style={styles.presetGrid}>
                                {COLOR_PRESETS.map((preset) => (
                                    <Pressable
                                        key={preset.name}
                                        onPress={() => applyColor(preset)}
                                        style={styles.presetBtn}
                                    >
                                        <View style={[styles.colorCircle, { backgroundColor: preset.color }]} />
                                        <Text style={styles.presetName}>{preset.name}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                    </ScrollView>

                    {/* Close Button */}
                    <Pressable onPress={onClose} style={styles.closeBtn}>
                        <Text style={styles.closeBtnText}>Schliessen</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    overlayTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    modalContent: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '85%',
        width: '100%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
    modalSubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
    scrollBody: {},
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
    sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

    presetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    presetBtn: {
        width: '20%',
        alignItems: 'center',
        gap: 8,
        minWidth: 60
    },
    colorCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    presetName: {
        color: '#94A3B8',
        fontSize: 11,
        textAlign: 'center'
    },
    closeBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8
    },
    closeBtnText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16
    }
});

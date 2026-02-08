import React, { useMemo } from 'react';
import { View, Text, Modal, StyleSheet, Pressable } from 'react-native';
import { LucideIcon, Info } from 'lucide-react-native';

export interface QuickActionInfo {
    title: string;
    description: string;
    icon: LucideIcon;
    iconColor: string;
    gradient: [string, string];
}

interface QuickActionInfoModalProps {
    visible: boolean;
    onClose: () => void;
    info: QuickActionInfo | null;
}

export default function QuickActionInfoModal({ visible, onClose, info }: QuickActionInfoModalProps) {
    if (!visible || !info) return null;

    const Icon = info.icon;

    // Auto-Close after 5 seconds
    React.useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [visible, onClose]);

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Blur Effect Background */}
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                </Pressable>

                <View style={[styles.card, { borderColor: info.gradient[0] }]}>
                    {/* Header Gradient */}
                    <View style={[styles.header, { backgroundColor: info.gradient[0] }]}>
                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                            <Icon size={32} color="#fff" />
                        </View>
                    </View>

                    <View style={styles.content}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                            <Info size={16} color="#94A3B8" />
                            <Text style={styles.label}>Aktions-Info</Text>
                        </View>

                        <Text style={styles.title}>{info.title}</Text>
                        <Text style={styles.message}>{info.description}</Text>

                        <Pressable
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.button,
                                { backgroundColor: info.gradient[0], opacity: pressed ? 0.9 : 1 }
                            ]}
                        >
                            <Text style={styles.buttonText}>Verstanden</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#1E293B',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    header: {
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: '#CBD5E1',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});

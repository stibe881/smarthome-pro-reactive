import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { Bell, Key, DoorOpen, Home } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export const DoorbellModal = () => {
    const { isDoorbellRinging, setIsDoorbellRinging, callService } = useHomeAssistant();
    const [currentTime, setCurrentTime] = useState('');

    useEffect(() => {
        if (isDoorbellRinging) {
            const updateTime = () => {
                const now = new Date();
                setCurrentTime(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            };
            updateTime();
            const timer = setInterval(updateTime, 1000);
            return () => clearInterval(timer);
        }
    }, [isDoorbellRinging]);

    const handleClose = () => {
        setIsDoorbellRinging(false);
    };

    const handleAction = async (action: () => void) => {
        action();
        // Don't auto-close immediately? Or should we?
        // Let's keep it open for a moment or let user close it manually?
        // User might want to open multiple doors.
    };

    if (!isDoorbellRinging) return null;

    return (
        <Modal
            visible={isDoorbellRinging}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                {/* Blur Background */}
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.alertContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Bell size={24} color="#FFF" style={{ marginRight: 10 }} />
                        <Text style={styles.headerTitle}>Jemand klingelt!</Text>
                        <Pressable onPress={handleClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </Pressable>
                    </View>

                    {/* Red Alert Card */}
                    <View style={styles.redCard}>
                        <Text style={styles.redCardTitle}>Es klingelt an der Haustür!</Text>
                        <Text style={styles.redCardTime}>{currentTime}</Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsRow}>

                        {/* 1. Beide Türen öffnen (Green) */}
                        <Pressable
                            style={[styles.actionButton, styles.btnGreen]}
                            onPress={() => handleAction(() => callService('script', 'turn_on', 'script.turen_aufschliessen'))}
                        >
                            <Home size={32} color="#FFF" />
                            <Text style={styles.actionText}>Beide Türen öffnen</Text>
                        </Pressable>

                        {/* 2. Haustüre öffnen (Blue) */}
                        <Pressable
                            style={[styles.actionButton, styles.btnBlue]}
                            onPress={() => handleAction(() => callService('script', 'turn_on', 'script.hausture_offnen'))}
                        >
                            <DoorOpen size={32} color="#FFF" />
                            <Text style={styles.actionText}>Haustüre öffnen</Text>
                        </Pressable>

                        {/* 3. Wohnungstüre öffnen (Blue) */}
                        <Pressable
                            style={[styles.actionButton, styles.btnBlue]}
                            onPress={() => handleAction(() => callService('lock', 'unlock', 'lock.nuki_wohnungsture_lock'))}
                        >
                            <Key size={32} color="#FFF" />
                            <Text style={styles.actionText}>Wohnungstüre öffnen</Text>
                        </Pressable>

                    </View>

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertContainer: {
        width: Math.min(width - 40, 500),
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 0,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        backgroundColor: '#0F172A',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        flex: 1,
    },
    closeButton: {
        padding: 5,
    },
    closeButtonText: {
        fontSize: 20,
        color: '#94A3B8',
        fontWeight: 'bold',
    },
    redCard: {
        backgroundColor: 'rgba(237, 0, 0, 0.5)',
        borderColor: 'rgba(255, 165, 0, 0.5)',
        borderWidth: 2,
        margin: 16,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    redCardTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    redCardTime: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    actionsRow: {
        flexDirection: 'row',
        padding: 16,
        paddingTop: 0,
        gap: 12,
        justifyContent: 'space-between',
    },
    actionButton: {
        flex: 1,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        height: 120,
        borderWidth: 2,
    },
    btnGreen: {
        backgroundColor: 'rgba(0, 255, 125, 0.2)',
        borderColor: 'rgba(76, 175, 80, 0.5)',
    },
    btnBlue: {
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        borderColor: 'rgba(33, 150, 243, 0.5)',
    },
    actionText: {
        color: '#FFF',
        marginTop: 12,
        textAlign: 'center',
        fontWeight: '600',
        fontSize: 13,
    },
});

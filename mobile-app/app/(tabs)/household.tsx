import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { Home, Users, Lightbulb, Blinds, Bot, MapPin, Thermometer, Wifi } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Household {
    id: string;
    name: string;
    address?: string;
    created_at: string;
}

export default function Household() {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const { user } = useAuth();
    const { entities, isConnected } = useHomeAssistant();

    const [household, setHousehold] = useState<Household | null>(null);
    const [memberCount, setMemberCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Calculate device stats
    const lights = entities.filter(e => e.entity_id.startsWith('light.')).length;
    const covers = entities.filter(e => e.entity_id.startsWith('cover.')).length;
    const vacuums = entities.filter(e => e.entity_id.startsWith('vacuum.')).length;
    const climates = entities.filter(e => e.entity_id.startsWith('climate.')).length;

    useEffect(() => {
        loadHouseholdData();
    }, []);

    const loadHouseholdData = async () => {
        setIsLoading(true);
        try {
            const { data: householdData } = await supabase
                .from('households')
                .select('*')
                .single();

            if (householdData) {
                setHousehold(householdData);
            }

            const { count } = await supabase
                .from('family_members')
                .select('*', { count: 'exact', head: true });

            setMemberCount(count || 0);
        } catch (e) {
            console.error('Error loading household:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const StatCard = ({
        icon,
        value,
        label,
        gradient
    }: {
        icon: React.ReactNode,
        value: number,
        label: string,
        gradient: string[]
    }) => (
        <View style={[styles.statCardContainer, isTablet ? styles.flex1 : styles.width48]}>
            <LinearGradient
                colors={gradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCardGradient}
            >
                <View style={styles.statIconContainer}>
                    {icon}
                </View>
                <View>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                </View>
            </LinearGradient>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.flex1}
                contentContainerStyle={{ padding: isTablet ? 24 : 16 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Haushalt</Text>
                </View>

                {/* Household Info Card */}
                <View style={styles.infoCard}>
                    <LinearGradient
                        colors={['#3B82F6', '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.infoCardGradient}
                    >
                        <View style={styles.infoCardHeader}>
                            <View style={styles.infoIconContainer}>
                                <Home size={32} color="#fff" />
                            </View>
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.householdName}>
                                    {household?.name || 'Mein Zuhause'}
                                </Text>
                                {household?.address && (
                                    <View style={styles.addressContainer}>
                                        <MapPin size={14} color="rgba(255,255,255,0.7)" />
                                        <Text style={styles.addressText}>{household.address}</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Quick Stats */}
                        <View style={styles.quickStatsDetails}>
                            <View style={styles.quickStatItem}>
                                <View style={styles.quickStatRow}>
                                    <Users size={16} color="#fff" />
                                    <Text style={styles.quickStatValue}>{memberCount}</Text>
                                </View>
                                <Text style={styles.quickStatLabel}>Mitglieder</Text>
                            </View>
                            <View style={styles.separator} />
                            <View style={styles.quickStatItem}>
                                <View style={styles.quickStatRow}>
                                    <Wifi size={16} color={isConnected ? "#4ADE80" : "#EF4444"} />
                                    <Text style={styles.quickStatValue}>
                                        {entities.length}
                                    </Text>
                                </View>
                                <Text style={styles.quickStatLabel}>Geräte</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Device Stats */}
                <Text style={styles.sectionTitle}>
                    Geräte-Übersicht
                </Text>
                <View style={styles.statsGrid}>
                    <StatCard
                        icon={<Lightbulb size={24} color="#fff" />}
                        value={lights}
                        label="Lichter"
                        gradient={['#F59E0B', '#D97706']}
                    />
                    <StatCard
                        icon={<Blinds size={24} color="#fff" />}
                        value={covers}
                        label="Rollläden"
                        gradient={['#3B82F6', '#1D4ED8']}
                    />
                    <StatCard
                        icon={<Bot size={24} color="#fff" />}
                        value={vacuums}
                        label="Staubsauger"
                        gradient={['#10B981', '#059669']}
                    />
                    <StatCard
                        icon={<Thermometer size={24} color="#fff" />}
                        value={climates}
                        label="Klimaanlagen"
                        gradient={['#8B5CF6', '#6D28D9']}
                    />
                </View>

                {/* Actions */}
                <Text style={styles.sectionTitle}>
                    Verwaltung
                </Text>
                <View style={styles.actionsContainer}>
                    <Pressable style={styles.actionButton}>
                        <View style={[styles.actionIconContainer, styles.actionIconBlue]}>
                            <Users size={20} color="#3B82F6" />
                        </View>
                        <Text style={styles.actionText}>Mitglieder verwalten</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton}>
                        <View style={[styles.actionIconContainer, styles.actionIconPurple]}>
                            <Home size={20} color="#8B5CF6" />
                        </View>
                        <Text style={styles.actionText}>Haushalt bearbeiten</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flex1: {
        flex: 1,
    },
    header: {
        marginBottom: 24,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 30,
        fontWeight: 'bold',
    },
    infoCard: {
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 24,
    },
    infoCardGradient: {
        padding: 24,
    },
    infoCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    infoIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoTextContainer: {
        marginLeft: 16,
        flex: 1,
    },
    householdName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    addressText: {
        color: 'rgba(255, 255, 255, 0.7)',
        marginLeft: 4,
    },
    quickStatsDetails: {
        flexDirection: 'row',
        gap: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    quickStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    quickStatRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quickStatValue: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    quickStatLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
    },
    separator: {
        width: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    sectionTitle: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 12,
        letterSpacing: 2,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    statCardContainer: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    width48: {
        width: '48%',
    },
    statCardGradient: {
        padding: 16,
        aspectRatio: 1,
        justifyContent: 'space-between',
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statValue: {
        color: '#fff',
        fontSize: 30,
        fontWeight: 'bold',
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
    },
    actionsContainer: {
        gap: 8,
    },
    actionButton: {
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderColor: '#1E293B',
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconBlue: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
    },
    actionIconPurple: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    actionText: {
        color: '#fff',
        fontWeight: '500',
        marginLeft: 12,
    },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    CalendarDays, CheckSquare, ShoppingCart, MessageSquare,
    ChevronRight, Users, Clock,
} from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase } from '../../lib/supabase';
import { FamilyPlanner } from '../../components/FamilyPlanner';
import { FamilyTodos } from '../../components/FamilyTodos';
import { FamilyPinboard } from '../../components/FamilyPinboard';
import ShoppingListModal from '../../components/ShoppingListModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface ModuleStats {
    todayEvents: number;
    openTodos: number;
    recentPins: number;
}

export default function FamilyScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();

    const [activeModule, setActiveModule] = useState<'calendar' | 'todos' | 'shopping' | 'pinboard' | null>(null);
    const [stats, setStats] = useState<ModuleStats>({ todayEvents: 0, openTodos: 0, recentPins: 0 });
    const [fadeAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    // Load stats for module previews
    const loadStats = useCallback(async () => {
        if (!householdId) return;
        try {
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

            const [eventsRes, todosRes, pinsRes] = await Promise.all([
                supabase.from('planner_events')
                    .select('id', { count: 'exact', head: true })
                    .eq('household_id', householdId)
                    .gte('start_date', todayStart)
                    .lte('start_date', todayEnd),
                supabase.from('family_todos')
                    .select('id', { count: 'exact', head: true })
                    .eq('household_id', householdId)
                    .eq('completed', false),
                supabase.from('family_pins')
                    .select('id', { count: 'exact', head: true })
                    .eq('household_id', householdId),
            ]);

            setStats({
                todayEvents: eventsRes.count || 0,
                openTodos: todosRes.count || 0,
                recentPins: pinsRes.count || 0,
            });
        } catch (e) {
            console.warn('Error loading family stats:', e);
        }
    }, [householdId]);

    useEffect(() => { loadStats(); }, [loadStats]);

    // Refresh stats when a module closes
    const handleCloseModule = () => {
        setActiveModule(null);
        loadStats();
    };

    const MODULES = [
        {
            key: 'calendar' as const,
            title: 'Kalender',
            subtitle: stats.todayEvents > 0 ? `${stats.todayEvents} Termine heute` : 'Keine Termine heute',
            icon: CalendarDays,
            gradient: ['#3B82F6', '#1D4ED8'] as [string, string],
            emoji: '📅',
        },
        {
            key: 'todos' as const,
            title: 'Aufgaben',
            subtitle: stats.openTodos > 0 ? `${stats.openTodos} offen` : 'Alles erledigt ✓',
            icon: CheckSquare,
            gradient: ['#10B981', '#059669'] as [string, string],
            emoji: '✅',
        },
        {
            key: 'shopping' as const,
            title: 'Einkaufsliste',
            subtitle: 'Gemeinsam einkaufen',
            icon: ShoppingCart,
            gradient: ['#F59E0B', '#D97706'] as [string, string],
            emoji: '🛒',
        },
        {
            key: 'pinboard' as const,
            title: 'Pinnwand',
            subtitle: stats.recentPins > 0 ? `${stats.recentPins} Einträge` : 'Noch keine Beiträge',
            icon: MessageSquare,
            gradient: ['#EC4899', '#DB2777'] as [string, string],
            emoji: '📌',
        },
    ];

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Guten Morgen';
        if (h < 18) return 'Guten Tag';
        return 'Guten Abend';
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Animated.ScrollView
                style={{ opacity: fadeAnim }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.greeting, { color: colors.subtext }]}>{getGreeting()} 👋</Text>
                        <Text style={[styles.title, { color: colors.text }]}>Familienplaner</Text>
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: colors.accent + '20' }]}>
                        <Users size={22} color={colors.accent} />
                    </View>
                </View>

                {/* Quick Summary */}
                <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryNumber, { color: colors.accent }]}>{stats.todayEvents}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.subtext }]}>Termine{'\n'}heute</Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryNumber, { color: '#10B981' }]}>{stats.openTodos}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.subtext }]}>Offene{'\n'}Aufgaben</Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryNumber, { color: '#EC4899' }]}>{stats.recentPins}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.subtext }]}>Pinnwand{'\n'}Einträge</Text>
                    </View>
                </View>

                {/* Module Cards Grid */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Module</Text>
                <View style={styles.gridContainer}>
                    {MODULES.map((mod, index) => {
                        const Icon = mod.icon;
                        return (
                            <Pressable
                                key={mod.key}
                                style={({ pressed }) => [
                                    styles.moduleCard,
                                    { transform: [{ scale: pressed ? 0.96 : 1 }] }
                                ]}
                                onPress={() => setActiveModule(mod.key)}
                            >
                                <LinearGradient
                                    colors={mod.gradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.moduleGradient}
                                >
                                    <Text style={styles.moduleEmoji}>{mod.emoji}</Text>
                                    <View style={styles.moduleInfo}>
                                        <Text style={styles.moduleTitle}>{mod.title}</Text>
                                        <Text style={styles.moduleSubtitle}>{mod.subtitle}</Text>
                                    </View>
                                    <View style={styles.moduleArrow}>
                                        <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
                                    </View>
                                </LinearGradient>
                            </Pressable>
                        );
                    })}
                </View>
            </Animated.ScrollView>

            {/* Module Modals */}
            {activeModule === 'calendar' && (
                <FamilyPlanner visible={true} onClose={handleCloseModule} />
            )}
            <FamilyTodos visible={activeModule === 'todos'} onClose={handleCloseModule} />
            <ShoppingListModal visible={activeModule === 'shopping'} onClose={handleCloseModule} />
            <FamilyPinboard visible={activeModule === 'pinboard'} onClose={handleCloseModule} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    greeting: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
    title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

    // Summary card
    summaryCard: {
        flexDirection: 'row', borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 24,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNumber: { fontSize: 28, fontWeight: '800' },
    summaryLabel: { fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 14 },
    summaryDivider: { width: 1, marginVertical: 4 },

    // Section
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },

    // Grid
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

    // Module card
    moduleCard: { width: CARD_WIDTH, borderRadius: 20, overflow: 'hidden' },
    moduleGradient: { padding: 18, height: 140, justifyContent: 'space-between' },
    moduleEmoji: { fontSize: 28 },
    moduleInfo: { marginTop: 8 },
    moduleTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
    moduleSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    moduleArrow: {
        position: 'absolute', bottom: 16, right: 16,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
});

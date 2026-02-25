import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    CalendarDays, CheckSquare, ShoppingCart, MessageSquare,
    ChevronRight, Users, UtensilsCrossed, Trophy, Phone,
    Clock, Luggage, Target, LayoutList, BookOpen, MapPin, FolderLock,
} from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useHousehold } from '../../hooks/useHousehold';
import { supabase } from '../../lib/supabase';
import { FamilyPlanner } from '../../components/FamilyPlanner';
import { FamilyTodos } from '../../components/FamilyTodos';
import { FamilyPinboard } from '../../components/FamilyPinboard';
import ShoppingListModal from '../../components/ShoppingListModal';
import { MealPlanner } from '../../components/MealPlanner';
import { FamilyRewards } from '../../components/FamilyRewards';
import { FamilyContacts } from '../../components/FamilyContacts';
import { FamilyRoutines } from '../../components/FamilyRoutines';
import { FamilyPackingLists } from '../../components/FamilyPackingLists';
import { FamilyCountdowns } from '../../components/FamilyCountdowns';
import { WeeklyOverview } from '../../components/WeeklyOverview';
import { FamilyRecipes } from '../../components/FamilyRecipes';
import { FamilyLocations } from '../../components/FamilyLocations';
import { FamilyDocuments } from '../../components/FamilyDocuments';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

type ModuleKey = 'calendar' | 'todos' | 'shopping' | 'pinboard' | 'meals' | 'rewards' | 'contacts' | 'routines' | 'packing' | 'countdowns' | 'weekly' | 'recipes' | 'locations' | 'documents';

interface ModuleStats {
    todayEvents: number;
    openTodos: number;
    recentPins: number;
}

export default function FamilyScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { householdId } = useHousehold();
    const { isProUser, presentPaywall, debugInfo } = useSubscription();

    const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);
    const [stats, setStats] = useState<ModuleStats>({ todayEvents: 0, openTodos: 0, recentPins: 0 });
    const [fadeAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

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

    const handleCloseModule = () => {
        setActiveModule(null);
        loadStats();
    };

    const handleModulePress = async (key: ModuleKey) => {
        // TEMPORARY DEBUG ALERT — remove after fixing
        Alert.alert(
            '🔑 Subscription Debug',
            `isProUser: ${isProUser}\n\n${debugInfo}`,
            [
                {
                    text: 'OK (weiter)', onPress: async () => {
                        if (isProUser) {
                            setActiveModule(key);
                        } else {
                            const purchased = await presentPaywall();
                            if (purchased) setActiveModule(key);
                        }
                    }
                },
            ]
        );
    };

    const MAIN_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; emoji: string }[] = [
        {
            key: 'calendar', title: 'Kalender',
            subtitle: stats.todayEvents > 0 ? `${stats.todayEvents} Termine heute` : 'Keine Termine',
            icon: CalendarDays, gradient: ['#3B82F6', '#1D4ED8'], emoji: '📅',
        },
        {
            key: 'todos', title: 'Aufgaben',
            subtitle: stats.openTodos > 0 ? `${stats.openTodos} offen` : 'Alles erledigt ✓',
            icon: CheckSquare, gradient: ['#10B981', '#059669'], emoji: '✅',
        },
        {
            key: 'shopping', title: 'Einkaufsliste',
            subtitle: 'Gemeinsam einkaufen',
            icon: ShoppingCart, gradient: ['#F59E0B', '#D97706'], emoji: '🛒',
        },
        {
            key: 'meals', title: 'Essensplaner',
            subtitle: 'Wochenplan',
            icon: UtensilsCrossed, gradient: ['#F97316', '#EA580C'], emoji: '🍽️',
        },
    ];

    const FAMILY_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; emoji: string }[] = [
        {
            key: 'pinboard', title: 'Pinnwand',
            subtitle: stats.recentPins > 0 ? `${stats.recentPins} Einträge` : 'Noch keine',
            icon: MessageSquare, gradient: ['#EC4899', '#DB2777'], emoji: '📌',
        },
        {
            key: 'rewards', title: 'Belohnungen',
            subtitle: 'Punkte sammeln',
            icon: Trophy, gradient: ['#8B5CF6', '#6D28D9'], emoji: '🏆',
        },
        {
            key: 'contacts', title: 'Kontakte',
            subtitle: 'Wichtige Nummern',
            icon: Phone, gradient: ['#06B6D4', '#0891B2'], emoji: '📍',
        },
        {
            key: 'routines', title: 'Routinen',
            subtitle: 'Tagesabläufe',
            icon: Clock, gradient: ['#14B8A6', '#0D9488'], emoji: '⏰',
        },
        {
            key: 'locations', title: 'Standort',
            subtitle: 'Familie finden',
            icon: MapPin, gradient: ['#F97316', '#EA580C'], emoji: '📍',
        },
    ];

    const UTILITY_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; emoji: string }[] = [
        {
            key: 'packing', title: 'Packlisten',
            subtitle: 'Für Ferien & Ausflüge',
            icon: Luggage, gradient: ['#A855F7', '#7C3AED'], emoji: '🧳',
        },
        {
            key: 'countdowns', title: 'Countdowns',
            subtitle: 'Tage zählen',
            icon: Target, gradient: ['#EF4444', '#DC2626'], emoji: '🎯',
        },
        {
            key: 'weekly', title: 'Wochenübersicht',
            subtitle: 'Alles auf einen Blick',
            icon: LayoutList, gradient: ['#6366F1', '#4F46E5'], emoji: '📋',
        },
        {
            key: 'recipes', title: 'Rezeptbuch',
            subtitle: 'Familienrezepte',
            icon: BookOpen, gradient: ['#F59E0B', '#D97706'], emoji: '📖',
        },
        {
            key: 'documents', title: 'Dokumentsafe',
            subtitle: 'Wichtige Dokumente',
            icon: FolderLock, gradient: ['#64748B', '#475569'], emoji: '🔒',
        },
    ];

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Guten Morgen';
        if (h < 18) return 'Guten Tag';
        return 'Guten Abend';
    };

    const renderModuleCard = (mod: typeof MAIN_MODULES[0]) => {
        const Icon = mod.icon;
        return (
            <Pressable
                key={mod.key}
                style={({ pressed }) => [
                    styles.moduleCard,
                    { transform: [{ scale: pressed ? 0.96 : 1 }] }
                ]}
                onPress={() => handleModulePress(mod.key)}
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

                {/* Planung & Organisation */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Planung</Text>
                <View style={styles.gridContainer}>
                    {MAIN_MODULES.map(renderModuleCard)}
                </View>

                {/* Familie & Motivation */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>👨‍👩‍👧‍👦 Familie</Text>
                <View style={styles.gridContainer}>
                    {FAMILY_MODULES.map(renderModuleCard)}
                </View>

                {/* Tools & Extras */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>🛠️ Extras</Text>
                <View style={styles.gridContainer}>
                    {UTILITY_MODULES.map(renderModuleCard)}
                </View>
            </Animated.ScrollView>

            {/* Module Modals */}
            {activeModule === 'calendar' && <FamilyPlanner visible={true} onClose={handleCloseModule} />}
            <FamilyTodos visible={activeModule === 'todos'} onClose={handleCloseModule} />
            <ShoppingListModal visible={activeModule === 'shopping'} onClose={handleCloseModule} />
            <FamilyPinboard visible={activeModule === 'pinboard'} onClose={handleCloseModule} />
            <MealPlanner visible={activeModule === 'meals'} onClose={handleCloseModule} />
            <FamilyRewards visible={activeModule === 'rewards'} onClose={handleCloseModule} />
            <FamilyContacts visible={activeModule === 'contacts'} onClose={handleCloseModule} />
            <FamilyRoutines visible={activeModule === 'routines'} onClose={handleCloseModule} />
            <FamilyPackingLists visible={activeModule === 'packing'} onClose={handleCloseModule} />
            <FamilyCountdowns visible={activeModule === 'countdowns'} onClose={handleCloseModule} />
            <WeeklyOverview visible={activeModule === 'weekly'} onClose={handleCloseModule} onOpenModule={(key) => setActiveModule(key as ModuleKey)} />
            <FamilyRecipes visible={activeModule === 'recipes'} onClose={handleCloseModule} />
            <FamilyLocations visible={activeModule === 'locations'} onClose={handleCloseModule} />
            <FamilyDocuments visible={activeModule === 'documents'} onClose={handleCloseModule} />
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
    moduleGradient: { padding: 18, height: 130, justifyContent: 'space-between' },
    moduleEmoji: { fontSize: 28 },
    moduleInfo: { marginTop: 4 },
    moduleTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
    moduleSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    moduleArrow: {
        position: 'absolute', bottom: 14, right: 14,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
});

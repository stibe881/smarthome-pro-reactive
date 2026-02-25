import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
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
    const { isProUser, presentPaywall } = useSubscription();

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
        if (isProUser) {
            setActiveModule(key);
            return;
        }
        const purchased = await presentPaywall();
        if (purchased) {
            setActiveModule(key);
        }
    };

    // Harmonious color palette — two tonal families:
    // Cool: indigo → slate blue
    // Warm accent: muted teal (matching the theme accent range)
    const MAIN_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string }[] = [
        {
            key: 'calendar', title: 'Kalender',
            subtitle: stats.todayEvents > 0 ? `${stats.todayEvents} Termine heute` : 'Keine Termine',
            icon: CalendarDays, gradient: ['#4F46E5', '#3730A3'], iconColor: '#818CF8',
        },
        {
            key: 'todos', title: 'Aufgaben',
            subtitle: stats.openTodos > 0 ? `${stats.openTodos} offen` : 'Alles erledigt ✓',
            icon: CheckSquare, gradient: ['#3B82A0', '#2A6478'], iconColor: '#7DD3E8',
        },
        {
            key: 'shopping', title: 'Einkaufsliste',
            subtitle: 'Gemeinsam einkaufen',
            icon: ShoppingCart, gradient: ['#5B6AAD', '#444F85'], iconColor: '#A5B0E0',
        },
        {
            key: 'meals', title: 'Essensplaner',
            subtitle: 'Wochenplan',
            icon: UtensilsCrossed, gradient: ['#6B7F5E', '#4F5F46'], iconColor: '#A3BD93',
        },
    ];

    const FAMILY_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string }[] = [
        {
            key: 'pinboard', title: 'Pinnwand',
            subtitle: stats.recentPins > 0 ? `${stats.recentPins} Einträge` : 'Noch keine',
            icon: MessageSquare, gradient: ['#8B6A9F', '#664D78'], iconColor: '#C4A8D8',
        },
        {
            key: 'rewards', title: 'Belohnungen',
            subtitle: 'Punkte sammeln',
            icon: Trophy, gradient: ['#7B6B4F', '#5C503A'], iconColor: '#C4AD82',
        },
        {
            key: 'contacts', title: 'Kontakte',
            subtitle: 'Wichtige Nummern',
            icon: Phone, gradient: ['#4A7C8A', '#365B65'], iconColor: '#80BCC8',
        },
        {
            key: 'routines', title: 'Routinen',
            subtitle: 'Tagesabläufe',
            icon: Clock, gradient: ['#5A7A6E', '#425A50'], iconColor: '#8FB8A7',
        },
        {
            key: 'locations', title: 'Standort',
            subtitle: 'Familie finden',
            icon: MapPin, gradient: ['#6B6B9F', '#4E4E78'], iconColor: '#A8A8D8',
        },
    ];

    const UTILITY_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string }[] = [
        {
            key: 'packing', title: 'Packlisten',
            subtitle: 'Für Ferien & Ausflüge',
            icon: Luggage, gradient: ['#7A6A92', '#5A4D6E'], iconColor: '#B5A5CC',
        },
        {
            key: 'countdowns', title: 'Countdowns',
            subtitle: 'Tage zählen',
            icon: Target, gradient: ['#8A6A6A', '#684F4F'], iconColor: '#C8A0A0',
        },
        {
            key: 'weekly', title: 'Wochenübersicht',
            subtitle: 'Alles auf einen Blick',
            icon: LayoutList, gradient: ['#55668A', '#3E4C68'], iconColor: '#8DA0C4',
        },
        {
            key: 'recipes', title: 'Rezeptbuch',
            subtitle: 'Familienrezepte',
            icon: BookOpen, gradient: ['#6B7F5E', '#4F5F46'], iconColor: '#A3BD93',
        },
        {
            key: 'documents', title: 'Dokumentsafe',
            subtitle: 'Wichtige Dokumente',
            icon: FolderLock, gradient: ['#5A6675', '#434D5A'], iconColor: '#93A1B4',
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
                    {/* Icon badge */}
                    <View style={styles.iconBadge}>
                        <Icon size={20} color={mod.iconColor} strokeWidth={2} />
                    </View>

                    {/* Content */}
                    <View style={styles.moduleInfo}>
                        <Text style={styles.moduleTitle}>{mod.title}</Text>
                        <Text style={styles.moduleSubtitle} numberOfLines={1}>{mod.subtitle}</Text>
                    </View>

                    {/* Arrow */}
                    <View style={styles.moduleArrow}>
                        <ChevronRight size={16} color="rgba(255,255,255,0.5)" />
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
                        <Text style={[styles.title, { color: colors.text }]}>Family Hub</Text>
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: colors.accent + '18' }]}>
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
                        <Text style={[styles.summaryNumber, { color: colors.accent }]}>{stats.openTodos}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.subtext }]}>Offene{'\n'}Aufgaben</Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryNumber, { color: colors.accent }]}>{stats.recentPins}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.subtext }]}>Pinnwand{'\n'}Einträge</Text>
                    </View>
                </View>

                {/* Planung & Organisation */}
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Planung</Text>
                </View>
                <View style={styles.gridContainer}>
                    {MAIN_MODULES.map(renderModuleCard)}
                </View>

                {/* Familie & Motivation */}
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Familie</Text>
                </View>
                <View style={styles.gridContainer}>
                    {FAMILY_MODULES.map(renderModuleCard)}
                </View>

                {/* Tools & Extras */}
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Extras</Text>
                </View>
                <View style={styles.gridContainer}>
                    {UTILITY_MODULES.map(renderModuleCard)}
                </View>

                <View style={{ height: 20 }} />
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: { fontSize: 14, fontWeight: '500', marginBottom: 2, letterSpacing: 0.2 },
    title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
    avatarCircle: {
        width: 46, height: 46, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center',
    },

    // Summary card
    summaryCard: {
        flexDirection: 'row', borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 28,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNumber: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
    summaryLabel: { fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 14, fontWeight: '500' },
    summaryDivider: { width: 1, marginVertical: 4 },

    // Section
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 14,
    },
    sectionDot: {
        width: 4,
        height: 18,
        borderRadius: 2,
        marginRight: 10,
    },
    sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

    // Grid
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 12,
    },

    // Module card
    moduleCard: {
        width: CARD_WIDTH,
        borderRadius: 20,
        overflow: 'hidden',
    },
    moduleGradient: {
        padding: 16,
        height: 120,
        justifyContent: 'space-between',
    },
    iconBadge: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    moduleInfo: {},
    moduleTitle: {
        fontSize: 15, fontWeight: '700', color: '#fff',
        letterSpacing: -0.2,
    },
    moduleSubtitle: {
        fontSize: 11, color: 'rgba(255,255,255,0.6)',
        marginTop: 2, fontWeight: '500',
    },
    moduleArrow: {
        position: 'absolute', bottom: 14, right: 14,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
});

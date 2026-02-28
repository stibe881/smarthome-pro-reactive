import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    CalendarDays, CheckSquare, ShoppingCart, MessageSquare,
    ChevronRight, Users, UtensilsCrossed, Trophy, Phone,
    Clock, Luggage, Target, LayoutList, BookOpen, MapPin, FolderLock, Cake,
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
import { FamilyCelebrations } from '../../components/FamilyCelebrations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

type ModuleKey = 'calendar' | 'todos' | 'shopping' | 'pinboard' | 'meals' | 'rewards' | 'contacts' | 'routines' | 'packing' | 'countdowns' | 'weekly' | 'recipes' | 'locations' | 'documents' | 'celebrations';

interface ModuleStats {
    todayEvents: number;
    openTodos: number;
    recentPins: number;
}

export default function FamilyScreen() {
    const { colors } = useTheme();
    const { user, effectiveRole, impersonatedUserId } = useAuth();
    const { householdId } = useHousehold();
    const { isProUser, presentPaywall } = useSubscription();

    const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);
    const [stats, setStats] = useState<ModuleStats>({ todayEvents: 0, openTodos: 0, recentPins: 0 });
    const [fadeAnim] = useState(new Animated.Value(0));
    const [allowedModules, setAllowedModules] = useState<string[] | null>(null);

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    // Fetch allowed modules for the current (or impersonated) user
    useEffect(() => {
        const fetchAllowedModules = async () => {
            const userId = impersonatedUserId || user?.id;
            if (!userId) return;
            try {
                const { data } = await supabase
                    .from('family_members')
                    .select('allowed_modules')
                    .eq('user_id', userId)
                    .single();
                setAllowedModules(data?.allowed_modules ?? null);
            } catch (e) {
                setAllowedModules(null); // default: all modules
            }
        };
        fetchAllowedModules();
    }, [user?.id, impersonatedUserId]);

    const isModuleAllowed = (key: string) => allowedModules === null || allowedModules.includes(key);


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

    // Friendly colors — one color per category
    // Planung: warm blue | Familie: soft coral | Extras: gentle violet
    const PLAN_GRADIENT: [string, string] = ['#3B82F6', '#2563EB'];
    const PLAN_ICON = '#93C5FD';
    const FAMILY_GRADIENT: [string, string] = ['#F472B6', '#EC4899'];
    const FAMILY_ICON = '#FBCFE8';
    const EXTRAS_GRADIENT: [string, string] = ['#8B5CF6', '#7C3AED'];
    const EXTRAS_ICON = '#C4B5FD';

    const MAIN_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string }[] = [
        {
            key: 'calendar', title: 'Kalender',
            subtitle: stats.todayEvents > 0 ? `${stats.todayEvents} Termine heute` : 'Keine Termine',
            icon: CalendarDays, gradient: PLAN_GRADIENT, iconColor: PLAN_ICON,
        },
        {
            key: 'todos', title: 'Aufgaben',
            subtitle: stats.openTodos > 0 ? `${stats.openTodos} offen` : 'Alles erledigt ✓',
            icon: CheckSquare, gradient: PLAN_GRADIENT, iconColor: PLAN_ICON,
        },
        {
            key: 'shopping', title: 'Einkaufsliste',
            subtitle: 'Gemeinsam einkaufen',
            icon: ShoppingCart, gradient: PLAN_GRADIENT, iconColor: PLAN_ICON,
        },
        {
            key: 'meals', title: 'Essensplaner',
            subtitle: 'Wochenplan',
            icon: UtensilsCrossed, gradient: PLAN_GRADIENT, iconColor: PLAN_ICON,
        },
    ];

    const FAMILY_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string }[] = [
        {
            key: 'pinboard', title: 'Pinnwand',
            subtitle: stats.recentPins > 0 ? `${stats.recentPins} Einträge` : 'Noch keine',
            icon: MessageSquare, gradient: FAMILY_GRADIENT, iconColor: FAMILY_ICON,
        },
        {
            key: 'rewards', title: 'Belohnungen',
            subtitle: 'Punkte sammeln',
            icon: Trophy, gradient: FAMILY_GRADIENT, iconColor: FAMILY_ICON,
        },
        {
            key: 'contacts', title: 'Kontakte',
            subtitle: 'Wichtige Nummern',
            icon: Phone, gradient: FAMILY_GRADIENT, iconColor: FAMILY_ICON,
        },
        {
            key: 'routines', title: 'Routinen',
            subtitle: 'Tagesabläufe',
            icon: Clock, gradient: FAMILY_GRADIENT, iconColor: FAMILY_ICON,
        },
        {
            key: 'locations', title: 'Standort',
            subtitle: 'Familie finden',
            icon: MapPin, gradient: FAMILY_GRADIENT, iconColor: FAMILY_ICON,
        },
        {
            key: 'celebrations', title: 'Geburtstage',
            subtitle: 'Feiern & Jubiläen',
            icon: Cake, gradient: FAMILY_GRADIENT, iconColor: FAMILY_ICON,
        },
    ];

    const UTILITY_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string }[] = [
        {
            key: 'packing', title: 'Packlisten',
            subtitle: 'Für Ferien & Ausflüge',
            icon: Luggage, gradient: EXTRAS_GRADIENT, iconColor: EXTRAS_ICON,
        },
        {
            key: 'countdowns', title: 'Countdowns',
            subtitle: 'Tage zählen',
            icon: Target, gradient: EXTRAS_GRADIENT, iconColor: EXTRAS_ICON,
        },
        {
            key: 'weekly', title: 'Wochenübersicht',
            subtitle: 'Alles auf einen Blick',
            icon: LayoutList, gradient: EXTRAS_GRADIENT, iconColor: EXTRAS_ICON,
        },
        {
            key: 'recipes', title: 'Rezeptbuch',
            subtitle: 'Familienrezepte',
            icon: BookOpen, gradient: EXTRAS_GRADIENT, iconColor: EXTRAS_ICON,
        },
        {
            key: 'documents', title: 'Dokumentsafe',
            subtitle: 'Wichtige Dokumente',
            icon: FolderLock, gradient: EXTRAS_GRADIENT, iconColor: EXTRAS_ICON,
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
                {MAIN_MODULES.some(m => isModuleAllowed(m.key)) && (<>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Planung</Text>
                    </View>
                    <View style={styles.gridContainer}>
                        {MAIN_MODULES.filter(m => isModuleAllowed(m.key)).map(renderModuleCard)}
                    </View>
                </>)}

                {/* Familie & Motivation */}
                {FAMILY_MODULES.some(m => isModuleAllowed(m.key)) && (<>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Familie</Text>
                    </View>
                    <View style={styles.gridContainer}>
                        {FAMILY_MODULES.filter(m => isModuleAllowed(m.key)).map(renderModuleCard)}
                    </View>
                </>)}

                {/* Tools & Extras */}
                {UTILITY_MODULES.some(m => isModuleAllowed(m.key)) && (<>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Extras</Text>
                    </View>
                    <View style={styles.gridContainer}>
                        {UTILITY_MODULES.filter(m => isModuleAllowed(m.key)).map(renderModuleCard)}
                    </View>
                </>)}

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
            <FamilyCelebrations visible={activeModule === 'celebrations'} onClose={handleCloseModule} />
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

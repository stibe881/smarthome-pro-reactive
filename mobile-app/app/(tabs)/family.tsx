import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Animated, Platform } from 'react-native';
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
    const { width } = useWindowDimensions();

    const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);
    const [stats, setStats] = useState<ModuleStats>({ todayEvents: 0, openTodos: 0, recentPins: 0 });
    const [fadeAnim] = useState(new Animated.Value(0));
    const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
    const [overviewMode, setOverviewMode] = useState<'day' | 'week'>('day');
    const [todayEvents, setTodayEvents] = useState<{ id: string; title: string; start_date: string; color?: string }[]>([]);
    const [weekData, setWeekData] = useState<{ date: Date; count: number; events: { title: string; start_date: string }[] }[]>([]);

    // Responsive breakpoints
    const isDesktop = width >= 1024;
    const isTablet = width >= 768;
    const contentMaxWidth = 900;
    const contentWidth = isDesktop ? Math.min(width, contentMaxWidth) : width;

    // Dynamic card width: 2 columns on phone, 3 on tablet, 4 on desktop
    const numColumns = isDesktop ? 4 : isTablet ? 3 : 2;
    const horizontalPadding = 16;
    const gap = 12;
    const totalGaps = (numColumns - 1) * gap;
    const totalPadding = horizontalPadding * 2;
    const availableWidth = contentWidth - totalPadding - totalGaps;
    const CARD_WIDTH = availableWidth / numColumns;

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

            // Week range (Mon-Sun)
            const dayOfWeek = today.getDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() + mondayOffset);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const [eventsRes, todosRes, pinsRes, todayEventsRes, weekEventsRes] = await Promise.all([
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
                supabase.from('planner_events')
                    .select('id, title, start_date, color')
                    .eq('household_id', householdId)
                    .gte('start_date', todayStart)
                    .lte('start_date', todayEnd)
                    .order('start_date', { ascending: true })
                    .limit(5),
                supabase.from('planner_events')
                    .select('id, title, start_date')
                    .eq('household_id', householdId)
                    .gte('start_date', weekStart.toISOString())
                    .lte('start_date', weekEnd.toISOString())
                    .order('start_date', { ascending: true }),
            ]);

            setStats({
                todayEvents: eventsRes.count || 0,
                openTodos: todosRes.count || 0,
                recentPins: pinsRes.count || 0,
            });

            setTodayEvents(todayEventsRes.data || []);

            // Build week data
            const days: typeof weekData = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                const dayStr = d.toISOString().slice(0, 10);
                const dayEvents = (weekEventsRes.data || []).filter(e => e.start_date?.slice(0, 10) === dayStr);
                days.push({ date: d, count: dayEvents.length, events: dayEvents });
            }
            setWeekData(days);

            // Load user preference
            const userId = impersonatedUserId || user?.id;
            if (userId) {
                const { data: memberData } = await supabase
                    .from('family_members')
                    .select('overview_mode')
                    .eq('user_id', userId)
                    .single();
                if (memberData?.overview_mode) {
                    setOverviewMode(memberData.overview_mode);
                }
            }
        } catch (e) {
            console.warn('Error loading family stats:', e);
        }
    }, [householdId, user?.id, impersonatedUserId]);

    useEffect(() => { loadStats(); }, [loadStats]);

    const toggleOverviewMode = async (mode: 'day' | 'week') => {
        setOverviewMode(mode);
        const userId = impersonatedUserId || user?.id;
        if (userId) {
            await supabase.from('family_members').update({ overview_mode: mode }).eq('user_id', userId);
        }
    };

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
    const PLAN_GRADIENT: [string, string] = ['#3B82F6', '#2563EB'];
    const PLAN_ICON = '#93C5FD';
    const FAMILY_GRADIENT: [string, string] = ['#F472B6', '#EC4899'];
    const FAMILY_ICON = '#FBCFE8';
    const EXTRAS_GRADIENT: [string, string] = ['#8B5CF6', '#7C3AED'];
    const EXTRAS_ICON = '#C4B5FD';

    const MAIN_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string; badge?: string }[] = [
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

    const FAMILY_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string; badge?: string }[] = [
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
            badge: 'Beta',
        },
        {
            key: 'celebrations', title: 'Geburtstage',
            subtitle: 'Feiern & Jubiläen',
            icon: Cake, gradient: FAMILY_GRADIENT, iconColor: FAMILY_ICON,
        },
    ];

    const UTILITY_MODULES: { key: ModuleKey; title: string; subtitle: string; icon: any; gradient: [string, string]; iconColor: string; badge?: string }[] = [
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
                    { width: CARD_WIDTH, borderRadius: 20, overflow: 'hidden' as const },
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.moduleTitle}>{mod.title}</Text>
                            {mod.badge && (
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }}>{mod.badge}</Text>
                                </View>
                            )}
                        </View>
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
                contentContainerStyle={[
                    styles.scrollContent,
                    isDesktop && { alignItems: 'center' as const },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={[
                    { width: '100%' },
                    isDesktop && { maxWidth: contentMaxWidth },
                ]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={[styles.greeting, { color: colors.subtext }]}>{getGreeting()} 👋</Text>
                            <Text style={[styles.title, { color: colors.text }]}>Family Hub</Text>
                        </View>
                    </View>

                    {/* Day / Week Overview */}
                    <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {/* Toggle */}
                        <View style={[styles.overviewToggle, { backgroundColor: colors.border }]}>
                            <Pressable style={[styles.toggleBtn, overviewMode === 'day' && { backgroundColor: colors.accent }]} onPress={() => toggleOverviewMode('day')}>
                                <Text style={[styles.toggleText, { color: overviewMode === 'day' ? '#fff' : colors.subtext }]}>Heute</Text>
                            </Pressable>
                            <Pressable style={[styles.toggleBtn, overviewMode === 'week' && { backgroundColor: colors.accent }]} onPress={() => toggleOverviewMode('week')}>
                                <Text style={[styles.toggleText, { color: overviewMode === 'week' ? '#fff' : colors.subtext }]}>Woche</Text>
                            </Pressable>
                        </View>

                        {overviewMode === 'day' ? (
                            /* ---- DAY VIEW ---- */
                            <View>
                                {/* Stats row */}
                                <View style={styles.dayStatsRow}>
                                    <Pressable style={styles.dayStat} onPress={() => handleModulePress('calendar')}>
                                        <CalendarDays size={14} color={colors.accent} />
                                        <Text style={[styles.dayStatNum, { color: colors.accent }]}>{stats.todayEvents}</Text>
                                        <Text style={[styles.dayStatLabel, { color: colors.subtext }]}>Termine</Text>
                                    </Pressable>
                                    <View style={[styles.dayStatDivider, { backgroundColor: colors.border }]} />
                                    <Pressable style={styles.dayStat} onPress={() => handleModulePress('todos')}>
                                        <CheckSquare size={14} color={colors.accent} />
                                        <Text style={[styles.dayStatNum, { color: colors.accent }]}>{stats.openTodos}</Text>
                                        <Text style={[styles.dayStatLabel, { color: colors.subtext }]}>Offen</Text>
                                    </Pressable>
                                    <View style={[styles.dayStatDivider, { backgroundColor: colors.border }]} />
                                    <Pressable style={styles.dayStat} onPress={() => handleModulePress('pinboard')}>
                                        <MessageSquare size={14} color={colors.accent} />
                                        <Text style={[styles.dayStatNum, { color: colors.accent }]}>{stats.recentPins}</Text>
                                        <Text style={[styles.dayStatLabel, { color: colors.subtext }]}>Pins</Text>
                                    </Pressable>
                                </View>
                                {/* Today's events list */}
                                {todayEvents.length > 0 ? (
                                    <View style={{ marginTop: 10 }}>
                                        {todayEvents.map(ev => {
                                            const time = new Date(ev.start_date);
                                            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                                            return (
                                                <View key={ev.id} style={[styles.eventRow, { borderColor: colors.border }]}>
                                                    <View style={[styles.eventDot, { backgroundColor: ev.color || colors.accent }]} />
                                                    <Text style={[styles.eventTime, { color: colors.subtext }]}>{timeStr}</Text>
                                                    <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{ev.title}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text style={{ color: colors.subtext, fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 10 }}>Keine Termine heute 🎉</Text>
                                )}
                            </View>
                        ) : (
                            /* ---- WEEK VIEW ---- */
                            <View>
                                <View style={styles.weekStrip}>
                                    {weekData.map((day, idx) => {
                                        const isToday = day.date.toDateString() === new Date().toDateString();
                                        const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
                                        return (
                                            <View key={idx} style={[styles.weekDay, isToday && { backgroundColor: colors.accent + '15', borderRadius: 12 }]}>
                                                <Text style={[styles.weekDayName, { color: isToday ? colors.accent : colors.subtext }]}>{dayNames[idx]}</Text>
                                                <Text style={[styles.weekDayNum, { color: isToday ? colors.accent : colors.text }]}>{day.date.getDate()}</Text>
                                                {day.count > 0 ? (
                                                    <View style={[styles.weekDot, { backgroundColor: isToday ? colors.accent : colors.subtext }]}>
                                                        <Text style={styles.weekDotText}>{day.count}</Text>
                                                    </View>
                                                ) : (
                                                    <View style={{ width: 18, height: 18 }} />
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                                {/* Week summary */}
                                <Pressable style={[styles.weekSummaryRow, { borderTopColor: colors.border }]} onPress={() => handleModulePress('weekly')}>
                                    <Text style={[styles.weekSummaryText, { color: colors.subtext }]}>
                                        {weekData.reduce((s, d) => s + d.count, 0)} Termine diese Woche · {stats.openTodos} offene Aufgaben
                                    </Text>
                                    <ChevronRight size={14} color={colors.subtext} style={{ marginLeft: 4 }} />
                                </Pressable>
                            </View>
                        )}
                    </View>

                    {/* Planung & Organisation */}
                    {MAIN_MODULES.some(m => isModuleAllowed(m.key)) && (<>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Planung</Text>
                        </View>
                        <View style={[styles.gridContainer, { gap }]}>
                            {MAIN_MODULES.filter(m => isModuleAllowed(m.key)).map(renderModuleCard)}
                        </View>
                    </>)}

                    {/* Familie & Motivation */}
                    {FAMILY_MODULES.some(m => isModuleAllowed(m.key)) && (<>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Familie</Text>
                        </View>
                        <View style={[styles.gridContainer, { gap }]}>
                            {FAMILY_MODULES.filter(m => isModuleAllowed(m.key)).map(renderModuleCard)}
                        </View>
                    </>)}

                    {/* Tools & Extras */}
                    {UTILITY_MODULES.some(m => isModuleAllowed(m.key)) && (<>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Extras</Text>
                        </View>
                        <View style={[styles.gridContainer, { gap }]}>
                            {UTILITY_MODULES.filter(m => isModuleAllowed(m.key)).map(renderModuleCard)}
                        </View>
                    </>)}

                    <View style={{ height: 20 }} />
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

    // Overview card
    overviewCard: {
        borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 28,
    },
    overviewToggle: {
        flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 12,
    },
    toggleBtn: {
        flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center',
    },
    toggleText: { fontSize: 13, fontWeight: '700' },
    dayStatsRow: {
        flexDirection: 'row', alignItems: 'center',
    },
    dayStat: {
        flex: 1, alignItems: 'center', gap: 3,
    },
    dayStatNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    dayStatLabel: { fontSize: 10, fontWeight: '500' },
    dayStatDivider: { width: 1, height: 32 },
    eventRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 6, borderBottomWidth: 0.5,
    },
    eventDot: { width: 6, height: 6, borderRadius: 3 },
    eventTime: { fontSize: 12, fontWeight: '600', width: 40 },
    eventTitle: { fontSize: 13, fontWeight: '500', flex: 1 },
    weekStrip: {
        flexDirection: 'row', justifyContent: 'space-between',
    },
    weekDay: {
        alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, flex: 1,
    },
    weekDayName: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
    weekDayNum: { fontSize: 16, fontWeight: '800' },
    weekDot: {
        width: 18, height: 18, borderRadius: 9,
        justifyContent: 'center', alignItems: 'center', marginTop: 4,
    },
    weekDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    weekSummaryRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderTopWidth: 1, marginTop: 10, paddingTop: 8,
    },
    weekSummaryText: { fontSize: 11, fontWeight: '500', textAlign: 'center' },

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
        marginBottom: 12,
    },

    // Module card gradient
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

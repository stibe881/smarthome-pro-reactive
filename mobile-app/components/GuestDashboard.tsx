import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet,
    Dimensions, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Lightbulb, ToggleLeft, Thermometer, DoorOpen, Wind, Tv, Droplets,
    Shield, LogOut, Clock, AlertTriangle, Lock, Square, Play, Fan,
    User, WifiOff, ChevronRight, ChevronDown, Power
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { useHomeAssistant, EntityState } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { ICON_MAP } from './GuestPermissionsModal';

const { width } = Dimensions.get('window');

const DOMAIN_CONFIG: Record<string, { icon: any; label: string; color: string; gradient: string }> = {
    '_doors_actions': { icon: Lock, label: 'Türen & Aktionen', color: '#10B981', gradient: '#064E3B' },
    'light': { icon: Lightbulb, label: 'Lichter', color: '#FBBF24', gradient: '#92400E' },
    'switch': { icon: ToggleLeft, label: 'Schalter', color: '#3B82F6', gradient: '#1E3A5F' },
    'climate': { icon: Thermometer, label: 'Klima', color: '#EF4444', gradient: '#7F1D1D' },
    'cover': { icon: DoorOpen, label: 'Storen', color: '#8B5CF6', gradient: '#4C1D95' },
    'fan': { icon: Fan, label: 'Ventilatoren', color: '#06B6D4', gradient: '#164E63' },
    'media_player': { icon: Tv, label: 'Medien', color: '#EC4899', gradient: '#831843' },
    'humidifier': { icon: Droplets, label: 'Luftbefeuchter', color: '#14B8A6', gradient: '#134E4A' },
    'alarm_control_panel': { icon: Shield, label: 'Alarm', color: '#F59E0B', gradient: '#78350F' },
    'input_boolean': { icon: ToggleLeft, label: 'Virtuelle Schalter', color: '#0EA5E9', gradient: '#0C4A6E' },
};

// Domains that get merged into '_doors_actions'
const MERGED_DOMAINS = ['lock', 'button', 'script'];

// Fixed display order (anything not listed goes at the end)
const DOMAIN_ORDER = ['_doors_actions', 'light', 'cover', 'media_player', 'switch', 'climate', 'fan', 'input_boolean', 'humidifier', 'alarm_control_panel'];

// Per-entity icon lookup (for merged group)
const ENTITY_DOMAIN_ICON: Record<string, { icon: any; color: string }> = {
    'lock': { icon: Lock, color: '#10B981' },
    'button': { icon: Square, color: '#6366F1' },
    'script': { icon: Play, color: '#A855F7' },
};

interface GuestPermission {
    entity_ids: string[];
    entity_config: Record<string, { name?: string; icon?: string }>;
    is_active: boolean;
    valid_from: string | null;
    valid_until: string | null;
}

export const GuestDashboard = () => {
    const { user, logout } = useAuth();
    const { entities, isConnected, callService } = useHomeAssistant();
    const { colors } = useTheme();
    const [permissions, setPermissions] = useState<GuestPermission | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({ '_doors_actions': true });

    const toggleDomainExpand = useCallback((domain: string) => {
        setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }));
    }, []);

    const loadPermissions = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('guest_permissions')
                .select('entity_ids, entity_config, is_active, valid_from, valid_until')
                .eq('guest_user_id', user?.id)
                .maybeSingle();

            if (error) throw error;
            setPermissions(data);
        } catch (e) {
            console.error('Error loading guest permissions:', e);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    useEffect(() => { loadPermissions(); }, [loadPermissions]);

    const isTimeValid = useMemo(() => {
        if (!permissions) return false;
        if (!permissions.is_active) return false;
        const now = new Date();
        if (permissions.valid_from && new Date(permissions.valid_from) > now) return false;
        if (permissions.valid_until && new Date(permissions.valid_until) < now) return false;
        return true;
    }, [permissions]);

    const allowedEntities = useMemo(() => {
        if (!permissions || !isTimeValid) return [];
        return entities.filter(e => permissions.entity_ids.includes(e.entity_id));
    }, [entities, permissions, isTimeValid]);

    const groupedEntities = useMemo(() => {
        const groups: Record<string, EntityState[]> = {};
        allowedEntities.forEach(e => {
            const rawDomain = e.entity_id.split('.')[0];
            // Merge lock, button, script into a single group
            const domain = MERGED_DOMAINS.includes(rawDomain) ? '_doors_actions' : rawDomain;
            if (!groups[domain]) groups[domain] = [];
            groups[domain].push(e);
        });
        // Sort within groups
        Object.values(groups).forEach(arr =>
            arr.sort((a, b) => (a.attributes.friendly_name || '').localeCompare(b.attributes.friendly_name || ''))
        );
        return groups;
    }, [allowedEntities]);

    // Sort domain groups by fixed order
    const sortedDomainEntries = useMemo(() => {
        const entries = Object.entries(groupedEntities);
        return entries.sort(([a], [b]) => {
            const ai = DOMAIN_ORDER.indexOf(a);
            const bi = DOMAIN_ORDER.indexOf(b);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
    }, [groupedEntities]);

    const activeCount = useMemo(() =>
        allowedEntities.filter(e => ['on', 'open', 'playing', 'unlocked'].includes(e.state)).length
        , [allowedEntities]);

    const handleToggle = useCallback((entity: EntityState) => {
        const domain = entity.entity_id.split('.')[0];
        const isOn = entity.state === 'on';

        if (['light', 'switch', 'fan', 'input_boolean'].includes(domain)) {
            callService(domain, isOn ? 'turn_off' : 'turn_on', entity.entity_id);
        } else if (domain === 'cover') {
            callService(domain, entity.state === 'open' ? 'close_cover' : 'open_cover', entity.entity_id);
        } else if (domain === 'lock') {
            callService(domain, entity.state === 'locked' ? 'unlock' : 'lock', entity.entity_id);
        } else if (domain === 'button' || domain === 'script') {
            callService(domain, 'press', entity.entity_id);
        }
    }, [callService]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Guten Morgen';
        if (hour < 18) return 'Guten Tag';
        return 'Guten Abend';
    };

    const formatTimeWindow = () => {
        if (!permissions) return '';
        const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        const parts: string[] = [];
        if (permissions.valid_from) parts.push('Ab ' + new Date(permissions.valid_from).toLocaleDateString('de-CH', opts));
        if (permissions.valid_until) parts.push('Bis ' + new Date(permissions.valid_until).toLocaleDateString('de-CH', opts));
        return parts.join('  ·  ');
    };

    // ─── Loading ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.fullCenter, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={{ color: colors.subtext, marginTop: 12, fontSize: 14 }}>Zugangsdaten werden geladen…</Text>
            </SafeAreaView>
        );
    }

    // ─── Access Denied ───────────────────────────────────────
    if (!permissions || !permissions.is_active) {
        return (
            <SafeAreaView style={[styles.fullCenter, { backgroundColor: colors.background }]}>
                <View style={[styles.deniedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.deniedIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                        <Shield size={32} color="#EF4444" />
                    </View>
                    <Text style={[styles.deniedTitle, { color: colors.text }]}>Zugang nicht aktiv</Text>
                    <Text style={[styles.deniedSub, { color: colors.subtext }]}>
                        Dein Gastzugang ist derzeit deaktiviert.{'\n'}Bitte kontaktiere den Administrator.
                    </Text>
                    <Pressable onPress={logout} style={[styles.logoutBtnLarge, { borderColor: colors.border }]}>
                        <LogOut size={16} color={colors.subtext} />
                        <Text style={{ color: colors.subtext, marginLeft: 8, fontWeight: '600' }}>Abmelden</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    // ─── Time Expired ────────────────────────────────────────
    if (!isTimeValid) {
        return (
            <SafeAreaView style={[styles.fullCenter, { backgroundColor: colors.background }]}>
                <View style={[styles.deniedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.deniedIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                        <Clock size={32} color="#F59E0B" />
                    </View>
                    <Text style={[styles.deniedTitle, { color: colors.text }]}>Zeitfenster abgelaufen</Text>
                    <Text style={[styles.deniedSub, { color: colors.subtext }]}>
                        Dein Zugang ist ausserhalb des erlaubten Zeitfensters.
                    </Text>
                    <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8, textAlign: 'center' }}>{formatTimeWindow()}</Text>
                    <Pressable onPress={logout} style={[styles.logoutBtnLarge, { borderColor: colors.border }]}>
                        <LogOut size={16} color={colors.subtext} />
                        <Text style={{ color: colors.subtext, marginLeft: 8, fontWeight: '600' }}>Abmelden</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    // ─── Main Dashboard ──────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Background Image */}
            {colors.backgroundImage && (
                <View style={StyleSheet.absoluteFill}>
                    <Image source={colors.backgroundImage} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                </View>
            )}

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPermissions(); }} tintColor={colors.accent} />
                }
            >
                {/* ── Header ─────────────────────────────── */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.greeting, { color: colors.text }]}>{getGreeting()}</Text>
                        <Text style={[styles.dateText, { color: colors.subtext }]}>
                            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>
                    </View>
                    <Pressable
                        onPress={logout}
                        style={[styles.logoutCircle, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <LogOut size={18} color={colors.subtext} />
                    </Pressable>
                </View>

                {/* ── Guest Info Badge ────────────────────── */}
                <View style={[styles.infoBanner, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}>
                    <User size={14} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>Gastzugang</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={{ color: colors.accent, fontSize: 12, opacity: 0.7 }}>{user?.email}</Text>
                </View>

                {/* ── Time Window ─────────────────────────── */}
                {(permissions.valid_from || permissions.valid_until) && (
                    <View style={[styles.timeBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Clock size={13} color={colors.subtext} />
                        <Text style={{ color: colors.subtext, fontSize: 11, marginLeft: 6, flex: 1 }}>{formatTimeWindow()}</Text>
                    </View>
                )}

                {/* ── Connection Warning ──────────────────── */}
                {!isConnected && (
                    <View style={[styles.warningBar, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]}>
                        <WifiOff size={14} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontSize: 12, marginLeft: 6 }}>Verbindung wird hergestellt…</Text>
                    </View>
                )}

                {/* ── Status Overview ─────────────────────── */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.statNumber, { color: colors.text }]}>{allowedEntities.length}</Text>
                        <Text style={[styles.statLabel, { color: colors.subtext }]}>Geräte</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.statNumber, { color: '#10B981' }]}>{activeCount}</Text>
                        <Text style={[styles.statLabel, { color: colors.subtext }]}>Aktiv</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.statNumber, { color: colors.text }]}>{Object.keys(groupedEntities).length}</Text>
                        <Text style={[styles.statLabel, { color: colors.subtext }]}>Kategorien</Text>
                    </View>
                </View>

                {/* ── Entity Groups (sorted) ───────────────── */}
                {sortedDomainEntries.map(([domain, domainEntities]) => {
                    const config = DOMAIN_CONFIG[domain] || { icon: ToggleLeft, label: domain, color: '#6B7280', gradient: '#374151' };
                    const HeaderIcon = config.icon;
                    const isMergedGroup = domain === '_doors_actions';
                    const domainActiveCount = domainEntities.filter(e => ['on', 'open', 'playing', 'unlocked'].includes(e.state)).length;
                    const isExpanded = !!expandedDomains[domain];

                    return (
                        <View key={domain} style={styles.domainSection}>
                            {/* Domain Header (tappable) */}
                            <Pressable
                                style={styles.domainHeader}
                                onPress={() => toggleDomainExpand(domain)}
                            >
                                <View style={[styles.domainIconWrap, { backgroundColor: config.color + '18' }]}>
                                    <HeaderIcon size={16} color={config.color} />
                                </View>
                                <Text style={[styles.domainTitle, { color: colors.text }]}>{config.label}</Text>
                                {domainActiveCount > 0 && (
                                    <View style={[styles.activePill, { backgroundColor: config.color + '20' }]}>
                                        <Text style={{ color: config.color, fontSize: 11, fontWeight: '700' }}>
                                            {domainActiveCount} aktiv
                                        </Text>
                                    </View>
                                )}
                                {isExpanded
                                    ? <ChevronDown size={18} color={colors.subtext} style={{ marginLeft: 6 }} />
                                    : <ChevronRight size={18} color={colors.subtext} style={{ marginLeft: 6 }} />
                                }
                            </Pressable>

                            {/* Entity Cards Grid (collapsible) */}
                            {isExpanded && (
                                <View style={styles.entityGrid}>
                                    {domainEntities.map(entity => {
                                        const rawDomain = entity.entity_id.split('.')[0];
                                        const isOn = ['on', 'open', 'playing', 'unlocked'].includes(entity.state);
                                        const isLocked = entity.state === 'locked';

                                        // Custom icon from admin config
                                        const customIconKey = permissions?.entity_config?.[entity.entity_id]?.icon;
                                        const customIcon = customIconKey ? ICON_MAP[customIconKey] : null;

                                        // For merged group, use per-entity icon & color
                                        const entityOverride = isMergedGroup ? ENTITY_DOMAIN_ICON[rawDomain] : null;
                                        const EntityIcon = customIcon || entityOverride?.icon || config.icon;
                                        const entityColor = entityOverride?.color || config.color;

                                        return (
                                            <Pressable
                                                key={entity.entity_id}
                                                onPress={() => handleToggle(entity)}
                                                style={({ pressed }) => [
                                                    styles.entityCard,
                                                    {
                                                        backgroundColor: isOn
                                                            ? entityColor + '12'
                                                            : colors.card,
                                                        borderColor: isOn
                                                            ? entityColor + '40'
                                                            : colors.border,
                                                        transform: [{ scale: pressed ? 0.97 : 1 }],
                                                    }
                                                ]}
                                            >
                                                {/* Icon */}
                                                <View style={[
                                                    styles.entityIconWrap,
                                                    {
                                                        backgroundColor: isOn
                                                            ? entityColor + '25'
                                                            : colors.border + '40',
                                                    }
                                                ]}>
                                                    <EntityIcon size={20} color={isOn ? entityColor : colors.subtext} />
                                                </View>

                                                {/* Info */}
                                                <Text style={[styles.entityName, { color: colors.text }]} numberOfLines={2}>
                                                    {permissions?.entity_config?.[entity.entity_id]?.name || entity.attributes.friendly_name || entity.entity_id}
                                                </Text>

                                                {/* State – hide for button/script */}
                                                {!['button', 'script'].includes(rawDomain) && (
                                                    <View style={styles.entityFooter}>
                                                        <View style={[styles.statusDot, {
                                                            backgroundColor: isOn ? entityColor : isLocked ? '#EF4444' : colors.border
                                                        }]} />
                                                        <Text style={[styles.entityState, {
                                                            color: isOn ? entityColor : colors.subtext
                                                        }]}>
                                                            {isOn ? 'An' :
                                                                isLocked ? 'Gesperrt' :
                                                                    entity.state === 'off' ? 'Aus' :
                                                                        entity.state === 'closed' ? 'Geschlossen' :
                                                                            entity.state === 'unavailable' ? 'Offline' :
                                                                                entity.state}
                                                        </Text>
                                                    </View>
                                                )}
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* ── Empty State ─────────────────────────── */}
                {allowedEntities.length === 0 && (
                    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.deniedIconWrap, { backgroundColor: colors.accent + '12' }]}>
                            <Shield size={28} color={colors.accent} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Geräte zugewiesen</Text>
                        <Text style={[styles.emptySub, { color: colors.subtext }]}>
                            Der Administrator hat dir noch keine Steuerungen freigegeben.
                        </Text>
                    </View>
                )}

                {/* Bottom Spacer */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// ─── Styles ──────────────────────────────────────────────────
const CARD_GAP = 10;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;

const styles = StyleSheet.create({
    container: { flex: 1 },
    fullCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    greeting: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    dateText: { fontSize: 13, marginTop: 3 },
    logoutCircle: {
        width: 42, height: 42, borderRadius: 21,
        borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },

    // Info Banner
    infoBanner: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 14,
        borderRadius: 12, borderWidth: 1, marginBottom: 12,
    },

    // Time Bar
    timeBar: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 12,
        borderRadius: 10, borderWidth: 1, marginBottom: 12,
    },

    // Warning Bar
    warningBar: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 12,
        borderRadius: 10, borderWidth: 1, marginBottom: 12,
    },

    // Stats
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
        flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1,
        alignItems: 'center',
    },
    statNumber: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Domain Section
    domainSection: { marginBottom: 20 },
    domainHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    domainIconWrap: {
        width: 30, height: 30, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
    },
    domainTitle: { fontSize: 15, fontWeight: '700', marginLeft: 8, flex: 1 },
    activePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

    // Entity Grid
    entityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
    entityCard: {
        width: CARD_WIDTH, padding: 14, borderRadius: 16, borderWidth: 1,
    },
    entityIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    entityName: { fontSize: 13, fontWeight: '600', lineHeight: 17, marginBottom: 8 },
    entityFooter: { flexDirection: 'row', alignItems: 'center' },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    entityState: { fontSize: 12, fontWeight: '600' },

    // Denied / Empty States
    deniedCard: {
        borderRadius: 24, borderWidth: 1, padding: 32,
        alignItems: 'center', maxWidth: 340, width: '100%',
    },
    deniedIconWrap: {
        width: 64, height: 64, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    deniedTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
    deniedSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, opacity: 0.8 },
    logoutBtnLarge: {
        flexDirection: 'row', alignItems: 'center', marginTop: 24,
        paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    },
    emptyState: {
        alignItems: 'center', padding: 32, borderRadius: 20, borderWidth: 1, marginTop: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
    emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
});

import React, { useMemo, useState, useCallback, memo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, Modal, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import {
    Wifi, WifiOff, Bot, RefreshCw,
    Play, Moon, Tv, ChevronRight, Power, Zap,
    LucideIcon,
    BedDouble,
    Thermometer, Sun, CloudRain, Lock, Unlock, Loader2, X, Fan,
    Lightbulb, Blinds, Music, Battery, Shirt, Wind, UtensilsCrossed,
    Calendar, PlayCircle, Home, Map, PartyPopper, DoorOpen, Clock, MapPin, ShoppingCart
} from 'lucide-react-native';
// LinearGradient removed to fix compatibility issue

// =====================================================
// CHILD COMPONENTS
// =====================================================
import RobiVacuumModal from '../../components/RobiVacuumModal';

interface HeroStatCardProps {
    icon: LucideIcon;
    iconColor: string;
    value: number;
    total: number;
    label: string;
    gradient: [string, string];
    isActive: boolean;
    cardWidth: number;
    onPress?: () => void;
    onLongPress?: () => void;
}

const HeroStatCard = memo(({
    icon: Icon,
    iconColor,
    value,
    total,
    label,
    gradient,
    isActive,
    cardWidth,
    onPress,
    onLongPress
}: HeroStatCardProps) => (
    <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={[styles.heroCard, { width: cardWidth }]}
    >
        <View style={[styles.heroCardGradient, { backgroundColor: isActive ? gradient[0] : '#1E293B' }]}>
            <View style={[styles.decorativeCircle, { backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)' }]} />

            <View style={styles.heroCardHeader}>
                <View style={[styles.iconBubble, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }]}>
                    <Icon size={22} color={isActive ? '#fff' : iconColor} />
                </View>
                <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
            </View>

            <View style={styles.heroCardContent}>
                <View style={styles.valueRow}>
                    <Text style={styles.heroValue}>{value}</Text>
                    <Text style={styles.heroTotal}>/{total}</Text>
                </View>
                <Text style={[styles.heroLabel, { color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)' }]}>
                    {label}
                </Text>
            </View>

            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, {
                    width: `${total > 0 ? (value / total) * 100 : 0}%`,
                    backgroundColor: isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'
                }]} />
            </View>
        </View>
    </Pressable>
));

interface QuickActionProps {
    icon: LucideIcon;
    iconColor: string;
    label: string;
    onPress: () => void;
    gradient: [string, string];
}

const QuickAction = memo(({
    icon: Icon,
    iconColor,
    label,
    onPress,
    gradient
}: QuickActionProps) => (
    <Pressable onPress={onPress} style={styles.quickAction}>
        <View style={[styles.quickActionGradient, { backgroundColor: gradient[0] }]}>
            <Icon size={20} color={iconColor} />
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
));

const Tile = ({ label, subtext, icon: Icon, iconColor, activeColor, isActive, onPress, children, activeStyle }: any) => (
    <Pressable
        onPress={onPress}
        style={[
            styles.tile,
            isActive && { backgroundColor: activeColor + '15', borderColor: activeColor + '50' },
            activeStyle
        ]}
    >
        <View style={styles.tileHeader}>
            <View style={[styles.tileIcon, isActive && { backgroundColor: activeColor }]}>
                <Icon size={20} color={isActive ? '#FFF' : iconColor} />
            </View>
            <Text style={[styles.tileState, isActive && { color: activeColor }]}>
                {subtext}
            </Text>
        </View>
        <Text numberOfLines={1} style={[styles.tileName, isActive && { color: '#FFF' }]}>{label}</Text>
        {children}
    </Pressable>
);

const SpecificApplianceTile = ({
    label,
    icon: Icon,
    statusText,
    isRunning,
    isFinished,
    compact = false
}: {
    label: string,
    icon: LucideIcon,
    statusText: string,
    isRunning: boolean,
    isFinished: boolean,
    compact?: boolean
}) => {
    // Only show if running or finished
    if (!statusText) return null;

    if (compact) {
        return (
            <View style={[styles.applianceStatusCard, styles.applianceStatusCardCompact, isRunning ? styles.applianceRunning : styles.applianceFinished]}>
                <View style={[styles.applianceStatusIcon, { marginBottom: 8, marginRight: 0 }, isRunning ? { backgroundColor: '#3B82F6' } : { backgroundColor: '#10B981' }]}>
                    <Icon size={20} color="#fff" />
                    {isRunning && <ActivityIndicator size="small" color="#fff" style={{ position: 'absolute', top: -4, right: -4, transform: [{ scale: 0.7 }] }} />}
                    {isFinished && (
                        <View style={[styles.finishedBadge, { position: 'absolute', top: -4, right: -4, width: 16, height: 16 }]}>
                            <Text style={[styles.finishedText, { fontSize: 8 }]}>✓</Text>
                        </View>
                    )}
                </View>
                <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.applianceTime, { textAlign: 'center', fontSize: 12, marginBottom: 2, fontWeight: 'bold', color: isRunning ? '#fff' : '#10B981' }]}>{statusText}</Text>
                    <Text style={[styles.applianceName, { textAlign: 'center', fontSize: 10, opacity: 0.7 }]} numberOfLines={1}>{label}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.applianceStatusCard, isRunning ? styles.applianceRunning : styles.applianceFinished]}>
            <View style={[styles.applianceStatusIcon, isRunning ? { backgroundColor: '#3B82F6' } : { backgroundColor: '#10B981' }]}>
                <Icon size={20} color="#fff" />
            </View>
            <View style={styles.applianceInfo}>
                <Text style={styles.applianceName} numberOfLines={1}>{label}</Text>
                <Text style={styles.applianceTime}>{statusText}</Text>
            </View>
            {isRunning && <ActivityIndicator size="small" color="#3B82F6" style={{ marginLeft: 8 }} />}
            {isFinished && <View style={styles.finishedBadge}><Text style={styles.finishedText}>✓</Text></View>}
        </View>
    );
};

const LockTile = ({ lock, callService }: { lock: any, callService: any }) => {
    const isLocked = lock.state === 'locked';
    const isUnlocked = lock.state === 'unlocked';
    const isJammed = lock.state === 'jammed';

    let friendlyName = lock.attributes.friendly_name || 'Haustür';
    if (friendlyName.toLowerCase().includes('smart lock') || friendlyName.toLowerCase().includes('nuki')) {
        friendlyName = 'Wohnungstüre';
    }

    const toggleLock = () => {
        if (isLocked) {
            Alert.alert('Tür aufschliessen', `Möchtest du ${friendlyName} aufschliessen?`, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Aufschliessen', onPress: () => callService('lock', 'unlock', lock.entity_id) }
            ]);
        } else {
            callService('lock', 'lock', lock.entity_id);
        }
    };

    const openDoor = () => {
        // Check if this is the front door (Haustür)
        const isHaustuer = lock.entity_id.includes('haustuer') || lock.entity_id.includes('haustür') || (lock.attributes.friendly_name && lock.attributes.friendly_name.toLowerCase().includes('haustür'));

        if (isHaustuer) {
            Alert.alert('Tür öffnen', `Möchtest du die Haustür öffnen?`, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'ÖFFNEN', style: 'destructive', onPress: () => callService('button', 'press', 'button.hausture_tur_offnen') }
            ]);
        } else {
            Alert.alert('Tür öffnen', `Möchtest du die Falle von ${friendlyName} ziehen (Tür öffnen)?`, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'ÖFFNEN', style: 'destructive', onPress: () => callService('lock', 'open', lock.entity_id) }
            ]);
        }
    };

    return (
        <View style={[styles.lockCard, isUnlocked && styles.lockCardOpen]}>
            <Pressable onPress={toggleLock} style={styles.lockMainAction}>
                <View style={[styles.lockIcon, isUnlocked ? { backgroundColor: '#EF4444' } : { backgroundColor: '#10B981' }]}>
                    {isUnlocked ? <Unlock size={24} color="#fff" /> : <Lock size={24} color="#fff" />}
                </View>
                <View style={styles.lockInfo}>
                    <Text style={[styles.lockTitle, isUnlocked && { color: '#EF4444' }]}>
                        {friendlyName}
                    </Text>
                    <Text style={styles.lockState}>
                        {isJammed ? 'KLEMMT' : isUnlocked ? 'OFFEN' : 'GESCHLOSSEN'}
                    </Text>
                </View>
            </Pressable>

            {/* Separate OPEN Button */}
            <Pressable onPress={openDoor} style={styles.openDoorBtn}>
                <DoorOpen size={20} color="#3B82F6" />
                <Text style={styles.openDoorText}>Öffnen</Text>
            </Pressable>
        </View>
    )
};

const DoorOpenerTile = ({ entity, callService }: { entity: any, callService: any }) => {
    const friendlyName = "Haustüre"; // Hardcoded specific name for this specific button

    const pressOpener = () => {
        Alert.alert('Tür öffnen', `Möchtest du die ${friendlyName} öffnen?`, [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'ÖFFNEN',
                style: 'destructive',
                onPress: async () => {
                    callService('button', 'press', entity.entity_id);

                    // Local notification confirmation
                    try {
                        const settingsJson = await AsyncStorage.getItem('notification_settings');
                        const settings = settingsJson ? JSON.parse(settingsJson) : { enabled: true, security: true };

                        if (settings.enabled && settings.security) {
                            await Notifications.scheduleNotificationAsync({
                                content: {
                                    title: "Security Center",
                                    body: "Die Haustüre wurde geöffnet",
                                    sound: 'default',
                                },
                                trigger: null, // immediate
                            });
                        }
                    } catch (e) {
                        console.error("Failed to send notification", e);
                    }
                }
            }
        ]);
    };

    return (
        <View style={styles.lockCard}>
            <View style={styles.lockMainAction}>
                <View style={[styles.lockIcon, { backgroundColor: '#3B82F6' }]}>
                    <DoorOpen size={24} color="#fff" />
                </View>
                <View style={styles.lockInfo}>
                    <Text style={styles.lockTitle}>
                        {friendlyName}
                    </Text>
                    {/* <Text style={styles.lockState}>
                        TÜRÖFFNER
                    </Text> */}
                </View>
            </View>

            {/* OPEN Button */}
            <Pressable onPress={pressOpener} style={styles.openDoorBtn}>
                <DoorOpen size={20} color="#3B82F6" />
                <Text style={styles.openDoorText}>Öffnen</Text>
            </Pressable>
        </View>
    );
};

// --- Calendar Modal Component ---
const CalendarModal = ({
    visible,
    onClose,
    entityId,
    title,
    accentColor = '#3B82F6'
}: {
    visible: boolean;
    onClose: () => void;
    entityId: string;
    title: string;
    accentColor?: string;
}) => {
    const { fetchCalendarEvents } = useHomeAssistant();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && entityId) {
            loadEvents();
        }
    }, [visible, entityId]);

    const loadEvents = async () => {
        setLoading(true);
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(now.getDate() + 21); // 21 days preview

        try {
            const result = await fetchCalendarEvents(entityId, now.toISOString(), endDate.toISOString());
            setEvents(result || []);
        } catch (e) {
            console.error("Failed to load events", e);
        } finally {
            setLoading(false);
        }
    };

    const groupEventsByDay = (events: any[]) => {
        const groups: { [key: string]: any[] } = {};
        events.forEach(event => {
            const dateStr = event.start.dateTime || event.start.date || '';
            const date = new Date(dateStr).toDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(event);
        });
        return groups;
    };

    const groupedEvents = groupEventsByDay(events);
    const sortedDates = Object.keys(groupedEvents).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: '#0F172A' }]}>
                    <View style={[styles.modalHeader, { backgroundColor: 'transparent', paddingTop: 60, paddingBottom: 20 }]}>
                        <View>
                            <Text style={{ fontSize: 13, color: accentColor, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>KALENDER</Text>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>{title}</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

                    <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
                        {loading ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={accentColor} />
                            </View>
                        ) : (
                            <View style={{ paddingBottom: 40 }}>
                                {sortedDates.length === 0 ? (
                                    <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 40 }}>Keine Termine in den nächsten 21 Tagen</Text>
                                ) : (
                                    sortedDates.map(date => {
                                        const eventDate = new Date(date);
                                        const isToday = eventDate.toDateString() === new Date().toDateString();
                                        const isTomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toDateString() === eventDate.toDateString();

                                        const dayLabel = isToday ? 'Heute' : isTomorrow ? 'Morgen' : eventDate.toLocaleDateString('de-DE', { weekday: 'long' });
                                        const dateLabel = eventDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

                                        return (
                                            <View key={date} style={{ marginBottom: 24 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
                                                    <Text style={{ color: isToday ? accentColor : '#94A3B8', fontWeight: 'bold', fontSize: 16 }}>{dayLabel}</Text>
                                                    <Text style={{ color: '#64748B', fontSize: 13, marginLeft: 8 }}>{dateLabel}</Text>
                                                </View>

                                                {groupedEvents[date].map((event, idx) => {
                                                    const hasTime = !!event.start.dateTime;
                                                    const timeStr = hasTime ? new Date(event.start.dateTime!).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Ganztägig';

                                                    return (
                                                        <View key={idx} style={{ flexDirection: 'row', marginBottom: 12, backgroundColor: '#1E293B', borderRadius: 12, overflow: 'hidden' }}>
                                                            <View style={{ width: 4, backgroundColor: accentColor }} />
                                                            <View style={{ padding: 12, flex: 1 }}>
                                                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 }}>{event.summary}</Text>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                        <Clock size={12} color="#94A3B8" />
                                                                        <Text style={{ color: '#94A3B8', fontSize: 12 }}>{timeStr}</Text>
                                                                    </View>
                                                                    {event.location && (
                                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                                                                            <MapPin size={12} color="#94A3B8" />
                                                                            <Text style={{ color: '#94A3B8', fontSize: 12 }} numberOfLines={1}>{event.location}</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const EventTile = ({ calendar, onPress }: { calendar: any, onPress?: () => void }) => {
    if (!calendar.attributes.message && !calendar.attributes.all_day) return null;

    const isBirthday = calendar.entity_id.includes('birth') || calendar.entity_id.includes('geburt') || calendar.attributes.message?.toLowerCase().includes('geburtstag');
    const startTime = new Date(calendar.attributes.start_time);
    const isToday = new Date().toDateString() === startTime.toDateString();

    return (
        <Pressable onPress={onPress}>
            <View style={styles.eventCard}>
                <View style={[styles.eventIcon, isBirthday ? { backgroundColor: '#EC4899' } : { backgroundColor: '#8B5CF6' }]}>
                    {isBirthday ? <PartyPopper size={20} color="#fff" /> : <Calendar size={20} color="#fff" />}
                </View>
                <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{calendar.attributes.message || 'Termin'}</Text>
                    <Text style={styles.eventTime}>
                        {isToday ? 'Heute' : startTime.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • {calendar.attributes.all_day ? 'Ganztägig' : startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
};

// =====================================================
// MAIN DASHBOARD COMPONENT
// =====================================================

export default function Dashboard() {
    // --- Calendar Modal Logic ---
    const [calendarModal, setCalendarModal] = useState<{ visible: boolean, entityId: string, title: string, color: string }>({ visible: false, entityId: '', title: '', color: '' });

    const handleCalendarPress = (calendar: any) => {
        // Map to specific requested entities
        // Logic: if birthday (geburtstage_2), else default (stefan_gross_stibe_me)
        const isBirthday = calendar.entity_id.includes('birth') || calendar.entity_id.includes('geburt');
        const entityId = isBirthday ? 'calendar.geburtstage_2' : 'calendar.stefan_gross_stibe_me';
        const title = isBirthday ? 'Geburtstage' : 'Familien Kalender';
        const color = isBirthday ? '#EC4899' : '#00BFFF';

        setCalendarModal({ visible: true, entityId, title, color });
    };

    const { width } = useWindowDimensions();
    const isTablet = width >= 768;
    const cardWidth = isTablet ? (width - 72) / 4 : (width - 48) / 2;
    const tileWidth = isTablet ? (width - 64 - 24) / 3 : (width - 32 - 12) / 2;

    const {
        entities,
        isConnected,
        isConnecting,
        connect,
        toggleLight,
        activateScene,
        openCover,
        closeCover,
        startVacuum,
        returnVacuum,
        callService,
        getEntityPictureUrl
    } = useHomeAssistant();

    // Modal states
    const [activeModal, setActiveModal] = useState<'lights' | 'covers' | 'robi' | null>(null);

    // Filter entities
    const lights = useMemo(() => {
        const allowedLights = [
            { id: 'light.wohnzimmer', name: '🛋️ Wohnzimmer' },
            { id: 'light.essbereich', name: '🍽️ Essbereich' },
            { id: 'light.kuche', name: '🍳 Küche' },
            { id: 'light.linas_zimmer', name: "👧 Lina's Zimmer" },
            { id: 'light.levins_zimmer', name: "👦 Levin's Zimmer" },
            { id: 'light.schlafzimmer', name: '🛏️ Schlafzimmer' },
            { id: 'light.badezimmer', name: '🚿 Badezimmer' },
            { id: 'light.deckenbeleuchtung_buro', name: '🏢 Büro' },
            { id: 'light.licht_garage', name: '🚽 Gäste WC' },
        ];

        return allowedLights.map(def => {
            const entity = entities.find(e => e.entity_id === def.id);
            if (!entity) return null;
            // Override friendly name for display
            return {
                ...entity,
                attributes: {
                    ...entity.attributes,
                    friendly_name: def.name
                }
            };
        }).filter(Boolean) as any[];
    }, [entities]);

    const covers = useMemo(() => {
        const allowedCovers = [
            { id: 'cover.alle_storen', name: 'Alle Storen' },
            { id: 'cover.terrasse', name: '🪴 Terrasse' },
            { id: 'cover.wohnzimmer_sofa', name: '🛋️ Wohnzimmer' },
            { id: 'cover.wohnzimmer_spielplaetzchen', name: '🧸 Spielplätzchen' },
            { id: 'cover.essbereich', name: '🍽️ Essbereich' },
            { id: 'cover.kuche', name: '🍳 Küche' },
        ];

        return allowedCovers.map(def => {
            const entity = entities.find(e => e.entity_id === def.id);
            if (!entity) return null;
            return {
                ...entity,
                attributes: {
                    ...entity.attributes,
                    friendly_name: def.name
                }
            };
        }).filter(Boolean) as any[];
    }, [entities]);
    const vacuums = useMemo(() => entities.filter(e => e.entity_id.startsWith('vacuum.')), [entities]);
    const mediaPlayers = useMemo(() => entities.filter(e => e.entity_id.startsWith('media_player.')), [entities]);
    const climate = useMemo(() => entities.filter(e => e.entity_id.startsWith('climate.')), [entities]);
    const securityEntities = useMemo(() => {
        const locks = entities.filter(e => e.entity_id.startsWith('lock.'));
        const haustuerButton = entities.find(e => e.entity_id === 'button.hausture_tur_offnen');

        // Combine them
        const result = [...locks];
        if (haustuerButton) result.push(haustuerButton);
        return result;
    }, [entities]);
    const calendars = useMemo(() => entities.filter(e => e.entity_id.startsWith('calendar.')).filter(c => c.state === 'on' || c.attributes.message), [entities]);
    const shoppingList = useMemo(() => entities.find(e => e.entity_id === 'todo.google_keep_einkaufsliste'), [entities]);

    // --- Specific Appliance Logic ---

    // 1. Dishwasher
    const dishwasherStatus = useMemo(() => {
        const progEnde = entities.find(e => e.entity_id === 'sensor.adoradish_v2000_programm_ende');
        const prog = entities.find(e => e.entity_id === 'sensor.adoradish_v2000_programm');

        if (!progEnde && !prog) return null;

        // Check End Time
        if (progEnde && !['unknown', 'unavailable', 'None', ''].includes(progEnde.state)) {
            const endDate = new Date(progEnde.state);
            const now = new Date();
            const diffMs = endDate.getTime() - now.getTime();

            if (diffMs > 0) {
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                let timeStr = 'noch';
                if (hours > 0) timeStr += ` ${hours} Std`;
                if (minutes > 0) timeStr += ` ${minutes} Min`;
                if (hours === 0 && minutes === 0) timeStr = 'noch < 1 Min';

                return { isRunning: true, isFinished: false, text: timeStr };
            }
        }

        // Check Status
        if (prog && prog.state !== 'standby') {
            return { isRunning: true, isFinished: false, text: prog.state };
        }

        // Else Finished
        return { isRunning: false, isFinished: true, text: 'Geschirrspüler fertig!' };
    }, [entities]);

    // 2. Washing Machine
    const washerStatus = useMemo(() => {
        const progEndeRoh = entities.find(e => e.entity_id === 'sensor.adorawash_v4000_program_ende_rohwert');
        const progEnde = entities.find(e => e.entity_id === 'sensor.adorawash_v4000_programm_ende');

        if (!progEndeRoh && !progEnde) return null;

        // Check Rohwert (XhYY)
        if (progEndeRoh && !['unknown', 'unavailable', 'None', '', '0h00'].includes(progEndeRoh.state)) {
            const parts = progEndeRoh.state.split('h');
            if (parts.length === 2) {
                const hours = parseInt(parts[0]);
                const minutes = parseInt(parts[1]);
                let timeStr = 'noch';
                if (hours > 0) timeStr += ` ${hours} Std`;
                if (minutes > 0) timeStr += ` ${minutes} Min`;

                return { isRunning: true, isFinished: false, text: timeStr };
            }
        }

        // Check logic for "finished"
        if (progEnde && (progEnde.state === 'unknown' || progEnde.state === 'unavailable')) {
            return { isRunning: false, isFinished: true, text: 'Waschmaschine fertig!' };
        }

        // Else nothing (YAML didn't specify an else for Washer)
        return null;
    }, [entities]);

    // 3. Tumbler
    const tumblerStatus = useMemo(() => {
        const current = entities.find(e => e.entity_id === 'sensor.001015699ea263_current');
        if (!current) return null;

        const val = parseFloat(current.state);
        if (!isNaN(val) && val >= 12) {
            return { isRunning: true, isFinished: false, text: 'am trocknen' };
        } else {
            return { isRunning: false, isFinished: true, text: 'Tumbler fertig!' };
        }
    }, [entities]);

    // Find Röbi and Cameras
    const robi = useMemo(() => vacuums.find(v => v.entity_id.includes('robi') || v.attributes.friendly_name?.includes('Röbi')) || vacuums[0], [vacuums]);
    const mapCamera = useMemo(() => entities.find(e => e.entity_id.startsWith('camera.') && (e.entity_id.includes('map') || e.entity_id.includes('robi'))), [entities]);

    // Scripts
    const cleanScripts = useMemo(() => entities.filter(e => e.entity_id.startsWith('script.') && (e.entity_id.includes('clean') || e.entity_id.includes('reinigen'))), [entities]);
    // Try to find the Sleep/Bedtime script
    const bedTimeScript = useMemo(() => entities.find(e => e.entity_id === 'script.bed_time' || e.entity_id.includes('bed_time') || e.entity_id.includes('gute_nacht') || e.entity_id.includes('schlafen')), [entities]);

    const lightsOn = useMemo(() => lights.filter(l => l.state === 'on').length, [lights]);
    const coversOpen = useMemo(() => covers.filter(c => c.state === 'open' || (c.attributes.current_position && c.attributes.current_position > 0)).length, [covers]);
    const activeVacuums = useMemo(() => vacuums.filter(v => v.state === 'cleaning').length, [vacuums]);
    const playingMedia = useMemo(() => mediaPlayers.filter(m => m.state === 'playing').length, [mediaPlayers]);

    const currentTemp = climate[0]?.attributes.current_temperature;

    // Callbacks
    const openLightsModal = useCallback(() => setActiveModal('lights'), []);
    const openCoversModal = useCallback(() => setActiveModal('covers'), []);
    const openRobiModal = useCallback(() => setActiveModal('robi'), []);
    const closeModal = useCallback(() => setActiveModal(null), []);

    const handleAllLightsOff = useCallback(() => {
        lights.filter(l => l.state === 'on').forEach(l => callService('light', 'turn_off', l.entity_id));
    }, [lights, callService]);

    const handleAllLightsOn = useCallback(() => {
        lights.forEach(l => callService('light', 'turn_on', l.entity_id));
    }, [lights, callService]);

    const handleAllCoversClose = useCallback(() => covers.forEach(c => closeCover(c.entity_id)), [covers, closeCover]);
    const handleAllCoversOpen = useCallback(() => covers.forEach(c => openCover(c.entity_id)), [covers, openCover]);
    const handleAllVacuumsHome = useCallback(() => vacuums.forEach(v => returnVacuum(v.entity_id)), [vacuums, returnVacuum]);
    const handleRobiStart = useCallback(() => robi && startVacuum(robi.entity_id), [robi, startVacuum]);
    const handleRobiHome = useCallback(() => robi && returnVacuum(robi.entity_id), [robi, returnVacuum]);

    const handleRunScript = useCallback((entityId: string) => {
        callService('script', 'turn_on', entityId);
    }, [callService]);

    const handleSleep = useCallback(() => {
        if (bedTimeScript) {
            handleRunScript(bedTimeScript.entity_id);
            Alert.alert('Gute Nacht', 'Schlafmodus aktiviert.');
        } else {
            Alert.alert('Fehler', 'Kein "Bed Time" Script gefunden (script.bed_time)');
        }
    }, [bedTimeScript, handleRunScript]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Guten Morgen';
        if (hour < 18) return 'Guten Tag';
        return 'Guten Abend';
    };

    if (!isConnected && !isConnecting) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyState}>
                    <View style={[styles.emptyStateCard, { backgroundColor: '#1E293B' }]}>
                        <View style={styles.emptyStateIcon}>
                            <WifiOff size={48} color="#64748B" />
                        </View>
                        <Text style={styles.emptyStateTitle}>Smart Home nicht verbunden</Text>
                        <Pressable onPress={connect} style={styles.connectButton}>
                            <Text style={styles.connectButtonText}>Verbinden</Text>
                        </Pressable>
                    </View>
                </View>
                {/* Calendar Modal */}
                <CalendarModal
                    visible={calendarModal.visible}
                    onClose={() => setCalendarModal({ ...calendarModal, visible: false })}
                    entityId={calendarModal.entityId}
                    title={calendarModal.title}
                    accentColor={calendarModal.color}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? 24 : 16 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{getGreeting()}</Text>
                        <Text style={styles.dateText}>
                            {new Date().toLocaleDateString('de-DE', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long'
                            })}
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        {currentTemp && (
                            <View style={styles.tempBadge}>
                                <Thermometer size={14} color="#F59E0B" />
                                <Text style={styles.tempText}>{currentTemp}°</Text>
                            </View>
                        )}
                        {shoppingList && shoppingList.state !== '0' && shoppingList.state !== 'unknown' && (
                            <View style={[styles.tempBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                                <ShoppingCart size={14} color="#3B82F6" />
                                <Text style={[styles.tempText, { color: '#3B82F6' }]}>{shoppingList.state}</Text>
                            </View>
                        )}
                        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#22C55E' : '#EF4444' }]} />
                    </View>
                </View>

                {/* --- APPLIANCE STATUS ROW (Dynamic) --- */}
                {/* --- APPLIANCE STATUS ROW (Specific) --- */}
                {(() => {
                    const activeAppliances = [
                        { status: dishwasherStatus, label: 'Geschirrspüler', icon: UtensilsCrossed },
                        { status: washerStatus, label: 'Waschmaschine', icon: Shirt },
                        { status: tumblerStatus, label: 'Tumbler', icon: Wind },
                    ].filter(item => item.status !== null);

                    if (activeAppliances.length === 0) return null;

                    return (
                        <View style={[styles.applianceRow, { marginBottom: 16, flexDirection: 'row' }]}>
                            {activeAppliances.map((app, index) => (
                                <View key={index} style={{ flex: 1 }}>
                                    <SpecificApplianceTile
                                        label={app.label}
                                        icon={app.icon}
                                        statusText={app.status!.text}
                                        isRunning={app.status!.isRunning}
                                        isFinished={app.status!.isFinished}
                                        compact={true}
                                    />
                                </View>
                            ))}
                        </View>
                    );
                })()}




                {/* --- EXTRA INFOS (Security: Locks & Haustüre) --- */}
                {(securityEntities.length > 0 || calendars.length > 0) && (
                    <View style={styles.infoRow}>
                        {/* Security Section */}
                        {securityEntities.length > 0 && (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {securityEntities.map(item => (
                                    <View key={item.entity_id} style={{ flex: 1 }}>
                                        {item.entity_id.startsWith('lock.') ? (
                                            <LockTile lock={item} callService={callService} />
                                        ) : (
                                            <DoorOpenerTile entity={item} callService={callService} />
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {calendars.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitleSmall}>Nächste Termine</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                            {calendars.map(calendar => (
                                <EventTile key={calendar.entity_id} calendar={calendar} onPress={() => handleCalendarPress(calendar)} />
                            ))}
                        </ScrollView>
                    </View>
                )}


                {/* Hero Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Übersicht</Text>
                    <View style={styles.heroGrid}>
                        <HeroStatCard
                            icon={Lightbulb}
                            iconColor="#FCD34D"
                            value={lightsOn}
                            total={lights.length}
                            label="Lichter aktiv"
                            gradient={['#F59E0B', '#D97706']}
                            isActive={lightsOn > 0}
                            cardWidth={cardWidth}
                            onPress={openLightsModal}
                            onLongPress={handleAllLightsOff}
                        />
                        <HeroStatCard
                            icon={Blinds}
                            iconColor="#60A5FA"
                            value={coversOpen}
                            total={covers.length}
                            label="Rollläden offen"
                            gradient={['#3B82F6', '#1D4ED8']}
                            isActive={coversOpen > 0}
                            cardWidth={cardWidth}
                            onPress={openCoversModal}
                            onLongPress={handleAllCoversClose}
                        />
                        <HeroStatCard
                            icon={Bot}
                            iconColor="#34D399"
                            value={activeVacuums}
                            total={vacuums.length}
                            label="Röbi"
                            gradient={['#10B981', '#059669']}
                            isActive={activeVacuums > 0}
                            cardWidth={cardWidth}
                            onPress={openRobiModal}
                            onLongPress={handleAllVacuumsHome}
                        />
                        <HeroStatCard
                            icon={Tv}
                            iconColor="#A78BFA"
                            value={playingMedia}
                            total={mediaPlayers.length}
                            label="Wiedergabe"
                            gradient={['#8B5CF6', '#6D28D9']}
                            isActive={playingMedia > 0}
                            cardWidth={cardWidth}
                        />
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Schnellaktionen</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
                        <QuickAction icon={Moon} iconColor="#FBBF24" label="Alles aus" onPress={handleAllLightsOff} gradient={['rgba(251,191,36,0.15)', 'rgba(251,191,36,0.05)']} />
                        <QuickAction icon={Blinds} iconColor="#60A5FA" label="Rollläden auf" onPress={handleAllCoversOpen} gradient={['rgba(96, 165, 250,0.15)', 'rgba(96, 165, 250,0.05)']} />
                        <QuickAction icon={Blinds} iconColor="#3B82F6" label="Rollläden zu" onPress={handleAllCoversClose} gradient={['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.05)']} />
                        <QuickAction icon={Bot} iconColor="#22C55E" label="Röbi Start" onPress={handleRobiStart} gradient={['rgba(34,197,94,0.15)', 'rgba(34,197,94,0.05)']} />
                        <QuickAction icon={BedDouble} iconColor="#8B5CF6" label="Schlafen" onPress={handleSleep} gradient={['rgba(139, 92, 246,0.15)', 'rgba(139, 92, 246,0.05)']} />
                    </ScrollView>
                </View>

            </ScrollView>

            {/* LIGHTS MODAL */}
            <Modal visible={activeModal === 'lights'} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalHeader, { backgroundColor: '#F59E0B' }]}>
                            <Text style={styles.modalTitle}>Lichter ({lightsOn} an)</Text>
                            <Pressable onPress={closeModal} style={styles.closeBtn}><X size={24} color="#fff" /></Pressable>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.modalGrid}>
                                {lights.map(l => (
                                    <View key={l.entity_id} style={{ width: tileWidth }}>
                                        <Tile
                                            label={l.attributes.friendly_name?.replace(' Licht', '').replace(' Lampen', '') || l.entity_id}
                                            subtext={l.state === 'on' ? 'An' : 'Aus'}
                                            icon={Lightbulb}
                                            iconColor="#64748B"
                                            activeColor="#FBBF24"
                                            isActive={l.state === 'on'}
                                            onPress={() => toggleLight(l.entity_id)}
                                        />
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* COVERS MODAL */}
            <Modal visible={activeModal === 'covers'} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalHeader, { backgroundColor: '#3B82F6' }]}>
                            <Text style={styles.modalTitle}>Rollläden ({coversOpen} offen)</Text>
                            <Pressable onPress={closeModal} style={styles.closeBtn}><X size={24} color="#fff" /></Pressable>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.modalGrid}>
                                {covers.map(c => (
                                    <View key={c.entity_id} style={{ width: tileWidth }}>
                                        <Tile
                                            label={c.attributes.friendly_name || c.entity_id}
                                            subtext={c.attributes?.current_position != null ? `${c.attributes?.current_position}%` : c.state}
                                            icon={Blinds}
                                            iconColor="#64748B"
                                            activeColor="#3B82F6"
                                            isActive={c.state === 'open' || c.attributes.current_position > 0}
                                            activeStyle={styles.tileActiveCover}
                                        >
                                            <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                                                <Pressable onPress={() => openCover(c.entity_id)} style={styles.miniBtn}><Text style={styles.miniBtnText}>↑</Text></Pressable>
                                                <Pressable onPress={() => closeCover(c.entity_id)} style={styles.miniBtn}><Text style={styles.miniBtnText}>↓</Text></Pressable>
                                            </View>
                                        </Tile>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* RÖBI MODAL */}
            <RobiVacuumModal
                visible={activeModal === 'robi'}
                onClose={closeModal}
            />

            {/* Calendar Modal */}
            <CalendarModal
                visible={calendarModal.visible}
                onClose={() => setCalendarModal({ ...calendarModal, visible: false })}
                entityId={calendarModal.entityId}
                title={calendarModal.title}
                accentColor={calendarModal.color}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    scrollView: { flex: 1 },
    scrollContent: { paddingTop: 12, paddingBottom: 32 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    greeting: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
    dateText: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tempBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
    tempText: { color: '#F59E0B', fontWeight: '600', fontSize: 14 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyStateCard: { width: '100%', maxWidth: 320, borderRadius: 28, padding: 32, alignItems: 'center' },
    emptyStateIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    emptyStateTitle: { color: '#fff', fontSize: 20, fontWeight: '600', textAlign: 'center' },
    connectButton: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 24 },
    connectButtonText: { color: '#fff', fontWeight: '600' },
    section: { marginBottom: 28 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 },
    sectionTitleSmall: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 12 },
    heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    heroCard: { borderRadius: 24, overflow: 'hidden', height: 140 },
    heroCardGradient: { padding: 16, height: '100%', justifyContent: 'space-between' },
    decorativeCircle: { position: 'absolute', width: 120, height: 120, borderRadius: 60, top: -40, right: -40 },
    heroCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconBubble: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    heroCardContent: { marginTop: 'auto' },
    valueRow: { flexDirection: 'row', alignItems: 'baseline' },
    heroValue: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
    heroTotal: { fontSize: 18, color: 'rgba(255,255,255,0.5)', marginLeft: 2 },
    heroLabel: { fontSize: 12, marginTop: 2 },
    progressContainer: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 2 },
    quickActionsRow: { paddingRight: 16, gap: 12 },
    quickAction: { alignItems: 'center', width: 72 },
    quickActionGradient: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    quickActionLabel: { color: '#94A3B8', fontSize: 11, marginTop: 8, textAlign: 'center' },

    // Appliances (Dynamic Row)
    applianceRow: { gap: 8 },
    applianceStatusCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    applianceStatusCardCompact: { flexDirection: 'column', paddingHorizontal: 4, paddingVertical: 12, justifyContent: 'center', flex: 1 },
    applianceRunning: { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: '#3B82F6' },
    applianceFinished: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10B981' },
    applianceStatusIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    applianceInfo: { flex: 1 },
    applianceName: { color: '#fff', fontSize: 14, fontWeight: '600' },
    applianceTime: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
    finishedBadge: { backgroundColor: '#10B981', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    finishedText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    // Info Row (Locks & Events)
    infoRow: { marginBottom: 28 },
    lockCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, backgroundColor: '#1E293B', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', flex: 1 },
    lockCardOpen: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.4)' },
    lockMainAction: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    lockIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    lockInfo: { flex: 1 },
    lockTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    lockState: { color: '#94A3B8', fontSize: 12, marginTop: 2, fontWeight: '600', letterSpacing: 1 },
    // Open Button specific
    openDoorBtn: { padding: 8, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 16, marginLeft: 8 },
    openDoorText: { color: '#3B82F6', fontSize: 10, fontWeight: '600', marginTop: 4 },

    eventCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', width: 260, marginRight: 12 },
    eventIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    eventInfo: { flex: 1 },
    eventTitle: { color: '#fff', fontWeight: '600', fontSize: 14, marginBottom: 4 },
    eventTime: { color: '#94A3B8', fontSize: 12 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: '#000' },
    modalContent: { flex: 1, backgroundColor: '#020617' },
    modalHeader: { paddingVertical: 24, paddingHorizontal: 20, paddingTop: 60, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
    modalBody: { flex: 1, padding: 16 },
    modalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tile: { backgroundColor: '#1E293B', borderRadius: 20, padding: 16, minHeight: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', justifyContent: 'space-between' },
    tileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    tileIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
    tileState: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginTop: 4 },
    tileName: { fontSize: 15, fontWeight: '600', color: '#CBD5E1', marginTop: 12 },
    tileActiveCover: { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.5)' },
    miniBtn: { flex: 1, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    miniBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Röbi (Replaced by component, styles cleaned)
    robiContent: {},
    errorText: { color: '#EF4444', textAlign: 'center', marginTop: 24 },
});

import { useRouter } from 'expo-router';
import React, { useMemo, useState, useCallback, memo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, Modal, StyleSheet, Image, ActivityIndicator, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Lightbulb, Blinds, Thermometer, Droplets, Wind, Lock, Unlock, Zap, Music, Play, Pause, SkipForward, SkipBack, Bot, PartyPopper, Calendar, CloudRain, Cloud, Sun, Moon, ShoppingCart, Info, Loader2, UtensilsCrossed, Shirt, Clapperboard, BedDouble, ChevronRight, Shield, LucideIcon, DoorOpen, DoorClosed, WifiOff, Tv, X, Wifi, RefreshCw, Power, Battery, PlayCircle, Home, Map, MapPin, Fan, Clock, Video } from 'lucide-react-native';
import SecurityModal from '../../components/SecurityModal';
import { WHITELISTED_PLAYERS } from '../../config/mediaPlayers';
import { filterSecurityEntities } from '../../utils/securityHelpers';
import CamerasModal from '../../components/CamerasModal';
// LinearGradient removed to fix compatibility issue

// =====================================================
// CHILD COMPONENTS
// =====================================================
import RobiVacuumModal from '../../components/RobiVacuumModal';
import CalendarModal from '../../components/CalendarModal';
import ShoppingListModal from '../../components/ShoppingListModal';
import WeatherForecastModal from '../../components/WeatherForecastModal';
import HeaderClock from '../../components/HeaderClock';
import ActionFeedbackModal from '../../components/ActionFeedbackModal';
import QuickActionInfoModal, { QuickActionInfo } from '../../components/QuickActionInfoModal';

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
    statusText?: string;
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
    onLongPress,
    statusText
}: HeroStatCardProps) => {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.heroCard, { width: cardWidth, backgroundColor: colors.card }]} // Override Logic
        >
            <View style={[styles.heroCardGradient, { backgroundColor: isActive ? gradient[0] : colors.card }]}>
                <View style={[styles.decorativeCircle, { backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : colors.border + '30' }]} />

                <View style={styles.heroCardHeader}>
                    <View style={[styles.iconBubble, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.background }]}>
                        <Icon size={22} color={isActive ? '#fff' : iconColor} />
                    </View>
                    <ChevronRight size={16} color={isActive ? "rgba(255,255,255,0.3)" : colors.subtext} />
                </View>

                <View style={styles.heroCardContent}>
                    <View style={styles.valueRow}>
                        {statusText ? (
                            <Text style={[styles.heroValue, { fontSize: 18, color: isActive ? '#fff' : colors.text }]} numberOfLines={1}>{statusText}</Text>
                        ) : (
                            <>
                                <Text style={[styles.heroValue, { color: isActive ? '#fff' : colors.text }]}>{value}</Text>
                                <Text style={[styles.heroTotal, { color: isActive ? 'rgba(255,255,255,0.5)' : colors.subtext }]}>/{total}</Text>
                            </>
                        )}
                    </View>
                    <Text style={[styles.heroLabel, { color: isActive ? 'rgba(255,255,255,0.8)' : colors.subtext }]}>
                        {label}
                    </Text>
                </View>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, {
                        width: statusText ? (isActive ? '100%' : '0%') : `${total > 0 ? (value / total) * 100 : 0}%`,
                        backgroundColor: isActive ? 'rgba(255,255,255,0.4)' : colors.border
                    }]} />
                </View>
            </View>
        </Pressable>
    )
});

interface QuickActionProps {
    icon: LucideIcon;
    iconColor: string;
    label: string;
    onPress: () => void;
    onLongPress?: () => void;
    gradient: [string, string];
}

const QuickAction = memo(({
    icon: Icon,
    iconColor,
    label,
    onPress,
    onLongPress,
    gradient
}: QuickActionProps) => {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={800}
            style={({ pressed }) => [
                styles.quickAction,
                { opacity: pressed ? 0.7 : 1 }
            ]}
        >
            <View style={[styles.quickActionGradient, { backgroundColor: gradient[0], borderColor: colors.border }]}>
                <Icon size={20} color={iconColor} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.subtext }]}>{label}</Text>
        </Pressable>
    )
});

const Tile = ({ label, subtext, icon: Icon, iconColor, activeColor, isActive, onPress, children, activeStyle }: any) => {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.tile,
                { backgroundColor: colors.card, borderColor: colors.border },
                isActive && { backgroundColor: activeColor + '15', borderColor: activeColor + '50' },
                activeStyle
            ]}
        >
            <View style={styles.tileHeader}>
                <View style={[styles.tileIcon, { backgroundColor: isActive ? activeColor : colors.background }, isActive ? {} : {}]}>
                    <Icon size={20} color={isActive ? '#FFF' : iconColor} />
                </View>
                <Text style={[styles.tileState, { color: colors.subtext }, isActive && { color: activeColor }]}>
                    {subtext}
                </Text>
            </View>
            <Text numberOfLines={1} style={[styles.tileName, { color: colors.text }, isActive && { color: '#FFF' }]}>{label}</Text>
            {children}
        </Pressable>
    )
};

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

const LockTile = ({ lock, callService, entities }: { lock: any, callService: any, entities?: any[] }) => {
    const isLocked = lock.state === 'locked';
    const isUnlocked = lock.state === 'unlocked';
    const isJammed = lock.state === 'jammed';

    // Animation for blinking effect
    const blinkAnim = React.useRef(new Animated.Value(1)).current;

    // Check if this is the Nuki Wohnungstüre
    const isNukiWohnung = lock.entity_id === 'lock.nuki_wohnungsture_lock';

    // Get door sensor state for Wohnungstüre
    const doorSensor = entities?.find(e => e.entity_id === 'binary_sensor.wohnungsture_tur');
    const isDoorOpen = doorSensor?.state === 'on';

    let friendlyName = lock.attributes.friendly_name || 'Haustür';
    if (friendlyName.toLowerCase().includes('smart lock') || friendlyName.toLowerCase().includes('nuki')) {
        friendlyName = 'Wohnungstüre';
    }

    // Blinking animation when door is open
    React.useEffect(() => {
        if (isDoorOpen && isNukiWohnung) {
            const blink = Animated.loop(
                Animated.sequence([
                    Animated.timing(blinkAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
                    Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ])
            );
            blink.start();
            return () => blink.stop();
        } else {
            blinkAnim.setValue(1);
        }
    }, [isDoorOpen, isNukiWohnung]);

    // Get status text based on lock and door sensor state
    const getStatusText = () => {
        if (isNukiWohnung) {
            if (isDoorOpen) return 'GEÖFFNET';
            if (isJammed) return 'KLEMMT';
            if (isUnlocked) return 'ENTRIEGELT';
            return 'VERRIEGELT';
        }
        // Default for other locks
        return isJammed ? 'KLEMMT' : isUnlocked ? 'OFFEN' : 'GESCHLOSSEN';
    };

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

    const handleLockAction = () => {
        // Check if this is the front door (Haustür)
        const isHaustuer = lock.entity_id.includes('haustuer') || lock.entity_id.includes('haustür') || (lock.attributes.friendly_name && lock.attributes.friendly_name.toLowerCase().includes('haustür'));

        if (isHaustuer) {
            Alert.alert('Tür öffnen', `Möchtest du die Haustür öffnen?`, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'ÖFFNEN', style: 'destructive', onPress: () => callService('button', 'press', 'button.hausture_tur_offnen') }
            ]);
        } else if (isNukiWohnung) {
            // Dynamic action based on current state
            if (isUnlocked) {
                Alert.alert('Tür verriegeln', `Möchtest du ${friendlyName} verriegeln?`, [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'VERRIEGELN', onPress: () => callService('lock', 'lock', lock.entity_id) }
                ]);
            } else {
                Alert.alert('Tür entriegeln', `Möchtest du ${friendlyName} entriegeln?`, [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'ENTRIEGELN', style: 'destructive', onPress: () => callService('lock', 'unlock', lock.entity_id) }
                ]);
            }
        } else {
            Alert.alert('Tür öffnen', `Möchtest du die Falle von ${friendlyName} ziehen (Tür öffnen)?`, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'ÖFFNEN', style: 'destructive', onPress: () => callService('lock', 'unlock', lock.entity_id) }
            ]);
        }
    };

    // Determine button text and icon based on state (for Nuki Wohnung)
    const getButtonText = () => {
        if (isNukiWohnung) {
            return isUnlocked ? 'Verriegeln' : 'Entriegeln';
        }
        return 'Öffnen';
    };

    const getButtonIcon = () => {
        if (isNukiWohnung) {
            return isUnlocked ? <Lock size={20} color="#3B82F6" /> : <Unlock size={20} color="#3B82F6" />;
        }
        return <DoorOpen size={20} color="#3B82F6" />;
    };

    // Determine card style based on state
    const getCardStyle = () => {
        if (isDoorOpen && isNukiWohnung) return { borderColor: '#F97316', borderWidth: 2 }; // Orange for open door
        if (isUnlocked) return styles.lockCardOpen;
        return {};
    };

    // Determine icon background color
    const getIconBgColor = () => {
        if (isDoorOpen && isNukiWohnung) return '#F97316'; // Orange
        if (isUnlocked) return '#EF4444'; // Red
        return '#10B981'; // Green
    };

    return (
        <Animated.View style={[styles.lockCard, getCardStyle(), { opacity: isDoorOpen && isNukiWohnung ? blinkAnim : 1 }]}>
            <Pressable onPress={toggleLock} style={styles.lockMainAction}>
                <View style={[styles.lockIcon, { backgroundColor: getIconBgColor() }]}>
                    {isDoorOpen && isNukiWohnung ? <DoorOpen size={24} color="#fff" /> :
                        isUnlocked ? <Unlock size={24} color="#fff" /> : <Lock size={24} color="#fff" />}
                </View>
                <View style={[styles.lockInfo, isNukiWohnung && { justifyContent: 'center', flex: 1 }]}>
                    {!isNukiWohnung && (
                        <Text style={[styles.lockTitle, (isUnlocked || isDoorOpen) && { color: isDoorOpen ? '#F97316' : '#EF4444' }]}>
                            {friendlyName}
                        </Text>
                    )}
                    <Text style={[
                        styles.lockState,
                        isNukiWohnung && { textAlign: 'center', width: '100%' },
                        isDoorOpen && isNukiWohnung && { color: '#F97316', fontWeight: 'bold' }
                    ]}>
                        {getStatusText()}
                    </Text>
                </View>
            </Pressable>

            {/* Dynamic Lock/Unlock Button */}
            <Pressable onPress={handleLockAction} style={styles.openDoorBtn}>
                {getButtonIcon()}
                <Text style={styles.openDoorText}>{getButtonText()}</Text>
            </Pressable>
        </Animated.View>
    )
};

const SecuritySensorTile = ({ entity }: { entity: any }) => {
    const { colors } = useTheme();
    let friendlyName = entity.attributes.friendly_name || "Sensor";
    // Clean up names
    friendlyName = friendlyName.replace(' Kontakt', '').replace(' Sensor', '');

    const isDoorOpen = entity.state === 'on';

    return (
        <View style={[styles.lockCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.lockMainAction}>
                <View style={[styles.lockIcon, { backgroundColor: isDoorOpen ? '#EF4444' : '#10B981' }]}>
                    {isDoorOpen ? <DoorOpen size={24} color="#fff" /> : <DoorClosed size={24} color="#fff" />}
                </View>
                <View style={[styles.lockInfo, { justifyContent: 'center', flex: 1 }]}>
                    <Text style={[styles.lockTitle, { color: colors.text }, isDoorOpen && { color: '#EF4444' }]} numberOfLines={1}>
                        {friendlyName}
                    </Text>
                    <Text style={[styles.lockState, { color: isDoorOpen ? '#EF4444' : colors.subtext }]}>
                        {isDoorOpen ? 'OFFEN' : 'GESCHLOSSEN'}
                    </Text>
                </View>
            </View>
        </View>
    );
};



const EventTile = ({ calendar, onPress }: { calendar: any, onPress?: () => void }) => {
    const { colors } = useTheme();
    if (!calendar.attributes.message && !calendar.attributes.all_day) return null;

    const isBirthday = calendar.entity_id.includes('birth') || calendar.entity_id.includes('geburt') || calendar.attributes.message?.toLowerCase().includes('geburtstag');
    const startTime = new Date(calendar.attributes.start_time);
    const now = new Date();

    // Reset time components for accurate date diff
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());

    const isToday = today.getTime() === eventDate.getTime();

    // Calculate days until
    const diffTime = Math.abs(eventDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.eventCard, { backgroundColor: colors.card }]}>
                <View style={[styles.eventIcon, isBirthday ? { backgroundColor: '#EC4899' } : { backgroundColor: '#8B5CF6' }]}>
                    {isBirthday ? <PartyPopper size={20} color="#fff" /> : <Calendar size={20} color="#fff" />}
                </View>
                <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{calendar.attributes.message || 'Termin'}</Text>
                    <Text style={[styles.eventTime, { color: colors.subtext }]}>
                        {isToday ? 'Heute' : startTime.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • {
                            isBirthday
                                ? (isToday ? 'Heute' : `In ${diffDays} Tagen`)
                                : (calendar.attributes.all_day ? 'Ganztägig' : startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
                        }
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
    const router = useRouter();
    const { colors } = useTheme();
    // --- Calendar Modal Logic ---
    const [calendarModal, setCalendarModal] = useState<{ visible: boolean, entityId: string, title: string, color: string }>({ visible: false, entityId: '', title: '', color: '' });
    const [showShoppingList, setShowShoppingList] = useState(false);
    const [showWeatherForecast, setShowWeatherForecast] = useState(false);
    const [activeFeedback, setActiveFeedback] = useState<'sleep' | 'morning' | 'movie' | 'covers_open' | 'covers_close' | 'vacuum' | 'shop_debug' | null>(null);
    const [quickActionInfo, setQuickActionInfo] = useState<QuickActionInfo | null>(null);

    const handleCalendarPress = (calendar: any) => {
        // Logic: if birthday (geburtstage_2), else use the clicked calendar's ID
        const isBirthday = calendar.entity_id.includes('birth') || calendar.entity_id.includes('geburt');

        const entityId = isBirthday ? 'calendar.geburtstage_2' : calendar.entity_id;
        // Override title to "Familienkalender" for the main calendar
        const title = isBirthday ? 'Geburtstage' : 'Familienkalender';
        const color = isBirthday ? '#EC4899' : '#00BFFF';

        console.log('Opening Calendar:', { entityId, title }); // Debugging
        setCalendarModal({ visible: true, entityId, title, color });
    };

    const { width } = useWindowDimensions();
    const isTablet = width >= 768;
    // Fix: Tablet calculation needs to account for 3 gaps of 12px (36) + 48px padding = 84px total deduction
    const cardWidth = isTablet ? (width - 84) / 4 : (width - 48) / 2;
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
        getEntityPictureUrl,
        shoppingListVisible,
        setShoppingListVisible,
        startShoppingGeofencing,
        debugShoppingLogic
    } = useHomeAssistant();

    // Start Shopping Geofencing on Mount
    useEffect(() => {
        startShoppingGeofencing();
    }, []);

    // Modal states
    const [activeModal, setActiveModal] = useState<'lights' | 'covers' | 'robi' | 'security' | 'cameras' | null>(null);

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
        ].sort((a, b) => {
            // Extract name after emoji (skip first 2-3 chars which are emoji)
            const nameA = a.name.slice(a.name.indexOf(' ') + 1).toLowerCase();
            const nameB = b.name.slice(b.name.indexOf(' ') + 1).toLowerCase();
            return nameA.localeCompare(nameB, 'de');
        });

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
            { id: 'cover.kuche', name: '🍳 Küche' },
            { id: 'cover.ogp_3900159', name: '🍳 Küche Balkon' },
            { id: 'cover.essbereich', name: '🍽️ Essbereich' },
            { id: 'cover.wohnzimmer_spielplaetzchen', name: '🧸 Spielplätzchen' },
            { id: 'cover.terrasse', name: '🪴 Terrasse' },
            { id: 'cover.wohnzimmer_sofa', name: '🛋️ Wohnzimmer' },
        ].sort((a, b) => {
            // "Alle Storen" always first, then alphabetically
            if (a.name === 'Alle Storen') return -1;
            if (b.name === 'Alle Storen') return 1;
            // Extract name after emoji (skip first space)
            const nameA = a.name.includes(' ') ? a.name.slice(a.name.indexOf(' ') + 1).toLowerCase() : a.name.toLowerCase();
            const nameB = b.name.includes(' ') ? b.name.slice(b.name.indexOf(' ') + 1).toLowerCase() : b.name.toLowerCase();
            return nameA.localeCompare(nameB, 'de');
        });

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
    const mediaPlayers = useMemo(() => {
        return entities.filter(e => e.entity_id.startsWith('media_player.') && WHITELISTED_PLAYERS.includes(e.entity_id));
    }, [entities]);
    const climate = useMemo(() => entities.filter(e => e.entity_id.startsWith('climate.')), [entities]);
    // securityEntities is now defined later using the helper
    const calendars = useMemo(() => entities.filter(e => e.entity_id.startsWith('calendar.')).filter(c => c.state === 'on' || c.attributes.message), [entities]);
    const shoppingList = useMemo(() => entities.find(e => e.entity_id === 'todo.google_keep_einkaufsliste'), [entities]);

    // --- Specific Appliance Logic ---

    // 1. Dishwasher
    const dishwasherStatus = useMemo(() => {
        const progEnde = entities.find(e => e.entity_id === 'sensor.adoradish_v2000_programm_ende');
        const prog = entities.find(e => e.entity_id === 'sensor.adoradish_v2000_programm');

        if (!progEnde && !prog) return null;

        // Check End Time - only if we have a valid future timestamp
        if (progEnde && progEnde.state && !['unknown', 'unavailable', 'None', ''].includes(progEnde.state)) {
            const endDate = new Date(progEnde.state);
            const now = new Date(); // Re-use this line to match existing code structure for replacement

            // Validate date
            if (!isNaN(endDate.getTime())) {
                const diffMs = endDate.getTime() - now.getTime();

                if (diffMs > 0) {
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    let timeStr = 'noch';
                    if (hours > 0) timeStr += ` ${hours} Std`;
                    if (minutes > 0) timeStr += ` ${minutes} Min`;
                    if (hours === 0 && minutes === 0) timeStr = 'noch < 1 Min';

                    return { isRunning: true, isFinished: false, text: timeStr };
                } else {
                    // Time is past → Finished!
                    return { isRunning: false, isFinished: true, text: 'Fertig' };
                }
            }
        }

        // Check Status - if program is not standby and not unavailable, it's running
        if (prog && prog.state && !['standby', 'unknown', 'unavailable', 'None', ''].includes(prog.state)) {
            return { isRunning: true, isFinished: false, text: prog.state };
        }

        // If program is standby or end time is in the past or unavailable → finished
        return { isRunning: false, isFinished: true, text: 'Fertig' };
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
    const coversOpen = useMemo(() => covers.filter(c => (c.attributes.friendly_name !== 'Alle Storen') && (c.state === 'open' || (c.attributes.current_position && c.attributes.current_position > 0))).length, [covers]);
    const activeVacuums = useMemo(() => vacuums.filter(v => v.state === 'cleaning').length, [vacuums]);
    const playingMedia = useMemo(() => mediaPlayers.filter(m => m.state === 'playing').length, [mediaPlayers]);
    const shoppingListCount = useMemo(() => {
        if (!shoppingList || isNaN(parseInt(shoppingList.state))) return 0;
        return parseInt(shoppingList.state);
    }, [shoppingList]);

    const securityEntities = useMemo(() => {
        return filterSecurityEntities(entities);
    }, [entities]);

    const doorsOpen = useMemo(() => {
        return securityEntities.filter(e => e.state === 'on').length;
    }, [securityEntities]);

    const camerasCount = useMemo(() => {
        return entities.filter(e => {
            if (!e.entity_id.startsWith('camera.') || e.attributes.hidden) return false;
            // Exclude Map and Röbi cameras
            const id = e.entity_id.toLowerCase();
            const name = (e.attributes.friendly_name || '').toLowerCase();
            return !id.includes('map') && !id.includes('robi') && !name.includes('map') && !name.includes('röbi');
        }).length;
    }, [entities]);

    // Find Alarm Entity
    const alarmEntity = useMemo(() => {
        return entities.find(e => e.entity_id.startsWith('alarm_control_panel.')) || null;
    }, [entities]);

    const alarmStatusText = useMemo(() => {
        if (!alarmEntity) return 'N/A';
        switch (alarmEntity.state) {
            case 'armed_home': return 'Scharf (Home)';
            case 'armed_away': return 'Scharf (Away)';
            case 'disarmed': return 'Unscharf';
            case 'triggered': return 'ALARM!';
            case 'arming': return 'Aktivierung...';
            case 'pending': return 'Verzögerung...';
            default: return 'Unbekannt';
        }
    }, [alarmEntity]);

    const weatherStationTemp = useMemo(() => entities.find(e => e.entity_id === 'sensor.wetterstation_actual_temperature'), [entities]);
    const weatherZell = useMemo(() => entities.find(e => e.entity_id === 'weather.zell_lu' || e.attributes.friendly_name?.toLowerCase().includes('zell')), [entities]);
    const meteoAlarm = useMemo(() => entities.find(e => e.entity_id === 'binary_sensor.meteoalarm' || e.entity_id.includes('meteoalarm')), [entities]);

    // Use weather.familie_gross for forecast data (user requested)
    const weatherFamilieGross = useMemo(() => entities.find(e => e.entity_id === 'weather.familie_gross'), [entities]);
    const weatherMeteo = useMemo(() => entities.find(e => e.entity_id === 'weather.meteo'), [entities]);

    // Composite Weather Entity: Use Zell for current state, Familie Gross for Forecast
    const weatherComposite = useMemo(() => {
        // Prefer Meteo, then Familie Gross, fallback to Zell
        return weatherMeteo || weatherFamilieGross || weatherZell;
    }, [weatherZell, weatherFamilieGross, weatherMeteo]);

    // Format Weather Status (German)
    const getWeatherText = (state: string) => {
        const mapping: Record<string, string> = {
            'clear-night': 'Klar',
            'cloudy': 'Bewölkt',
            'fog': 'Nebel',
            'hail': 'Hagel',
            'lightning': 'Gewitter',
            'lightning-rainy': 'Gewitter',
            'partlycloudy': 'Teils bewölkt',
            'pouring': 'Starkregen',
            'rainy': 'Regnerisch',
            'snowy': 'Schnee',
            'snowy-rainy': 'Schneeregen',
            'sunny': 'Sonnig',
            'windy': 'Windig',
            'exceptional': 'Warnung',
        };
        return mapping[state] || state;
    };

    // Get Icon based on state
    const getWeatherIcon = (state: string) => {
        switch (state) {
            case 'sunny': return Sun;
            case 'clear-night': return Moon;
            case 'partlycloudy': return CloudRain; // Lucide doesn't have partial cloud perfectly, generic cloud or sun-cloud
            case 'cloudy': return CloudRain;
            case 'rainy': return CloudRain;
            case 'pouring': return CloudRain;
            case 'fog': return Wind;
            case 'snowy': return CloudRain;
            case 'windy': return Wind;
            default: return Sun;
        }
    };

    const WeatherIcon = weatherComposite ? getWeatherIcon(weatherComposite.state) : Sun;

    const isWeatherWarning = weatherComposite?.state?.toLowerCase() === 'exceptional' || meteoAlarm?.state === 'on';

    // Callbacks
    const openLightsModal = useCallback(() => setActiveModal('lights'), []);
    const openCoversModal = () => setActiveModal('covers');
    const openRobiModal = () => setActiveModal('robi');

    const openSecurityModal = () => setActiveModal('security');
    const openCamerasModal = () => setActiveModal('cameras');
    const closeModal = () => setActiveModal(null);

    const handleAllLightsOff = useCallback(() => {
        lights.filter(l => l.state === 'on').forEach(l => callService('light', 'turn_off', l.entity_id));
    }, [lights, callService]);

    const handleAllLightsOn = useCallback(() => {
        lights.forEach(l => callService('light', 'turn_on', l.entity_id));
    }, [lights, callService]);

    const handleAllCoversClose = useCallback(() => {
        covers.forEach(c => closeCover(c.entity_id));
        setActiveFeedback('covers_close');
    }, [covers, closeCover]);

    const handleAllCoversOpen = useCallback(() => {
        covers.forEach(c => openCover(c.entity_id));
        setActiveFeedback('covers_open');
    }, [covers, openCover]);

    const handleAllVacuumsHome = useCallback(() => vacuums.forEach(v => returnVacuum(v.entity_id)), [vacuums, returnVacuum]);

    const handleRobiStart = useCallback(() => {
        if (robi) {
            startVacuum(robi.entity_id);
            setActiveFeedback('vacuum');
        }
    }, [robi, startVacuum]);

    const handleRobiHome = useCallback(() => robi && returnVacuum(robi.entity_id), [robi, returnVacuum]);

    const handleRunScript = useCallback((entityId: string) => {
        callService('script', 'turn_on', entityId);
    }, [callService]);

    const handleSleep = useCallback(() => {
        // Direct call to script.bed_time as requested
        callService('script', 'turn_on', 'script.bed_time');
        setActiveFeedback('sleep');
    }, [callService]);

    const handleMorning = useCallback(() => {
        callService('script', 'turn_on', 'script.morgenroutine');
        setActiveFeedback('morning');
    }, [callService]);

    const handleMovieNight = useCallback(() => {
        callService('script', 'turn_on', 'script.movie_night');
        setActiveFeedback('movie');
    }, [callService]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Guten Morgen';
        if (hour < 18) return 'Guten Tag';
        return 'Guten Abend';
    };

    if (!isConnected && !isConnecting) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Background Image Layer */}
                {colors.backgroundImage && (
                    <View style={StyleSheet.absoluteFill}>
                        <Image
                            source={colors.backgroundImage}
                            style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: 1 }}
                            blurRadius={0}
                        />
                    </View>
                )}
                <View style={[styles.emptyState, { backgroundColor: 'transparent' }]}>
                    <View style={[styles.emptyStateCard, { backgroundColor: colors.card }]}>
                        <View style={[styles.emptyStateIcon, { backgroundColor: colors.background }]}>
                            <WifiOff size={48} color={colors.subtext} />
                        </View>
                        <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Smart Home nicht verbunden</Text>
                        <Pressable onPress={connect} style={[styles.connectButton, { backgroundColor: colors.accent }]}>
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
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Background Image Layer */}
            {colors.backgroundImage && (
                <View style={StyleSheet.absoluteFill}>
                    <Image
                        source={colors.backgroundImage}
                        style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: 1 }}
                        blurRadius={0}
                    />
                </View>
            )}

            <ScrollView
                style={[styles.scrollView, { backgroundColor: 'transparent' }]}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? 24 : 16 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.greeting, { color: colors.text }]}>{getGreeting()}</Text>
                        <Text style={[styles.dateText, { color: colors.subtext }]}>
                            {new Date().toLocaleDateString('de-DE', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long'
                            })}
                        </Text>
                    </View>
                    {isTablet && (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <HeaderClock />
                        </View>
                    )}

                    <View style={styles.headerRight}>
                        {weatherComposite && (
                            <Pressable
                                onPress={() => setShowWeatherForecast(true)}
                                style={[
                                    styles.tempBadge,
                                    isWeatherWarning
                                        ? { backgroundColor: colors.error + '33', borderWidth: 1, borderColor: colors.error }
                                        : { backgroundColor: colors.success + '26', borderWidth: 0 }
                                ]}
                            >
                                <WeatherIcon size={14} color={isWeatherWarning ? colors.error : colors.success} />
                                <Text style={[styles.tempText, isWeatherWarning ? { color: colors.error } : { color: colors.success }]}>
                                    {weatherComposite.attributes.temperature}°
                                    <Text style={{ fontWeight: '400', opacity: 0.8 }}> {getWeatherText(weatherComposite.state)}</Text>
                                </Text>
                            </Pressable>
                        )}
                        {(() => {
                            const hasItems = shoppingList && shoppingList.state !== '0' && shoppingList.state !== 'unknown';
                            const badgeColor = hasItems ? colors.warning : colors.accent;
                            const badgeBg = hasItems ? colors.warning + '26' : colors.accent + '26';
                            return (
                                <Pressable onPress={() => setShowShoppingList(true)} style={[styles.tempBadge, { backgroundColor: badgeBg, borderColor: hasItems ? badgeColor : 'transparent', borderWidth: hasItems ? 1 : 0 }]}>
                                    <ShoppingCart size={14} color={badgeColor} />
                                    {hasItems && (
                                        <Text style={[styles.tempText, { color: badgeColor }]}>{shoppingList.state}</Text>
                                    )}
                                </Pressable>
                            );
                        })()}
                        <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.success : colors.error }]} />
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

                {/* Quick Actions (Moved below Appliances) */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Schnellaktionen</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
                        <QuickAction
                            icon={ShoppingCart}
                            iconColor={colors.error}
                            label="Debug Shop"
                            onPress={() => { debugShoppingLogic(); setActiveFeedback('shop_debug'); }}
                            onLongPress={() => setQuickActionInfo({
                                title: "Debug Shop",
                                description: "Prüft die Einkaufslisten-Logik und Geofencing-Status für Fehlerbehebung.",
                                icon: ShoppingCart,
                                iconColor: colors.error,
                                gradient: [colors.error + '26', colors.error + '0D']
                            })}
                            gradient={[colors.error + '26', colors.error + '0D']}
                        />

                        <QuickAction
                            icon={Sun}
                            iconColor={colors.warning}
                            label="Morgen"
                            onPress={handleMorning}
                            onLongPress={() => setQuickActionInfo({
                                title: "Guten Morgen",
                                description: "Startet die Morgenroutine: Spielt Radio, öffnet Storen und schaltet Licht im Wohnbereich an.",
                                icon: Sun,
                                iconColor: colors.warning,
                                gradient: [colors.warning + '26', colors.warning + '0D']
                            })}
                            gradient={[colors.warning + '26', colors.warning + '0D']}
                        />
                        <QuickAction
                            icon={Clapperboard}
                            iconColor={colors.accent} // Using accent as pink replacement if fits, else keep hardcoded or use custom property
                            label="Kino"
                            onPress={handleMovieNight}
                            onLongPress={() => setQuickActionInfo({
                                title: "Kino-Modus",
                                description: "Aktiviert den Kino-Modus: Dimmt Lichter und sorgt für Atmosphäre.",
                                icon: Clapperboard,
                                iconColor: "#EC4899", // Keep distinct color for logical meaning
                                gradient: ['rgba(236, 72, 153, 0.15)', 'rgba(236, 72, 153, 0.05)']
                            })}
                            gradient={['rgba(236, 72, 153, 0.15)', 'rgba(236, 72, 153, 0.05)']}
                        />
                        <QuickAction
                            icon={Blinds}
                            iconColor={colors.tint}
                            label="Rollläden auf"
                            onPress={handleAllCoversOpen}
                            onLongPress={() => setQuickActionInfo({
                                title: "Rollläden öffnen",
                                description: "Öffnet alle Storen im Haus.",
                                icon: Blinds,
                                iconColor: "#60A5FA",
                                gradient: ['rgba(96, 165, 250,0.15)', 'rgba(96, 165, 250,0.05)']
                            })}
                            gradient={['rgba(96, 165, 250,0.15)', 'rgba(96, 165, 250,0.05)']}
                        />
                        <QuickAction
                            icon={Blinds}
                            iconColor={colors.accent}
                            label="Rollläden zu"
                            onPress={handleAllCoversClose}
                            onLongPress={() => setQuickActionInfo({
                                title: "Rollläden schliessen",
                                description: "Schliesst alle Storen im Haus für Privatsphäre.",
                                icon: Blinds,
                                iconColor: colors.accent,
                                gradient: [colors.accent + '26', colors.accent + '0D']
                            })}
                            gradient={[colors.accent + '26', colors.accent + '0D']}
                        />
                        <QuickAction
                            icon={Bot}
                            iconColor={colors.success}
                            label="Röbi Start"
                            onPress={handleRobiStart}
                            onLongPress={() => setQuickActionInfo({
                                title: "Röbi starten",
                                description: "Startet den Saugroboter für eine komplette Reinigung.",
                                icon: Bot,
                                iconColor: colors.success,
                                gradient: [colors.success + '26', colors.success + '0D']
                            })}
                            gradient={[colors.success + '26', colors.success + '0D']}
                        />
                        <QuickAction
                            icon={BedDouble}
                            iconColor="#8B5CF6"
                            label="Schlafen"
                            onPress={handleSleep}
                            onLongPress={() => setQuickActionInfo({
                                title: "Gute Nacht",
                                description: "Aktiviert den Schlafmodus: Schaltet alle Lichter aus und schliesst die Storen.",
                                icon: BedDouble,
                                iconColor: "#8B5CF6",
                                gradient: ['rgba(139, 92, 246,0.15)', 'rgba(139, 92, 246,0.05)']
                            })}
                            gradient={['rgba(139, 92, 246,0.15)', 'rgba(139, 92, 246,0.05)']}
                        />
                    </ScrollView>
                </View>

                {/* Main Lights Shortcuts */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        {['light.kuche', 'light.essbereich', 'light.wohnzimmer'].map(id => {
                            const light = entities.find(e => e.entity_id === id);
                            // Fallback if entity not found, just don't render or render placeholder
                            if (!light) return null;

                            // Custom labels
                            let label = 'Unbekannt';
                            if (id === 'light.kuche') label = 'Küche';
                            if (id === 'light.essbereich') label = 'Essbereich';
                            if (id === 'light.wohnzimmer') label = 'Wohnzimmer';

                            const isOn = light.state === 'on';

                            return (
                                <View key={id} style={{ flex: 1 }}>
                                    <Pressable
                                        onPress={() => toggleLight(id)}
                                        style={[
                                            styles.tile,
                                            { backgroundColor: colors.card, borderColor: colors.border },
                                            {
                                                minHeight: 60,
                                                padding: 12,
                                                justifyContent: 'center',
                                                marginBottom: 0
                                            },
                                            isOn && { backgroundColor: colors.warning + '26', borderColor: colors.warning + '80' }
                                        ]}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={[
                                                styles.tileIcon,
                                                { width: 32, height: 32, backgroundColor: colors.background },
                                                isOn && { backgroundColor: colors.warning }
                                            ]}>
                                                <Lightbulb size={18} color={isOn ? "#FFF" : colors.subtext} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.tileName, { marginTop: 0, fontSize: 13, color: colors.text }, isOn && { color: '#FFF' }]} numberOfLines={1}>{label}</Text>
                                            </View>
                                        </View>
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>
                </View>




                {/* --- EXTRA INFOS (Security: Locks & Haustüre) --- */}


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
                    <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Übersicht</Text>
                    <View style={styles.heroGrid}>
                        <HeroStatCard
                            icon={Lightbulb}
                            iconColor={colors.warning}
                            value={lightsOn}
                            total={lights.length}
                            label="Lichter aktiv"
                            gradient={[colors.warning, '#D97706']}
                            isActive={lightsOn > 0}
                            cardWidth={cardWidth}
                            onPress={openLightsModal}
                            onLongPress={handleAllLightsOff}
                        />
                        <HeroStatCard
                            icon={Blinds}
                            iconColor={colors.accent}
                            value={coversOpen}
                            total={covers.filter(c => c.attributes.friendly_name !== 'Alle Storen').length}
                            label="Rollläden offen"
                            gradient={[colors.accent, '#1D4ED8']}
                            isActive={coversOpen > 0}
                            cardWidth={cardWidth}
                            onPress={openCoversModal}
                            onLongPress={handleAllCoversClose}
                        />
                        <Pressable
                            onPress={openRobiModal}
                            onLongPress={handleAllVacuumsHome}
                            style={[styles.heroCard, { width: cardWidth, backgroundColor: colors.card }]} // Override Logic
                        >
                            <View style={[styles.heroCardGradient, { backgroundColor: activeVacuums > 0 ? colors.success : colors.card }]}>
                                <View style={[styles.decorativeCircle, { backgroundColor: activeVacuums > 0 ? 'rgba(255,255,255,0.1)' : colors.border + '30' }]} />

                                <View style={styles.heroCardHeader}>
                                    <View style={[styles.iconBubble, { backgroundColor: activeVacuums > 0 ? 'rgba(255,255,255,0.2)' : colors.background }]}>
                                        <Bot size={22} color={activeVacuums > 0 ? '#fff' : colors.success} />
                                    </View>
                                    <ChevronRight size={16} color={activeVacuums > 0 ? "rgba(255,255,255,0.3)" : colors.subtext} />
                                </View>

                                <View style={styles.heroCardContent}>
                                    <View style={styles.valueRow}>
                                        <Text style={[styles.heroValue, { fontSize: 13, color: activeVacuums > 0 ? '#fff' : colors.text }]} numberOfLines={1}>
                                            {robi ? (
                                                robi.state === 'docked' ? 'Angedockt' :
                                                    robi.state === 'cleaning' ? 'Saugt' :
                                                        robi.state === 'returning' ? 'Kehrt zurück' :
                                                            robi.state === 'paused' ? 'Pausiert' :
                                                                robi.state === 'error' ? 'Fehler' :
                                                                    robi.state === 'idle' ? 'Bereit' :
                                                                        robi.state
                                            ) : 'n/a'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.heroLabel, { color: activeVacuums > 0 ? 'rgba(255,255,255,0.8)' : colors.subtext }]}>
                                        {robi?.attributes?.friendly_name || 'Röbi'}
                                    </Text>
                                </View>

                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBar, {
                                        width: '100%',
                                        backgroundColor: robi?.state === 'cleaning' ? colors.success : (activeVacuums > 0 ? 'rgba(255,255,255,0.4)' : colors.border)
                                    }]} />
                                </View>
                            </View>
                        </Pressable>
                        <HeroStatCard
                            icon={Tv}
                            iconColor="#A78BFA"
                            value={playingMedia}
                            total={mediaPlayers.length}
                            label="Wiedergabe"
                            gradient={['#8B5CF6', '#6D28D9']}
                            isActive={playingMedia > 0}
                            cardWidth={cardWidth}
                            onPress={() => router.push('/media')}
                        />
                        <HeroStatCard
                            icon={Shield}
                            iconColor={colors.error}
                            value={0}
                            total={0}
                            label="Alarmanlage"
                            statusText={alarmStatusText}
                            gradient={[colors.error, '#991B1B']}
                            isActive={alarmEntity?.state !== 'disarmed'}
                            cardWidth={cardWidth}
                            onPress={openSecurityModal}
                        />
                        <HeroStatCard
                            icon={Video}
                            iconColor={colors.accent}
                            value={camerasCount}
                            total={camerasCount}
                            label="Kameras"
                            gradient={[colors.accent, '#1D4ED8']}
                            isActive={camerasCount > 0}
                            cardWidth={cardWidth}
                            onPress={openCamerasModal}
                        />
                    </View>
                </View>



            </ScrollView>

            {/* LIGHTS MODAL */}
            {/* LIGHTS MODAL */}
            <Modal visible={activeModal === 'lights'} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={[styles.modalHeader, { backgroundColor: colors.warning }]}>
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
                                            iconColor={colors.subtext}
                                            activeColor={colors.warning}
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
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={[styles.modalHeader, { backgroundColor: colors.accent }]}>
                            <Text style={styles.modalTitle}>Rollläden ({coversOpen} offen)</Text>
                            <Pressable onPress={closeModal} style={styles.closeBtn}><X size={24} color="#fff" /></Pressable>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.modalGrid}>
                                {covers.map(c => {
                                    const isFullWidth = c.attributes.friendly_name === 'Alle Storen';
                                    return (
                                        <View key={c.entity_id} style={{ width: isFullWidth ? '100%' : tileWidth }}>
                                            <Tile
                                                label={c.attributes.friendly_name || c.entity_id}
                                                subtext={c.attributes?.current_position != null ? `${c.attributes?.current_position}%` : c.state}
                                                icon={Blinds}
                                                iconColor={colors.subtext}
                                                activeColor={colors.accent}
                                                isActive={c.state === 'open' || c.attributes.current_position > 0}
                                                activeStyle={styles.tileActiveCover}
                                            >
                                                <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                                                    <Pressable onPress={() => openCover(c.entity_id)} style={styles.miniBtn}><Text style={styles.miniBtnText}>↑</Text></Pressable>
                                                    <Pressable onPress={() => closeCover(c.entity_id)} style={styles.miniBtn}><Text style={styles.miniBtnText}>↓</Text></Pressable>
                                                </View>
                                            </Tile>
                                        </View>
                                    );
                                })}
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

            <CalendarModal
                visible={calendarModal.visible}
                onClose={() => setCalendarModal({ ...calendarModal, visible: false })}
                entityId={calendarModal.entityId}
                title={calendarModal.title}
                accentColor={calendarModal.color}
            />

            <ShoppingListModal
                visible={shoppingListVisible || showShoppingList}
                onClose={() => {
                    setShowShoppingList(false);
                    setShoppingListVisible(false);
                }}
            />

            <SecurityModal
                visible={activeModal === 'security'}
                onClose={closeModal}
            />

            <CamerasModal
                visible={activeModal === 'cameras'}
                onClose={closeModal}
            />

            <WeatherForecastModal
                visible={showWeatherForecast}
                onClose={() => setShowWeatherForecast(false)}
                weatherEntity={weatherComposite}
                meteoAlarm={meteoAlarm}
            />

            <ActionFeedbackModal
                visible={!!activeFeedback}
                onClose={() => setActiveFeedback(null)} // This was missing in the state definition below, need to add it
                type={activeFeedback || 'sleep'}
            />

            <QuickActionInfoModal
                visible={!!quickActionInfo}
                onClose={() => setQuickActionInfo(null)}
                info={quickActionInfo}
            />
        </SafeAreaView >
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

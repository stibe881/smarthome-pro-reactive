import { useRouter, useFocusEffect } from 'expo-router';
import React, { useMemo, useState, useCallback, memo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, Modal, StyleSheet, Image, ActivityIndicator, Alert, Animated, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { COUNTDOWN_ICONS } from '../../components/FamilyCountdowns';
import { Lightbulb, Blinds, Thermometer, Droplets, Wind, Lock, Unlock, Zap, Music, Play, Pause, SkipForward, SkipBack, Bot, PartyPopper, Calendar, CloudRain, Cloud, Sun, Moon, ShoppingCart, Info, Loader2, UtensilsCrossed, Shirt, Clapperboard, BedDouble, ChevronRight, ChevronLeft, Shield, LucideIcon, DoorOpen, DoorClosed, WifiOff, Tv, X, Wifi, RefreshCw, Power, Battery, PlayCircle, Home, Map, MapPin, Fan, Clock, Video, Star, Square, Bell, Baby, Cake, Search, Speaker, Volume1, Volume2, VolumeX, Minus, Plus, Shuffle, Repeat, Repeat1, Disc, Radio } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import SecurityModal from '../../components/SecurityModal';
import { WHITELISTED_PLAYERS, MEDIA_PLAYER_CONFIG } from '../../config/mediaPlayers';
import { useSpotifyAuth, saveSpotifyToken, getSpotifyToken, exchangeSpotifyCode } from '../../services/spotifyAuth';
import { filterSecurityEntities } from '../../utils/securityHelpers';
import CamerasModal from '../../components/CamerasModal';
import { ConnectionWizard } from '../../components/ConnectionWizard';
import { useKidsMode, KIDS_GENDER_THEMES } from '../../contexts/KidsContext';
import { KidsDashboard } from '../../components/KidsDashboard';
import { GuestDashboard } from '../../components/GuestDashboard';
import { LiveCountdown } from '../../components/LiveCountdown';
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
import ShutterControlModal from '../../components/ShutterControlModal';
import NotificationBell from '../../components/NotificationBell';
import SleepTimerModal from '../../components/SleepTimerModal';
import { EntityState } from '../../contexts/HomeAssistantContext';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../hooks/useHousehold';

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
            style={[styles.heroCard, { width: cardWidth, backgroundColor: colors.card, borderWidth: isActive ? 0 : 1, borderColor: colors.border }]}
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

// =====================================================
// QUICK ACTION CONFIG SYSTEM
// =====================================================
interface QuickActionConfig {
    id: string;
    label: string;
    iconName: string;
    color: string;
    description: string;
    type: 'script' | 'button' | 'switch' | 'cover_open' | 'cover_close' | 'vacuum_start' | 'vacuum_home' | 'lights_off' | 'lights_on' | 'sleep_timer';
    entityId?: string; // for script/button/switch types
}

const ICON_MAP: Record<string, LucideIcon> = {
    Sun, Moon, Clapperboard, Blinds, Bot, BedDouble, Lightbulb, Power,
    Home, Star, Shield, Fan, Bell, Zap, Music, Play, Lock, Unlock,
    DoorOpen, DoorClosed, RefreshCw, Clock, Video, Baby, PartyPopper, Tv,
};

const DEFAULT_QUICK_ACTIONS: QuickActionConfig[] = [
    { id: 'morning', label: 'Morgen', iconName: 'Sun', color: '#F59E0B', description: 'Startet die Morgenroutine: Spielt Radio, öffnet Storen und schaltet Licht im Wohnbereich an.', type: 'script', entityId: 'script.morgenroutine' },
    { id: 'movie', label: 'Kino', iconName: 'Clapperboard', color: '#EC4899', description: 'Aktiviert den Kino-Modus: Dimmt Lichter und sorgt für Atmosphäre.', type: 'script', entityId: 'script.movie_night' },
    { id: 'covers_open', label: 'Rollläden auf', iconName: 'Blinds', color: '#60A5FA', description: 'Öffnet alle Storen im Haus.', type: 'cover_open' },
    { id: 'covers_close', label: 'Rollläden zu', iconName: 'Blinds', color: '#3B82F6', description: 'Schliesst alle Storen im Haus für Privatsphäre.', type: 'cover_close' },
    { id: 'vacuum_start', label: 'Röbi Start', iconName: 'Bot', color: '#10B981', description: 'Startet den Saugroboter für eine komplette Reinigung.', type: 'vacuum_start' },
    { id: 'sleep', label: 'Schlafen', iconName: 'BedDouble', color: '#8B5CF6', description: 'Aktiviert den Schlafmodus: Schaltet alle Lichter aus und schliesst die Storen.', type: 'script', entityId: 'script.bed_time' },
];

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

const Tile = memo(({ label, subtext, icon: Icon, iconColor, activeColor, isActive, onPress, children, activeStyle }: any) => {
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
});

const SpecificApplianceTile = memo(({
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
    const { colors } = useTheme();
    // Only show if running or finished
    if (!statusText) return null;

    const bgColor = isRunning ? colors.card : colors.card;
    const borderCol = isRunning ? '#3B82F6' : '#10B981';

    if (compact) {
        return (
            <View style={[styles.applianceStatusCard, styles.applianceStatusCardCompact, { backgroundColor: bgColor, borderColor: borderCol }]}>
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
                    <Text style={[styles.applianceTime, { textAlign: 'center', fontSize: 12, marginBottom: 2, fontWeight: 'bold', color: isRunning ? colors.text : '#10B981' }]}>{statusText}</Text>
                    <Text style={[styles.applianceName, { textAlign: 'center', fontSize: 10, opacity: 0.7, color: colors.subtext }]} numberOfLines={1}>{label}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.applianceStatusCard, { backgroundColor: bgColor, borderColor: borderCol }]}>
            <View style={[styles.applianceStatusIcon, isRunning ? { backgroundColor: '#3B82F6' } : { backgroundColor: '#10B981' }]}>
                <Icon size={20} color="#fff" />
            </View>
            <View style={styles.applianceInfo}>
                <Text style={[styles.applianceName, { color: colors.text }]} numberOfLines={1}>{label}</Text>
                <Text style={[styles.applianceTime, { color: colors.subtext }]}>{statusText}</Text>
            </View>
            {isRunning && <ActivityIndicator size="small" color="#3B82F6" style={{ marginLeft: 8 }} />}
            {isFinished && <View style={styles.finishedBadge}><Text style={styles.finishedText}>✓</Text></View>}
        </View>
    );
});

const LockTile = memo(({ lock, callService, entities }: { lock: any, callService: any, entities?: any[] }) => {
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
            Alert.alert('Tür aufschliessen', `Möchtest du ${friendlyName} aufschliessen ? `, [
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
            Alert.alert('Tür öffnen', `Möchtest du die Haustür öffnen ? `, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'ÖFFNEN', style: 'destructive', onPress: () => callService('button', 'press', 'button.hausture_tur_offnen') }
            ]);
        } else if (isNukiWohnung) {
            // Dynamic action based on current state
            if (isUnlocked) {
                Alert.alert('Tür verriegeln', `Möchtest du ${friendlyName} verriegeln ? `, [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'VERRIEGELN', onPress: () => callService('lock', 'lock', lock.entity_id) }
                ]);
            } else {
                Alert.alert('Tür entriegeln', `Möchtest du ${friendlyName} entriegeln ? `, [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'ENTRIEGELN', style: 'destructive', onPress: () => callService('lock', 'unlock', lock.entity_id) }
                ]);
            }
        } else {
            Alert.alert('Tür öffnen', `Möchtest du die Falle von ${friendlyName} ziehen(Tür öffnen) ? `, [
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
});

const SecuritySensorTile = memo(({ entity }: { entity: any }) => {
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
});

// Animated Wohnungstüre button with dynamic state coloring
const DoorApartButton = ({ onPress, isUnlocked, isDoorOpen, btnColor, cardColor, textColor, borderColor }: {
    onPress: () => void,
    isUnlocked: boolean,
    isDoorOpen: boolean,
    btnColor: string,
    cardColor: string,
    textColor: string,
    borderColor: string,
}) => {
    const blinkAnim = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (isDoorOpen) {
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
    }, [isDoorOpen]);

    // Determine background and border based on state
    const bgColor = isDoorOpen ? '#F97316' + '20' : isUnlocked ? '#EF4444' + '20' : cardColor;
    const borderCol = isDoorOpen ? '#F97316' : isUnlocked ? '#EF4444' : borderColor;
    const label = isDoorOpen ? 'Offen!' : isUnlocked ? 'Entriegelt' : 'Wohnung';

    return (
        <Animated.View style={{ flex: 1, opacity: isDoorOpen ? blinkAnim : 1 }}>
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 8, paddingVertical: 14, borderRadius: 14,
                    backgroundColor: pressed ? btnColor + '40' : bgColor,
                    borderWidth: isDoorOpen || isUnlocked ? 2 : 1,
                    borderColor: borderCol,
                }]}
            >
                <DoorOpen size={18} color={btnColor} />
                <Text style={{ color: isDoorOpen || isUnlocked ? btnColor : textColor, fontSize: 13, fontWeight: '600' }}>{label}</Text>
            </Pressable>
        </Animated.View>
    );
};


const EventTile = memo(({ calendar, onPress }: { calendar: any, onPress?: () => void }) => {
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
});

// =====================================================
// MAIN DASHBOARD COMPONENT
// =====================================================

export default function Dashboard() {
    const router = useRouter();
    const { colors } = useTheme();
    const { user, userRole, effectiveRole, impersonatedRole, impersonatedName, stopImpersonation } = useAuth();
    // --- Calendar Modal Logic ---
    const [calendarModal, setCalendarModal] = useState<{ visible: boolean, entityId: string, title: string, color: string }>({ visible: false, entityId: '', title: '', color: '' });
    const [showShoppingList, setShowShoppingList] = useState(false);
    const [showWeatherForecast, setShowWeatherForecast] = useState(false);
    const [activeFeedback, setActiveFeedback] = useState<'sleep' | 'morning' | 'movie' | 'covers_open' | 'covers_close' | 'vacuum' | 'shop_debug' | null>(null);

    // Homescreen countdowns
    const [homescreenCountdowns, setHomescreenCountdowns] = useState<any[]>([]);
    const [countdownDetail, setCountdownDetail] = useState<any | null>(null);
    const { householdId } = useHousehold();
    const { dashboardConfig, haBaseUrl } = useHomeAssistant();

    // Dashboard Media Player Modal
    const [mediaPlayerModalVisible, setMediaPlayerModalVisible] = useState(false);
    const [activeMediaPlayer, setActiveMediaPlayer] = useState<any | null>(null);
    const [selectedPopupPlayer, setSelectedPopupPlayer] = useState<string | null>(null);
    const [showPopupPlayerPicker, setShowPopupPlayerPicker] = useState(false);
    // Spotify state for popup
    const [spotifyPopupVisible, setSpotifyPopupVisible] = useState(false);
    const [popupPlaylists, setPopupPlaylists] = useState<any[]>([]);
    const [loadingPopupPlaylists, setLoadingPopupPlaylists] = useState(false);
    const [popupPlaylistTracks, setPopupPlaylistTracks] = useState<any[]>([]);
    const [selectedPopupPlaylistItem, setSelectedPopupPlaylistItem] = useState<any>(null);
    const [loadingPopupTracks, setLoadingPopupTracks] = useState(false);
    const [pendingModal, setPendingModal] = useState<'picker' | 'spotify' | 'tunein' | null>(null);
    // TuneIn state
    const [tuneinPopupVisible, setTuneinPopupVisible] = useState(false);
    const [tuneinItems, setTuneinItems] = useState<any[]>([]);
    const [tuneinBreadcrumb, setTuneinBreadcrumb] = useState<{ title: string, contentId?: string, contentType?: string }[]>([]);
    const [loadingTunein, setLoadingTunein] = useState(false);

    // When main modal closes and a pending modal is set, open it
    useEffect(() => {
        if (!mediaPlayerModalVisible && pendingModal) {
            const timer = setTimeout(() => {
                if (pendingModal === 'picker') setShowPopupPlayerPicker(true);
                if (pendingModal === 'spotify') {
                    setSpotifyPopupVisible(true);
                    // Fetch playlists
                    setLoadingPopupPlaylists(true);
                    const spotifyEntity = entities.find(e => e.entity_id.startsWith('media_player.spotify'));
                    if (spotifyEntity) {
                        browseMedia(spotifyEntity.entity_id)
                            .then((root: any) => {
                                if (!root?.children) throw new Error('Root empty');
                                const playlistFolder = root.children.find((c: any) => c.title === 'Playlists' || c.title === 'Bibliothek' || c.media_content_type === 'playlist');
                                if (playlistFolder) {
                                    return browseMedia(spotifyEntity.entity_id, playlistFolder.media_content_id, playlistFolder.media_content_type)
                                        .then((content: any) => setPopupPlaylists(content?.children || []));
                                }
                                setPopupPlaylists(root.children);
                            })
                            .catch(() => Alert.alert('Fehler', 'Playlists konnten nicht geladen werden.'))
                            .finally(() => setLoadingPopupPlaylists(false));
                    }
                }
                if (pendingModal === 'tunein') {
                    setTuneinPopupVisible(true);
                    setLoadingTunein(true);
                    setTuneinBreadcrumb([{ title: 'Radio' }]);
                    // Browse MASS player's root media to find TuneIn
                    const massPlayer = activeMediaPlayer ? (() => {
                        const id = activeMediaPlayer.entity_id;
                        const MASS_ID_MAPPING: Record<string, string> = { 'media_player.nest_buro': 'media_player.nest_garage_2' };
                        if (MASS_ID_MAPPING[id]) return MASS_ID_MAPPING[id];
                        if (id.startsWith('media_player.ma_') || id.startsWith('media_player.mass_')) return id;
                        const massId = id.replace('media_player.', 'media_player.mass_');
                        if (entities.find(e => e.entity_id === massId)) return massId;
                        const coreName = id.replace('media_player.', '').replace('nest_', '').replace('google_', '').replace('hub_', '').replace('home_', '');
                        const mc = entities.find(e => (e.entity_id.startsWith('media_player.mass_') || e.entity_id.startsWith('media_player.ma_')) && e.entity_id.includes(coreName));
                        return mc ? mc.entity_id : id;
                    })() : null;
                    if (massPlayer) {
                        browseMedia(massPlayer)
                            .then((root: any) => {
                                if (!root?.children) { setTuneinItems([]); return; }
                                // Look for TuneIn or Radio in the root children
                                const tuneinFolder = root.children.find((c: any) =>
                                    c.title?.toLowerCase().includes('tunein') ||
                                    c.title?.toLowerCase().includes('radio') ||
                                    c.media_content_id?.toLowerCase().includes('tunein')
                                );
                                if (tuneinFolder) {
                                    return browseMedia(massPlayer, tuneinFolder.media_content_id, tuneinFolder.media_content_type)
                                        .then((content: any) => setTuneinItems(content?.children || []));
                                }
                                // Fallback: show all root items
                                setTuneinItems(root.children);
                            })
                            .catch(() => Alert.alert('Fehler', 'Radio konnte nicht geladen werden.'))
                            .finally(() => setLoadingTunein(false));
                    } else {
                        setLoadingTunein(false);
                    }
                }
                setPendingModal(null);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [mediaPlayerModalVisible, pendingModal]);

    const loadHomescreenCountdowns = useCallback(async () => {
        if (!householdId) return;
        try {
            // Fetch all countdowns, then filter client-side for show_on_homescreen or auto-show
            const { data } = await supabase
                .from('family_countdowns')
                .select('*')
                .eq('household_id', householdId)
                .order('target_date', { ascending: true });
            if (!data) { setHomescreenCountdowns([]); return; }

            const autoShowDays = dashboardConfig?.countdownAutoShowDays ?? 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const filtered = data.filter((cd: any) => {
                if (cd.show_on_homescreen) return true;

                const target = new Date(cd.target_date + 'T00:00:00');
                if (cd.target_time) {
                    const [h, m] = cd.target_time.split(':');
                    target.setHours(parseInt(h), parseInt(m), 0, 0);
                } else {
                    target.setHours(0, 0, 0, 0);
                }
                const msLeft = target.getTime() - today.getTime();
                const daysLeft = Math.ceil(msLeft / 86400000);

                if (cd.auto_show_days !== null && cd.auto_show_days !== undefined) {
                    return daysLeft >= 0 && daysLeft <= cd.auto_show_days;
                }

                if (autoShowDays > 0) {
                    return daysLeft >= 0 && daysLeft <= autoShowDays;
                }
                return false;
            });
            setHomescreenCountdowns(filtered);
        } catch (e) {
            console.error('Error loading homescreen countdowns:', e);
        }
    }, [householdId, dashboardConfig?.countdownAutoShowDays]);

    // Load on focus AND on initial mount / householdId change
    useFocusEffect(useCallback(() => {
        loadHomescreenCountdowns();
    }, [loadHomescreenCountdowns]));

    useEffect(() => {
        loadHomescreenCountdowns();
    }, [loadHomescreenCountdowns]);

    const getCountdownDays = (dateStr: string, timeStr?: string) => {
        const target = new Date(dateStr + 'T00:00:00');
        if (timeStr) {
            const [h, m] = timeStr.split(':');
            target.setHours(parseInt(h), parseInt(m), 0, 0);
        } else {
            target.setHours(0, 0, 0, 0);
        }
        const today = new Date();
        const msLeft = target.getTime() - today.getTime();
        return Math.ceil(msLeft / 86400000);
    };

    const [quickActionInfo, setQuickActionInfo] = useState<QuickActionInfo | null>(null);
    const [showSleepTimer, setShowSleepTimer] = useState(false);

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
        hasEverConnected,
        toggleLight,
        connect,
        activateScene,
        openCover,
        closeCover,
        setCoverPosition,
        setCoverTiltPosition,
        pressButton,
        stopCover,
        startVacuum,
        returnVacuum,
        callService,
        getEntityPictureUrl,
        shoppingListVisible,
        setShoppingListVisible,
        startShoppingGeofencing,
        debugShoppingLogic,
        isHAInitialized,
        browseMedia
    } = useHomeAssistant();

    const { isKidsModeActive, config, setKidsModeActive, selectRoom } = useKidsMode();

    // Spotify Auth
    const { request: spotifyRequest, response: spotifyResponse, promptAsync: spotifyPromptAsync } = useSpotifyAuth();
    const [spotifyToken, setSpotifyToken] = useState<string | null>(null);

    useEffect(() => {
        if (spotifyResponse?.type === 'success') {
            const { code } = spotifyResponse.params;
            if (code && spotifyRequest?.codeVerifier) {
                exchangeSpotifyCode(code, spotifyRequest.codeVerifier, spotifyRequest.redirectUri)
                    .then(data => {
                        if (data.access_token) {
                            saveSpotifyToken(data.access_token, data.refresh_token, data.expires_in);
                            setSpotifyToken(data.access_token);
                        }
                    })
                    .catch(() => { });
            }
        }
    }, [spotifyResponse]);

    useEffect(() => { getSpotifyToken().then(setSpotifyToken); }, []);

    const [showWizard, setShowWizard] = useState(false);

    // Configurable Entity IDs (from Settings)
    const [cfgWeatherMain, setCfgWeatherMain] = useState('weather.zell_lu');
    const [cfgWeatherForecast, setCfgWeatherForecast] = useState('weather.familie_gross');
    const [cfgWeatherAlarm, setCfgWeatherAlarm] = useState('weather.meteo');
    const [cfgShoppingList, setCfgShoppingList] = useState('todo.google_keep_einkaufsliste');
    const [cfgDoorFront, setCfgDoorFront] = useState('');
    const [cfgDoorApart, setCfgDoorApart] = useState('');
    const [cfgDoorApartSensor, setCfgDoorApartSensor] = useState('');

    useEffect(() => {
        (async () => {
            const main = await AsyncStorage.getItem('@weather_main_entity');
            const forecast = await AsyncStorage.getItem('@weather_forecast_entity');
            const alarm = await AsyncStorage.getItem('@weather_alarm_entity');
            const shopping = await AsyncStorage.getItem('@shopping_list_entity');
            if (main) setCfgWeatherMain(main);
            if (forecast) setCfgWeatherForecast(forecast);
            if (alarm) setCfgWeatherAlarm(alarm);
            if (shopping) setCfgShoppingList(shopping);
            const doorF = await AsyncStorage.getItem('@door_front_entity');
            const doorA = await AsyncStorage.getItem('@door_apartment_entity');
            const doorAS = await AsyncStorage.getItem('@door_apartment_sensor_entity');
            if (doorF) setCfgDoorFront(doorF);
            if (doorA) setCfgDoorApart(doorA);
            if (doorAS) setCfgDoorApartSensor(doorAS);
        })();
    }, []);

    // Sync entity configs from shared Supabase dashboardConfig (overrides local AsyncStorage)
    useEffect(() => {
        const ec = dashboardConfig?.entityConfig;
        if (!ec) return;
        if (ec.main) setCfgWeatherMain(ec.main);
        if (ec.forecast) setCfgWeatherForecast(ec.forecast);
        if (ec.alarm) setCfgWeatherAlarm(ec.alarm);
        if (ec.shopping) setCfgShoppingList(ec.shopping);
        if (ec.door_front) setCfgDoorFront(ec.door_front);
        if (ec.door_apartment) setCfgDoorApart(ec.door_apartment);
        if (ec.door_apartment_sensor) setCfgDoorApartSensor(ec.door_apartment_sensor);
    }, [dashboardConfig]);

    // Quick Actions Config: user → admin → defaults
    const [quickActions, setQuickActions] = useState<QuickActionConfig[]>(DEFAULT_QUICK_ACTIONS);

    // Reload quick actions every time the Dashboard tab is focused
    // (so changes from Settings are immediately reflected)
    useFocusEffect(
        useCallback(() => {
            (async () => {
                // 1. Try user-specific config
                if (user?.id) {
                    const userCfg = await AsyncStorage.getItem(`@quick_actions_user_${user.id}`);
                    if (userCfg) {
                        try { setQuickActions(JSON.parse(userCfg)); return; } catch { }
                    }
                }
                // 2. Try admin config
                const adminCfg = await AsyncStorage.getItem('@quick_actions_admin');
                if (adminCfg) {
                    try { setQuickActions(JSON.parse(adminCfg)); return; } catch { }
                }
                // 3. Use defaults
                setQuickActions(DEFAULT_QUICK_ACTIONS);
            })();
        }, [user?.id])
    );

    // Wizard is only shown manually from Settings, not auto-opened here
    // (auto-open caused race condition in production builds where haBaseUrl
    // was briefly null during AsyncStorage load, blocking the entire UI)

    // Start Shopping Geofencing on Mount
    useEffect(() => {
        startShoppingGeofencing();
    }, []);

    // Modal states
    const [activeModal, setActiveModal] = useState<'lights' | 'covers' | 'robi' | 'security' | 'cameras' | null>(null);
    const [exitPinVisible, setExitPinVisible] = useState(false);
    const [exitPinInput, setExitPinInput] = useState('');
    const [selectedCover, setSelectedCover] = useState<EntityState | null>(null);

    // Safety: auto-deactivate kids mode if no rooms configured
    useEffect(() => {
        if (isKidsModeActive && config.rooms.length === 0) {
            setKidsModeActive(false);
        }
    }, [isKidsModeActive, config.rooms.length]);

    // Filter entities
    const lights = useMemo(() => {
        const allowedLights = dashboardConfig.lights?.length > 0 ? dashboardConfig.lights : [];
        return allowedLights.map((def: any) => {
            const entity = entities.find((e: any) => e.entity_id === def.id);
            if (!entity) return null;
            return {
                ...entity,
                attributes: {
                    ...entity.attributes,
                    friendly_name: def.name
                }
            };
        }).filter(Boolean) as any[];
    }, [entities, dashboardConfig]);

    const covers = useMemo(() => {
        const allowedCovers = dashboardConfig.covers?.length > 0 ? dashboardConfig.covers : [];
        return allowedCovers.map((def: any) => {
            const entity = entities.find((e: any) => e.entity_id === def.id);
            if (!entity) return null;
            return {
                ...entity,
                attributes: {
                    ...entity.attributes,
                    friendly_name: def.name
                }
            };
        }).filter(Boolean) as any[];
    }, [entities, dashboardConfig]);
    const vacuums = useMemo(() => {
        if (dashboardConfig.vacuum) {
            const v = entities.find(e => e.entity_id === dashboardConfig.vacuum);
            return v ? [v] : [];
        }
        return entities.filter(e => e.entity_id.startsWith('vacuum.'));
    }, [entities, dashboardConfig]);
    const mediaPlayers = useMemo(() => {
        // Dynamic Config (from Wizard) OR Fallback to Whitelist
        if (dashboardConfig.mediaPlayers && dashboardConfig.mediaPlayers.length > 0) {
            return dashboardConfig.mediaPlayers.map((def: any) => {
                const entity = entities.find(e => e.entity_id === def.id);
                if (!entity) return null;
                return {
                    ...entity,
                    attributes: {
                        ...entity.attributes,
                        friendly_name: def.name
                    }
                };
            }).filter(Boolean);
        }

        // Fallback: Use Whitelist
        return entities.filter(e => e.entity_id.startsWith('media_player.') && WHITELISTED_PLAYERS.includes(e.entity_id));
    }, [entities, dashboardConfig]);
    const climate = useMemo(() => entities.filter(e => e.entity_id.startsWith('climate.')), [entities]);
    // securityEntities is now defined later using the helper
    const calendars = useMemo(() => entities.filter(e => e.entity_id.startsWith('calendar.')).filter(c => c.state === 'on' || c.attributes.message), [entities]);
    const shoppingList = useMemo(() => entities.find(e => e.entity_id === cfgShoppingList), [entities, cfgShoppingList]);

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
    const robi = useMemo(() => vacuums[0] || null, [vacuums]);
    const mapCamera = useMemo(() => entities.find(e => e.entity_id.startsWith('camera.') && (e.entity_id.includes('map') || e.entity_id.includes('robi'))), [entities]);

    // Scripts
    const cleanScripts = useMemo(() => entities.filter(e => e.entity_id.startsWith('script.') && (e.entity_id.includes('clean') || e.entity_id.includes('reinigen'))), [entities]);
    // Try to find the Sleep/Bedtime script
    const bedTimeScript = useMemo(() => entities.find(e => e.entity_id === 'script.bed_time' || e.entity_id.includes('bed_time') || e.entity_id.includes('gute_nacht') || e.entity_id.includes('schlafen')), [entities]);

    const lightsOn = useMemo(() => lights.filter(l => l.state === 'on').length, [lights]);
    const coversOpen = useMemo(() => covers.filter(c => (c.attributes.friendly_name !== 'Alle Storen') && (c.state === 'open' || (c.attributes.current_position && c.attributes.current_position > 0))).length, [covers]);
    const activeVacuums = useMemo(() => vacuums.filter(v => v.state === 'cleaning').length, [vacuums]);
    const playingMediaCount = useMemo(() => mediaPlayers.filter((m: any) => m.state === 'playing').length, [mediaPlayers]);
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

    // Find Alarm Entity (from config or fallback to first alarm_control_panel)
    const alarmEntity = useMemo(() => {
        if (dashboardConfig.alarm) {
            return entities.find(e => e.entity_id === dashboardConfig.alarm) || null;
        }
        return entities.find(e => e.entity_id.startsWith('alarm_control_panel.')) || null;
    }, [entities, dashboardConfig]);

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
    const weatherZell = useMemo(() => entities.find(e => e.entity_id === cfgWeatherMain), [entities, cfgWeatherMain]);
    const meteoAlarm = useMemo(() => entities.find(e => e.entity_id === 'binary_sensor.meteoalarm' || e.entity_id.includes('meteoalarm')), [entities]);

    // Use configurable entities for forecast and meteo
    const weatherFamilieGross = useMemo(() => entities.find(e => e.entity_id === cfgWeatherForecast), [entities, cfgWeatherForecast]);
    const weatherMeteo = useMemo(() => entities.find(e => e.entity_id === cfgWeatherAlarm), [entities, cfgWeatherAlarm]);

    // Composite Weather Entity: Prefer main (configured) entity, skip unavailable
    const weatherComposite = useMemo(() => {
        const isAvailable = (e: any) => e && e.state !== 'unavailable' && e.state !== 'unknown';
        if (isAvailable(weatherZell)) return weatherZell;
        if (isAvailable(weatherMeteo)) return weatherMeteo;
        if (isAvailable(weatherFamilieGross)) return weatherFamilieGross;
        return weatherZell || weatherMeteo || weatherFamilieGross;
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
    const openCoversModal = useCallback(() => setActiveModal('covers'), []);
    const openRobiModal = useCallback(() => setActiveModal('robi'), []);

    const openSecurityModal = useCallback(() => setActiveModal('security'), []);
    const openCamerasModal = useCallback(() => setActiveModal('cameras'), []);
    const closeModal = useCallback(() => setActiveModal(null), []);

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

    if (!isConnected && !isConnecting && !hasEverConnected) {
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
                        <Pressable onPress={() => connect()} style={[styles.connectButton, { backgroundColor: colors.accent }]}>
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


    // Guest view: shown for real guests AND when admin impersonates a guest
    if (effectiveRole === 'guest') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {impersonatedRole && (
                    <View style={{ backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>👁 Ansicht als {impersonatedName}</Text>
                        <Pressable onPress={stopImpersonation} style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Beenden</Text>
                        </Pressable>
                    </View>
                )}
                <GuestDashboard />
            </SafeAreaView>
        );
    }

    if (isKidsModeActive) {
        if (config.rooms.length === 0) {
            return null; // useEffect will deactivate
        }

        // Auto-select if only 1 room
        if (!config.activeRoomId && config.rooms.length === 1) {
            selectRoom(config.rooms[0].id);
        }

        if (!config.activeRoomId) {
            return (
                <SafeAreaView style={[styles.container, { backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }]}>
                    <Pressable
                        onLongPress={() => {
                            setExitPinVisible(true);
                            setExitPinInput('');
                        }}
                        style={{ position: 'absolute', top: 60, right: 30, padding: 20 }}
                    >
                        <X size={24} color="rgba(255,255,255,0.15)" />
                    </Pressable>

                    <Text style={{ fontSize: 48, marginBottom: 8 }}>👋</Text>
                    <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', marginBottom: 8, textAlign: 'center' }}>Hallo!</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, marginBottom: 40, textAlign: 'center' }}>Wer bist du?</Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, paddingHorizontal: 20 }}>
                        {config.rooms.map((room) => {
                            const genderTheme = KIDS_GENDER_THEMES[room.gender || 'neutral'];
                            const roomColor = genderTheme.primary;
                            const roomEmoji = genderTheme.emoji;
                            return (
                                <Pressable
                                    key={room.id}
                                    onPress={() => selectRoom(room.id)}
                                    style={({ pressed }) => ({
                                        width: 150,
                                        height: 190,
                                        borderRadius: 32,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: roomColor + '15',
                                        borderWidth: 3,
                                        borderColor: roomColor + '60',
                                        transform: [{ scale: pressed ? 0.95 : 1 }],
                                    })}
                                >
                                    <View style={{
                                        width: 80, height: 80, borderRadius: 40,
                                        backgroundColor: roomColor + '25',
                                        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
                                        borderWidth: 2, borderColor: roomColor + '40',
                                    }}>
                                        <Text style={{ fontSize: 40 }}>{roomEmoji}</Text>
                                    </View>
                                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                                        {room.name}
                                    </Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                                        ⭐ {room.score || 0} Sterne
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Exit hint for parents */}
                    <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, position: 'absolute', bottom: 30, textAlign: 'center' }}>
                        Eltern: ✕ oben rechts lange drücken zum Beenden
                    </Text>

                    {/* Cross-platform PIN modal for exit */}
                    <Modal visible={exitPinVisible} transparent animationType="fade">
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: 300, gap: 16 }}>
                                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Kindermodus beenden</Text>
                                <Text style={{ color: colors.subtext, fontSize: 14 }}>Bitte gib den PIN ein:</Text>
                                <TextInput
                                    style={{ backgroundColor: colors.background, color: colors.text, borderRadius: 8, padding: 12, fontSize: 18, textAlign: 'center', borderWidth: 1, borderColor: colors.border }}
                                    value={exitPinInput}
                                    onChangeText={setExitPinInput}
                                    keyboardType="number-pad"
                                    secureTextEntry
                                    maxLength={4}
                                    autoFocus
                                    placeholder="****"
                                    placeholderTextColor={colors.subtext}
                                />
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <Pressable
                                        onPress={() => setExitPinVisible(false)}
                                        style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center' }}
                                    >
                                        <Text style={{ color: colors.subtext, fontWeight: '600' }}>Abbrechen</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => {
                                            if (exitPinInput === config.parentalPin) {
                                                setKidsModeActive(false);
                                                setExitPinVisible(false);
                                            } else {
                                                Alert.alert("Falscher PIN");
                                                setExitPinInput('');
                                            }
                                        }}
                                        style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center' }}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: '600' }}>Bestätigen</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </SafeAreaView>
            );
        }
        return <KidsDashboard />;
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

            {/* Impersonation Banner */}
            {impersonatedRole && (
                <View style={{ backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>👁 Ansicht als {impersonatedName}</Text>
                    <Pressable onPress={stopImpersonation} style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Beenden</Text>
                    </Pressable>
                </View>
            )}

            <ScrollView
                style={[styles.scrollView, { backgroundColor: 'transparent' }]}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? 24 : 16, maxWidth: width >= 1024 ? 1100 : undefined, alignSelf: width >= 1024 ? 'center' as const : undefined, width: width >= 1024 ? '100%' as any : undefined }]}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Homescreen Countdowns and Media Player (TOP) */}
                {(homescreenCountdowns.length > 0 || mediaPlayers.length > 0) && (
                    <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                        {/* Countdowns (scrollable, takes available space) */}
                        {homescreenCountdowns.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingLeft: 20, paddingRight: mediaPlayers.length > 0 ? 10 : 20 }}>
                                {homescreenCountdowns.map((cd: any) => {
                                    const days = getCountdownDays(cd.target_date, cd.target_time);
                                    const isToday = days === 0;
                                    const isSoon = days <= 7;
                                    const accent = isToday ? '#EF4444' : isSoon ? '#F59E0B' : '#3B82F6';
                                    return (
                                        <Pressable key={cd.id} onPress={() => setCountdownDetail(cd)}
                                            style={[styles.countdownCard, { backgroundColor: accent + '15', borderColor: accent + '40' }]}
                                        >
                                            {(() => { const IconC = COUNTDOWN_ICONS[cd.emoji] || Search; return <IconC size={20} color={accent} />; })()}
                                            <LiveCountdown
                                                targetDate={cd.target_date}
                                                targetTime={cd.target_time}
                                                displayFormat={cd.display_format}
                                                isHomescreen={true}
                                                color={accent}
                                                textStyle={[styles.countdownDays, { color: accent }]}
                                            />
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        )}

                        {/* Media Player Widget (always visible) */}
                        {mediaPlayers.length > 0 && (() => {
                            // Priority: selected > playing group > playing > first
                            const popupPlayer = selectedPopupPlayer
                                ? mediaPlayers.find((p: any) => p.entity_id === selectedPopupPlayer) || mediaPlayers[0]
                                : mediaPlayers.find((p: any) => p.state === 'playing' && MEDIA_PLAYER_CONFIG[p.entity_id]?.isGroup)
                                || mediaPlayers.find((p: any) => p.state === 'playing')
                                || mediaPlayers.find((p: any) => p.state === 'idle' || p.state === 'paused')
                                || mediaPlayers[0];
                            if (!popupPlayer) return null;
                            const imageUrl = getEntityPictureUrl(popupPlayer?.attributes?.entity_picture);
                            const isPlaying = popupPlayer.state === 'playing';

                            return (
                                <Pressable
                                    onPress={() => {
                                        setActiveMediaPlayer(popupPlayer);
                                        setMediaPlayerModalVisible(true);
                                    }}
                                    style={{
                                        width: 60,
                                        height: 60,
                                        borderRadius: 16,
                                        backgroundColor: colors.card,
                                        borderWidth: 1,
                                        borderColor: isPlaying ? colors.accent + '80' : colors.border,
                                        overflow: 'hidden',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginRight: 20,
                                        marginLeft: homescreenCountdowns.length > 0 ? 0 : 'auto',
                                    }}
                                >
                                    {imageUrl ? (
                                        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <Music size={24} color={colors.subtext} />
                                    )}
                                    {isPlaying && (
                                        <View style={{ position: 'absolute', bottom: 4, right: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: '#1DB954', borderWidth: 1.5, borderColor: colors.card }} />
                                    )}
                                </Pressable>
                            );
                        })()}
                    </View>
                )}

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.greeting, { color: colors.text }]}>{getGreeting()}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <Text style={[styles.dateText, { color: colors.subtext, marginTop: 0 }]}>
                                {new Date().toLocaleDateString('de-DE', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long'
                                })}
                            </Text>
                            {!isTablet && weatherComposite && (
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
                                    <Text
                                        style={[styles.tempText, isWeatherWarning ? { color: colors.error } : { color: colors.success }]}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {weatherComposite.attributes.temperature}° {getWeatherText(weatherComposite.state)}
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                    {isTablet && (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <HeaderClock />
                        </View>
                    )}

                    <View style={styles.headerRight}>
                        {isTablet && weatherComposite && (
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
                                <Text
                                    style={[styles.tempText, isWeatherWarning ? { color: colors.error } : { color: colors.success }]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
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
                                <Pressable onPress={() => setShowShoppingList(true)} onLongPress={debugShoppingLogic} style={[styles.tempBadge, { backgroundColor: badgeBg, borderColor: hasItems ? badgeColor : 'transparent', borderWidth: hasItems ? 1 : 0 }]}>
                                    <ShoppingCart size={14} color={badgeColor} />
                                    {hasItems && (
                                        <Text style={[styles.tempText, { color: badgeColor }]}>{shoppingList.state}</Text>
                                    )}
                                </Pressable>
                            );
                        })()}
                        <NotificationBell />
                    </View>
                </View>

                {/* --- APPLIANCE STATUS ROW (Dynamic) --- */}
                {/* --- APPLIANCE STATUS ROW (Specific) --- */}
                {
                    (() => {
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
                    })()
                }

                {/* Door Opener Buttons */}
                {
                    (cfgDoorFront || cfgDoorApart) && (() => {
                        const handleDoorOpen = (entityId: string) => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            // Support lock, button, switch, and script entities
                            if (entityId.startsWith('lock.')) {
                                callService('lock', 'unlock', entityId);
                            } else if (entityId.startsWith('button.')) {
                                callService('button', 'press', entityId);
                            } else if (entityId.startsWith('switch.')) {
                                callService('switch', 'turn_on', entityId);
                            } else if (entityId.startsWith('script.')) {
                                callService('script', 'turn_on', entityId);
                            } else {
                                callService('lock', 'unlock', entityId);
                            }
                        };

                        // Toggle lock: lock if unlocked, unlock if locked
                        const handleDoorToggle = (entityId: string) => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            if (entityId.startsWith('lock.')) {
                                const lockEntity = entities.find(e => e.entity_id === entityId);
                                if (lockEntity?.state === 'unlocked') {
                                    callService('lock', 'lock', entityId);
                                } else {
                                    callService('lock', 'unlock', entityId);
                                }
                            } else {
                                handleDoorOpen(entityId);
                            }
                        };

                        // Dynamic state for Wohnungstüre button
                        const apartLockEntity = cfgDoorApart ? entities.find(e => e.entity_id === cfgDoorApart) : null;
                        const apartDoorSensor = cfgDoorApartSensor ? entities.find(e => e.entity_id === cfgDoorApartSensor) : null;
                        const isApartUnlocked = apartLockEntity?.state === 'unlocked';
                        const isApartDoorOpen = apartDoorSensor?.state === 'on';

                        // Determine Wohnungstüre button color
                        const getApartBtnColor = () => {
                            if (isApartDoorOpen) return '#F97316';
                            if (isApartUnlocked) return '#EF4444';
                            return '#8B5CF6';
                        };
                        const apartBtnColor = getApartBtnColor();

                        return (
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                                {cfgDoorFront ? (
                                    <Pressable
                                        onPress={() => handleDoorOpen(cfgDoorFront)}
                                        style={({ pressed }) => [{
                                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                            gap: 8, paddingVertical: 14, borderRadius: 14,
                                            backgroundColor: pressed ? colors.accent + '40' : colors.card,
                                            borderWidth: 1, borderColor: colors.border,
                                        }]}
                                    >
                                        <DoorOpen size={18} color={colors.accent} />
                                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Haustüre</Text>
                                    </Pressable>
                                ) : null}
                                {cfgDoorApart ? (
                                    <DoorApartButton
                                        onPress={() => handleDoorToggle(cfgDoorApart)}
                                        isUnlocked={isApartUnlocked}
                                        isDoorOpen={isApartDoorOpen}
                                        btnColor={apartBtnColor}
                                        cardColor={colors.card}
                                        textColor={colors.text}
                                        borderColor={colors.border}
                                    />
                                ) : null}
                                {cfgDoorFront && cfgDoorApart ? (
                                    <Pressable
                                        onPress={() => {
                                            handleDoorOpen(cfgDoorFront);
                                            handleDoorOpen(cfgDoorApart);
                                        }}
                                        style={({ pressed }) => [{
                                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                            gap: 8, paddingVertical: 14, borderRadius: 14,
                                            backgroundColor: pressed ? '#10B981' + '40' : colors.card,
                                            borderWidth: 1, borderColor: '#10B981' + '60',
                                        }]}
                                    >
                                        <DoorOpen size={18} color="#10B981" />
                                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Beide</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        );
                    })()
                }

                {/* Quick Actions (Data-driven) */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Schnellaktionen</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
                        {quickActions.map((qa) => {
                            const IconComp = ICON_MAP[qa.iconName] || Zap;
                            const gradient: [string, string] = [qa.color + '59', qa.color + '26'];

                            const FEEDBACK_MAP: Record<string, 'sleep' | 'morning' | 'movie' | 'covers_open' | 'covers_close' | 'vacuum'> = {
                                sleep: 'sleep', morning: 'morning', movie: 'movie',
                            };

                            const handlePress = () => {
                                switch (qa.type) {
                                    case 'script':
                                        if (qa.entityId) callService('script', 'turn_on', qa.entityId);
                                        if (FEEDBACK_MAP[qa.id]) setActiveFeedback(FEEDBACK_MAP[qa.id]);
                                        break;
                                    case 'button':
                                        if (qa.entityId) callService('button', 'press', qa.entityId);
                                        if (FEEDBACK_MAP[qa.id]) setActiveFeedback(FEEDBACK_MAP[qa.id]);
                                        break;
                                    case 'switch':
                                        if (qa.entityId) callService('switch', 'turn_on', qa.entityId);
                                        if (FEEDBACK_MAP[qa.id]) setActiveFeedback(FEEDBACK_MAP[qa.id]);
                                        break;
                                    case 'cover_open':
                                        handleAllCoversOpen();
                                        break;
                                    case 'cover_close':
                                        handleAllCoversClose();
                                        break;
                                    case 'vacuum_start':
                                        handleRobiStart();
                                        break;
                                    case 'vacuum_home':
                                        handleRobiHome();
                                        break;
                                    case 'lights_off':
                                        handleAllLightsOff();
                                        break;
                                    case 'lights_on':
                                        handleAllLightsOn();
                                        break;
                                    case 'sleep_timer':
                                        setShowSleepTimer(true);
                                        break;
                                }
                            };

                            return (
                                <QuickAction
                                    key={qa.id}
                                    icon={IconComp}
                                    iconColor={qa.color}
                                    label={qa.label}
                                    onPress={handlePress}
                                    onLongPress={() => setQuickActionInfo({
                                        title: qa.label,
                                        description: qa.description,
                                        icon: IconComp,
                                        iconColor: qa.color,
                                        gradient
                                    })}
                                    gradient={gradient}
                                />
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Main Shortcuts (configurable by admin) */}
                {
                    (dashboardConfig.homescreenShortcuts?.length > 0) && (
                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                {(dashboardConfig.homescreenShortcuts || []).map((shortcut: any) => {
                                    const entity = entities.find((e: any) => e.entity_id === shortcut.id);
                                    if (!entity) return null;

                                    const isOn = entity.state === 'on';
                                    const domain = shortcut.id.split('.')[0];
                                    const label = shortcut.name || entity.attributes.friendly_name || shortcut.id;

                                    const handleToggle = () => {
                                        if (isOn) {
                                            callService(domain, 'turn_off', shortcut.id);
                                        } else {
                                            callService(domain, 'turn_on', shortcut.id);
                                        }
                                    };

                                    return (
                                        <View key={shortcut.id} style={{ flex: 1 }}>
                                            <Pressable
                                                onPress={handleToggle}
                                                style={[
                                                    styles.tile,
                                                    { backgroundColor: colors.card, borderColor: colors.border },
                                                    {
                                                        minHeight: 60,
                                                        padding: 12,
                                                        justifyContent: 'center',
                                                        marginBottom: 0
                                                    },
                                                    isOn && { backgroundColor: colors.accent + '26', borderColor: colors.accent + '80' }
                                                ]}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                    <View style={[
                                                        styles.tileIcon,
                                                        { width: 32, height: 32, backgroundColor: colors.background },
                                                        isOn && { backgroundColor: colors.accent }
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
                    )
                }




                {/* --- EXTRA INFOS (Security: Locks & Haustüre) --- */}

                {/* Countdown Detail Popup */}
                <Modal visible={!!countdownDetail} transparent animationType="fade" onRequestClose={() => setCountdownDetail(null)}>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setCountdownDetail(null)}>
                            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                        </Pressable>
                        {countdownDetail && (() => {
                            const days = getCountdownDays(countdownDetail.target_date, countdownDetail.target_time);
                            const isToday = days === 0;
                            const isSoon = days <= 7;
                            const accent = isToday ? '#EF4444' : isSoon ? '#F59E0B' : '#3B82F6';
                            const d = new Date(countdownDetail.target_date);
                            const dateStr = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}` + (countdownDetail.target_time ? ` ${countdownDetail.target_time}` : '');
                            return (
                                <View style={{ width: '100%', maxWidth: 300, backgroundColor: '#1E293B', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: accent }}>
                                    <View style={{ height: 70, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                                        {(() => { const IconC = COUNTDOWN_ICONS[countdownDetail.emoji] || Search; return <IconC size={36} color="#fff" />; })()}
                                    </View>
                                    <View style={{ padding: 24, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6, textAlign: 'center' }}>{countdownDetail.title}</Text>
                                        <Text style={{ fontSize: 14, color: '#94A3B8', marginBottom: 16 }}>📅 {dateStr}</Text>
                                        <View style={{ backgroundColor: accent + '20', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 }}>
                                            <LiveCountdown
                                                targetDate={countdownDetail.target_date}
                                                targetTime={countdownDetail.target_time}
                                                displayFormat={countdownDetail.display_format}
                                                color={accent}
                                                textStyle={{ fontSize: 18, fontWeight: '900', color: accent, textAlign: 'center' }}
                                            />
                                        </View>
                                        <Pressable onPress={() => setCountdownDetail(null)}
                                            style={{ marginTop: 20, backgroundColor: accent, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 12, width: '100%', alignItems: 'center' }}>
                                            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>OK</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                </Modal>

                {
                    calendars.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitleSmall}>Nächste Termine</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                {calendars.map(calendar => (
                                    <EventTile key={calendar.entity_id} calendar={calendar} onPress={() => handleCalendarPress(calendar)} />
                                ))}
                            </ScrollView>
                        </View>
                    )
                }


                {/* Hero Stats */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Übersicht</Text>
                    <View style={styles.heroGrid}>
                        <HeroStatCard
                            icon={Lightbulb}
                            iconColor={colors.accent}
                            value={lightsOn}
                            total={lights.length}
                            label="Lichter aktiv"
                            gradient={[colors.accent, colors.accent + 'CC']}
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
                            gradient={[colors.accent, colors.accent + 'CC']}
                            isActive={coversOpen > 0}
                            cardWidth={cardWidth}
                            onPress={openCoversModal}
                            onLongPress={handleAllCoversClose}
                        />
                        <Pressable
                            onPress={openRobiModal}
                            onLongPress={handleAllVacuumsHome}
                            style={[styles.heroCard, { width: cardWidth, backgroundColor: colors.card, borderWidth: activeVacuums > 0 ? 0 : 1, borderColor: colors.border }]}
                        >
                            <View style={[styles.heroCardGradient, { backgroundColor: activeVacuums > 0 ? colors.accent : colors.card }]}>
                                <View style={[styles.decorativeCircle, { backgroundColor: activeVacuums > 0 ? 'rgba(255,255,255,0.1)' : colors.border + '30' }]} />

                                <View style={styles.heroCardHeader}>
                                    <View style={[styles.iconBubble, { backgroundColor: activeVacuums > 0 ? 'rgba(255,255,255,0.2)' : colors.background }]}>
                                        <Bot size={22} color={activeVacuums > 0 ? '#fff' : colors.accent} />
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
                                        backgroundColor: robi?.state === 'cleaning' ? colors.accent : (activeVacuums > 0 ? 'rgba(255,255,255,0.4)' : colors.border)
                                    }]} />
                                </View>
                            </View>
                        </Pressable>
                        <HeroStatCard
                            icon={Tv}
                            iconColor={colors.accent}
                            value={playingMediaCount}
                            total={mediaPlayers.length}
                            label="Wiedergabe"
                            gradient={[colors.accent, colors.accent + 'CC']}
                            isActive={playingMediaCount > 0}
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
                            gradient={[colors.accent, colors.accent + 'CC']}
                            isActive={camerasCount > 0}
                            cardWidth={cardWidth}
                            onPress={openCamerasModal}
                        />
                    </View>
                </View>



            </ScrollView >

            {/* LIGHTS MODAL */}
            {/* LIGHTS MODAL */}
            <Modal visible={activeModal === 'lights'} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={[styles.modalHeader, { backgroundColor: colors.accent }]}>
                            <Text style={styles.modalTitle}>Lichter ({lightsOn} an)</Text>
                            <Pressable onPress={closeModal} style={styles.closeBtn}><X size={24} color="#fff" /></Pressable>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.modalGrid}>
                                {/* Full-width "Alle Lichter" action bar */}
                                <View style={{ width: '100%', flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                                    <Pressable
                                        onPress={handleAllLightsOn}
                                        style={({ pressed }) => [{
                                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            paddingVertical: 14, borderRadius: 14,
                                            backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1,
                                        }]}
                                    >
                                        <Lightbulb size={18} color="#fff" />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Alle An</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={handleAllLightsOff}
                                        style={({ pressed }) => [{
                                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            paddingVertical: 14, borderRadius: 14,
                                            backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1,
                                        }]}
                                    >
                                        <Lightbulb size={18} color={colors.subtext} />
                                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>Alle Aus</Text>
                                    </Pressable>
                                </View>
                                {lights.map(l => (
                                    <View key={l.entity_id} style={{ width: tileWidth }}>
                                        <Tile
                                            label={l.attributes.friendly_name?.replace(' Licht', '').replace(' Lampen', '') || l.entity_id}
                                            subtext={l.state === 'on' ? 'An' : 'Aus'}
                                            icon={Lightbulb}
                                            iconColor={colors.subtext}
                                            activeColor={colors.accent}
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
                                {/* Full-width "Alle Rollläden" action bar */}
                                <View style={{ width: '100%', flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                                    <Pressable
                                        onPress={handleAllCoversOpen}
                                        style={({ pressed }) => [{
                                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            paddingVertical: 14, borderRadius: 14,
                                            backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1,
                                        }]}
                                    >
                                        <Blinds size={18} color="#fff" />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Alle Hoch</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={handleAllCoversClose}
                                        style={({ pressed }) => [{
                                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            paddingVertical: 14, borderRadius: 14,
                                            backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1,
                                        }]}
                                    >
                                        <Blinds size={18} color={colors.subtext} />
                                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>Alle Runter</Text>
                                    </Pressable>
                                </View>
                                {covers.map(c => {
                                    return (
                                        <View key={c.entity_id} style={{ width: tileWidth }}>
                                            <Pressable
                                                onPress={() => {
                                                    // Close covers modal first, then open shutter control modal
                                                    setActiveModal(null);
                                                    setSelectedCover(c);
                                                }}
                                                style={({ pressed }) => [
                                                    styles.tile,
                                                    { backgroundColor: colors.card, borderColor: colors.border },
                                                    (c.state === 'open' || c.attributes.current_position > 0) && styles.tileActiveCover,
                                                    (c.state === 'opening' || c.state === 'closing') && { borderColor: '#F97316', borderWidth: 2, backgroundColor: 'rgba(249, 115, 22, 0.1)' },
                                                    pressed && { opacity: 0.8 }
                                                ]}
                                            >
                                                {/* My Position Star (top-left, not covering %) */}
                                                {c.myPositionEntity && (
                                                    <Pressable
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                            pressButton(c.myPositionEntity!);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            top: 8,
                                                            left: 8,
                                                            width: 28,
                                                            height: 28,
                                                            borderRadius: 14,
                                                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderWidth: 1,
                                                            borderColor: 'rgba(245, 158, 11, 0.3)',
                                                            zIndex: 10,
                                                        }}
                                                    >
                                                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                                                    </Pressable>
                                                )}

                                                <View style={styles.tileHeader}>
                                                    <View style={[styles.tileIcon, { backgroundColor: (c.state === 'open' || c.attributes.current_position > 0) ? colors.accent : colors.background }]}>
                                                        <Blinds size={24} color={(c.state === 'open' || c.attributes.current_position > 0) ? '#FFF' : colors.accent} />
                                                    </View>
                                                    <Text style={[styles.tileState, { color: colors.subtext }]}>
                                                        {c.attributes?.current_position != null ? `${c.attributes.current_position}% ` : c.state}
                                                    </Text>
                                                </View>
                                                <Text numberOfLines={1} style={[styles.tileName, { color: colors.text }]}>
                                                    {c.attributes.friendly_name || c.entity_id}
                                                </Text>

                                                {/* Up / Stop / Down Buttons */}
                                                <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                                                    <Pressable
                                                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openCover(c.entity_id); }}
                                                        style={styles.miniBtn}
                                                    >
                                                        <Text style={styles.miniBtnText}>↑</Text>
                                                    </Pressable>
                                                    <Pressable
                                                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); stopCover(c.entity_id); }}
                                                        style={[styles.miniBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
                                                    >
                                                        <Square size={12} color="#EF4444" fill="#EF4444" />
                                                    </Pressable>
                                                    <Pressable
                                                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); closeCover(c.entity_id); }}
                                                        style={styles.miniBtn}
                                                    >
                                                        <Text style={styles.miniBtnText}>↓</Text>
                                                    </Pressable>
                                                </View>
                                            </Pressable>
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
                entityId={robi?.entity_id}
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

            <ShutterControlModal
                visible={!!selectedCover}
                cover={selectedCover}
                onClose={() => setSelectedCover(null)}
                setCoverPosition={setCoverPosition}
                setCoverTiltPosition={setCoverTiltPosition}
                stopCover={stopCover}
                pressButton={pressButton}
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

            <ConnectionWizard
                visible={showWizard}
                onClose={() => setShowWizard(false)}
            />

            <SleepTimerModal
                visible={showSleepTimer}
                onClose={() => setShowSleepTimer(false)}
            />

            {/* Dashboard Media Player Modal (Bottom-Sheet Popup) */}
            <Modal visible={mediaPlayerModalVisible} animationType="slide" transparent={true} onRequestClose={() => setMediaPlayerModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <Pressable style={{ flex: 1 }} onPress={() => setMediaPlayerModalVisible(false)} />
                    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '70%' }}>
                        {(() => {
                            // Use live entity from HA state instead of stale snapshot
                            const livePlayer = activeMediaPlayer ? entities.find(e => e.entity_id === activeMediaPlayer.entity_id) || activeMediaPlayer : null;
                            if (!livePlayer) return null;
                            const isOff = livePlayer.state === 'off';
                            const isPlaying = livePlayer.state === 'playing';
                            const imageUrl = getEntityPictureUrl(livePlayer.attributes?.entity_picture) || null;
                            const mediaTitle = livePlayer.attributes.media_title || 'Unbekanntes Medium';
                            const artist = livePlayer.attributes.media_artist || '';
                            const playerName = livePlayer.attributes.friendly_name || livePlayer.entity_id;
                            const features = livePlayer.attributes.supported_features || 0;
                            const supportsVolume = (features & 4) !== 0;
                            const currentVolume = livePlayer.attributes.volume_level ?? 0.5;
                            const isMuted = livePlayer.attributes.is_volume_muted === true;

                            // Media position / duration for progress bar
                            const mediaDuration = livePlayer.attributes.media_duration || 0;
                            const mediaPosition = livePlayer.attributes.media_position || 0;
                            const positionUpdatedAt = livePlayer.attributes.media_position_updated_at;
                            const elapsed = (() => {
                                if (!positionUpdatedAt || !isPlaying) return mediaPosition;
                                const updatedAt = new Date(positionUpdatedAt).getTime();
                                const now = Date.now();
                                return Math.min(mediaPosition + (now - updatedAt) / 1000, mediaDuration);
                            })();
                            const progressPct = mediaDuration > 0 ? (elapsed / mediaDuration) * 100 : 0;
                            const fmtTime = (s: number) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; };

                            // MASS player resolution (same logic as media page)
                            const getMassPlayerId = (id: string): string | null => {
                                if (!id) return null;
                                const MASS_ID_MAPPING: Record<string, string> = {
                                    'media_player.nest_buro': 'media_player.nest_garage_2',
                                };
                                if (MASS_ID_MAPPING[id]) return MASS_ID_MAPPING[id];
                                if (id.startsWith('media_player.ma_') || id.startsWith('media_player.mass_')) return id;
                                const massId = id.replace('media_player.', 'media_player.mass_');
                                if (entities.find(e => e.entity_id === massId)) return massId;
                                const coreName = id.replace('media_player.', '').replace('nest_', '').replace('google_', '').replace('hub_', '').replace('home_', '');
                                const massCandidate = entities.find(e => (e.entity_id.startsWith('media_player.mass_') || e.entity_id.startsWith('media_player.ma_')) && e.entity_id.includes(coreName));
                                return massCandidate ? massCandidate.entity_id : null;
                            };

                            const resolveTarget = (entityId: string): string => getMassPlayerId(entityId) || entityId;

                            const handlePlayPause = () => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                callService('media_player', isPlaying ? 'media_pause' : 'media_play', resolveTarget(livePlayer.entity_id));
                            };
                            const handleNext = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); callService('media_player', 'media_next_track', resolveTarget(livePlayer.entity_id)); };
                            const handlePrev = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); callService('media_player', 'media_previous_track', resolveTarget(livePlayer.entity_id)); };
                            const handlePower = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); callService('media_player', isOff ? 'turn_on' : 'turn_off', livePlayer.entity_id); };
                            const handleMuteToggle = () => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                callService('media_player', 'volume_mute', resolveTarget(livePlayer.entity_id), { is_volume_muted: !isMuted });
                            };
                            const handleVolumeChange = (value: number) => {
                                callService('media_player', 'volume_set', resolveTarget(livePlayer.entity_id), { volume_level: Math.round(value * 100) / 100 });
                            };
                            const handleShuffle = () => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                const currentShuffle = livePlayer.attributes?.shuffle || false;
                                callService('media_player', 'shuffle_set', livePlayer.entity_id, { shuffle: !currentShuffle });
                            };
                            const handleRepeat = () => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                const current = livePlayer.attributes?.repeat || 'off';
                                const next = current === 'off' ? 'all' : current === 'all' ? 'one' : 'off';
                                callService('media_player', 'repeat_set', livePlayer.entity_id, { repeat: next });
                            };
                            const shuffleOn = livePlayer.attributes?.shuffle === true;
                            const repeatMode = livePlayer.attributes?.repeat || 'off';

                            return (
                                <View style={{ position: 'relative' }}>
                                    {/* Blurred Background - wrapped in View with pointerEvents none */}
                                    {imageUrl && (
                                        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                                            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%', opacity: 0.3 }} blurRadius={50} />
                                        </View>
                                    )}

                                    {/* Handle bar */}
                                    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.subtext + '40' }} />
                                    </View>

                                    {/* Player Name - tappable to switch player */}
                                    <Pressable onPress={() => { setPendingModal('picker'); setMediaPlayerModalVisible(false); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 }}>
                                        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>{playerName}</Text>
                                        <ChevronRight size={14} color={colors.subtext} />
                                    </Pressable>

                                    {/* Content */}
                                    <View style={{ padding: 24, alignItems: 'center' }}>
                                        {/* Artwork */}
                                        <View style={{ width: 160, height: 160, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 10, marginBottom: 20 }}>
                                            {imageUrl ? (
                                                <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                                            ) : (
                                                <View style={{ width: '100%', height: '100%', borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                                                    <Music size={48} color={colors.subtext} />
                                                </View>
                                            )}
                                        </View>

                                        {/* Metadata */}
                                        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 }} numberOfLines={1}>{mediaTitle}</Text>
                                        {artist ? <Text style={{ fontSize: 15, color: colors.subtext, textAlign: 'center' }} numberOfLines={1}>{artist}</Text> : null}

                                        {/* Progress Bar */}
                                        {mediaDuration > 0 && (
                                            <View style={{ width: '100%', marginTop: 16 }}>
                                                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.background, overflow: 'hidden' }}>
                                                    <View style={{ height: '100%', borderRadius: 2, backgroundColor: colors.accent, width: `${Math.min(progressPct, 100)}%` }} />
                                                </View>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                                                    <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '500' }}>{fmtTime(elapsed)}</Text>
                                                    <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '500' }}>{fmtTime(mediaDuration)}</Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* Controls */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 28 }}>
                                            <Pressable onPress={handleShuffle} hitSlop={12} style={{ padding: 8, backgroundColor: shuffleOn ? '#1DB954' + '20' : 'transparent', borderRadius: 16 }}>
                                                <Shuffle size={20} color={shuffleOn ? '#1DB954' : colors.subtext} />
                                            </Pressable>

                                            <Pressable onPress={handlePrev} hitSlop={12} style={{ padding: 10 }}>
                                                <SkipBack size={28} color={colors.text} />
                                            </Pressable>

                                            <Pressable onPress={handlePlayPause} hitSlop={8} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                                                {isPlaying ? <Pause size={28} color="#FFF" fill="#FFF" /> : <Play size={28} color="#FFF" fill="#FFF" style={{ marginLeft: 3 }} />}
                                            </Pressable>

                                            <Pressable onPress={handleNext} hitSlop={12} style={{ padding: 10 }}>
                                                <SkipForward size={28} color={colors.text} />
                                            </Pressable>

                                            <Pressable onPress={handleRepeat} hitSlop={12} style={{ padding: 8, backgroundColor: repeatMode !== 'off' ? '#1DB954' + '20' : 'transparent', borderRadius: 16 }}>
                                                {repeatMode === 'one' ? (
                                                    <Repeat1 size={20} color="#1DB954" />
                                                ) : (
                                                    <Repeat size={20} color={repeatMode === 'all' ? '#1DB954' : colors.subtext} />
                                                )}
                                            </Pressable>
                                        </View>

                                        {/* Volume Slider */}
                                        {supportsVolume && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, width: '100%', paddingHorizontal: 4 }}>
                                                <Pressable onPress={handleMuteToggle} hitSlop={8} style={{ padding: 4 }}>
                                                    {isMuted ? <VolumeX size={20} color={colors.subtext} /> : currentVolume < 0.3 ? <Volume1 size={20} color={colors.text} /> : <Volume2 size={20} color={colors.text} />}
                                                </Pressable>
                                                <Slider
                                                    style={{ flex: 1, height: 36 }}
                                                    minimumValue={0}
                                                    maximumValue={1}
                                                    step={0.02}
                                                    value={currentVolume}
                                                    onSlidingComplete={handleVolumeChange}
                                                    minimumTrackTintColor={isMuted ? colors.subtext : colors.accent}
                                                    maximumTrackTintColor={colors.background}
                                                    thumbTintColor={isMuted ? colors.subtext : colors.accent}
                                                />
                                                <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', minWidth: 32, textAlign: 'right' }}>{Math.round(currentVolume * 100)}%</Text>
                                            </View>
                                        )}

                                        {/* Power & Spotify Row */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 }}>
                                            <Pressable onPress={handlePower} hitSlop={8} style={{ padding: 10, backgroundColor: colors.background, borderRadius: 16 }}>
                                                <Power size={20} color={!isOff ? '#EF4444' : colors.subtext} />
                                            </Pressable>
                                            <Pressable
                                                onPress={() => {
                                                    if (!spotifyToken) {
                                                        if (spotifyPromptAsync) spotifyPromptAsync();
                                                        return;
                                                    }
                                                    setPendingModal('spotify');
                                                    setMediaPlayerModalVisible(false);
                                                }}
                                                hitSlop={8}
                                                style={{ padding: 10, backgroundColor: '#1DB954' + '20', borderRadius: 16 }}
                                            >
                                                <Disc size={20} color="#1DB954" />
                                            </Pressable>
                                            <Pressable
                                                onPress={() => {
                                                    setPendingModal('tunein');
                                                    setMediaPlayerModalVisible(false);
                                                }}
                                                hitSlop={8}
                                                style={{ padding: 10, backgroundColor: '#FF6B00' + '20', borderRadius: 16 }}
                                            >
                                                <Radio size={20} color="#FF6B00" />
                                            </Pressable>
                                        </View>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                </View>
            </Modal>

            {/* Player Picker Modal (Bottom Sheet) */}
            <Modal visible={showPopupPlayerPicker} animationType="slide" transparent={true} onRequestClose={() => setShowPopupPlayerPicker(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowPopupPlayerPicker(false)} />
                    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '70%', padding: 20 }}>
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.subtext + '40' }} />
                        </View>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>Lautsprecher wählen</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {(() => {
                                const getPlayerName = (p: any) => {
                                    const cfg = MEDIA_PLAYER_CONFIG[p.entity_id];
                                    return p.attributes.friendly_name || cfg?.name || p.entity_id;
                                };
                                const groups = mediaPlayers.filter((p: any) => MEDIA_PLAYER_CONFIG[p.entity_id]?.isGroup);
                                const speakers = mediaPlayers.filter((p: any) => MEDIA_PLAYER_CONFIG[p.entity_id]?.type === 'speaker' && !MEDIA_PLAYER_CONFIG[p.entity_id]?.isGroup);
                                const tvs = mediaPlayers.filter((p: any) => MEDIA_PLAYER_CONFIG[p.entity_id]?.type === 'tv');
                                const sections = [
                                    { title: 'Gruppen', data: groups },
                                    { title: 'Lautsprecher', data: speakers },
                                    { title: 'Fernseher', data: tvs },
                                ];
                                return sections.map(s => s.data.length === 0 ? null : (
                                    <View key={s.title} style={{ marginBottom: 12 }}>
                                        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>{s.title}</Text>
                                        {s.data.map((item: any) => {
                                            const isSelected = item.entity_id === activeMediaPlayer?.entity_id;
                                            const isItemPlaying = item.state === 'playing';
                                            const IconComp = MEDIA_PLAYER_CONFIG[item.entity_id]?.type === 'tv' ? Tv : Speaker;
                                            return (
                                                <Pressable
                                                    key={item.entity_id}
                                                    onPress={() => {
                                                        setSelectedPopupPlayer(item.entity_id);
                                                        setActiveMediaPlayer(item);
                                                        setShowPopupPlayerPicker(false);
                                                        // Reopen main media modal after picker closes
                                                        setTimeout(() => setMediaPlayerModalVisible(true), 300);
                                                    }}
                                                    style={{
                                                        flexDirection: 'row', alignItems: 'center', gap: 12,
                                                        backgroundColor: isSelected ? colors.accent + '15' : colors.background,
                                                        borderRadius: 14, padding: 12, marginBottom: 6,
                                                        borderWidth: 1, borderColor: isSelected ? colors.accent + '40' : 'transparent',
                                                    }}
                                                >
                                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isSelected ? colors.accent : colors.card, alignItems: 'center', justifyContent: 'center' }}>
                                                        <IconComp size={20} color={isSelected ? '#FFF' : colors.subtext} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: isSelected ? colors.accent : colors.text, fontSize: 15, fontWeight: isSelected ? '700' : '500' }}>
                                                            {getPlayerName(item)}
                                                        </Text>
                                                        {isItemPlaying && <Text style={{ fontSize: 11, color: '#1DB954', marginTop: 1 }}>Spielt gerade</Text>}
                                                    </View>
                                                    {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />}
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                ));
                            })()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Spotify Playlist Browser Modal */}
            <Modal visible={spotifyPopupVisible} animationType="slide" transparent={true} onRequestClose={() => { setSpotifyPopupVisible(false); setPopupPlaylistTracks([]); setSelectedPopupPlaylistItem(null); }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <Pressable style={{ flex: 1 }} onPress={() => { setSpotifyPopupVisible(false); setPopupPlaylistTracks([]); setSelectedPopupPlaylistItem(null); }} />
                    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%', padding: 20 }}>
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.subtext + '40' }} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            {selectedPopupPlaylistItem && (
                                <Pressable onPress={() => { setPopupPlaylistTracks([]); setSelectedPopupPlaylistItem(null); }} style={{ marginRight: 12, padding: 4 }}>
                                    <ChevronLeft size={24} color={colors.subtext} />
                                </Pressable>
                            )}
                            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                                {selectedPopupPlaylistItem ? selectedPopupPlaylistItem.title : 'Bibliothek'}
                            </Text>
                        </View>

                        {selectedPopupPlaylistItem ? (
                            loadingPopupTracks ? <ActivityIndicator color="#1DB954" size="large" /> : (
                                <>
                                    {/* Shuffle Start */}
                                    <Pressable
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1DB954', padding: 14, borderRadius: 14, marginBottom: 12, justifyContent: 'center', gap: 8 }}
                                        onPress={async () => {
                                            if (!activeMediaPlayer) return;
                                            setSpotifyPopupVisible(false);
                                            setTimeout(() => setMediaPlayerModalVisible(true), 300);
                                            const item = selectedPopupPlaylistItem;
                                            const targetId = activeMediaPlayer.entity_id;
                                            // MASS resolution
                                            const getMassId = (id: string) => {
                                                const map: Record<string, string> = { 'media_player.nest_buro': 'media_player.nest_garage_2' };
                                                if (map[id]) return map[id];
                                                if (id.startsWith('media_player.ma_') || id.startsWith('media_player.mass_')) return id;
                                                const mId = id.replace('media_player.', 'media_player.mass_');
                                                if (entities.find(e => e.entity_id === mId)) return mId;
                                                return null;
                                            };
                                            const massTarget = getMassId(targetId) || targetId;
                                            let contextUri = item.media_content_id;
                                            if (!contextUri.startsWith('spotify:')) contextUri = `spotify:playlist:${contextUri}`;
                                            try {
                                                await callService('media_player', 'turn_on', targetId);
                                                await new Promise(r => setTimeout(r, 2000));
                                                await callService('media_player', 'shuffle_set', massTarget, { shuffle: true });
                                                await callService('media_player', 'play_media', massTarget, { media_content_id: contextUri, media_content_type: 'playlist' });
                                            } catch { try { await callService('music_assistant', 'play_media', massTarget, { media_id: contextUri, media_type: 'playlist' }); } catch { } }
                                            setPopupPlaylistTracks([]); setSelectedPopupPlaylistItem(null);
                                        }}
                                    >
                                        <Shuffle size={20} color="#FFF" />
                                        <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Zufällig abspielen</Text>
                                    </Pressable>
                                    <FlatList
                                        data={popupPlaylistTracks}
                                        keyExtractor={(i, idx) => i.media_content_id + idx}
                                        style={{ maxHeight: 300 }}
                                        renderItem={({ item, index }) => (
                                            <Pressable
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                                                onPress={async () => {
                                                    if (!activeMediaPlayer) return;
                                                    setSpotifyPopupVisible(false);
                                                    setTimeout(() => setMediaPlayerModalVisible(true), 300);
                                                    const targetId = activeMediaPlayer.entity_id;
                                                    const getMassId = (id: string) => {
                                                        const map: Record<string, string> = { 'media_player.nest_buro': 'media_player.nest_garage_2' };
                                                        if (map[id]) return map[id];
                                                        const mId = id.replace('media_player.', 'media_player.mass_');
                                                        if (entities.find(e => e.entity_id === mId)) return mId;
                                                        return null;
                                                    };
                                                    const massTarget = getMassId(targetId) || targetId;
                                                    let uri = selectedPopupPlaylistItem.media_content_id;
                                                    if (!uri.startsWith('spotify:')) uri = `spotify:playlist:${uri}`;
                                                    try {
                                                        await callService('media_player', 'play_media', massTarget, { media_content_id: uri, media_content_type: 'playlist' });
                                                    } catch { try { await callService('music_assistant', 'play_media', massTarget, { media_id: uri, media_type: 'playlist' }); } catch { } }
                                                    setPopupPlaylistTracks([]); setSelectedPopupPlaylistItem(null);
                                                }}
                                            >
                                                <Text style={{ color: colors.subtext, fontSize: 14, width: 30, textAlign: 'center' }}>{index + 1}</Text>
                                                {item.thumbnail ? (
                                                    <Image source={{ uri: getEntityPictureUrl(item.thumbnail) }} style={{ width: 40, height: 40, borderRadius: 4 }} />
                                                ) : (
                                                    <View style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                                        <Music size={18} color={colors.subtext} />
                                                    </View>
                                                )}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text>
                                                </View>
                                                <Play size={16} color={colors.subtext} />
                                            </Pressable>
                                        )}
                                    />
                                </>
                            )
                        ) : (
                            loadingPopupPlaylists ? <ActivityIndicator color="#1DB954" size="large" /> : (
                                <FlatList
                                    data={popupPlaylists}
                                    keyExtractor={i => i.media_content_id}
                                    style={{ maxHeight: 400 }}
                                    renderItem={({ item }) => (
                                        <Pressable
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
                                            onPress={async () => {
                                                setSelectedPopupPlaylistItem(item);
                                                setLoadingPopupTracks(true);
                                                try {
                                                    const spotifyEntity = entities.find(e => e.entity_id.startsWith('media_player.spotify'));
                                                    if (spotifyEntity) {
                                                        const content = await browseMedia(spotifyEntity.entity_id, item.media_content_id, item.media_content_type);
                                                        setPopupPlaylistTracks(content?.children || []);
                                                    }
                                                } catch { } finally { setLoadingPopupTracks(false); }
                                            }}
                                        >
                                            {item.thumbnail ? (
                                                <Image source={{ uri: getEntityPictureUrl(item.thumbnail) }} style={{ width: 48, height: 48, borderRadius: 6 }} />
                                            ) : (
                                                <View style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Music size={22} color={colors.subtext} />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                                                <Text style={{ color: colors.subtext, fontSize: 12 }}>Playlist</Text>
                                            </View>
                                            <ChevronRight size={20} color={colors.subtext} />
                                        </Pressable>
                                    )}
                                />
                            )
                        )}
                    </View>
                </View>
            </Modal>

            {/* TuneIn Radio Browser Modal */}
            <Modal visible={tuneinPopupVisible} animationType="slide" transparent={true} onRequestClose={() => { setTuneinPopupVisible(false); setTuneinItems([]); setTuneinBreadcrumb([]); }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <Pressable style={{ flex: 1 }} onPress={() => { setTuneinPopupVisible(false); setTuneinItems([]); setTuneinBreadcrumb([]); }} />
                    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%', padding: 20 }}>
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.subtext + '40' }} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            {tuneinBreadcrumb.length > 1 && (
                                <Pressable onPress={async () => {
                                    const newBc = [...tuneinBreadcrumb];
                                    newBc.pop();
                                    setTuneinBreadcrumb(newBc);
                                    const prev = newBc[newBc.length - 1];
                                    if (prev.contentId) {
                                        setLoadingTunein(true);
                                        // Resolve MASS player again
                                        const id = activeMediaPlayer?.entity_id || '';
                                        const MASS_MAP: Record<string, string> = { 'media_player.nest_buro': 'media_player.nest_garage_2' };
                                        let massP = MASS_MAP[id] || id;
                                        if (!massP.includes('mass_') && !massP.includes('ma_')) {
                                            const mId = id.replace('media_player.', 'media_player.mass_');
                                            if (entities.find(e => e.entity_id === mId)) massP = mId;
                                        }
                                        try {
                                            const content = await browseMedia(massP, prev.contentId, prev.contentType);
                                            setTuneinItems(content?.children || []);
                                        } catch { } finally { setLoadingTunein(false); }
                                    }
                                }} style={{ marginRight: 12, padding: 4 }}>
                                    <ChevronLeft size={24} color={colors.subtext} />
                                </Pressable>
                            )}
                            <Radio size={22} color="#FF6B00" style={{ marginRight: 8 }} />
                            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                                {tuneinBreadcrumb[tuneinBreadcrumb.length - 1]?.title || 'Radio'}
                            </Text>
                        </View>

                        {loadingTunein ? <ActivityIndicator color="#FF6B00" size="large" /> : (
                            <FlatList
                                data={tuneinItems}
                                keyExtractor={(i, idx) => (i.media_content_id || '') + idx}
                                style={{ maxHeight: 400 }}
                                renderItem={({ item }) => {
                                    const canBrowse = item.can_expand || (item.children && item.children.length > 0);
                                    const isStation = !canBrowse && item.can_play;
                                    return (
                                        <Pressable
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
                                            onPress={async () => {
                                                if (!activeMediaPlayer) return;
                                                if (canBrowse) {
                                                    // Browse deeper
                                                    setLoadingTunein(true);
                                                    const id = activeMediaPlayer.entity_id;
                                                    const MASS_MAP: Record<string, string> = { 'media_player.nest_buro': 'media_player.nest_garage_2' };
                                                    let massP = MASS_MAP[id] || id;
                                                    if (!massP.includes('mass_') && !massP.includes('ma_')) {
                                                        const mId = id.replace('media_player.', 'media_player.mass_');
                                                        if (entities.find(e => e.entity_id === mId)) massP = mId;
                                                    }
                                                    try {
                                                        const content = await browseMedia(massP, item.media_content_id, item.media_content_type);
                                                        setTuneinItems(content?.children || []);
                                                        setTuneinBreadcrumb(b => [...b, { title: item.title, contentId: item.media_content_id, contentType: item.media_content_type }]);
                                                    } catch { Alert.alert('Fehler', 'Navigation fehlgeschlagen'); }
                                                    finally { setLoadingTunein(false); }
                                                } else if (isStation) {
                                                    // Play the station
                                                    setTuneinPopupVisible(false);
                                                    setTuneinItems([]);
                                                    setTuneinBreadcrumb([]);
                                                    setTimeout(() => setMediaPlayerModalVisible(true), 300);
                                                    const id = activeMediaPlayer.entity_id;
                                                    const MASS_MAP: Record<string, string> = { 'media_player.nest_buro': 'media_player.nest_garage_2' };
                                                    let massTarget = MASS_MAP[id] || id;
                                                    if (!massTarget.includes('mass_') && !massTarget.includes('ma_')) {
                                                        const mId = id.replace('media_player.', 'media_player.mass_');
                                                        if (entities.find(e => e.entity_id === mId)) massTarget = mId;
                                                    }
                                                    try {
                                                        await callService('media_player', 'play_media', massTarget, {
                                                            media_content_id: item.media_content_id,
                                                            media_content_type: item.media_content_type || 'music'
                                                        });
                                                    } catch (e) { console.warn('TuneIn play failed', e); }
                                                }
                                            }}
                                        >
                                            {item.thumbnail ? (
                                                <Image source={{ uri: getEntityPictureUrl(item.thumbnail) }} style={{ width: 48, height: 48, borderRadius: canBrowse ? 6 : 24 }} />
                                            ) : (
                                                <View style={{ width: 48, height: 48, borderRadius: canBrowse ? 6 : 24, backgroundColor: '#FF6B00' + '15', alignItems: 'center', justifyContent: 'center' }}>
                                                    {canBrowse ? <Radio size={22} color="#FF6B00" /> : <Play size={22} color="#FF6B00" />}
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: canBrowse ? '600' : '500' }} numberOfLines={1}>{item.title}</Text>
                                                {item.media_content_type && <Text style={{ color: colors.subtext, fontSize: 11 }}>{canBrowse ? 'Kategorie' : 'Sender'}</Text>}
                                            </View>
                                            {canBrowse ? <ChevronRight size={20} color={colors.subtext} /> : <Play size={16} color={'#FF6B00'} />}
                                        </Pressable>
                                    );
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
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

    // Countdown cards (compact: emoji + days only)
    countdownCard: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
    countdownDays: { fontSize: 13, fontWeight: '900' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: '#000' },
    modalContent: { flex: 1, backgroundColor: '#020617' },
    playerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    playerModalContent: { height: 580, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
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

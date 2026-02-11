import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKidsMode } from '../contexts/KidsContext';
import { useTheme } from '../contexts/ThemeContext';
import { X, Lightbulb, Music, Thermometer, Moon, Sun, Star } from 'lucide-react-native';

import { useHomeAssistant } from '../contexts/HomeAssistantContext';

export const KidsDashboard: React.FC = () => {
    const { colors } = useTheme();
    const { setKidsModeActive, config, addScore } = useKidsMode();
    const { entities, toggleLight, callService } = useHomeAssistant();
    const [isCleaning, setIsCleaning] = React.useState(false);
    const [toast, setToast] = React.useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'success' | 'magic' } | null>(null);

    const showToast = (title: string, message: string, type: 'info' | 'success' | 'magic' = 'info') => {
        setToast({ visible: true, title, message, type });
        setTimeout(() => setToast(null), 5000);
    };

    // Get active room config
    const roomConfig = config.rooms?.find(r => r.id === config.activeRoomId);

    const handleCleanupStart = async () => {
        if (!isCleaning) {
            setIsCleaning(true);
        } else {
            // Require Parental PIN to finish
            Alert.prompt(
                "Aufräumen beenden",
                "Bitte gib den Eltern-PIN ein:",
                [
                    { text: "Abbrechen", style: "cancel" },
                    {
                        text: "Bestätigen",
                        onPress: (input?: string) => {
                            if (input === config.parentalPin) {
                                // Show options for parents
                                Alert.alert(
                                    "Eltern-Kontrolle",
                                    "Wie möchtest du das Aufräumen bewerten?",
                                    [
                                        {
                                            text: "Abbrechen (Nichts tun)",
                                            style: "cancel"
                                        },
                                        {
                                            text: "Abzug (-5 Sterne)",
                                            style: "destructive",
                                            onPress: () => {
                                                setIsCleaning(false);
                                                addScore(-5);
                                                Alert.alert("Schade", "Versuch es beim nächsten Mal besser!");
                                            }
                                        },
                                        {
                                            text: "Bestätigen (+10 Sterne)",
                                            onPress: () => {
                                                setIsCleaning(false);
                                                addScore(10);
                                                Alert.alert("Super gemacht!", "Du hast 10 Sterne verdient! 🌟");
                                            }
                                        }
                                    ]
                                );
                            } else {
                                Alert.alert("Falscher PIN", "Hol dir deine Eltern zur Hilfe!");
                            }
                        }
                    }
                ],
                "secure-text"
            );
        }
    };

    if (!roomConfig) return null;

    const lightEntity = roomConfig.lightEntity ? entities.find(e => e.entity_id === roomConfig.lightEntity) : null;
    const isLightOn = lightEntity?.state === 'on';

    const handleExit = () => {
        Alert.prompt(
            "Kindermodus beenden",
            "Bitte gib den PIN ein:",
            [
                { text: "Abbrechen", style: "cancel" },
                {
                    text: "Bestätigen",
                    onPress: (input?: string) => {
                        if (input === config.parentalPin) {
                            setKidsModeActive(false);
                        } else {
                            Alert.alert("Falscher PIN");
                        }
                    }
                }
            ],
            "secure-text"
        );
    };

    const handleScenePress = async (sceneName: string, icon: string, color?: string) => {
        if (!roomConfig.lightEntity) return;

        try {
            if (sceneName === 'Disco') {
                await callService('light', 'turn_on', roomConfig.lightEntity, {
                    effect: 'colorloop',
                    brightness_pct: 100
                });
            } else if (sceneName === 'Schlafen') {
                await callService('light', 'turn_on', roomConfig.lightEntity, {
                    rgb_color: [255, 100, 0],
                    brightness_pct: 10
                });
            } else if (sceneName === 'Lesen') {
                await callService('light', 'turn_on', roomConfig.lightEntity, {
                    rgb_color: [255, 255, 255],
                    brightness_pct: 80
                });
            } else if (sceneName === 'Monsterschutz') {
                await callService('light', 'turn_on', roomConfig.lightEntity, {
                    brightness_pct: 30
                });
                showToast("Monsterschutz aktiviert!", "Keine Angst, die Geister sind weg. 👻", 'magic');
            }
            addScore(1);
            if (sceneName !== 'Monsterschutz') {
                showToast(`${sceneName} aktiviert`, `Viel Spaß mit ${sceneName}!`, 'info');
            }
        } catch (e) {
            console.error('Failed to set scene:', e);
        }
    };

    const handleColorPress = async (rgb: [number, number, number]) => {
        if (!roomConfig.lightEntity) return;
        await callService('light', 'turn_on', roomConfig.lightEntity, {
            rgb_color: rgb,
            brightness_pct: 100
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {roomConfig.backgroundUri && (
                <View style={StyleSheet.absoluteFill}>
                    <Image source={{ uri: roomConfig.backgroundUri }} style={styles.backgroundImage} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                </View>
            )}

            <View style={styles.header}>
                <Pressable onLongPress={handleExit}>
                    <View>
                        <Text style={styles.title}>Hallo, {roomConfig.name}!</Text>
                        <View style={styles.scoreBadge}>
                            <Star size={20} color="#FBBF24" fill="#FBBF24" />
                            <Text style={styles.scoreText}>{roomConfig.score || 0} Sterne</Text>
                        </View>
                    </View>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* --- LIGHTING SECTION --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Lightbulb size={24} color="#FBBF24" />
                        <Text style={styles.sectionTitle}>Mein Licht</Text>
                    </View>

                    <View style={styles.lightToggleRow}>
                        <View style={styles.mainToggleContainer}>
                            <Pressable
                                onPress={() => roomConfig.lightEntity && toggleLight(roomConfig.lightEntity)}
                                style={[
                                    styles.largeToggleButton,
                                    isLightOn ? styles.buttonActive : styles.buttonInactive
                                ]}
                            >
                                <Lightbulb size={40} color={isLightOn ? "#fff" : "rgba(255,255,255,0.3)"} />
                                <Text style={styles.buttonLabel}>{isLightOn ? 'AN' : 'AUS'}</Text>
                            </Pressable>
                        </View>

                        <View style={styles.sceneGrid}>
                            <SceneButton emoji="📖" label="Lesen" onPress={() => handleScenePress('Lesen', '📖')} />
                            <SceneButton emoji="🪩" label="Disco" onPress={() => handleScenePress('Disco', '🪩')} />
                            <SceneButton emoji="👻" label="Schutz" onPress={() => handleScenePress('Monsterschutz', '👻')} />
                            <SceneButton emoji="😴" label="Nacht" onPress={() => handleScenePress('Schlafen', '😴')} />
                        </View>
                    </View>

                    {/* Magic Color Grid */}
                    <View style={styles.colorGrid}>
                        <ColorCircle color="#ef4444" rgb={[255, 0, 0]} onPress={handleColorPress} />
                        <ColorCircle color="#3b82f6" rgb={[0, 0, 255]} onPress={handleColorPress} />
                        <ColorCircle color="#10b981" rgb={[0, 255, 0]} onPress={handleColorPress} />
                        <ColorCircle color="#f59e0b" rgb={[255, 165, 0]} onPress={handleColorPress} />
                        <ColorCircle color="#8b5cf6" rgb={[138, 43, 226]} onPress={handleColorPress} />
                        <ColorCircle color="#ec4899" rgb={[255, 20, 147]} onPress={handleColorPress} />
                    </View>
                </View>

                {/* --- MEDIA SECTION --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Music size={24} color="#A78BFA" />
                        <Text style={styles.sectionTitle}>Musik & Geschichten</Text>
                    </View>

                    {roomConfig.mediaEntity ? (
                        <MediaComponent entityId={roomConfig.mediaEntity} volumeLimit={roomConfig.volumeLimit} />
                    ) : (
                        <View style={styles.placeholderCard}>
                            <Text style={styles.placeholderTextSmall}>Kein Player ausgewählt</Text>
                        </View>
                    )}
                </View>

                {/* --- SLEEP TRAINER --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Thermometer size={24} color="#60A5FA" />
                        <Text style={styles.sectionTitle}>Schlaf-Trainer</Text>
                    </View>

                    {roomConfig.sleepTrainerEntity ? (
                        <SleepTrainerComponent entityId={roomConfig.sleepTrainerEntity} lightEntity={roomConfig.lightEntity} onShowToast={showToast} />
                    ) : (
                        <View style={styles.placeholderCard}>
                            <Text style={styles.placeholderTextSmall}>Kein Schlaf-Trainer ausgewählt</Text>
                        </View>
                    )}
                </View>
                {/* --- GAMIFICATION --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Star size={24} color="#FBBF24" />
                        <Text style={styles.sectionTitle}>Aufräumen & Belohnung</Text>
                    </View>

                    <Pressable
                        onPress={handleCleanupStart}
                        style={[styles.cleanupCard, isCleaning && styles.cleanupActive]}
                    >
                        <View style={styles.cleanupIcon}>
                            <Star size={32} color={isCleaning ? "#fff" : "#FBBF24"} fill={isCleaning ? "#fff" : "transparent"} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.cleanupTitle, { color: isCleaning ? "#fff" : "#FBBF24" }]}>
                                {isCleaning ? 'Ich räume gerade auf!' : 'Aufräum-Modus'}
                            </Text>
                            <Text style={[styles.cleanupSubtext, { color: isCleaning ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.6)" }]}>
                                {isCleaning ? 'Tippe wenn du fertig bist für +10 Sterne!' : 'Verdiene 10 Bonus-Sterne für ein sauberes Zimmer!'}
                            </Text>
                        </View>
                    </Pressable>
                </View>
            </ScrollView>
            {/* --- TOAST NOTIFICATION --- */}
            {toast && (
                <View style={[styles.toastContainer, {
                    backgroundColor: toast.type === 'magic' ? 'rgba(139, 92, 246, 0.95)' :
                        toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' :
                            'rgba(30, 41, 59, 0.95)'
                }]}>
                    <View style={styles.toastIcon}>
                        {toast.type === 'magic' ? <Star size={24} color="#FBBF24" fill="#FBBF24" /> :
                            toast.type === 'success' ? <Lightbulb size={24} color="#fff" /> :
                                <Moon size={24} color="#60A5FA" />}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.toastTitle}>{toast.title}</Text>
                        <Text style={styles.toastMessage}>{toast.message}</Text>
                    </View>
                    <Pressable onPress={() => setToast(null)} style={{ padding: 8 }}>
                        <X size={20} color="rgba(255,255,255,0.5)" />
                    </Pressable>
                </View>
            )}
        </SafeAreaView>
    );
};

const SceneButton = ({ emoji, label, onPress }: { emoji: string, label: string, onPress: () => void }) => (
    <Pressable onPress={onPress} style={styles.sceneButton}>
        <Text style={styles.sceneEmoji}>{emoji}</Text>
        <Text style={styles.sceneLabel}>{label}</Text>
    </Pressable>
);

const ColorCircle = ({ color, rgb, onPress }: { color: string, rgb: [number, number, number], onPress: (rgb: [number, number, number]) => void }) => (
    <Pressable onPress={() => onPress(rgb)} style={[styles.colorCircle, { backgroundColor: color }]} />
);

const MediaComponent = ({ entityId, volumeLimit }: { entityId: string, volumeLimit: number }) => {
    const { entities, callService, getEntityPictureUrl } = useHomeAssistant();
    const entity = entities.find(e => e.entity_id === entityId);
    if (!entity) return null;

    const isPlaying = entity.state === 'playing';
    const volume = entity.attributes.volume_level || 0;
    const coverUrl = getEntityPictureUrl(entity.attributes.entity_picture);

    const handleVolume = async (newVol: number) => {
        const cappedVol = Math.min(newVol, volumeLimit);
        await callService('media_player', 'volume_set', entityId, { volume_level: cappedVol });
    };

    const togglePlay = async () => {
        await callService('media_player', isPlaying ? 'media_pause' : 'media_play', entityId);
    };

    return (
        <View style={styles.mediaCard}>
            <View style={styles.mediaInfo}>
                <View style={styles.coverContainer}>
                    {coverUrl ? (
                        <Image source={{ uri: coverUrl }} style={styles.mediaCover} />
                    ) : (
                        <View style={[styles.mediaCover, { backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }]}>
                            <Music size={40} color="rgba(255,255,255,0.2)" />
                        </View>
                    )}
                </View>
                <View style={styles.mediaDetails}>
                    <Text numberOfLines={1} style={styles.mediaTitle}>{entity.attributes.media_title || 'Nichts wird abgespielt'}</Text>
                    <Text numberOfLines={1} style={styles.mediaArtist}>{entity.attributes.media_artist || 'Wähle eine Geschichte'}</Text>
                </View>
            </View>

            <View style={styles.mediaControls}>
                <Pressable onPress={() => handleVolume(Math.max(0, volume - 0.05))} style={styles.volumeBtn}>
                    <Text style={styles.volumeText}>-</Text>
                </Pressable>

                <Pressable onPress={togglePlay} style={styles.playBtn}>
                    <View style={[styles.playBtnInner, { backgroundColor: isPlaying ? '#A78BFA' : '#10B981' }]}>
                        {isPlaying ? <View style={styles.pauseIcon} /> : <View style={styles.playIcon} />}
                    </View>
                </Pressable>

                <Pressable onPress={() => handleVolume(Math.min(volumeLimit, volume + 0.05))} style={styles.volumeBtn}>
                    <Text style={styles.volumeText}>+</Text>
                </Pressable>
            </View>

            {/* Volume indicator */}
            <View style={styles.volumeBarContainer}>
                <View style={[styles.volumeBar, { width: `${(volume / 1) * 100}%`, backgroundColor: volume > volumeLimit ? '#EF4444' : '#60A5FA' }]} />
            </View>
        </View>
    );
};

const SleepTrainerComponent = ({ entityId, lightEntity, onShowToast }: { entityId: string, lightEntity?: string, onShowToast: (t: string, m: string, type: any) => void }) => {
    const { entities, callService } = useHomeAssistant();
    const entity = entities.find(e => e.entity_id === entityId);

    // Status can be 'home', 'not_home', 'on', 'off', or a specific select value
    const state = entity?.state || 'off';
    const isSchedule = entityId.startsWith('schedule.');

    // Logic:
    // 1. Normal Switch/Input Boolean: 'on' = Awake (Light is on), 'off' = Sleep (Light is off)
    // 2. Schedule: 'on' = Active (Sleep Time), 'off' = Inactive (Awake Time)

    let isSleep, isAwake;

    if (isSchedule) {
        isSleep = state === 'on';
        isAwake = state === 'off';
    } else {
        isSleep = state === 'sleep' || state === 'off' || state === 'locked';
        isAwake = state === 'awake' || state === 'on' || state === 'unlocked';
    }

    const handlePress = async () => {
        if (!lightEntity) return;

        if (isSleep) {
            // Galaxy Scene for Sleep Time
            await callService('light', 'turn_on', lightEntity, {
                rgb_color: [59, 130, 246], // Blueish
                brightness_pct: 30,
                effect: 'galaxy' // Many smart lights support this or similar effects
            });
            onShowToast("Psst...", "Es ist noch Schlafenszeit. Träum etwas Schönes! 🌙", 'magic');
        } else if (isAwake) {
            // Active Light for Awake Time
            await callService('light', 'turn_on', lightEntity, {
                rgb_color: [255, 255, 255], // White
                brightness_pct: 100
            });
            onShowToast("Guten Morgen!", "Der Tag kann beginnen! ☀️", 'success');
        }
    };

    return (
        <Pressable
            onPress={handlePress}
            style={({ pressed }) => [
                styles.sleepTrainerCard,
                { backgroundColor: isAwake ? 'rgba(251, 191, 36, 0.15)' : 'rgba(30, 58, 138, 0.3)' },
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
            ]}
        >
            <View style={styles.sleepIconContainer}>
                {isAwake ? (
                    <Sun size={60} color="#FBBF24" fill="#FBBF24" />
                ) : (
                    <Moon size={60} color="#60A5FA" fill="#60A5FA" />
                )}
            </View>
            <View style={styles.sleepTextContainer}>
                <Text style={[styles.sleepStatus, { color: isAwake ? '#FBBF24' : '#60A5FA' }]}>
                    {isAwake ? 'Guten Morgen!' : 'Schlafenszeit'}
                </Text>
                <Text style={styles.sleepSubtext}>
                    {isAwake ? 'Du darfst aufstehen! Tippe für Licht an.' : 'Pst... Tippe für Sternenhimmel.'}
                </Text>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
    },
    scoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
    },
    scoreText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 6,
    },
    exitBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: 24,
    },
    // Sleep Trainer
    sleepTrainerCard: {
        borderRadius: 32,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    sleepIconContainer: {
        marginRight: 20,
    },
    sleepTextContainer: {
        flex: 1,
    },
    sleepStatus: {
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 4,
    },
    sleepSubtext: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        lineHeight: 20,
    },
    section: {
        marginBottom: 32,
        width: '100%',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginLeft: 10,
    },
    lightToggleRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    mainToggleContainer: {
        flex: 1,
    },
    largeToggleButton: {
        height: 140,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonActive: {
        backgroundColor: '#FBBF24',
    },
    buttonInactive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    buttonLabel: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 18,
        marginTop: 12,
    },
    sceneGrid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    sceneButton: {
        width: '46%',
        height: 64,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    sceneEmoji: {
        fontSize: 24,
    },
    sceneLabel: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 12,
        marginLeft: 8,
    },
    colorGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
    },
    colorCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    placeholderCard: {
        height: 100,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    placeholderTextSmall: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 14,
    },
    // Media Styles
    mediaCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 32,
        padding: 20,
        width: '100%',
    },
    mediaInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    coverContainer: {
        width: 80,
        height: 80,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    mediaCover: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    mediaDetails: {
        marginLeft: 16,
        flex: 1,
    },
    mediaTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    mediaArtist: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
    },
    mediaControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
    },
    volumeBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    volumeText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    playBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        padding: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    playBtnInner: {
        flex: 1,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIcon: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 25,
        borderRightWidth: 0,
        borderBottomWidth: 15,
        borderTopWidth: 15,
        borderLeftColor: 'white',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderTopColor: 'transparent',
        marginLeft: 8,
    },
    pauseIcon: {
        width: 20,
        height: 25,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderColor: 'white',
        borderStyle: 'solid',
    },
    volumeBarContainer: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        marginTop: 24,
        overflow: 'hidden',
    },
    volumeBar: {
        height: '100%',
        borderRadius: 3,
    },
    // Cleanup Styles
    cleanupCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 32,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cleanupActive: {
        backgroundColor: '#10B981',
        borderColor: 'rgba(255,255,255,0.2)',
    },
    cleanupIcon: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 20,
    },
    cleanupTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    cleanupSubtext: {
        fontSize: 14,
        lineHeight: 20,
    },
    // Toast Styles
    toastContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 1000,
    },
    toastIcon: {
        marginRight: 16,
    },
    toastTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 2,
    },
    toastMessage: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    }
});

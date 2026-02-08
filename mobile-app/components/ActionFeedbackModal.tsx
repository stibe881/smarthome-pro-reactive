import React, { useMemo, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, Animated } from 'react-native';
import { Moon, Sun, Clapperboard, Blinds, Bot, Check, Sparkles, Coffee, Popcorn, Zap, Shield, BedDouble } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

type ActionType = 'sleep' | 'morning' | 'movie' | 'covers_open' | 'covers_close' | 'vacuum' | 'shop_debug';

interface ActionFeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    type: ActionType;
}

const FEEDBACK_CONFIG = {
    sleep: {
        icon: Moon,
        colors: ['#312e81', '#1e1b4b'], // Indigo to dark slate
        accent: '#818cf8',
        titles: ['Gute Nacht', 'Schlafenszeit', 'Ruhemodus', 'Bis Morgen', 'Sweet Dreams'],
        messages: [
            'Schlaf gut und träum was Süsses! 🌙',
            'Alle Lichter gehen aus. Bis morgen! 💤',
            'Das Haus passt auf dich auf. Ruh dich aus.',
            'Systeme fahren herunter... Gute Nacht!',
            'Energie sparen für den neuen Tag. 🔋'
        ]
    },
    morning: {
        icon: Sun,
        colors: ['#f59e0b', '#d97706'], // Amber
        accent: '#fcd34d',
        titles: ['Guten Morgen', 'Hallo Welt', 'Aufstehen!', 'Neuer Tag', 'Morning Vibes'],
        messages: [
            'Ein wundervoller Tag wartet auf dich! ☀️',
            'Kaffee ist hoffentlich schon fertig? ☕',
            'Lass uns den Tag starten!',
            'Die Sonne lacht (hoffentlich)!',
            'Alles ist bereit für einen grossartigen Tag.'
        ]
    },
    movie: {
        icon: Clapperboard,
        colors: ['#db2777', '#9d174d'], // Pink/Rose
        accent: '#fbcfe8',
        titles: ['Film ab!', 'Kinozeit', 'Blockbuster', 'Pssst...', 'Entertainment'],
        messages: [
            'Popcorn bereit halten! 🍿',
            'Licht aus, Film an. Viel Spass!',
            'Ruhe im Saal, der Film beginnt.',
            'Entspann dich und geniess die Show.',
            'Kinomodus aktiviert. 🎬'
        ]
    },
    covers_open: {
        icon: Blinds,
        colors: ['#3b82f6', '#1d4ed8'], // Blue
        accent: '#93c5fd',
        titles: ['Licht herein', 'Hell & Freundlich', 'Fensterblick', 'Auf gehts', 'Sonne tanken'],
        messages: [
            'Die Rollläden fahren hoch. hallo Welt!',
            'Lass die Sonne rein! ☀️',
            'Maximale Helligkeit aktiviert.',
            'Freier Blick nach draussen.',
            'Zeit für etwas Tageslicht.'
        ]
    },
    covers_close: {
        icon: Blinds,
        colors: ['#334155', '#0f172a'], // Slate
        accent: '#94a3b8',
        titles: ['Privatsphäre', 'Verdunkelung', 'Schotten dicht', 'Höhlenmodus', 'Alles zu'],
        messages: [
            'Privatsphäre-Modus aktiviert. 🛡️',
            'Die Welt bleibt draussen.',
            'Gemütlichkeit beginnt jetzt.',
            'Schotten werden dicht gemacht.',
            'Alles zu für mehr Ruhe.'
        ]
    },
    vacuum: {
        icon: Bot,
        colors: ['#10b981', '#047857'], // Emerald
        accent: '#6ee7b7',
        titles: ['Reinigung', 'Röbi startet', 'Putzteufel', 'Saubermacher', 'Attacke'],
        messages: [
            'Ich kümmere mich um den Dreck! 🧹',
            'Krümelmonster, zieh dich warm an!',
            'Röbi ist unterwegs. Füsse hoch!',
            'Saugmodus: Maximale Kraft.',
            'Wir machen das sauber.'
        ]
    },
    shop_debug: {
        icon: Sparkles,
        colors: ['#ef4444', '#b91c1c'], // Red
        accent: '#fca5a5',
        titles: ['Debugging', 'Systemcheck', 'Logiktest', 'Internes', 'Geofencing'],
        messages: [
            'Einkaufslogik wird geprüft... 🛒',
            'Debug-Daten werden generiert.',
            'Systemstatus: Analysiere...',
            'Ein Blick unter die Haube.',
            'Developers only! 🤓'
        ]
    }
};

export default function ActionFeedbackModal({ visible, onClose, type }: ActionFeedbackModalProps) {
    const config = FEEDBACK_CONFIG[type] || FEEDBACK_CONFIG.shop_debug;

    // Pick random message & title on mount/visible change (memoized to strictly change only when type/visible changes)
    const { message, title } = useMemo(() => {
        if (!visible) return { message: '', title: '' };
        const randMsg = config.messages[Math.floor(Math.random() * config.messages.length)];
        const randTitle = config.titles[Math.floor(Math.random() * config.titles.length)];
        return { message: randMsg, title: randTitle };
    }, [visible, type]);

    // Auto-Close after 5 seconds
    useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [visible, onClose]);

    const Icon = config.icon;

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Blur Effect Background */}
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                </Pressable>

                <View style={[styles.card, { borderColor: config.colors[0] }]}>
                    {/* Header Gradient */}
                    <View style={[styles.header, { backgroundColor: config.colors[0] }]}>
                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                            <Icon size={32} color="#fff" />
                        </View>
                    </View>

                    <View style={styles.content}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>

                        <Pressable
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.button,
                                { backgroundColor: config.colors[0], opacity: pressed ? 0.9 : 1 }
                            ]}
                        >
                            <Text style={styles.buttonText}>Alles klar</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#1E293B',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    header: {
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});

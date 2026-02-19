import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Switch } from 'react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';
import { Server, Key, CheckCircle2, ChevronRight, X, Wifi, Shield, Zap, Sparkles, LogOut, Lightbulb, Blinds, UtensilsCrossed, ChevronLeft, Search, Check, Speaker, Tv } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ConnectionWizardProps {
    visible: boolean;
    onClose: () => void;
}

interface MappingState {
    lights: { enabled: boolean; entities: { id: string; name: string }[] };
    covers: { enabled: boolean; entities: { id: string; name: string }[] };
    mediaPlayers: { enabled: boolean; entities: { id: string; name: string }[] };
    appliances: { enabled: boolean; entities: { id: string; name: string }[] };
}

export const ConnectionWizard = ({ visible, onClose }: ConnectionWizardProps) => {
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const { logout } = useAuth();
    const { connect, saveCredentials, isConnecting, isConnected, haBaseUrl, entities, saveDashboardConfig, dashboardConfig } = useHomeAssistant();

    const [step, setStep] = useState(1);
    const [url, setUrl] = useState('');
    const [token, setToken] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    // Mapping state
    const [mapping, setMapping] = useState<MappingState>({
        lights: { enabled: true, entities: [] },
        covers: { enabled: true, entities: [] },
        mediaPlayers: { enabled: true, entities: [] },
        appliances: { enabled: true, entities: [] }
    });

    const [searchQuery, setSearchQuery] = useState('');

    // Pre-fill from current config if available
    useEffect(() => {
        if (dashboardConfig) {
            setMapping({
                lights: { enabled: true, entities: dashboardConfig.lights || [] },
                covers: { enabled: true, entities: dashboardConfig.covers || [] },
                mediaPlayers: { enabled: true, entities: dashboardConfig.mediaPlayers || [] },
                appliances: { enabled: true, entities: [] }
            });
        }
    }, [dashboardConfig, visible]);

    const handleConnect = async () => {
        if (!url.trim() || !token.trim()) {
            Alert.alert('Fehler', 'Bitte gib eine URL und einen Token ein.');
            return;
        }

        setIsTesting(true);
        try {
            await saveCredentials(url.trim(), token.trim());
            const success = await connect();
            if (success) {
                setStep(2);
            } else {
                Alert.alert('Verbindung fehlgeschlagen', 'Bitte überprüfe die URL und den Token.');
            }
        } catch (e) {
            Alert.alert('Fehler', 'Es konnte keine Verbindung hergestellt werden.');
        } finally {
            setIsTesting(false);
        }
    };

    const handleFinish = async () => {
        const config = {
            ...dashboardConfig,
            lights: mapping.lights.enabled ? mapping.lights.entities : [],
            covers: mapping.covers.enabled ? mapping.covers.entities : [],
            mediaPlayers: mapping.mediaPlayers.enabled ? mapping.mediaPlayers.entities : [],
        };
        await saveDashboardConfig(config);
        onClose();
    };

    const filteredEntities = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return entities.filter(e =>
            e.entity_id.toLowerCase().includes(query) ||
            (e.attributes.friendly_name || '').toLowerCase().includes(query)
        );
    }, [entities, searchQuery]);

    const toggleEntity = (type: keyof MappingState, id: string, name: string) => {
        setMapping(prev => {
            const current = prev[type].entities;
            const exists = current.find(e => e.id === id);
            if (exists) {
                return { ...prev, [type]: { ...prev[type], entities: current.filter(e => e.id !== id) } };
            } else {
                return { ...prev, [type]: { ...prev[type], entities: [...current, { id, name }] } };
            }
        });
    };

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
                <Server size={32} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Willkommen!</Text>
            <Text style={[styles.description, { color: colors.subtext }]}>
                Verbinde die App mit deinem Home Assistant, um dein Zuhause zu steuern.
            </Text>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.subtext }]}>Home Assistant URL</Text>
                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                    placeholder="https://deine-url.ui.nabu.casa"
                    placeholderTextColor={colors.subtext}
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.subtext }]}>Long-Lived Access Token</Text>
                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, height: 100 }]}
                    placeholder="Dein Token..."
                    placeholderTextColor={colors.subtext}
                    value={token}
                    onChangeText={setToken}
                    multiline
                    autoCapitalize="none"
                />
            </View>

            <Pressable
                onPress={handleConnect}
                disabled={isTesting}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            >
                {isTesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verbindung testen</Text>}
            </Pressable>

            <Pressable onPress={logout} style={styles.logoutBtn}>
                <LogOut size={16} color={colors.subtext} />
                <Text style={{ color: colors.subtext, marginLeft: 6 }}>Abmelden</Text>
            </Pressable>
        </View>
    );

    const renderMappingStep = (type: keyof MappingState, title: string, desc: string, icon: any, domain: string) => {
        const category = mapping[type];
        const suggestedEntities = entities.filter(e => e.entity_id.startsWith(domain + '.') && !e.attributes.hidden);

        return (
            <View style={styles.stepContainer}>
                <View style={[styles.iconCircle, { backgroundColor: colors.accent + '20' }]}>
                    {React.createElement(icon, { size: 32, color: colors.accent })}
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.description, { color: colors.subtext }]}>{desc}</Text>

                <View style={[styles.featureToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.featureLabel, { color: colors.text }]}>Diese Funktion nutzen?</Text>
                    <Switch
                        value={category.enabled}
                        onValueChange={(val) => setMapping(prev => ({ ...prev, [type]: { ...prev[type], enabled: val } }))}
                        trackColor={{ false: colors.border, true: colors.accent }}
                    />
                </View>

                {category.enabled && (
                    <View style={{ width: '100%' }}>
                        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Search size={18} color={colors.subtext} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Geräte suchen..."
                                placeholderTextColor={colors.subtext}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        <Text style={[styles.listHeader, { color: colors.subtext }]}>Gefundene Geräte:</Text>
                        <View style={styles.entityList}>
                            {(searchQuery ? filteredEntities.filter(e => e.entity_id.startsWith(domain + '.')) : suggestedEntities).slice(0, 10).map(e => {
                                const isSelected = category.entities.find(item => item.id === e.entity_id);
                                return (
                                    <Pressable
                                        key={e.entity_id}
                                        onPress={() => toggleEntity(type, e.entity_id, e.attributes.friendly_name || e.entity_id)}
                                        style={[styles.entityItem, { backgroundColor: colors.card, borderColor: isSelected ? colors.accent : colors.border, borderLeftWidth: 4, borderLeftColor: isSelected ? colors.accent : 'transparent' }]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.entityName, { color: colors.text }]} numberOfLines={1}>
                                                {e.attributes.friendly_name || e.entity_id}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: colors.subtext }}>{e.entity_id}</Text>
                                        </View>
                                        {isSelected && <Check size={18} color={colors.accent} />}
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={[styles.counter, { color: colors.subtext }]}>
                            {category.entities.length} Geräte für Dashboard ausgewählt
                        </Text>
                    </View>
                )}

                <View style={styles.buttonRow}>
                    <Pressable onPress={() => setStep(step - 1)} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                        <ChevronLeft size={20} color={colors.text} />
                        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Zurück</Text>
                    </Pressable>
                    <Pressable onPress={() => { setStep(step + 1); setSearchQuery(''); }} style={[styles.primaryButton, { backgroundColor: colors.accent, flex: 1, marginTop: 0 }]}>
                        <Text style={styles.primaryButtonText}>Weiter</Text>
                        <ChevronRight size={20} color="#fff" />
                    </Pressable>
                </View>
            </View>
        );
    };

    const renderStep6 = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.success + '20' }]}>
                <CheckCircle2 size={42} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Alles bereit!</Text>
            <Text style={[styles.description, { color: colors.subtext }]}>
                Dein Dashboard wurde personalisiert. Du kannst diese Einstellungen jederzeit im Optionen-Menü ändern.
            </Text>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.infoRow}>
                    <Check size={18} color={colors.success} />
                    <Text style={[styles.infoText, { color: colors.text }]}>{mapping.lights.entities.length} Lichter gemappt</Text>
                </View>
                <View style={styles.infoRow}>
                    <Check size={18} color={colors.success} />
                    <Text style={[styles.infoText, { color: colors.text }]}>{mapping.covers.entities.length} Rollläden gemappt</Text>
                </View>
            </View>

            <Pressable
                onPress={handleFinish}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            >
                <Text style={styles.primaryButtonText}>Onboarding abschließen</Text>
            </Pressable>
        </View>
    );

    const renderContent = () => {
        switch (step) {
            case 1: return renderStep1();
            case 2: return renderMappingStep('lights', 'Beleuchtung', 'Wähle die Lichter aus, die du auf dem Dashboard steuern möchtest.', Lightbulb, 'light');
            case 3: return renderMappingStep('covers', 'Rollläden', 'Wähle deine Storen oder Markisen aus. Diese erscheinen dann in der Übersicht.', Blinds, 'cover');
            case 4: return renderMappingStep('mediaPlayers', 'Media Player', 'Wähle deine Lautsprecher, Gruppen oder TVs aus.', Speaker, 'media_player');
            case 5: return renderMappingStep('appliances', 'Hausgeräte', 'Wähle Sensoren für Waschmaschine oder Geschirrspüler aus.', UtensilsCrossed, 'sensor');
            case 6: return renderStep6();
            default: return null;
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <LinearGradient colors={[colors.background, colors.card] as any} style={styles.container}>
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.modalHeader}>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={colors.subtext} />
                        </Pressable>
                    </View>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        {renderContent()}
                    </ScrollView>
                </SafeAreaView>
            </LinearGradient>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 60 },
    stepContainer: { alignItems: 'center' },
    iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, marginTop: 20 },
    title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
    description: { fontSize: 16, textAlign: 'center', marginBottom: 32, lineHeight: 24 },
    inputGroup: { width: '100%', marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { borderWidth: 1, padding: 16, borderRadius: 14, fontSize: 15 },
    primaryButton: { width: '100%', padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 8 },
    primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    secondaryButton: { padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, gap: 8 },
    secondaryButtonText: { fontSize: 16, fontWeight: '600' },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
    featureToggle: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
    featureLabel: { fontSize: 16, fontWeight: '600' },
    searchBar: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: 20, gap: 12 },
    searchInput: { flex: 1, fontSize: 15 },
    listHeader: { width: '100%', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, opacity: 0.7 },
    entityList: { width: '100%', gap: 8 },
    entityItem: { width: '100%', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    entityName: { fontSize: 15, fontWeight: '500' },
    counter: { marginTop: 16, fontSize: 14, opacity: 0.8 },
    infoCard: { width: '100%', padding: 20, borderRadius: 20, borderWidth: 1, marginVertical: 32, gap: 16 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    infoText: { fontSize: 15, fontWeight: '500' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 32, padding: 12 },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 20,
        zIndex: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { X, Sun, CloudRain, Moon, Wind, Cloud } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';

interface WeatherForecastModalProps {
    visible: boolean;
    onClose: () => void;
    weatherEntity: any;
}

export default function WeatherForecastModal({ visible, onClose, weatherEntity }: WeatherForecastModalProps) {
    const { fetchWeatherForecast } = useHomeAssistant();
    const [forecast, setForecast] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch forecast when modal opens
    useEffect(() => {
        if (visible && weatherEntity?.entity_id) {
            setLoading(true);
            fetchWeatherForecast(weatherEntity.entity_id, 'daily')
                .then((data) => {
                    console.log('Fetched forecast:', data);
                    setForecast(data || []);
                })
                .catch((err) => {
                    console.error('Failed to fetch forecast:', err);
                    setForecast([]);
                })
                .finally(() => setLoading(false));
        }
    }, [visible, weatherEntity?.entity_id]);

    if (!weatherEntity) return null;

    // Icon mapping (Simplified based on HA standard)
    const getIcon = (condition: string) => {
        switch (condition) {
            case 'sunny': return Sun;
            case 'clear-night': return Moon;
            case 'partlycloudy': return Cloud;
            case 'cloudy': return Cloud;
            case 'rainy': return CloudRain;
            case 'pouring': return CloudRain;
            case 'fog': return Wind;
            case 'snowy': return CloudRain;
            case 'windy': return Wind;
            case 'lightning': return CloudRain;
            default: return Sun;
        }
    };

    const getDayName = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', { weekday: 'long' });
    };

    const getDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    };

    const getConditionText = (state: string) => {
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


    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Wettervorhersage</Text>
                            <Text style={styles.modalSubtitle}>Zell LU</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#fff" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={styles.currentWeatherCard}>
                            {(() => {
                                const CurrentIcon = getIcon(weatherEntity.state);
                                return (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                            <View style={styles.largeIconContainer}>
                                                <CurrentIcon size={40} color="#F59E0B" />
                                            </View>
                                            <View>
                                                <Text style={styles.currentTemp}>{weatherEntity.attributes.temperature}°</Text>
                                                <Text style={styles.currentCondition}>{getConditionText(weatherEntity.state)}</Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.humidityText}>Feuchtigkeit</Text>
                                            <Text style={styles.humidityValue}>{weatherEntity.attributes.humidity}%</Text>
                                        </View>
                                    </View>
                                );
                            })()}
                        </View>

                        <Text style={styles.sectionTitle}>7-Tage Vorschau</Text>

                        {loading ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <Text style={{ color: '#94A3B8', marginTop: 16 }}>Lade Vorhersage...</Text>
                            </View>
                        ) : forecast.length > 0 ? (
                            <View style={styles.forecastList}>
                                {forecast.map((day: any, index: number) => {
                                    const DayIcon = getIcon(day.condition);
                                    return (
                                        <View key={index} style={styles.forecastRow}>
                                            <View style={styles.dayCol}>
                                                <Text style={styles.dayName}>{getDayName(day.datetime)}</Text>
                                                <Text style={styles.dateText}>{getDate(day.datetime)}</Text>
                                            </View>

                                            <View style={styles.conditionCol}>
                                                <DayIcon size={24} color="#94A3B8" />
                                                <Text style={styles.conditionText}>{getConditionText(day.condition)}</Text>
                                            </View>

                                            <View style={styles.tempCol}>
                                                <Text style={styles.highTemp}>{day.temperature}°</Text>
                                                <Text style={styles.lowTemp}>{day.templow}°</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 16 }}>
                                <CloudRain size={48} color="#64748B" />
                                <Text style={{ color: '#94A3B8', marginTop: 16, textAlign: 'center' }}>
                                    Keine Vorhersage verfügbar.
                                </Text>
                                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                                    Die Wetterstation unterstützt möglicherweise keine Vorhersage.
                                </Text>
                            </View>
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: '#000' },
    modalContent: { flex: 1, backgroundColor: '#020617' },
    modalHeader: {
        paddingVertical: 24,
        paddingHorizontal: 20,
        paddingTop: 60,
        backgroundColor: '#1E293B',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    modalSubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    modalBody: { flex: 1, padding: 20 },

    currentWeatherCard: {
        backgroundColor: '#1E293B',
        borderRadius: 24,
        padding: 24,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    largeIconContainer: {
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        alignItems: 'center', justifyContent: 'center'
    },
    currentTemp: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
    currentCondition: { fontSize: 16, color: '#94A3B8' },
    humidityText: { fontSize: 12, color: '#94A3B8' },
    humidityValue: { fontSize: 20, fontWeight: '600', color: '#fff' },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
    forecastList: { gap: 12 },
    forecastRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E293B',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.02)'
    },
    dayCol: { width: 100 },
    dayName: { fontSize: 16, fontWeight: '600', color: '#fff' },
    dateText: { fontSize: 12, color: '#64748B' },

    conditionCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    conditionText: { fontSize: 14, color: '#CBD5E1' },

    tempCol: { alignItems: 'flex-end', width: 60 },
    highTemp: { fontSize: 16, fontWeight: '600', color: '#fff' },
    lowTemp: { fontSize: 14, color: '#64748B' }
});

import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { X, Sun, CloudRain, Moon, Wind, Cloud, AlertTriangle } from 'lucide-react-native';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useTheme } from '../contexts/ThemeContext';

interface WeatherForecastModalProps {
    visible: boolean;
    onClose: () => void;
    weatherEntity: any;
    meteoAlarm?: any;
}

export default function WeatherForecastModal({ visible, onClose, weatherEntity, meteoAlarm }: WeatherForecastModalProps) {
    const { fetchWeatherForecast } = useHomeAssistant();
    const { colors } = useTheme();
    const [forecast, setForecast] = useState<any[]>([]);
    const [hourlyForecast, setHourlyForecast] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [translatedAlertConfig, setTranslatedAlertConfig] = useState({ headline: '', desc: '' });

    // Fetch forecast when modal opens
    useEffect(() => {
        if (visible && weatherEntity?.entity_id) {
            setLoading(true);
            Promise.all([
                fetchWeatherForecast(weatherEntity.entity_id, 'daily'),
                fetchWeatherForecast(weatherEntity.entity_id, 'hourly').catch(() => []),
            ])
                .then(([dailyData, hourlyData]) => {
                    setForecast(dailyData || []);
                    setHourlyForecast(hourlyData || []);
                })
                .catch((err) => {
                    console.error('Failed to fetch forecast:', err);
                    setForecast([]);
                    setHourlyForecast([]);
                })
                .finally(() => setLoading(false));
            
            // Auto-translate alerts if necessary
            if (weatherEntity.state?.toLowerCase() === 'exceptional' || meteoAlarm?.state === 'on') {
                const hl = meteoAlarm?.attributes?.headline || "Wetterwarnung";
                const desc = meteoAlarm?.attributes?.description || weatherEntity.attributes?.description || weatherEntity.attributes?.message || "Es liegt eine amtliche Wetterwarnung vor.";
                
                const googleTranslate = async (text: string) => {
                    if (!text) return "";
                    try {
                        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=de&dt=t&q=${encodeURIComponent(text)}`);
                        const data = await res.json();
                        return data[0].map((item: any) => item[0]).join('');
                    } catch (e) {
                        return text;
                    }
                };

                Promise.all([googleTranslate(hl), googleTranslate(desc)]).then(([th, td]) => {
                    setTranslatedAlertConfig({ headline: th, desc: td });
                });
            } else {
                setTranslatedAlertConfig({ headline: '', desc: '' });
            }
        }
    }, [visible, weatherEntity?.entity_id, weatherEntity?.state, meteoAlarm?.state]);

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

    const getHourLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    };

    // Filter hourly forecast to today only
    const todayHourly = hourlyForecast.filter(h => {
        const d = new Date(h.datetime);
        const now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d >= now;
    });

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

    // Legacy regex translator for fallbacks if offline directly returning the passed string
    const translateWeatherFallback = (text: string): string => {
        if (!text) return '';
        let t = text;
        t = t.replace(/Yellow/gi, 'Gelbe').replace(/Orange/gi, 'Orange').replace(/Red/gi, 'Rote');
        t = t.replace(/Warning/gi, 'Warnung').replace(/Watch/gi, 'Vorwarnung').replace(/Alert/gi, 'Alarm');
        return t;
    };


    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={[styles.modalOverlay, { backgroundColor: colors.background }]}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={[styles.modalHeader, { backgroundColor: colors.card }]}>
                        <View>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Wettervorhersage</Text>
                            <Text style={[styles.modalSubtitle, { color: colors.subtext }]}>Zell LU</Text>
                        </View>
                        <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
                            <X size={24} color={colors.text} />
                        </Pressable>

                    </View>

                    <ScrollView style={styles.modalBody}>
                        {(weatherEntity.state?.toLowerCase() === 'exceptional' || meteoAlarm?.state === 'on') && (
                            <View style={styles.warningCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <AlertTriangle size={32} color="#EF4444" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.warningTitle}>
                                            {translatedAlertConfig.headline || translateWeatherFallback(meteoAlarm?.attributes?.headline || "WETTERWARNUNG")}
                                        </Text>
                                        <Text style={styles.warningText}>
                                            {translatedAlertConfig.desc || translateWeatherFallback(meteoAlarm?.attributes?.description || weatherEntity.attributes?.description || weatherEntity.attributes?.message || "Es liegt eine amtliche Wetterwarnung vor.")}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        <View style={[styles.currentWeatherCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            {(() => {
                                const CurrentIcon = getIcon(weatherEntity.state);
                                return (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                            <View style={[styles.largeIconContainer, { backgroundColor: colors.accent + '20' }]}>
                                                <CurrentIcon size={40} color={colors.accent} />
                                            </View>
                                            <View>
                                                <Text style={[styles.currentTemp, { color: colors.text }]}>{weatherEntity.attributes.temperature}°</Text>
                                                <Text style={[styles.currentCondition, { color: colors.subtext }]}>{getConditionText(weatherEntity.state)}</Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[styles.humidityText, { color: colors.subtext }]}>Feuchtigkeit</Text>
                                            <Text style={[styles.humidityValue, { color: colors.text }]}>{weatherEntity.attributes.humidity}%</Text>
                                        </View>
                                    </View>
                                );
                            })()}
                        </View>

                        {/* Hourly Forecast (compact, horizontal scroll) */}
                        {todayHourly.length > 0 && (
                            <>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Heute</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={{ marginBottom: 24 }}
                                    contentContainerStyle={{ gap: 10 }}
                                >
                                    {todayHourly.map((hour: any, idx: number) => {
                                        const HIcon = getIcon(hour.condition);
                                        return (
                                            <View key={idx} style={[styles.hourlyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                <Text style={[styles.hourlyTime, { color: colors.subtext }]}>{getHourLabel(hour.datetime)}</Text>
                                                <HIcon size={22} color={colors.accent} />
                                                <Text style={[styles.hourlyTemp, { color: colors.text }]}>{Math.round(hour.temperature)}°</Text>
                                                {hour.precipitation_probability != null && (
                                                    <Text style={[styles.hourlyRain, { color: colors.subtext }]}>{hour.precipitation_probability}%</Text>
                                                )}
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </>
                        )}

                        <Text style={[styles.sectionTitle, { color: colors.text }]}>7-Tage Vorschau</Text>

                        {loading ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={colors.accent} />
                                <Text style={{ color: colors.subtext, marginTop: 16 }}>Lade Vorhersage...</Text>
                            </View>
                        ) : forecast.length > 0 ? (
                            <View style={styles.forecastList}>
                                {forecast.map((day: any, index: number) => {
                                    const DayIcon = getIcon(day.condition);
                                    return (
                                        <View key={index} style={[styles.forecastRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                            <View style={styles.dayCol}>
                                                <Text style={[styles.dayName, { color: colors.text }]}>{getDayName(day.datetime)}</Text>
                                                <Text style={[styles.dateText, { color: colors.subtext }]}>{getDate(day.datetime)}</Text>
                                            </View>

                                            <View style={styles.conditionCol}>
                                                <DayIcon size={24} color={colors.subtext} />
                                                <Text style={[styles.conditionText, { color: colors.subtext }]}>{getConditionText(day.condition)}</Text>
                                            </View>

                                            <View style={styles.tempCol}>
                                                <Text style={[styles.highTemp, { color: colors.text }]}>{day.temperature}°</Text>
                                                <Text style={[styles.lowTemp, { color: colors.subtext }]}>{day.templow}°</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.card, borderRadius: 16 }}>
                                <CloudRain size={48} color={colors.subtext} />
                                <Text style={{ color: colors.subtext, marginTop: 16, textAlign: 'center' }}>
                                    Keine Vorhersage verfügbar.
                                </Text>
                                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8, textAlign: 'center', opacity: 0.6 }}>
                                    Die Wetterstation unterstützt möglicherweise keine Vorhersage.
                                </Text>
                            </View>
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal >
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1 },
    modalContent: { flex: 1 },
    modalHeader: {
        paddingVertical: 24,
        paddingHorizontal: 20,
        paddingTop: 60,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    modalTitle: { fontSize: 24, fontWeight: 'bold' },
    modalSubtitle: { fontSize: 14, marginTop: 2 },
    closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    modalBody: { flex: 1, padding: 20 },

    currentWeatherCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 32,
        borderWidth: 1,
    },
    largeIconContainer: {
        width: 64, height: 64, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center'
    },
    currentTemp: { fontSize: 36, fontWeight: 'bold' },
    currentCondition: { fontSize: 16 },
    humidityText: { fontSize: 12 },
    humidityValue: { fontSize: 20, fontWeight: '600' },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    forecastList: { gap: 12 },
    forecastRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    dayCol: { width: 100 },
    dayName: { fontSize: 16, fontWeight: '600' },
    dateText: { fontSize: 12 },

    conditionCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    conditionText: { fontSize: 14 },

    tempCol: { alignItems: 'flex-end', width: 60 },
    highTemp: { fontSize: 16, fontWeight: '600' },
    lowTemp: { fontSize: 14 },

    warningCard: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: '#EF4444',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24
    },
    warningTitle: { color: '#EF4444', fontWeight: 'bold', fontSize: 14, marginBottom: 4, letterSpacing: 1 },
    warningText: { color: '#FECACA', fontSize: 13, lineHeight: 18 },

    hourlyCard: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        gap: 6,
        minWidth: 72,
    },
    hourlyTime: { fontSize: 12, fontWeight: '600' },
    hourlyTemp: { fontSize: 16, fontWeight: '700' },
    hourlyRain: { fontSize: 11, opacity: 0.7 }
});

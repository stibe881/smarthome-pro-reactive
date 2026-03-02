
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function HeaderClock() {
    const { colors } = useTheme();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 60000); // Update every 60s — display only shows HH:MM
        return () => clearInterval(timer);
    }, []);

    return (
        <View style={styles.container}>
            <Text style={[styles.timeText, { color: colors.text }]}>
                {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 4,
        alignSelf: 'center',
    },
    timeText: {
        fontSize: 28,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
        opacity: 0.9
    },
});

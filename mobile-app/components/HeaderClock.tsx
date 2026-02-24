
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';

export default function HeaderClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 60000); // Update every 60s — display only shows HH:MM
        return () => clearInterval(timer);
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.timeText}>
                {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        // Removed background to look more like a native header element, or keep it subtle?
        // User asked for "big like greeting", usually implies clean text.
        // But let's keep the pill for contrast but make it minimal or just transparent?
        // Let's keep the pill but make it larger/lighter, or just text. 
        // "Greeting" is just text. Let's make this just text to match, or a very subtle pill.
        // Let's try matching the look:
        paddingHorizontal: 16,
        paddingVertical: 4,
        alignSelf: 'center',
    },
    timeText: {
        color: '#fff',
        fontSize: 28, // Close to greeting's 32
        fontWeight: 'bold', // Match greeting weight
        fontVariant: ['tabular-nums'],
        opacity: 0.9
    },
});

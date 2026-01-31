import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

interface OptimisticVolumeSliderProps {
    value: number; // Current volume from HA (0-1)
    onValueChange: (val: number) => void; // Called when user slides (optimistic)
    onSlidingComplete: (val: number) => void; // Called when user releases (send to HA)
    disabled?: boolean;
    style?: any;
}

export const OptimisticVolumeSlider = ({ value, onValueChange, onSlidingComplete, disabled, style }: OptimisticVolumeSliderProps) => {
    // Local state for the slider position
    const [localValue, setLocalValue] = useState(value);

    // Interaction tracking
    const isInteracting = useRef(false);
    const lockUntil = useRef(0);

    // Sync with external 'value' ONLY if not interacting AND lock expired
    useEffect(() => {
        const now = Date.now();
        // If we are Locked (lockUntil > now), we ignore external updates.
        // If we are Interacting, we ignore external updates.
        if (!isInteracting.current && now > lockUntil.current) {
            // Only update if difference is significant to avoid rounding jitter
            if (Math.abs(value - localValue) > 0.02) {
                setLocalValue(value);
            }
        }
    }, [value]);

    return (
        <Slider
            style={[styles.slider, style]}
            value={localValue}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            minimumTrackTintColor="#FFFFFF"
            maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
            thumbTintColor="#FFFFFF"
            disabled={disabled}
            onSlidingStart={() => {
                isInteracting.current = true;
            }}
            onValueChange={(val) => {
                // BUGFIX: Always assert interaction on change. 
                // Some devices miss onSlidingStart.
                isInteracting.current = true;
                setLocalValue(val);
                onValueChange(val);
            }}
            onSlidingComplete={(val) => {
                isInteracting.current = false;
                // Lock updates for 30 seconds. 
                // We trust the USER more than the SERVER latency.
                lockUntil.current = Date.now() + 30000;
                setLocalValue(val);
                onSlidingComplete(val);
            }}
        />
    );
};

const styles = StyleSheet.create({
    slider: {
        width: '100%',
        height: 40,
    },
});

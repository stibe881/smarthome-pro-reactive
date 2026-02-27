import React, { useState, useEffect } from 'react';
import { Text, View } from 'react-native';

interface LiveCountdownProps {
    targetDate: string;
    targetTime?: string | null;
    displayFormat?: 'days' | 'time' | 'auto';
    isHomescreen?: boolean;
    color: string;
    textStyle?: any;
    labelStyle?: any;
}

export function getCountdownTimeRemaining(targetDate: string, targetTime: string | null | undefined, format: 'days' | 'time' | 'auto') {
    const target = new Date(targetDate + 'T00:00:00');
    if (targetTime) {
        const [h, m] = targetTime.split(':');
        target.setHours(parseInt(h), parseInt(m), 0, 0);
    } else {
        target.setHours(0, 0, 0, 0);
    }

    const today = new Date();
    const msLeft = target.getTime() - today.getTime();

    if (!targetTime && (format === 'auto' || format === 'days')) {
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const days = Math.ceil((target.getTime() - today.getTime()) / 86400000);
        return { isTime: false, value: days, isPast: days < 0, isToday: days === 0 };
    }

    const daysLeft = Math.floor(msLeft / 86400000);
    const hrsLeft = Math.floor((msLeft % 86400000) / 3600000);
    const minsLeft = Math.floor((msLeft % 3600000) / 60000);
    const secsLeft = Math.floor((msLeft % 60000) / 1000);

    const isPast = msLeft < 0;

    let useTime = format === 'time';
    if (format === 'auto' && msLeft <= 86400000 && msLeft > 0) {
        // Less than 24 hours left, switch to time
        useTime = true;
    }

    if (useTime) {
        if (isPast) return { isTime: true, value: '0s', isPast: true, isToday: false };
        if (daysLeft === 0 && hrsLeft === 0 && minsLeft === 0) {
            return { isTime: true, value: `${secsLeft}s`, isPast: false, isToday: true };
        }
        if (daysLeft === 0 && hrsLeft === 0) {
            return { isTime: true, value: `${minsLeft}m`, isPast: false, isToday: true };
        }
        if (daysLeft === 0) {
            return { isTime: true, value: `${hrsLeft}h ${minsLeft}m`, isPast: false, isToday: true };
        }
        return { isTime: true, value: `${daysLeft}T ${hrsLeft}h`, isPast: false, isToday: false };
    }

    // Default days view
    today.setHours(0, 0, 0, 0);
    const midnightTarget = new Date(targetDate + 'T00:00:00');
    midnightTarget.setHours(0, 0, 0, 0);
    const rawDays = Math.ceil((midnightTarget.getTime() - today.getTime()) / 86400000);
    return { isTime: false, value: rawDays, isPast: rawDays < 0, isToday: rawDays === 0 };
}

export const LiveCountdown: React.FC<LiveCountdownProps> = ({ targetDate, targetTime, displayFormat = 'auto', isHomescreen, color, textStyle, labelStyle }) => {
    const [timeLeft, setTimeLeft] = useState(() => getCountdownTimeRemaining(targetDate, targetTime, displayFormat));

    useEffect(() => {
        const updateInterval = setInterval(() => {
            const nextTime = getCountdownTimeRemaining(targetDate, targetTime, displayFormat);
            setTimeLeft(prev => prev.value === nextTime.value && prev.isTime === nextTime.isTime ? prev : nextTime);
        }, 1000);
        return () => clearInterval(updateInterval);
    }, [targetDate, targetTime, displayFormat]);

    if (isHomescreen) {
        if (timeLeft.isPast) {
            return <Text style={textStyle}>—</Text>;
        }
        if (!timeLeft.isTime && timeLeft.isToday) {
            return <Text style={textStyle}>🎉</Text>;
        }
        return <Text style={textStyle} numberOfLines={1} adjustsFontSizeToFit>{timeLeft.value}</Text>;
    }

    // FamilyCountdowns view
    return (
        <View style={[{ alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={textStyle} numberOfLines={1} adjustsFontSizeToFit>{timeLeft.value}</Text>
            {(!timeLeft.isTime && !timeLeft.isToday && !timeLeft.isPast) && (
                <Text style={labelStyle}>{timeLeft.value === 1 ? 'Tag' : 'Tage'}</Text>
            )}
            {(!timeLeft.isTime && timeLeft.isToday) && (
                <Text style={labelStyle}>Heute</Text>
            )}
        </View>
    );
};

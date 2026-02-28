import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export default function ResponsiveTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { effectiveRole, hasPlannerAccess } = useAuth();
    const isGuest = effectiveRole === 'guest';

    // Filter out tabs that shouldn't be visible
    const hiddenTabs: string[] = [];
    if (isGuest) hiddenTabs.push('rooms', 'media');
    if (!hasPlannerAccess) hiddenTabs.push('family');
    const visibleRoutes = hiddenTabs.length > 0
        ? state.routes.filter(r => !hiddenTabs.includes(r.name))
        : state.routes;

    // Always use bottom bar for all devices (including tablet)
    return (
        <View style={[styles.bottomBar, { height: 60 + insets.bottom, paddingBottom: insets.bottom, backgroundColor: colors.tabBar, borderTopColor: colors.border }]}>
            {visibleRoutes.map((route) => {
                const index = state.routes.indexOf(route);
                const { options } = descriptors[route.key];
                const label = options.title !== undefined
                    ? options.title
                    : options.tabBarLabel !== undefined
                        ? options.tabBarLabel
                        : route.name;

                const isFocused = state.index === index;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                const onLongPress = () => {
                    navigation.emit({
                        type: 'tabLongPress',
                        target: route.key,
                    });
                };

                const color = isFocused ? colors.accent : colors.subtext;

                return (
                    <Pressable
                        key={route.key}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={options.tabBarAccessibilityLabel}
                        // @ts-ignore
                        testID={options.tabBarTestID}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        style={styles.bottomTabItem}
                    >
                        {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
                        <Text style={[styles.bottomTabLabel, { color }]}>
                            {label as string}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    bottomBar: {
        flexDirection: 'row',
        backgroundColor: '#050505',
        borderTopWidth: 1,
        borderTopColor: '#1f1f1f',
        paddingTop: 10,
    },
    bottomTabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomTabLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 4,
    },
});

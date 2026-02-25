import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const ENTITLEMENT_ID = 'HomePilot_Pro';

// Production API keys
const IOS_API_KEY = 'appl_nPeSIqjNBSFmpjnYREyHBhSonth';
const ANDROID_API_KEY = 'appl_nPeSIqjNBSFmpjnYREyHBhSonth';

// Check if native modules are available (not Expo Go)
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isNativeAvailable = !isExpoGo && Platform.OS !== 'web';

interface SubscriptionContextType {
    isProUser: boolean;
    isLoading: boolean;
    presentPaywall: () => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
    refreshStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    isProUser: false,
    isLoading: true,
    presentPaywall: async () => false,
    restorePurchases: async () => false,
    refreshStatus: async () => { },
});

export function useSubscription() {
    return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    // In Expo Go / Web: always grant access (dev mode)
    const [isProUser, setIsProUser] = useState(!isNativeAvailable);
    const [isLoading, setIsLoading] = useState(isNativeAvailable);

    useEffect(() => {
        if (!isNativeAvailable) {
            console.log('📱 RevenueCat: Skipped (Expo Go / Web) — Pro features unlocked for dev');
            setIsLoading(false);
            return;
        }

        let Purchases: typeof import('react-native-purchases').default;

        const init = async () => {
            try {
                // Dynamic import to avoid crash in Expo Go
                const purchasesModule = require('react-native-purchases');
                Purchases = purchasesModule.default;
                const { LOG_LEVEL } = purchasesModule;

                Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

                if (Platform.OS === 'ios') {
                    Purchases.configure({ apiKey: IOS_API_KEY });
                } else if (Platform.OS === 'android') {
                    Purchases.configure({ apiKey: ANDROID_API_KEY });
                }

                // One-time reset: clear stuck sandbox customer
                const RESET_KEY = 'rc_reset_v1';
                const didReset = await AsyncStorage.getItem(RESET_KEY);
                if (!didReset) {
                    try {
                        await Purchases.logOut();
                    } catch (_) { /* first launch or already anonymous — ignore */ }
                    await AsyncStorage.setItem(RESET_KEY, 'done');
                }

                // Force fresh data from server (clears keychain cache)
                await Purchases.invalidateCustomerInfoCache();
                const info = await Purchases.getCustomerInfo();
                const hasEntitlement = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
                setIsProUser(hasEntitlement);
                setIsLoading(false);

                // Listen for updates
                Purchases.addCustomerInfoUpdateListener((info: any) => {
                    const active = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
                    setIsProUser(active);
                });
            } catch (e) {
                console.warn('RevenueCat init error:', e);
                setIsLoading(false);
            }
        };

        init();
    }, []);

    const presentPaywall = useCallback(async (): Promise<boolean> => {
        if (!isNativeAvailable) {
            Alert.alert('Dev Mode', 'Paywall nicht verfügbar in Expo Go. Pro Features sind freigeschaltet.');
            return true;
        }
        try {
            const RevenueCatUI = require('react-native-purchases-ui').default;
            const { PAYWALL_RESULT } = require('react-native-purchases-ui');
            const Purchases = require('react-native-purchases').default;

            const result = await RevenueCatUI.presentPaywall();

            if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
                const info = await Purchases.getCustomerInfo();
                const hasEntitlement = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
                setIsProUser(hasEntitlement);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Paywall error:', e);
            Alert.alert('Paywall Fehler', String(e));
            return false;
        }
    }, []);

    const restorePurchases = useCallback(async (): Promise<boolean> => {
        if (!isNativeAvailable) return true;
        try {
            const Purchases = require('react-native-purchases').default;
            const info = await Purchases.restorePurchases();
            const has = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
            setIsProUser(has);
            return has;
        } catch (e) {
            console.error('Restore purchases error:', e);
            return false;
        }
    }, []);

    const refreshStatus = useCallback(async () => {
        if (!isNativeAvailable) return;
        try {
            const Purchases = require('react-native-purchases').default;
            const info = await Purchases.getCustomerInfo();
            const has = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
            setIsProUser(has);
        } catch (e) {
            console.error('Refresh status error:', e);
        }
    }, []);

    return (
        <SubscriptionContext.Provider value={{
            isProUser,
            isLoading,
            presentPaywall,
            restorePurchases,
            refreshStatus,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

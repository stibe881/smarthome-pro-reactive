import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const ENTITLEMENT_ID = 'HomePilot_Pro';

// Production API keys
const IOS_API_KEY = 'appl_nPeSIqjNBSFmpjnYREyHBhSonth';
const ANDROID_API_KEY = 'appl_nPeSIqjNBSFmpjnYREyHBhSonth';

// Check if native modules are available (not Expo Go)
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isNativeAvailable = !isExpoGo && Platform.OS !== 'web';

console.log('🔑 Subscription Debug:', {
    executionEnvironment: Constants.executionEnvironment,
    isExpoGo,
    isNativeAvailable,
    platform: Platform.OS,
});

interface SubscriptionContextType {
    isProUser: boolean;
    isLoading: boolean;
    debugInfo: string;
    presentPaywall: () => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
    refreshStatus: () => Promise<void>;
    manageSubscriptions: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    isProUser: false,
    isLoading: true,
    debugInfo: '',
    presentPaywall: async () => false,
    restorePurchases: async () => false,
    refreshStatus: async () => { },
    manageSubscriptions: async () => { },
});

export function useSubscription() {
    return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    // In Expo Go / Web: always grant access (dev mode)
    const [isProUser, setIsProUser] = useState(!isNativeAvailable);
    const [isLoading, setIsLoading] = useState(isNativeAvailable);
    const [debugInfo, setDebugInfo] = useState(`env: ${Constants.executionEnvironment}, native: ${isNativeAvailable}, expoGo: ${isExpoGo}`);

    useEffect(() => {
        if (!isNativeAvailable) {
            console.log('📱 RevenueCat: Skipped (Expo Go / Web) — Pro features unlocked for dev');
            setDebugInfo(prev => prev + ' | SKIPPED (no native)');
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

                const info = await Purchases.getCustomerInfo();
                const hasEntitlement = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
                const activeEnts = Object.keys(info.entitlements.active);
                setDebugInfo(prev => prev + ` | userId: ${info.originalAppUserId} | hasEnt: ${hasEntitlement} | active: [${activeEnts.join(',')}]`);
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
    const manageSubscriptions = useCallback(async () => {
        if (!isNativeAvailable) return;
        try {
            const Purchases = require('react-native-purchases').default;
            await Purchases.showManageSubscriptions();
        } catch (e) {
            console.error('Manage subscriptions error:', e);
            Alert.alert('Fehler', String(e));
        }
    }, []);

    return (
        <SubscriptionContext.Provider value={{
            isProUser,
            isLoading,
            debugInfo,
            presentPaywall,
            restorePurchases,
            refreshStatus,
            manageSubscriptions,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
}


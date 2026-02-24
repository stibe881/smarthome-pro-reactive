import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, CustomerInfo } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

const ENTITLEMENT_ID = 'HomePilot Pro Pro';

// Platform-specific API keys
const IOS_API_KEY = 'test_FTsATuCXhLJHoWNsdFqjwygtzMR';
const ANDROID_API_KEY = 'test_FTsATuCXhLJHoWNsdFqjwygtzMR';

interface SubscriptionContextType {
    isProUser: boolean;
    isLoading: boolean;
    customerInfo: CustomerInfo | null;
    presentPaywall: () => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
    refreshStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    isProUser: false,
    isLoading: true,
    customerInfo: null,
    presentPaywall: async () => false,
    restorePurchases: async () => false,
    refreshStatus: async () => { },
});

export function useSubscription() {
    return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const [isProUser, setIsProUser] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

    // Initialize RevenueCat
    useEffect(() => {
        const init = async () => {
            try {
                if (Platform.OS === 'web') {
                    setIsLoading(false);
                    return;
                }

                Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

                if (Platform.OS === 'ios') {
                    Purchases.configure({ apiKey: IOS_API_KEY });
                } else if (Platform.OS === 'android') {
                    Purchases.configure({ apiKey: ANDROID_API_KEY });
                }

                // Get initial customer info
                const info = await Purchases.getCustomerInfo();
                updateProStatus(info);
            } catch (e) {
                console.error('RevenueCat init error:', e);
                setIsLoading(false);
            }
        };

        init();

        // Listen for customer info updates (purchases, renewals, cancellations)
        const customerInfoUpdated = (info: CustomerInfo) => {
            updateProStatus(info);
        };
        Purchases.addCustomerInfoUpdateListener(customerInfoUpdated);

        return () => {
            Purchases.removeCustomerInfoUpdateListener(customerInfoUpdated);
        };
    }, []);

    const updateProStatus = (info: CustomerInfo) => {
        const hasEntitlement = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
        setIsProUser(hasEntitlement);
        setCustomerInfo(info);
        setIsLoading(false);
    };

    const presentPaywall = useCallback(async (): Promise<boolean> => {
        try {
            const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

            switch (result) {
                case PAYWALL_RESULT.PURCHASED:
                case PAYWALL_RESULT.RESTORED:
                    // Refresh status after purchase
                    const info = await Purchases.getCustomerInfo();
                    updateProStatus(info);
                    return true;
                case PAYWALL_RESULT.NOT_PRESENTED:
                case PAYWALL_RESULT.ERROR:
                case PAYWALL_RESULT.CANCELLED:
                default:
                    return false;
            }
        } catch (e) {
            console.error('Paywall error:', e);
            return false;
        }
    }, []);

    const restorePurchases = useCallback(async (): Promise<boolean> => {
        try {
            const info = await Purchases.restorePurchases();
            updateProStatus(info);
            return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
        } catch (e) {
            console.error('Restore purchases error:', e);
            return false;
        }
    }, []);

    const refreshStatus = useCallback(async () => {
        try {
            if (Platform.OS === 'web') return;
            const info = await Purchases.getCustomerInfo();
            updateProStatus(info);
        } catch (e) {
            console.error('Refresh status error:', e);
        }
    }, []);

    return (
        <SubscriptionContext.Provider value={{
            isProUser,
            isLoading,
            customerInfo,
            presentPaywall,
            restorePurchases,
            refreshStatus,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

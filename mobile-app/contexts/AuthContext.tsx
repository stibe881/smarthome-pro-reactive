import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    userRole: 'admin' | 'user' | null;
    isBiometricsSupported: boolean;
    isBiometricsEnabled: boolean;
    toggleBiometrics: () => Promise<void>;
    authenticateWithBiometrics: () => Promise<boolean>;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
    const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
    const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);

    useEffect(() => {
        checkBiometricsSupport();
        loadBiometricSettings();
    }, []);

    const checkBiometricsSupport = async () => {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricsSupported(compatible && enrolled);
    };

    const loadBiometricSettings = async () => {
        try {
            const enabled = await AsyncStorage.getItem('biometrics_enabled');
            setIsBiometricsEnabled(enabled === 'true');
        } catch (e) {
            console.warn('Failed to load biometric settings');
        }
    };

    const toggleBiometrics = async () => {
        if (!isBiometricsSupported) {
            Alert.alert('Nicht verfügbar', 'Biometrie wird von diesem Gerät nicht unterstützt oder ist nicht eingerichtet.');
            return;
        }

        const newState = !isBiometricsEnabled;

        // If enabling, verify first
        if (newState) {
            const success = await authenticateWithBiometrics();
            if (!success) return; // Don't enable if check fails
        }

        setIsBiometricsEnabled(newState);
        await AsyncStorage.setItem('biometrics_enabled', newState.toString());
    };

    const authenticateWithBiometrics = async (): Promise<boolean> => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Login mit Face ID / Touch ID',
                fallbackLabel: 'Passwort verwenden',
                disableDeviceFallback: false,
            });
            return result.success;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    // Function to fetch user role
    const fetchUserRole = async (userId: string) => {
        const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching user role:', error);
            setUserRole('user');
            return;
        }

        setUserRole((data?.role as 'admin' | 'user') || 'user');
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserRole(session.user.id);
            }
            setIsLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserRole(session.user.id);
            } else {
                setUserRole(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        setSession(data.session);
        setUser(data.user);
    };

    const register = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) throw error;

        // Supabase might require email confirmation, handle both cases
        if (data.session) {
            setSession(data.session);
            setUser(data.user);
        } else {
            throw new Error('Bitte bestätige deine Email-Adresse');
        }
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setSession(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            isLoading,
            userRole,
            isBiometricsSupported,
            isBiometricsEnabled,
            toggleBiometrics,
            authenticateWithBiometrics,
            login,
            register,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

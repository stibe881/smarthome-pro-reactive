import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    avatarUrl: string | null;
    updateProfilePicture: (uri: string) => Promise<void>;
    userRole: 'admin' | 'user' | null;
    isBiometricsSupported: boolean;
    isBiometricsEnabled: boolean;
    toggleBiometrics: () => Promise<void>;
    authenticateWithBiometrics: () => Promise<boolean>;
    biometricLogin: () => Promise<boolean>;
    login: (e: string, p: string) => Promise<void>;
    register: (e: string, p: string) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: (deleteHousehold?: boolean) => Promise<void>;
    changePassword: (newPassword: string) => Promise<void>;
    resetMemberPassword: (id: string, pass: string) => Promise<void>;
    removeMember: (id: string) => Promise<void>;
    toggleMemberAccess: (id: string, active: boolean) => Promise<void>;
    mustChangePassword: boolean;
    clearMustChangePassword: () => void;
    needsSetup: boolean;
    completeSetup: () => void;
    requestPasswordReset: (email: string) => Promise<void>;
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
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [needsSetup, setNeedsSetup] = useState(false);
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

    // Credential storage helpers (Simple/Insecure for Hotfix - should use SecureStore)
    const storeCredentials = async (e: string, p: string) => {
        try {
            await AsyncStorage.setItem('biometric_email', e);
            await AsyncStorage.setItem('biometric_password', p);
        } catch (err) { console.warn('Failed to store credentials', err); }
    };

    const clearCredentials = async () => {
        try {
            await AsyncStorage.removeItem('biometric_email');
            await AsyncStorage.removeItem('biometric_password');
        } catch (err) { console.warn('Failed to clear credentials', err); }
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
        } else {
            // If disabling, clear stored credentials
            await clearCredentials();
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

    const biometricLogin = async (): Promise<boolean> => {
        if (!isBiometricsEnabled) return false;

        const success = await authenticateWithBiometrics();
        if (!success) return false;

        setIsLoading(true);
        try {
            const email = await AsyncStorage.getItem('biometric_email');
            const password = await AsyncStorage.getItem('biometric_password');

            if (!email || !password) {
                Alert.alert('Fehler', 'Keine gespeicherten Anmeldedaten gefunden. Bitte melde dich einmalig mit Passwort an.');
                return false;
            }

            await login(email, password);
            return true;
        } catch (e: any) {
            Alert.alert('Fehler', 'Biometrischer Login fehlgeschlagen: ' + e.message);
            return false;
        } finally {
            setIsLoading(false);
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

    const loadAvatar = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('family_members')
                .select('avatar_url')
                .eq('user_id', userId)
                .single();

            if (data?.avatar_url) {
                // Get public URL
                const { data: publicData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(data.avatar_url);

                setAvatarUrl(publicData.publicUrl);
            } else {
                setAvatarUrl(null);
            }
        } catch (e) {
            console.warn('Error loading avatar:', e);
            setAvatarUrl(null);
        }
    };

    const updateProfilePicture = async (uri: string) => {
        if (!user) return;

        try {
            // 1. Read file using new expo-file-system File API
            const file = new FileSystem.File(uri);
            const arrayBuffer = await file.arrayBuffer();

            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpeg';
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, arrayBuffer, {
                    contentType,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 2. Update DB
            const { error: dbError } = await supabase
                .from('family_members')
                .update({ avatar_url: fileName })
                .eq('user_id', user.id);

            if (dbError) throw dbError;

            // 3. Update State
            const { data: publicData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
            setAvatarUrl(publicData.publicUrl);

        } catch (e) {
            console.error('Error updating profile picture:', e);
            throw e;
        }
    };


    // Push Notification Token Registration
    const registerForPushNotificationsAsync = async () => {
        let token;
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            alert('Failed to get push token for push notification!');
            return;
        }

        // Get Project ID from Constants (Standard for Expo/EAS)
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

        if (!projectId) {
            console.error('Project ID not found in app config');
            // Alert for debugging in TestFlight if needed
            // alert('Error: Project ID not found');
            return;
        }

        try {
            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
        } catch (e: any) {
            console.error('Error getting push token:', e);
            alert('Push Token Error: ' + e.message);
        }

        return token;
    };

    const savePushTokenToSupabase = async (userId: string) => {
        try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                // console.log('[Push Token] Attempting to save token:', token);

                // Upsert into push_tokens table (supports multiple devices per user)
                const { error } = await supabase
                    .from('push_tokens')
                    .upsert({
                        user_id: userId,
                        token: token,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id,token' });

                if (error) {
                    console.warn('[Push Token] Upsert failed:', error.message);
                    // Fallback: also try old family_members column
                    await supabase
                        .from('family_members')
                        .update({ push_token: token, updated_at: new Date().toISOString() })
                        .eq('user_id', userId);
                } else {
                    // console.log('[Push Token] Saved successfully to push_tokens');
                }

                // Save to metadata for redundancy
                await supabase.auth.updateUser({
                    data: { last_push_token: token }
                });
            }
        } catch (error) {
            console.warn('[Push Token] Critical Error:', error);
        }
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserRole(session.user.id);
                loadAvatar(session.user.id);
                // Save push token on startup if logged in
                savePushTokenToSupabase(session.user.id);
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
                loadAvatar(session.user.id);
                // Check if password change is required
                const needsPasswordChange = session.user.user_metadata?.must_change_password === true;
                setMustChangePassword(needsPasswordChange);

                // Save push token on login
                savePushTokenToSupabase(session.user.id);
            } else {
                setUserRole(null);
                setAvatarUrl(null);
                setMustChangePassword(false);
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

        // Update credentials if biometrics is active
        if (isBiometricsEnabled) {
            await storeCredentials(email, password);
        }
    };

    const register = async (email: string, password: string) => {
        // 1. Check if email already exists in a household
        try {
            const { data: existsInHousehold, error: rpcError } = await supabase.rpc(
                'check_email_in_household',
                { p_email: email }
            );

            if (rpcError) {
                console.warn('Household check failed:', rpcError.message);
                // Continue with registration if RPC fails (function might not exist yet)
            } else if (existsInHousehold === true) {
                throw new Error('Diese E-Mail ist bereits einer Home Assistant Instanz zugeordnet. Bitte melde dich stattdessen an.');
            }
        } catch (e: any) {
            // Re-throw if it's our custom error
            if (e.message?.includes('bereits einer Home Assistant')) throw e;
            console.warn('Household check error:', e);
        }

        // 2. Sign up
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) throw error;

        // Supabase might require email confirmation, handle both cases
        if (data.session && data.user) {
            setSession(data.session);
            setUser(data.user);
            if (isBiometricsEnabled) {
                await storeCredentials(email, password);
            }

            // 3. Create household + family_member entry for new user
            try {
                const { data: household, error: householdError } = await supabase
                    .from('households')
                    .insert({ name: 'Mein Zuhause' })
                    .select('id')
                    .single();

                if (householdError) {
                    console.error('Failed to create household:', householdError);
                } else if (household) {
                    const { error: memberError } = await supabase
                        .from('family_members')
                        .insert({
                            user_id: data.user.id,
                            household_id: household.id,
                            email: email,
                            role: 'admin',
                        });

                    if (memberError) {
                        console.error('Failed to create family member:', memberError);
                    } else {
                        console.log('✅ Household + family_member created for new user');
                    }
                }
            } catch (e) {
                console.error('Error creating household:', e);
            }

            // 4. Mark user as needing setup
            setNeedsSetup(true);
        } else {
            throw new Error('Bitte bestätige deine Email-Adresse');
        }
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setSession(null);
        setUser(null);
        setMustChangePassword(false);
    };

    const deleteAccount = async (deleteHousehold: boolean = false) => {
        const { error } = await supabase.rpc('delete_user_account', {
            delete_household: deleteHousehold
        });
        if (error) throw error;
        setSession(null);
        setUser(null);
        setMustChangePassword(false);
    };

    const changePassword = async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setMustChangePassword(false);
    };

    const resetMemberPassword = async (memberId: string, newPassword: string) => {
        const { error } = await supabase.rpc('reset_member_password', {
            p_user_id: memberId,
            p_new_password: newPassword
        });
        if (error) throw error;
    };

    const removeMember = async (memberId: string) => {
        const { error } = await supabase.rpc('remove_family_member', {
            p_user_id: memberId
        });
        if (error) throw error;
    };

    const toggleMemberAccess = async (memberId: string, active: boolean) => {
        const { error } = await supabase.rpc('toggle_member_access', {
            p_user_id: memberId,
            p_active: active
        });
        if (error) throw error;
    };

    const clearMustChangePassword = () => {
        setMustChangePassword(false);
    };

    const completeSetup = () => {
        setNeedsSetup(false);
    };

    const requestPasswordReset = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'smarthome-pro://(auth)/reset-password',
        });
        if (error) throw error;
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            isLoading,
            userRole,
            avatarUrl,
            updateProfilePicture,
            isBiometricsSupported,
            isBiometricsEnabled,
            toggleBiometrics,
            authenticateWithBiometrics,
            biometricLogin,
            login,
            register,
            logout,
            deleteAccount,
            changePassword,
            resetMemberPassword,
            removeMember,
            toggleMemberAccess,
            mustChangePassword,
            clearMustChangePassword,
            needsSetup,
            completeSetup,
            requestPasswordReset
        }}>
            {children}
        </AuthContext.Provider>
    );
};

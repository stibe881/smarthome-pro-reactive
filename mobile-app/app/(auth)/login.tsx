import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { House, LogIn, Mail, Lock, AlertTriangle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

export default function LoginScreen() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.message || 'Ein Fehler ist aufgetreten');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-black justify-center p-6">
            <Stack.Screen options={{ headerShown: false }} />
            <View className="w-full max-w-sm mx-auto">
                {/* Logo */}
                <View className="items-center mb-12">
                    <View className="w-20 h-20 bg-blue-500 rounded-3xl items-center justify-center mb-6">
                        <House stroke="white" size={32} />
                    </View>
                    <Text className="text-4xl font-black text-white tracking-tight mb-2">
                        SMARTHOME <Text className="text-blue-500">PRO</Text>
                    </Text>
                    <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest">Powered by HA</Text>
                </View>

                {/* Form */}
                <View className="bg-white/5 p-8 rounded-[3rem] border border-white/10">
                    <Text className="text-3xl font-black text-white text-center mb-2">Willkommen</Text>
                    <Text className="text-slate-400 text-center mb-8">Melde dich an</Text>

                    <View className="space-y-6">
                        <View className="space-y-2">
                            <Text className="text-xs font-bold text-slate-400 px-1">EMAIL</Text>
                            <View className="bg-white/5 border border-white/10 rounded-xl flex-row items-center px-4">
                                <Mail stroke="#94a3b8" size={20} />
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="name@beispiel.de"
                                    placeholderTextColor="#64748b"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    className="flex-1 py-4 px-3 text-white"
                                />
                            </View>
                        </View>

                        <View className="space-y-2">
                            <Text className="text-xs font-bold text-slate-400 px-1">PASSWORT</Text>
                            <View className="bg-white/5 border border-white/10 rounded-xl flex-row items-center px-4">
                                <Lock stroke="#94a3b8" size={20} />
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="••••••••"
                                    placeholderTextColor="#64748b"
                                    secureTextEntry
                                    className="flex-1 py-4 px-3 text-white"
                                />
                            </View>
                        </View>

                        {error ? (
                            <View className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 flex-row items-center gap-3">
                                <AlertTriangle stroke="#f87171" size={20} />
                                <Text className="text-red-400 text-sm flex-1">{error}</Text>
                            </View>
                        ) : null}

                        <Pressable
                            onPress={handleSubmit}
                            disabled={loading}
                            className={`w-full py-5 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg ${loading ? 'bg-slate-800' : 'bg-blue-600 shadow-blue-500/20'
                                }`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <LogIn stroke="white" size={24} />
                            )}
                            <Text className={`font-black text-lg ${loading ? 'text-slate-500' : 'text-white'}`}>
                                {loading ? 'BITTE WARTEN...' : 'ANMELDEN'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

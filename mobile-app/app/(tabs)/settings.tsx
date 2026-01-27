import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

export default function Settings() {
    const { logout, user } = useAuth();

    return (
        <SafeAreaView className="flex-1 bg-black p-6">
            <Text className="text-white text-2xl font-bold mb-6">Optionen</Text>

            <View className="mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
                <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Angemeldet als</Text>
                <Text className="text-white font-medium">{user?.email}</Text>
            </View>

            <Pressable
                onPress={() => logout()}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex-row items-center justify-center"
            >
                <Text className="text-red-400 font-bold">Abmelden</Text>
            </Pressable>
        </SafeAreaView>
    );
}

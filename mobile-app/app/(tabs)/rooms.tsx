import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Rooms() {
    return (
        <SafeAreaView className="flex-1 bg-black p-6">
            <Text className="text-white text-2xl font-bold">Räume</Text>
        </SafeAreaView>
    );
}

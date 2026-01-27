import 'lucide-react-native';

declare module 'lucide-react-native' {
    export interface LucideProps {
        color?: string;
        stroke?: string;
        className?: string; // NativeWind support
    }
}

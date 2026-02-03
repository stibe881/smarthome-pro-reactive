import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, Sparkles, Bot, User } from 'lucide-react-native';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useHomeAssistant } from '../../contexts/HomeAssistantContext';

// Initialize Gemini
// Note: In production, access via process.env or Expo constants
const GEN_AI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

export default function GeminiScreen() {
    const insets = useSafeAreaInsets();
    const { entities, toggleLight, startVacuum, returnVacuum, pauseVacuum, openCover, closeCover, setCoverPosition } = useHomeAssistant();

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'model',
            text: 'Hallo! Ich bin dein Smart Home Assistent. Wie kann ich dir helfen? Ich kann Lichter steuern, den Staubsauger starten oder dir sagen, was zu Hause los ist.',
            timestamp: Date.now()
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    // Scroll to bottom on new message
    useEffect(() => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    // Debug: List models
    useEffect(() => {
        const checkModels = async () => {
            // Currently the SDK doesn't expose listModels directly on the main class easily in all versions, 
            // but let's try to just log that we are initializing.
            // Actually, checking documentation, we can just try to use a fallback model if one fails,
            // or better: let's try 'gemini-1.5-flash-latest' or just 'gemini-pro' again but with error logging.
            // Since I cannot run 'listModels' easily from the client SDK without looking up the specific method (it's often management API),
            // I will try 'gemini-1.5-flash-001' which is the stable version.
        };
        checkModels();
    }, []);

    const handleSend = async () => {
        if (!inputText.trim()) return;
        if (!GEN_AI_KEY) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: 'Fehler: Kein API Key gefunden. Bitte konfiguriere EXPO_PUBLIC_GEMINI_API_KEY in deiner .env Datei.', timestamp: Date.now() }]);
            return;
        }

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: inputText,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsLoading(true);

        try {
            // 1. Prepare Context (State of Home)
            const context = JSON.stringify(entities.map(e => ({
                id: e.entity_id,
                name: e.attributes.friendly_name || e.entity_id,
                state: e.state,
                // Add select attributes that might be useful
                attributes: {
                    brightness: e.attributes.brightness,
                    temperature: e.attributes.temperature,
                    current_temperature: e.attributes.current_temperature,
                }
            })).filter(e =>
                // Filter to simplify context token usage
                e.id.startsWith('light.') ||
                e.id.startsWith('switch.') ||
                e.id.startsWith('vacuum.') ||
                e.id.startsWith('cover.') ||
                e.id.startsWith('climate.') ||
                e.id.startsWith('sensor.')
            ));

            // 2. System Instructions & Prompt
            // Using gemini-pro-latest with v1beta API - last attempt to find a model with quota
            const model = genAI.getGenerativeModel(
                { model: "gemini-pro-latest", generationConfig: { maxOutputTokens: 500 } },
                { apiVersion: 'v1beta' }
            );

            const prompt = `
            Du bist ein hilfsbereiter Smart Home Assistent.
            
            ANTWORTE IMMER AUF DEUTSCH.
            
            Hier ist der aktuelle Status aller Geräte im Haus im JSON Format:
            ${context}
            
            Der Benutzer fragt: "${userMsg.text}"

            Deine Aufgabe ist es:
            1. Die Frage des Benutzers basierend auf dem Status zu beantworten.
            2. Wenn der Benutzer eine Aktion wünscht (z.B. "Licht an", "Staubsauger starten"), musst du ein JSON Object am Ende deiner Antwort anhängen, das die Aktion definiert.
            
            Das JSON Format für Aktionen muss exakt so aussehen (Beispiele):
            {"action": "toggleLight", "entity_id": "light.wohnzimmer"}
            {"action": "startVacuum", "entity_id": "vacuum.robi"}
            {"action": "returnVacuum", "entity_id": "vacuum.robi"}
            {"action": "openCover", "entity_id": "cover.store_wohnzimmer"}
            {"action": "closeCover", "entity_id": "cover.store_wohnzimmer"}
            
            Wenn keine Aktion nötig ist, gib KEIN JSON aus.

            WICHTIG: 
            - Suche im Status nach dem passenden Gerät. Wenn der Benutzer "Licht im Wohnzimmer" sagt, suche nach einer entity_id die 'light' und 'wohnzimmer' enthält.
            - Gib eine freundliche Antwort in natürlicher Sprache.
            - Falls du JSON ausgibst, MUSS es der allerletzte Teil der Antwort sein.
            `;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            console.log("Gemini Response:", responseText);

            // 3. Parse Response & Action
            // Extract JSON if present at the end
            let displayText = responseText;
            let actionJson = null;

            try {
                // Find the last occurrence of '{' and '}'
                const firstOpen = responseText.lastIndexOf('{');
                const lastClose = responseText.lastIndexOf('}');

                if (firstOpen !== -1 && lastClose > firstOpen) {
                    const potentialJson = responseText.substring(firstOpen, lastClose + 1);
                    actionJson = JSON.parse(potentialJson);
                    // Remove the JSON from the display text for a cleaner UI
                    displayText = responseText.substring(0, firstOpen).trim();
                }
            } catch (e) {
                console.log("No valid JSON found in response or parse error", e);
            }

            // 4. Update UI
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: displayText,
                timestamp: Date.now()
            }]);

            // 5. Execute Action
            if (actionJson && actionJson.action && actionJson.entity_id) {
                console.log("Executing Action:", actionJson);
                switch (actionJson.action) {
                    case 'toggleLight': toggleLight(actionJson.entity_id); break;
                    case 'startVacuum': startVacuum(actionJson.entity_id); break;
                    case 'returnVacuum': returnVacuum(actionJson.entity_id); break;
                    case 'pauseVacuum': pauseVacuum(actionJson.entity_id); break;
                    case 'openCover': openCover(actionJson.entity_id); break;
                    case 'closeCover': closeCover(actionJson.entity_id); break;
                    // Add more mappings as needed
                }
            }

        } catch (error) {
            console.error("Gemini Error:", error);
            let errorMessage = 'Entschuldigung, ich habe ein Problem beim Verarbeiten deiner Anfrage.';
            if (error instanceof Error) {
                errorMessage += `\nFehler: ${error.message}`;
            }
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: errorMessage,
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Sparkles size={24} color="#3B82F6" />
                <Text style={styles.headerTitle}>Gemini Assistant</Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
            >
                {messages.map((msg) => (
                    <View key={msg.id} style={[
                        styles.messageRow,
                        msg.role === 'user' ? styles.userRow : styles.modelRow
                    ]}>
                        {msg.role === 'model' && (
                            <View style={styles.avatarContainer}>
                                <Bot size={20} color="#fff" />
                            </View>
                        )}
                        <View style={[
                            styles.bubble,
                            msg.role === 'user' ? styles.userBubble : styles.modelBubble
                        ]}>
                            <Text style={[
                                styles.messageText,
                                msg.role === 'user' ? styles.userText : styles.modelText
                            ]}>{msg.text}</Text>
                        </View>
                    </View>
                ))}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#9CA3AF" />
                        <Text style={styles.loadingText}>Gemini denkt nach...</Text>
                    </View>
                )}
            </ScrollView>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                style={styles.inputWrapper}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Frag mich etwas..."
                        placeholderTextColor="#6B7280"
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={handleSend}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || isLoading}
                    >
                        <Send size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        gap: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 20,
        paddingBottom: 20,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
        gap: 10,
    },
    userRow: {
        justifyContent: 'flex-end',
    },
    modelRow: {
        justifyContent: 'flex-start',
    },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    bubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
    },
    userBubble: {
        backgroundColor: '#3B82F6',
        borderBottomRightRadius: 4,
    },
    modelBubble: {
        backgroundColor: '#1F2937',
        borderTopLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 24,
    },
    userText: {
        color: '#fff',
    },
    modelText: {
        color: '#E5E7EB',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        marginLeft: 42,
    },
    loadingText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    inputWrapper: {
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        backgroundColor: '#000000',
        padding: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#111827',
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#4B5563',
        opacity: 0.5,
    },
});

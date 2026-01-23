import { GoogleGenerativeAI } from "@google/generative-ai";
import { EntityState } from '../types';

export class GeminiService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    init(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    }

    async generateResponse(userMessage: string, entities: EntityState[]): Promise<string> {
        if (!this.model) {
            return "Fehler: Gemini AI ist nicht initialisiert. Bitte API-Key in .env setzen.";
        }

        try {
            const context = `
Sie sind ein intelligenter Home Assistant für ein Premium-Glassmorphism-Dashboard.

Aktueller Home-Status:
${entities.map(e => `- ${e.name} (${e.id}): ${e.state}${e.attributes.unit || ''}`).join('\n')}

Unterstützen Sie den Benutzer mit natürlichsprachlichen Anfragen zu ihren Geräten und dem Home-Status.
Halten Sie Antworten hilfreich, technisch korrekt und kurz. Verwenden Sie Deutsch als primäre Sprache.
`;

            const chat = this.model.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: context }],
                    },
                    {
                        role: "model",
                        parts: [{ text: "Verstanden. Ich bin bereit, Ihnen mit Ihrem SmartHome zu helfen." }],
                    },
                ],
            });

            const result = await chat.sendMessage(userMessage);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini Error:", error);
            return "Fehler bei der Kommunikation mit dem KI-Dienst.";
        }
    }
}

export const geminiService = new GeminiService();

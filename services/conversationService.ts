import Anthropic from '@anthropic-ai/sdk';
import { ConversationMessage, User } from '../types';
import { localLLMService } from './localLLMService';

const anthropic = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true
});
const MODEL_NAME = 'claude-sonnet-4-20250514';

const CONVERSATION_STORAGE_KEY = 'skyy_conversations';
const OFFLINE_MODE_KEY = 'skyy_offline_mode';

export const conversationService = {
    /**
     * Get conversation history for a specific user
     */
    getConversationHistory: (userId: string): ConversationMessage[] => {
        try {
            const stored = localStorage.getItem(`${CONVERSATION_STORAGE_KEY}_${userId}`);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    },

    /**
     * Save a message to conversation history
     */
    saveMessage: (userId: string, message: ConversationMessage): void => {
        const history = conversationService.getConversationHistory(userId);
        history.push(message);

        // Keep last 50 messages
        const trimmed = history.slice(-50);
        localStorage.setItem(`${CONVERSATION_STORAGE_KEY}_${userId}`, JSON.stringify(trimmed));
    },

    /**
     * Clear conversation history for a user
     */
    clearHistory: (userId: string): void => {
        localStorage.removeItem(`${CONVERSATION_STORAGE_KEY}_${userId}`);
    },

    /**
     * Check if offline mode is enabled
     */
    isOfflineMode: (): boolean => {
        return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
    },

    /**
     * Set offline mode
     */
    setOfflineMode: (enabled: boolean): void => {
        localStorage.setItem(OFFLINE_MODE_KEY, enabled.toString());
    },

    /**
     * Generate a conversational response using Gemini (online)
     */
    generateResponseOnline: async (
        userMessage: string,
        user: User,
        conversationHistory: ConversationMessage[],
        currentEmotion?: string
    ): Promise<string> => {
        try {
            // Build context from conversation history
            const historyContext = conversationHistory
                .slice(-10) // Last 10 messages for context
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');

            const emotionContext = currentEmotion ? `Current detected emotion: ${currentEmotion}` : '';

            const prompt = `You are a friendly AI assistant in a facial recognition system.
      You are talking to ${user.name}.
      
      ${emotionContext}
      
      Recent conversation:
      ${historyContext || '(No previous conversation)'}
      
      User says: "${userMessage}"
      
      Respond naturally and helpfully. Keep responses concise (2-3 sentences max).`;

            const response = await anthropic.messages.create({
                model: MODEL_NAME,
                max_tokens: 256,
                messages: [{ role: 'user', content: prompt }]
            });

            const textContent = response.content.find(c => c.type === 'text');
            return (textContent && textContent.type === 'text' ? textContent.text : null) || "I'm here to help! How can I assist you?";

        } catch (error: any) {
            console.error("Claude API Error:", error);
            throw error; // Let the caller handle fallback
        }
    },

    /**
     * Generate a conversational response using local model (offline)
     */
    generateResponseOffline: async (
        userMessage: string,
        user: User,
        conversationHistory: ConversationMessage[]
    ): Promise<string> => {
        try {
            // Build simplified context
            const recentMessages = conversationHistory.slice(-3);
            const context = recentMessages.length > 0
                ? recentMessages.map(msg => `${msg.role === 'user' ? user.name : 'Assistant'}: ${msg.content}`).join('\n')
                : '';

            const prompt = context
                ? `${context}\n${user.name}: ${userMessage}\nAssistant:`
                : `${user.name}: ${userMessage}\nAssistant:`;

            const response = await localLLMService.generateTextLocal(prompt, 50);

            // Clean up the response
            return response || "I'm running in offline mode. My responses may be limited.";
        } catch (error: any) {
            console.error("Local LLM Error:", error);
            return "Offline mode is not ready. Please try again or go online.";
        }
    },

    /**
     * Generate response with automatic online/offline fallback
     */
    generateResponse: async (
        userMessage: string,
        user: User,
        conversationHistory: ConversationMessage[],
        currentEmotion?: string,
        forceOffline: boolean = false
    ): Promise<{ text: string; usedOffline: boolean }> => {
        const offlineModeEnabled = forceOffline || conversationService.isOfflineMode();

        // Try online first if not in offline mode
        if (!offlineModeEnabled) {
            try {
                const text = await conversationService.generateResponseOnline(
                    userMessage,
                    user,
                    conversationHistory,
                    currentEmotion
                );
                return { text, usedOffline: false };
            } catch (error) {
                console.warn("Online model failed, falling back to offline...");
                // Fall back to offline
            }
        }

        // Use offline model
        const text = await conversationService.generateResponseOffline(
            userMessage,
            user,
            conversationHistory
        );
        return { text, usedOffline: true };
    },

    /**
     * Process a voice or text message with automatic fallback
     */
    processMessage: async (
        userId: string,
        messageContent: string,
        user: User,
        isVoice: boolean = false,
        currentEmotion?: string,
        forceOffline: boolean = false
    ): Promise<ConversationMessage & { usedOffline?: boolean }> => {
        // Save user message
        const userMessage: ConversationMessage = {
            id: crypto.randomUUID(),
            userId,
            role: 'user',
            content: messageContent,
            timestamp: new Date().toISOString(),
            isVoice
        };
        conversationService.saveMessage(userId, userMessage);

        // Get conversation history
        const history = conversationService.getConversationHistory(userId);

        // Generate AI response with fallback
        const { text: responseText, usedOffline } = await conversationService.generateResponse(
            messageContent,
            user,
            history,
            currentEmotion,
            forceOffline
        );

        // Save AI response
        const assistantMessage: ConversationMessage & { usedOffline?: boolean } = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: responseText,
            timestamp: new Date().toISOString(),
            usedOffline
        };
        conversationService.saveMessage(userId, assistantMessage);

        return assistantMessage;
    },

    /**
     * Check if online (Claude) is available
     */
    checkOnlineStatus: async (): Promise<boolean> => {
        try {
            const response = await anthropic.messages.create({
                model: MODEL_NAME,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'ping' }]
            });
            return response.content.length > 0;
        } catch {
            return false;
        }
    }
};

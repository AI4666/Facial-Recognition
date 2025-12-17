import { pipeline, env } from '@xenova/transformers';
import { ollamaService } from './ollamaService';

// Configure transformers.js to use local models (fallback only)
env.allowLocalModels = true;
env.allowRemoteModels = true;

let sentimentModel: any = null;
let textGenerationModel: any = null;
let ollamaAvailable: boolean | null = null;

export const localLLMService = {
    /**
     * Check if Ollama is available (cached result)
     */
    checkOllamaStatus: async (): Promise<boolean> => {
        if (ollamaAvailable === null) {
            ollamaAvailable = await ollamaService.checkConnection();
        }
        return ollamaAvailable;
    },

    /**
     * Reset Ollama availability check (for retry)
     */
    resetOllamaStatus: (): void => {
        ollamaAvailable = null;
    },

    /**
     * Initialize sentiment analysis model (Transformers.js fallback)
     */
    initSentimentModel: async (): Promise<void> => {
        if (!sentimentModel) {
            try {
                console.log('Loading local sentiment model...');
                sentimentModel = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
                console.log('Sentiment model loaded successfully');
            } catch (error) {
                console.error('Failed to load sentiment model:', error);
                throw error;
            }
        }
    },

    /**
     * Initialize text generation model (Transformers.js fallback)
     */
    initTextGenerationModel: async (): Promise<void> => {
        if (!textGenerationModel) {
            try {
                console.log('Loading local text generation model (GPT-2 fallback)...');
                textGenerationModel = await pipeline('text-generation', 'Xenova/gpt2');
                console.log('Text generation model loaded successfully');
            } catch (error) {
                console.error('Failed to load text generation model:', error);
                throw error;
            }
        }
    },

    /**
     * Analyze sentiment locally (offline capability)
     */
    analyzeSentimentLocal: async (text: string): Promise<{ label: string; score: number }> => {
        try {
            if (!sentimentModel) {
                await localLLMService.initSentimentModel();
            }

            const result = await sentimentModel(text);
            return {
                label: result[0].label.toLowerCase(),
                score: result[0].score
            };
        } catch (error) {
            console.error('Local sentiment analysis failed:', error);
            return { label: 'neutral', score: 0.5 };
        }
    },

    /**
     * Generate text response locally - tries Ollama first, falls back to GPT-2
     */
    generateTextLocal: async (prompt: string, maxLength: number = 50): Promise<string> => {
        // Try Ollama (Gemma 3) first
        try {
            const ollamaUp = await localLLMService.checkOllamaStatus();
            if (ollamaUp) {
                console.log('Using Ollama (Gemma 3) for text generation');
                return await ollamaService.generateText(prompt, maxLength);
            }
        } catch (error) {
            console.warn('Ollama failed, falling back to GPT-2:', error);
            ollamaAvailable = false;
        }

        // Fallback to GPT-2
        try {
            console.log('Using GPT-2 fallback for text generation');
            if (!textGenerationModel) {
                await localLLMService.initTextGenerationModel();
            }

            const result = await textGenerationModel(prompt, {
                max_new_tokens: maxLength,
                temperature: 0.7,
                do_sample: true
            });

            return result[0].generated_text.replace(prompt, '').trim();
        } catch (error) {
            console.error('Local text generation failed:', error);
            return "I'm currently offline. Please check your connection.";
        }
    },

    /**
     * Generate conversational response with Ollama priority
     */
    generateConversationalResponse: async (
        userMessage: string,
        userName: string,
        useLocalModel: boolean = false
    ): Promise<string> => {
        if (useLocalModel) {
            // Try Ollama first
            try {
                const ollamaUp = await localLLMService.checkOllamaStatus();
                if (ollamaUp) {
                    return await ollamaService.generateConversationalResponse(userMessage, userName);
                }
            } catch (error) {
                console.warn('Ollama conversation failed:', error);
            }

            // Fallback to GPT-2
            const prompt = `User ${userName} said: "${userMessage}"\nAssistant:`;
            const response = await localLLMService.generateTextLocal(prompt, 40);
            return response + ' (Offline Mode - GPT-2)';
        } else {
            return "Online model would be used here.";
        }
    },

    /**
     * Check if any local models are loaded
     */
    isReady: (): boolean => {
        return sentimentModel !== null || textGenerationModel !== null || ollamaAvailable === true;
    },

    /**
     * Check which local model is active
     */
    getActiveModel: async (): Promise<'ollama' | 'gpt2' | 'none'> => {
        const ollamaUp = await localLLMService.checkOllamaStatus();
        if (ollamaUp) return 'ollama';
        if (textGenerationModel !== null) return 'gpt2';
        return 'none';
    },

    /**
     * Unload models to free memory
     */
    unloadModels: (): void => {
        sentimentModel = null;
        textGenerationModel = null;
        console.log('Local models unloaded');
    }
};

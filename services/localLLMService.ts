import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js to use local models
env.allowLocalModels = true;
env.allowRemoteModels = true;

let sentimentModel: any = null;
let textGenerationModel: any = null;

export const localLLMService = {
    /**
     * Initialize sentiment analysis model
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
     * Initialize text generation model (for offline conversations)
     */
    initTextGenerationModel: async (): Promise<void> => {
        if (!textGenerationModel) {
            try {
                console.log('Loading local text generation model...');
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
     * Generate text response locally (offline capability)
     */
    generateTextLocal: async (prompt: string, maxLength: number = 50): Promise<string> => {
        try {
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
     * Generate conversational response with fallback
     */
    generateConversationalResponse: async (
        userMessage: string,
        userName: string,
        useLocalModel: boolean = false
    ): Promise<string> => {
        if (useLocalModel) {
            const prompt = `User ${userName} said: "${userMessage}"\nAssistant:`;
            return await localLLMService.generateTextLocal(prompt, 40);
        } else {
            // This would call Gemini in the real implementation
            return "Online model would be used here.";
        }
    },

    /**
     * Check if models are loaded
     */
    isReady: (): boolean => {
        return sentimentModel !== null || textGenerationModel !== null;
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

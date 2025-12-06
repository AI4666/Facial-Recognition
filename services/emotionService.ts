import { GoogleGenAI, Type } from "@google/genai";
import { Emotion, EmotionAnalysisResult } from '../types';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

export const emotionService = {
    /**
     * Analyzes facial expression to detect emotion and sentiment
     */
    analyzeEmotion: async (base64Image: string): Promise<EmotionAnalysisResult> => {
        try {
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: cleanBase64
                            }
                        },
                        {
                            text: `Analyze the facial expression in this image.
              
              Task:
              1. Detect the primary emotion from: happy, sad, angry, surprised, neutral, fearful, disgusted
              2. Rate your confidence (0-1)
              3. Determine overall sentiment: positive, negative, or neutral
              4. Provide a sentiment score from -1 (very negative) to +1 (very positive)
              
              Return strictly JSON.`
                        }
                    ]
                },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            primary: {
                                type: Type.STRING,
                                description: "One of: happy, sad, angry, surprised, neutral, fearful, disgusted"
                            },
                            confidence: { type: Type.NUMBER },
                            sentiment: {
                                type: Type.STRING,
                                description: "One of: positive, negative, neutral"
                            },
                            sentimentScore: { type: Type.NUMBER }
                        },
                        required: ['primary', 'confidence', 'sentiment', 'sentimentScore']
                    }
                }
            });

            if (!response.text) throw new Error("No response from AI");

            const result = JSON.parse(response.text);
            const emotion: Emotion = {
                ...result,
                timestamp: new Date().toISOString()
            };

            return { emotion };

        } catch (error: any) {
            console.error("Emotion Analysis Error:", error);
            return {
                emotion: {
                    primary: 'neutral',
                    confidence: 0,
                    sentiment: 'neutral',
                    sentimentScore: 0,
                    timestamp: new Date().toISOString()
                },
                error: error.message || "Failed to analyze emotion"
            };
        }
    },

    /**
     * Calculate average mood from emotion history
     */
    calculateAverageMood: (emotions: Emotion[]): 'positive' | 'negative' | 'neutral' => {
        if (emotions.length === 0) return 'neutral';

        const avgScore = emotions.reduce((sum, e) => sum + e.sentimentScore, 0) / emotions.length;

        if (avgScore > 0.2) return 'positive';
        if (avgScore < -0.2) return 'negative';
        return 'neutral';
    }
};

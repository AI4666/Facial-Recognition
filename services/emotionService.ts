import Anthropic from '@anthropic-ai/sdk';
import { Emotion, EmotionAnalysisResult } from '../types';

const anthropic = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true
});
const MODEL_NAME = 'claude-sonnet-4-20250514';

export const emotionService = {
    /**
     * Analyzes facial expression to detect emotion and sentiment
     */
    analyzeEmotion: async (base64Image: string): Promise<EmotionAnalysisResult> => {
        try {
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

            const response = await anthropic.messages.create({
                model: MODEL_NAME,
                max_tokens: 256,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: cleanBase64
                                }
                            },
                            {
                                type: 'text',
                                text: `Analyze the facial expression in this image.
              
              Task:
              1. Detect the primary emotion from: happy, sad, angry, surprised, neutral, fearful, disgusted
              2. Rate your confidence (0-1)
              3. Determine overall sentiment: positive, negative, or neutral
              4. Provide a sentiment score from -1 (very negative) to +1 (very positive)
              
              Return ONLY valid JSON with this exact structure:
              {
                "primary": "emotion",
                "confidence": 0.0,
                "sentiment": "positive|negative|neutral",
                "sentimentScore": 0.0
              }`
                            }
                        ]
                    }
                ]
            });

            // Extract the text content from response
            const textContent = response.content.find(c => c.type === 'text');
            if (!textContent || textContent.type !== 'text') {
                throw new Error("No text response from Claude");
            }

            // Parse JSON from response (handle potential markdown code blocks)
            let jsonText = textContent.text;
            const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonText = jsonMatch[1].trim();
            }

            const result = JSON.parse(jsonText);
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

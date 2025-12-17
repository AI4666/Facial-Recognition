/**
 * Ollama Service - Local AI using Gemma 3
 * Provides text generation and multimodal vision capabilities via Ollama
 */

import { DetectionResult, RecognitionResult, User } from '../types';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL_NAME = 'gemma3:4b'; // Use gemma3:12b or gemma3:27b for better quality

interface OllamaResponse {
    model: string;
    response: string;
    done: boolean;
}

interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    images?: string[]; // Base64 encoded images for vision
    options?: {
        temperature?: number;
        num_predict?: number;
    };
}

export const ollamaService = {
    /**
     * Check if Ollama is running and accessible
     */
    checkConnection: async (): Promise<boolean> => {
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
                method: 'GET',
            });
            return response.ok;
        } catch {
            return false;
        }
    },

    /**
     * Check if Gemma 3 model is available
     */
    isModelAvailable: async (): Promise<boolean> => {
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            if (!response.ok) return false;
            
            const data = await response.json();
            const models = data.models || [];
            return models.some((m: any) => m.name.includes('gemma3'));
        } catch {
            return false;
        }
    },

    /**
     * Generate text response using Gemma 3
     */
    generateText: async (prompt: string, maxTokens: number = 100): Promise<string> => {
        try {
            const request: OllamaGenerateRequest = {
                model: MODEL_NAME,
                prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    num_predict: maxTokens
                }
            };

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();
            return data.response;
        } catch (error: any) {
            console.error('Ollama text generation failed:', error);
            throw error;
        }
    },

    /**
     * Analyze image using Gemma 3 multimodal vision
     */
    analyzeImage: async (base64Image: string, prompt: string): Promise<string> => {
        try {
            // Clean base64 string (remove data URL prefix if present)
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

            const request: OllamaGenerateRequest = {
                model: MODEL_NAME,
                prompt,
                stream: false,
                images: [cleanBase64],
                options: {
                    temperature: 0.3,
                    num_predict: 500
                }
            };

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Ollama vision API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();
            return data.response;
        } catch (error: any) {
            console.error('Ollama vision analysis failed:', error);
            throw error;
        }
    },

    /**
     * Detect face in image for registration (offline capability)
     */
    detectFaceForRegistration: async (base64Image: string): Promise<DetectionResult> => {
        try {
            const prompt = `Analyze this image for a facial recognition registration system.
You must respond ONLY with valid JSON, no other text.

Check:
1. Is there exactly one human face visible?
2. Is the face clear, unobstructed, and good quality?
3. Describe the person's physical features (hair color, glasses, facial hair, distinctive features).

Respond with this exact JSON format:
{
  "faceDetected": true/false,
  "multipleFaces": true/false,
  "qualityCheckPassed": true/false,
  "description": "detailed description of the face",
  "error": null or "error message"
}`;

            const response = await ollamaService.analyzeImage(base64Image, prompt);
            
            // Try to parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return {
                    faceDetected: false,
                    multipleFaces: false,
                    qualityCheckPassed: false,
                    error: 'Failed to parse Gemma response'
                };
            }

            const result = JSON.parse(jsonMatch[0]);
            return {
                faceDetected: result.faceDetected ?? false,
                multipleFaces: result.multipleFaces ?? false,
                qualityCheckPassed: result.qualityCheckPassed ?? false,
                description: result.description,
                error: result.error
            };
        } catch (error: any) {
            console.error('Ollama face detection failed:', error);
            return {
                faceDetected: false,
                multipleFaces: false,
                qualityCheckPassed: false,
                error: error.message || 'Ollama face detection failed'
            };
        }
    },

    /**
     * Recognize user by comparing face against known users (offline capability)
     */
    recognizeUser: async (base64Image: string, knownUsers: User[]): Promise<RecognitionResult> => {
        try {
            if (knownUsers.length === 0) {
                return { matchFound: false, error: "No users in database.", confidence: 0 };
            }

            // Build user profiles for comparison
            const userProfiles = knownUsers.map(u => 
                `ID: ${u.id}, Name: ${u.name}, Description: ${u.faceDescription}`
            ).join('\n');

            const prompt = `You are a facial recognition system. Compare the person in this image against these registered users:

${userProfiles}

Task:
1. Is there a person clearly visible in the image?
2. Does this person match ANY of the registered users based on their descriptions?
3. If matched, generate a friendly personalized greeting.
4. If no match, provide a polite greeting for a visitor.

Respond ONLY with this exact JSON format:
{
  "matchFound": true/false,
  "userId": "the matched user's ID or null",
  "confidence": 0.0 to 1.0,
  "greeting": "personalized greeting message"
}`;

            const response = await ollamaService.analyzeImage(base64Image, prompt);
            
            // Parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return {
                    matchFound: false,
                    confidence: 0,
                    error: 'Failed to parse recognition response'
                };
            }

            const result = JSON.parse(jsonMatch[0]);
            return {
                matchFound: result.matchFound ?? false,
                userId: result.userId,
                confidence: result.confidence ?? 0,
                greeting: result.greeting
            };
        } catch (error: any) {
            console.error('Ollama recognition failed:', error);
            return {
                matchFound: false,
                confidence: 0,
                error: error.message || 'AI Processing Failed (Offline)'
            };
        }
    },

    /**
     * Generate conversational response for chat
     */
    generateConversationalResponse: async (
        userMessage: string,
        userName: string,
        conversationContext?: string
    ): Promise<string> => {
        const prompt = `You are a friendly AI assistant in a facial recognition system.
You are talking to ${userName}.

${conversationContext ? `Recent conversation:\n${conversationContext}\n` : ''}

User says: "${userMessage}"

Respond naturally and helpfully. Keep your response concise (2-3 sentences max).`;

        try {
            const response = await ollamaService.generateText(prompt, 150);
            return response.trim() + ' (Offline Mode)';
        } catch (error) {
            return "I'm having trouble connecting to the local AI. Please check if Ollama is running. (Offline Mode)";
        }
    }
};

/**
 * Ollama Service - Local AI using Gemma 3
 * Provides text generation and multimodal vision capabilities via Ollama
 */

import { DetectionResult, RecognitionResult, User } from '../types';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const GEMMA_MODEL = 'gemma3:4b'; // Use gemma3:12b or gemma3:27b for better quality
const MOONDREAM_MODEL = 'moondream';

// Current active model (default to Gemma 3)
let currentModel = GEMMA_MODEL;

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
                model: currentModel,
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
                model: currentModel,
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
    },

    // ==========================================
    // MOONDREAM VISION METHODS
    // ==========================================

    /**
     * Get current model name
     */
    getCurrentModel: (): string => {
        return currentModel;
    },

    /**
     * Set the active vision model
     */
    setModel: (modelName: 'gemma3' | 'moondream'): void => {
        currentModel = modelName === 'moondream' ? MOONDREAM_MODEL : GEMMA_MODEL;
        console.log(`Ollama model switched to: ${currentModel}`);
    },

    /**
     * Check if Moondream model is available
     */
    isMoondreamAvailable: async (): Promise<boolean> => {
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            if (!response.ok) return false;

            const data = await response.json();
            const models = data.models || [];
            return models.some((m: any) => m.name.includes('moondream'));
        } catch {
            return false;
        }
    },

    /**
     * Describe what's visible in the scene (using Moondream)
     */
    describeScene: async (base64Image: string): Promise<string> => {
        try {
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

            const request: OllamaGenerateRequest = {
                model: MOONDREAM_MODEL,
                prompt: 'Describe what you see in this image in detail.',
                stream: false,
                images: [cleanBase64],
                options: {
                    temperature: 0.3,
                    num_predict: 300
                }
            };

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Moondream API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();
            return data.response.trim();
        } catch (error: any) {
            console.error('Moondream scene description failed:', error);
            throw error;
        }
    },

    /**
     * Detect if a specific object is present in the image
     */
    detectObjects: async (base64Image: string, objectName: string): Promise<{ detected: boolean; description: string }> => {
        try {
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

            const request: OllamaGenerateRequest = {
                model: MOONDREAM_MODEL,
                prompt: `Look at this image carefully. Is there a ${objectName} visible in this image? Start your answer with YES or NO.`,
                stream: false,
                images: [cleanBase64],
                options: {
                    temperature: 0.1,
                    num_predict: 200
                }
            };

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Moondream API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();
            const text = data.response.trim().toLowerCase();

            // Check if response starts with yes or no
            const startsWithYes = text.startsWith('yes');
            const startsWithNo = text.startsWith('no');

            // If it starts with yes, it's detected
            // If it starts with no, it's not detected
            // Otherwise, look for yes/no anywhere but prefer yes
            let detected = false;
            if (startsWithYes) {
                detected = true;
            } else if (startsWithNo) {
                detected = false;
            } else {
                // Fallback: check if 'yes' appears more prominently than 'no'
                detected = text.includes('yes') && !text.includes('no ');
            }

            return {
                detected,
                description: data.response.trim()
            };
        } catch (error: any) {
            console.error('Moondream object detection failed:', error);
            throw error;
        }
    },

    /**
     * Analyze emotions/expressions in the image
     */
    analyzeEmotions: async (base64Image: string): Promise<{ emotions: string[]; description: string }> => {
        try {
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

            const request: OllamaGenerateRequest = {
                model: MOONDREAM_MODEL,
                prompt: 'What emotions or expressions do you see on the faces in this image? Describe the mood and feelings of the people.',
                stream: false,
                images: [cleanBase64],
                options: {
                    temperature: 0.3,
                    num_predict: 200
                }
            };

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Moondream API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();
            const text = data.response.toLowerCase();

            // Extract emotion keywords
            const emotionKeywords = ['happy', 'sad', 'angry', 'surprised', 'neutral', 'smiling', 'frowning', 'excited', 'calm', 'worried', 'confused'];
            const detectedEmotions = emotionKeywords.filter(emotion => text.includes(emotion));

            return {
                emotions: detectedEmotions.length > 0 ? detectedEmotions : ['undetermined'],
                description: data.response.trim()
            };
        } catch (error: any) {
            console.error('Moondream emotion analysis failed:', error);
            throw error;
        }
    },

    /**
     * Count the number of people in the image
     */
    countPeople: async (base64Image: string): Promise<{ count: number; description: string }> => {
        try {
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

            const request: OllamaGenerateRequest = {
                model: MOONDREAM_MODEL,
                prompt: 'Count the number of people visible in this image. Start your response with the exact number (like "1", "2", "3" or "0" if no people). Then describe what you see.',
                stream: false,
                images: [cleanBase64],
                options: {
                    temperature: 0.1,
                    num_predict: 200
                }
            };

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Moondream API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();
            const text = data.response.trim();
            const lowerText = text.toLowerCase();

            // Try to extract a number from the start of the response first
            const startNumberMatch = text.match(/^(\d+)/);
            if (startNumberMatch) {
                return {
                    count: parseInt(startNumberMatch[1], 10),
                    description: text
                };
            }

            // Try to find any number in the response
            const numberMatch = text.match(/\b(\d+)\b/);
            if (numberMatch) {
                return {
                    count: parseInt(numberMatch[1], 10),
                    description: text
                };
            }

            // Check for word numbers (in priority order - higher numbers first)
            const wordNumbers: [string, number][] = [
                ['ten', 10], ['nine', 9], ['eight', 8], ['seven', 7], ['six', 6],
                ['five', 5], ['four', 4], ['three', 3], ['two', 2], ['one', 1],
                ['a person', 1], ['single', 1], ['alone', 1],
                ['zero', 0], ['none', 0], ['no people', 0], ['nobody', 0], ['empty', 0]
            ];

            for (const [word, num] of wordNumbers) {
                if (lowerText.includes(word)) {
                    return {
                        count: num,
                        description: text
                    };
                }
            }

            // Default: if mention of 'person' or 'people' assume at least 1
            if (lowerText.includes('person') || lowerText.includes('people') || lowerText.includes('man') || lowerText.includes('woman')) {
                return {
                    count: 1,
                    description: text
                };
            }

            return {
                count: 0,
                description: text
            };
        } catch (error: any) {
            console.error('Moondream people counting failed:', error);
            throw error;
        }
    },

    /**
     * Answer a free-form question about the image
     */
    answerQuestion: async (base64Image: string, question: string): Promise<string> => {
        try {
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

            const request: OllamaGenerateRequest = {
                model: MOONDREAM_MODEL,
                prompt: question,
                stream: false,
                images: [cleanBase64],
                options: {
                    temperature: 0.4,
                    num_predict: 300
                }
            };

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Moondream API error: ${response.status}`);
            }

            const data: OllamaResponse = await response.json();
            return data.response.trim();
        } catch (error: any) {
            console.error('Moondream Q&A failed:', error);
            throw error;
        }
    }
};

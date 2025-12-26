import Anthropic from '@anthropic-ai/sdk';
import { SecurityCheck, LivenessResult } from '../types';

const anthropic = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true
});
const MODEL_NAME = 'claude-sonnet-4-20250514';

export const securityService = {
    /**
     * Perform liveness detection using multi-frame analysis
     */
    checkLiveness: async (frames: string[]): Promise<LivenessResult> => {
        try {
            if (frames.length < 2) {
                throw new Error("Need at least 2 frames for liveness detection");
            }

            // Analyze the first and last frame for changes
            const cleanFrames = frames.map(f => f.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''));

            const response = await anthropic.messages.create({
                model: MODEL_NAME,
                max_tokens: 512,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: cleanFrames[0]
                                }
                            },
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: cleanFrames[cleanFrames.length - 1]
                                }
                            },
                            {
                                type: 'text',
                                text: `Compare these two images taken moments apart for liveness detection:
              
              1. Is there evidence of blinking between frames?
              2. Is there natural micro-movement (head position, eye direction)?
              3. Does the person appear to be a real 3D face (not a photo or screen)?
              4. Rate liveness confidence (0-1)
              
              Return ONLY valid JSON with this exact structure:
              {
                "blinkDetected": boolean,
                "movementDetected": boolean,
                "appears3D": boolean,
                "livenessScore": number
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

            const livenessDetected = result.blinkDetected || result.movementDetected;
            const passed = livenessDetected && result.appears3D && result.livenessScore > 0.5;

            const livenesResult: LivenessResult = {
                livenessDetected,
                livenessScore: result.livenessScore,
                spoofDetected: !result.appears3D,
                spoofConfidence: result.appears3D ? 0 : 0.8,
                details: {
                    blinkDetected: result.blinkDetected,
                    movementDetected: result.movementDetected,
                    depthAnalysis: result.appears3D ? 'pass' : 'fail'
                },
                timestamp: new Date().toISOString(),
                passed,
                frameAnalysis: frames.map((_, i) => ({
                    frameNumber: i,
                    blinkDetected: i > 0 && result.blinkDetected,
                    movementScore: result.movementDetected ? 0.7 : 0.1
                }))
            };

            return livenesResult;

        } catch (error: any) {
            console.error("Liveness Detection Error:", error);
            return {
                livenessDetected: false,
                livenessScore: 0,
                spoofDetected: false,
                spoofConfidence: 0,
                details: {},
                timestamp: new Date().toISOString(),
                passed: false,
                frameAnalysis: []
            };
        }
    },

    /**
     * Check for common spoofing attempts (photos, screens)
     */
    detectSpoof: async (base64Image: string): Promise<SecurityCheck> => {
        try {
            const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

            const response = await anthropic.messages.create({
                model: MODEL_NAME,
                max_tokens: 512,
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
                                text: `Analyze this image for anti-spoofing:
              
              1. Is this a printed photo being held up? (look for paper edges, glare)
              2. Is this a screen/monitor being shown? (look for pixelation, screen bezel)
              3. Does the face show natural skin texture and depth?
              4. Rate spoof confidence (0-1, higher = more likely a spoof)
              
              Return ONLY valid JSON with this exact structure:
              {
                "printDetected": boolean,
                "screenDetected": boolean,
                "naturalTexture": boolean,
                "spoofConfidence": number
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

            const spoofDetected = result.printDetected || result.screenDetected || result.spoofConfidence > 0.7;
            const passed = !spoofDetected && result.naturalTexture;

            return {
                livenessDetected: result.naturalTexture,
                livenessScore: result.naturalTexture ? 0.8 : 0.2,
                spoofDetected,
                spoofConfidence: result.spoofConfidence,
                details: {
                    printDetection: result.printDetected,
                    screenDetection: result.screenDetected
                },
                timestamp: new Date().toISOString(),
                passed
            };

        } catch (error: any) {
            console.error("Spoof Detection Error:", error);
            return {
                livenessDetected: false,
                livenessScore: 0,
                spoofDetected: false,
                spoofConfidence: 0,
                details: {},
                timestamp: new Date().toISOString(),
                passed: false
            };
        }
    }
};

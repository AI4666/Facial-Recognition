/**
 * Vision Pipeline Service
 * Coordinates vision analysis using local YOLOv8 server or Moondream via Ollama
 * Provides continuous detection loop and frame analysis
 */

import { ollamaService } from './ollamaService';

// Types for vision results
export interface VisionResult {
    description?: string;
    objects?: { name: string; detected: boolean; details?: string }[];
    emotions?: { emotion: string; confidence: number }[];
    peopleCount?: number;
    timestamp: string;
    model: 'moondream' | 'gemma3' | 'yolov8-local';
    processingTimeMs: number;
}

export interface VisionAnalysisOptions {
    describeScene?: boolean;
    detectObjects?: string[];  // List of object names to look for
    analyzeEmotions?: boolean;
    countPeople?: boolean;
    customQuestion?: string;
}

// Configuration
const VISION_SERVER_URL = 'http://localhost:8000';

// State
let isRunning = false;
let analysisInterval: ReturnType<typeof setInterval> | null = null;
let lastResult: VisionResult | null = null;
let serverAvailable = false;
let lastServerCheck = 0;

export const visionPipeline = {
    /**
     * Check if local vision server is available
     * Caches result for 10 seconds
     */
    isServerAvailable: async (forceCheck = false): Promise<boolean> => {
        const now = Date.now();
        if (!forceCheck && now - lastServerCheck < 10000) {
            return serverAvailable;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout

            const response = await fetch(`${VISION_SERVER_URL}/health`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                serverAvailable = data.status === 'running';
            } else {
                serverAvailable = false;
            }
        } catch (e) {
            serverAvailable = false;
        }

        lastServerCheck = now;
        return serverAvailable;
    },

    /**
     * Check if the pipeline is currently running
     */
    isRunning: (): boolean => {
        return isRunning;
    },

    /**
     * Get the last analysis result
     */
    getLastResult: (): VisionResult | null => {
        return lastResult;
    },

    /**
     * Analyze a single frame with specified options
     */
    analyzeFrame: async (
        base64Image: string,
        options: VisionAnalysisOptions = { describeScene: true }
    ): Promise<VisionResult> => {
        const startTime = Date.now();
        const useLocalServer = await visionPipeline.isServerAvailable();
        const moondreamAvailable = await ollamaService.isMoondreamAvailable();

        const result: VisionResult = {
            timestamp: new Date().toISOString(),
            model: useLocalServer ? 'yolov8-local' : (moondreamAvailable ? 'moondream' : 'gemma3'),
            processingTimeMs: 0
        };

        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

        try {
            const promises: Promise<void>[] = [];

            // 1. Scene description
            if (options.describeScene) {
                promises.push((async () => {
                    try {
                        if (useLocalServer) {
                            // Use local server for description (relays to Moondream)
                            const response = await fetch(`${VISION_SERVER_URL}/analyze`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    image: cleanBase64,
                                    question: "Describe what you see in this image in detail."
                                })
                            });
                            const data = await response.json();
                            result.description = data.answer;
                        } else if (moondreamAvailable) {
                            result.description = await ollamaService.describeScene(base64Image);
                        } else {
                            // Fallback to Gemma
                            result.description = await ollamaService.analyzeImage(
                                base64Image,
                                'Describe what you see in this image.'
                            );
                        }
                    } catch (e) {
                        console.error('Scene description failed:', e);
                        result.description = 'Analysis failed';
                    }
                })());
            }

            // 2. Object detection
            if (options.detectObjects && options.detectObjects.length > 0) {
                promises.push((async () => {
                    result.objects = [];

                    if (useLocalServer) {
                        // Use YOLOv8 for all objects in one pass
                        try {
                            const response = await fetch(`${VISION_SERVER_URL}/detect/objects`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ image: cleanBase64 })
                            });
                            const data = await response.json();
                            const yoloObjects = data.objects || [];

                            // Map requested objects to detections
                            for (const reqObj of options.detectObjects!) {
                                // Simple string matching, usually enough for YOLO classes
                                const found = yoloObjects.find((o: any) =>
                                    o.label.toLowerCase().includes(reqObj.toLowerCase()) ||
                                    reqObj.toLowerCase().includes(o.label.toLowerCase())
                                );

                                result.objects.push({
                                    name: reqObj,
                                    detected: !!found,
                                    details: found ? `Detected with ${(found.confidence * 100).toFixed(0)}% confidence` : 'Not detected by YOLO'
                                });
                            }
                        } catch (e) {
                            console.error('Local Object detection failed:', e);
                        }
                    } else {
                        // Fallback processing per object
                        for (const objectName of options.detectObjects!) {
                            try {
                                if (moondreamAvailable) {
                                    const detection = await ollamaService.detectObjects(base64Image, objectName);
                                    result.objects.push({
                                        name: objectName,
                                        detected: detection.detected,
                                        details: detection.description
                                    });
                                } else {
                                    const response = await ollamaService.analyzeImage(
                                        base64Image,
                                        `Do you see a ${objectName} in this image? Answer yes or no.`
                                    );
                                    result.objects.push({
                                        name: objectName,
                                        detected: response.toLowerCase().includes('yes'),
                                        details: response
                                    });
                                }
                            } catch (e) {
                                result.objects.push({ name: objectName, detected: false, details: 'Error' });
                            }
                        }
                    }
                })());
            }

            // 3. People Counting
            if (options.countPeople) {
                promises.push((async () => {
                    if (useLocalServer) {
                        try {
                            // Check objects endpoint for 'person' class
                            const response = await fetch(`${VISION_SERVER_URL}/detect/objects`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ image: cleanBase64 })
                            });
                            const data = await response.json();
                            const people = (data.objects || []).filter((o: any) => o.label === 'person');
                            result.peopleCount = people.length;
                        } catch (e) {
                            console.error('Local people count failed:', e);
                            result.peopleCount = 0;
                        }
                    } else {
                        // Fallback
                        try {
                            if (moondreamAvailable) {
                                const countResult = await ollamaService.countPeople(base64Image);
                                result.peopleCount = countResult.count;
                            } else {
                                const response = await ollamaService.analyzeImage(
                                    base64Image,
                                    'How many people are in this image? Just give a number.'
                                );
                                const match = response.match(/\d+/);
                                result.peopleCount = match ? parseInt(match[0], 10) : 0;
                            }
                        } catch (error) {
                            console.error('People counting failed:', error);
                            result.peopleCount = 0;
                        }
                    }
                })());
            }

            // 4. Custom Question
            if (options.customQuestion) {
                promises.push((async () => {
                    try {
                        if (useLocalServer) {
                            const response = await fetch(`${VISION_SERVER_URL}/analyze`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    image: cleanBase64,
                                    question: options.customQuestion
                                })
                            });
                            const data = await response.json();
                            // If description is not set, use this answer
                            if (!result.description) result.description = data.answer;
                            else result.description += ` | Answer: ${data.answer}`;
                        } else if (moondreamAvailable) {
                            const ans = await ollamaService.answerQuestion(base64Image, options.customQuestion!);
                            if (!result.description) result.description = ans;
                            else result.description += ` | Answer: ${ans}`;
                        } else {
                            const ans = await ollamaService.analyzeImage(base64Image, options.customQuestion!);
                            if (!result.description) result.description = ans;
                            else result.description += ` | Answer: ${ans}`;
                        }
                    } catch (e) {
                        console.error('Custom question failed:', e);
                    }
                })());
            }

            await Promise.all(promises);

        } catch (error) {
            console.error('Vision pipeline error:', error);
        }

        result.processingTimeMs = Date.now() - startTime;
        lastResult = result;
        return result;
    },

    /**
     * Start continuous frame analysis
     */
    startContinuousAnalysis: (
        captureCallback: () => Promise<string | null>,
        onResult: (result: VisionResult) => void,
        options: VisionAnalysisOptions = { describeScene: true },
        intervalMs: number = 2000 // Faster interval for local server
    ): void => {
        if (isRunning) {
            console.warn('Vision pipeline already running');
            return;
        }

        isRunning = true;
        console.log('Vision pipeline started');

        // Initial check
        visionPipeline.isServerAvailable(true);

        analysisInterval = setInterval(async () => {
            if (!isRunning) return;

            try {
                const image = await captureCallback();
                if (image) {
                    const result = await visionPipeline.analyzeFrame(image, options);
                    onResult(result);
                }
            } catch (error) {
                console.error('Continuous analysis error:', error);
            }
        }, intervalMs);
    },

    /**
     * Stop continuous analysis
     */
    stopAnalysis: (): void => {
        isRunning = false;
        if (analysisInterval) {
            clearInterval(analysisInterval);
            analysisInterval = null;
        }
        console.log('Vision pipeline stopped');
    },

    /**
     * Quick scene description
     */
    quickDescribe: async (base64Image: string): Promise<string> => {
        const result = await visionPipeline.analyzeFrame(base64Image, { describeScene: true });
        return result.description || "Could not describe scene.";
    },

    /**
     * Quick object check
     */
    quickObjectCheck: async (base64Image: string, objectName: string): Promise<string> => {
        const result = await visionPipeline.analyzeFrame(base64Image, { detectObjects: [objectName] });
        const obj = result.objects?.find(o => o.name === objectName);
        if (obj) {
            return obj.detected ? `Yes, I see a ${objectName}.` : `No, I don't see a ${objectName}.`;
        }
        return "Could not check for object.";
    },

    /**
     * Quick people count
     */
    quickPeopleCount: async (base64Image: string): Promise<string> => {
        const result = await visionPipeline.analyzeFrame(base64Image, { countPeople: true });
        const count = result.peopleCount || 0;
        return count === 0 ? "I don't see any people." : `I see ${count} ${count === 1 ? 'person' : 'people'}.`;
    }
};

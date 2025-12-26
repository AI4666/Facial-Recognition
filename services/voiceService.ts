import { VoiceCommand } from '../types';

const WAKE_WORD = 'hello gemma';

export const voiceService = {
    /**
     * Check if browser supports speech recognition
     */
    isSupported: (): boolean => {
        return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    },

    /**
     * Check if browser supports speech synthesis
     */
    isTTSSupported: (): boolean => {
        return 'speechSynthesis' in window;
    },

    /**
     * Create a speech recognition instance
     */
    createRecognition: (continuous: boolean = false): any => {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = continuous; // Show interim results for wake word
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        return recognition;
    },

    /**
     * Start speech recognition and return a promise with the transcript
     */
    startListening: (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!voiceService.isSupported()) {
                reject(new Error('Speech recognition not supported'));
                return;
            }

            const recognition = voiceService.createRecognition();
            if (!recognition) {
                reject(new Error('Failed to create recognition instance'));
                return;
            }

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                resolve(transcript);
            };

            recognition.onerror = (event: any) => {
                reject(new Error(event.error));
            };

            recognition.start();

            // Auto-timeout after 10 seconds
            setTimeout(() => {
                recognition.stop();
                reject(new Error('Listening timeout'));
            }, 10000);
        });
    },

    /**
     * Start continuous listening for wake word "Hello Gemma"
     * Returns a recognition instance that can be stopped
     */
    startWakeWordListening: (onWakeWord: () => void, onError?: (error: Error) => void): any => {
        if (!voiceService.isSupported()) {
            onError?.(new Error('Speech recognition not supported'));
            return null;
        }

        const recognition = voiceService.createRecognition(true);
        if (!recognition) {
            onError?.(new Error('Failed to create recognition instance'));
            return null;
        }

        recognition.onresult = (event: any) => {
            // Check all results for wake word
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.toLowerCase().trim();

                // Check if wake word is detected
                if (transcript.includes(WAKE_WORD) ||
                    transcript.includes('hello jemma') ||
                    transcript.includes('hey gemma')) {
                    console.log('Wake word detected:', transcript);
                    onWakeWord();
                    // Don't stop - keep listening for next wake word
                }
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Wake word error:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                onError?.(new Error(event.error));
            }
        };

        // Auto-restart when recognition ends (for continuous listening)
        recognition.onend = () => {
            // Restart unless explicitly stopped
            try {
                recognition.start();
            } catch (e) {
                // Already started or stopped
            }
        };

        recognition.start();
        console.log('Wake word listening started. Say "Hello Gemma" to activate.');

        return recognition;
    },

    /**
     * Stop wake word listening
     */
    stopWakeWordListening: (recognition: any): void => {
        if (recognition) {
            recognition.onend = null; // Prevent auto-restart
            recognition.stop();
            console.log('Wake word listening stopped');
        }
    },

    /**
     * Speak text using text-to-speech
     */
    speak: (text: string, voiceName?: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!voiceService.isTTSSupported()) {
                reject(new Error('Text-to-speech not supported'));
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);

            // Try to find the requested voice
            if (voiceName) {
                const voices = window.speechSynthesis.getVoices();
                const voice = voices.find(v => v.name === voiceName);
                if (voice) utterance.voice = voice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (event) => reject(new Error('Speech synthesis failed'));

            window.speechSynthesis.speak(utterance);
        });
    },

    /**
     * Get available voices
     */
    getVoices: (): SpeechSynthesisVoice[] => {
        if (!voiceService.isTTSSupported()) return [];
        return window.speechSynthesis.getVoices();
    },

    /**
     * Parse voice command to extract intent
     */
    parseCommand: (transcript: string): VoiceCommand => {
        const lowerTranscript = transcript.toLowerCase();
        let command = 'unknown';
        let executed = false;

        // Check for wake word first
        if (lowerTranscript.includes(WAKE_WORD) ||
            lowerTranscript.includes('hello jemma') ||
            lowerTranscript.includes('hey gemma')) {
            command = 'wake_word';
        }
        // Command patterns (check specific commands first)
        else if (lowerTranscript.includes('register') || lowerTranscript.includes('new user')) {
            command = 'register_user';
        } else if (lowerTranscript.includes('capture') || lowerTranscript.includes('take photo')) {
            command = 'capture_image';
        } else if (lowerTranscript.includes('monitor') || lowerTranscript.includes('start recognition')) {
            command = 'start_recognition';
        } else if (lowerTranscript.includes('stop') || lowerTranscript.includes('pause')) {
            command = 'stop_recognition';
        } else if (lowerTranscript.includes('settings') || lowerTranscript.includes('preferences')) {
            command = 'open_settings';
        } else if (lowerTranscript.includes('yes') || lowerTranscript.includes('confirm')) {
            command = 'confirm';
        } else if (lowerTranscript.includes('no') || lowerTranscript.includes('cancel')) {
            command = 'cancel';
        }
        // ==========================================
        // VISION COMMANDS
        // ==========================================
        else if (lowerTranscript.includes('what do you see') ||
            lowerTranscript.includes('describe') ||
            lowerTranscript.includes('what is this') ||
            lowerTranscript.includes('look at')) {
            command = 'describe_scene';
        } else if (lowerTranscript.includes('is there a') ||
            lowerTranscript.includes('do you see a') ||
            lowerTranscript.includes('can you see a')) {
            command = 'detect_object';
        } else if (lowerTranscript.includes('how many people') ||
            lowerTranscript.includes('count people') ||
            lowerTranscript.includes('how many persons')) {
            command = 'count_people';
        } else if (lowerTranscript.includes('begin detection') ||
            lowerTranscript.includes('start detection') ||
            lowerTranscript.includes('begin scanning')) {
            command = 'begin_detection';
        } else if (lowerTranscript.includes('stop detection') ||
            lowerTranscript.includes('end detection') ||
            lowerTranscript.includes('stop scanning')) {
            command = 'stop_detection';
        } else {
            command = 'chat'; // Default to chat message
        }

        return {
            command,
            transcript,
            confidence: 1.0, // Web Speech API doesn't provide this consistently
            timestamp: new Date().toISOString(),
            executed
        };
    },

    /**
     * Get the wake word phrase
     */
    getWakeWord: (): string => {
        return WAKE_WORD;
    }
};

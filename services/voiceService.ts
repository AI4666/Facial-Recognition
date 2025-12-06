import { VoiceCommand } from '../types';

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
    createRecognition: (): any => {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
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

        // Command patterns (check specific commands first)
        if (lowerTranscript.includes('register') || lowerTranscript.includes('new user')) {
            command = 'register_user';
        } else if (lowerTranscript.includes('capture') || lowerTranscript.includes('take photo')) {
            command = 'capture_image';
        } else if (lowerTranscript.includes('monitor') || lowerTranscript.includes('start recognition')) {
            command = 'start_recognition';
        } else if (lowerTranscript.includes('stop') || lowerTranscript.includes('pause')) {
            command = 'stop_recognition';
        } else if (lowerTranscript.includes('settings') || lowerTranscript.includes('preferences')) {
            command = 'open_settings';
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
    }
};

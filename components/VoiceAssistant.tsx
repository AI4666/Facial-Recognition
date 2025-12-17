import React, { useState, useEffect, useRef } from 'react';
import { voiceService } from '../services/voiceService';
import { ollamaService } from '../services/ollamaService';

interface VoiceAssistantProps {
    onCaptureRequest?: () => Promise<string | null>;  // Returns base64 image
    onRecognizeRequest?: (image: string) => Promise<any>;  // Returns recognition result
    onRegisterRequest?: () => void;
    onSpeakResponse?: (text: string) => Promise<void>;
}

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking' | 'awaiting_confirm';

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
    onCaptureRequest,
    onRecognizeRequest,
    onRegisterRequest,
    onSpeakResponse
}) => {
    const [state, setState] = useState<AssistantState>('idle');
    const [isWakeWordActive, setIsWakeWordActive] = useState(false);
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastResponse, setLastResponse] = useState('');
    const [pendingAction, setPendingAction] = useState<'register' | null>(null);
    const recognitionRef = useRef<any>(null);

    // Start/stop wake word listening
    const toggleWakeWordListening = () => {
        if (isWakeWordActive) {
            // Stop listening
            voiceService.stopWakeWordListening(recognitionRef.current);
            recognitionRef.current = null;
            setIsWakeWordActive(false);
            setState('idle');
        } else {
            // Start listening for wake word
            recognitionRef.current = voiceService.startWakeWordListening(
                handleWakeWord,
                (error) => console.error('Wake word error:', error)
            );
            setIsWakeWordActive(true);
            setState('listening');
        }
    };

    // Handle wake word detected
    const handleWakeWord = async () => {
        console.log('Wake word detected!');
        setState('processing');
        setLastTranscript('Hello Gemma');

        // Stop wake word listening temporarily
        voiceService.stopWakeWordListening(recognitionRef.current);

        // Speak greeting and ask for permission
        const greeting = "Hi there! Would you like me to take your photo and identify you?";
        setLastResponse(greeting);
        setState('speaking');

        try {
            if (onSpeakResponse) {
                await onSpeakResponse(greeting);
            } else {
                await voiceService.speak(greeting);
            }

            // Wait for confirmation
            setState('awaiting_confirm');
            const response = await voiceService.startListening();
            setLastTranscript(response);

            const command = voiceService.parseCommand(response);

            if (command.command === 'confirm') {
                await handlePhotoCapture();
            } else if (command.command === 'cancel') {
                const cancelMsg = "Okay, no problem. Say 'Hello Gemma' when you need me!";
                setLastResponse(cancelMsg);
                await voiceService.speak(cancelMsg);
            } else {
                // Treat as chat message
                await handleChatMessage(response);
            }
        } catch (error) {
            console.error('Voice interaction error:', error);
        }

        // Resume wake word listening
        setState('listening');
        recognitionRef.current = voiceService.startWakeWordListening(
            handleWakeWord,
            (error) => console.error('Wake word error:', error)
        );
    };

    // Handle photo capture and recognition
    const handlePhotoCapture = async () => {
        setState('processing');
        setLastResponse("Taking your photo now...");
        await voiceService.speak("Taking your photo now...");

        try {
            // Capture image
            const image = onCaptureRequest ? await onCaptureRequest() : null;

            if (!image) {
                const errorMsg = "I couldn't access the camera. Please check permissions.";
                setLastResponse(errorMsg);
                await voiceService.speak(errorMsg);
                return;
            }

            setLastResponse("Analyzing your face...");
            await voiceService.speak("Analyzing your face...");

            // Try recognition
            const result = onRecognizeRequest ? await onRecognizeRequest(image) : null;

            if (result?.matchFound) {
                // Recognized user
                const greeting = result.greeting || `Welcome back! I recognized you with ${Math.round(result.confidence * 100)}% confidence.`;
                setLastResponse(greeting);
                await voiceService.speak(greeting);
            } else {
                // Unknown user - offer registration
                setPendingAction('register');
                const unknownMsg = "I don't recognize you. Would you like to register as a new user?";
                setLastResponse(unknownMsg);
                setState('awaiting_confirm');
                await voiceService.speak(unknownMsg);

                // Wait for confirmation
                const response = await voiceService.startListening();
                setLastTranscript(response);
                const command = voiceService.parseCommand(response);

                if (command.command === 'confirm') {
                    onRegisterRequest?.();
                    const regMsg = "Great! I'll start the registration process.";
                    setLastResponse(regMsg);
                    await voiceService.speak(regMsg);
                } else {
                    const cancelMsg = "Okay, maybe next time!";
                    setLastResponse(cancelMsg);
                    await voiceService.speak(cancelMsg);
                }
                setPendingAction(null);
            }
        } catch (error: any) {
            const errorMsg = "Sorry, I encountered an error. " + (error.message || '');
            setLastResponse(errorMsg);
            await voiceService.speak(errorMsg);
        }
    };

    // Handle chat messages with Gemma 3
    const handleChatMessage = async (message: string) => {
        setState('processing');

        try {
            const response = await ollamaService.generateText(
                `User says: "${message}"\nRespond helpfully and concisely:`,
                100
            );
            setLastResponse(response);
            await voiceService.speak(response);
        } catch (error) {
            const errorMsg = "I'm having trouble understanding. Please try again.";
            setLastResponse(errorMsg);
            await voiceService.speak(errorMsg);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                voiceService.stopWakeWordListening(recognitionRef.current);
            }
        };
    }, []);

    const getStateText = () => {
        switch (state) {
            case 'idle': return 'Click to start';
            case 'listening': return 'Say "Hello Gemma"...';
            case 'processing': return 'Processing...';
            case 'speaking': return 'Speaking...';
            case 'awaiting_confirm': return 'Waiting for response...';
            default: return '';
        }
    };

    const getStateColor = () => {
        switch (state) {
            case 'idle': return 'bg-slate-700';
            case 'listening': return 'bg-purple-600 animate-pulse';
            case 'processing': return 'bg-yellow-600';
            case 'speaking': return 'bg-green-600';
            case 'awaiting_confirm': return 'bg-blue-600 animate-pulse';
            default: return 'bg-slate-700';
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                Voice Assistant
            </h3>

            {/* Main toggle button */}
            <button
                onClick={toggleWakeWordListening}
                className={`w-full py-4 rounded-lg text-white font-medium transition-all ${getStateColor()} hover:opacity-90`}
            >
                <div className="flex items-center justify-center gap-3">
                    {isWakeWordActive ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="4" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                    )}
                    <span>{isWakeWordActive ? '🔴 Listening...' : '🎙️ Start Voice Assistant'}</span>
                </div>
            </button>

            {/* Status text */}
            <div className="mt-3 text-center text-sm text-slate-400">
                {getStateText()}
            </div>

            {/* Last interaction */}
            {(lastTranscript || lastResponse) && (
                <div className="mt-4 space-y-2 text-sm">
                    {lastTranscript && (
                        <div className="p-2 bg-slate-800 rounded">
                            <span className="text-slate-500">You:</span>
                            <span className="text-white ml-2">"{lastTranscript}"</span>
                        </div>
                    )}
                    {lastResponse && (
                        <div className="p-2 bg-purple-900/30 border border-purple-700/30 rounded">
                            <span className="text-purple-400">Gemma:</span>
                            <span className="text-purple-200 ml-2">"{lastResponse}"</span>
                        </div>
                    )}
                </div>
            )}

            {/* Info */}
            <div className="mt-4 text-xs text-slate-500">
                💡 Wake word: <span className="text-purple-400 font-medium">"Hello Gemma"</span>
            </div>
        </div>
    );
};

export default VoiceAssistant;

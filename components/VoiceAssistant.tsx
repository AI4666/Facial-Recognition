import React, { useState, useRef } from 'react';
import { voiceService } from '../services/voiceService';
import { ollamaService } from '../services/ollamaService';
import { visionPipeline } from '../services/visionPipeline';

interface VoiceAssistantProps {
    onCaptureRequest?: () => Promise<string | null>;  // Returns base64 image
    onRecognizeRequest?: (image: string) => Promise<any>;  // Returns recognition result
    onRegisterRequest?: () => void;
    onSpeakResponse?: (text: string) => Promise<void>;
    onCommand?: (command: string) => void;  // For custom commands
}

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
    onCaptureRequest,
    onRecognizeRequest,
    onRegisterRequest,
    onSpeakResponse,
    onCommand
}) => {
    const [state, setState] = useState<AssistantState>('idle');
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastResponse, setLastResponse] = useState('');
    const isListeningRef = useRef(false);

    // Push-to-talk: Start listening when button is pressed
    const startListening = async () => {
        if (isListeningRef.current || state !== 'idle') return;

        isListeningRef.current = true;
        setState('listening');
        setLastTranscript('');

        try {
            const transcript = await voiceService.startListening();
            isListeningRef.current = false;

            if (transcript) {
                setLastTranscript(transcript);
                await processVoiceInput(transcript);
            } else {
                setState('idle');
            }
        } catch (error: any) {
            console.error('Voice input error:', error);
            isListeningRef.current = false;
            setState('idle');

            if (error.message !== 'Listening timeout') {
                setLastResponse(`Error: ${error.message}`);
            }
        }
    };

    // Process voice input and determine action
    const processVoiceInput = async (transcript: string) => {
        setState('processing');
        const command = voiceService.parseCommand(transcript);

        console.log('Voice command:', command.command, '| Transcript:', transcript);

        try {
            switch (command.command) {
                case 'wake_word':
                    // "Hello Gemma" - respond with greeting
                    await respond("Hi! I'm listening. What would you like me to do?");
                    break;

                case 'capture_image':
                    // "Take photo" / "Capture"
                    await handlePhotoCapture();
                    break;

                case 'register_user':
                    // "Register" / "New user"
                    onRegisterRequest?.();
                    await respond("Starting registration process.");
                    break;

                case 'start_recognition':
                    // "Start monitoring" / "Start recognition"
                    onCommand?.('start_recognition');
                    await respond("Starting face recognition.");
                    break;

                case 'stop_recognition':
                    // "Stop" / "Pause"
                    onCommand?.('stop_recognition');
                    await respond("Recognition stopped.");
                    break;

                case 'open_settings':
                    // "Settings" / "Preferences"
                    onCommand?.('open_settings');
                    await respond("Opening settings.");
                    break;

                case 'confirm':
                    // "Yes" / "Confirm"
                    onCommand?.('confirm');
                    break;

                case 'cancel':
                    // "No" / "Cancel"
                    onCommand?.('cancel');
                    await respond("Cancelled.");
                    break;

                // ==========================================
                // VISION COMMANDS (Moondream)
                // ==========================================
                case 'describe_scene':
                    // "What do you see?" / "Describe"
                    await handleDescribeScene();
                    break;

                case 'detect_object':
                    // "Is there a [object]?" / "Do you see a [object]?"
                    await handleDetectObject(transcript);
                    break;

                case 'count_people':
                    // "How many people?"
                    await handleCountPeople();
                    break;

                case 'begin_detection':
                    // "Begin detection" / "Start detection"
                    onCommand?.('begin_detection');
                    await respond("Starting continuous detection.");
                    break;

                case 'stop_detection':
                    // "Stop detection"
                    onCommand?.('stop_detection');
                    await respond("Detection stopped.");
                    break;

                case 'chat':
                default:
                    // Free-form chat - send to Gemma 3
                    await handleChatMessage(transcript);
                    break;
            }
        } catch (error: any) {
            console.error('Command processing error:', error);
            await respond(`Sorry, I encountered an error: ${error.message}`);
        }

        setState('idle');
    };

    // Speak response
    const respond = async (text: string) => {
        setState('speaking');
        setLastResponse(text);

        try {
            if (onSpeakResponse) {
                await onSpeakResponse(text);
            } else if (voiceService.isTTSSupported()) {
                await voiceService.speak(text);
            }
        } catch (error) {
            console.error('TTS error:', error);
        }
    };

    // Handle photo capture and recognition
    const handlePhotoCapture = async () => {
        await respond("Taking your photo...");

        try {
            const image = onCaptureRequest ? await onCaptureRequest() : null;

            if (!image) {
                await respond("I couldn't access the camera. Please check permissions.");
                return;
            }

            setState('processing');
            setLastResponse("Analyzing...");

            const result = onRecognizeRequest ? await onRecognizeRequest(image) : null;

            if (result?.matchFound) {
                const greeting = result.greeting || `Welcome back! Recognized with ${Math.round(result.confidence * 100)}% confidence.`;
                await respond(greeting);
            } else {
                await respond("I don't recognize you. Say 'register' to create a new profile.");
            }
        } catch (error: any) {
            await respond("Sorry, I encountered an error: " + (error.message || ''));
        }
    };

    // Handle chat messages with Gemma 3
    const handleChatMessage = async (message: string) => {
        try {
            const response = await ollamaService.generateText(
                `User says: "${message}"\nRespond helpfully and concisely (1-2 sentences):`,
                100
            );
            await respond(response);
        } catch (error) {
            await respond("I'm having trouble connecting to the AI. Please check if Ollama is running.");
        }
    };

    // ==========================================
    // VISION COMMAND HANDLERS
    // ==========================================

    // Handle "What do you see?" / "Describe"
    const handleDescribeScene = async () => {
        await respond("Let me look...");
        try {
            const image = onCaptureRequest ? await onCaptureRequest() : null;
            if (!image) {
                await respond("I couldn't access the camera.");
                return;
            }
            const description = await visionPipeline.quickDescribe(image);
            await respond(description);
        } catch (error) {
            await respond("I'm having trouble analyzing the scene. Please check if Ollama is running.");
        }
    };

    // Handle "Is there a [object]?" / "Do you see a [object]?"
    const handleDetectObject = async (transcript: string) => {
        // Extract the object name from the transcript
        const patterns = [
            /is there a (.+?)\??$/i,
            /do you see a (.+?)\??$/i,
            /can you see a (.+?)\??$/i
        ];

        let objectName = 'object';
        for (const pattern of patterns) {
            const match = transcript.match(pattern);
            if (match) {
                objectName = match[1].trim();
                break;
            }
        }

        await respond(`Looking for a ${objectName}...`);
        try {
            const image = onCaptureRequest ? await onCaptureRequest() : null;
            if (!image) {
                await respond("I couldn't access the camera.");
                return;
            }
            const result = await visionPipeline.quickObjectCheck(image, objectName);
            await respond(result);
        } catch (error) {
            await respond(`I'm having trouble looking for the ${objectName}. Please check if Ollama is running.`);
        }
    };

    // Handle "How many people?"
    const handleCountPeople = async () => {
        await respond("Counting...");
        try {
            const image = onCaptureRequest ? await onCaptureRequest() : null;
            if (!image) {
                await respond("I couldn't access the camera.");
                return;
            }
            const result = await visionPipeline.quickPeopleCount(image);
            await respond(result);
        } catch (error) {
            await respond("I'm having trouble counting people. Please check if Ollama is running.");
        }
    };

    const getStateText = () => {
        switch (state) {
            case 'idle': return 'Press and hold to speak';
            case 'listening': return '🎤 Listening...';
            case 'processing': return '⏳ Processing...';
            case 'speaking': return '🔊 Speaking...';
            default: return '';
        }
    };

    const getButtonStyle = () => {
        switch (state) {
            case 'listening': return 'bg-red-600 scale-105';
            case 'processing': return 'bg-yellow-600';
            case 'speaking': return 'bg-green-600';
            default: return 'bg-purple-600 hover:bg-purple-500';
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
                Voice Assistant (Push-to-Talk)
            </h3>

            {/* Push-to-talk button */}
            <button
                onMouseDown={startListening}
                onTouchStart={startListening}
                disabled={state !== 'idle'}
                className={`w-full py-6 rounded-lg text-white font-medium transition-all transform ${getButtonStyle()} ${state !== 'idle' ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
            >
                <div className="flex flex-col items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    <span className="text-lg">{state === 'listening' ? '🔴 Listening...' : '🎙️ Push to Talk'}</span>
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

            {/* Available commands */}
            <div className="mt-4 text-xs text-slate-500 space-y-1">
                <div className="font-medium text-slate-400 mb-2">Available Commands:</div>
                <div className="grid grid-cols-2 gap-1">
                    <span>• "Hello Gemma"</span>
                    <span>• "Take photo"</span>
                    <span>• "Register"</span>
                    <span>• "Start monitoring"</span>
                    <span>• "Stop"</span>
                    <span>• "Settings"</span>
                </div>
                <div className="font-medium text-purple-400 mt-3 mb-2">🔮 Vision Commands:</div>
                <div className="grid grid-cols-2 gap-1">
                    <span>• "What do you see?"</span>
                    <span>• "Is there a [dog]?"</span>
                    <span>• "How many people?"</span>
                    <span>• "Begin detection"</span>
                </div>
                <div className="mt-2 text-slate-600">Or ask any question!</div>
            </div>
        </div>
    );
};

export default VoiceAssistant;

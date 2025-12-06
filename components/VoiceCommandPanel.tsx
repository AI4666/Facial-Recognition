import React, { useState } from 'react';
import { VoiceCommand } from '../types';

interface VoiceCommandPanelProps {
    onCommand: (command: VoiceCommand) => void;
    isListening: boolean;
    onToggleListening: () => void;
    lastCommand?: VoiceCommand;
}

const VoiceCommandPanel: React.FC<VoiceCommandPanelProps> = ({
    onCommand,
    isListening,
    onToggleListening,
    lastCommand
}) => {
    const [showHelp, setShowHelp] = useState(false);

    const commands = [
        { command: 'register user', description: 'Start user registration' },
        { command: 'start recognition', description: 'Switch to monitor mode' },
        { command: 'capture', description: 'Take a photo' },
        { command: 'stop', description: 'Stop recognition scanning' },
        { command: 'settings', description: 'Open settings panel' }
    ];

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-500 text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    Voice Commands
                </h3>
                <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="text-slate-500 hover:text-white text-xs"
                >
                    {showHelp ? 'Hide' : 'Help'}
                </button>
            </div>

            {/* Microphone Button */}
            <div className="flex flex-col items-center gap-3 mb-4">
                <button
                    onClick={onToggleListening}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isListening
                        ? 'bg-red-600 text-white shadow-lg shadow-red-900/50 animate-pulse'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-2 border-slate-700'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                </button>
                <div className="text-center">
                    <div className={`text-sm font-medium ${isListening ? 'text-red-400' : 'text-slate-500'}`}>
                        {isListening ? 'Listening...' : 'Click to speak'}
                    </div>
                </div>
            </div>

            {/* Last Command */}
            {lastCommand && (
                <div className="bg-slate-800 rounded p-3 mb-4">
                    <div className="text-xs text-slate-500 mb-1">Last Command:</div>
                    <div className="text-sm text-white font-mono">&quot;{lastCommand.transcript}&quot;</div>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${lastCommand.executed
                            ? 'bg-green-900/30 text-green-400'
                            : lastCommand.error
                                ? 'bg-red-900/30 text-red-400'
                                : 'bg-yellow-900/30 text-yellow-400'
                            }`}>
                            {lastCommand.executed ? '✓ Executed' : lastCommand.error || 'Processing'}
                        </span>
                    </div>
                </div>
            )}

            {/* Help Section */}
            {showHelp && (
                <div className="mt-4 space-y-2">
                    <div className="text-xs text-slate-500 font-semibold mb-2">Available Commands:</div>
                    {commands.map((cmd, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                            <div className="text-sky-400 font-mono">&quot;{cmd.command}&quot;</div>
                            <div className="text-slate-500">- {cmd.description}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Browser Support Warning */}
            {!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs text-yellow-400">
                    Voice commands are not supported in your browser. Please use Chrome or Edge.
                </div>
            )}
        </div>
    );
};

export default VoiceCommandPanel;

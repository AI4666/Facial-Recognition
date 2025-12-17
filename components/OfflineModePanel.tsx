import React, { useState, useEffect } from 'react';
import { localLLMService } from '../services/localLLMService';
import { conversationService } from '../services/conversationService';
import { ollamaService } from '../services/ollamaService';

interface OfflineModePanelProps {
    onOfflineModeChange?: (enabled: boolean) => void;
}

const OfflineModePanel: React.FC<OfflineModePanelProps> = ({ onOfflineModeChange }) => {
    const [offlineMode, setOfflineMode] = useState(conversationService.isOfflineMode());
    const [isOnlineAvailable, setIsOnlineAvailable] = useState<boolean | null>(null);
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [modelStatus, setModelStatus] = useState<'not_loaded' | 'loading' | 'ready' | 'error'>('not_loaded');
    const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
    const [activeModel, setActiveModel] = useState<'ollama' | 'gpt2' | 'none'>('none');

    useEffect(() => {
        // Check Ollama connection status
        const checkOllama = async () => {
            try {
                const connected = await ollamaService.checkConnection();
                setOllamaStatus(connected ? 'connected' : 'disconnected');

                if (connected) {
                    const hasModel = await ollamaService.isModelAvailable();
                    if (hasModel) {
                        setActiveModel('ollama');
                        setModelStatus('ready');
                    }
                }
            } catch {
                setOllamaStatus('disconnected');
            }
        };

        checkOllama();

        // Check if local model is ready
        if (localLLMService.isReady()) {
            setModelStatus('ready');
        }

        // Check online status in background (non-blocking)
        conversationService.checkOnlineStatus()
            .then(setIsOnlineAvailable)
            .catch(() => setIsOnlineAvailable(false));
    }, []);

    const handleToggleOfflineMode = async (enabled: boolean) => {
        if (enabled && modelStatus === 'not_loaded') {
            setIsModelLoading(true);
            setModelStatus('loading');

            try {
                // Check Ollama first
                const ollamaUp = await ollamaService.checkConnection();
                if (ollamaUp) {
                    setOllamaStatus('connected');
                    setActiveModel('ollama');
                    setModelStatus('ready');
                } else {
                    // Fallback to GPT-2
                    await localLLMService.initTextGenerationModel();
                    setActiveModel('gpt2');
                    setModelStatus('ready');
                }

                setOfflineMode(true);
                conversationService.setOfflineMode(true);
                onOfflineModeChange?.(true);
            } catch (error) {
                console.error('Failed to load offline model:', error);
                setModelStatus('error');
            } finally {
                setIsModelLoading(false);
            }
        } else {
            setOfflineMode(enabled);
            conversationService.setOfflineMode(enabled);
            onOfflineModeChange?.(enabled);
        }
    };

    const handleRetryOllama = async () => {
        setOllamaStatus('checking');
        localLLMService.resetOllamaStatus();

        try {
            const connected = await ollamaService.checkConnection();
            setOllamaStatus(connected ? 'connected' : 'disconnected');
            if (connected) {
                setActiveModel('ollama');
                setModelStatus('ready');
            }
        } catch {
            setOllamaStatus('disconnected');
        }
    };

    const getStatusColor = () => {
        if (offlineMode) return 'text-orange-400 bg-orange-400/20 border-orange-500/50';
        if (isOnlineAvailable === false) return 'text-yellow-400 bg-yellow-400/20 border-yellow-500/50';
        return 'text-green-400 bg-green-400/20 border-green-500/50';
    };

    const getStatusText = () => {
        if (offlineMode) return 'Offline Mode';
        if (isOnlineAvailable === false) return 'Online (Unverified)';
        if (isOnlineAvailable === null) return 'Online';
        return 'Online (Verified)';
    };

    const getModelName = () => {
        if (activeModel === 'ollama') return 'Gemma 3 (Ollama)';
        if (activeModel === 'gpt2') return 'GPT-2 (Xenova)';
        return 'None';
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <line x1="12" x2="12.01" y1="20" y2="20" />
                </svg>
                Connection Mode
            </h3>

            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border mb-4 ${getStatusColor()}`}>
                <div className={`w-2 h-2 rounded-full ${offlineMode ? 'bg-orange-400' :
                    isOnlineAvailable === false ? 'bg-yellow-400' :
                        'bg-green-400'
                    } ${!offlineMode && isOnlineAvailable !== false ? 'animate-pulse' : ''}`}></div>
                <span className="text-sm font-medium">{getStatusText()}</span>
            </div>

            {/* Ollama Status */}
            <div className="mb-3 p-3 bg-slate-800 rounded text-xs">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400">Ollama Server:</span>
                    <div className="flex items-center gap-2">
                        <span className={
                            ollamaStatus === 'connected' ? 'text-green-400' :
                                ollamaStatus === 'checking' ? 'text-yellow-400' :
                                    'text-red-400'
                        }>
                            {ollamaStatus === 'connected' ? '✓ Connected' :
                                ollamaStatus === 'checking' ? '⏳ Checking...' :
                                    '✗ Disconnected'}
                        </span>
                        {ollamaStatus === 'disconnected' && (
                            <button
                                onClick={handleRetryOllama}
                                className="text-blue-400 hover:text-blue-300 underline"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                </div>
                {ollamaStatus === 'disconnected' && (
                    <div className="text-slate-500 mt-1">
                        Run: <code className="bg-slate-700 px-1 rounded">ollama serve</code>
                    </div>
                )}
            </div>

            {/* Offline Mode Toggle */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-white text-sm font-medium">Offline Mode</div>
                        <div className="text-slate-500 text-xs">Use local AI model</div>
                    </div>
                    <button
                        onClick={() => handleToggleOfflineMode(!offlineMode)}
                        disabled={isModelLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${offlineMode ? 'bg-orange-600' : 'bg-slate-700'
                            } ${isModelLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${offlineMode ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Model Status */}
                {offlineMode && (
                    <div className="mt-3 p-3 bg-slate-800 rounded text-xs">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-400">Local Model Status:</span>
                            <span className={
                                modelStatus === 'ready' ? 'text-green-400' :
                                    modelStatus === 'loading' ? 'text-yellow-400' :
                                        modelStatus === 'error' ? 'text-red-400' :
                                            'text-slate-500'
                            }>
                                {modelStatus === 'ready' ? '✓ Ready' :
                                    modelStatus === 'loading' ? '⏳ Loading...' :
                                        modelStatus === 'error' ? '✗ Error' :
                                            '○ Not Loaded'}
                            </span>
                        </div>
                        {modelStatus === 'loading' && (
                            <div className="w-full bg-slate-700 rounded-full h-1 mt-2">
                                <div className="bg-orange-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                            </div>
                        )}
                        {modelStatus === 'ready' && (
                            <div className="text-slate-500 mt-1">
                                Model: {getModelName()}
                                {activeModel === 'ollama' && (
                                    <span className="ml-2 text-green-400">🔥 Vision Enabled</span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Info Messages */}
                {isOnlineAvailable === false && !offlineMode && (
                    <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs text-yellow-400">
                        💡 Online API not verified. System will auto-fallback to {ollamaStatus === 'connected' ? 'Gemma 3' : 'local model'} if needed.
                    </div>
                )}

                {offlineMode && activeModel === 'ollama' && (
                    <div className="mt-3 p-3 bg-purple-900/20 border border-purple-700/30 rounded text-xs text-purple-400">
                        🚀 Gemma 3 active! Full vision + chat capabilities available offline.
                    </div>
                )}

                {offlineMode && activeModel === 'gpt2' && (
                    <div className="mt-3 p-3 bg-orange-900/20 border border-orange-700/30 rounded text-xs text-orange-400">
                        💡 Using GPT-2 fallback. For better quality, start Ollama with Gemma 3.
                    </div>
                )}
            </div>
        </div>
    );
};

export default OfflineModePanel;

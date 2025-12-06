import React, { useState } from 'react';
import { UserPreferences } from '../types';

interface SettingsPanelProps {
    preferences: UserPreferences | null;
    onSave: (preferences: UserPreferences) => void;
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ preferences, onSave, onClose }) => {
    const [localPrefs, setLocalPrefs] = useState<UserPreferences>(
        preferences || {
            userId: '',
            voiceEnabled: false,
            conversationHistory: true,
            emotionTracking: true,
            privacyMode: false,
            lastUpdated: new Date().toISOString()
        }
    );

    const handleToggle = (key: keyof UserPreferences) => {
        if (typeof localPrefs[key] === 'boolean') {
            setLocalPrefs({
                ...localPrefs,
                [key]: !localPrefs[key],
                lastUpdated: new Date().toISOString()
            });
        }
    };

    const handleSave = () => {
        onSave(localPrefs);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                {/* Settings */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">

                    {/* Voice Features */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                            Voice Features
                        </h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white text-sm font-medium">Voice Commands</div>
                                <div className="text-slate-500 text-xs">Enable voice control and input</div>
                            </div>
                            <button
                                onClick={() => handleToggle('voiceEnabled')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localPrefs.voiceEnabled ? 'bg-sky-600' : 'bg-slate-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localPrefs.voiceEnabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 my-4"></div>

                    {/* Privacy & Data */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                            Privacy & Data
                        </h3>

                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white text-sm font-medium">Conversation History</div>
                                <div className="text-slate-500 text-xs">Save chat conversations</div>
                            </div>
                            <button
                                onClick={() => handleToggle('conversationHistory')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localPrefs.conversationHistory ? 'bg-sky-600' : 'bg-slate-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localPrefs.conversationHistory ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white text-sm font-medium">Emotion Tracking</div>
                                <div className="text-slate-500 text-xs">Record emotional states</div>
                            </div>
                            <button
                                onClick={() => handleToggle('emotionTracking')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localPrefs.emotionTracking ? 'bg-sky-600' : 'bg-slate-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localPrefs.emotionTracking ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white text-sm font-medium">Privacy Mode</div>
                                <div className="text-slate-500 text-xs">Minimize data collection</div>
                            </div>
                            <button
                                onClick={() => handleToggle('privacyMode')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localPrefs.privacyMode ? 'bg-sky-600' : 'bg-slate-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localPrefs.privacyMode ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Info Notice */}
                    <div className="mt-4 p-3 bg-sky-900/20 border border-sky-700/30 rounded text-xs text-sky-400">
                        <strong>Note:</strong> Changes apply immediately to all features. Some settings may require page refresh.
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded text-sm font-medium transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;

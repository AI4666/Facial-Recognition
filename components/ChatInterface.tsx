import React, { useState, useRef, useEffect } from 'react';
import { ConversationMessage, User } from '../types';

interface ChatInterfaceProps {
    user: User | null;
    messages: ConversationMessage[];
    onSendMessage: (message: string, isVoice?: boolean) => void;
    onVoiceInput: () => void;
    isListening?: boolean;
    isProcessing?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    user,
    messages,
    onSendMessage,
    onVoiceInput,
    isListening = false,
    isProcessing = false
}) => {
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (inputText.trim() && !isProcessing) {
            onSendMessage(inputText.trim(), false);
            setInputText('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {user ? `Chat with ${user.name}` : 'Select a user to chat'}
                </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center text-slate-500 text-sm py-8">
                        {user ? 'Start a conversation...' : 'No active user'}
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user'
                                    ? 'bg-sky-600 text-white'
                                    : msg.role === 'assistant'
                                        ? 'bg-slate-800 text-slate-200'
                                        : 'bg-slate-700 text-slate-400 text-xs'
                                }`}
                        >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-xs opacity-70">
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                                {msg.isVoice && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" x2="12" y1="19" y2="22" />
                                    </svg>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="bg-slate-800 text-slate-200 rounded-lg px-4 py-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {user && (
                <div className="p-4 bg-slate-800 border-t border-slate-700">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your message..."
                            disabled={isProcessing}
                            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
                        />
                        <button
                            onClick={onVoiceInput}
                            className={`p-2 rounded transition-colors ${isListening
                                    ? 'bg-red-600 text-white animate-pulse'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            disabled={isProcessing}
                            title="Voice input"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" x2="12" y1="19" y2="22" />
                            </svg>
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={!inputText.trim() || isProcessing}
                            className="px-4 py-2 bg-sky-600 text-white rounded text-sm font-medium hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatInterface;

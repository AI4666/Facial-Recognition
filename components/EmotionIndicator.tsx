import React from 'react';
import { Emotion } from '../types';

interface EmotionIndicatorProps {
    emotion: Emotion | null;
    compact?: boolean;
}

const EmotionIndicator: React.FC<EmotionIndicatorProps> = ({ emotion, compact = false }) => {
    if (!emotion) {
        return null;
    }

    const getEmotionIcon = (emotionType: string) => {
        switch (emotionType) {
            case 'happy':
                return '😊';
            case 'sad':
                return '😢';
            case 'angry':
                return '😠';
            case 'surprised':
                return '😲';
            case 'fearful':
                return '😨';
            case 'disgusted':
                return '🤢';
            case 'neutral':
            default:
                return '😐';
        }
    };

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'positive':
                return 'text-green-400 bg-green-400/20 border-green-500/50';
            case 'negative':
                return 'text-red-400 bg-red-400/20 border-red-500/50';
            case 'neutral':
            default:
                return 'text-slate-400 bg-slate-400/20 border-slate-500/50';
        }
    };

    if (compact) {
        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getSentimentColor(emotion.sentiment)}`}>
                <span className="text-lg">{getEmotionIcon(emotion.primary)}</span>
                <span className="text-xs font-medium uppercase">{emotion.primary}</span>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-3">
                Emotion Analysis
            </h3>

            <div className="flex items-center gap-4 mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 ${getSentimentColor(emotion.sentiment)}`}>
                    {getEmotionIcon(emotion.primary)}
                </div>
                <div>
                    <div className="text-white text-lg font-semibold capitalize">{emotion.primary}</div>
                    <div className={`text-sm ${emotion.sentiment === 'positive' ? 'text-green-400' :
                            emotion.sentiment === 'negative' ? 'text-red-400' :
                                'text-slate-400'
                        }`}>
                        {emotion.sentiment} mood
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Confidence</span>
                        <span className="text-white">{Math.round(emotion.confidence * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                            className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${emotion.confidence * 100}%` }}
                        />
                    </div>
                </div>

                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Sentiment Score</span>
                        <span className="text-white">{emotion.sentimentScore.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 relative">
                        {/* Center marker */}
                        <div className="absolute left-1/2 top-0 w-px h-2 bg-slate-600"></div>
                        {/* Sentiment bar */}
                        <div
                            className={`h-2 rounded-full transition-all duration-500 ${emotion.sentimentScore > 0 ? 'bg-green-500' : 'bg-red-500'
                                }`}
                            style={{
                                width: `${Math.abs(emotion.sentimentScore) * 50}%`,
                                marginLeft: emotion.sentimentScore > 0 ? '50%' : `${50 - Math.abs(emotion.sentimentScore) * 50}%`
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
                Updated {new Date(emotion.timestamp).toLocaleTimeString()}
            </div>
        </div>
    );
};

export default EmotionIndicator;

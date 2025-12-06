import React from 'react';
import { SecurityCheck } from '../types';

interface SecurityIndicatorProps {
    securityCheck: SecurityCheck | null;
    compact?: boolean;
}

const SecurityIndicator: React.FC<SecurityIndicatorProps> = ({ securityCheck, compact = false }) => {
    if (!securityCheck) {
        return null;
    }

    const getStatusColor = (passed: boolean) => {
        return passed
            ? 'text-green-400 bg-green-400/20 border-green-500/50'
            : 'text-red-400 bg-red-400/20 border-red-500/50';
    };

    if (compact) {
        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(securityCheck.passed)}`}>
                <div className={`w-2 h-2 rounded-full ${securityCheck.passed ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-xs font-medium uppercase">
                    {securityCheck.passed ? 'Verified' : 'Security Alert'}
                </span>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                </svg>
                Security Status
            </h3>

            {/* Overall Status */}
            <div className={`rounded-lg p-4 mb-4 border-2 ${getStatusColor(securityCheck.passed)}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-lg font-bold">
                            {securityCheck.passed ? '✓ Verified' : '⚠ Alert'}
                        </div>
                        <div className="text-xs opacity-80">
                            {securityCheck.passed ? 'Authentic user detected' : 'Suspicious activity detected'}
                        </div>
                    </div>
                    <div className={`text-3xl ${securityCheck.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {securityCheck.passed ? '🛡️' : '⚠️'}
                    </div>
                </div>
            </div>

            {/* Liveness Detection */}
            <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Liveness Detection</span>
                    <div className="flex items-center gap-2">
                        <span className={securityCheck.livenessDetected ? 'text-green-400' : 'text-red-400'}>
                            {securityCheck.livenessDetected ? 'Pass' : 'Fail'}
                        </span>
                        <span className="text-slate-500 text-xs">
                            {Math.round(securityCheck.livenessScore * 100)}%
                        </span>
                    </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all ${securityCheck.livenessScore > 0.7 ? 'bg-green-500' :
                                securityCheck.livenessScore > 0.4 ? 'bg-yellow-500' :
                                    'bg-red-500'
                            }`}
                        style={{ width: `${securityCheck.livenessScore * 100}%` }}
                    />
                </div>
            </div>

            {/* Spoof Detection */}
            <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Spoof Detection</span>
                    <div className="flex items-center gap-2">
                        <span className={!securityCheck.spoofDetected ? 'text-green-400' : 'text-red-400'}>
                            {securityCheck.spoofDetected ? 'Detected' : 'Clear'}
                        </span>
                        <span className="text-slate-500 text-xs">
                            {Math.round(securityCheck.spoofConfidence * 100)}%
                        </span>
                    </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all ${securityCheck.spoofConfidence < 0.3 ? 'bg-green-500' :
                                securityCheck.spoofConfidence < 0.6 ? 'bg-yellow-500' :
                                    'bg-red-500'
                            }`}
                        style={{ width: `${securityCheck.spoofConfidence * 100}%` }}
                    />
                </div>
            </div>

            {/* Details */}
            {securityCheck.details && Object.keys(securityCheck.details).length > 0 && (
                <div className="border-t border-slate-800 pt-3 space-y-2">
                    <div className="text-xs text-slate-500 font-semibold mb-2">Details:</div>
                    {securityCheck.details.blinkDetected !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Blink Detected</span>
                            <span className={securityCheck.details.blinkDetected ? 'text-green-400' : 'text-slate-500'}>
                                {securityCheck.details.blinkDetected ? 'Yes' : 'No'}
                            </span>
                        </div>
                    )}
                    {securityCheck.details.movementDetected !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Movement Detected</span>
                            <span className={securityCheck.details.movementDetected ? 'text-green-400' : 'text-slate-500'}>
                                {securityCheck.details.movementDetected ? 'Yes' : 'No'}
                            </span>
                        </div>
                    )}
                    {securityCheck.details.depthAnalysis && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Depth Analysis</span>
                            <span className={
                                securityCheck.details.depthAnalysis === 'pass' ? 'text-green-400' :
                                    securityCheck.details.depthAnalysis === 'fail' ? 'text-red-400' :
                                        'text-yellow-400'
                            }>
                                {securityCheck.details.depthAnalysis}
                            </span>
                        </div>
                    )}
                    {securityCheck.details.printDetection !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Print Detection</span>
                            <span className={securityCheck.details.printDetection ? 'text-red-400' : 'text-green-400'}>
                                {securityCheck.details.printDetection ? 'Detected' : 'None'}
                            </span>
                        </div>
                    )}
                    {securityCheck.details.screenDetection !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Screen Detection</span>
                            <span className={securityCheck.details.screenDetection ? 'text-red-400' : 'text-green-400'}>
                                {securityCheck.details.screenDetection ? 'Detected' : 'None'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-3 text-xs text-slate-500">
                Updated {new Date(securityCheck.timestamp).toLocaleTimeString()}
            </div>
        </div>
    );
};

export default SecurityIndicator;

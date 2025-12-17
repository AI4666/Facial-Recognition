import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogViewerProps {
  logs: LogEntry[];
}

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  // Reverse logs to show newest first (at the top)
  const reversedLogs = [...logs].reverse();

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'ERROR': return 'text-red-400';
      case 'SUCCESS': return 'text-green-400';
      case 'WARNING': return 'text-yellow-400';
      case 'RECOGNITION': return 'text-sky-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="h-64 md:h-full bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden flex flex-col font-mono text-xs">
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
        <span className="uppercase tracking-widest text-slate-500 font-bold">System Logs</span>
        <span className="text-slate-600">{logs.length} Events</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 && <div className="text-slate-600 text-center py-4">System Idle...</div>}
        {reversedLogs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-fadeIn">
            <span className="text-slate-600 shrink-0">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
            <div className="flex flex-col">
              <span className={`${getLogColor(log.type)} font-semibold`}>
                {log.type === 'RECOGNITION' ? '👁 ' : ''}
                {log.message}
              </span>
              {log.details && <span className="text-slate-500 pl-2 border-l border-slate-800 ml-1">{log.details}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogViewer;

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, LogEntry, User, BoundingBox } from './types';
import Camera, { CameraHandle } from './components/Camera';
import LogViewer from './components/LogViewer';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';

// Icons
const Icons = {
  Face: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 14h-7a2.5 2.5 0 0 0-5 5v2h17v-2a2.5 2.5 0 0 0-5-5Z"/><path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>,
  Scan: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="M12 16v4"/><path d="M12 4v4"/><path d="M16 12h4"/><path d="M4 12h4"/></svg>,
  Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
};

const App: React.FC = () => {
  // --- State ---
  const [appState, setAppState] = useState<AppState>(AppState.RECOGNITION);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Registration State
  const [regName, setRegName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regStep, setRegStep] = useState<'NAME' | 'CAPTURE' | 'PROCESSING' | 'COMPLETE' | 'ERROR'>('NAME');
  const [regError, setRegError] = useState<string | null>(null);

  // Recognition State
  const [recognitionStatus, setRecognitionStatus] = useState<'SCANNING' | 'MATCHED' | 'UNKNOWN' | 'ERROR'>('SCANNING');
  const [lastGreeting, setLastGreeting] = useState<string | null>(null);
  const [matchedUser, setMatchedUser] = useState<User | null>(null);
  const [detectedBox, setDetectedBox] = useState<BoundingBox | null>(null);

  const cameraRef = useRef<CameraHandle>(null);
  const processingRef = useRef(false); // Prevent re-entrancy
  const recognitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const loadedUsers = storageService.getUsers();
    setUsers(loadedUsers);
    const loadedLogs = storageService.getLogs();
    setLogs(loadedLogs);
    addLog('INFO', 'System Initialized', 'Skyy OS v1.0 loaded.');
  }, []);

  // --- Helpers ---
  const addLog = (type: LogEntry['type'], message: string, details?: string) => {
    const log = storageService.addLog(type, message, details);
    setLogs(prev => [...prev, log].slice(-100));
  };

  const handleCameraError = (err: string) => {
    addLog('ERROR', 'Camera Failure', err);
  };

  // --- Registration Logic ---
  const startRegistration = () => {
    setAppState(AppState.REGISTRATION);
    setRegStep('NAME');
    setRegName('');
    setRegError(null);
    setDetectedBox(null); // Clear any previous boxes
    stopRecognitionLoop();
    addLog('INFO', 'Registration Mode Activated');
  };

  const validateName = () => {
    if (!regName.trim()) {
      setRegError("Name is required");
      return;
    }
    if (storageService.checkNameExists(regName.trim())) {
      setRegError("User already exists. Update not implemented in demo.");
      addLog('WARNING', 'Registration Failed', 'Name collision');
      return;
    }
    setRegError(null);
    setRegStep('CAPTURE');
  };

  const captureAndRegister = async () => {
    if (!cameraRef.current) return;
    
    setRegStep('PROCESSING');
    const image = cameraRef.current.capture();
    
    if (!image) {
      setRegError("Failed to capture image");
      setRegStep('CAPTURE');
      return;
    }

    try {
      addLog('INFO', 'Processing Registration', 'Sending to Gemini for analysis...');
      
      // 1. Detect and Describe
      const detection = await geminiService.analyzeRegistrationImage(image);

      if (detection.boundingBox) {
        setDetectedBox(detection.boundingBox);
      }

      if (!detection.faceDetected) {
        throw new Error("No face detected. Please try again.");
      }
      if (detection.multipleFaces) {
        throw new Error("Multiple faces detected. Only one person allowed.");
      }
      if (!detection.qualityCheckPassed && !detection.description) { // Allow if description exists even if low quality for demo
         throw new Error("Image quality too low or obstructed.");
      }

      // 2. Save
      const newUser: User = {
        id: crypto.randomUUID(),
        name: regName,
        faceDescription: detection.description || "No description generated",
        registeredAt: new Date().toISOString()
      };

      storageService.saveUser(newUser);
      setUsers(prev => [...prev, newUser]);
      addLog('SUCCESS', 'User Registered', `ID: ${newUser.id}, Name: ${newUser.name}`);
      
      setRegStep('COMPLETE');
      setTimeout(() => {
        setAppState(AppState.RECOGNITION);
        setDetectedBox(null);
        addLog('INFO', 'Switching to Recognition Mode');
      }, 3000);

    } catch (err: any) {
      setRegError(err.message || "Registration failed");
      setRegStep('ERROR');
      setDetectedBox(null);
      addLog('ERROR', 'Registration Error', err.message);
    }
  };

  // --- Recognition Logic ---
  const startRecognitionLoop = useCallback(() => {
    if (recognitionTimerRef.current) clearInterval(recognitionTimerRef.current);
    
    // Scan every 4 seconds to balance responsiveness and API quota
    recognitionTimerRef.current = setInterval(async () => {
      if (appState !== AppState.RECOGNITION || processingRef.current) return;
      
      if (!cameraRef.current) return;
      
      processingRef.current = true;
      const image = cameraRef.current.capture();

      if (image) {
        try {
          const currentUsers = storageService.getUsers();
          const result = await geminiService.recognizeUser(image, currentUsers);

          if (result.boundingBox) {
            setDetectedBox(result.boundingBox);
          } else {
            setDetectedBox(null);
          }

          if (result.matchFound && result.userId) {
            const user = storageService.getUserById(result.userId);
            if (user) {
              setMatchedUser(user);
              setRecognitionStatus('MATCHED');
              setLastGreeting(result.greeting || `Welcome back, ${user.name}`);
              addLog('RECOGNITION', 'User Identified', `Matched: ${user.name} (${Math.round(result.confidence * 100)}%)`);
              storageService.updateUserLastSeen(user.id);
              
              // Reset to scanning after a delay
              setTimeout(() => {
                setRecognitionStatus('SCANNING');
                setMatchedUser(null);
                setDetectedBox(null); // Fade out box
              }, 3000);
            }
          } else if (result.error) {
             // Silent fail
          } else {
             // No match
             setRecognitionStatus('SCANNING');
          }
        } catch (e) {
          console.error(e);
        }
      }
      processingRef.current = false;
    }, 4000);
  }, [appState]);

  const stopRecognitionLoop = () => {
    if (recognitionTimerRef.current) {
      clearInterval(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (appState === AppState.RECOGNITION) {
      startRecognitionLoop();
    } else {
      stopRecognitionLoop();
      setDetectedBox(null);
    }
    return () => stopRecognitionLoop();
  }, [appState, startRecognitionLoop]);


  // --- Render ---
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center px-6 justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-600 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(2,132,199,0.6)]">
             <Icons.Face />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-white">SKYY <span className="text-sky-500 text-sm font-normal">FACIAL RECOGNITION</span></h1>
        </div>
        <nav className="flex gap-4">
           <button 
             onClick={() => setAppState(AppState.RECOGNITION)}
             className={`px-4 py-2 rounded text-sm font-medium transition-all ${appState === AppState.RECOGNITION ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/50' : 'text-slate-400 hover:text-white'}`}
           >
             Monitor
           </button>
           <button 
             onClick={startRegistration}
             className={`px-4 py-2 rounded text-sm font-medium transition-all ${appState === AppState.REGISTRATION ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/50' : 'text-slate-400 hover:text-white'}`}
           >
             Register User
           </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Panel: Visual Interface */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto relative">
          
          {/* Camera Container */}
          <div className="w-full aspect-video max-w-4xl mx-auto relative group">
             <div className="absolute -inset-1 bg-gradient-to-r from-sky-600 to-indigo-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
             <Camera 
               ref={cameraRef} 
               isActive={appState !== AppState.DASHBOARD} 
               onError={handleCameraError}
               detectedBox={detectedBox}
               isProcessing={regStep === 'PROCESSING'}
               overlayText={
                 appState === AppState.REGISTRATION 
                   ? "REGISTRATION MODE" 
                   : recognitionStatus === 'MATCHED' 
                     ? `MATCH: ${matchedUser?.name.toUpperCase()}`
                     : "SCANNING..."
               }
             />
             
             {/* Greeting Overlay */}
             {appState === AppState.RECOGNITION && recognitionStatus === 'MATCHED' && (
               <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 border border-sky-500/50 p-6 rounded-xl backdrop-blur-md shadow-2xl text-center animate-fadeIn">
                  <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/50">
                    <Icons.Check />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{matchedUser?.name}</h2>
                  <p className="text-sky-300 text-sm">{lastGreeting}</p>
               </div>
             )}
          </div>

          {/* Registration Controls */}
          {appState === AppState.REGISTRATION && (
            <div className="max-w-xl mx-auto w-full bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl">
               <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                 <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                 New User Registration
               </h2>
               
               {regStep === 'NAME' && (
                 <div className="space-y-4">
                   <div>
                     <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                     <input 
                       type="text" 
                       value={regName}
                       onChange={(e) => setRegName(e.target.value)}
                       placeholder="Enter name"
                       className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                     />
                     {regError && <p className="text-red-400 text-sm mt-1">{regError}</p>}
                   </div>
                   <div className="flex justify-end">
                     <button onClick={validateName} className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-2 rounded font-medium transition-colors">
                       Next: Capture Face
                     </button>
                   </div>
                 </div>
               )}

               {regStep === 'CAPTURE' && (
                  <div className="text-center space-y-4">
                    <p className="text-slate-400">Position the user in front of the camera. Ensure good lighting.</p>
                    {regError && <p className="text-red-400 text-sm">{regError}</p>}
                    <div className="flex justify-center gap-4">
                      <button onClick={() => setRegStep('NAME')} className="text-slate-500 hover:text-white px-4 py-2">Back</button>
                      <button onClick={captureAndRegister} className="bg-sky-600 hover:bg-sky-500 text-white px-8 py-2 rounded font-medium flex items-center gap-2">
                        <Icons.Scan /> Capture & Analyze
                      </button>
                    </div>
                  </div>
               )}

               {regStep === 'PROCESSING' && (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sky-400 animate-pulse">Generating Face Embedding...</p>
                    <p className="text-xs text-slate-500">Sending data to Gemini Vision Model</p>
                  </div>
               )}

               {regStep === 'COMPLETE' && (
                  <div className="text-center py-4 space-y-2">
                    <div className="text-green-400 text-xl font-bold">Registration Successful!</div>
                    <p className="text-slate-400">User profile created.</p>
                  </div>
               )}
                {regStep === 'ERROR' && (
                  <div className="text-center py-4 space-y-2">
                    <div className="text-red-400 text-xl font-bold">Registration Failed</div>
                    <p className="text-slate-400">{regError}</p>
                     <button onClick={() => setRegStep('CAPTURE')} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded mt-2">Retry Capture</button>
                  </div>
               )}
            </div>
          )}

        </div>

        {/* Right Panel: Logs & Orchestration */}
        <div className="w-full md:w-80 lg:w-96 bg-slate-950 border-l border-slate-800 flex flex-col shrink-0">
           <div className="flex-1 p-4 flex flex-col gap-4">
             
             {/* Stats Card */}
             <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
               <h3 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-3">System Status</h3>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <div className="text-2xl font-bold text-white">{users.length}</div>
                    <div className="text-xs text-slate-500">Registered Users</div>
                 </div>
                 <div>
                    <div className={`text-2xl font-bold ${appState === AppState.RECOGNITION ? 'text-green-400' : 'text-yellow-400'}`}>
                      {appState === AppState.RECOGNITION ? 'ACTIVE' : 'PAUSED'}
                    </div>
                    <div className="text-xs text-slate-500">Service State</div>
                 </div>
               </div>
             </div>

             {/* Log Viewer */}
             <LogViewer logs={logs} />
             
             {/* MCP Simulated Interface */}
             <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 mt-auto">
               <div className="flex items-center gap-2 mb-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                 <h3 className="text-slate-500 text-xs uppercase tracking-widest font-bold">MCP Interface</h3>
               </div>
               <div className="font-mono text-xs text-emerald-600/80 bg-black/50 p-2 rounded border border-emerald-900/30 h-24 overflow-hidden">
                 {'>'} Listening for Orchestration events...<br/>
                 {'>'} Gemini Model: gemini-2.5-flash<br/>
                 {logs.length > 0 && `> Last Event: ${logs[logs.length-1].type}`}
               </div>
             </div>

           </div>
        </div>

      </main>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default App;
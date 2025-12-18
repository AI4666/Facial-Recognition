import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  AppState, LogEntry, User, BoundingBox, Emotion, ConversationMessage,
  VoiceCommand, SecurityCheck, UserPreferences
} from './types';
import Camera, { CameraHandle } from './components/Camera';
import LogViewer from './components/LogViewer';
import CameraSelector from './components/CameraSelector';
import ChatInterface from './components/ChatInterface';
import EmotionIndicator from './components/EmotionIndicator';
import VoiceAssistant from './components/VoiceAssistant';
import SecurityIndicator from './components/SecurityIndicator';
import SettingsPanel from './components/SettingsPanel';
import OfflineModePanel from './components/OfflineModePanel';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { emotionService } from './services/emotionService';
import { conversationService } from './services/conversationService';
import { voiceService } from './services/voiceService';
import { securityService } from './services/securityService';

// Icons
const Icons = {
  Face: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 14h-7a2.5 2.5 0 0 0-5 5v2h17v-2a2.5 2.5 0 0 0-5-5Z" /><path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>,
  Scan: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3" /><path d="M12 16v4" /><path d="M12 4v4" /><path d="M16 12h4" /><path d="M4 12h4" /></svg>,
  Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
  Settings: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
};

const App: React.FC = () => {
  // --- Core State ---
  const [appState, setAppState] = useState<AppState>(AppState.RECOGNITION);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // === Registration State ===
  const [regName, setRegName] = useState('');
  const [regStep, setRegStep] = useState<'NAME' | 'CAPTURE' | 'PROCESSING' | 'COMPLETE' | 'ERROR'>('NAME');
  const [regError, setRegError] = useState<string | null>(null);

  // === Recognition State ===
  const [recognitionStatus, setRecognitionStatus] = useState<'SCANNING' | 'MATCHED' | 'UNKNOWN' | 'ERROR'>('SCANNING');
  const [lastGreeting, setLastGreeting] = useState<string | null>(null);
  const [matchedUser, setMatchedUser] = useState<User | null>(null);
  const [detectedBox, setDetectedBox] = useState<BoundingBox | null>(null);
  const [showGreetingOverlay, setShowGreetingOverlay] = useState(false);

  // === Advanced Features State ===
  const [currentEmotion, setCurrentEmotion] = useState<Emotion | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<VoiceCommand | undefined>(undefined);
  const [securityCheck, setSecurityCheck] = useState<SecurityCheck | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);

  // === Camera State ===
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);

  // === Refs ===
  const cameraRef = useRef<CameraHandle>(null);
  const processingRef = useRef(false);
  const recognitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const loadedUsers = storageService.getUsers();
    setUsers(loadedUsers);
    const loadedLogs = storageService.getLogs();
    setLogs(loadedLogs);
    addLog('INFO', 'System Initialized', 'Skyy OS v2.0 with Advanced AI Features loaded.');
  }, []);

  // --- Helpers ---
  const addLog = (type: LogEntry['type'], message: string, details?: string) => {
    const log = storageService.addLog(type, message, details);
    setLogs(prev => [...prev, log].slice(-100));
  };

  const handleCameraError = (err: string) => {
    addLog('ERROR', 'Camera Failure', err);
  };

  // === Registration Logic ===
  const startRegistration = () => {
    setAppState(AppState.REGISTRATION);
    setRegStep('NAME');
    setRegName('');
    setRegError(null);
    setDetectedBox(null);
    stopRecognitionLoop();
    addLog('INFO', 'Registration Mode Activated');
  };

  const validateName = () => {
    if (!regName.trim()) {
      setRegError("Name is required");
      return;
    }
    if (storageService.checkNameExists(regName.trim())) {
      setRegError("User already exists.");
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
      addLog('INFO', 'Processing Registration', 'Analyzing with Gemini...');

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
      if (!detection.qualityCheckPassed && !detection.description) {
        throw new Error("Image quality too low or obstructed.");
      }

      const newUser: User = {
        id: crypto.randomUUID(),
        name: regName,
        faceDescription: detection.description || "No description generated",
        registeredAt: new Date().toISOString(),
        interactionCount: 0
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

  // === Recognition Logic ===
  const startRecognitionLoop = useCallback(() => {
    if (recognitionTimerRef.current) clearInterval(recognitionTimerRef.current);

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

              // Load conversation history
              const history = conversationService.getConversationHistory(user.id);
              setConversationMessages(history);

              // Analyze emotion (if enabled)
              const prefs = storageService.getPreferences(user.id);
              if (!prefs || prefs.emotionTracking) {
                const emotionResult = await emotionService.analyzeEmotion(image);
                if (emotionResult.emotion) {
                  setCurrentEmotion(emotionResult.emotion);
                  storageService.saveEmotion(user.id, emotionResult.emotion);
                }
              }

              // Show greeting overlay and auto-dismiss after 4 seconds
              setShowGreetingOverlay(true);
              setTimeout(() => {
                setShowGreetingOverlay(false);
              }, 4000);

              // Stop scanning after successful match
              stopRecognitionLoop();
              addLog('INFO', 'Recognition Paused', 'User matched - scanning stopped');
            }
          } else {
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

  // === Chat/Conversation Logic ===
  const handleSendMessage = async (message: string, isVoice: boolean = false) => {
    if (!matchedUser) return;

    setIsChatProcessing(true);

    try {
      const response = await conversationService.processMessage(
        matchedUser.id,
        message,
        matchedUser,
        isVoice,
        currentEmotion?.primary
      );

      // Refresh conversation messages
      const updatedHistory = conversationService.getConversationHistory(matchedUser.id);
      setConversationMessages(updatedHistory);

      // Speak response if voice enabled
      const prefs = storageService.getPreferences(matchedUser.id);
      if (prefs?.voiceEnabled && voiceService.isTTSSupported()) {
        await voiceService.speak(response.content, prefs.voiceName);
      }

      addLog('INFO', 'Conversation', `${matchedUser.name}: "${message}"`);
    } catch (error: any) {
      addLog('ERROR', 'Chat Error', error.message);
    } finally {
      setIsChatProcessing(false);
    }
  };

  const handleVoiceInput = async () => {
    if (!voiceService.isSupported()) {
      addLog('WARNING', 'Voice Not Supported', 'Please use Chrome or Edge');
      return;
    }

    setIsVoiceListening(true);

    try {
      const transcript = await voiceService.startListening();
      setIsVoiceListening(false);

      if (transcript) {
        // Check if it's a command or a chat message
        const command = voiceService.parseCommand(transcript);

        if (command.command === 'chat' && matchedUser) {
          // Send as chat message
          await handleSendMessage(transcript, true);
        } else {
          // Execute command
          await handleVoiceCommand(command);
        }
      }
    } catch (error: any) {
      setIsVoiceListening(false);
      addLog('WARNING', 'Voice Recognition Failed', error.message);
    }
  };

  // === Voice Command Logic ===
  const handleVoiceCommand = async (command: VoiceCommand) => {
    setLastVoiceCommand({ ...command, executed: false });

    try {
      switch (command.command) {
        case 'register_user':
          startRegistration();
          break;
        case 'start_recognition':
          setAppState(AppState.RECOGNITION);
          break;
        case 'capture_image':
          if (appState === AppState.REGISTRATION && regStep === 'CAPTURE') {
            await captureAndRegister();
          }
          break;
        case 'stop_recognition':
          setAppState(AppState.IDLE);
          stopRecognitionLoop();
          setMatchedUser(null);
          setDetectedBox(null);
          break;
        case 'open_settings':
          setShowSettings(true);
          break;
        default:
          throw new Error(`Unknown command: ${command.command}`);
      }

      setLastVoiceCommand({ ...command, executed: true });
      addLog('INFO', 'Voice Command Executed', command.transcript);
    } catch (error: any) {
      setLastVoiceCommand({ ...command, executed: false, error: error.message });
      addLog('ERROR', 'Voice Command Failed', error.message);
    }
  };

  const toggleVoiceListening = () => {
    if (isVoiceListening) {
      setIsVoiceListening(false);
    } else {
      handleVoiceInput();
    }
  };

  // === Security Check Logic ===
  const performSecurityCheck = async () => {
    if (!cameraRef.current) return;

    try {
      addLog('INFO', 'Security Check Started', 'Multi-frame analysis...');

      // Capture multiple frames for liveness detection
      const frames = await cameraRef.current.captureMultiple(3, 500);

      if (frames.length < 2) {
        throw new Error('Insufficient frames for analysis');
      }

      const livenessResult = await securityService.checkLiveness(frames);
      setSecurityCheck(livenessResult);

      if (livenessResult.passed) {
        addLog('SUCCESS', 'Security Check Passed', 'Liveness verified');
      } else {
        addLog('WARNING', 'Security Alert', 'Potential spoof detected');
      }
    } catch (error: any) {
      addLog('ERROR', 'Security Check Failed', error.message);
    }
  };

  // === Settings Logic ===
  const handleSavePreferences = (prefs: UserPreferences) => {
    storageService.savePreferences(prefs);
    addLog('INFO', 'Preferences Updated', `User: ${prefs.userId}`);
  };

  // === Render ===
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center px-6 justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-600 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(2,132,199,0.6)]">
            <Icons.Face />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-white">
            ADVANCE <span className="text-sky-500 text-sm font-normal">AI RECOGNITION V2.0</span>
          </h1>
        </div>
        <nav className="flex gap-4 items-center">
          <CameraSelector onCameraChange={setSelectedCameraId} currentDeviceId={selectedCameraId} />
          <button
            onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${showAdvancedPanel ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
          >
            Advanced
          </button>
          <button
            onClick={() => setAppState(AppState.RECOGNITION)}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${appState === AppState.RECOGNITION ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/50' : 'text-slate-400 hover:text-white'
              }`}
          >
            Monitor
          </button>
          <button
            onClick={startRegistration}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${appState === AppState.REGISTRATION ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/50' : 'text-slate-400 hover:text-white'
              }`}
          >
            Register User
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="text-slate-400 hover:text-white transition-colors p-2"
          >
            <Icons.Settings />
          </button>
        </nav>
      </header>

      {/* Main Content - 3 Column Layout */}
      <main className="flex-1 flex flex-col xl:flex-row overflow-hidden">

        {/* LEFT PANEL: System Status, Voice Commands, Security */}
        <div className="w-full xl:w-80 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 flex flex-col gap-4">

            {/* System Status */}
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

            {/* Advanced Features Panel */}
            {showAdvancedPanel && (
              <>
                {/* Offline Mode Panel */}
                <OfflineModePanel />

                {/* Emotion Indicator */}
                {currentEmotion && (
                  <EmotionIndicator emotion={currentEmotion} />
                )}

                {/* Voice Assistant - Push-to-Talk */}
                <VoiceAssistant
                  onCaptureRequest={async () => cameraRef.current?.capture() || null}
                  onRecognizeRequest={async (image) => {
                    const result = await geminiService.recognizeUser(image, users);
                    if (result.matchFound && result.userId) {
                      const user = storageService.getUserById(result.userId);
                      if (user) {
                        setMatchedUser(user);
                        setRecognitionStatus('MATCHED');
                        setLastGreeting(result.greeting || `Welcome back, ${user.name}`);
                        setShowGreetingOverlay(true);
                        setTimeout(() => setShowGreetingOverlay(false), 4000);
                        const history = conversationService.getConversationHistory(user.id);
                        setConversationMessages(history);
                        stopRecognitionLoop();
                      }
                    }
                    return result;
                  }}
                  onRegisterRequest={() => startRegistration()}
                  onSpeakResponse={async (text) => {
                    if (voiceService.isTTSSupported()) {
                      await voiceService.speak(text);
                    }
                  }}
                  onCommand={(cmd) => {
                    switch (cmd) {
                      case 'start_recognition':
                        setAppState(AppState.RECOGNITION);
                        break;
                      case 'stop_recognition':
                        setAppState(AppState.IDLE);
                        stopRecognitionLoop();
                        setMatchedUser(null);
                        break;
                      case 'open_settings':
                        setShowSettings(true);
                        break;
                    }
                  }}
                />

                {/* Security Indicator */}
                {securityCheck && (
                  <SecurityIndicator securityCheck={securityCheck} />
                )}

                {/* Security Check Button */}
                <button
                  onClick={performSecurityCheck}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors border border-slate-700"
                >
                  Run Security Check
                </button>
              </>
            )}

          </div>
        </div>

        {/* CENTER PANEL: Camera & Visual Interface */}
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
              deviceId={selectedCameraId}
              overlayText={
                appState === AppState.REGISTRATION
                  ? "REGISTRATION MODE"
                  : recognitionStatus === 'MATCHED'
                    ? `MATCH: ${matchedUser?.name.toUpperCase()}`
                    : "SCANNING..."
              }
            />

            {/* Greeting Overlay - auto-dismisses after 4 seconds */}
            {showGreetingOverlay && matchedUser && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 border border-sky-500/50 p-6 rounded-xl backdrop-blur-md shadow-2xl text-center animate-fadeIn">
                <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/50">
                  <Icons.Check />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{matchedUser?.name}</h2>
                <p className="text-sky-300 text-sm">{lastGreeting}</p>
                {currentEmotion && (
                  <div className="mt-3">
                    <EmotionIndicator emotion={currentEmotion} compact />
                  </div>
                )}
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

          {/* Chat Interface (when user is matched) */}
          {appState === AppState.RECOGNITION && matchedUser && (
            <div className="max-w-xl mx-auto w-full h-96">
              <ChatInterface
                user={matchedUser}
                messages={conversationMessages}
                onSendMessage={handleSendMessage}
                onVoiceInput={handleVoiceInput}
                isListening={isVoiceListening}
                isProcessing={isChatProcessing}
              />
            </div>
          )}

        </div>

        {/* RIGHT PANEL: System Logs */}
        <div className="w-full xl:w-96 bg-slate-950 border-l border-slate-800 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 h-full flex flex-col">
            <LogViewer logs={logs} />
          </div>
        </div>

      </main>

      {/* Settings Modal */}
      {showSettings && matchedUser && (
        <SettingsPanel
          preferences={storageService.getPreferences(matchedUser.id)}
          onSave={handleSavePreferences}
          onClose={() => setShowSettings(false)}
        />
      )}

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
    </div >
  );
};

export default App;

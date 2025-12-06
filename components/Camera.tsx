import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { BoundingBox } from '../types';

interface CameraProps {
  onCameraReady?: () => void;
  onError?: (error: string) => void;
  isActive: boolean;
  overlayText?: string;
  detectedBox?: BoundingBox | null;
  isProcessing?: boolean;
  deviceId?: string;
}

export interface CameraHandle {
  capture: () => string | null;
  captureMultiple: (count: number, intervalMs: number) => Promise<string[]>;
}

const Camera = forwardRef<CameraHandle, CameraProps>(({ onCameraReady, onError, isActive, overlayText, detectedBox, isProcessing, deviceId }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [boxStyle, setBoxStyle] = useState<React.CSSProperties | null>(null);

  useImperativeHandle(ref, () => ({
    capture: () => {
      if (!videoRef.current || !canvasRef.current || !isReady) return null;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    },
    captureMultiple: async (count: number, intervalMs: number): Promise<string[]> => {
      const frames: string[] = [];
      for (let i = 0; i < count; i++) {
        const frame = (ref as any).current?.capture();
        if (frame) frames.push(frame);
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
      return frames;
    }
  }));

  const calculateBox = useCallback(() => {
    if (!detectedBox || !videoRef.current || !containerRef.current) {
      setBoxStyle(null);
      return;
    }

    const video = videoRef.current;
    const container = containerRef.current;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    if (vw === 0 || vh === 0) return;

    // Calculate scale factor for object-cover behavior
    const videoAspect = vw / vh;
    const containerAspect = cw / ch;

    let scale, renderWidth, renderHeight, offsetX, offsetY;

    if (containerAspect > videoAspect) {
      // Container is wider than video (video fills width, crops height)
      scale = cw / vw;
      renderWidth = cw;
      renderHeight = vh * scale;
      offsetX = 0;
      offsetY = (ch - renderHeight) / 2;
    } else {
      // Container is taller than video (video fills height, crops width)
      scale = ch / vh;
      renderWidth = vw * scale;
      renderHeight = ch;
      offsetX = (cw - renderWidth) / 2;
      offsetY = 0;
    }

    // Map 0-1000 coordinates to rendered video dimensions
    const top = (detectedBox.ymin / 1000) * renderHeight + offsetY;
    const left = (detectedBox.xmin / 1000) * renderWidth + offsetX;
    const height = ((detectedBox.ymax - detectedBox.ymin) / 1000) * renderHeight;
    const width = ((detectedBox.xmax - detectedBox.xmin) / 1000) * renderWidth;

    setBoxStyle({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  }, [detectedBox]);

  // Recalculate box on resize or when box data changes
  useEffect(() => {
    calculateBox();
    window.addEventListener('resize', calculateBox);
    return () => window.removeEventListener('resize', calculateBox);
  }, [calculateBox]);

  // Robust Camera Initialization
  useEffect(() => {
    let localStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      if (!isActive) {
        // If becoming inactive, cleanup is handled by the cleanup function of the previous effect run
        // or by the component unmounting.
        setIsReady(false);
        return;
      }

      setHasPermissionError(false);

      try {
        // Request camera with ideal constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        // Handle race condition: If component unmounted during await
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        localStream = stream;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Explicitly play to ensure it starts even if autoPlay fails
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn("Video play request interrupted", playErr);
          }
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (isMounted) {
          setHasPermissionError(true);
          if (onError) onError(err.message || "Could not access camera. Check permissions.");
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      // Clean up the stream created in this specific effect cycle
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      // Clean up the ref if it matches
      if (streamRef.current === localStream) {
        streamRef.current = null;
      }
      setIsReady(false);
    };
  }, [isActive, onError, deviceId]);

  const handleCanPlay = () => {
    setIsReady(true);
    calculateBox(); // Recalculate in case metadata loaded late
    if (onCameraReady) onCameraReady();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black rounded-lg overflow-hidden shadow-inner shadow-sky-900/50 border border-slate-800 group">

      {/* Offline State */}
      {!isActive && !hasPermissionError && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 bg-slate-950">
          <div className="flex flex-col items-center gap-2">
            <div className="w-3 h-3 bg-slate-600 rounded-full animate-pulse"></div>
            <span className="text-xs uppercase tracking-widest">Camera Standby</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasPermissionError && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 bg-slate-950 z-20">
          <div className="flex flex-col items-center gap-3 p-6 border border-red-900/50 rounded-lg bg-red-900/10 backdrop-blur">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <span className="font-bold">Camera Access Failed</span>
            <p className="text-xs text-red-300 text-center max-w-[200px]">Please allow camera access in your browser settings to continue.</p>
          </div>
        </div>
      )}

      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onCanPlay={handleCanPlay}
        onLoadedMetadata={calculateBox}
        className={`w-full h-full object-cover transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* HUD Overlay */}
      {isReady && isActive && (
        <div className="absolute inset-0 pointer-events-none">

          {/* Static Registration Guide (Center Frame) - Only show if no box detected */}
          {!detectedBox && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 opacity-30 transition-opacity duration-500 group-hover:opacity-60">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-sky-400 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-sky-400 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-sky-400 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-sky-400 rounded-br-lg"></div>

              {/* Crosshair */}
              <div className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-sky-400/50 -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-1/2 w-0.5 h-4 bg-sky-400/50 -translate-x-1/2 -translate-y-1/2"></div>
            </div>
          )}

          {/* Dynamic Detected Bounding Box */}
          {boxStyle && (
            <div
              className="absolute border-2 border-sky-400 bg-sky-500/10 shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all duration-300 ease-out rounded-md"
              style={boxStyle}
            >
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-sky-200"></div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-sky-200"></div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-sky-200"></div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-sky-200"></div>

              {/* Label */}
              <div className="absolute -top-8 left-0 bg-sky-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-t uppercase tracking-wider">
                Target Locked
              </div>
            </div>
          )}

          {/* Processing Spinner */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-10 transition-all duration-300">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                <div className="absolute inset-0 border-t-4 border-sky-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-xs font-mono text-sky-400 animate-pulse font-bold tracking-widest">AI</span>
                  <span className="text-[10px] text-sky-600">ANALYZING</span>
                </div>
              </div>
            </div>
          )}

          {/* Scanning Animation (Only if not locked) */}
          {!detectedBox && !isProcessing && (
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
              <div className="w-full h-1 bg-sky-400/80 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-[scan_3s_ease-in-out_infinite]"></div>
            </div>
          )}

          {/* Status Text */}
          {overlayText && (
            <div className="absolute bottom-6 left-0 w-full flex justify-center">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-6 py-2 rounded-full flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${detectedBox ? 'bg-green-500 animate-none' : 'bg-sky-500 animate-pulse'}`}></div>
                <span className="text-sky-100 text-xs font-mono uppercase tracking-widest">
                  {overlayText}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
});

Camera.displayName = 'Camera';

export default Camera;
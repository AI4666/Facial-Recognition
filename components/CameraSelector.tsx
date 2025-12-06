import React, { useState, useEffect } from 'react';

interface CameraSelectorProps {
  onCameraChange: (deviceId: string) => void;
  currentDeviceId?: string;
}

const CameraSelector: React.FC<CameraSelectorProps> = ({ onCameraChange, currentDeviceId }) => {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>(currentDeviceId || '');

  useEffect(() => {
    const getCameras = async () => {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => stream.getTracks().forEach(track => track.stop()));
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        
        // If no camera selected yet, select the first one
        if (!selectedCamera && videoDevices.length > 0) {
          const firstCameraId = videoDevices[0].deviceId;
          setSelectedCamera(firstCameraId);
          onCameraChange(firstCameraId);
        }
      } catch (err) {
        console.error('Error enumerating cameras:', err);
      }
    };

    getCameras();
  }, []);

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedCamera(deviceId);
    onCameraChange(deviceId);
    
    // Save preference to localStorage
    localStorage.setItem('selectedCameraId', deviceId);
  };

  // Load saved preference
  useEffect(() => {
    const savedCameraId = localStorage.getItem('selectedCameraId');
    if (savedCameraId && cameras.some(cam => cam.deviceId === savedCameraId)) {
      setSelectedCamera(savedCameraId);
      onCameraChange(savedCameraId);
    }
  }, [cameras]);

  if (cameras.length <= 1) {
    return null; // Don't show selector if only one camera
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>
      <select 
        value={selectedCamera}
        onChange={handleCameraChange}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      >
        {cameras.map((camera, index) => (
          <option key={camera.deviceId} value={camera.deviceId}>
            {camera.label || `Camera ${index + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CameraSelector;

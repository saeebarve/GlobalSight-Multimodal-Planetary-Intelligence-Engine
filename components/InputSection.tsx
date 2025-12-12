import React, { useRef, useState, useEffect } from 'react';
import { FileData, AudioData } from '../types';
import { fileToBase64, blobToBase64 } from '../services/geminiService';

interface InputSectionProps {
  onAnalyze: (text: string, fileData: FileData | null, audioData: AudioData | null) => void;
  isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onAnalyze, isLoading }) => {
  const [text, setText] = useState('');
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Camera / Field Agent Mode State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [cameraStream]);

  const handleStreamSuccess = (stream: MediaStream) => {
      setCameraStream(stream);
      setIsCameraOpen(true);
      // Slight delay to ensure modal renders and video element is mounted
      setTimeout(() => {
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
              // Ensure video plays (sometimes needed on mobile)
              videoRef.current.play().catch(e => console.log("Video play error:", e));
          }
      }, 100);
  };

  const startCamera = async () => {
    // Safety check for API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera API is not supported in this environment. Please ensure you are using HTTPS.");
        return;
    }

    try {
        // Try enabling camera with preferred environment facing mode
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        handleStreamSuccess(stream);
    } catch (err: any) {
        console.error("Camera access failed with constraints:", err);
        
        // Fallback: Try generic video request (fixes OverconstrainedError on some desktops/devices)
        try {
            console.log("Attempting fallback camera request...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            handleStreamSuccess(stream);
            return;
        } catch (fallbackErr: any) {
            console.error("Fallback camera access failed:", fallbackErr);
            
            // Construct user-friendly error message
            let msg = "Could not access camera.";
            if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
                msg = "Camera permission was denied. Please check your browser settings (lock icon in address bar) to allow access.";
            } else if (fallbackErr.name === 'NotFoundError') {
                msg = "No camera device found.";
            } else if (fallbackErr.name === 'NotReadableError') {
                msg = "Camera is currently in use by another application.";
            }
            alert(msg);
        }
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        // Ensure valid dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        // Match canvas size to video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 jpeg
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        // Convert dataUrl to blob for "file" object emulation
        setFileData({
            base64: dataUrl,
            mimeType: 'image/jpeg',
            previewUrl: dataUrl,
            file: new File([], "camera_scan.jpg") // Mock file object
        });

        stopCamera();
    }
  };

  const stopCamera = () => {
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
      }
      setIsCameraOpen(false);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Microphone access is not supported in this environment.");
        return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); 
        const base64 = await blobToBase64(blob);
        setAudioData({
          blob,
          previewUrl: URL.createObjectURL(blob),
          base64,
          mimeType: 'audio/webm'
        });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      let msg = "Could not access microphone.";
       if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = "Microphone permission was denied. Please check your browser settings.";
        }
      alert(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        setFileData({
          file,
          previewUrl: URL.createObjectURL(file),
          base64,
          mimeType: file.type
        });
      } catch (err) {
        console.error("Error reading file", err);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      try {
        const base64 = await fileToBase64(file);
        setFileData({
          file,
          previewUrl: URL.createObjectURL(file),
          base64,
          mimeType: file.type
        });
      } catch (err) {
        console.error("Error reading file", err);
      }
    }
  };

  const clearFile = () => {
    setFileData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearAudio = () => {
    setAudioData(null);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });
            setIsLocating(false);
        },
        (error) => {
            console.error(error);
            setIsLocating(false);
            if (error.code === error.PERMISSION_DENIED) {
                 alert("Location permission denied. Please allow location access.");
            } else {
                 alert("Unable to retrieve location.");
            }
        }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text && !fileData && !audioData) return;
    
    // Inject location into text prompt if available
    let finalText = text;
    if (location) {
        finalText = `[DATA CONTEXT: USER LOCATION DETECTED: LAT ${location.lat}, LNG ${location.lng}. USE THIS TO GROUND THE ANALYSIS IN THIS SPECIFIC GEOGRAPHIC REGION.] \n\n${text}`;
    }

    onAnalyze(finalText, fileData, audioData);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative z-20">
      
      {/* CAMERA OVERLAY MODAL */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            {/* HUD Overlay */}
            <div className="absolute inset-4 border-2 border-gs-ocean/50 rounded-2xl pointer-events-none z-20">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-gs-ocean -translate-x-1 -translate-y-1"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-gs-ocean translate-x-1 -translate-y-1"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-gs-ocean -translate-x-1 translate-y-1"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-gs-ocean translate-x-1 translate-y-1"></div>
                
                {/* Crosshair */}
                <div className="absolute inset-0 m-auto w-12 h-12 border border-white/30 rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-gs-alert rounded-full"></div>
                </div>

                {/* Status Text */}
                <div className="absolute top-4 left-4 font-mono text-gs-ocean text-xs animate-pulse">
                    LIVE FEED // ACQUIRING TARGET
                </div>
            </div>

            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover opacity-80"
            />
            
            <div className="absolute bottom-10 flex gap-6 z-30">
                <button 
                    onClick={stopCamera}
                    className="w-16 h-16 rounded-full bg-slate-800 border border-slate-600 text-white flex items-center justify-center hover:bg-slate-700 transition-colors"
                >
                    <i className="fa-solid fa-xmark text-2xl"></i>
                </button>
                <button 
                    onClick={captureFrame}
                    className="w-20 h-20 rounded-full bg-white/10 border-4 border-white flex items-center justify-center hover:bg-white/20 transition-all hover:scale-110 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                >
                    <div className="w-16 h-16 bg-white rounded-full"></div>
                </button>
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group/form hover-lift">
        
        {/* Animated Gradient Border Top */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gs-ocean via-gs-land to-gs-life animate-gradient-x"></div>
        
        <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gs-ocean/20 text-gs-ocean flex items-center justify-center border border-gs-ocean/40 shadow-[0_0_15px_rgba(0,153,255,0.3)]">
            <i className="fa-solid fa-satellite"></i> 
          </div>
          <span className="tracking-tight">Input Sensor Data</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            {/* Visual Input Zone - Portal Effect */}
            <div 
            className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 text-center cursor-pointer group overflow-hidden min-h-[250px] flex flex-col items-center justify-center
                ${isDragging ? 'border-gs-ocean bg-gs-ocean/10 shadow-[0_0_50px_rgba(0,153,255,0.3)] scale-[1.02]' : 'border-slate-700/50 hover:border-gs-ocean/50 hover:bg-black/40'}
                ${fileData ? 'border-gs-land/50 bg-black/60' : ''}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !fileData && fileInputRef.current?.click()}
            >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-gs-ocean/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            {fileData ? (
                <div className="relative group/preview w-full h-full flex items-center justify-center">
                {fileData.mimeType.startsWith('image/') ? (
                    <img 
                    src={fileData.previewUrl} 
                    alt="Preview" 
                    className="max-h-52 rounded-lg object-contain shadow-2xl border border-white/10 z-10"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-300 z-10">
                        <i className="fa-solid fa-file-pdf text-6xl mb-4 text-gs-alert drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"></i>
                        <p className="font-mono text-xs truncate max-w-[150px] bg-black/50 px-2 py-1 rounded border border-white/10">{fileData.file?.name}</p>
                    </div>
                )}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    className="absolute -top-4 -right-4 bg-gs-void border border-slate-600 text-slate-400 hover:text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg z-20 transition-transform hover:scale-110 hover:border-red-500 hover:bg-red-500/20"
                >
                    <i className="fa-solid fa-xmark"></i>
                </button>
                </div>
            ) : (
                <div className="space-y-4 relative z-10 w-full">
                    {/* Scan Environment Button inside the drop zone */}
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startCamera(); }}
                        className="w-full py-3 mb-4 rounded-xl bg-gs-ocean/20 border border-gs-ocean/50 text-gs-ocean font-bold hover:bg-gs-ocean hover:text-white transition-all shadow-[0_0_20px_rgba(0,153,255,0.2)] flex items-center justify-center gap-2 group/cam"
                    >
                         <i className="fa-solid fa-camera-retro group-hover/cam:scale-110 transition-transform"></i>
                         <span>START FIELD SCAN</span>
                    </button>

                    <div className="flex items-center gap-3 text-slate-500 text-xs font-mono uppercase tracking-widest justify-center">
                        <div className="h-px bg-slate-700 w-12"></div>
                        OR UPLOAD
                        <div className="h-px bg-slate-700 w-12"></div>
                    </div>

                    <div className="mt-4">
                        <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-600 mb-2"></i>
                        <p className="text-sm text-slate-500 font-medium">Drag & Drop Evidence</p>
                    </div>
                </div>
            )}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*,application/pdf"
            />
            </div>

            {/* Audio Input Zone - Frequency Effect */}
            <div className={`relative border-2 border-slate-700/50 rounded-2xl p-6 transition-all duration-300 text-center flex flex-col items-center justify-center min-h-[250px] overflow-hidden
                ${isRecording ? 'border-gs-alert bg-gs-alert/10 shadow-[0_0_50px_rgba(239,68,68,0.2)]' : audioData ? 'border-gs-life/50 bg-black/60' : 'hover:bg-black/40 hover:border-gs-life/30'}
            `}>
                {!audioData ? (
                    <div className="flex flex-col items-center gap-6 z-10">
                        <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl border-4
                                ${isRecording 
                                    ? 'bg-gs-alert border-red-400 animate-pulse scale-110' 
                                    : 'bg-gradient-to-br from-slate-800 to-black border-slate-600 hover:border-gs-life hover:shadow-[0_0_30px_rgba(255,170,0,0.4)] text-white hover:scale-105'
                                }
                            `}
                        >
                            <i className={`fa-solid ${isRecording ? 'fa-stop text-3xl' : 'fa-microphone text-4xl'}`}></i>
                        </button>
                        <div>
                            <p className={`font-bold text-xl ${isRecording ? 'text-gs-alert' : 'text-slate-200'}`}>
                                {isRecording ? 'Recording Audio...' : 'Voice Report'}
                            </p>
                            <p className="text-sm text-slate-500 mt-2 font-medium">Describe the context verbally</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-6 z-10">
                         <div className="w-24 h-24 rounded-full bg-gs-life/10 flex items-center justify-center text-gs-life mb-2 border-2 border-gs-life/30 shadow-[0_0_30px_rgba(255,170,0,0.2)]">
                             <i className="fa-solid fa-wave-square text-4xl"></i>
                         </div>
                         <audio src={audioData.previewUrl} controls className="w-full max-w-[240px] h-10 opacity-90 rounded-full" />
                         <button
                            type="button"
                            onClick={clearAudio}
                            className="text-xs text-gs-alert hover:text-red-300 font-bold uppercase tracking-wider mt-2 border-b border-dashed border-gs-alert/50"
                        >
                            Delete Recording
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Text Input with Floating Label effect */}
        <div className="mb-10 relative">
          <div className="relative group">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder=" "
              className="peer w-full bg-black/40 border border-slate-700/50 rounded-2xl p-6 text-white focus:ring-2 focus:ring-gs-land focus:border-transparent outline-none transition-all resize-none h-32 placeholder-transparent group-hover:border-slate-500 text-lg leading-relaxed shadow-inner"
            />
            <label className="absolute left-6 top-6 text-slate-500 transition-all duration-300 transform -translate-y-0 peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-8 peer-focus:text-xs peer-focus:text-gs-land peer-not-placeholder-shown:-translate-y-8 peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:text-gs-land pointer-events-none font-medium">
                Enter specific location, context, or hypothesis...
            </label>
            <div className="absolute bottom-4 right-4 flex gap-4">
                 {/* Geolocate Button */}
                 <button 
                    type="button"
                    onClick={handleLocate}
                    className={`flex items-center gap-2 text-sm transition-colors ${location ? 'text-gs-land' : 'text-slate-600 hover:text-gs-ocean'}`}
                    title="Add Location Data"
                 >
                    {isLocating ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : location ? (
                         <><i className="fa-solid fa-location-crosshairs"></i> GPS Locked</>
                    ) : (
                         <><i className="fa-solid fa-location-arrow"></i> Add Location</>
                    )}
                 </button>
                 
                 <div className="text-slate-600 text-sm group-hover:text-gs-land transition-colors">
                    <i className="fa-solid fa-keyboard"></i>
                 </div>
            </div>
          </div>
        </div>

        {/* Action Button - 3D Push */}
        <button
          type="submit"
          disabled={isLoading || (!text && !fileData && !audioData)}
          className={`w-full py-6 rounded-2xl font-black text-xl tracking-widest transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center justify-center gap-4 relative overflow-hidden group active:scale-[0.98] active:translate-y-1
            ${isLoading 
              ? 'bg-slate-800 cursor-not-allowed text-slate-500 border border-slate-700' 
              : 'bg-gradient-to-r from-gs-ocean via-gs-land to-gs-life text-white transform hover:-translate-y-1 hover:shadow-[0_0_50px_rgba(0,204,102,0.4)] border border-white/20'}
          `}
        >
          {isLoading ? (
            <>
              <i className="fa-solid fa-earth-americas fa-spin-pulse"></i>
              <span>PROCESSING DATA STREAM...</span>
            </>
          ) : (
            <>
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 skew-y-6"></span>
              <i className="fa-solid fa-bolt text-2xl"></i>
              <span className="relative z-10 drop-shadow-md">INITIATE ANALYSIS</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default InputSection;
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, FlipHorizontal, Flashlight, FlashlightOff, AlertCircle, Play } from 'lucide-react';
import { ThemeColors } from '../utils/theme';

interface CameraFeedProps {
  theme: ThemeColors;
  onSnapshotReady?: (dataUrl: string) => void;
  children: React.ReactNode;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  theme,
  children,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'error' | 'simulated'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [simInterval, setSimInterval] = useState<any>(null);

  // Start real camera stream
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraState('requesting');
    setErrorMessage('');

    // Stop existing stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setStream(mediaStream);
      setCameraState('active');

      // Check for torch capability
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        setHasTorch(Boolean(capabilities.torch));
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraState('error');
      setErrorMessage(err.message || 'Camera access permission denied or unavailable.');
    }
  }, [stream]);

  // Flip camera between environment (back) and user (front)
  const flipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (cameraState === 'active') {
      startCamera(nextFacing);
    }
  };

  // Toggle flashlight / torch
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Could not toggle torch:', e);
    }
  };

  // Start simulated camera canvas if user doesn't have a camera or wants demo feed
  const startSimulatedCamera = useCallback(() => {
    setCameraState('simulated');
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [stream]);

  // Animated background for simulated mode
  useEffect(() => {
    if (cameraState !== 'simulated') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let t = 0;

    const render = () => {
      t += 0.02;
      const w = canvas.width;
      const h = canvas.height;

      // Dark tactical horizon gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a141d');
      grad.addColorStop(0.5, '#111e27');
      grad.addColorStop(1, '#050a0e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle simulated horizon terrain line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 20) {
        const y = h * 0.55 + Math.sin((x + t * 40) * 0.015) * 16 + Math.cos(x * 0.005) * 20;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      for (let x = 0; x < w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Simulated optic noise particles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < 15; i++) {
        const px = (Math.sin(i * 99 + t) * 0.5 + 0.5) * w;
        const py = (Math.cos(i * 33 + t) * 0.5 + 0.5) * h;
        ctx.fillRect(px, py, 2, 2);
      }

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrame);
  }, [cameraState]);

  // Attempt auto-starting environment camera on mount
  useEffect(() => {
    startCamera('environment');
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center select-none"
    >
      {/* Live Video Feed Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
          cameraState === 'active' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Simulated Canvas Feed when camera is idle / disabled / fallback */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
          cameraState === 'simulated' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Optic Scanline / Vignette Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(circle_at_center,transparent_60%,rgba(0,0,0,0.65)_100%)]" />

      {/* Camera Inactive / Permission Gate Screen */}
      {(cameraState === 'idle' || cameraState === 'error' || cameraState === 'requesting') && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-md text-center">
          <div
            className="w-16 h-16 rounded-full border flex items-center justify-center mb-4"
            style={{ borderColor: theme.border, backgroundColor: theme.primaryBg }}
          >
            <Camera className="w-8 h-8" style={{ color: theme.primary }} />
          </div>

          <h2 className="text-xl font-bold font-mono tracking-tight mb-2" style={{ color: theme.text }}>
            PHONE SENSOR CAMERA HUD
          </h2>
          <p className="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
            Live video viewfinder with real-time phone sensor telemetry overlays: Gyroscope, Accelerometer, Barometer,
            Altimeter, and Heading Compass on the edges.
          </p>

          {cameraState === 'error' && (
            <div className="flex items-center gap-2 p-3 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-mono max-w-md mb-4 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage} You can enable the camera or use the simulated feed.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              disabled={cameraState === 'requesting'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md font-mono text-sm font-bold border transition-all active:scale-95 shadow-lg"
              style={{
                borderColor: theme.primary,
                backgroundColor: theme.primary,
                color: '#0a0e14',
                boxShadow: theme.glow,
              }}
            >
              <Camera className="w-4 h-4" />
              {cameraState === 'requesting' ? 'CONNECTING CAMERA...' : 'ENABLE LIVE CAMERA'}
            </button>

            <button
              type="button"
              onClick={startSimulatedCamera}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md font-mono text-sm font-bold border transition-all active:scale-95 bg-white/10 hover:bg-white/15 text-slate-200 border-white/20"
            >
              <Play className="w-4 h-4" />
              SIMULATED VIDEO FEED
            </button>
          </div>
        </div>
      )}

      {/* Viewfinder Tactical Corner Brackets */}
      <div className="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 pointer-events-none z-10" style={{ borderColor: theme.primary }} />
      <div className="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 pointer-events-none z-10" style={{ borderColor: theme.primary }} />
      <div className="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 pointer-events-none z-10" style={{ borderColor: theme.primary }} />
      <div className="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 pointer-events-none z-10" style={{ borderColor: theme.primary }} />

      {/* Camera Action Floating Toolbar (Bottom Right) */}
      <div className="absolute bottom-20 right-4 z-30 flex flex-col gap-2 pointer-events-auto">
        {/* Flip Camera */}
        <button
          type="button"
          onClick={flipCamera}
          className="p-2.5 rounded-full border backdrop-blur-md transition-all active:scale-90 hover:bg-white/10 shadow-lg"
          style={{
            borderColor: theme.border,
            backgroundColor: 'rgba(8, 12, 18, 0.85)',
            color: theme.primary,
          }}
          title="Switch Camera (Front/Back)"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>

        {/* Torch / Flashlight Toggle (if available) */}
        {hasTorch && (
          <button
            type="button"
            onClick={toggleTorch}
            className="p-2.5 rounded-full border backdrop-blur-md transition-all active:scale-90 shadow-lg"
            style={{
              borderColor: torchOn ? theme.warning : theme.border,
              backgroundColor: torchOn ? 'rgba(245, 158, 11, 0.25)' : 'rgba(8, 12, 18, 0.85)',
              color: torchOn ? theme.warning : theme.text,
            }}
            title="Flashlight / Torch"
          >
            {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4 opacity-70" />}
          </button>
        )}
      </div>

      {/* HUD Telemetry Edge Overlays rendered as children */}
      {children}
    </div>
  );
};

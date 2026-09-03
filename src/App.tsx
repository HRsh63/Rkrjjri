import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Target,
  Crosshair,
  UserCheck,
  Volume2,
  VolumeX,
  PlusCircle,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Zap,
  Radio,
  Sliders,
  Play,
  Layers,
} from 'lucide-react';
import { sensorManager } from './utils/sensorManager';
import { OrientationData, MotionData, BarometerData } from './types';
import { trackingEngine, TrackedSARObject } from './utils/trackingEngine';
import { detectorEngine, SensitivityLevel } from './utils/detectorEngine';
import { SIM_SCENARIOS, ScenarioType, SimTargetDef, updateSimulatedTargets } from './utils/simScenarios';

interface LogEntry {
  id: number;
  time: string;
  type: 'info' | 'warn' | 'alert';
  msg: string;
}

declare global {
  interface Window {
    cocoSsd?: any;
    faceapi?: any;
    tf?: any;
  }
}

export default function App() {
  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sensor state from sensorManager
  const [orientation, setOrientation] = useState<OrientationData>({
    pitch: 0,
    roll: 0,
    yaw: 0,
    absolute: false,
    calibratedPitch: 0,
    calibratedRoll: 0,
    calibratedYaw: 0,
  });

  const [motion, setMotion] = useState<MotionData>({
    accX: 0,
    accY: 0,
    accZ: 0,
    gravityX: 0,
    gravityY: 0,
    gravityZ: 9.80665,
    totalG: 1.0,
    maxG: 1.0,
    minG: 1.0,
    rotRateAlpha: 0,
    rotRateBeta: 0,
    rotRateGamma: 0,
    interval: 16,
  });

  const [barometer, setBarometer] = useState<BarometerData>({
    pressureHpa: 1013.25,
    pressureInHg: 29.92,
    altitudeM: 42.0,
    altitudeFt: 137.8,
    relativeAltitudeM: 0,
    verticalSpeedMps: 0,
    verticalSpeedFpm: 0,
    seaLevelRefHpa: 1013.25,
    isHardwareNative: false,
    sensorStatus: 'estimating',
  });

  // App & Drone state
  const [cameraActive, setCameraActive] = useState(false);
  const [modelStatus, setModelStatus] = useState('model: loading…');
  const [humanIdEnabled, setHumanIdEnabled] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [lockedTrackId, setLockedTrackId] = useState<number | null>(null);
  const [activeSegment, setActiveSegment] = useState<'rgb' | 'thermal'>('rgb');
  const [isSimulated, setIsSimulated] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTargets, setActiveTargets] = useState<TrackedSARObject[]>([]);

  // Advanced Tracking & SAR Engine Controls
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('alpine-hiker');
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('normal');
  const [inferenceStats, setInferenceStats] = useState<{ fps: number; latencyMs: number; engine: string }>({
    fps: 24,
    latencyMs: 32,
    engine: 'neural-mobilenet',
  });

  // Telemetry values
  const [flightMode, setFlightMode] = useState('WP NAV');
  const [battery, setBattery] = useState({ pct: 82, volts: 15.8 });
  const [lora, setLora] = useState({ pct: 94, dbm: -78 });
  const [vtx, setVtx] = useState({ pct: 99, mw: 25 });
  const [distance, setDistance] = useState(342);
  const [altitudeM, setAltitudeM] = useState(42.0);
  const [groundSpeed, setGroundSpeed] = useState(18.4);
  const [gpsPos, setGpsPos] = useState({ lat: 19.0760, lon: 72.8777, sats: 11 });

  // Clock
  const [metSeconds, setMetSeconds] = useState(862);
  const [localTime, setLocalTime] = useState('');

  // Alert
  const [alert, setAlert] = useState<{ show: boolean; title: string; detail: string }>({
    show: false,
    title: 'Person detected',
    detail: 'awaiting detection',
  });

  // Mission Log
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, time: '00:00:00', type: 'info', msg: 'SAR Tracking Engine v3.2 active · IoU Kalman + Human Identification' },
    { id: 2, time: '00:00:04', type: 'info', msg: 'IMU calibrated · Gyro & Accelerometer streaming' },
    { id: 3, time: '00:00:12', type: 'info', msg: 'Barometric sensor locked · Initial reference QNH 1013.25 hPa' },
    { id: 4, time: '00:01:05', type: 'info', msg: 'Takeoff commanded — climbing to 4200 cm AGL' },
    { id: 5, time: '00:02:18', type: 'info', msg: 'Waypoint 1 reached · Search grid Alpha active' },
  ]);

  // Detection & Tracking refs
  const currentBoxesRef = useRef<TrackedSARObject[]>([]);
  const lastGeomRef = useRef<{ sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Simulated targets for fallback and testing
  const simTargetsRef = useRef<SimTargetDef[]>(
    JSON.parse(JSON.stringify(SIM_SCENARIOS['alpine-hiker'].targets))
  );

  // Audio tones
  const playAlertTone = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio context restricted
    }
  }, [soundEnabled]);

  const playLockTone = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.setValueAtTime(1450, now + 0.07);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }, [soundEnabled]);

  const playUnlockTone = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }, [soundEnabled]);

  const addLog = useCallback((type: 'info' | 'warn' | 'alert', msg: string) => {
    const s = metSeconds;
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const timeStr = `${hh}:${mm}:${ss}`;

    setLogs((prev) => [
      { id: Date.now() + Math.random(), time: timeStr, type, msg },
      ...prev.slice(0, 40),
    ]);
  }, [metSeconds]);

  // Initialize sensors, clocks, and neural detection engine
  useEffect(() => {
    sensorManager.start();
    const unsubOri = sensorManager.onOrientation(setOrientation);
    const unsubMot = sensorManager.onMotion(setMotion);
    const unsubBar = sensorManager.onBarometer((b) => {
      setBarometer(b);
      setAltitudeM(b.altitudeM);
    });

    setIsSimulated(sensorManager.getIsSimulated());

    // MET timer
    const metTimer = setInterval(() => {
      setMetSeconds((v) => v + 1);
    }, 1000);

    // Clock
    const clockTimer = setInterval(() => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      setLocalTime(`${h}:${m}:${s} IST`);
    }, 1000);

    // Jitter drone telemetry slightly
    const telemTimer = setInterval(() => {
      setBattery((b) => ({
        pct: Math.max(15, +(b.pct - 0.02).toFixed(1)),
        volts: +(14.8 + (b.pct / 100) * 1.8).toFixed(1),
      }));
      setGroundSpeed((s) => +(18.0 + (Math.sin(Date.now() / 3000) * 1.5)).toFixed(1));
      setDistance((d) => Math.round(340 + Math.sin(Date.now() / 5000) * 10));
    }, 1500);

    // Initialize detector engine (TensorFlow MobileNet-SSD with CV fallback)
    detectorEngine.init((status) => {
      setModelStatus(status);
      addLog('info', status);
    });

    return () => {
      unsubOri();
      unsubMot();
      unsubBar();
      clearInterval(metTimer);
      clearInterval(clockTimer);
      clearInterval(telemTimer);
      sensorManager.stop();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [addLog]);

  // Video cover geometry calculation
  const drawVideoCover = useCallback((ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number) => {
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 400;
    const vr = vw / vh;
    const cr = w / h;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (vr > cr) {
      sw = vh * cr;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / cr;
      sy = (vh - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    return { sx, sy, sw, sh, dx: 0, dy: 0, dw: w, dh: h };
  }, []);

  // Live bounding box renderer - tactical SAR HUD with breadcrumb trails and human identification
  const drawLiveBoxes = useCallback((ctx: CanvasRenderingContext2D, geom: any) => {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const t = Date.now() / 1000;

    // Center Crosshair
    ctx.strokeStyle = 'rgba(58, 214, 196, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 18);
    ctx.stroke();

    // Horizon bar tilted with roll and pitch
    const rollRad = (orientation.calibratedRoll * Math.PI) / 180;
    const pitchOffset = Math.max(-60, Math.min(60, orientation.calibratedPitch * 1.8));
    ctx.save();
    ctx.translate(cx, cy + pitchOffset);
    ctx.rotate(rollRad);
    ctx.strokeStyle = 'rgba(58, 214, 196, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(-70, 0); ctx.lineTo(-24, 0);
    ctx.moveTo(24, 0); ctx.lineTo(70, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Top center heading indicator
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(58, 214, 196, 0.75)';
    const hdgText = `HDG ${Math.round(orientation.calibratedYaw)}° [${
      orientation.calibratedYaw >= 315 || orientation.calibratedYaw < 45 ? 'N' :
      orientation.calibratedYaw < 135 ? 'E' :
      orientation.calibratedYaw < 225 ? 'S' : 'W'
    }]`;
    ctx.fillText(hdgText, cx - ctx.measureText(hdgText).width / 2, 18);

    // Render detected and tracked targets
    currentBoxesRef.current.forEach((b) => {
      const isLocked = lockedTrackId !== null && b.id === lockedTrackId;
      const isPerson = b.isPerson || b.cls === 'person';
      const isSurvivor = isPerson && humanIdEnabled;
      const isProne = b.posture === 'prone';

      // 1. Breadcrumb Motion History Trail
      if (trackingEnabled && b.history && b.history.length > 1) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < b.history.length; i++) {
          const pt = b.history[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = isLocked
          ? 'rgba(255, 90, 90, 0.35)'
          : isSurvivor
          ? 'rgba(245, 169, 63, 0.3)'
          : 'rgba(58, 214, 196, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.stroke();

        // History nodes
        for (let i = 0; i < b.history.length; i += 3) {
          const pt = b.history[i];
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = isSurvivor ? 'rgba(245, 169, 63, 0.4)' : 'rgba(58, 214, 196, 0.4)';
          ctx.fill();
        }
        ctx.restore();
      }

      const color = isLocked
        ? '#ff4d4d'
        : isProne
        ? '#ff6b6b'
        : isSurvivor
        ? '#f5a93f'
        : '#3ad6c4';

      // 2. If Locked: Connecting Lead-in Line & Tactical Lock Reticle
      if (isLocked) {
        // Dotted lead-in line from crosshair to target centroid
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 77, 77, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(b.cx, b.cy);
        ctx.stroke();

        // Range along lead line
        const midX = (cx + b.cx) / 2;
        const midY = (cy + b.cy) / 2;
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#ff8888';
        ctx.fillText(`RNG ${Math.round(b.estDistanceM || 24)}m`, midX + 4, midY - 4);
        ctx.restore();

        // Pulsating outer lock brackets
        const pulse = Math.sin(t * 8) * 3;
        const pad = 6 + pulse;
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 2;
        const lx = b.x - pad;
        const ly = b.y - pad;
        const lw = b.w + pad * 2;
        const lh = b.h + pad * 2;
        const corner = Math.min(14, lw / 3, lh / 3);

        ctx.beginPath();
        ctx.moveTo(lx, ly + corner); ctx.lineTo(lx, ly); ctx.lineTo(lx + corner, ly);
        ctx.moveTo(lx + lw - corner, ly); ctx.lineTo(lx + lw, ly); ctx.lineTo(lx + lw, ly + corner);
        ctx.moveTo(lx, ly + lh - corner); ctx.lineTo(lx, ly + lh); ctx.lineTo(lx + corner, ly + lh);
        ctx.moveTo(lx + lw - corner, ly + lh); ctx.lineTo(lx + lw, ly + lh); ctx.lineTo(lx + lw, ly + lh - corner);
        ctx.stroke();

        // Diamond Center Reticle
        ctx.save();
        ctx.translate(b.cx, b.cy);
        ctx.rotate(t * 1.5);
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 1.5;
        const dSize = 8;
        ctx.strokeRect(-dSize / 2, -dSize / 2, dSize, dSize);
        ctx.restore();
      }

      // 3. Main Bounding Box
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isLocked ? 2 : isProne ? 2 : isSurvivor ? 1.8 : 1.2;
      if (b.coasting) {
        ctx.setLineDash([4, 3]);
      }
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.restore();

      // Corner Brackets
      const s = Math.min(10, b.w / 4, b.h / 4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + s); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + s, b.y);
      ctx.moveTo(b.x + b.w - s, b.y); ctx.lineTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w, b.y + s);
      ctx.moveTo(b.x, b.y + b.h - s); ctx.lineTo(b.x, b.y + b.h); ctx.lineTo(b.x + s, b.y + b.h);
      ctx.moveTo(b.x + b.w - s, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h - s);
      ctx.stroke();

      // 4. Human Head / Posture Locator Zone (Top 22% of bounding box)
      if (isSurvivor && b.h > 40) {
        const headH = b.h * 0.22;
        ctx.save();
        ctx.strokeStyle = isProne ? 'rgba(255, 90, 90, 0.45)' : 'rgba(245, 169, 63, 0.45)';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(b.x + 3, b.y + 2, b.w - 6, headH);
        ctx.restore();
      }

      // 5. Velocity Motion Vector Arrow
      if (trackingEnabled && (b.vx !== 0 || b.vy !== 0)) {
        const vx = b.vx * 7;
        const vy = b.vy * 7;
        if (Math.hypot(vx, vy) > 2) {
          ctx.save();
          ctx.strokeStyle = isSurvivor ? 'rgba(245, 169, 63, 0.85)' : 'rgba(58, 214, 196, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(b.cx, b.cy);
          ctx.lineTo(b.cx + vx, b.cy + vy);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 6. Primary Label Banner
      let tag = '';
      if (isLocked) {
        tag = `🎯 LOCKED #${b.id} ${b.label || b.cls.toUpperCase()} [${Math.round(b.score * 100)}%]`;
      } else if (isProne) {
        tag = `🚨 SURVIVOR #${b.id} [PRONE / DOWNED] ${Math.round(b.score * 100)}%`;
      } else if (isSurvivor) {
        tag = `SURVIVOR #${b.id} [${(b.posture || 'standing').toUpperCase()}] ${Math.round(b.score * 100)}%`;
      } else {
        tag = `${(b.label || b.cls).toUpperCase()} #${b.id} ${Math.round(b.score * 100)}%`;
      }

      if (b.coasting) {
        tag += ' [COAST]';
      }

      ctx.font = '10px "IBM Plex Mono", monospace';
      const tw = ctx.measureText(tag).width;
      const tagY = Math.max(16, b.y);

      ctx.fillStyle = isProne ? 'rgba(35, 10, 10, 0.95)' : 'rgba(10, 13, 16, 0.9)';
      ctx.fillRect(b.x, tagY - 16, tw + 8, 16);
      ctx.strokeStyle = color;
      ctx.strokeRect(b.x, tagY - 16, tw + 8, 16);

      ctx.fillStyle = color;
      ctx.fillText(tag, b.x + 4, tagY - 4);

      // 7. SAR Telemetry Sub-Tag (Range, Bearing, Vitality)
      const subTag = `RNG: ${b.estDistanceM || Math.round(18 + (b.cy / h) * 28)}m · BRG: ${b.estBearingDeg || Math.round(orientation.calibratedYaw)}° · ACT: ${(b.vitality || 'active').toUpperCase()}`;
      ctx.font = '9px "IBM Plex Mono", monospace';
      const stw = ctx.measureText(subTag).width;
      ctx.fillStyle = 'rgba(10, 13, 16, 0.85)';
      ctx.fillRect(b.x, b.y + b.h + 2, stw + 8, 14);
      ctx.strokeStyle = isLocked ? '#ff4d4d' : 'rgba(58, 214, 196, 0.3)';
      ctx.strokeRect(b.x, b.y + b.h + 2, stw + 8, 14);
      ctx.fillStyle = isLocked ? '#ff9999' : 'var(--text-dim)';
      ctx.fillText(subTag, b.x + 4, b.y + b.h + 13);
    });
  }, [orientation, lockedTrackId, humanIdEnabled, trackingEnabled]);

  // Simulated scene with scenario kinematics and multi-target crossing
  const drawSimScene = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const t = Date.now() / 1000;
    ctx.fillStyle = '#060a0e';
    ctx.fillRect(0, 0, w, h);

    // Subtle terrain grid
    ctx.strokeStyle = 'rgba(33, 45, 55, 0.5)';
    ctx.lineWidth = 1;
    const gridSz = 32;
    const offY = (t * 15) % gridSz;
    for (let x = 0; x < w; x += gridSz) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = offY; y < h; y += gridSz) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Dynamic Radar Sweep Circle
    const sweepAngle = (t * 1.6) % (Math.PI * 2);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = 'rgba(58, 214, 196, 0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(sweepAngle) * 120, Math.sin(sweepAngle) * 120);
    ctx.stroke();
    ctx.restore();

    // 1. Update positions of simulated targets based on scenario kinematics
    const rawSimDets = updateSimulatedTargets(simTargetsRef.current, w, h);

    // 2. Feed through SAR tracking engine with IoU and Kalman smoothing
    const uavTelemetry = {
      altitudeM,
      headingDeg: orientation.calibratedYaw,
      lat: gpsPos.lat,
      lon: gpsPos.lon,
      viewWidth: w,
      viewHeight: h,
    };

    const tracked = trackingEngine.update(rawSimDets, uavTelemetry, humanIdEnabled);
    currentBoxesRef.current = tracked;

    // 3. Survivor & Emergency Priority Alert checks
    if (humanIdEnabled) {
      const proneSurvivor = tracked.find((b) => b.isPerson && b.posture === 'prone' && b.score >= 0.65);
      const activeSurvivor = tracked.find((b) => b.isPerson && b.score >= 0.65);

      const now = Date.now();
      if (proneSurvivor && now - lastAlertTimeRef.current > 9000) {
        lastAlertTimeRef.current = now;
        setAlert({
          show: true,
          title: 'CRITICAL: Downed Survivor Detected',
          detail: `Target #${proneSurvivor.id} in PRONE posture (immobile ${Math.round(proneSurvivor.stationaryDurationSec)}s) at ${proneSurvivor.estDistanceM}m`,
        });
        playAlertTone();
        addLog('alert', `EMERGENCY TRIAGE: Downed human subject #${proneSurvivor.id} detected! Posture: PRONE · Coords: ${proneSurvivor.estGpsLat}°N, ${proneSurvivor.estGpsLon}°E`);
      } else if (activeSurvivor && now - lastAlertTimeRef.current > 14000) {
        lastAlertTimeRef.current = now;
        setAlert({
          show: true,
          title: 'Survivor identified',
          detail: `Person target #${activeSurvivor.id} [${(activeSurvivor.posture || 'standing').toUpperCase()}] at range ${activeSurvivor.estDistanceM}m`,
        });
        playAlertTone();
        addLog('alert', `SURVIVOR IDENTIFIED: Target #${activeSurvivor.id} [${activeSurvivor.posture.toUpperCase()}] at RNG ${activeSurvivor.estDistanceM}m, BRG ${activeSurvivor.estBearingDeg}°`);
      }
    }

    drawLiveBoxes(ctx, null);
  }, [altitudeM, orientation.calibratedYaw, gpsPos, humanIdEnabled, drawLiveBoxes, playAlertTone, addLog]);

  // Main Render Loop (60 FPS with motion dead reckoning)
  useEffect(() => {
    let animId: number;
    let lastTableSync = 0;

    const render = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // 60 FPS motion interpolation between detector runs (eliminates stutter)
      if (trackingEnabled) {
        trackingEngine.stepAnimation(0.016);
      }

      if (cameraActive && video && video.readyState >= 2) {
        const geom = drawVideoCover(ctx, video, w, h);
        if (geom) {
          lastGeomRef.current = geom;
          drawLiveBoxes(ctx, geom);
        }
      } else {
        drawSimScene(ctx, w, h);
      }

      // Sync active targets state to UI table smoothly at ~10Hz
      const now = Date.now();
      if (now - lastTableSync > 100) {
        lastTableSync = now;
        setActiveTargets([...currentBoxesRef.current]);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [cameraActive, drawVideoCover, drawLiveBoxes, drawSimScene, trackingEnabled]);

  // High-Precision Detection loop for real camera feed
  useEffect(() => {
    if (!cameraActive) return;
    let active = true;

    const detect = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const geom = lastGeomRef.current;

      if (video && video.readyState >= 2 && canvas && geom) {
        try {
          const res = await detectorEngine.detect(video, geom, canvas.width, canvas.height);
          if (!active) return;

          setInferenceStats({
            fps: 24,
            latencyMs: res.inferenceTimeMs,
            engine: res.engineType,
          });

          // Feed into SAR tracking engine
          const uavTelemetry = {
            altitudeM,
            headingDeg: orientation.calibratedYaw,
            lat: gpsPos.lat,
            lon: gpsPos.lon,
            viewWidth: canvas.width,
            viewHeight: canvas.height,
          };

          const tracked = trackingEngine.update(res.detections, uavTelemetry, humanIdEnabled);
          currentBoxesRef.current = tracked;

          // Survivor Identification & Emergency check
          if (humanIdEnabled) {
            const proneSurvivor = tracked.find((b) => b.isPerson && b.posture === 'prone' && b.score >= 0.6);
            const activeSurvivor = tracked.find((b) => b.isPerson && b.score >= 0.65);

            const now = Date.now();
            if (proneSurvivor && now - lastAlertTimeRef.current > 7000) {
              lastAlertTimeRef.current = now;
              setAlert({
                show: true,
                title: 'CRITICAL: Downed Survivor Detected',
                detail: `Person target #${proneSurvivor.id} in PRONE posture at ${proneSurvivor.estDistanceM}m`,
              });
              playAlertTone();
              addLog('alert', `EMERGENCY TRIAGE: Downed survivor #${proneSurvivor.id} detected! Posture: PRONE · Range: ${proneSurvivor.estDistanceM}m`);
            } else if (activeSurvivor && now - lastAlertTimeRef.current > 8000) {
              lastAlertTimeRef.current = now;
              setAlert({
                show: true,
                title: 'Survivor identified',
                detail: `Person target #${activeSurvivor.id} [${activeSurvivor.posture.toUpperCase()}] in camera feed`,
              });
              playAlertTone();
              addLog('alert', `SURVIVOR IDENTIFIED: Target #${activeSurvivor.id} [${activeSurvivor.posture.toUpperCase()}] · Range: ${activeSurvivor.estDistanceM}m`);
            }
          }
        } catch {
          // Ignore transient inference dropouts
        }
      }

      if (active) {
        setTimeout(detect, 90);
      }
    };

    detect();
    return () => {
      active = false;
    };
  }, [cameraActive, playAlertTone, addLog, humanIdEnabled, altitudeM, orientation.calibratedYaw, gpsPos]);

  // Click on Canvas to toggle target lock directly
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check if click is inside any detected target box (with generous 8px margin)
    const hit = currentBoxesRef.current.find((b) => {
      const pad = 10;
      return (
        clickX >= b.x - pad &&
        clickX <= b.x + b.w + pad &&
        clickY >= b.y - pad &&
        clickY <= b.y + b.h + pad
      );
    });

    if (hit && hit.id !== undefined) {
      if (lockedTrackId === hit.id) {
        setLockedTrackId(null);
        playUnlockTone();
        addLog('info', `Target #${hit.id} lock released by operator`);
      } else {
        setLockedTrackId(hit.id);
        playLockTone();
        const targetLabel = (hit.label || hit.cls).toUpperCase();
        addLog('warn', `TARGET #${hit.id} [${targetLabel}] LOCKED (Operator canvas selection)`);
      }
    } else {
      // Clicked on blank space: release target lock if one was active
      if (lockedTrackId !== null) {
        setLockedTrackId(null);
        playUnlockTone();
        addLog('info', 'Target lock cleared (Operator canvas click)');
      }
    }
  };

  // Lock specific target from table
  const handleLockTarget = (id: number) => {
    if (lockedTrackId === id) {
      setLockedTrackId(null);
      playUnlockTone();
      addLog('info', `Target #${id} lock released`);
    } else {
      setLockedTrackId(id);
      playLockTone();
      const target = currentBoxesRef.current.find((b) => b.id === id);
      const label = target ? (target.label || target.cls).toUpperCase() : 'TARGET';
      addLog('warn', `OPERATOR LOCK-ON: Target #${id} [${label}] locked`);
    }
  };

  // Lock nearest person / survivor
  const handleLockNearestSurvivor = () => {
    const survivor = currentBoxesRef.current.find((b) => b.cls === 'person');
    if (survivor && survivor.id !== undefined) {
      setLockedTrackId(survivor.id);
      playLockTone();
      addLog('warn', `OPERATOR AUTO-LOCK: Survivor #${survivor.id} (conf ${(survivor.score * 100).toFixed(0)}%) locked`);
    } else if (currentBoxesRef.current.length > 0 && currentBoxesRef.current[0].id !== undefined) {
      const primary = currentBoxesRef.current[0];
      setLockedTrackId(primary.id);
      playLockTone();
      addLog('warn', `OPERATOR AUTO-LOCK: Primary target #${primary.id} locked`);
    } else {
      addLog('warn', 'Auto-lock: No active targets detected in camera view');
    }
  };

  // Scenario and Sensitivity selection handlers
  const handleSelectScenario = (sc: ScenarioType) => {
    setSelectedScenario(sc);
    simTargetsRef.current = JSON.parse(JSON.stringify(SIM_SCENARIOS[sc].targets));
    trackingEngine.clear();
    setLockedTrackId(null);
    addLog('info', `Switched SAR scenario: [${SIM_SCENARIOS[sc].title}] — ${SIM_SCENARIOS[sc].desc}`);
  };

  const handleSelectSensitivity = (sens: SensitivityLevel) => {
    setSensitivity(sens);
    detectorEngine.setSensitivity(sens);
    addLog('info', `Detector threshold updated to ${sens.toUpperCase()} (min conf: ${(detectorEngine.getConfidenceThreshold() * 100).toFixed(0)}%)`);
  };

  // Spawn test target in simulation for instant verification
  const handleSpawnTarget = () => {
    const templates: Array<{
      cls: string;
      label: string;
      w: number;
      h: number;
      type: 'standing' | 'prone' | 'crouched' | 'gear' | 'vehicle';
      behavior: 'patrol' | 'downed' | 'meander' | 'linear';
    }> = [
      { cls: 'person', label: 'SURVIVOR-BRAVO', w: 70, h: 140, type: 'standing', behavior: 'patrol' },
      { cls: 'person', label: 'DOWNED-HIKER', w: 125, h: 55, type: 'prone', behavior: 'downed' },
      { cls: 'backpack', label: 'FIRST-AID-KIT', w: 48, h: 46, type: 'gear', behavior: 'meander' },
      { cls: 'bicycle', label: 'SURVIVOR-BIKE', w: 80, h: 60, type: 'vehicle', behavior: 'patrol' },
      { cls: 'bottle', label: 'RATION-PACK', w: 38, h: 42, type: 'gear', behavior: 'linear' },
    ];
    const picked = templates[Math.floor(Math.random() * templates.length)];
    const newTarget: SimTargetDef = {
      x: 60 + Math.random() * 480,
      y: 60 + Math.random() * 240,
      w: picked.w,
      h: picked.h,
      cls: picked.cls,
      score: +(0.85 + Math.random() * 0.12).toFixed(2),
      label: picked.label,
      vx: +(Math.random() * 0.8 - 0.4).toFixed(2),
      vy: +(Math.random() * 0.8 - 0.4).toFixed(2),
      type: picked.type,
      behavior: picked.behavior,
    };
    simTargetsRef.current.push(newTarget);
    addLog('info', `Spawned test simulated ${picked.label} target in search sector`);
  };

  // Enable camera button handler
  const handleEnableCamera = async () => {
    try {
      // Also request phone sensor permissions if iOS
      sensorManager.requestPermissions();
      sensorManager.start();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        addLog('info', 'IMX219 sensor feed active — camera streaming 1280x720');
      }
    } catch (err: any) {
      alertFallbackCamera(err.message || 'Camera permission denied');
    }
  };

  const alertFallbackCamera = (msg: string) => {
    addLog('warn', `Webcam access unavailable (${msg}) — running high-accuracy simulation`);
  };

  const handleAcknowledgeAlert = () => {
    setAlert((a) => ({ ...a, show: false }));
    addLog('info', 'Operator acknowledged alert banner');
  };

  // Tare button handler
  const handleTare = () => {
    sensorManager.tareZero();
    addLog('info', 'IMU Attitude & Barometer relative zero point calibrated');
  };

  // Convert acceleration to 'g' (1 g = 9.80665 m/s^2)
  const ax_g = (motion.accX / 9.80665).toFixed(2);
  const ay_g = (motion.accY / 9.80665).toFixed(2);
  const az_g = (motion.accZ / 9.80665).toFixed(2);
  const totalG_str = motion.totalG.toFixed(2);
  const maxG_str = motion.maxG.toFixed(2);

  // Barometer altitude in 'cm' (1 m = 100 cm)
  const alt_cm = Math.round(altitudeM * 100);
  const rel_alt_cm = Math.round(barometer.relativeAltitudeM * 100);
  const vsi_cms = Math.round(barometer.verticalSpeedMps * 100);

  // Formatted MET
  const metH = String(Math.floor(metSeconds / 3600)).padStart(2, '0');
  const metM = String(Math.floor((metSeconds % 3600) / 60)).padStart(2, '0');
  const metS = String(metSeconds % 60).padStart(2, '0');

  // Gyro values
  const pitchVal = orientation.calibratedPitch.toFixed(1);
  const rollVal = orientation.calibratedRoll.toFixed(1);
  const yawVal = orientation.calibratedYaw.toFixed(1);
  const rotRateVal = Math.sqrt(
    motion.rotRateAlpha ** 2 + motion.rotRateBeta ** 2 + motion.rotRateGamma ** 2
  ).toFixed(1);

  // Roll bubble offset percentage (clamped 0 to 100%, 50% is level)
  const bubblePct = Math.min(92, Math.max(8, 50 + orientation.calibratedRoll * 1.5));

  return (
    <div className="shell">
      {/* TOPBAR */}
      <div className="topbar" id="topbar">
        <div className="topbar-left">
          <div className="link-dot"></div>
          <div>
            <div className="topbar-title">SAR-UAV Ground Control</div>
            <div className="topbar-sub">Unit SIH26-01 — demo console</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="clock-block">
            <span className="clock-label">MISSION ELAPSED</span>
            <span className="clock-value" id="metClock">{`${metH}:${metM}:${metS}`}</span>
          </div>
          <div className="clock-block">
            <span className="clock-label">LOCAL</span>
            <span className="clock-value" id="localClock">{localTime || '14:32:05 IST'}</span>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="layout">
        {/* FEED PANEL */}
        <div className="panel feed-panel" id="feedPanel">
          <div className="panel-head">
            <span className="panel-title">Onboard camera</span>
            <span className="panel-hint">Pi Zero 2W · IMX219</span>
          </div>

          <div className="feed-frame" id="feedFrame">
            {/* ALERT BANNER */}
            <div className={`alert-banner ${alert.show ? 'show' : ''}`} id="alertBanner">
              <span className="alert-banner-text">
                <b id="alertBannerTitle">{alert.title}</b> — <span id="alertDetail">{alert.detail}</span>
              </span>
              <button id="ackBtn" onClick={handleAcknowledgeAlert}>Acknowledge</button>
            </div>

            {/* VIDEO & CANVAS */}
            <video ref={videoRef} id="camVideo" autoPlay muted playsInline style={{ display: 'none' }} />
            <canvas
              ref={canvasRef}
              id="feedCanvas"
              width={640}
              height={400}
              onClick={handleCanvasClick}
              style={{ cursor: 'crosshair' }}
              title="Click on any target box to lock or unlock tracking"
            />

            {/* CAMERA GATE OVERLAY (WHEN INACTIVE) */}
            {!cameraActive && (
              <div className="cam-gate" id="camGate">
                <button className="cam-btn" id="camBtn" onClick={handleEnableCamera}>
                  Enable camera — run live detection & sensor HUD
                </button>
                <div className="cam-gate-note" id="camGateNote">
                  Uses your camera and phone sensors (gyroscope, accelerometer in g, barometer in cm) to demo the SAR edge detection pipeline. Runs entirely in your browser.
                </div>
              </div>
            )}

            {/* CLEAN VIDEO OSD BADGES */}
            <div className="osd-top-left" id="recLabel">
              <div className="rec-badge">
                <div className={`rec-dot ${cameraActive ? 'live' : ''}`}></div>
                <span>{cameraActive ? 'LIVE CAM' : 'SIM FEED'}</span>
                <span style={{ color: 'var(--teal-dim)', marginLeft: 4 }}>· 24 FPS</span>
              </div>
              <div className="osd-chip">
                <span>MODE:</span>
                <b style={{ color: 'var(--teal)' }}>{flightMode}</b>
              </div>
            </div>

            <div className="osd-top-right">
              <div className={`osd-chip ${lockedTrackId !== null ? 'locked' : ''}`} id="osdLockStatus">
                <Target size={12} />
                <span>
                  {lockedTrackId !== null
                    ? `TARGET LOCKED #${lockedTrackId}`
                    : trackingEnabled
                    ? `TRACKING (${currentBoxesRef.current.length})`
                    : 'UNLOCKED'}
                </span>
              </div>
            </div>

            {/* CORNER BRACKETS */}
            <div className="bracket tl"></div>
            <div className="bracket tr"></div>
            <div className="bracket bl"></div>
            <div className="bracket br"></div>

            {/* MINIMAL BOTTOM BAR: TIMESTAMP & ALTITUDE TAG IN cm */}
            <div className="osd-bottom-bar">
              <div className="osd-bottom-tag" id="feedTs">
                {localTime.split(' ')[0] || '--:--:--'}
              </div>
              <div className="osd-bottom-tag" id="feedAltTag" style={{ color: 'var(--teal)' }}>
                ALT {alt_cm.toLocaleString()} cm ({altitudeM.toFixed(1)} m)
              </div>
            </div>
          </div>

          {/* ACTION TOOLBAR & STREAM SELECT */}
          <div className="feed-toolbar" id="feedToolbar">
            <div className="segmented" id="streamSelect">
              <button
                className={`seg-btn ${activeSegment === 'rgb' ? 'active' : ''}`}
                onClick={() => setActiveSegment('rgb')}
              >
                RGB stream (active)
              </button>
              <button
                className={`seg-btn ${activeSegment === 'thermal' ? 'active' : ''}`}
                onClick={() => setActiveSegment('thermal')}
                disabled
                title="Thermal FLIR payload planned for phase 2 flight hardware"
              >
                Thermal FLIR (phase 2)
              </button>
            </div>

            <div className="feed-action-buttons">
              <button
                className="action-btn"
                id="lockSurvivorBtn"
                onClick={handleLockNearestSurvivor}
                title="Automatically acquire and lock onto the nearest survivor"
              >
                <Target size={13} />
                <span>Lock Survivor</span>
              </button>

              {!cameraActive && (
                <button
                  className="action-btn"
                  id="spawnTargetBtn"
                  onClick={handleSpawnTarget}
                  title="Spawn a new simulated survivor or gear item to test tracking"
                >
                  <PlusCircle size={13} />
                  <span>Spawn Target</span>
                </button>
              )}

              {lockedTrackId !== null && (
                <button
                  className="action-btn danger"
                  id="unlockBtn"
                  onClick={() => {
                    setLockedTrackId(null);
                    playUnlockTone();
                    addLog('info', 'Target lock released');
                  }}
                  title="Release target lock"
                >
                  Clear Lock (#{lockedTrackId})
                </button>
              )}

              <button
                className="action-btn icon-only"
                id="soundToggleBtn"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Audio alerts enabled (click to mute)' : 'Audio alerts muted (click to enable)'}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} style={{ color: 'var(--danger)' }} />}
              </button>
            </div>
          </div>

          {/* =========================================================================
              SENSOR INSTRUMENT DECK: CONTINUOUS LIVE READINGS IN g AND cm (BELOW VIDEO)
             ========================================================================= */}
          <div className="sensor-deck" id="sensorDeck">
            {/* CARD 1: ACCELEROMETER TELEMETRY IN g */}
            <div className="sensor-card" id="sensorCardAccel">
              <div className="sensor-card-head">
                <span className="sensor-card-title">Accelerometer load</span>
                <span className="sensor-card-badge">LIVE · g</span>
              </div>
              <div className="sensor-card-big">
                <span>{totalG_str}</span>
                <span className="sensor-card-unit">g</span>
              </div>
              <div className="sensor-meter-track">
                <div
                  className={`sensor-meter-bar ${motion.totalG > 1.8 ? 'danger' : motion.totalG > 1.3 ? 'warn' : ''}`}
                  style={{ width: `${Math.min(100, (motion.totalG / 2.5) * 100)}%` }}
                />
              </div>
              <div className="sensor-sub-grid">
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">Ax</span>
                  <b className="sensor-sub-v">{ax_g} g</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">Ay</span>
                  <b className="sensor-sub-v">{ay_g} g</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">Az</span>
                  <b className="sensor-sub-v">{az_g} g</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">Peak</span>
                  <b className="sensor-sub-v" style={{ color: 'var(--amber)' }}>{maxG_str} g</b>
                </div>
              </div>
            </div>

            {/* CARD 2: BAROMETER ALTITUDE IN cm */}
            <div className="sensor-card" id="sensorCardBaro">
              <div className="sensor-card-head">
                <span className="sensor-card-title">Barometer altitude</span>
                <span className="sensor-card-badge">LIVE · cm</span>
              </div>
              <div className="sensor-card-big">
                <span>{alt_cm.toLocaleString()}</span>
                <span className="sensor-card-unit">cm</span>
              </div>
              <div className="sensor-meter-track">
                <div
                  className="sensor-meter-bar"
                  style={{ width: `${Math.min(100, (alt_cm / 8000) * 100)}%` }}
                />
              </div>
              <div className="sensor-sub-grid">
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">ΔRel</span>
                  <b className="sensor-sub-v">{rel_alt_cm >= 0 ? `+${rel_alt_cm}` : rel_alt_cm} cm</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">VSI</span>
                  <b className="sensor-sub-v">{vsi_cms >= 0 ? `+${vsi_cms}` : vsi_cms} cm/s</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">QNH</span>
                  <b className="sensor-sub-v">{barometer.pressureHpa.toFixed(1)} hPa</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">AGL</span>
                  <b className="sensor-sub-v" style={{ color: 'var(--teal)' }}>{altitudeM.toFixed(1)} m</b>
                </div>
              </div>
            </div>

            {/* CARD 3: GYROSCOPE ATTITUDE & RATES */}
            <div className="sensor-card" id="sensorCardGyro">
              <div className="sensor-card-head">
                <span className="sensor-card-title">Gyroscope attitude</span>
                <span className="sensor-card-badge">3-AXIS</span>
              </div>
              <div className="sensor-sub-grid" style={{ marginBottom: 6 }}>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">Pitch</span>
                  <b className="sensor-sub-v">{pitchVal >= 0 ? `+${pitchVal}` : pitchVal}°</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">Roll</span>
                  <b className="sensor-sub-v">{rollVal >= 0 ? `+${rollVal}` : rollVal}°</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">Heading</span>
                  <b className="sensor-sub-v">{Math.round(orientation.calibratedYaw)}°</b>
                </div>
                <div className="sensor-sub-item">
                  <span className="sensor-sub-k">Rate</span>
                  <b className="sensor-sub-v">{rotRateVal}°/s</b>
                </div>
              </div>

              {/* Dynamic Level Bubble */}
              <div className="gyro-level-track" title="Attitude Level Bubble (horizontal plane)">
                <div className="gyro-level-bubble" style={{ left: `${bubblePct}%` }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {orientation.calibratedYaw >= 315 || orientation.calibratedYaw < 45 ? 'NORTH' :
                   orientation.calibratedYaw < 135 ? 'EAST' :
                   orientation.calibratedYaw < 225 ? 'SOUTH' : 'WEST'} quadrant
                </span>
                <button
                  className="edge-hud-tare-btn"
                  id="tareZeroBtn"
                  onClick={handleTare}
                  title="Tare/Calibrate gyro pitch/roll to 0° and reset relative cm altitude"
                >
                  <RotateCcw size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  TARE ZERO
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================================
              ACTIVE DETECTED TARGETS & ADVANCED SAR TRACKING CONSOLE
             ========================================================================= */}
          <div className="targets-panel" id="targetsPanel">
            <div className="targets-panel-head">
              <div className="targets-panel-title">
                <Target size={14} style={{ color: 'var(--teal)' }} />
                <span>Active detected targets ({activeTargets.length})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="engine-stats-tag">
                  {inferenceStats.engine === 'neural-mobilenet' ? 'NEURAL SSD-v2' : 'CV OPTICAL FLOW'} · {inferenceStats.fps} FPS · {inferenceStats.latencyMs}ms
                </span>
                <span className="targets-panel-badge">
                  {trackingEnabled ? 'KALMAN TRACKING ACTIVE' : 'INSTANTANEOUS FRAMES'}
                </span>
              </div>
            </div>

            {/* SCENARIO & SENSITIVITY TOOLBAR */}
            <div className="scenario-toolbar">
              <div className="scenario-toolbar-group">
                <span className="scenario-toolbar-label">
                  <Layers size={11} />
                  Scenario:
                </span>
                <div className="scenario-pills">
                  {(Object.keys(SIM_SCENARIOS) as ScenarioType[]).map((key) => {
                    const sc = SIM_SCENARIOS[key];
                    const isActive = selectedScenario === key;
                    return (
                      <button
                        key={key}
                        className={`scenario-pill ${isActive ? 'active' : ''}`}
                        onClick={() => handleSelectScenario(key)}
                        title={sc.desc}
                      >
                        {sc.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="scenario-toolbar-group">
                <span className="scenario-toolbar-label">
                  <Sliders size={11} />
                  Sensitivity:
                </span>
                <div className="scenario-pills">
                  {(['high', 'normal', 'strict'] as SensitivityLevel[]).map((level) => {
                    const isActive = sensitivity === level;
                    return (
                      <button
                        key={level}
                        className={`scenario-pill ${isActive ? 'active' : ''}`}
                        onClick={() => handleSelectSensitivity(level)}
                      >
                        {level.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {activeTargets.length === 0 ? (
              <div className="targets-empty">
                No active targets in visual sector. Camera feed is scanning...
              </div>
            ) : (
              <div className="targets-table-wrapper">
                <table className="targets-table">
                  <thead>
                    <tr>
                      <th>Track ID</th>
                      <th>Object Type & Posture</th>
                      <th>Confidence</th>
                      <th>Kinematics & Vitality</th>
                      <th>SAR Distance & Bearing</th>
                      <th style={{ textAlign: 'right' }}>Target Lock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTargets.map((tgt) => {
                      const isLocked = lockedTrackId === tgt.id;
                      const isPerson = tgt.isPerson || tgt.cls === 'person';
                      const isSurvivor = isPerson && humanIdEnabled;
                      const isProne = tgt.posture === 'prone';
                      const speed = Math.hypot(tgt.vx, tgt.vy) * 2.5;

                      return (
                        <tr key={tgt.id || tgt.cls} className={isLocked ? 'row-locked' : isProne ? 'row-prone' : ''}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="target-id-badge">#{tgt.id || '--'}</span>
                              {tgt.coasting && <span className="target-coast-badge">COAST</span>}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {isSurvivor ? (
                                <span className={`target-class-badge ${isProne ? 'downed' : 'survivor'}`}>
                                  <UserCheck size={11} />
                                  {isProne ? 'DOWNED SURVIVOR' : 'SURVIVOR'}
                                </span>
                              ) : (
                                <span className="target-class-badge">
                                  {(tgt.label || tgt.cls).toUpperCase()}
                                </span>
                              )}
                              <span className={`posture-tag ${tgt.posture || 'standing'}`}>
                                {(tgt.posture || 'standing').toUpperCase()}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="target-conf-cell">
                              <span>{(tgt.score * 100).toFixed(0)}%</span>
                              <div className="target-conf-mini-bar">
                                <div
                                  className="target-conf-mini-fill"
                                  style={{
                                    width: `${tgt.score * 100}%`,
                                    background: isLocked ? 'var(--coral)' : isSurvivor ? 'var(--amber)' : 'var(--teal)',
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: speed < 0.2 ? 'var(--amber)' : 'var(--teal)' }}>
                                {speed < 0.2 ? `STATIONARY (${Math.round(tgt.stationaryDurationSec)}s)` : `MOVING ${speed.toFixed(1)} m/s`}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                              <b style={{ color: 'var(--text)' }}>{tgt.estDistanceM}m</b> · {tgt.estBearingDeg}°
                              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                                {tgt.estGpsLat}°N, {tgt.estGpsLon}°E
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className={`lock-action-btn ${isLocked ? 'active' : ''}`}
                              onClick={() => tgt.id !== undefined && handleLockTarget(tgt.id)}
                            >
                              {isLocked ? 'Release' : 'Lock On'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="targets-hint">
              💡 Tip: Click directly on any bounding box in the video above to instantly lock or release target tracking.
            </div>
          </div>
        </div>

        {/* TELEMETRY PANEL */}
        <div className="panel telemetry-panel" id="telemetryPanel">
          <div className="panel-head">
            <span className="panel-title">Telemetry · RF link</span>
            <span className="flightmode-badge" id="flightMode">{flightMode}</span>
          </div>

          <div className="metric">
            <div className="metric-top">
              <span className="metric-label">Battery 4S LiPo</span>
              <span className="metric-value" id="batValue">
                {battery.pct}% <span className="metric-unit">({battery.volts}V)</span>
              </span>
            </div>
            <div className="meter">
              <div
                className={`meter-fill ${battery.pct < 25 ? 'danger' : battery.pct < 50 ? 'warn' : ''}`}
                id="batMeter"
                style={{ width: `${battery.pct}%` }}
              />
            </div>
          </div>

          <div className="metric">
            <div className="metric-top">
              <span className="metric-label">Telemetry link (LoRa 433)</span>
              <span className="metric-value" id="loraValue">
                {lora.pct}% <span className="metric-unit">({lora.dbm} dBm)</span>
              </span>
            </div>
            <div className="meter">
              <div className="meter-fill" id="loraMeter" style={{ width: `${lora.pct}%` }} />
            </div>
          </div>

          <div className="metric">
            <div className="metric-top">
              <span className="metric-label">Video link (5.8GHz)</span>
              <span className="metric-value" id="vtxValue">
                {vtx.pct}% <span className="metric-unit">({vtx.mw}mW)</span>
              </span>
            </div>
            <div className="meter">
              <div className="meter-fill" id="vtxMeter" style={{ width: `${vtx.pct}%` }} />
            </div>
          </div>

          <div className="metric">
            <div className="metric-top">
              <span className="metric-label">Distance from op</span>
              <span className="metric-value" id="distValue">
                {distance} <span className="metric-unit">m</span>
              </span>
            </div>
          </div>

          {/* SENSOR VALUES IN g AND cm */}
          <div className="metric">
            <div className="metric-top">
              <span className="metric-label">Baro Altitude AGL</span>
              <span className="metric-value" id="altValue">
                {alt_cm.toLocaleString()} <span className="metric-unit">cm ({altitudeM.toFixed(1)} m)</span>
              </span>
            </div>
          </div>

          <div className="metric">
            <div className="metric-top">
              <span className="metric-label">Accelerometer Load</span>
              <span className="metric-value" id="accelValue">
                {totalG_str} <span className="metric-unit">g (max {maxG_str} g)</span>
              </span>
            </div>
          </div>

          <div className="metric">
            <div className="metric-top">
              <span className="metric-label">Ground speed</span>
              <span className="metric-value" id="speedValue">
                {groundSpeed} <span className="metric-unit">km/h</span>
              </span>
            </div>
          </div>

          <div className="metric">
            <div className="metric-top">
              <span className="metric-label">GPS position</span>
              <span className="metric-value" id="gpsValue" style={{ fontSize: 12 }}>
                {gpsPos.lat.toFixed(4)}° N, {gpsPos.lon.toFixed(4)}° E <span className="metric-unit">· {gpsPos.sats} sats</span>
              </span>
            </div>
          </div>
        </div>

        {/* CONTROL PANEL */}
        <div className="panel control-panel" id="controlPanel">
          <div className="panel-head">
            <span className="panel-title">Payload & flight control</span>
            <span className="panel-hint">Manual override</span>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">Human identification</div>
              <div className="toggle-sub">Trigger alert and log when person class &gt; 65% conf</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                id="humanIdToggle"
                checked={humanIdEnabled}
                onChange={(e) => {
                  setHumanIdEnabled(e.target.checked);
                  addLog('info', `Human identification pipeline ${e.target.checked ? 'ENABLED' : 'DISABLED'}`);
                }}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">Object tracking</div>
              <div className="toggle-sub">Assign persistent track IDs and smooth bounding boxes</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                id="trackingToggle"
                checked={trackingEnabled}
                onChange={(e) => {
                  setTrackingEnabled(e.target.checked);
                  addLog('info', `Kalman track smoothing ${e.target.checked ? 'ENABLED' : 'DISABLED'}`);
                }}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">Target lock</div>
              <div className="toggle-sub" id="lockStatus">
                {lockedTrackId !== null ? `Locked on target #${lockedTrackId}` : 'No target locked'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {lockedTrackId === null ? (
                <button
                  className="mini-btn"
                  id="lockSurvivorMiniBtn"
                  onClick={handleLockNearestSurvivor}
                  title="Lock onto nearest survivor in view"
                >
                  Acquire
                </button>
              ) : (
                <button
                  className="mini-btn"
                  id="clearLockBtn"
                  style={{ color: 'var(--danger)', borderColor: 'rgba(255, 77, 77, 0.4)' }}
                  onClick={() => {
                    setLockedTrackId(null);
                    playUnlockTone();
                    addLog('info', 'Target lock released by operator');
                  }}
                >
                  Release
                </button>
              )}
            </div>
          </div>

          <div className="section-label">Flight commands</div>
          <div className="cmd-buttons">
            <button
              className="cmd-btn"
              id="cmdHold"
              onClick={() => {
                setFlightMode('LOITER');
                addLog('warn', 'Flight mode changed to LOITER (holding position)');
              }}
            >
              Hold position
            </button>
            <button
              className="cmd-btn danger"
              id="cmdRtl"
              onClick={() => {
                setFlightMode('RTL');
                addLog('warn', 'Return-to-launch (RTL) initiated');
              }}
            >
              Return to launch
            </button>
            <button
              className="cmd-btn"
              id="cmdResume"
              style={{ gridColumn: '1 / -1' }}
              onClick={() => {
                setFlightMode('WP NAV');
                addLog('info', 'Resuming autonomous search pattern (WP NAV)');
              }}
            >
              Resume search
            </button>
          </div>
        </div>

        {/* MISSION LOG */}
        <div className="panel log-panel" id="logPanel">
          <div className="panel-head">
            <span className="panel-title">Mission event log</span>
            <span className="panel-hint">Newest first · auto-scroll</span>
          </div>
          <div className="log-list" id="logList">
            {logs.map((item) => (
              <div className="log-item" key={item.id}>
                <span className="log-time">{item.time}</span>
                <span className={`log-type ${item.type}`}></span>
                <span className="log-msg">{item.msg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ABOUT TAXONOMY CARD */}
        <div className="about-card">
          <div className="about-title">About the object taxonomy</div>
          <div className="about-body">
            <p>The onboard classifier detects 6 key classes critical to SAR: <b>Person</b> (primary survivor target), <b>Bicycle</b> (mobility trace), <b>Vehicle</b> (evacuation/access marker), <b>Backpack/handbag</b> (lost gear / personal effects indicator), <b>Bottle</b> (water source / hydration check), and <b>Phone/electronics</b> (signaling devices). Real phone telemetry from gyroscope, accelerometer (in <b>g</b>), and barometer (in <b>cm</b>) stream continuously onto the camera edge HUD for orientation and altitude stabilization.</p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <span>SIH2026 prototype dashboard — telemetry and detections are running live on client.</span>
        <span className="tag">HARDWARE: RASPBERRY PI ZERO 2W + IMX219 · GYRO / ACCEL (g) · BARO (cm)</span>
      </footer>
    </div>
  );
}

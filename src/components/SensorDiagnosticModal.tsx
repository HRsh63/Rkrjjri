import React from 'react';
import { X, CheckCircle2, AlertTriangle, Smartphone, Compass, Activity, Mountain, ShieldCheck, Palette, RotateCcw } from 'lucide-react';
import { OrientationData, MotionData, BarometerData, GpsData, HudTheme } from '../types';
import { ThemeColors, HUD_THEMES } from '../utils/theme';
import { sensorManager } from '../utils/sensorManager';

interface SensorDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  orientation: OrientationData;
  motion: MotionData;
  barometer: BarometerData;
  gps: GpsData;
  currentTheme: HudTheme;
  onSelectTheme: (theme: HudTheme) => void;
  theme: ThemeColors;
  isSimulated: boolean;
  onToggleSimulated: () => void;
  showHorizonLadder: boolean;
  onToggleHorizonLadder: () => void;
}

export const SensorDiagnosticModal: React.FC<SensorDiagnosticModalProps> = ({
  isOpen,
  onClose,
  orientation,
  motion,
  barometer,
  gps,
  currentTheme,
  onSelectTheme,
  theme,
  isSimulated,
  onToggleSimulated,
  showHorizonLadder,
  onToggleHorizonLadder,
}) => {
  if (!isOpen) return null;

  const handleRequestPermissions = async () => {
    await sensorManager.requestPermissions();
    sensorManager.start();
  };

  const handleQnhChange = (val: number) => {
    sensorManager.setQnh(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div
        className="w-full max-w-2xl rounded-xl border shadow-2xl p-4 sm:p-6 my-auto text-slate-100 font-mono"
        style={{
          borderColor: theme.border,
          backgroundColor: '#0c1218',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" style={{ color: theme.primary }} />
            <h3 className="text-base font-bold tracking-tight">SENSOR TELEMETRY & CONFIG</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
          {/* iOS / Mobile Permission Activation Banner */}
          <div className="p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/5" style={{ borderColor: theme.border }}>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: theme.primary }}>
                <ShieldCheck className="w-4 h-4" />
                <span>Phone Sensor Hardware Permissions</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                iOS Safari and modern mobile browsers require explicit user interaction to activate Gyroscope & Accelerometer events.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestPermissions}
              className="px-3 py-1.5 rounded font-bold border transition-all active:scale-95 whitespace-nowrap"
              style={{
                borderColor: theme.primary,
                backgroundColor: theme.primaryBg,
                color: theme.primary,
              }}
            >
              REQUEST PERMISSION
            </button>
          </div>

          {/* HUD Color Theme Picker */}
          <div className="p-3 rounded-lg border bg-black/40" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-1.5 font-bold mb-2 text-slate-300">
              <Palette className="w-4 h-4" style={{ color: theme.primary }} />
              <span>HUD Color Scheme</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['cyan', 'green', 'amber', 'white'] as HudTheme[]).map((t) => {
                const isSelected = currentTheme === t;
                const previewColor = HUD_THEMES[t].primary;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onSelectTheme(t)}
                    className="flex items-center gap-2 p-2 rounded border text-left transition-all active:scale-95"
                    style={{
                      borderColor: isSelected ? previewColor : 'rgba(255,255,255,0.1)',
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                    }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: previewColor }} />
                    <span className="capitalize font-bold text-[11px]">{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simulator & Reticle Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Simulator Toggle */}
            <div className="p-3 rounded-lg border bg-black/40 flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div>
                <span className="font-bold">Motion Simulator</span>
                <p className="text-[10px] text-slate-400">Emulates realistic flight motion for desktop/testing</p>
              </div>
              <button
                type="button"
                onClick={onToggleSimulated}
                className="px-3 py-1 rounded border font-bold text-[11px]"
                style={{
                  borderColor: isSimulated ? theme.accent : 'rgba(255,255,255,0.2)',
                  backgroundColor: isSimulated ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
                  color: isSimulated ? theme.accent : '#94a3b8',
                }}
              >
                {isSimulated ? 'ACTIVE' : 'OFF'}
              </button>
            </div>

            {/* Pitch Ladder Horizon Toggle */}
            <div className="p-3 rounded-lg border bg-black/40 flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div>
                <span className="font-bold">Pitch Ladder Reticle</span>
                <p className="text-[10px] text-slate-400">Center artificial horizon ladder</p>
              </div>
              <button
                type="button"
                onClick={onToggleHorizonLadder}
                className="px-3 py-1 rounded border font-bold text-[11px]"
                style={{
                  borderColor: showHorizonLadder ? theme.primary : 'rgba(255,255,255,0.2)',
                  backgroundColor: showHorizonLadder ? theme.primaryBg : 'transparent',
                  color: showHorizonLadder ? theme.primary : '#94a3b8',
                }}
              >
                {showHorizonLadder ? 'SHOWN' : 'HIDDEN'}
              </button>
            </div>
          </div>

          {/* Live Sensor Values Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Gyroscope Card */}
            <div className="p-3 rounded-lg border bg-black/50" style={{ borderColor: theme.border }}>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <span className="font-bold flex items-center gap-1" style={{ color: theme.primary }}>
                  <Compass className="w-3.5 h-3.5" /> GYROSCOPE
                </span>
                <span className="text-[9px] text-emerald-400">ONLINE</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="opacity-60">Pitch (β):</span>
                  <span className="font-bold">{orientation.calibratedPitch}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Roll (γ):</span>
                  <span className="font-bold">{orientation.calibratedRoll}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Yaw / Heading:</span>
                  <span className="font-bold">{orientation.calibratedYaw}°</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-white/5">
                  <span className="opacity-60">Turn Rate (X):</span>
                  <span>{motion.rotRateBeta}°/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Turn Rate (Y):</span>
                  <span>{motion.rotRateGamma}°/s</span>
                </div>
              </div>
            </div>

            {/* Accelerometer Card */}
            <div className="p-3 rounded-lg border bg-black/50" style={{ borderColor: theme.border }}>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <span className="font-bold flex items-center gap-1" style={{ color: theme.primary }}>
                  <Activity className="w-3.5 h-3.5" /> ACCELEROMETER
                </span>
                <span className="text-[9px] text-emerald-400">ONLINE</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="opacity-60">Total G-Force:</span>
                  <span className="font-bold text-emerald-400">{motion.totalG} G</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Peak G:</span>
                  <span>{motion.maxG} G</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Linear Acc X:</span>
                  <span>{motion.accX} m/s²</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Linear Acc Y:</span>
                  <span>{motion.accY} m/s²</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Linear Acc Z:</span>
                  <span>{motion.accZ} m/s²</span>
                </div>
              </div>
            </div>

            {/* Barometer Card */}
            <div className="p-3 rounded-lg border bg-black/50" style={{ borderColor: theme.border }}>
              <div className="flex items-center justify-between border-b pb-1.5 mb-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <span className="font-bold flex items-center gap-1" style={{ color: theme.primary }}>
                  <Mountain className="w-3.5 h-3.5" /> BAROMETER
                </span>
                <span className="text-[9px]" style={{ color: barometer.isHardwareNative ? '#34d399' : theme.primary }}>
                  {barometer.isHardwareNative ? 'HARDWARE' : 'ESTIMATED'}
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="opacity-60">Pressure:</span>
                  <span className="font-bold">{barometer.pressureHpa} hPa</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Pressure inHg:</span>
                  <span>{barometer.pressureInHg} inHg</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Baro Altitude:</span>
                  <span className="font-bold">{barometer.altitudeM} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Rel Altitude:</span>
                  <span>{barometer.relativeAltitudeM} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Climb Rate:</span>
                  <span>{barometer.verticalSpeedMps} m/s</span>
                </div>
              </div>
            </div>
          </div>

          {/* QNH Calibration Setting */}
          <div className="p-3 rounded-lg border bg-black/40" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-300">QNH Sea Level Reference Pressure</span>
              <span className="font-mono font-bold" style={{ color: theme.primary }}>
                {barometer.seaLevelRefHpa.toFixed(1)} hPa
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={950}
                max={1050}
                step={0.5}
                value={barometer.seaLevelRefHpa}
                onChange={(e) => handleQnhChange(parseFloat(e.target.value))}
                className="w-full accent-sky-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleQnhChange(1013.25)}
                className="px-2 py-1 rounded border border-white/20 text-[10px] font-bold hover:bg-white/10"
                title="Reset to standard atmosphere (1013.25 hPa)"
              >
                STD
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 mt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <span className="text-[10px] text-slate-400">Tip: Tap "TARE ZERO" on the bottom edge to level the horizon.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded font-bold border transition-all active:scale-95"
            style={{
              borderColor: theme.primary,
              backgroundColor: theme.primary,
              color: '#0a0e14',
            }}
          >
            RETURN TO HUD
          </button>
        </div>
      </div>
    </div>
  );
};

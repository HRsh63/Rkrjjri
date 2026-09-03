import React from 'react';
import { RotateCw, Target, RefreshCw, Smartphone, SlidersHorizontal } from 'lucide-react';
import { OrientationData, MotionData } from '../types';
import { ThemeColors } from '../utils/theme';

interface BottomEdgeGyroProps {
  orientation: OrientationData;
  motion: MotionData;
  theme: ThemeColors;
  isSimulated: boolean;
  onTare: () => void;
  onToggleSimulated: () => void;
  onOpenDiagnostics: () => void;
}

export const BottomEdgeGyro: React.FC<BottomEdgeGyroProps> = ({
  orientation,
  motion,
  theme,
  isSimulated,
  onTare,
  onToggleSimulated,
  onOpenDiagnostics,
}) => {
  const pitch = orientation.calibratedPitch;
  const roll = orientation.calibratedRoll;

  // Level bubble indicator offset (-40px to +40px)
  const bubbleOffset = Math.max(-36, Math.min(36, (roll / 45) * 36));

  return (
    <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-none p-2 sm:p-3 flex flex-col items-center">
      {/* Main Bottom HUD Bar */}
      <div
        className="w-full max-w-4xl rounded-lg border backdrop-blur-md shadow-2xl p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2.5 pointer-events-auto"
        style={{
          borderColor: theme.border,
          backgroundColor: 'rgba(8, 12, 18, 0.88)',
          color: theme.text,
        }}
      >
        {/* Left: Gyro Rotation Rates (omega x, y, z in deg/s) */}
        <div className="flex items-center gap-3 font-mono text-xs border-r pr-3" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: theme.primary }}>
            <RotateCw className="w-3.5 h-3.5" />
            <span>GYRO ω:</span>
          </div>

          <div className="flex items-center gap-2 text-[10.5px]">
            <div className="flex items-center gap-1">
              <span className="opacity-60">X:</span>
              <span className="font-semibold w-10 text-right">{motion.rotRateBeta >= 0 ? `+${motion.rotRateBeta.toFixed(0)}` : motion.rotRateBeta.toFixed(0)}°/s</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="opacity-60">Y:</span>
              <span className="font-semibold w-10 text-right">{motion.rotRateGamma >= 0 ? `+${motion.rotRateGamma.toFixed(0)}` : motion.rotRateGamma.toFixed(0)}°/s</span>
            </div>
            <div className="flex items-center gap-1 hidden sm:flex">
              <span className="opacity-60">Z:</span>
              <span className="font-semibold w-10 text-right">{motion.rotRateAlpha >= 0 ? `+${motion.rotRateAlpha.toFixed(0)}` : motion.rotRateAlpha.toFixed(0)}°/s</span>
            </div>
          </div>
        </div>

        {/* Center: Pitch & Roll Digital Angles + Horizon Bubble Level */}
        <div className="flex-1 flex items-center justify-center gap-4 font-mono">
          {/* Pitch */}
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] opacity-60">PITCH:</span>
            <span
              className="text-sm sm:text-base font-black tracking-tight"
              style={{
                color: Math.abs(pitch) > 30 ? theme.warning : theme.text,
              }}
            >
              {pitch >= 0 ? `+${pitch.toFixed(1)}` : pitch.toFixed(1)}°
            </span>
          </div>

          {/* Roll Level Bubble */}
          <div
            className="relative w-24 sm:w-32 h-4 rounded-full border bg-black/60 overflow-hidden flex items-center justify-center px-1"
            style={{ borderColor: theme.border }}
            title="Roll Level Indicator"
          >
            {/* Center target line */}
            <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-white/40 -translate-x-1/2 z-10" />

            {/* Bubble */}
            <div
              className="w-3.5 h-2.5 rounded-full transition-transform duration-75 shadow-sm"
              style={{
                transform: `translateX(${bubbleOffset}px)`,
                backgroundColor: Math.abs(roll) < 3 ? theme.accent : theme.primary,
                boxShadow: Math.abs(roll) < 3 ? `0 0 8px ${theme.accent}` : theme.glow,
              }}
            />
          </div>

          {/* Roll */}
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] opacity-60">ROLL:</span>
            <span
              className="text-sm sm:text-base font-black tracking-tight"
              style={{
                color: Math.abs(roll) > 30 ? theme.warning : theme.text,
              }}
            >
              {roll >= 0 ? `+${roll.toFixed(1)}` : roll.toFixed(1)}°
            </span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Tare Zero Horizon Button */}
          <button
            type="button"
            onClick={onTare}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-semibold border transition-all active:scale-95"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.primaryBg,
              color: theme.primary,
            }}
            title="Calibrate / Tare: set current tilt & relative altitude to zero"
          >
            <Target className="w-3 h-3" />
            <span className="hidden sm:inline">TARE</span> ZERO
          </button>

          {/* Simulator Toggle Button */}
          <button
            type="button"
            onClick={onToggleSimulated}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-semibold border transition-all active:scale-95"
            style={{
              borderColor: isSimulated ? theme.accent : 'rgba(255,255,255,0.2)',
              backgroundColor: isSimulated ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
              color: isSimulated ? theme.accent : theme.textDim,
            }}
            title="Toggle interactive motion simulator"
          >
            <Smartphone className="w-3 h-3" />
            <span className="hidden md:inline">{isSimulated ? 'SIM: ON' : 'SIM: OFF'}</span>
          </button>

          {/* Diagnostics / Settings Button */}
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="flex items-center gap-1 p-1 sm:px-2 sm:py-1 rounded text-[11px] font-mono font-semibold border transition-all active:scale-95 hover:bg-white/5"
            style={{
              borderColor: theme.border,
              color: theme.text,
            }}
            title="Open sensor diagnostics & permission manager"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">SENSORS</span>
          </button>
        </div>
      </div>
    </div>
  );
};

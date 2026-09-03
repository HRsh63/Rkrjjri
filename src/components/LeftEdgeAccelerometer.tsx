import React from 'react';
import { Activity } from 'lucide-react';
import { MotionData } from '../types';
import { ThemeColors } from '../utils/theme';

interface LeftEdgeAccelerometerProps {
  motion: MotionData;
  theme: ThemeColors;
}

export const LeftEdgeAccelerometer: React.FC<LeftEdgeAccelerometerProps> = ({ motion, theme }) => {
  // G force limits for visual tape
  const minDispG = 0;
  const maxDispG = 3.0;
  const currentG = Math.max(0, Math.min(maxDispG, motion.totalG));
  const gPercent = ((currentG - minDispG) / (maxDispG - minDispG)) * 100;
  const maxGPercent = ((Math.min(maxDispG, motion.maxG) - minDispG) / (maxDispG - minDispG)) * 100;

  // G-Ball position: normalize accX (lateral) and accY (longitudinal) to ±15px in a 36px circle
  const ballX = Math.max(-14, Math.min(14, (motion.accX / 9.8) * 14));
  const ballY = Math.max(-14, Math.min(14, (-motion.accY / 9.8) * 14));

  return (
    <div className="absolute left-2 sm:left-4 top-24 bottom-24 z-20 pointer-events-none flex items-center">
      <div
        className="flex flex-col gap-2 p-2.5 rounded-lg border backdrop-blur-md shadow-2xl"
        style={{
          borderColor: theme.border,
          backgroundColor: 'rgba(8, 12, 18, 0.82)',
          color: theme.text,
          width: '108px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider">
            <Activity className="w-3 h-3" style={{ color: theme.primary }} />
            <span>ACCEL / G</span>
          </div>
          <span className="text-[9px] font-mono opacity-60">{motion.interval.toFixed(0)}ms</span>
        </div>

        {/* Primary Digital G-Force Readout */}
        <div className="flex flex-col items-center justify-center py-1">
          <div className="flex items-baseline gap-1 font-mono">
            <span
              className="text-xl sm:text-2xl font-black tracking-tight"
              style={{
                color: motion.totalG > 1.8 ? theme.warning : theme.primary,
                textShadow: theme.glow,
              }}
            >
              {motion.totalG.toFixed(2)}
            </span>
            <span className="text-xs font-bold" style={{ color: theme.primary }}>
              G
            </span>
          </div>
          <div className="flex items-center justify-between w-full text-[9px] font-mono opacity-70 px-1 mt-0.5">
            <span>PEAK:</span>
            <span className="font-bold">{motion.maxG.toFixed(2)}G</span>
          </div>
        </div>

        {/* Vertical G-Tape Ladder */}
        <div className="flex items-stretch gap-1.5 h-32 sm:h-40 my-1">
          {/* Numeric Scale Marks */}
          <div className="flex flex-col justify-between text-[8.5px] font-mono opacity-60 text-right w-4">
            <span>3.0</span>
            <span>2.0</span>
            <span>1.0</span>
            <span>0.0</span>
          </div>

          {/* G Ladder Bar */}
          <div className="relative flex-1 rounded bg-black/50 border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
            {/* 1.0 G Normal Baseline Line */}
            <div
              className="absolute inset-x-0 border-t border-dashed pointer-events-none z-10"
              style={{ bottom: `${(1.0 / maxDispG) * 100}%`, borderColor: 'rgba(255,255,255,0.4)' }}
            />

            {/* Peak indicator tick */}
            <div
              className="absolute inset-x-0 h-0.5 pointer-events-none z-10 transition-all duration-300"
              style={{
                bottom: `${maxGPercent}%`,
                backgroundColor: theme.warning,
              }}
            />

            {/* Live Fill */}
            <div
              className="absolute inset-x-0 bottom-0 transition-all duration-75"
              style={{
                height: `${gPercent}%`,
                backgroundColor: motion.totalG > 1.8 ? theme.warning : theme.primary,
                opacity: 0.85,
              }}
            />
          </div>

          {/* 2D G-Ball Reticle */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="relative w-9 h-9 rounded-full border flex items-center justify-center bg-black/60"
              style={{ borderColor: theme.border }}
              title="2D G-Force Vector (Lateral & Longitudinal)"
            >
              {/* Crosshair inside ball */}
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/20 -translate-y-1/2" />
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/20 -translate-x-1/2" />

              {/* Dynamic G-Vector Point */}
              <div
                className="w-2.5 h-2.5 rounded-full transition-transform duration-75 shadow-sm"
                style={{
                  transform: `translate(${ballX}px, ${ballY}px)`,
                  backgroundColor: theme.accent,
                  boxShadow: `0 0 6px ${theme.accent}`,
                }}
              />
            </div>
            <span className="text-[8px] font-mono opacity-50 mt-1">VECTOR</span>
          </div>
        </div>

        {/* 3-Axis Linear Accelerometer Readings (X, Y, Z in m/s²) */}
        <div className="flex flex-col gap-1 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {/* Axis X (Lateral) */}
          <div className="flex flex-col text-[9px] font-mono">
            <div className="flex justify-between items-center">
              <span className="opacity-70">X (Lat):</span>
              <span className="font-semibold">{motion.accX >= 0 ? `+${motion.accX.toFixed(1)}` : motion.accX.toFixed(1)}</span>
            </div>
            <div className="relative w-full h-1 bg-black/60 rounded-full overflow-hidden flex">
              <div className="w-1/2 flex justify-end">
                {motion.accX < 0 && (
                  <div
                    className="h-full rounded-l"
                    style={{
                      width: `${Math.min(100, (Math.abs(motion.accX) / 10) * 100)}%`,
                      backgroundColor: theme.accent,
                    }}
                  />
                )}
              </div>
              <div className="w-1/2 flex justify-start">
                {motion.accX > 0 && (
                  <div
                    className="h-full rounded-r"
                    style={{
                      width: `${Math.min(100, (motion.accX / 10) * 100)}%`,
                      backgroundColor: theme.primary,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Axis Y (Longitudinal) */}
          <div className="flex flex-col text-[9px] font-mono">
            <div className="flex justify-between items-center">
              <span className="opacity-70">Y (Long):</span>
              <span className="font-semibold">{motion.accY >= 0 ? `+${motion.accY.toFixed(1)}` : motion.accY.toFixed(1)}</span>
            </div>
            <div className="relative w-full h-1 bg-black/60 rounded-full overflow-hidden flex">
              <div className="w-1/2 flex justify-end">
                {motion.accY < 0 && (
                  <div
                    className="h-full rounded-l"
                    style={{
                      width: `${Math.min(100, (Math.abs(motion.accY) / 10) * 100)}%`,
                      backgroundColor: theme.accent,
                    }}
                  />
                )}
              </div>
              <div className="w-1/2 flex justify-start">
                {motion.accY > 0 && (
                  <div
                    className="h-full rounded-r"
                    style={{
                      width: `${Math.min(100, (motion.accY / 10) * 100)}%`,
                      backgroundColor: theme.primary,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Axis Z (Vertical) */}
          <div className="flex flex-col text-[9px] font-mono">
            <div className="flex justify-between items-center">
              <span className="opacity-70">Z (Vert):</span>
              <span className="font-semibold">{motion.accZ >= 0 ? `+${motion.accZ.toFixed(1)}` : motion.accZ.toFixed(1)}</span>
            </div>
            <div className="relative w-full h-1 bg-black/60 rounded-full overflow-hidden flex">
              <div className="w-1/2 flex justify-end">
                {motion.accZ < 0 && (
                  <div
                    className="h-full rounded-l"
                    style={{
                      width: `${Math.min(100, (Math.abs(motion.accZ) / 10) * 100)}%`,
                      backgroundColor: theme.accent,
                    }}
                  />
                )}
              </div>
              <div className="w-1/2 flex justify-start">
                {motion.accZ > 0 && (
                  <div
                    className="h-full rounded-r"
                    style={{
                      width: `${Math.min(100, (motion.accZ / 10) * 100)}%`,
                      backgroundColor: theme.primary,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

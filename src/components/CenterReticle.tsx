import React from 'react';
import { OrientationData } from '../types';
import { ThemeColors } from '../utils/theme';

interface CenterReticleProps {
  orientation: OrientationData;
  theme: ThemeColors;
  visible: boolean;
}

export const CenterReticle: React.FC<CenterReticleProps> = ({
  orientation,
  theme,
  visible,
}) => {
  if (!visible) return null;

  const pitch = orientation.calibratedPitch;
  const roll = orientation.calibratedRoll;

  // 1 degree of pitch = 3px vertical shift
  const pxPerPitchDeg = 3;
  const pitchOffsetY = pitch * pxPerPitchDeg;

  // Ladder steps (+30, +20, +10, 0, -10, -20, -30)
  const ladderSteps = [30, 20, 10, 0, -10, -20, -30];

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-10">
      {/* Central Pitch Ladder & Horizon Rotating with Roll */}
      <div
        className="relative w-80 h-80 flex items-center justify-center transition-transform duration-75"
        style={{
          transform: `rotate(${-roll}deg)`,
        }}
      >
        {/* Dynamic Pitch Container shifting vertically with Pitch */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
          style={{
            transform: `translateY(${pitchOffsetY}px)`,
          }}
        >
          {ladderSteps.map((deg) => {
            const isZero = deg === 0;
            const isPositive = deg > 0;
            const stepY = -deg * pxPerPitchDeg;

            return (
              <div
                key={deg}
                className="absolute flex items-center justify-between w-48 sm:w-60 pointer-events-none"
                style={{
                  transform: `translateY(${stepY}px)`,
                }}
              >
                {/* Left wing */}
                <div className="flex items-center">
                  <span
                    className="font-mono text-[9px] font-bold mr-1.5 opacity-80"
                    style={{ color: theme.primary }}
                  >
                    {Math.abs(deg)}
                  </span>
                  <div
                    style={{
                      width: isZero ? '54px' : '36px',
                      height: '1.5px',
                      backgroundColor: theme.primary,
                      borderStyle: isPositive ? 'solid' : 'dashed',
                    }}
                  />
                  {!isZero && (
                    <div
                      style={{
                        width: '1.5px',
                        height: isPositive ? '6px' : '6px',
                        backgroundColor: theme.primary,
                        transform: isPositive ? 'translateY(3px)' : 'translateY(-3px)',
                      }}
                    />
                  )}
                </div>

                {/* Right wing */}
                <div className="flex items-center">
                  {!isZero && (
                    <div
                      style={{
                        width: '1.5px',
                        height: isPositive ? '6px' : '6px',
                        backgroundColor: theme.primary,
                        transform: isPositive ? 'translateY(3px)' : 'translateY(-3px)',
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: isZero ? '54px' : '36px',
                      height: '1.5px',
                      backgroundColor: theme.primary,
                      borderStyle: isPositive ? 'solid' : 'dashed',
                    }}
                  />
                  <span
                    className="font-mono text-[9px] font-bold ml-1.5 opacity-80"
                    style={{ color: theme.primary }}
                  >
                    {Math.abs(deg)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Aircraft Boresight / Crosshair (fixed to aircraft frame, not moving with pitch) */}
        <div className="relative flex items-center justify-center pointer-events-none">
          {/* Center Dot */}
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: theme.primary, boxShadow: theme.glow }}
          />

          {/* Left Wing Bar */}
          <div
            className="absolute right-3 w-5 h-[1.5px]"
            style={{ backgroundColor: theme.primary }}
          />

          {/* Right Wing Bar */}
          <div
            className="absolute left-3 w-5 h-[1.5px]"
            style={{ backgroundColor: theme.primary }}
          />

          {/* Top Pip */}
          <div
            className="absolute bottom-3 w-[1.5px] h-3"
            style={{ backgroundColor: theme.primary }}
          />
        </div>
      </div>

      {/* Roll Arc Scale (fixed at top of center display) */}
      <div className="absolute top-16 sm:top-20 flex flex-col items-center pointer-events-none">
        {/* Roll index pointer triangle */}
        <div
          className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] transition-transform duration-75"
          style={{
            borderTopColor: theme.primary,
            transform: `rotate(${roll}deg) translateY(-2px)`,
            transformOrigin: '50% 60px',
          }}
        />

        {/* Static roll scale arc */}
        <div className="relative w-40 h-10 flex justify-center">
          <svg className="w-40 h-10 overflow-visible" viewBox="-80 0 160 40">
            {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const r = 54;
              const x1 = Math.sin(rad) * r;
              const y1 = -Math.cos(rad) * r + 54;
              const len = deg % 30 === 0 ? 6 : 4;
              const x2 = Math.sin(rad) * (r + len);
              const y2 = -Math.cos(rad) * (r + len) + 54;

              return (
                <line
                  key={deg}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={theme.primary}
                  strokeWidth={deg === 0 ? 2 : 1}
                  opacity={deg % 30 === 0 ? 0.9 : 0.45}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

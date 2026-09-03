import React, { useMemo } from 'react';
import { Compass, Gauge, MapPin, Radio } from 'lucide-react';
import { OrientationData, BarometerData, GpsData } from '../types';
import { ThemeColors } from '../utils/theme';

interface TopEdgeCompassProps {
  orientation: OrientationData;
  barometer: BarometerData;
  gps: GpsData;
  theme: ThemeColors;
}

export const TopEdgeCompass: React.FC<TopEdgeCompassProps> = ({
  orientation,
  barometer,
  gps,
  theme,
}) => {
  const heading = Math.round(orientation.calibratedYaw || orientation.yaw || 0);

  // Compass cardinal string
  const cardinal = useMemo(() => {
    const deg = (heading % 360 + 360) % 360;
    if (deg >= 337.5 || deg < 22.5) return 'N';
    if (deg >= 22.5 && deg < 67.5) return 'NE';
    if (deg >= 67.5 && deg < 112.5) return 'E';
    if (deg >= 112.5 && deg < 157.5) return 'SE';
    if (deg >= 157.5 && deg < 202.5) return 'S';
    if (deg >= 202.5 && deg < 247.5) return 'SW';
    if (deg >= 247.5 && deg < 292.5) return 'W';
    return 'NW';
  }, [heading]);

  // Generate tick marks across a visible window of ±60 degrees around current heading
  const ticks = useMemo(() => {
    const items: Array<{ deg: number; label?: string; major: boolean; offsetPx: number }> = [];
    // 1 degree = 4px offset on screen
    const pxPerDeg = 4;
    const startDeg = Math.floor((heading - 45) / 5) * 5;
    const endDeg = Math.ceil((heading + 45) / 5) * 5;

    for (let d = startDeg; d <= endDeg; d += 5) {
      const normalized = ((d % 360) + 360) % 360;
      let label: string | undefined;
      let major = false;

      if (normalized === 0) label = 'N';
      else if (normalized === 45) label = 'NE';
      else if (normalized === 90) label = 'E';
      else if (normalized === 135) label = 'SE';
      else if (normalized === 180) label = 'S';
      else if (normalized === 225) label = 'SW';
      else if (normalized === 270) label = 'W';
      else if (normalized === 315) label = 'NW';
      else if (normalized % 30 === 0) {
        label = String(normalized).padStart(3, '0');
        major = true;
      } else if (normalized % 10 === 0) {
        major = true;
      }

      const offsetPx = (d - heading) * pxPerDeg;
      items.push({ deg: normalized, label, major, offsetPx });
    }
    return items;
  }, [heading]);

  return (
    <div className="absolute top-0 inset-x-0 z-20 pointer-events-none p-2 sm:p-3 flex flex-col items-center">
      {/* Top Banner Status Bar */}
      <div className="w-full flex items-center justify-between gap-2 max-w-7xl mx-auto mb-1.5 text-[11px] font-mono">
        {/* Left: Barometer Quick Readout on top edge */}
        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded border backdrop-blur-md"
          style={{
            borderColor: theme.border,
            backgroundColor: 'rgba(10, 14, 20, 0.75)',
            color: theme.text,
          }}
        >
          <Gauge className="w-3.5 h-3.5" style={{ color: theme.primary }} />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{barometer.pressureHpa.toFixed(1)}</span>
            <span className="text-[9.5px] opacity-70">hPa</span>
            <span className="opacity-40">|</span>
            <span>{barometer.pressureInHg.toFixed(2)}</span>
            <span className="text-[9.5px] opacity-70">inHg</span>
          </div>
          <span
            className="text-[9px] px-1 py-0.2 rounded font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: barometer.isHardwareNative ? 'rgba(52, 211, 153, 0.2)' : 'rgba(56, 189, 248, 0.15)',
              color: barometer.isHardwareNative ? '#34d399' : theme.primary,
            }}
          >
            {barometer.isHardwareNative ? 'BARO NATIVE' : 'BARO LIVE'}
          </span>
        </div>

        {/* Center: Live Heading Badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded border font-mono font-bold tracking-wider backdrop-blur-md text-xs sm:text-sm"
          style={{
            borderColor: theme.primary,
            backgroundColor: 'rgba(10, 14, 20, 0.85)',
            color: theme.primary,
            boxShadow: theme.glow,
          }}
        >
          <Compass className="w-4 h-4 animate-spin-slow" />
          <span>{String(heading).padStart(3, '0')}°</span>
          <span className="text-white font-black">{cardinal}</span>
        </div>

        {/* Right: GPS / Sat Position */}
        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded border backdrop-blur-md"
          style={{
            borderColor: theme.border,
            backgroundColor: 'rgba(10, 14, 20, 0.75)',
            color: theme.text,
          }}
        >
          <MapPin className="w-3.5 h-3.5" style={{ color: theme.accent }} />
          {gps.available && gps.latitude !== null ? (
            <span className="text-[10.5px]">
              {gps.latitude.toFixed(4)}°, {gps.longitude?.toFixed(4)}°
            </span>
          ) : (
            <span className="text-[10px] opacity-70 flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" /> SENSORS ARMED
            </span>
          )}
        </div>
      </div>

      {/* Ribbon Compass Tape on Top Edge */}
      <div
        className="relative w-full max-w-xl h-9 rounded-md border overflow-hidden backdrop-blur-md shadow-lg"
        style={{
          borderColor: theme.border,
          backgroundColor: 'rgba(8, 12, 18, 0.82)',
        }}
      >
        {/* Subtle edge fade gradient */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none" />

        {/* Center Lubber Indicator Triangle */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div
            className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px]"
            style={{ borderTopColor: theme.primary }}
          />
          <div className="w-[1.5px] h-3" style={{ backgroundColor: theme.primary }} />
        </div>

        {/* Scrolling Ticks & Labels Container */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {ticks.map((t, idx) => (
            <div
              key={`${t.deg}-${idx}`}
              className="absolute flex flex-col items-center justify-start top-1"
              style={{
                transform: `translateX(${t.offsetPx}px)`,
                width: '32px',
                marginLeft: '-16px',
              }}
            >
              {/* Tick Mark */}
              <div
                className="transition-all"
                style={{
                  width: t.major ? '1.5px' : '1px',
                  height: t.label ? '10px' : t.major ? '7px' : '4px',
                  backgroundColor: t.label ? theme.primary : t.major ? theme.textDim : 'rgba(255,255,255,0.3)',
                }}
              />
              {/* Label */}
              {t.label && (
                <span
                  className="font-mono text-[9px] font-bold mt-0.5 tracking-tighter"
                  style={{
                    color: ['N', 'E', 'S', 'W'].includes(t.label) ? theme.accent : theme.text,
                  }}
                >
                  {t.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

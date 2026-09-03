import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, CloudRain, Mountain } from 'lucide-react';
import { BarometerData } from '../types';
import { ThemeColors } from '../utils/theme';

interface RightEdgeAltimeterProps {
  barometer: BarometerData;
  theme: ThemeColors;
}

export const RightEdgeAltimeter: React.FC<RightEdgeAltimeterProps> = ({ barometer, theme }) => {
  const currentAlt = Math.round(barometer.altitudeM);

  // Generate altitude tape marks centered around current altitude
  const altTicks = useMemo(() => {
    const ticks: Array<{ alt: number; label: string; offsetPx: number }> = [];
    const step = 20; // 20m increments
    const pxPerMeter = 1.4; // 1.4px per meter
    const startAlt = Math.floor((currentAlt - 50) / step) * step;
    const endAlt = Math.ceil((currentAlt + 50) / step) * step;

    for (let a = startAlt; a <= endAlt; a += step) {
      const offsetPx = (currentAlt - a) * pxPerMeter;
      ticks.push({
        alt: a,
        label: String(a),
        offsetPx,
      });
    }
    return ticks;
  }, [currentAlt]);

  const isClimbing = barometer.verticalSpeedMps > 0.15;
  const isDescending = barometer.verticalSpeedMps < -0.15;

  // Variometer bar length (-5 m/s to +5 m/s mapped to 100%)
  const maxVsi = 4.0;
  const vsiClamp = Math.max(-maxVsi, Math.min(maxVsi, barometer.verticalSpeedMps));
  const vsiPercent = (Math.abs(vsiClamp) / maxVsi) * 100;

  return (
    <div className="absolute right-2 sm:right-4 top-24 bottom-24 z-20 pointer-events-none flex items-center">
      <div
        className="flex flex-col gap-2 p-2.5 rounded-lg border backdrop-blur-md shadow-2xl"
        style={{
          borderColor: theme.border,
          backgroundColor: 'rgba(8, 12, 18, 0.82)',
          color: theme.text,
          width: '116px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider">
            <Mountain className="w-3 h-3" style={{ color: theme.primary }} />
            <span>BARO ALT</span>
          </div>
          <span
            className="text-[8.5px] px-1 py-0.2 rounded font-mono font-bold uppercase"
            style={{
              backgroundColor: barometer.isHardwareNative ? 'rgba(52, 211, 153, 0.2)' : 'rgba(56, 189, 248, 0.15)',
              color: barometer.isHardwareNative ? '#34d399' : theme.primary,
            }}
          >
            {barometer.isHardwareNative ? 'HARDWARE' : 'BARO LIVE'}
          </span>
        </div>

        {/* Primary Digital Altitude Readout */}
        <div className="flex flex-col items-center justify-center py-1">
          <div className="flex items-baseline gap-1 font-mono">
            <span
              className="text-xl sm:text-2xl font-black tracking-tight"
              style={{
                color: theme.primary,
                textShadow: theme.glow,
              }}
            >
              {Math.round(barometer.altitudeM)}
            </span>
            <span className="text-xs font-bold" style={{ color: theme.primary }}>
              m
            </span>
          </div>
          <div className="text-[9.5px] font-mono opacity-80 mt-0.5">
            <span>{Math.round(barometer.altitudeFt)} ft</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-mono mt-0.5" style={{ color: theme.accent }}>
            <span>Δ REL:</span>
            <span className="font-bold">
              {barometer.relativeAltitudeM >= 0 ? `+${barometer.relativeAltitudeM.toFixed(1)}` : barometer.relativeAltitudeM.toFixed(1)}m
            </span>
          </div>
        </div>

        {/* Vertical Rolling Altitude Tape + Variometer */}
        <div className="flex items-stretch gap-2 h-32 sm:h-40 my-1">
          {/* Variometer (VSI Climb/Sink Ladder) */}
          <div className="flex flex-col items-center justify-between w-5 text-[8.5px] font-mono opacity-80">
            <span className="text-[7.5px] text-emerald-400">+4</span>
            <div className="relative w-2 flex-1 bg-black/60 rounded border my-0.5 overflow-hidden flex flex-col justify-center" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              {/* Zero center line */}
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/40 -translate-y-1/2" />

              {/* VSI fill up or down */}
              {isClimbing && (
                <div
                  className="absolute bottom-1/2 inset-x-0 transition-all duration-150"
                  style={{
                    height: `${vsiPercent / 2}%`,
                    backgroundColor: theme.accent,
                  }}
                />
              )}
              {isDescending && (
                <div
                  className="absolute top-1/2 inset-x-0 transition-all duration-150"
                  style={{
                    height: `${vsiPercent / 2}%`,
                    backgroundColor: theme.warning,
                  }}
                />
              )}
            </div>
            <span className="text-[7.5px] text-amber-400">-4</span>
          </div>

          {/* Rolling Altitude Ladder */}
          <div className="relative flex-1 rounded bg-black/50 border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
            {/* Center Pointer Bug */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-between px-1 pointer-events-none">
              <div
                className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px]"
                style={{ borderLeftColor: theme.primary }}
              />
              <div className="h-[1px] flex-1 border-t border-dashed" style={{ borderColor: theme.primary }} />
              <div
                className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[6px]"
                style={{ borderRightColor: theme.primary }}
              />
            </div>

            {/* Scrolling Numbers Container */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {altTicks.map((t, i) => (
                <div
                  key={`${t.alt}-${i}`}
                  className="absolute inset-x-0 flex items-center justify-between px-1.5 transition-transform duration-75"
                  style={{
                    transform: `translateY(${t.offsetPx}px)`,
                  }}
                >
                  <span className="w-1.5 h-[1.5px]" style={{ backgroundColor: theme.primary }} />
                  <span className="font-mono text-[9px] font-bold tracking-tight opacity-75">
                    {t.label}
                  </span>
                  <span className="w-1.5 h-[1.5px]" style={{ backgroundColor: theme.primary }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Variometer Digital readout & Baro Pressure Detail */}
        <div className="flex flex-col gap-1 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {/* Vertical Speed */}
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="opacity-70 flex items-center gap-0.5">
              VSI:
              {isClimbing && <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />}
              {isDescending && <ArrowDown className="w-2.5 h-2.5 text-amber-400" />}
            </span>
            <span className="font-semibold" style={{ color: isClimbing ? theme.accent : isDescending ? theme.warning : theme.text }}>
              {barometer.verticalSpeedMps >= 0 ? `+${barometer.verticalSpeedMps.toFixed(1)}` : barometer.verticalSpeedMps.toFixed(1)} m/s
            </span>
          </div>

          {/* Baro Pressure */}
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="opacity-70 flex items-center gap-0.5">
              <CloudRain className="w-2.5 h-2.5 opacity-60" /> P:
            </span>
            <span className="font-semibold">{barometer.pressureHpa.toFixed(1)} hPa</span>
          </div>

          {/* QNH Ref */}
          <div className="flex justify-between items-center text-[8.5px] font-mono opacity-60">
            <span>QNH:</span>
            <span>{barometer.seaLevelRefHpa.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

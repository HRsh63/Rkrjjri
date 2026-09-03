import { HudTheme } from '../types';

export interface ThemeColors {
  primary: string;
  primaryBg: string;
  border: string;
  glow: string;
  accent: string;
  warning: string;
  critical: string;
  text: string;
  textDim: string;
}

export const HUD_THEMES: Record<HudTheme, ThemeColors> = {
  cyan: {
    primary: '#38bdf8',       // sky-400 / tactical cyan
    primaryBg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.45)',
    glow: '0 0 10px rgba(56, 189, 248, 0.5)',
    accent: '#34d399',       // emerald
    warning: '#f59e0b',      // amber
    critical: '#ef4444',     // red
    text: '#e0f2fe',
    textDim: '#7dd3fc',
  },
  green: {
    primary: '#4ade80',       // night vision green
    primaryBg: 'rgba(74, 222, 128, 0.12)',
    border: 'rgba(74, 222, 128, 0.45)',
    glow: '0 0 10px rgba(74, 222, 128, 0.5)',
    accent: '#22d3ee',
    warning: '#facc15',
    critical: '#f87171',
    text: '#dcfce7',
    textDim: '#86efac',
  },
  amber: {
    primary: '#fbbf24',       // amber aviation HUD
    primaryBg: 'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.45)',
    glow: '0 0 10px rgba(251, 191, 36, 0.5)',
    accent: '#38bdf8',
    warning: '#f97316',
    critical: '#ef4444',
    text: '#fef3c7',
    textDim: '#fde68a',
  },
  white: {
    primary: '#f8fafc',       // minimalist studio white
    primaryBg: 'rgba(248, 250, 252, 0.14)',
    border: 'rgba(248, 250, 252, 0.45)',
    glow: '0 0 8px rgba(248, 250, 252, 0.4)',
    accent: '#38bdf8',
    warning: '#fbbf24',
    critical: '#f87171',
    text: '#ffffff',
    textDim: '#cbd5e1',
  },
};

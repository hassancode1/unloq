import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { DarkColors, type AppColors } from '../constants/Colors';
import { FontFamily } from '../constants/theme';

export interface Theme {
  C: AppColors;
  isDark: boolean;
  fontScale: number;
  /** Scale a base font size by the user's font-scale preference */
  fs: (base: number) => number;
  F: typeof FontFamily;
}

export function useTheme(): Theme {
  // The main app is always dark, like the onboarding — Glim's glow only reads on
  // a near-black stage. LightColors stays exported for legacy screens.
  const fontScale = useAppStore((s) => s.fontScale);
  return useMemo(() => ({
    C: DarkColors,
    isDark: true,
    fontScale,
    fs: (base: number) => base * fontScale,
    F: FontFamily,
  }), [fontScale]);
}

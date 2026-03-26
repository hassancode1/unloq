import { useAppStore } from '../store/useAppStore';
import { LightColors, DarkColors, type AppColors } from '../constants/Colors';
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
  const { darkMode, fontScale } = useAppStore();
  const C = darkMode ? DarkColors : LightColors;
  return {
    C,
    isDark: darkMode,
    fontScale,
    fs: (base: number) => base * fontScale,
    F: FontFamily,
  };
}

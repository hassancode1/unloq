// ─── App color palettes ─────────────────────────────────────────────────────

export const LightColors = {
  bg:           '#F8FAFC',
  surface:      '#FFFFFF',
  surfaceAlt:   '#F1F5F9',
  border:       '#E2E8F0',
  borderStrong: '#CBD5E1',
  text:         '#0F172A',
  sub:          '#475569',
  muted:        '#94A3B8',
  primary:      '#2563EB',
  primaryBg:    '#EFF6FF',
  primaryRing:  '#BFDBFE',
  success:      '#10B981',
  successBg:    '#ECFDF5',
  error:        '#EF4444',
  errorBg:      '#FEF2F2',
  warning:      '#F59E0B',
  warningBg:    '#FFFBEB',
  gold:         '#F59E0B',
  goldBg:       '#FFFBEB',
};

// Premium dark — matches the onboarding (components/onboarding/ui.tsx `O`).
// Near-black greyscale with one calm accent; depth from soft borders, not colour.
export const DarkColors = {
  bg:           '#06050A',
  surface:      '#0F0E15',
  surfaceAlt:   '#17161F',
  border:       '#211F2B',
  borderStrong: '#2E2C3A',
  text:         '#F5F5FA',
  sub:          '#8E8C9E',
  muted:        '#5C5A6B',
  primary:      '#6E8BFF',
  primaryBg:    '#12162A',
  primaryRing:  '#2A3666',
  success:      '#4ADE80',
  successBg:    '#0C1F14',
  error:        '#F87171',
  errorBg:      '#25100F',
  warning:      '#FBBF24',
  warningBg:    '#211A08',
  gold:         '#FBBF24',
  goldBg:       '#211A08',
};

export type AppColors = typeof LightColors;

export const CardGradients = {
  salmon:  ['#FF2D55', '#FF7B37'] as const,
  indigo:  ['#4338CA', '#7C3AED'] as const,
  teal:    ['#0D9488', '#34D399'] as const,
  blue:    ['#1D4ED8', '#3B82F6'] as const,
  feynman: ['#1e0a3c', '#9333EA'] as const,
};

export const CreateOptionColors: Record<string, string> = {
  audio:   '#F97316',
  upload:  '#3B82F6',
  capture: '#8B5CF6',
  pdf:     '#3B82F6',
  text:    '#10B981',
  youtube: '#EF4444',
};

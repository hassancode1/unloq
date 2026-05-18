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

// Premium dark — electric blue accent, near-black background
export const DarkColors = {
  bg:           '#080810',
  surface:      '#0E0E1A',
  surfaceAlt:   '#161624',
  border:       '#1E1E32',
  borderStrong: '#2A2A44',
  text:         '#F0F4FF',
  sub:          '#8892B0',
  muted:        '#4A5280',
  primary:      '#3B82F6',
  primaryBg:    '#0A1628',
  primaryRing:  '#1E3A6E',
  success:      '#34D399',
  successBg:    '#022C22',
  error:        '#F87171',
  errorBg:      '#2D0A0A',
  warning:      '#FBBF24',
  warningBg:    '#1C1400',
  gold:         '#FBBF24',
  goldBg:       '#1C1400',
};

export type AppColors = typeof LightColors;

export const CardGradients = {
  salmon: ['#FF6B6B', '#FF8E53'] as const,
  indigo: ['#667eea', '#764ba2'] as const,
  teal:   ['#11998e', '#38ef7d'] as const,
  blue:   ['#1D4ED8', '#3B82F6'] as const,
};

export const CreateOptionColors: Record<string, string> = {
  audio:   '#F97316',
  upload:  '#3B82F6',
  capture: '#8B5CF6',
  pdf:     '#3B82F6',
  text:    '#10B981',
  youtube: '#EF4444',
};

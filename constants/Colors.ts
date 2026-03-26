// ─── App color palettes ────────────────────────────────────────────────────────
// Swap between light/dark by passing the right object to makeStyles().

export const LightColors = {
  // Backgrounds
  bg:           '#FAFAFA',
  surface:      '#FFFFFF',
  surfaceAlt:   '#F4F4F8',
  // Borders
  border:       '#E8E8F0',
  borderStrong: '#D0D0E0',
  // Text
  text:         '#09090E',
  sub:          '#52525B',
  muted:        '#A1A1AA',
  // Brand
  primary:      '#6366F1',
  primaryBg:    '#F0F0FF',
  primaryRing:  '#C7C9FF',
  // Semantic
  success:      '#16A34A',
  successBg:    '#F0FDF4',
  error:        '#DC2626',
  errorBg:      '#FEF2F2',
  warning:      '#D97706',
  warningBg:    '#FFFBEB',
  // Accents
  gold:         '#D97706',
  goldBg:       '#FFFBEB',
};

export const DarkColors = {
  // Backgrounds
  bg:           '#0D0D14',
  surface:      '#15151E',
  surfaceAlt:   '#1C1C28',
  // Borders
  border:       '#272736',
  borderStrong: '#343448',
  // Text
  text:         '#F2F2F8',
  sub:          '#8B8BA4',
  muted:        '#55556A',
  // Brand — lightened for dark backgrounds
  primary:      '#818CF8',
  primaryBg:    '#1A1A30',
  primaryRing:  '#3D3D6A',
  // Semantic
  success:      '#4ADE80',
  successBg:    '#052E16',
  error:        '#F87171',
  errorBg:      '#2D0A0A',
  warning:      '#FBBF24',
  warningBg:    '#2D1A00',
  // Accents
  gold:         '#FCD34D',
  goldBg:       '#2D1A00',
};

export type AppColors = typeof LightColors;

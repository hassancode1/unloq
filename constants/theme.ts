// ─── Accent color ─────────────────────────────────────────────────────────────
// Change these 3 lines to retheme the entire app.
const ACCENT       = '#6366F1'; // primary action color
const ACCENT_DEEP  = '#4338CA'; // darker shade — used for button shadows
const ACCENT_LIGHT = '#EEF2FF'; // light tint — used for card backgrounds

// ─── Surface tints (loosely paired with accent) ───────────────────────────────
// Update these when switching to a very different hue.
const SURFACE        = '#F8F8FF'; // near-white with a hint of the accent
const SURFACE_BORDER = '#E0E7FF'; // soft border / inactive dots

// ─────────────────────────────────────────────────────────────────────────────

export const Colors = {
  primary:       ACCENT,
  primaryDeep:   ACCENT_DEEP,
  primaryLight:  ACCENT_LIGHT,

  surface:       SURFACE,
  surfaceBorder: SURFACE_BORDER,

  text:     '#1A1A2E',
  textMuted:'#6B7280',
  textSoft: '#9CA3AF',

  white:   '#FFFFFF',
  black:   '#000000',

  success: '#10B981',
  error:   '#EF4444',
  warning: '#F59E0B',

  bg:   '#FFFFFF',
  card: '#F8F8FF',
};

export const FontFamily = {
  regular:   'Nunito-Regular',
  semiBold:  'Nunito-SemiBold',
  bold:      'Nunito-Bold',
  extraBold: 'Nunito-ExtraBold',
};

export type ColorScheme = typeof Colors;

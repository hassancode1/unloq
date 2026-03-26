// Font families — Inter (loaded in App.tsx via expo-google-fonts)
export const FontFamily = {
  regular:   'Inter-Regular',
  medium:    'Inter-Medium',
  semiBold:  'Inter-SemiBold',
  bold:      'Inter-Bold',
  extraBold: 'Inter-ExtraBold',
};

// Legacy flat color set — used by onboarding/goal-setup (kept for compatibility)
export const Colors = {
  primary:       '#6366F1',
  primaryDeep:   '#4338CA',
  primaryLight:  '#F0F0FF',
  surface:       '#F4F4F8',
  surfaceBorder: '#E8E8F0',
  text:          '#09090E',
  textMuted:     '#52525B',
  textSoft:      '#A1A1AA',
  white:         '#FFFFFF',
  black:         '#000000',
  success:       '#16A34A',
  error:         '#DC2626',
  warning:       '#D97706',
  bg:            '#FAFAFA',
  card:          '#FFFFFF',
};

export type ColorScheme = typeof Colors;

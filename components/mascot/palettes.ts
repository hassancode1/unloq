// Glim's colour comes from what the user loves learning.
// Each palette is [light, mid, deep] — fed into the body's radial gradient.

export type GlimPalette = [string, string, string];

export const DEFAULT_PALETTE: GlimPalette = ['#EAF4FF', '#7FB2FF', '#3D6BFF']; // icy glass blue

export const INTEREST_PALETTES: Record<string, GlimPalette> = {
  space:      ['#E0E7FF', '#8B5CF6', '#3B4BFF'],
  history:    ['#FFF4E0', '#F5A65B', '#B4532A'],
  psychology: ['#FFE4F1', '#F472B6', '#9D4EDD'],
  money:      ['#FFF8D6', '#FACC15', '#E08A00'],
  science:    ['#DCFCE7', '#34D399', '#0EA5A4'],
  philosophy: ['#EDE9FE', '#A78BFA', '#4C1D95'],
  tech:       ['#E0F7FF', '#38BDF8', '#2563EB'],
  health:     ['#E8FFE8', '#86EFAC', '#16A34A'],
  art:        ['#FFE8E0', '#FB7185', '#F59E0B'],
  languages:  ['#FFF1F2', '#FDA4AF', '#E11D48'],
  nature:     ['#ECFCCB', '#84CC16', '#15803D'],
};

/** Blend the palettes of the user's top interests (first = strongest). */
export function paletteForInterests(interests: string[]): GlimPalette {
  const picks = interests
    .map((i) => INTEREST_PALETTES[i.toLowerCase()])
    .filter(Boolean)
    .slice(0, 3);
  if (picks.length === 0) return DEFAULT_PALETTE;
  // light from the 3rd (or 1st), mid from the 1st, deep from the 2nd —
  // gives multi-interest Glims a little iridescent "mix".
  const a = picks[0];
  const b = picks[1] ?? a;
  const c = picks[2] ?? a;
  return [c[0], a[1], b[2]];
}

export const GREY_PALETTE: GlimPalette = ['#E4E4EA', '#A1A1AA', '#52525B'];

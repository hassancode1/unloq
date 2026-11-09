import { SIGIL_DUOS } from '../../lib/sigil';
/** A path's duotone (same palette as the app). */
export function duo(color: string | null | undefined): [string, string] {
  const d = (SIGIL_DUOS as Record<string, readonly string[]>)[color ?? ''];
  return d ? [d[0], d[1]] : ['#B9A6FF', '#7FB2FF'];
}

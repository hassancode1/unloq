// Each path has its own mark (sigil) and duotone pair. Paths you follow never
// share a pair: earlier-followed paths keep theirs, later ones step to the
// next free pair, so nothing shifts around when you follow something new.
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { SIGIL_DUOS, SIGIL_DUO_NAMES, duoForSeed, isSigilDuo, type SigilDuo } from './sigil';
import { usePathCatalog } from './usePaths';

type Styleable = { _id: string; slug: string; sigil?: string | null; color?: string | null };

export interface PathStyle {
  /** What to feed makeSigil: the curated spec, else the slug. */
  sigil: string;
  duo: readonly [string, string];
  /** Main colour for progress bars, timeline dots, labels. */
  accent: string;
}

function preferredDuo(p: Styleable): SigilDuo {
  return isSigilDuo(p.color) ? p.color : duoForSeed(p.slug || p._id);
}

function styleOf(p: Styleable, duo: SigilDuo): PathStyle {
  const pair = SIGIL_DUOS[duo];
  return { sigil: p.sigil || p.slug || p._id, duo: pair, accent: pair[0] };
}

/** Returns styleFor(path). */
export function usePathStyles() {
  const activePaths = useAppStore((s) => s.activePaths);
  const { byId } = usePathCatalog();

  const assigned = useMemo(() => {
    const out = new Map<string, SigilDuo>();
    const used = new Set<SigilDuo>();
    const followed = Object.entries(activePaths)
      .sort((a, b) => a[1].addedAt - b[1].addedAt)
      .map(([id]) => byId.get(id))
      .filter(Boolean) as Styleable[];
    for (const p of followed) {
      const start = SIGIL_DUO_NAMES.indexOf(preferredDuo(p));
      let pick = SIGIL_DUO_NAMES[start];
      for (let k = 0; k < SIGIL_DUO_NAMES.length; k++) {
        const d = SIGIL_DUO_NAMES[(start + k) % SIGIL_DUO_NAMES.length];
        if (!used.has(d)) { pick = d; break; }
      }
      used.add(pick);
      out.set(p._id, pick);
    }
    return out;
  }, [activePaths, byId]);

  return (p: Styleable): PathStyle => styleOf(p, assigned.get(p._id) ?? preferredDuo(p));
}

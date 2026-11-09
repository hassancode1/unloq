// Path sigils: a unique two-tone geometric mark for every learning path.
//
// A sigil is a 2×2 grid of Bauhaus-style pieces (quarter discs, arches, half
// discs, leaves, triangles…). The path's seed picks a *composition rule* —
// how pieces rotate (outward, inward, pinwheel, mirrored) and how the two
// tones split (left/right, top/bottom, diagonal) — so every mark looks
// deliberately designed, never random noise. Pure TS: no React, no Skia,
// so it can also be rendered to SVG for previews.

export interface SigilPiece {
  /** SVG path data in a `size`×`size` box. */
  d: string;
  /** 0 = first duotone colour, 1 = second. */
  tone: 0 | 1;
  /** Grid cell: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right. */
  cell: 0 | 1 | 2 | 3;
}

// ── Seeded randomness ────────────────────────────────────────────────────────

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Primitives ───────────────────────────────────────────────────────────────
// Unit cell 0..1, y down. Each "faces" top-right by default (its curve or
// open side points there) so rotations line up across shapes.
// Commands: M/L take a point; A is a circular arc (radius, sweep, end point).

type Cmd = ['M', number, number] | ['L', number, number] | ['A', number, 0 | 1, number, number] | ['Z'];

const PRIMS = {
  // quarter disc pivoting on the bottom-left corner
  quarter: [['M', 0, 1], ['L', 0, 0], ['A', 1, 1, 1, 1], ['Z']],
  // square with the top-right corner fully rounded
  bloom: [['M', 0, 1], ['L', 0, 0], ['L', 0.5, 0], ['A', 0.5, 1, 1, 0.5], ['L', 1, 1], ['Z']],
  // lens between bottom-left and top-right corners
  leaf: [['M', 0, 1], ['A', 1, 1, 1, 0], ['A', 1, 1, 0, 1], ['Z']],
  // right triangle, hypotenuse facing top-right
  wedge: [['M', 0, 0], ['L', 1, 1], ['L', 0, 1], ['Z']],
  // half disc sitting on the left edge, bulging right
  dome: [['M', 0, 0], ['A', 0.5, 1, 0, 1], ['Z']],
  // arch: flat bottom, round top
  arch: [['M', 0, 1], ['L', 0, 0.5], ['A', 0.5, 1, 1, 0.5], ['L', 1, 1], ['Z']],
  // full disc
  disc: [['M', 0, 0.5], ['A', 0.5, 1, 1, 0.5], ['A', 0.5, 1, 0, 0.5], ['Z']],
  // full square
  block: [['M', 0, 0], ['L', 1, 0], ['L', 1, 1], ['L', 0, 1], ['Z']],
} satisfies Record<string, Cmd[]>;

type Prim = keyof typeof PRIMS;

/** Shapes with a direction (rotation changes them). */
const DIRECTIONAL: Prim[] = ['quarter', 'bloom', 'leaf', 'wedge', 'dome', 'arch'];

// Families keep a sigil's vocabulary consistent: one lead shape, sometimes a
// single accent piece of a compatible shape.
const FAMILIES: { lead: Prim; accents: Prim[] }[] = [
  { lead: 'quarter', accents: ['disc', 'block', 'leaf'] },
  { lead: 'bloom', accents: ['disc', 'quarter'] },
  { lead: 'leaf', accents: ['disc', 'quarter'] },
  { lead: 'wedge', accents: ['block', 'quarter', 'disc'] },
  { lead: 'arch', accents: ['disc', 'block', 'quarter'] },
];

/** Rotation (quarter turns, clockwise) that makes a top-right-facing piece face out of its cell. */
const OUTWARD: Record<number, number> = { 0: 3, 1: 0, 2: 2, 3: 1 };

type Rotation = 'outward' | 'inward' | 'pinwheel' | 'mirror' | 'parallel';
type Split = 'vertical' | 'horizontal' | 'diagonal' | 'single-accent';

function rotatePt(x: number, y: number, q: number): [number, number] {
  // clockwise quarter turns around the cell centre (0.5, 0.5)
  let px = x - 0.5, py = y - 0.5;
  for (let i = 0; i < q; i++) [px, py] = [-py, px];
  return [px + 0.5, py + 0.5];
}

function toSvg(cmds: Cmd[], q: number, ox: number, oy: number, s: number): string {
  const f = (n: number) => Number(n.toFixed(2));
  return cmds
    .map((c) => {
      if (c[0] === 'Z') return 'Z';
      if (c[0] === 'A') {
        const [x, y] = rotatePt(c[3], c[4], q);
        const r = c[1] * s;
        return `A${f(r)} ${f(r)} 0 0 ${c[2]} ${f(ox + x * s)} ${f(oy + y * s)}`;
      }
      const [x, y] = rotatePt(c[1], c[2], q);
      return `${c[0]}${f(ox + x * s)} ${f(oy + y * s)}`;
    })
    .join(' ');
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

interface Spec {
  lead: Prim;
  rotation: Rotation;
  split: Split;
  base: number;
  empty: number;
  accent: Prim;
  accentCell: number;
  /** For 'single-accent': the one cell in the second tone. */
  toneCell: number;
  /** Exact piece per cell: shape + quarter turns (overrides everything else). */
  cells: Partial<Record<number, { prim: Prim; q: number }>>;
}

const ROTATIONS: Rotation[] = ['outward', 'inward', 'pinwheel', 'mirror', 'parallel'];
const SPLITS: Split[] = ['vertical', 'horizontal', 'diagonal', 'single-accent'];

/**
 * Hand-written spec, e.g. "arch.parallel.vertical" or
 * "leaf.outward.diagonal.b1.e3.a:disc@2.t0":
 *   <lead>.<rotation>.<split>  then optional  bN (base turn) · eN (empty cell)
 *   · a:<shape>@N (accent piece in cell N) · tN (second-tone cell for single-accent)
 *   · cN:<shape>:<turns> (exact piece for cell N, e.g. c2:wedge:2)
 */
function parseSpec(spec: string): Spec | null {
  const [lead, rotation, split, ...rest] = spec.split('.');
  if (!(lead in PRIMS) || !ROTATIONS.includes(rotation as Rotation) || !SPLITS.includes(split as Split)) return null;
  const out: Spec = {
    lead: lead as Prim, rotation: rotation as Rotation, split: split as Split,
    base: 0, empty: -1, accent: 'disc', accentCell: -1, toneCell: 3, cells: {},
  };
  for (const t of rest) {
    if (t.startsWith('a:')) {
      const [shape, cell] = t.slice(2).split('@');
      if (shape in PRIMS) { out.accent = shape as Prim; out.accentCell = Number(cell); }
    } else if (/^c[0-3]:/.test(t)) {
      const [, shape, turns] = t.split(':');
      if (shape in PRIMS) out.cells[Number(t[1])] = { prim: shape as Prim, q: Number(turns) % 4 };
    } else if (t[0] === 'b') out.base = Number(t.slice(1)) % 4;
    else if (t[0] === 'e') out.empty = Number(t.slice(1));
    else if (t[0] === 't') out.toneCell = Number(t.slice(1));
  }
  return out;
}

function randomSpec(seed: string): Spec {
  const r = rng(seed);
  const fam = pick(r, FAMILIES);
  return {
    lead: fam.lead,
    rotation: pick<Rotation>(r, ['outward', 'outward', 'inward', 'pinwheel', 'mirror', 'parallel']),
    split: pick<Split>(r, ['vertical', 'vertical', 'horizontal', 'diagonal', 'single-accent']),
    base: Math.floor(r() * 4),
    // 4 pieces most of the time; sometimes leave one cell empty for air.
    empty: r() < 0.25 ? Math.floor(r() * 4) : -1,
    // at most one accent piece
    accentCell: r() < 0.45 ? Math.floor(r() * 4) : -1,
    accent: pick(r, fam.accents),
    toneCell: Math.floor(r() * 4),
    cells: {},
  };
}

/**
 * Build a sigil. `source` is either a hand-written spec (curated paths) or any
 * seed string such as a slug (generated). `gap` = gutter as a fraction of a cell.
 */
export function makeSigil(source: string, size = 100, gap = 0.06): SigilPiece[] {
  const { lead, rotation, split, base, empty, accent, accentCell, toneCell, cells } = parseSpec(source) ?? randomSpec(source);
  const fam = { lead };
  const accentTone = toneCell;
  const toneOf = (cell: number): 0 | 1 => {
    const col = cell % 2, row = cell >> 1;
    switch (split) {
      case 'vertical': return col as 0 | 1;
      case 'horizontal': return row as 0 | 1;
      case 'diagonal': return ((col + row) % 2) as 0 | 1;
      default: return cell === accentTone ? 1 : 0;
    }
  };

  const rotOf = (cell: number): number => {
    switch (rotation) {
      case 'outward': return OUTWARD[cell];
      case 'inward': return (OUTWARD[cell] + 2) % 4;
      // clockwise around the grid: TL, TR, BR, BL
      case 'pinwheel': return (base + [0, 1, 3, 2][cell]) % 4;
      // left column mirrors the right one (as close as rotation allows)
      case 'mirror': return cell % 2 === 0 ? (base + 3) % 4 : base;
      default: return base;
    }
  };

  const cellSize = size / (2 + gap);
  const step = cellSize * (1 + gap);
  const pieces: SigilPiece[] = [];
  for (let cell = 0 as 0 | 1 | 2 | 3; cell < 4; cell = (cell + 1) as 0 | 1 | 2 | 3) {
    if (cell === empty) continue;
    const exact = cells[cell];
    const prim: Prim = exact?.prim ?? (cell === accentCell ? accent : fam.lead);
    const q = exact ? exact.q : DIRECTIONAL.includes(prim) ? rotOf(cell) : 0;
    const ox = (cell % 2) * step;
    const oy = (cell >> 1) * step;
    pieces.push({ d: toSvg(PRIMS[prim], q, ox, oy, cellSize), tone: toneOf(cell), cell });
  }

  // Guarantee both tones appear.
  if (pieces.length > 1 && pieces.every((p) => p.tone === pieces[0].tone)) {
    pieces[pieces.length - 1].tone = pieces[0].tone === 0 ? 1 : 0;
  }
  return pieces;
}

// ── Duotone palettes ─────────────────────────────────────────────────────────
// One tuned family: similar softness and brightness so every pair belongs to
// the same set on the dark UI, while each pair stays distinct.

export const SIGIL_DUOS = {
  'amber-mint':   ['#F6C76B', '#8FE0B0'],
  'coral-peach':  ['#FF8C7A', '#FFD3A8'],
  'lilac-sky':    ['#B7A4FF', '#8ECFFF'],
  'rose-violet':  ['#FF9CC6', '#A78BFA'],
  'lime-teal':    ['#C9EE7B', '#5CD3C3'],
  'tangerine-rose': ['#FFA35C', '#FF7FA4'],
  'cobalt-ice':   ['#7FA6FF', '#CFE2FF'],
  'teal-butter':  ['#52CFC2', '#F3E27C'],
  'brick-sand':   ['#FF7A6B', '#EFD3A4'],
  'jade-sky':     ['#6FE3A6', '#7CC6FF'],
  'orchid-gold':  ['#E58CFF', '#FFD36E'],
  'sage-blush':   ['#A8D8A0', '#FFB3B3'],
} as const;

export type SigilDuo = keyof typeof SIGIL_DUOS;
export const SIGIL_DUO_NAMES = Object.keys(SIGIL_DUOS) as SigilDuo[];

export function isSigilDuo(x: unknown): x is SigilDuo {
  return typeof x === 'string' && x in SIGIL_DUOS;
}

/** Stable duo for a seed when a path has no curated one. */
export function duoForSeed(seed: string): SigilDuo {
  return SIGIL_DUO_NAMES[hash(`duo:${seed}`) % SIGIL_DUO_NAMES.length];
}

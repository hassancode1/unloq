// Numbers for the Profile highlights and the Stats screen. Pure functions over
// the quest log (daily quests) + extras ("Keep learning" quests).
import { currentStreak, dayKey, type QuestEntry } from './quests';

export interface Learned {
  day: string;          // YYYY-MM-DD
  entry: QuestEntry;
  extra: boolean;       // a "Keep learning" quest
}

/** Every quest, newest first. */
export function allLearned(questLog: Record<string, QuestEntry>, extras: Record<string, QuestEntry[]> = {}): Learned[] {
  const out: Learned[] = [];
  for (const [day, entry] of Object.entries(questLog)) out.push({ day, entry, extra: false });
  for (const [day, list] of Object.entries(extras)) for (const entry of list) out.push({ day, entry, extra: true });
  return out.sort((a, b) => b.entry.completedAt - a.entry.completedAt);
}

export function bestStreak(days: string[]) {
  const sorted = [...days].sort();
  let best = 0, run = 0, prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(`${k}T12:00:00`);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

export function summarize(questLog: Record<string, QuestEntry>, items: Learned[]) {
  // Read-only days count for the streak and "learned", not for scores.
  const explained = items.filter((i) => !i.entry.readOnly);
  const chrono = [...explained].reverse();
  return {
    learned: items.length,
    explained: explained.length,
    streak: currentStreak(questLog),
    best: bestStreak(Object.keys(questLog)),
    score: avg(explained.map((i) => i.entry.score)),
    accuracy: avg(explained.map((i) => i.entry.accuracy)),
    clarity: avg(explained.map((i) => i.entry.clarity)),
    articulation: avg(explained.map((i) => i.entry.articulation)),
    /** Last 14 explained scores, oldest → newest (for the trend line). */
    trend: chrono.slice(-14).map((i) => i.entry.score),
  };
}

export interface PathStat { pathId: string; title: string; count: number; avg: number; last: QuestEntry }

/** How you've done in each path (most learned first). */
export function byPath(items: Learned[]): PathStat[] {
  const map = new Map<string, Learned[]>();
  for (const i of items) {
    if (!i.entry.pathId) continue;
    map.set(i.entry.pathId, [...(map.get(i.entry.pathId) ?? []), i]);
  }
  return [...map.entries()]
    .map(([pathId, list]) => ({
      pathId,
      title: list[0].entry.pathTitle ?? 'Path',
      count: list.length,
      avg: avg(list.filter((i) => !i.entry.readOnly).map((i) => i.entry.score)),
      last: list[0].entry,
    }))
    .sort((a, b) => b.count - a.count || b.last.completedAt - a.last.completedAt);
}

/** A month as weeks (Mon→Sun) of day keys; null = padding outside the month. */
export function monthWeeks(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

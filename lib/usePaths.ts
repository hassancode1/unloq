// Client side of learning paths: catalog, starter seeding, and today's wheel options.
import { useConvexAuth, useQuery } from 'convex/react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { useAppStore } from '../store/useAppStore';
import { dayKey } from './quests';

export interface PathSummary {
  _id: string;
  slug: string;
  title: string;
  subtitle: string;
  interest: string;
  curated: boolean;
  status: 'outlining' | 'ready' | 'error';
  topicCount: number;
  trending?: boolean;
  /** Mark spec for curated paths; generated from the slug otherwise. */
  sigil?: string | null;
  /** Duotone pair name (SIGIL_DUOS). */
  color?: string | null;
}

/** One option on the daily wheel. */
export interface QuestItem {
  key: string;
  kind: 'path' | 'discover';
  path: PathSummary;
  topicId: string;
  order: number;
  title: string;
  /** The plain topic behind the question title ("Compound interest"). */
  concept?: string | null;
}

/** Curated + the user's own paths, by id. */
export function usePathCatalog() {
  const { isAuthenticated } = useConvexAuth();
  const curated = useQuery(api.paths.listCurated) as PathSummary[] | undefined;
  const mine = useQuery(api.paths.listMine, isAuthenticated ? {} : 'skip') as PathSummary[] | undefined;
  return useMemo(() => {
    const byId = new Map<string, PathSummary>();
    for (const p of curated ?? []) byId.set(p._id, p);
    for (const p of mine ?? []) byId.set(p._id, p);
    return { curated: curated ?? [], mine: mine ?? [], byId, loading: curated === undefined };
  }, [curated, mine]);
}

/** Most starter paths we follow from onboarding interests. */
const MAX_STARTER = 5;

/**
 * Follow one curated path per onboarding interest (in the order picked).
 * Runs again when new curated paths appear for an interest that had none, but
 * never re-adds an interest the user has already been given a path for —
 * so unfollowing sticks.
 */
export function useStarterPaths() {
  const { curated, byId, loading } = usePathCatalog();
  const seeded = useAppStore((s) => s.pathsSeeded);
  const seededInterests = useAppStore((s) => s.seededInterests) ?? [];
  const activePaths = useAppStore((s) => s.activePaths);
  const interests = useAppStore((s) => s.glim.interests);
  const seedPaths = useAppStore((s) => s.seedPaths);

  useEffect(() => {
    if (loading || curated.length === 0) return;
    const followedInterests = new Set(
      Object.keys(activePaths).map((id) => byId.get(id)?.interest).filter(Boolean) as string[],
    );
    const todo = interests.filter(
      (i) => !seededInterests.includes(i) && curated.some((p) => p.interest === i),
    );
    if (todo.length === 0) {
      if (!seeded) seedPaths([], []);
      return;
    }
    const room = Math.max(0, MAX_STARTER - Object.keys(activePaths).length);
    const picks: string[] = [];
    const handled: string[] = [];
    for (const i of todo) {
      // Already following something in this interest → just mark it done.
      if (followedInterests.has(i)) { handled.push(i); continue; }
      if (picks.length >= room) break; // the rest stay pending until there's room
      const p = curated.find((c) => c.interest === i && !activePaths[c._id]);
      if (p) picks.push(p._id);
      handled.push(i);
    }
    if (handled.length || !seeded) seedPaths(picks, handled);
  }, [loading, curated, interests, seededInterests.join(','), Object.keys(activePaths).length]);
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Today's wheel: the next topic of each followed path + one Discover pick
 * (the first topic of a curated path you don't follow, stable for the day).
 * `items` is undefined while loading; [] means nothing available (use the local bank).
 */
export function useTodayItems(): QuestItem[] | undefined {
  const activePaths = useAppStore((s) => s.activePaths);
  const { curated, loading } = usePathCatalog();

  const discover = useMemo(() => {
    const candidates = curated.filter((p) => !activePaths[p._id]);
    return candidates.length ? candidates[hash(dayKey()) % candidates.length] : null;
  }, [curated, activePaths]);

  const progress = useMemo(() => {
    const list = Object.entries(activePaths).map(([pathId, a]) => ({ pathId: pathId as Id<'paths'>, order: a.order }));
    if (discover) list.push({ pathId: discover._id as Id<'paths'>, order: 0 });
    return list;
  }, [activePaths, discover]);

  const rows = useQuery(api.paths.nextTopics, loading ? 'skip' : { progress });

  return useMemo(() => {
    if (rows === undefined) return undefined;
    return rows.map((r: any) => {
      const isDiscover = discover?._id === r.path._id && !activePaths[r.path._id];
      return {
        key: `${r.path._id}:${r.topic.order}`,
        kind: isDiscover ? 'discover' : 'path',
        path: r.path,
        topicId: r.topic._id,
        order: r.topic.order,
        title: r.topic.title,
        concept: r.topic.concept ?? null,
      } as QuestItem;
    });
  }, [rows]);
}

/** Resolves to undefined until it times out, so callers can fall back. */
export function useTimedOut(ms: number) {
  const [out, setOut] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOut(true), ms); return () => clearTimeout(t); }, []);
  return out;
}

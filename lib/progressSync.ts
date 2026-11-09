// Backs up the on-device learning state to the signed-in account and restores
// it on a new phone. Progress only ever grows: merging never loses XP, quest
// days or path progress from either side.
import { useMutation, useQuery, useConvexAuth } from 'convex/react';
import { useEffect, useRef } from 'react';
import { api } from '../convex/_generated/api';
import { useAppStore } from '../store/useAppStore';
import type { QuestEntry } from './quests';

type State = ReturnType<typeof useAppStore.getState>;

export interface Snapshot {
  glim: State['glim'];
  questLog: State['questLog'];
  extras: State['extras'];
  activePaths: State['activePaths'];
  pathsSeeded: boolean;
  seededInterests: string[];
}

export function snapshot(s: State): Snapshot {
  return {
    glim: s.glim,
    questLog: s.questLog,
    extras: s.extras ?? {},
    activePaths: s.activePaths,
    pathsSeeded: s.pathsSeeded,
    seededInterests: s.seededInterests ?? [],
  };
}

/** A device that hasn't onboarded or done anything yet. */
function isFresh(s: Snapshot) {
  return s.glim.interests.length === 0 && Object.keys(s.questLog).length === 0;
}

const better = (a: QuestEntry, b: QuestEntry) => {
  if (!!a.readOnly !== !!b.readOnly) return a.readOnly ? b : a; // explained beats read-only
  return a.xp >= b.xp ? a : b;
};

export function merge(local: Snapshot, remote: Partial<Snapshot> | null | undefined): Snapshot {
  if (!remote?.glim) return local;
  const r = remote as Snapshot;
  // New phone / reinstall: just take the backup.
  if (isFresh(local)) return { ...r, extras: r.extras ?? {}, seededInterests: r.seededInterests ?? [] };

  const questLog = { ...r.questLog };
  for (const [day, e] of Object.entries(local.questLog)) questLog[day] = questLog[day] ? better(questLog[day], e) : e;

  // extra quests: union per day, de-duplicated by when they were completed
  const extras: Snapshot['extras'] = { ...(r.extras ?? {}) };
  for (const [day, list] of Object.entries(local.extras ?? {})) {
    const seen = new Set((extras[day] ?? []).map((e) => e.completedAt));
    extras[day] = [...(extras[day] ?? []), ...list.filter((e) => !seen.has(e.completedAt))];
  }

  const activePaths = { ...r.activePaths };
  for (const [id, a] of Object.entries(local.activePaths)) {
    const o = activePaths[id];
    activePaths[id] = o ? { order: Math.max(o.order, a.order), addedAt: Math.min(o.addedAt, a.addedAt) } : a;
  }

  return {
    // This device's Glim (name, interests, settings), never shrinking.
    glim: {
      ...local.glim,
      xp: Math.max(local.glim.xp, r.glim.xp ?? 0),
      stage: Math.max(local.glim.stage, r.glim.stage ?? 0) as State['glim']['stage'],
    },
    questLog,
    extras,
    activePaths,
    pathsSeeded: local.pathsSeeded || !!r.pathsSeeded,
    seededInterests: Array.from(new Set([...(local.seededInterests ?? []), ...(r.seededInterests ?? [])])),
  };
}

/** Mount once inside the Convex provider. */
export function ProgressSync() {
  const { isAuthenticated } = useConvexAuth();
  const remote = useQuery(api.progress.mine, isAuthenticated ? {} : 'skip');
  const save = useMutation(api.progress.save);
  const merged = useRef(false);

  // Sign-in: merge the backup into this device once, then push the result.
  useEffect(() => {
    if (!isAuthenticated) { merged.current = false; return; }
    if (remote === undefined || merged.current) return;
    merged.current = true;
    const next = merge(snapshot(useAppStore.getState()), remote?.data);
    useAppStore.setState(next);
    save({ data: next, updatedAt: Date.now() }).catch(() => {});
  }, [isAuthenticated, remote]);

  // Afterwards: back up changes, debounced.
  useEffect(() => {
    if (!isAuthenticated) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = useAppStore.subscribe((s, prev) => {
      if (!merged.current) return;
      if (s.glim === prev.glim && s.questLog === prev.questLog && s.extras === prev.extras && s.activePaths === prev.activePaths
        && s.seededInterests === prev.seededInterests) return;
      clearTimeout(t);
      t = setTimeout(() => {
        save({ data: snapshot(useAppStore.getState()), updatedAt: Date.now() }).catch(() => {});
      }, 2000);
    });
    return () => { unsub(); clearTimeout(t); };
  }, [isAuthenticated]);

  return null;
}

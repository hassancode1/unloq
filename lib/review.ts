// Asks for an App Store rating right after an "aha" moment — never after a
// miss, never before someone has really used the app, never naggy.
// Apple shows the prompt at most 3×/year (and may skip it), so we only spend
// it on the best moments: Glim evolving, a 90+ score, or a 7-day streak.
import * as StoreReview from 'expo-store-review';
import { useAppStore } from '../store/useAppStore';
import { currentStreak } from './quests';

const MIN_EXPLAINED = 3;            // real (explained) quests before we ever ask
const COOLDOWN_MS = 30 * 86400000;  // our own gap between asks
const STREAK_MOMENT = 7;

export interface AhaMoment {
  evolved: boolean;
  score: number;
  earned: boolean;
}

/** Call once the result celebration has finished. */
export async function maybeAskForReview({ evolved, score, earned }: AhaMoment) {
  if (!earned) return; // a miss is never the moment
  const st = useAppStore.getState();
  const explained = [
    ...Object.values(st.questLog),
    ...Object.values(st.extras ?? {}).flat(),
  ].filter((e) => !e.readOnly).length;
  if (explained < MIN_EXPLAINED) return;
  if (st.reviewAskedAt && Date.now() - st.reviewAskedAt < COOLDOWN_MS) return;

  const streak = currentStreak(st.questLog);
  const aha = evolved || score >= 90 || streak === STREAK_MOMENT;
  if (!aha) return;

  try {
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;
    st.setReviewAskedAt(Date.now());
    await StoreReview.requestReview();
  } catch {}
}

// How much Glim grows. Shared by the AI grader (server) and the on-device
// grader, so both reward the same way.
//
// Only good explanations earn XP — a weak one earns 0 (never negative: XP
// never goes down). Missed ideas come back later as a review for bonus XP.

/** Below this score an explanation earns nothing. */
export const XP_MIN_SCORE = 50;
/** At or above this it's "great": a bonus on top. */
export const XP_GREAT_SCORE = 90;
const GREAT_BONUS = 5;

/** 0 under 50; 50 → 5 … 89 → 21; 90+ → 21–25 plus a 5 bonus. */
export function xpForScore(score: number): number {
  if (score < XP_MIN_SCORE) return 0;
  const base = Math.round(5 + (score - XP_MIN_SCORE) * 0.4);
  return score >= XP_GREAT_SCORE ? base + GREAT_BONUS : base;
}

/** Reviewing missed ideas a few days later. */
export const REVIEW_AFTER_DAYS = 3;
export const REVIEW_XP = 10;
export const REVIEW_GREAT_BONUS = 5;

// ── Keep learning: extra quests after the daily one ──────────────────────────
// Paying users can keep going, but Glim can only take in so much a day — so
// binge learning can't race it ahead (max ~1.6× the one-a-day pace). Extras are
// still fully graded; they just add little growth, and nothing past the cap.
export const EXTRA_MULTIPLIERS = [0.4, 0.25, 0.15, 0.1];
export const EXTRA_XP_DAILY_CAP = 12;
/** Fair use: the daily quest + extras (bounds AI cost). */
export const MAX_QUESTS_PER_DAY = 10;

/** XP for the n-th extra quest today (0-based), given extra XP already earned today. */
export function extraXp(baseXp: number, extraIndex: number, extraXpToday: number): number {
  const m = EXTRA_MULTIPLIERS[Math.min(extraIndex, EXTRA_MULTIPLIERS.length - 1)];
  return Math.max(0, Math.min(Math.round(baseXp * m), EXTRA_XP_DAILY_CAP - extraXpToday));
}

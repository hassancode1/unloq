// Product switches. Flip a flag to bring a hidden feature back — its code and
// data are kept.

/**
 * Notes (upload PDFs / text / YouTube → flashcards, quizzes, mind maps).
 * Hidden since the pivot to paths + Glim; the + button creates a path instead.
 */
export const NOTES_ENABLED = false;

/**
 * true  = hard paywall: start the 3-day trial (or subscribe) to use the app;
 *         when it ends without a subscription, the app shows the "Glim is
 *         resting" screen. Progress is always kept.
 * false = soft paywall: reading stays free ("just read" keeps the streak),
 *         explaining + custom paths are Pro.
 */
export const HARD_PAYWALL = true;

/** Dev only: skip the paywall gate while building (sandbox purchases still work when false). */
export const DEV_FORCE_PRO = __DEV__ && true;

/**
 * Dev only: replay the guided first quest on every launch. Today acts as if
 * no quest is done yet (your real progress is untouched; the quest saves as an
 * extra). Turn off when done.
 */
export const GUIDE_PREVIEW = __DEV__ && false;

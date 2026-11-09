// The reminder plan as a pure function (no phone APIs), so the rules are testable.
// See the "Daily nudge" notes in lib/notifications.ts.

export const NUDGE_OFFSETS = [1, 2, 3, 5, 7]; // days after the last quest
const MIN_HOUR = 8;
const MAX_HOUR = 22;

export function clampTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  let hour = Number.isFinite(h) ? h : 20;
  let minute = Number.isFinite(m) ? m : 0;
  if (hour < MIN_HOUR) { hour = MIN_HOUR; minute = 0; }
  if (hour > MAX_HOUR || (hour === MAX_HOUR && minute > 0)) { hour = MAX_HOUR; minute = 0; }
  return { hour, minute };
}

/** Glim's voice, different each day, never guilt. */
export function nudgeCopy(name: string, offset: number, streak: number, dayIndex: number): { title: string; body: string } {
  if (offset === 1 && streak >= 3) {
    return { title: `Keep your ${streak}-day streak alive`, body: `${name} is ready when you are. It takes about 2 minutes.` };
  }
  if (offset >= 5) {
    return { title: `${name} is still here`, body: 'Whenever you’re ready, a new question is waiting.' };
  }
  const lines = [
    { title: 'Your quest is ready', body: `A new question is waiting. Explain it and help ${name} grow.` },
    { title: `${name} is hungry to learn`, body: 'Two minutes, one idea. Swap a scroll for it.' },
    { title: `Can you explain something to ${name}?`, body: 'Today’s question is ready.' },
    { title: 'One small thing today', body: `Learn something, teach it to ${name}.` },
    { title: `${name} has a question for you`, body: 'It takes about 2 minutes.' },
  ];
  return lines[((dayIndex % lines.length) + lines.length) % lines.length];
}

export interface Nudge { at: Date; offset: number; title: string; body: string }

/**
 * @param last   the day of the last quest (or today when there are none yet)
 * @param now    the current time
 * @param streak streak as of `last`
 */
export function planNudges(opts: { last: Date; now: Date; hhmm: string; name: string; streak: number }): Nudge[] {
  const { hour, minute } = clampTime(opts.hhmm);
  const out: Nudge[] = [];
  for (const offset of NUDGE_OFFSETS) {
    const at = new Date(opts.last);
    at.setDate(at.getDate() + offset);
    at.setHours(hour, minute, 0, 0);
    if (at.getTime() <= opts.now.getTime() + 60_000) continue; // already past
    const dayIndex = Math.floor(at.getTime() / 86_400_000);
    out.push({ at, offset, ...nudgeCopy(opts.name, offset, opts.streak, dayIndex) });
  }
  return out;
}

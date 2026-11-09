// Daily quest content + streak/XP rules.
// Local bank for now — AI-generated topics from the user's interests come later.
import { INTERESTS } from '../components/onboarding/content';
import { FACT_KEYWORDS } from '../components/onboarding/grade';
import type { GlimStage } from '../components/mascot/Glim';

export interface Quest {
  id: string;
  interest: string;
  title: string;
  body: string;
  /** Each entry is one key idea; any variant counts as a hit when grading. */
  keywords: string[][];
}

export interface QuestEntry {
  questId: string;
  interest: string;
  title: string;
  score: number;
  accuracy: number;
  clarity: number;
  articulation: number;
  xp: number;
  feedback: string;
  completedAt: number;
  /** Set when the quest came from a server path. */
  pathId?: string;
  topicId?: string;
  pathTitle?: string;
  /** The plain topic behind the question title ("Compound interest"). */
  concept?: string;
  /** Read but not explained (no Pro): keeps the streak and path moving, no XP. */
  readOnly?: boolean;
  /** Key ideas left out — they come back as a review. */
  missed?: string[];
  /** When the review becomes available (ms). Unset = nothing to review. */
  reviewAfter?: number;
  /** Set once the review was passed. */
  reviewedAt?: number;
  /** Bonus XP earned from the review. */
  reviewXp?: number;
  /** Saved feedback, so any past explanation can be looked back on (Stats → quest). */
  praise?: string;
  tip?: string;
  betterVersion?: string;
  /** What they said (trimmed to keep the account backup small). */
  transcript?: string;
  /** Ideas they left out, kept for the quest's detail view. */
  missedIdeas?: string[];
  /** The path mark + colours shown when it was learned — so it never changes later (or offline). */
  look?: { sigil: string; duo: [string, string] };
}

/**
 * The oldest quest whose missed ideas are ready to review (path quests only:
 * the review re-reads the same topic). Undefined when nothing is due.
 */
export function dueReview(log: Record<string, QuestEntry>, now = Date.now()) {
  return Object.entries(log)
    .filter(([, e]) => !e.readOnly && e.topicId && e.missed?.length && e.reviewAfter && e.reviewAfter <= now && !e.reviewedAt)
    .sort((a, b) => (a[1].reviewAfter ?? 0) - (b[1].reviewAfter ?? 0))
    .map(([day, entry]) => ({ day, entry }))[0];
}

const EXTRA: Quest[] = [
  { id: 'space-2', interest: 'space', title: 'Neutron stars are unbelievably dense',
    body: 'A neutron star packs more mass than the Sun into a ball about 20 km wide. A single teaspoon of it would weigh around a billion tonnes on Earth.',
    keywords: [['neutron'], ['sun', 'mass'], ['20', 'city', 'small'], ['teaspoon', 'spoon'], ['billion', 'tonne', 'ton', 'heavy', 'weigh']] },
  { id: 'space-3', interest: 'space', title: 'Sunlight you see is 8 minutes old',
    body: 'Light from the Sun takes about 8 minutes and 20 seconds to reach Earth. If the Sun vanished, you would not notice for over 8 minutes.',
    keywords: [['light'], ['8', 'eight'], ['minute'], ['vanish', 'disappear', 'gone', 'notice', 'past', 'old']] },
  { id: 'history-2', interest: 'history', title: 'Oxford is older than the Aztecs',
    body: 'Teaching at Oxford University began around 1096. The Aztec capital Tenochtitlan was founded in 1325 — more than two centuries later.',
    keywords: [['oxford', 'universit'], ['aztec', 'tenochtitlan'], ['1096', '11th', 'eleven'], ['1325', 'later', 'after', 'centur']] },
  { id: 'history-3', interest: 'history', title: 'The shortest war lasted under an hour',
    body: 'In 1896 Britain and Zanzibar fought the Anglo-Zanzibar War. It ended after roughly 38 to 45 minutes, when the sultan’s palace was shelled.',
    keywords: [['zanzibar'], ['britain', 'british', 'england'], ['38', '45', 'minute', 'hour', 'short'], ['1896'], ['palace', 'sultan', 'shell']] },
  { id: 'psychology-2', interest: 'psychology', title: 'The Zeigarnik effect',
    body: 'People remember unfinished tasks better than finished ones. An open loop keeps nagging your mind until you close it — which is why cliffhangers work.',
    keywords: [['zeigarnik'], ['unfinish', 'incomplete', 'not finish', 'open'], ['remember', 'memor', 'stick', 'nag'], ['cliffhanger', 'close', 'loop']] },
  { id: 'psychology-3', interest: 'psychology', title: 'Retrieval beats re-reading',
    body: 'Testing yourself — pulling an idea out of memory — strengthens it far more than reading it again. Explaining something out loud is a form of retrieval.',
    keywords: [['test', 'quiz', 'retriev', 'recall'], ['re-read', 'reread', 'read again', 'reading'], ['strong', 'better', 'more', 'stick'], ['explain', 'out loud', 'aloud']] },
  { id: 'money-2', interest: 'money', title: 'Inflation quietly shrinks cash',
    body: 'At 3% inflation, prices double in about 24 years. Cash under the mattress keeps its number but loses about half its buying power over that time.',
    keywords: [['inflation'], ['3', 'three percent'], ['24', 'double', 'twice'], ['cash', 'money', 'mattress', 'saving'], ['half', 'buying power', 'worth less', 'lose']] },
  { id: 'money-3', interest: 'money', title: 'Opportunity cost',
    body: 'The true cost of anything is the best thing you gave up to get it. Spending an evening scrolling costs whatever else you could have done with those hours.',
    keywords: [['opportunity'], ['give up', 'gave up', 'trade', 'instead', 'alternative'], ['best', 'next'], ['time', 'hour', 'evening', 'cost']] },
  { id: 'science-2', interest: 'science', title: 'Bananas are slightly radioactive',
    body: 'Bananas contain potassium, and a small fraction of potassium is radioactive potassium-40. It’s harmless — you’d need millions of bananas at once for it to matter.',
    keywords: [['banana'], ['potassium'], ['radioactiv', 'radiation'], ['40'], ['harmless', 'safe', 'million', 'tiny', 'small']] },
  { id: 'science-3', interest: 'science', title: 'Water expands when it freezes',
    body: 'Most liquids shrink as they solidify, but water expands by about 9% as it turns to ice. That’s why ice floats and frozen pipes burst.',
    keywords: [['water'], ['expand', 'bigger', 'grow'], ['freez', 'ice', 'solid'], ['9', 'nine'], ['float', 'pipe', 'burst']] },
  { id: 'philosophy-2', interest: 'philosophy', title: 'Occam’s razor',
    body: 'When two explanations fit the facts equally well, prefer the one that needs fewer assumptions. Simpler isn’t always true, but it’s the better first bet.',
    keywords: [['occam', 'razor'], ['two', 'explanation', 'theor'], ['simple', 'simpl', 'fewer', 'less'], ['assum']] },
  { id: 'philosophy-3', interest: 'philosophy', title: 'Plato’s cave',
    body: 'Plato imagined prisoners who only ever see shadows on a cave wall and mistake them for reality. Philosophy, he argued, is turning around to see the light.',
    keywords: [['plato'], ['cave'], ['shadow'], ['prisoner', 'chain'], ['real', 'truth', 'light']] },
  { id: 'tech-2', interest: 'tech', title: 'The first computer bug was a real bug',
    body: 'In 1947 engineers working on the Harvard Mark II found a moth stuck in a relay. They taped it in the logbook as the “first actual case of bug being found”.',
    keywords: [['moth', 'insect'], ['1947'], ['harvard', 'mark'], ['relay', 'stuck', 'computer'], ['log', 'tape']] },
  { id: 'tech-3', interest: 'tech', title: 'Moore’s law',
    body: 'In 1965 Gordon Moore noticed the number of transistors on a chip doubled roughly every two years. That trend drove decades of faster, cheaper computers.',
    keywords: [['moore'], ['transistor', 'chip'], ['double'], ['two year', '2 year', 'every two'], ['faster', 'cheap', 'power']] },
  { id: 'health-2', interest: 'health', title: 'Walking boosts creativity',
    body: 'A Stanford study found people came up with around 60% more creative ideas while walking than sitting. The boost lingered for a while after they sat down.',
    keywords: [['walk'], ['creativ', 'ideas'], ['60', 'sixty'], ['sit'], ['stanford', 'study']] },
  { id: 'health-3', interest: 'health', title: 'Thirst lags behind need',
    body: 'By the time you feel thirsty you may already be mildly dehydrated. Even small dehydration can dull focus and mood.',
    keywords: [['thirst'], ['dehydrat', 'water'], ['already', 'late', 'behind', 'before'], ['focus', 'mood', 'concentrat', 'tired']] },
  { id: 'art-2', interest: 'art', title: 'The Mona Lisa got famous by being stolen',
    body: 'In 1911 the Mona Lisa was stolen from the Louvre. The two-year hunt filled newspapers worldwide and turned it into the most famous painting on Earth.',
    keywords: [['mona lisa'], ['stol', 'theft', 'thief'], ['1911'], ['louvre'], ['famous', 'newspaper', 'news']] },
  { id: 'art-3', interest: 'art', title: 'Ultramarine was worth more than gold',
    body: 'The deep blue ultramarine was ground from lapis lazuli mined in Afghanistan. It cost so much that painters saved it for the Virgin Mary’s robes.',
    keywords: [['ultramarine', 'blue'], ['lapis'], ['afghan'], ['gold', 'expensive', 'cost'], ['mary', 'robe']] },
  { id: 'languages-2', interest: 'languages', title: '“Salary” comes from salt',
    body: 'The word traces back to the Latin “salarium”, linked to salt — once so valuable that it was tied to soldiers’ pay in ancient Rome.',
    keywords: [['salary'], ['salt', 'sal'], ['latin', 'salarium'], ['roman', 'rome', 'soldier'], ['pay', 'valuable']] },
  { id: 'languages-3', interest: 'languages', title: 'English has no official academy',
    body: 'French and Spanish have academies that rule on correct usage. English has never had one — its rules come from usage, dictionaries and habit.',
    keywords: [['english'], ['academ'], ['french', 'spanish'], ['rule', 'official', 'correct'], ['usage', 'dictionar', 'habit', 'people']] },
  { id: 'nature-2', interest: 'nature', title: 'Crows recognise faces',
    body: 'Researchers in Seattle wore masks while trapping crows. Years later, crows still scolded anyone wearing those masks — and taught the grudge to others.',
    keywords: [['crow'], ['face', 'recogni'], ['mask'], ['year', 'remember', 'grudge'], ['taught', 'teach', 'other', 'pass']] },
  { id: 'nature-3', interest: 'nature', title: 'Octopus arms can taste',
    body: 'An octopus’s suckers are packed with chemical receptors, so its arms can taste what they touch — and much of its neurons live in those arms.',
    keywords: [['octopus'], ['arm', 'sucker', 'tentacle'], ['taste', 'chemical', 'receptor'], ['touch'], ['neuron', 'brain']] },
];

/** Day-one facts from onboarding + the extra bank. */
export const QUEST_BANK: Quest[] = [
  ...INTERESTS.map((i) => ({
    id: `${i.id}-1`, interest: i.id, title: i.fact.title, body: i.fact.body,
    keywords: FACT_KEYWORDS[i.id] ?? [],
  })),
  ...EXTRA,
];

export function interestMeta(id: string) {
  return INTERESTS.find((i) => i.id === id);
}

/** Candidate pool for the dial: user's interests, unseen first. */
export function questPool(interests: string[], doneIds: string[]): Quest[] {
  const mine = QUEST_BANK.filter((q) => interests.length === 0 || interests.includes(q.interest));
  const fresh = mine.filter((q) => !doneIds.includes(q.id));
  return fresh.length >= 3 ? fresh : mine;
}

/** Pick up to n quests spread across interests (for the dial ring). */
export function dialOptions(pool: Quest[], n = 8): Quest[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const byInterest = new Map<string, Quest[]>();
  for (const q of shuffled) byInterest.set(q.interest, [...(byInterest.get(q.interest) ?? []), q]);
  const out: Quest[] = [];
  while (out.length < n && byInterest.size) {
    for (const [k, list] of byInterest) {
      const q = list.shift();
      if (q) out.push(q);
      if (!list.length) byInterest.delete(k);
      if (out.length >= n) break;
    }
  }
  return out;
}

// ── Dates & streak ────────────────────────────────────────────────────────────
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shift(d: Date, days: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

/** Consecutive days ending today (or yesterday, if today isn't done yet). */
export function currentStreak(log: Record<string, QuestEntry>, now = new Date()) {
  let cursor = log[dayKey(now)] ? now : shift(now, -1);
  let n = 0;
  while (log[dayKey(cursor)]) { n++; cursor = shift(cursor, -1); }
  return n;
}

/** Streak is broken when there's history but neither today nor yesterday is done. */
export function streakBroken(log: Record<string, QuestEntry>, now = new Date()) {
  const any = Object.keys(log).length > 0;
  return any && !log[dayKey(now)] && !log[dayKey(shift(now, -1))];
}

/** Last 7 days, oldest first. */
export function lastWeek(log: Record<string, QuestEntry>, now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = shift(now, i - 6);
    return { key: dayKey(d), label: 'SMTWTFS'[d.getDay()], done: !!log[dayKey(d)], today: i === 6 };
  });
}

// ── Growth ────────────────────────────────────────────────────────────────────
/** Total XP needed to reach each stage. */
// Onboarding starts Glim at 25 (Glow). Realistic, not a quick hook — at
// ~15–20 XP a good quest, one a day:
//   Drop    150  → ~1 week   (the end of the 7-day commitment from onboarding)
//   Bloom   700  → ~6 weeks
//   Radiant 2500 → ~5 months (extra quests can roughly halve that, no more)
export const STAGE_XP = [0, 25, 150, 700, 2500] as const;

export function stageForXp(xp: number): GlimStage {
  let s = 0;
  for (let i = 0; i < STAGE_XP.length; i++) if (xp >= STAGE_XP[i]) s = i;
  return s as GlimStage;
}

/** Progress within the current stage, 0..1, plus the XP needed for the next one. */
export function stageProgress(xp: number) {
  const s = stageForXp(xp);
  if (s >= STAGE_XP.length - 1) return { stage: s, pct: 1, toNext: 0, next: null as number | null };
  const lo = STAGE_XP[s], hi = STAGE_XP[s + 1];
  return { stage: s, pct: (xp - lo) / (hi - lo), toNext: hi - xp, next: hi };
}

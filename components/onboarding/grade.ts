import { xpForScore } from '../../convex/lib/xp';

// On-device grader for the onboarding quest (the user isn't signed in yet, so
// the server-side AI grader isn't available). Scores three things:
//   accuracy     — how many key ideas from the reading they hit
//   clarity      — did they say enough to actually explain it
//   articulation — how clean the delivery was (filler words, rambling)

export interface Grade {
  score: number;        // 0-100 overall
  accuracy: number;
  clarity: number;
  articulation: number;
  xp: number;           // knowledge earned → Glim growth (0 for a weak explanation)
  feedback: string;
  /** Key ideas they left out (for a review later). */
  missed?: string[];
  /** Indexes of the missed key ideas (on-device grader). */
  missedIdx?: number[];
  /** AI grader extras (shown on the result's Improve tab). */
  praise?: string;
  tip?: string;
  betterVersion?: string;
  transcript?: string;
}

/** Each entry is one key idea; any of its variants counts as a hit. */
export const FACT_KEYWORDS: Record<string, string[][]> = {
  space:      [['venus'], ['243', 'spin', 'rotat', 'turn'], ['225', 'orbit', 'around the sun', 'year'], ['slow', 'longer']],
  history:    [['pyramid'], ['cleopatra'], ['moon'], ['closer', 'nearer'], ['2560', 'bc', 'thousand']],
  psychology: [['spac', 'spread', 'apart', 'over days', 'over time'], ['cram'], ['remember', 'memor', 'retain', 'stick'], ['review', 'revis', 'repeat', 'go over']],
  money:      [['72', 'seventy'], ['divid'], ['double'], ['interest', 'rate', 'percent'], ['10 years', 'ten years', 'decade']],
  science:    [['octopus', 'octopi'], ['blue'], ['copper', 'hemocyanin'], ['iron', 'haemoglobin', 'hemoglobin', 'our blood', 'red'], ['three heart', '3 heart']],
  philosophy: [['ship'], ['replace', 'plank', 'part'], ['same'], ['identity', 'itself', 'what makes', 'still the']],
  tech:       [['gps', 'satellite'], ['clock', 'time'], ['relativity', 'einstein'], ['fast', '38', 'microsecond'], ['drift', 'kilomet', 'wrong', 'off', 'inaccurate']],
  health:     [['sleep'], ['memor'], ['long-term', 'long term', 'storage', 'store'], ['replay', 'consolidat', 'process'], ['forget', 'fade', 'skip', 'lose']],
  art:        [['seurat', 'pointillis'], ['dot'], ['colour', 'color'], ['eye', 'blend', 'mix'], ['pixel', 'screen']],
  languages:  [['robot'], ['czech'], ['robota', 'labour', 'labor', 'work'], ['play', '1920']],
  nature:     [['tree'], ['fung', 'mushroom'], ['sugar', 'nutrient', 'food'], ['signal', 'talk', 'communicat', 'share'], ['network', 'underground', 'soil', 'root', 'wood wide']],
};

const FILLERS = ['um', 'uh', 'erm', 'like', 'basically', 'literally', 'actually', 'you know', 'sort of', 'kind of', 'i mean'];

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function gradeExplanation(transcript: string, interestId: string): Grade {
  return gradeAgainst(transcript, FACT_KEYWORDS[interestId] ?? []);
}

/** Grade against an explicit list of key ideas (used by daily quests). */
export function gradeAgainst(transcript: string, keys: string[][]): Grade {
  const text = ` ${transcript.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ')} `;
  const words = text.match(/[a-z0-9']+/g) ?? [];
  const n = words.length;

  // accuracy — key ideas hit
  const hits = keys.filter((variants) => variants.some((k) => text.includes(k)));
  const missed = keys.filter((variants) => !hits.includes(variants));
  const accuracy = keys.length ? Math.round((hits.length / keys.length) * 100) : 60;

  // clarity — enough substance, without rambling
  const clarity = Math.round(
    n < 6 ? n * 6
    : n < 20 ? 36 + (n - 6) * 3.5
    : n <= 110 ? 88 + Math.min(12, (n - 20) / 4)
    : 85,
  );

  // articulation — filler density + stutter repeats ("the the")
  let fillers = 0;
  for (const f of FILLERS) fillers += (text.match(new RegExp(`\\b${f}\\b`, 'g')) ?? []).length;
  let repeats = 0;
  for (let i = 1; i < n; i++) if (words[i] === words[i - 1]) repeats++;
  const ratio = n ? (fillers + repeats) / n : 1;
  const articulation = n < 4 ? 20 : Math.round(clamp(100 - ratio * 350, 25, 100));

  const score = Math.round(clamp(accuracy * 0.5 + clarity * 0.25 + articulation * 0.25));
  const xp = xpForScore(score);

  const weakest = [
    { k: 'accuracy', v: accuracy },
    { k: 'clarity', v: clarity },
    { k: 'articulation', v: articulation },
  ].sort((a, b) => a.v - b.v)[0];

  let feedback: string;
  if (score >= 85) feedback = 'Crisp, accurate and confident. That’s exactly how it sticks.';
  else if (weakest.k === 'accuracy' && missed.length)
    feedback = `Good start — you missed a key idea or two. Next time, mention “${missed[0][0]}”.`;
  else if (weakest.k === 'clarity')
    feedback = n < 20 ? 'Say a little more — walk through the why, not just the what.' : 'Tighten it up — lead with the big idea, then the detail.';
  else feedback = 'Nice ideas. Cut the fillers and pause instead — you’ll sound sharper.';

  const missedIdx = keys.map((k, i) => (hits.includes(k) ? -1 : i)).filter((i) => i >= 0);
  return { score, accuracy, clarity, articulation, xp, feedback, missed: missed.map((v) => v[0]), missedIdx };
}

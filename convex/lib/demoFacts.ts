// The "teach Glim" facts used in onboarding — one per interest.
// Shared by the app (what's shown) and the server (what the demo grader
// judges against), so the public grading endpoint only ever accepts a fact id,
// never arbitrary text.

export interface DemoFact {
  title: string;
  body: string;
  /** What a good explanation should get across. */
  keyIdeas: string[];
}

export const DEMO_FACTS: Record<string, DemoFact> = {
  space: {
    title: 'A day on Venus is longer than its year',
    body: 'Venus spins so slowly that one rotation takes 243 Earth days — but it only needs 225 days to orbit the Sun.',
    keyIdeas: ['Venus spins (rotates) very slowly', 'One rotation takes about 243 Earth days', 'One orbit of the Sun takes about 225 days, so its day is longer than its year'],
  },
  history: {
    title: 'Cleopatra is closer to us than to the pyramids',
    body: 'The Great Pyramid was built around 2560 BC. Cleopatra lived around 30 BC — nearer in time to the Moon landing than to the pyramid’s construction.',
    keyIdeas: ['The Great Pyramid was built around 2560 BC', 'Cleopatra lived around 30 BC', 'She is closer in time to the Moon landing than to the pyramid being built'],
  },
  psychology: {
    title: 'The spacing effect',
    body: 'You remember far more when you review something a few times spread over days than when you cram it all at once.',
    keyIdeas: ['Reviewing spread out over time (spacing)', 'works better than cramming all at once', 'for remembering things long term'],
  },
  money: {
    title: 'The rule of 72',
    body: 'Divide 72 by an interest rate to see how long money takes to double. At 7% a year, it doubles roughly every 10 years.',
    keyIdeas: ['Divide 72 by the interest rate', 'to estimate how many years money takes to double', 'Example: at 7% it doubles in about 10 years'],
  },
  science: {
    title: 'Octopuses have blue blood',
    body: 'Their blood carries oxygen with copper-based hemocyanin instead of iron-based haemoglobin — and they have three hearts to pump it.',
    keyIdeas: ['Octopus blood is blue', 'because it uses copper-based hemocyanin instead of iron-based haemoglobin', 'They have three hearts'],
  },
  philosophy: {
    title: 'The Ship of Theseus',
    body: 'If you replace every plank of a ship one at a time, is it still the same ship? It’s a puzzle about what makes something “itself”.',
    keyIdeas: ['Every part (plank) of a ship is replaced one by one', 'Is it still the same ship?', 'It is a puzzle about identity — what makes something itself'],
  },
  tech: {
    title: 'Your GPS needs Einstein',
    body: 'Clocks on GPS satellites run about 38 microseconds a day fast because of relativity. Without correcting for it, your map would drift kilometres a day.',
    keyIdeas: ['Clocks on GPS satellites run fast (about 38 microseconds a day)', 'because of relativity (Einstein)', 'Without correcting it, positions would drift by kilometres a day'],
  },
  health: {
    title: 'Sleep saves your memories',
    body: 'While you sleep, your brain replays the day and moves memories into long-term storage. Skip sleep and much of what you learned fades.',
    keyIdeas: ['During sleep the brain replays the day', 'and moves memories into long-term storage', 'Without sleep, much of what you learned fades'],
  },
  art: {
    title: 'Pointillism is a screen before screens',
    body: 'Seurat painted with tiny dots of pure colour and let your eye blend them — the same trick your phone uses with pixels.',
    keyIdeas: ['Seurat painted with tiny dots of pure colour', 'Your eye blends the dots together', 'It is the same idea as pixels on a screen'],
  },
  languages: {
    title: '“Robot” means forced labour',
    body: 'The word comes from the Czech “robota”. It was coined for a 1920 play about artificial workers.',
    keyIdeas: ['“Robot” comes from the Czech word “robota” (forced labour / work)', 'It was coined for a 1920 play', 'The play was about artificial workers'],
  },
  nature: {
    title: 'Trees talk underground',
    body: 'Forest trees trade sugar and chemical signals through networks of fungi in the soil — sometimes called the “wood wide web”.',
    keyIdeas: ['Trees are connected by networks of fungi in the soil', 'They trade sugar and chemical signals through them', 'This is nicknamed the “wood wide web”'],
  },
};

export const DEMO_FACT_IDS = Object.keys(DEMO_FACTS);

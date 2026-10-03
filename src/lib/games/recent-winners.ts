export interface GameWinner {
  username: string;
  state: string;
  amount: number;
  verified: boolean;
}

/** Authentic-looking display names */
const DISPLAY_NAMES = [
  "Marcus T.",
  "Sarah M.",
  "James R.",
  "Emily K.",
  "David L.",
  "Maria G.",
  "Chris P.",
  "Ashley N.",
  "Michael B.",
  "Jennifer H.",
  "Robert C.",
  "Amanda S.",
  "Daniel W.",
  "Jessica A.",
  "Anthony D.",
  "Nicole F.",
  "Kevin J.",
  "Stephanie V.",
  "Brian O.",
  "Rachel E.",
  "Tyler M.",
  "Lauren B.",
  "Jason K.",
  "Megan R.",
  "Andrew H.",
  "Brittany C.",
  "Ryan S.",
  "Kayla P.",
  "Justin L.",
  "Heather W.",
  "Brandon G.",
  "Samantha D.",
  "Eric N.",
  "Melissa T.",
  "Joshua F.",
  "Christina M.",
  "Matthew R.",
  "Amber J.",
  "Steven K.",
  "Tiffany B.",
];

const STATES = [
  "Alabama",
  "Texas",
  "Florida",
  "Georgia",
  "Ohio",
  "California",
  "New York",
  "Michigan",
  "North Carolina",
  "Tennessee",
  "Arizona",
  "Pennsylvania",
  "Illinois",
  "Virginia",
  "Louisiana",
  "Missouri",
  "Indiana",
  "Kentucky",
  "South Carolina",
  "Colorado",
];

const AMOUNTS = [25, 30, 35, 40, 45, 50, 55, 60, 75, 80, 100, 120, 150, 175, 200, 250, 345, 400, 500, 650];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateRandomWinner(): GameWinner {
  return {
    username: pickRandom(DISPLAY_NAMES),
    state: pickRandom(STATES),
    amount: pickRandom(AMOUNTS),
    verified: Math.random() > 0.3,
  };
}

/** Additional winners for expanded list — unique names when possible */
export function generateRandomWinnersList(count: number, exclude?: string): GameWinner[] {
  const names = shuffle(DISPLAY_NAMES).filter((n) => n !== exclude);
  const winners: GameWinner[] = [];

  for (let i = 0; i < count; i++) {
    winners.push({
      username: names[i % names.length] ?? pickRandom(DISPLAY_NAMES),
      state: pickRandom(STATES),
      amount: pickRandom(AMOUNTS),
      verified: Math.random() > 0.35,
    });
  }

  return winners;
}

export function generateRandomMoreWinnersCount(): number {
  return 12 + Math.floor(Math.random() * 28);
}

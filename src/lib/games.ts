export interface Game {
  id: string;
  name: string;
  slug: string;
  image: string;
  provider: string;
  category: string;
  downloadUrl: string;
  /** SEO description — used in meta tags and game landing page */
  bio: string;
  players: number;
  gradient: string;
  popular?: boolean;
  trending?: boolean;
  upcoming?: boolean;
  promotional?: boolean;
  topRated?: boolean;
}

/** Shared bonus & load rules shown on every game landing page */
export const GAME_BONUS_RULES = {
  firstTimeBonus: 50,
  regularBonus: 10,
  minDeposit: 5,
  maxDeposit: 500,
  /** Deposit wallet load → deposit redeem wallet */
  redeemMin: 3,
  redeemMax: 8,
} as const;

/** Bonus wallet load → bonus redeem wallet (1x wager, 5x max cashout cap). */
export const GAME_BONUS_REDEEM_RULES = {
  redeemMin: 1,
  redeemMax: 5,
} as const;

export const UPCOMING_GAME_MESSAGE =
  "This game is not available at the moment. Please check back soon!";

export const GAMES: Game[] = [
  {
    id: "1",
    name: "Fire Kirin",
    slug: "fire-kirin",
    image: "/games/fire-kirin.webp",
    provider: "Fire Kirin",
    category: "Fish Game",
    downloadUrl: "http://start.firekirin.xyz:8580/",
    bio: "Fire Kirin is the legendary fish shooting game loved by players nationwide. Spinora makes it easy to get your Fire Kirin account, claim your welcome bonus, and dive into action-packed fish tables with explosive jackpots.",
    players: 28450,
    gradient: "from-red-500 via-orange-600 to-red-900",
    popular: true,
  },
  {
    id: "2",
    name: "Juwa",
    slug: "juwa",
    image: "/games/juwa.webp",
    provider: "Juwa",
    category: "Slots",
    downloadUrl: "https://dl.juwa777.com/",
    bio: "Juwa is a popular mobile casino app packed with slots, fish games, and table-style action. Request your Juwa account through Spinora for fast approval, deposit bonuses, and VIP rewards.",
    players: 27120,
    gradient: "from-blue-400 via-blue-600 to-indigo-900",
    popular: true,
    trending: true,
    topRated: true,
  },
  {
    id: "3",
    name: "Orion Stars",
    slug: "orion-stars",
    image: "/games/orion-stars.webp",
    provider: "Orion Stars",
    category: "Fish Game",
    downloadUrl: "http://start.orionstars.vip:8580/",
    bio: "Orion Stars is a top-rated arcade and fish game platform with fast deposits, daily bonuses, and big win potential. Start playing slots and fish shooters with 24/7 support.",
    players: 25053,
    gradient: "from-zinc-500 via-zinc-600 to-zinc-800",
    popular: true,
  },
  {
    id: "4",
    name: "Game Vault",
    slug: "game-vault",
    image: "/games/game-vault.webp",
    provider: "Game Vault",
    category: "Slots",
    downloadUrl: "https://download.gamevault999.com/",
    bio: "Game Vault delivers a secure vault-style gaming experience with hundreds of slots, keno, and fish games. Spinora players get a 50% first-time bonus and reliable cashouts.",
    players: 24902,
    gradient: "from-fuchsia-500 via-pink-600 to-purple-900",
    popular: true,
    trending: true,
    topRated: true,
  },
  {
    id: "5",
    name: "Panda Master",
    slug: "panda-master",
    image: "/games/panda-master.webp",
    provider: "Panda Master",
    category: "Fish Game",
    downloadUrl: "https://pandamaster.vip:8888/index.html",
    bio: "Panda Master is a fan-favorite fish game app featuring colorful underwater battles and massive coin rewards. Download Panda Master and join thousands of players hunting jackpots.",
    players: 23586,
    gradient: "from-pink-400 via-rose-500 to-pink-900",
    trending: true,
  },
  {
    id: "6",
    name: "Ultra Panda",
    slug: "ultrapanda",
    image: "/games/ultrapanda.webp",
    provider: "Ultrapanda",
    category: "Fish Game",
    downloadUrl: "https://www.ultrapanda.mobi/",
    bio: "Ultrapanda is a vibrant fish and slots platform featuring the beloved panda mascot and action-packed gameplay. Download Ultrapanda through Spinora and enjoy welcome bonuses.",
    players: 22320,
    gradient: "from-red-400 via-rose-500 to-pink-800",
    topRated: true,
  },
  {
    id: "7",
    name: "Milky Way",
    slug: "milky-way",
    image: "/games/milky-way.webp",
    provider: "Milky Way",
    category: "Fish Game",
    downloadUrl: "https://milkywayapp.xyz/",
    bio: "Milky Way takes you on a cosmic gaming adventure with space-themed slots and fish games. Request your Milky Way account through Spinora for a 50% welcome match.",
    players: 21176,
    gradient: "from-violet-400 via-purple-600 to-indigo-900",
  },
  {
    id: "8",
    name: "Vblink",
    slug: "vblink",
    image: "/games/vblink.webp",
    provider: "Vblink",
    category: "Slots",
    downloadUrl: "https://www.vblink777.club/",
    bio: "Vblink offers a sleek arcade gaming experience with fish games, slots, and classic casino favorites. Spinora provides fast Vblink account creation and deposit bonuses.",
    players: 20435,
    gradient: "from-cyan-400 via-sky-600 to-blue-900",
    trending: true,
  },
  {
    id: "9",
    name: "River Sweeps",
    slug: "river-sweeps",
    image: "/games/river-sweeps.webp",
    provider: "River Sweeps",
    category: "Slots",
    downloadUrl: "https://www.riversweeps.com/",
    bio: "River Sweeps offers smooth, Vegas-style slot dynamics and high-paying tables. Join River Sweeps through Spinora to lock in immediate daily reload matches.",
    players: 19820,
    gradient: "from-teal-500 via-emerald-600 to-emerald-950",
  },
  {
    id: "10",
    name: "Vegas Sweeps",
    slug: "vegas-sweeps",
    image: "/games/vegas-sweeps.webp",
    provider: "Vegas Sweeps",
    category: "Slots",
    downloadUrl: "https://vegassweepsonline.com/",
    bio: "Vegas Sweeps brings the Las Vegas sweepstakes experience to your phone with slots, keno, and fish games. Spinora players get quick account setup and welcome bonuses.",
    players: 19510,
    gradient: "from-yellow-400 via-amber-500 to-orange-800",
    popular: true,
    topRated: true,
  },
  {
    id: "11",
    name: "Cash Machine",
    slug: "cash-machine",
    image: "/games/cash-machine.webp",
    provider: "Cash Machine",
    category: "Slots",
    downloadUrl: "https://www.cashmachine777.com/",
    bio: "Cash Machine is a high-energy slots platform built for players who love big spins and fast payouts. Get your account through Spinora and load from $5.",
    players: 18836,
    gradient: "from-emerald-500 via-green-600 to-teal-900",
    trending: true,
  },
  {
    id: "12",
    name: "Cash Frenzy",
    slug: "cash-frenzy",
    image: "/games/cash-frenzy.webp",
    provider: "Cash Frenzy",
    category: "Slots",
    downloadUrl: "https://www.cashfrenzy777.com/",
    bio: "Cash Frenzy brings non-stop slot action with vibrant graphics, daily promos, and rewarding gameplay. Request your account on Spinora in minutes.",
    players: 18783,
    gradient: "from-lime-500 via-green-500 to-emerald-800",
    promotional: true,
  },
  {
    id: "13",
    name: "Lucky Slots",
    slug: "lucky-slots",
    image: "/games/lucky-slots.webp",
    provider: "Lucky Slots",
    category: "Slots",
    downloadUrl: "https://luckyslots.com/",
    bio: "Lucky Slots features classic 777 fruit reels and high-RTP multipliers. Enjoy direct provisioning and instant loads through the Spinora portal.",
    players: 17920,
    gradient: "from-amber-500 via-red-500 to-red-950",
  },
  {
    id: "14",
    name: "High Stakes",
    slug: "high-stakes",
    image: "/games/high-stakes.webp",
    provider: "High Stakes",
    category: "Table Games",
    downloadUrl: "https://highstakes.com/",
    bio: "High Stakes provides premium table card actions for casino fans. Challenge the dealers in blackjack, baccarat, and poker lobbies today.",
    players: 17610,
    gradient: "from-stone-700 via-zinc-800 to-zinc-950",
    topRated: true,
  },
  {
    id: "15",
    name: "Golden Dragon",
    slug: "golden-dragon",
    image: "/games/golden-dragon.webp",
    provider: "Golden Dragon",
    category: "Fish Game",
    downloadUrl: "https://goldendragon.com/",
    bio: "Golden Dragon offers high-intensity dragon sweeps and fish-hunting boards. Aim your cannons at boss targets for massive instant payouts.",
    players: 17400,
    gradient: "from-yellow-500 via-yellow-600 to-amber-900",
    popular: true,
  },
  {
    id: "16",
    name: "Blue Dragon",
    slug: "blue-dragon",
    image: "/games/blue-dragon.webp",
    provider: "Blue Dragon",
    category: "Fish Game",
    downloadUrl: "https://bluedragon.com/",
    bio: "Blue Dragon features depth-based oceanic arcade tables. Shoot multiplier fish and claim progressive room multipliers in 5 minutes.",
    players: 16900,
    gradient: "from-blue-600 via-cyan-600 to-sky-950",
  },
  {
    id: "17",
    name: "Dragon Master",
    slug: "dragon-master",
    image: "/games/dragon-master.webp",
    provider: "Dragon Master",
    category: "Fish Game",
    downloadUrl: "https://dragonmaster.com/",
    bio: "Master the tides in Dragon Master's high-speed shooter arenas. Calibrate weapon power and target medium-tier dragons for optimal returns.",
    players: 16750,
    gradient: "from-orange-500 via-red-600 to-rose-950",
  },
  {
    id: "18",
    name: "Game Room",
    slug: "gameroom",
    image: "/games/gameroom.webp",
    provider: "Gameroom",
    category: "Slots",
    downloadUrl: "https://www.gameroom777.com/m",
    bio: "Gameroom Online is a classic Vegas-style arcade platform with slots, fish games, and keno. Spinora makes it easy to join Gameroom with instant approval.",
    players: 16590,
    gradient: "from-indigo-500 via-violet-600 to-purple-900",
    trending: true,
  },
  {
    id: "19",
    name: "Mr All In One",
    slug: "mr-all-in-one",
    image: "/games/mr-all-in-one.webp",
    provider: "MR All In One",
    category: "Slots",
    downloadUrl: "https://www.mrallinone777.com/",
    bio: "MR All In One combines multiple game styles in one powerful app — slots, fish, keno, and more. Spinora players enjoy one-stop access with fast deposits.",
    players: 16200,
    gradient: "from-amber-400 via-orange-500 to-yellow-700",
    popular: true,
  },
  {
    id: "20",
    name: "Ace Book",
    slug: "ace-book",
    image: "/games/ace-book.webp",
    provider: "Ace Book",
    category: "Table Games",
    downloadUrl: "https://acebook.com/",
    bio: "Ace Book is a cards-centric casino game highlighting premium book styling and fast dealer interactions. Ideal for table games enthusiasts.",
    players: 15900,
    gradient: "from-purple-950 via-indigo-950 to-zinc-950",
  },
  {
    id: "21",
    name: "Galaxy Games",
    slug: "galaxy-games",
    image: "/games/galaxy-games.webp",
    provider: "Galaxy Games",
    category: "Slots",
    downloadUrl: "https://galaxygames.com/",
    bio: "Explore outer-space slots and cosmic multipliers in Galaxy Games. Get instant credentials via the request button on your dashboard.",
    players: 15450,
    gradient: "from-violet-600 via-purple-700 to-fuchsia-950",
  },
  {
    id: "22",
    name: "Moolah",
    slug: "moolah",
    image: "/games/moolah.webp",
    provider: "Moolah",
    category: "Slots",
    downloadUrl: "https://moolahslots.com/",
    bio: "Moolah brings action-packed bonus slot wheels and rewarding scatters. Claim your 50% welcome match bonus and start spinning Moolah reels.",
    players: 15120,
    gradient: "from-green-500 via-emerald-600 to-stone-900",
  },
  {
    id: "23",
    name: "VB Game",
    slug: "vb-game",
    image: "/games/vb-game.webp",
    provider: "VB Game",
    category: "Slots",
    downloadUrl: "https://vbgame.com/",
    bio: "VB Game matches modern slot architectures with rewarding fish tables. Download the app directly from our verified links to start.",
    players: 14850,
    gradient: "from-cyan-500 via-blue-600 to-indigo-950",
  },
  {
    id: "24",
    name: "Mega Spin",
    slug: "mega-spin",
    image: "/games/mega-spin.webp",
    provider: "Mega Spin",
    category: "Slots",
    downloadUrl: "https://megaspin.com/",
    bio: "Mega Spin delivers large-format slot machines and bonus rounds. Request your Mega Spin account through the dashboard in under 2 minutes.",
    players: 14600,
    gradient: "from-fuchsia-600 via-purple-600 to-violet-950",
    popular: true,
  },
  {
    id: "25",
    name: "Lucky Lion",
    slug: "lucky-lion",
    image: "/games/lucky-lion.webp",
    provider: "Lucky Lion",
    category: "Slots",
    downloadUrl: "https://luckylion.com/",
    bio: "Lucky Lion highlights Chinese cultural graphics, gold lions, and high payline counts. Enjoy double rewards matches on your loads.",
    players: 14100,
    gradient: "from-amber-600 via-red-600 to-yellow-950",
  },
  {
    id: "26",
    name: "Pharaoh's Treasure",
    slug: "pharaohs-treasure",
    image: "/games/pharaohs-treasure.webp",
    provider: "Pharaoh's Treasure",
    category: "Slots",
    downloadUrl: "https://pharaohstreasure.com/",
    bio: "Pharaoh's Treasure provides Egyptian slot reels, pyramid multipliers, and hidden scatter bonuses. Spin now on mobile or web clients.",
    players: 13950,
    gradient: "from-yellow-600 via-amber-600 to-stone-950",
  },
  {
    id: "27",
    name: "Ocean King",
    slug: "ocean-king",
    image: "/games/ocean-king.webp",
    provider: "Ocean King",
    category: "Fish Game",
    downloadUrl: "https://oceanking.com/",
    bio: "Ocean King is the gold-standard series for underwater fish shooting. Hunt giant ocean sharks and claim progressive table room jackpots.",
    players: 13700,
    gradient: "from-cyan-600 via-blue-500 to-slate-900",
    popular: true,
  },
  {
    id: "28",
    name: "Fish Hunter",
    slug: "fish-hunter",
    image: "/games/fish-hunter.webp",
    provider: "Fish Hunter",
    category: "Fish Game",
    downloadUrl: "https://fishhunter.com/",
    bio: "Fish Hunter offers fast-paced cannon shooting action across deep seas. Lock in 50% first deposit bonus and withdraw in 15 minutes.",
    players: 13200,
    gradient: "from-teal-600 via-cyan-600 to-sky-900",
  },
  {
    id: "29",
    name: "Monster Hunter",
    slug: "monster-hunter",
    image: "/games/monster-hunter.webp",
    provider: "Monster Hunter",
    category: "Fish Game",
    downloadUrl: "https://monsterhunter.com/",
    bio: "Hunt down massive sea dragons and giant krakens in Monster Hunter. High volatility tables with multipliers up to 1000x.",
    players: 12850,
    gradient: "from-rose-600 via-purple-600 to-stone-900",
  },
  {
    id: "30",
    name: "Buffalo Link",
    slug: "buffalo-link",
    image: "/games/buffalo-link.webp",
    provider: "Buffalo Link",
    category: "Slots",
    downloadUrl: "https://buffalolink.com/",
    bio: "Buffalo Link features the legendary stampede slot layout, expanding reels, and giant coin wins. Get instant client access on Spinora.",
    players: 12500,
    gradient: "from-amber-600 via-orange-600 to-stone-950",
    trending: true,
  },
];

export type GameTab = "all" | "popular" | "trending" | "upcoming" | "promotional" | "topRated";

export type HomeGameTab = "trending" | "all" | "promotional";

export function getGameBySlug(slug: string): Game | undefined {
  return GAMES.find((g) => g.slug === slug);
}

/** Keep first occurrence per slug — prevents duplicate cards in grids. */
export function dedupeGamesBySlug<T extends { slug: string }>(games: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const game of games) {
    const key = canonicalGameSlug(game.slug);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(game);
  }
  return out;
}

/** Normalize slug aliases (DB vs static catalog). */
export function canonicalGameSlug(slug: string): string {
  const s = slug.trim().toLowerCase().replace(/_/g, "-");
  const aliases: Record<string, string> = {
    cashmachine: "cash-machine",
    "cash-frenzy": "cash-frenzy",
    cashfrenzy: "cash-frenzy",
    "game-vault": "game-vault",
    gamevault: "game-vault",
    "mr-all-in-one": "mr-all-in-one",
    mrallinone: "mr-all-in-one",
    vegas: "vegas-sweeps",
    "vegas-sweeps": "vegas-sweeps",
    firekirin: "fire-kirin",
    "fire-kirin": "fire-kirin",
    pandamaster: "panda-master",
    "panda-master": "panda-master",
    ultrapanda: "ultrapanda",
    gameroom: "gameroom",
    mafia: "mafia",
  };
  return aliases[s] ?? s;
}

function normalizeGameName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Dedupe by slug, image path, and normalized name — last line of defense for grids. */
export function dedupeGamesForDisplay(games: Game[]): Game[] {
  const seenSlug = new Set<string>();
  const seenImage = new Set<string>();
  const seenName = new Set<string>();
  const out: Game[] = [];

  for (const game of games) {
    const slugKey = canonicalGameSlug(game.slug);
    const imageKey = game.image.trim().toLowerCase();
    const nameKey = normalizeGameName(game.name);

    if (
      (slugKey && seenSlug.has(slugKey)) ||
      (imageKey && seenImage.has(imageKey)) ||
      (nameKey && seenName.has(nameKey))
    ) {
      continue;
    }

    if (slugKey) seenSlug.add(slugKey);
    if (imageKey) seenImage.add(imageKey);
    if (nameKey) seenName.add(nameKey);
    out.push(game);
  }

  return out;
}

export function getOtherGames(slug: string, limit = 6): Game[] {
  return GAMES.filter((g) => g.slug !== slug && !g.upcoming)
    .sort((a, b) => b.players - a.players)
    .slice(0, limit);
}

export function filterGames(tab: GameTab, search: string): Game[] {
  let list = [...GAMES];

  if (tab === "all") {
    // Every game — live first, then coming soon (cards show SOON badge via game.upcoming).
    list.sort((a, b) => {
      if (Boolean(a.upcoming) !== Boolean(b.upcoming)) {
        return a.upcoming ? 1 : -1;
      }
      return b.players - a.players;
    });
  } else if (tab === "upcoming") {
    list = list.filter((g) => g.upcoming).sort((a, b) => b.players - a.players);
  } else {
    list = list.filter((g) => !g.upcoming).sort((a, b) => b.players - a.players);
    if (tab === "popular") list = list.filter((g) => g.popular);
    if (tab === "topRated") list = list.filter((g) => g.topRated);
    // trending & promotional tabs list every live game
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.provider.toLowerCase().includes(q) ||
        g.bio.toLowerCase().includes(q)
    );
  }

  return dedupeGamesForDisplay(list);
}

export function filterHomeGames(tab: HomeGameTab, search: string): Game[] {
  // Home trending & promotional tabs show every live game (non-upcoming).
  if (tab === "trending" || tab === "promotional") {
    let list = GAMES.filter((g) => !g.upcoming).sort((a, b) => b.players - a.players);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.provider.toLowerCase().includes(q) ||
          g.bio.toLowerCase().includes(q)
      );
    }
    return dedupeGamesForDisplay(list);
  }
  return filterGames("all", search);
}

export function formatPlayers(n: number) {
  return n.toLocaleString();
}

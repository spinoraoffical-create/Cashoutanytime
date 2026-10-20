import { getGameRooms, type Game } from "@/lib/games";

/** One catalog fact that is not copied onto the other rooms. */
const DISTINCT: Record<string, string> = {
  "fire-kirin": "Fire Kirin is filed under Fish Game and uses the Fire Kirin download link stored in the catalog.",
  juwa: "Juwa is filed under Slots. Its catalog download link points at dl.juwa777.com.",
  "orion-stars": "Orion Stars is a Fish Game room with its own start.orionstars download link.",
  "game-vault": "Game Vault is a Slots room. The catalog download host is download.gamevault999.com.",
  "panda-master": "Panda Master is a Fish Game room. The catalog link uses pandamaster.vip.",
  ultrapanda: "Ultra Panda is a Fish Game room. The catalog link uses ultrapanda.mobi.",
  "milky-way": "Milky Way is a Fish Game room. The catalog link uses milkywayapp.xyz.",
  vblink: "Vblink is a Slots room. The catalog link uses vblink777.club.",
  "river-sweeps": "River Sweeps is a Slots room. The catalog link uses riversweeps.com.",
  "vegas-sweeps": "Vegas Sweeps is a Slots room. The catalog link uses vegassweepsonline.com.",
  "cash-machine": "Cash Machine is a Slots room. The catalog link uses cashmachine777.com.",
  "cash-frenzy": "Cash Frenzy is a Slots room. The catalog link uses cashfrenzy777.com.",
  "lucky-slots": "Lucky Slots is its own Slots room, separate from Juwa and Game Vault.",
  "high-stakes": "High Stakes is its own Slots room in the same catalog.",
  "golden-dragon": "Golden Dragon is its own Fish Game room, not the same listing as Fire Kirin.",
  "blue-dragon": "Blue Dragon is a separate Fish Game listing from Golden Dragon.",
  "dragon-master": "Dragon Master is a Fish Game listing of its own.",
  gameroom: "GameRoom is a Slots listing and is not the site lobby itself.",
  "mr-all-in-one": "Mr All In One is a separate Slots listing.",
  "ace-book": "Ace Book is a separate Slots listing.",
  "galaxy-games": "Galaxy Games is a separate Slots listing.",
  moolah: "Moolah is a separate Slots listing.",
  "vb-game": "VB Game is a separate Slots listing from Vblink.",
  "mega-spin": "Mega Spin is a separate Slots listing.",
  "lucky-lion": "Lucky Lion is a separate Fish Game listing.",
  "pharaohs-treasure": "Pharaohs Treasure is a separate Slots listing.",
  "ocean-king": "Ocean King is a separate Fish Game listing.",
  "fish-hunter": "Fish Hunter is a separate Fish Game listing.",
  "monster-hunter": "Monster Hunter is a separate Fish Game listing.",
  "buffalo-link": "Buffalo Link is a separate Slots listing.",
  mafia: "Mafia is a separate Slots listing.",
};

export function gamePublicFacts(game: Game): string[] {
  const peers = getGameRooms()
    .filter((row) => row.slug !== game.slug && row.category === game.category)
    .slice(0, 3)
    .map((row) => row.name);
  const secure = game.downloadUrl.startsWith("https://");
  return [
    DISTINCT[game.slug] || `${game.name} is listed as ${game.category} under ${game.provider}.`,
    secure
      ? `The stored download link for ${game.name} uses HTTPS.`
      : `The stored download link for ${game.name} does not use HTTPS. Open it only if you recognize the address.`,
    `Create a Sweepstakes Hub account, then open ${game.name} from Play. Loads and cash outs stay in your wallet.`,
    peers.length > 0
      ? `Other ${game.category} rooms on this site include ${peers.join(", ")}.`
      : "The rest of the live rooms are on the Play page.",
  ];
}

export function relatedPublicGames(game: Game): { slug: string; name: string }[] {
  return getGameRooms()
    .filter((row) => row.slug !== game.slug && row.category === game.category)
    .slice(0, 3)
    .map((row) => ({ slug: row.slug, name: row.name }));
}

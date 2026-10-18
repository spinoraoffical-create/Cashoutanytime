import "server-only";

import {
  PLAYER_PAGE_CAP,
  PLAYER_PAGE_SIZE,
  playerListFinished,
  sumPlayerScores,
  type LiveGameBalance,
  type ScoreRow,
} from "@/lib/admin/live-game-balances";
import { getCashFrenzyApiClient } from "@/lib/game-automation/cashfrenzy-api";
import { isCashFrenzyApiConfigured } from "@/lib/game-automation/cashfrenzy-service";
import { getCashMachineApiClient } from "@/lib/game-automation/cashmachine-api";
import { isCashMachineApiConfigured } from "@/lib/game-automation/cashmachine-service";
import { FireKirinApiClient, isFireKirinApiConfigured } from "@/lib/game-automation/firekirin-api";
import { getGameVaultApiClient } from "@/lib/game-automation/gamevault-api";
import { isGameVaultApiConfigured } from "@/lib/game-automation/gamevault-service";
import { getGameroomApiClient } from "@/lib/game-automation/gameroom-api";
import { isGameroomApiConfigured } from "@/lib/game-automation/gameroom-service";
import { isJuwaApiConfigured, JuwaApiClient } from "@/lib/game-automation/juwa-api";
import { isMafiaApiConfigured, MafiaApiClient } from "@/lib/game-automation/mafia-api";
import { isMilkyWayApiConfigured, MilkyWayApiClient } from "@/lib/game-automation/milkyway-api";
import { getMrAllInOneApiClient } from "@/lib/game-automation/mrallinone-api";
import { isMrAllInOneApiConfigured } from "@/lib/game-automation/mrallinone-service";
import { isOrionStarsApiConfigured, OrionStarsApiClient } from "@/lib/game-automation/orionstars-api";
import { getVegasApiClient, isVegasApiConfigured } from "@/lib/game-automation/vegas-api";
import { pausedProviderSlugs } from "@/lib/game-automation/provider-pause-read";

const READ_MS = 12000;

type ListedCoins = {
  storeCoins: number | null;
  playerCoins: number | null;
  playerCount: number | null;
  partial: boolean;
};

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The game panel did not answer in time.")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Could not read this game.";
  return message.replace(/\s+/g, " ").slice(0, 160);
}

async function collectPages(
  load: (page: number) => Promise<{ rows: ScoreRow[]; total: number | null }>
): Promise<Pick<ListedCoins, "playerCoins" | "playerCount" | "partial">> {
  let page = 1;
  let seen = 0;
  let playerCoins = 0;
  let total: number | null = null;
  let rowCount = 0;
  while (page <= PLAYER_PAGE_CAP) {
    const batch = await load(page);
    if (batch.total != null) total = batch.total;
    rowCount = batch.rows.length;
    playerCoins += sumPlayerScores(batch.rows);
    seen += rowCount;
    if (playerListFinished({ page, rowCount, seen, total })) break;
    page += 1;
  }
  const partial =
    (total != null && seen < total) ||
    (total == null && page >= PLAYER_PAGE_CAP && rowCount === PLAYER_PAGE_SIZE);
  return { playerCoins, playerCount: total ?? seen, partial };
}

async function layuiBalance(api: {
  login: () => Promise<unknown>;
  getStoreCoins: () => number | null;
  getPlayerList: (limit: number, page: number) => Promise<{ count?: number; data?: ScoreRow[] | null }>;
}): Promise<ListedCoins> {
  await api.login();
  const players = await collectPages(async (page) => {
    const res = await api.getPlayerList(PLAYER_PAGE_SIZE, page);
    const total = Number(res.count);
    return { rows: res.data ?? [], total: Number.isFinite(total) ? total : null };
  });
  return { storeCoins: api.getStoreCoins(), ...players };
}

async function agentBalance(read: () => Promise<number | null>): Promise<ListedCoins> {
  const storeCoins = await read();
  return {
    storeCoins: Number.isFinite(storeCoins) ? storeCoins : null,
    playerCoins: null,
    playerCount: null,
    partial: false,
  };
}

async function readGame(
  slug: string,
  name: string,
  configured: boolean,
  paused: boolean,
  read: () => Promise<ListedCoins>
): Promise<LiveGameBalance> {
  if (paused) {
    return {
      slug,
      name,
      storeCoins: null,
      playerCoins: null,
      playerCount: null,
      partial: false,
      status: "paused",
      detail: "Paused",
    };
  }
  if (!configured) {
    return {
      slug,
      name,
      storeCoins: null,
      playerCoins: null,
      playerCount: null,
      partial: false,
      status: "not_connected",
      detail: "Not connected",
    };
  }
  try {
    const row = await withTimeout(read(), READ_MS);
    return {
      slug,
      name,
      ...row,
      status: "live",
      detail: row.partial ? "First pages only" : null,
    };
  } catch (error) {
    return {
      slug,
      name,
      storeCoins: null,
      playerCoins: null,
      playerCount: null,
      partial: false,
      status: "error",
      detail: safeError(error),
    };
  }
}

export async function loadLiveGameBalances(): Promise<LiveGameBalance[]> {
  const paused = await pausedProviderSlugs([
    "cash-frenzy",
    "cash-machine",
    "gameroom",
    "mr-all-in-one",
    "mafia",
    "juwa",
    "vegas-sweeps",
    "fire-kirin",
    "game-vault",
    "orion-stars",
    "milky-way",
  ]);
  const stopped = (slug: string) => paused.has(slug);
  return Promise.all([
    readGame("cash-frenzy", "Cash Frenzy", isCashFrenzyApiConfigured(), stopped("cash-frenzy"), () => layuiBalance(getCashFrenzyApiClient())),
    readGame("cash-machine", "Cash Machine", isCashMachineApiConfigured(), stopped("cash-machine"), () => layuiBalance(getCashMachineApiClient())),
    readGame("gameroom", "Game Room", isGameroomApiConfigured(), stopped("gameroom"), () => layuiBalance(getGameroomApiClient())),
    readGame("mr-all-in-one", "Mr All in One", isMrAllInOneApiConfigured(), stopped("mr-all-in-one"), () =>
      layuiBalance(getMrAllInOneApiClient())
    ),
    readGame("mafia", "Mafia", isMafiaApiConfigured(), stopped("mafia"), async () => {
      const api = new MafiaApiClient();
      await api.getValidToken();
      const players = await collectPages(async (page) => ({
        rows: await api.getPlayerList(page, PLAYER_PAGE_SIZE),
        total: null,
      }));
      return { storeCoins: api.getStoreCoins(), ...players };
    }),
    readGame("juwa", "Juwa", isJuwaApiConfigured(), stopped("juwa"), () => agentBalance(() => new JuwaApiClient().getAgentBalance())),
    readGame("vegas-sweeps", "Vegas Sweeps", isVegasApiConfigured(), stopped("vegas-sweeps"), () =>
      agentBalance(() => getVegasApiClient().getAgentBalance())
    ),
    readGame("fire-kirin", "Fire Kirin", isFireKirinApiConfigured(), stopped("fire-kirin"), () =>
      agentBalance(() => new FireKirinApiClient().getAgentBalance())
    ),
    readGame("game-vault", "Game Vault", isGameVaultApiConfigured(), stopped("game-vault"), () =>
      agentBalance(async () => {
        const res = await getGameVaultApiClient().getAgentBalance();
        return Number(res.data?.agent_balance);
      })
    ),
    readGame("orion-stars", "Orion Stars", isOrionStarsApiConfigured(), stopped("orion-stars"), () =>
      agentBalance(async () => {
        const api = new OrionStarsApiClient();
        await api.getValidSession();
        return api.lastAgentBalance;
      })
    ),
    readGame("milky-way", "Milky Way", isMilkyWayApiConfigured(), stopped("milky-way"), () =>
      agentBalance(async () => {
        const session = await new MilkyWayApiClient().getFreshSession();
        return session.balance;
      })
    ),
  ]);
}

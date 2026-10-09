import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalGameSlug } from "@/lib/games";

type StoreLogin = { username: string; password: string; baseUrl: string };

const STORE_ENV: Record<string, { user?: string; pass?: string; base?: string }> = {
  mafia: { user: "MAFIA_AGENT_USERNAME", pass: "MAFIA_AGENT_PASSWORD", base: "MAFIA_ADMIN_URL" },
  "cash-machine": { user: "CASHMACHINE_AGENT_USERNAME", pass: "CASHMACHINE_AGENT_PASSWORD", base: "CASHMACHINE_API_BASE_URL" },
  "cash-frenzy": { user: "CASHFRENZY_AGENT_USERNAME", pass: "CASHFRENZY_AGENT_PASSWORD", base: "CASHFRENZY_API_BASE_URL" },
  gameroom: { user: "GAMEROOM_AGENT_USERNAME", pass: "GAMEROOM_AGENT_PASSWORD", base: "GAMEROOM_API_BASE_URL" },
  "mr-all-in-one": { user: "MRALLINONE_AGENT_USERNAME", pass: "MRALLINONE_AGENT_PASSWORD", base: "MRALLINONE_API_BASE_URL" },
  "fire-kirin": { user: "FIREKIRIN_AGENT_USERNAME", pass: "FIREKIRIN_AGENT_PASSWORD" },
  vblink: { user: "VBLINK_AGENT_USERNAME", pass: "VBLINK_AGENT_PASSWORD", base: "VBLINK_API_URL" },
  "orion-stars": { user: "ORIONSTARS_AGENT_USERNAME", pass: "ORIONSTARS_AGENT_PASSWORD", base: "ORIONSTARS_API_URL" },
  "milky-way": { user: "MILKYWAY_AGENT_USERNAME", pass: "MILKYWAY_AGENT_PASSWORD", base: "MILKYWAY_API_URL" },
};

let savedLogins = new Map<string, StoreLogin>();
let loadedAt = 0;
let queue: Promise<unknown> = Promise.resolve();

type ConfigRow = {
  api_username: string | null;
  api_password: string | null;
  api_base_url: string | null;
  games: { slug: string } | { slug: string }[] | null;
};

function slugOf(games: ConfigRow["games"]): string {
  if (!games) return "";
  const row = Array.isArray(games) ? games[0] : games;
  return row?.slug ? canonicalGameSlug(row.slug) : "";
}

async function loadStoreLogins() {
  if (loadedAt && Date.now() - loadedAt < 15_000) return;
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin
    .from("game_server_configs")
    .select("api_username, api_password, api_base_url, games(slug)");
  const next = new Map<string, StoreLogin>();
  for (const row of (data ?? []) as ConfigRow[]) {
    const slug = slugOf(row.games);
    if (!slug) continue;
    next.set(slug, {
      username: String(row.api_username ?? "").trim(),
      password: String(row.api_password ?? "").trim(),
      baseUrl: String(row.api_base_url ?? "").trim(),
    });
  }
  savedLogins = next;
  loadedAt = Date.now();
}

function apply(slug: string): Array<[string, string | undefined]> {
  const fields = STORE_ENV[canonicalGameSlug(slug)];
  const login = savedLogins.get(canonicalGameSlug(slug));
  if (!fields || !login) return [];
  const previous: Array<[string, string | undefined]> = [];
  const set = (key: string | undefined, value: string) => {
    if (!key || !value) return;
    previous.push([key, process.env[key]]);
    process.env[key] = value;
  };
  set(fields.user, login.username);
  set(fields.pass, login.password);
  set(fields.base, login.baseUrl);
  return previous;
}

function restore(previous: Array<[string, string | undefined]>) {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

/** Use the store username/password saved in Admin when those fields are filled. */
export function withAdminStoreLogin<T>(slug: string, run: () => Promise<T>): Promise<T> {
  const job = queue.then(async () => {
    await loadStoreLogins();
    const previous = apply(slug);
    try {
      return await run();
    } finally {
      restore(previous);
    }
  });
  queue = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}

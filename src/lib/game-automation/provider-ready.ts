import "server-only";

import { canonicalGameSlug } from "@/lib/games";
import { isCashMachineApiConfigured } from "@/lib/game-automation/cashmachine-service";
import { isCashFrenzyApiConfigured } from "@/lib/game-automation/cashfrenzy-service";
import { isGameroomApiConfigured } from "@/lib/game-automation/gameroom-service";
import { isMrAllInOneApiConfigured } from "@/lib/game-automation/mrallinone-service";
import { isGameVaultApiConfigured } from "@/lib/game-automation/gamevault-service";
import { isMafiaApiConfigured } from "@/lib/game-automation/mafia-service";
import { isMilkyWayApiConfigured } from "@/lib/game-automation/milkyway-api";
import { isVblinkApiConfigured } from "@/lib/game-automation/vblink-service";
import { isFireKirinApiConfigured } from "@/lib/game-automation/firekirin-api";
import { isJuwaApiConfigured } from "@/lib/game-automation/juwa-api";
import { isVegasApiConfigured } from "@/lib/game-automation/vegas-api";

/** True only when this process has the provider's required server credentials. */
export function isGameProviderReady(slug: string): boolean {
  switch (canonicalGameSlug(slug)) {
    case "juwa":
      return isJuwaApiConfigured();
    case "vegas-sweeps":
      return isVegasApiConfigured();
    case "cash-machine":
      return isCashMachineApiConfigured();
    case "cash-frenzy":
      return isCashFrenzyApiConfigured();
    case "gameroom":
      return isGameroomApiConfigured();
    case "mr-all-in-one":
      return isMrAllInOneApiConfigured();
    case "game-vault":
      return isGameVaultApiConfigured();
    case "mafia":
      return isMafiaApiConfigured();
    case "orion-stars":
      // Login succeeded on 17 Oct 2026. Loads stay closed until the transfer ledger is applied and resumed.
      return false;
    case "milky-way":
      return isMilkyWayApiConfigured();
    case "fire-kirin":
      return isFireKirinApiConfigured();
    case "vblink":
      return isVblinkApiConfigured();
    default:
      return false;
  }
}

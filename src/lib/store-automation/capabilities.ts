import type { StoreCapability, StoreSlug } from "./types";

/**
 * Evidence already in this repository. Portal entry URLs are the public pages
 * the owner named. None of these records is a live login result.
 */
export const STORE_CAPABILITIES: Record<StoreSlug, StoreCapability> = {
  "orion-stars": {
    slug: "orion-stars",
    portalEntryUrl: "https://orionstars.vip:8781/Agent.aspx",
    officialPortalApi: false,
    terminalApiClient: "src/lib/game-automation/orionstars-api.ts",
    browserAutomationAuthorized: false,
    captchaOnKnownPortal: "unknown",
    accountRole: "unverified",
    functions: {
      create_account: "terminal_api_in_repo",
      load: "terminal_api_in_repo",
      redeem: "terminal_api_in_repo",
      check_balance: "terminal_api_in_repo",
      game_records: "not_implemented",
    },
    evidence: [
      "Terminal API v1.2.6 client implements agentLogin, registerUser, queryInfo, recharge, and redeem.",
      "That client targets /ws/service.ashx. It does not document Agent.aspx.",
      "No Orion Stars browser adapter exists in the repository.",
      "A direct request to Agent.aspx on 17 Oct 2026 returned HTTP 500 before a login form. No panel workflow was verified.",
    ],
  },
  "milky-way": {
    slug: "milky-way",
    portalEntryUrl: "https://milkywayapp.xyz:8781/default.aspx",
    officialPortalApi: false,
    terminalApiClient: "src/lib/game-automation/milkyway-api.ts",
    browserAutomationAuthorized: false,
    captchaOnKnownPortal: "unknown",
    accountRole: "unverified",
    functions: {
      create_account: "terminal_api_in_repo",
      load: "terminal_api_in_repo",
      redeem: "terminal_api_in_repo",
      check_balance: "terminal_api_in_repo",
      game_records: "not_implemented",
    },
    evidence: [
      "Terminal API v1.2.3 client implements agentLogin, registerUser, queryInfo, recharge, and redeem.",
      "That client targets /ws/service.ashx. It does not document port 8781.",
      "No Milky Way browser adapter exists in the repository.",
      "A direct request to default.aspx on port 8781 on 17 Oct 2026 returned HTTP 500 before a login form. No panel workflow was verified.",
    ],
  },
  "panda-master": {
    slug: "panda-master",
    portalEntryUrl: "https://pandamaster.vip/Agent.aspx",
    officialPortalApi: false,
    terminalApiClient: null,
    browserAutomationAuthorized: false,
    captchaOnKnownPortal: "unknown",
    accountRole: "unverified",
    functions: {
      create_account: "not_implemented",
      load: "not_implemented",
      redeem: "not_implemented",
      check_balance: "not_implemented",
      game_records: "not_implemented",
    },
    evidence: [
      "No Panda Master provider client exists.",
      "The catalog download page https://pandamaster.vip:8888/index.html is a player page, not an agent API.",
      "Agent.aspx has no documented endpoints, signing method, or error-code list in this repository.",
    ],
  },
  "fire-kirin": {
    slug: "fire-kirin",
    portalEntryUrl: "https://firekirin.xyz:8888/default.aspx?639278443848020008",
    officialPortalApi: false,
    terminalApiClient: "src/lib/game-automation/firekirin-api.ts",
    browserAutomationAuthorized: false,
    captchaOnKnownPortal: true,
    accountRole: "unverified",
    functions: {
      create_account: "terminal_api_in_repo",
      load: "terminal_api_in_repo",
      redeem: "terminal_api_in_repo",
      check_balance: "terminal_api_in_repo",
      game_records: "not_implemented",
    },
    evidence: [
      "Terminal API v1.0 client implements agentLogin, registerUser, queryInfo, recharge, redeem, and kickPlayerOut.",
      "firekirin-store.ts can open Store.aspx and create a player. It reads the login CAPTCHA image. This engine does not call that file.",
      "The owner portal URL is default.aspx with a query token. The existing store file uses Store.aspx. Those pages were not proven to be the same session.",
      "Store load, redeem, balance, and game records are not implemented against the portal.",
      "Store.aspx and default.aspx returned HTTP 500 on 17 Oct 2026, before a login form. The CAPTCHA reader in firekirin-store.ts was not run.",
    ],
  },
};

export function capabilityFor(slug: StoreSlug): StoreCapability {
  return STORE_CAPABILITIES[slug];
}

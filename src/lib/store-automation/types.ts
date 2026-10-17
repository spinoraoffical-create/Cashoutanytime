/** Store automation contracts. These types do not open a portal or move a wallet. */

export const STORE_SLUGS = ["orion-stars", "milky-way", "panda-master", "fire-kirin"] as const;
export type StoreSlug = (typeof STORE_SLUGS)[number];

export type StoreOperation = "create_account" | "load" | "redeem" | "check_balance" | "game_records";

export type StoreAccountRole = "store" | "sub_distributor" | "unverified";

export type StoreFunctionStatus =
  | "terminal_api_in_repo"
  | "store_portal_unverified"
  | "not_implemented";

export interface StoreCapability {
  slug: StoreSlug;
  portalEntryUrl: string;
  officialPortalApi: false;
  terminalApiClient: string | null;
  browserAutomationAuthorized: false;
  captchaOnKnownPortal: boolean | "unknown";
  accountRole: StoreAccountRole;
  functions: Record<StoreOperation, StoreFunctionStatus>;
  evidence: string[];
}

export interface StoreCommand {
  requestId: string;
  operation: StoreOperation;
  websiteUserId: string;
  gameUsername?: string | null;
  amount?: number | null;
}

export interface StoreAdapterResponse {
  outcome: "confirmed_success" | "confirmed_failure" | "unknown";
  message?: string;
  gameUsername?: string | null;
  balance?: number | null;
  providerReference?: string | null;
  records?: unknown;
  sessionExpired?: boolean;
}

export interface StoreAdapter {
  readonly slug: StoreSlug;
  capability(): StoreCapability;
  execute(command: StoreCommand): Promise<StoreAdapterResponse>;
}

export interface GameRecordRow {
  id: string;
  kind: "load" | "redeem" | "play";
  amount: number;
}

export interface StoreJobResult {
  requestId: string;
  provider: StoreSlug;
  operation: StoreOperation;
  state: "confirmed_success" | "confirmed_failure" | "manual_review";
  retryAllowed: false;
  balance: number | null;
  providerReference: string | null;
  gameUsername: string | null;
  records: GameRecordRow[] | null;
  message: string;
}

export interface AuditEvent {
  at: string;
  requestId: string;
  provider: StoreSlug;
  operation: StoreOperation;
  state: StoreJobResult["state"];
  message: string;
}

export function isStoreSlug(value: string): value is StoreSlug {
  return (STORE_SLUGS as readonly string[]).includes(value);
}

export function operationMovesCredit(operation: StoreOperation): boolean {
  return operation === "load" || operation === "redeem";
}

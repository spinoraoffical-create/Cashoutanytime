import crypto from "crypto";
import { getTransferStore } from "./supabase-transfer-store";
import { terminalGameCount } from "./terminal-account";
import { providerReplyClass, providerReplyFlags, terminalAgentBalance, terminalAgentKey, terminalUserBalance } from "./terminal-response";
import { executeGuardedTransfer } from "./transfer-guard";
import type { DurableTransferStore } from "./transfer-ledger";
import type { ClientRequest } from "node:http";
import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";

/**
 * Fire Kirin Terminal API v1.0
 * https://firekirin.xyz:8033/ws/service.ashx
 */

const OFFICIAL_API_URL = "https://firekirin.xyz:8033/ws/service.ashx";

export interface FireKirinLoginResponse {
  code: string | number;
  balance?: string | number;
  Balance?: string | number;
  agentkey?: string;
  agentKey?: string;
  msg?: string;
}

export interface FireKirinBaseResponse {
  code: string | number;
  msg?: string;
}

export interface FireKirinQueryResponse extends FireKirinBaseResponse {
  agentBalance?: number | string;
  gameId?: number | string;
  userBalance?: number | string;
  userbalance?: number | string;
  webLoginUrl?: string;
}

export function parseFireKirinUserBalance(info: FireKirinQueryResponse): number | null {
  return terminalUserBalance(info);
}

export function isWholeDollar(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && Math.abs(amount - Math.trunc(amount)) <= 1e-6;
}

export function fireKirinTransactionId(requestId: string): string {
  return requestId.replace(/-/g, "").slice(0, 20);
}

export interface FireKirinConfig {
  apiUrl?: string;
  agentName?: string;
  agentPassword?: string;
  /** Fallback only. Direct calls to port 8033 do not use it. `null` disables the fallback. */
  proxyUrl?: string | null;
  transferStore?: DurableTransferStore;
}

export interface FireKirinSession {
  agentKey: string;
  time: string;
}

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex").toLowerCase();
}

function httpsPost(
  urlStr: string,
  hostHeader: string,
  proxyUrlStr?: string,
  timeoutMs: number = 15000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let req: ClientRequest | undefined;
    const finish = (err: Error | null, body?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req?.destroy();
      if (err) reject(err);
      else resolve(body ?? "");
    };
    const timer = setTimeout(() => {
      finish(new Error(`Fire Kirin API connection timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    try {
      const parsed = new URL(urlStr);
      const agent = proxyUrlStr
        ? new HttpsProxyAgent(proxyUrlStr, { rejectUnauthorized: false })
        : undefined;

      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 8033,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          Host: hostHeader,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        servername: hostHeader,
        rejectUnauthorized: false,
        timeout: timeoutMs,
        agent,
      };

      const request = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => finish(null, data));
      });
      req = request;

      request.setTimeout(timeoutMs, () => {
        request.destroy();
        finish(new Error(`Fire Kirin API connection timed out after ${timeoutMs / 1000}s`));
      });

      request.on("error", (e: Error) => finish(e));
      request.end();
    } catch (err) {
      finish(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

let lastFireKirinStamp = 0;
let fireKirinQueue: Promise<void> = Promise.resolve();

/** One Fire Kirin login at a time. A second login replaces the agent key. */
export function enqueueFireKirin<T>(task: () => Promise<T>): Promise<T> {
  const run = fireKirinQueue.then(task, task);
  fireKirinQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Official Fire Kirin time is System.currentTimeMillis. Each successful call consumes its timestamp. */
function nextFireKirinStamp(): string {
  let now = Date.now();
  if (now <= lastFireKirinStamp) now = lastFireKirinStamp + 1;
  lastFireKirinStamp = now;
  return String(now);
}

function transportFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /timed out|unreachable|ECONN|ENOTFOUND|EAI_AGAIN|socket|network/i.test(message);
}

export class FireKirinApiClient {
  private apiUrl: string;
  private agentName: string;
  private agentPasswdHash: string;
  private fallbackProxy?: string;
  private useProxy = false;
  private session: FireKirinSession | null = null;
  private transferStore: DurableTransferStore;
  public lastAgentBalance: number | null = null;

  constructor(config: FireKirinConfig = {}) {
    this.apiUrl = (config.apiUrl || OFFICIAL_API_URL).trim();

    this.agentName = (config.agentName || process.env.FIREKIRIN_AGENT_USERNAME || "").trim();

    const rawPass = config.agentPassword || process.env.FIREKIRIN_AGENT_PASSWORD || "";
    this.agentPasswdHash = md5(rawPass.trim());

    if (config.proxyUrl === null) {
      this.fallbackProxy = undefined;
    } else {
      this.fallbackProxy = (config.proxyUrl || process.env.FIREKIRIN_PROXY_URL || "").trim() || undefined;
    }
    this.transferStore = config.transferStore || getTransferStore();
  }

  get name(): string {
    return this.agentName;
  }

  private stamp(): string {
    return nextFireKirinStamp();
  }

  private async readJson(url: string, proxyUrl?: string): Promise<any> {
    const text = await httpsPost(url, "firekirin.xyz", proxyUrl);
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("<") || /bad gateway/i.test(trimmed)) {
      throw new Error(`Fire Kirin API unreachable: ${trimmed.slice(0, 120) || "empty response"}.`);
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error(`Fire Kirin invalid JSON response: ${trimmed.slice(0, 200)}`);
    }
  }

  /** Direct to port 8033. The proxy is used only after that call fails to connect. */
  private async request(url: string): Promise<any> {
    if (!this.useProxy) {
      try {
        return await this.readJson(url);
      } catch (err) {
        if (!this.fallbackProxy || !transportFailure(err)) throw err;
        this.useProxy = true;
      }
    }
    return this.readJson(url, this.fallbackProxy);
  }

  private async loginAt(time: string): Promise<FireKirinLoginResponse> {
    const loginUrl = `${this.apiUrl}?action=agentLogin&agentName=${encodeURIComponent(
      this.agentName
    )}&agentPasswd=${encodeURIComponent(this.agentPasswdHash)}&time=${time}`;
    return this.request(loginUrl);
  }

  public async getAgentBalance(): Promise<number | null> {
    await this.getValidSession();
    return this.lastAgentBalance;
  }

  /** One agentLogin for this client. Later actions use a new timestamp and this agentKey. */
  public async getValidSession(): Promise<FireKirinSession> {
    if (this.session) return this.session;

    const time = this.stamp();
    const json = await this.loginAt(time);
    const agentKey = terminalAgentKey(json);
    if (String(json.code) !== "200" || !agentKey) {
      throw new Error(`Fire Kirin agentLogin failed: ${json.msg || `code ${json.code}`}`);
    }
    return this.rememberSession(json, String(agentKey), time);
  }

  private rememberSession(json: FireKirinLoginResponse, agentKey: string, time: string): FireKirinSession {
    this.lastAgentBalance = terminalAgentBalance(json);
    this.session = { agentKey, time };
    return this.session;
  }

  private createSignFromSession(session: FireKirinSession): { sign: string; time: string } {
    const time = this.stamp();
    const rawSignStr = (this.agentName + time + session.agentKey).toLowerCase();
    const sign = md5(rawSignStr);
    return { sign, time };
  }

  public async createAccount(
    account: string,
    pass: string,
    existingSession?: FireKirinSession
  ): Promise<{ account: string; pass: string; session: FireKirinSession }> {
    if (account.trim().toLowerCase() === this.agentName.toLowerCase()) {
      throw new Error("Fire Kirin registerUser refused: player account cannot be the agent login.");
    }
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);
    const passHash = md5(pass);

    const url = `${this.apiUrl}?action=registerUser&account=${encodeURIComponent(
      account
    )}&passwd=${encodeURIComponent(passHash)}&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      const errMsg = json.msg || `Registration failed with code ${json.code}`;
      throw new Error(`Fire Kirin registerUser error [code ${json.code}]: ${errMsg}`);
    }

    return { account, pass, session };
  }

  public async queryInfo(
    account: string,
    existingSession?: FireKirinSession
  ): Promise<FireKirinQueryResponse> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);

    const url = `${this.apiUrl}?action=queryInfo&account=${encodeURIComponent(
      account
    )}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;

    const json: FireKirinQueryResponse = await this.request(url);
    if (String(json.code) !== "200") {
      const errMsg = json.msg || `Query failed with code ${json.code}`;
      throw new Error(`Fire Kirin queryInfo error [code ${json.code}]: ${errMsg}`);
    }

    return json;
  }

  /** Read-only signed call. It does not create a player or move coins. */
  public async listGames(
    existingSession?: FireKirinSession
  ): Promise<{ code: string; message: string; gameCount: number | null }> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);
    const url = `${this.apiUrl}?action=getgamelist&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;
    const json = await this.request(url);
    return {
      code: String(json.code),
      message: String(json.msg || ""),
      gameCount: terminalGameCount(json.data),
    };
  }

  /** Read-only. Sends the same query timestamp twice and returns codes only. */
  public async compareStampReuse(account: string): Promise<{ firstCode: string; repeatCode: string; balance: number | null; firstClass: string; flags: ReturnType<typeof providerReplyFlags> }> {
    const session = await this.getValidSession();
    const { sign, time } = this.createSignFromSession(session);
    const url = `${this.apiUrl}?action=queryInfo&account=${encodeURIComponent(
      account
    )}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;
    const first = await this.request(url);
    let repeatCode = "transport";
    try {
      const second = await this.request(url);
      repeatCode = String(second.code);
    } catch {
      repeatCode = "transport";
    }
    return {
      firstCode: String(first.code),
      repeatCode,
      balance: terminalUserBalance(first),
      firstClass: providerReplyClass(String(first.code), String(first.msg || "")),
      flags: providerReplyFlags(String(first.msg || "")),
    };
  }

  public async confirmOperation(operationKey: string): Promise<boolean> {
    return this.transferStore.confirm(operationKey);
  }

  public async rechargePlayer(
    account: string,
    amount: number,
    existingSession?: FireKirinSession,
    transactionId?: string,
    requestId?: string
  ): Promise<{ success: boolean; account: string; amount: number; transactionId: string; operationKey: string }> {
    if (!isWholeDollar(amount)) throw new Error("Fire Kirin recharge amount must be a whole dollar.");
    const dollars = Math.trunc(amount);
    const txId = (transactionId || "").trim().slice(0, 20);
    const reservationId = (requestId || "").trim();
    if (!txId || !reservationId) throw new Error("A request id is required before Fire Kirin recharge.");
    let session = existingSession;
    return executeGuardedTransfer({
      store: this.transferStore,
      claim: {
        operationKey: `fire-kirin:recharge:${reservationId}`,
        provider: "fire-kirin",
        action: "recharge",
        amount: dollars,
        requestId: reservationId,
        playerAccount: account,
        providerTransactionId: txId,
        providerIdempotent: true,
      },
      prepare: async () => {
        session = session || (await this.getValidSession());
      },
      send: async () => {
        const { sign, time } = this.createSignFromSession(session as FireKirinSession);
        const url = `${this.apiUrl}?action=recharge&account=${encodeURIComponent(
          account
        )}&amount=${dollars}&transactionId=${encodeURIComponent(txId)}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;
        const json = await this.request(url);
        return {
          code: json.code,
          msg: json.msg ? `Fire Kirin recharge error [code ${json.code}]: ${json.msg}` : undefined,
          value: { success: true, account, amount: dollars, transactionId: txId },
        };
      },
    });
  }

  public async withdrawPlayer(
    account: string,
    amount: number,
    existingSession?: FireKirinSession,
    transactionId?: string,
    requestId?: string
  ): Promise<{ success: boolean; account: string; amount: number; transactionId: string; operationKey: string }> {
    if (!isWholeDollar(amount)) throw new Error("Fire Kirin redeem amount must be a whole dollar.");
    const dollars = Math.trunc(amount);
    const txId = (transactionId || "").trim().slice(0, 20);
    const reservationId = (requestId || "").trim();
    if (!txId || !reservationId) throw new Error("A request id is required before Fire Kirin redeem.");
    let session = existingSession;
    return executeGuardedTransfer({
      store: this.transferStore,
      claim: {
        operationKey: `fire-kirin:redeem:${reservationId}`,
        provider: "fire-kirin",
        action: "redeem",
        amount: dollars,
        requestId: reservationId,
        playerAccount: account,
        providerTransactionId: txId,
        providerIdempotent: true,
      },
      prepare: async () => {
        session = session || (await this.getValidSession());
      },
      send: async () => {
        const { sign, time } = this.createSignFromSession(session as FireKirinSession);
        const url = `${this.apiUrl}?action=redeem&account=${encodeURIComponent(
          account
        )}&amount=${dollars}&transactionId=${encodeURIComponent(txId)}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;
        const json = await this.request(url);
        return {
          code: json.code,
          msg: json.msg ? `Fire Kirin redeem error [code ${json.code}]: ${json.msg}` : undefined,
          value: { success: true, account, amount: dollars, transactionId: txId },
        };
      },
    });
  }

  public async changePassword(account: string, nextPassword: string, existingSession?: FireKirinSession): Promise<void> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);
    const url = `${this.apiUrl}?action=changePasswd&account=${encodeURIComponent(
      account
    )}&passwdNew=${encodeURIComponent(md5(nextPassword))}&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;
    const json = await this.request(url);
    if (String(json.code) !== "200") {
      throw new Error(`Fire Kirin changePasswd error [code ${json.code}]: ${json.msg || "Password reset failed"}`);
    }
  }

  public async kickPlayerOut(account: string, existingSession?: FireKirinSession): Promise<void> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);

    const url = `${this.apiUrl}?action=kickPlayerOut&account=${encodeURIComponent(
      account
    )}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      const errMsg = json.msg || `Kick failed with code ${json.code}`;
      throw new Error(`Fire Kirin kickPlayerOut error [code ${json.code}]: ${errMsg}`);
    }
  }
}

export function isFireKirinApiConfigured(): boolean {
  const username = process.env.FIREKIRIN_AGENT_USERNAME || "";
  const password = process.env.FIREKIRIN_AGENT_PASSWORD || "";
  return Boolean(username?.trim() && password?.trim());
}

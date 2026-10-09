import crypto from "crypto";
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

export function parseFireKirinUserBalance(info: FireKirinQueryResponse): number {
  const raw = info.userBalance ?? info.userbalance;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
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

/** Each successful Fire Kirin call burns its timestamp. The next call waits for a new second. */
async function nextFireKirinStamp(): Promise<string> {
  let now = Math.floor(Date.now() / 1000);
  if (now <= lastFireKirinStamp) {
    const waitMs = (lastFireKirinStamp + 1) * 1000 - Date.now() + 50;
    await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 50)));
    now = Math.floor(Date.now() / 1000);
  }
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
  public lastAgentBalance: number = 0;

  constructor(config: FireKirinConfig = {}) {
    this.apiUrl = OFFICIAL_API_URL;

    this.agentName = (config.agentName || process.env.FIREKIRIN_AGENT_USERNAME || "").trim();

    const rawPass = config.agentPassword || process.env.FIREKIRIN_AGENT_PASSWORD || "";
    this.agentPasswdHash = md5(rawPass.trim());

    if (config.proxyUrl === null) {
      this.fallbackProxy = undefined;
    } else {
      this.fallbackProxy = (config.proxyUrl || process.env.FIREKIRIN_PROXY_URL || "").trim() || undefined;
    }
  }

  get name(): string {
    return this.agentName;
  }

  private stamp(): Promise<string> {
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

  public async getAgentBalance(): Promise<number> {
    await this.getValidSession();
    return this.lastAgentBalance;
  }

  /** One agentLogin for this client. Later actions use a new timestamp and this agentKey. */
  public async getValidSession(): Promise<FireKirinSession> {
    if (this.session) return this.session;

    const time = await this.stamp();
    const json = await this.loginAt(time);
    const agentKey = json.agentkey || json.agentKey;
    if (String(json.code) !== "200" || !agentKey) {
      throw new Error(`Fire Kirin agentLogin failed: ${json.msg || `code ${json.code}`}`);
    }
    return this.rememberSession(json, String(agentKey), time);
  }

  private rememberSession(json: FireKirinLoginResponse, agentKey: string, time: string): FireKirinSession {
    const balance = json.balance ?? json.Balance;
    this.lastAgentBalance = parseFloat(String(balance || "0"));
    this.session = { agentKey, time };
    return this.session;
  }

  private async createSignFromSession(session: FireKirinSession): Promise<{ sign: string; time: string }> {
    const time = await this.stamp();
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
    const { sign, time } = await this.createSignFromSession(session);
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
    const { sign, time } = await this.createSignFromSession(session);

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

  public async rechargePlayer(
    account: string,
    amount: number,
    existingSession?: FireKirinSession,
    transactionId?: string
  ): Promise<{ success: boolean; account: string; amount: number; transactionId: string }> {
    if (!isWholeDollar(amount)) {
      throw new Error("Fire Kirin recharge amount must be a whole dollar.");
    }
    const dollars = Math.trunc(amount);
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = await this.createSignFromSession(session);
    const txId = (transactionId || "").slice(0, 20);
    const tx = txId ? `&transactionId=${encodeURIComponent(txId)}` : "";

    const url = `${this.apiUrl}?action=recharge&account=${encodeURIComponent(
      account
    )}&amount=${dollars}${tx}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      const errMsg = json.msg || `Recharge failed with code ${json.code}`;
      throw new Error(`Fire Kirin recharge error [code ${json.code}]: ${errMsg}`);
    }

    return { success: true, account, amount: dollars, transactionId: txId };
  }

  public async withdrawPlayer(
    account: string,
    amount: number,
    existingSession?: FireKirinSession,
    transactionId?: string
  ): Promise<{ success: boolean; account: string; amount: number; transactionId: string }> {
    if (!isWholeDollar(amount)) {
      throw new Error("Fire Kirin redeem amount must be a whole dollar.");
    }
    const dollars = Math.trunc(amount);
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = await this.createSignFromSession(session);
    const txId = (transactionId || "").slice(0, 20);
    const tx = txId ? `&transactionId=${encodeURIComponent(txId)}` : "";

    const url = `${this.apiUrl}?action=redeem&account=${encodeURIComponent(
      account
    )}&amount=${dollars}${tx}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      const errMsg = json.msg || `Redeem failed with code ${json.code}`;
      throw new Error(`Fire Kirin redeem error [code ${json.code}]: ${errMsg}`);
    }

    return { success: true, account, amount: dollars, transactionId: txId };
  }

  public async kickPlayerOut(account: string, existingSession?: FireKirinSession): Promise<void> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = await this.createSignFromSession(session);

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

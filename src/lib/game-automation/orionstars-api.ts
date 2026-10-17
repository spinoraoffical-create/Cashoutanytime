import crypto from "crypto";
import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getTransferStore } from "./supabase-transfer-store";
import { terminalAgentBalance, terminalAgentKey, terminalUserBalance } from "./terminal-response";
import { executeGuardedTransfer } from "./transfer-guard";
import type { DurableTransferStore } from "./transfer-ledger";

/**
 * Orion Stars Official Terminal API v1.2.6 Client
 */

export interface OrionStarsLoginResponse {
  code: string | number;
  balance?: string | number;
  Balance?: string | number;
  agentkey?: string;
  agentKey?: string;
  msg?: string;
}

export interface OrionStarsBaseResponse {
  code: string | number;
  msg?: string;
  status?: number;
}

export interface OrionStarsQueryResponse extends OrionStarsBaseResponse {
  agentBalance?: number | string;
  gameId?: number | string;
  /** API returns camelCase `userBalance` (e.g. "10.00"). */
  userBalance?: number | string;
  /** Legacy lowercase field seen in some docs — kept for compatibility. */
  userbalance?: number | string;
  webLoginUrl?: string;
}

export function parseOrionStarsUserBalance(info: OrionStarsQueryResponse): number | null {
  return terminalUserBalance(info);
}

export interface OrionStarsConfig {
  apiUrl?: string;
  agentName?: string;
  agentPassword?: string;
  proxyUrl?: string | null;
  transferStore?: DurableTransferStore;
}

export interface OrionStarsSession {
  agentKey: string;
  time: string;
}

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex").toLowerCase();
}

/**
 * Perform HTTPS POST with Webshare Proxy support
 */
function httpsPost(urlStr: string, hostHeader: string, proxyUrlStr?: string, timeoutMs: number = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);

      const agent = proxyUrlStr ? new HttpsProxyAgent(proxyUrlStr, { rejectUnauthorized: false }) : undefined;

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
        agent: agent,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Orion Stars API connection timed out after ${timeoutMs / 1000}s`));
      });

      req.on("error", (e) => reject(e));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export class OrionStarsApiClient {
  private apiUrl: string;
  private agentName: string;
  private agentPasswdHash: string;
  private proxyUrl?: string;
  private transferStore: DurableTransferStore;
  public lastAgentBalance: number | null = null;

  constructor(config: OrionStarsConfig = {}) {
    this.apiUrl = (
      config.apiUrl ||
      process.env.ORIONSTARS_API_URL ||
      "https://orionstars.vip:8033/ws/service.ashx"
    ).trim();

    this.agentName = (
      config.agentName ||
      process.env.ORIONSTARS_AGENT_USERNAME ||
      ""
    ).trim();

    const rawPass =
      config.agentPassword ||
      process.env.ORIONSTARS_AGENT_PASSWORD ||
      "";

    this.agentPasswdHash = md5(rawPass.trim());

    if (config.proxyUrl === null) {
      this.proxyUrl = undefined;
    } else {
      this.proxyUrl = (
        config.proxyUrl ||
        process.env.ORIONSTARS_PROXY_URL ||
        process.env.GAMEVAULT_PROXY_URL ||
        ""
      ).trim() || undefined;
    }
    this.transferStore = config.transferStore || getTransferStore();
  }

  private async request(url: string): Promise<any> {
    const text = await httpsPost(url, "orionstars.vip", this.proxyUrl);
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Orion Stars invalid JSON response: ${text.slice(0, 200)}`);
    }

    return json;
  }

  public async getValidSession(): Promise<OrionStarsSession> {
    const time = Date.now().toString();
    const loginUrl = `${this.apiUrl}?action=agentLogin&agentName=${encodeURIComponent(
      this.agentName
    )}&agentPasswd=${encodeURIComponent(this.agentPasswdHash)}&time=${time}`;

    const json: OrionStarsLoginResponse = await this.request(loginUrl);
    const agentKey = terminalAgentKey(json);

    if (String(json.code) !== "200" || !agentKey) {
      const msg = json.msg || `code ${json.code}`;
      throw new Error(`Orion Stars agentLogin failed: ${msg}`);
    }

    this.lastAgentBalance = terminalAgentBalance(json);
    return { agentKey, time };
  }

  private createSignFromSession(session: OrionStarsSession): { sign: string; time: string; agentKey: string } {
    // Orion Stars requires a fresh timestamp per signed request (not the agentLogin time).
    const time = Date.now().toString();
    const rawSignStr = (this.agentName + time + session.agentKey).toLowerCase();
    const sign = md5(rawSignStr);
    return { sign, time, agentKey: session.agentKey };
  }

  public async createAccount(
    account: string,
    pass: string,
    existingSession?: OrionStarsSession
  ): Promise<{ account: string; pass: string; session: OrionStarsSession }> {
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
      throw new Error(`Orion Stars registerUser error [code ${json.code}]: ${errMsg}`);
    }

    return { account, pass, session };
  }

  public async queryInfo(account: string, existingSession?: OrionStarsSession): Promise<OrionStarsQueryResponse> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);

    const url = `${this.apiUrl}?action=queryInfo&account=${encodeURIComponent(
      account
    )}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;

    const json: OrionStarsQueryResponse = await this.request(url);
    if (String(json.code) !== "200") {
      const errMsg = json.msg || `Query failed with code ${json.code}`;
      throw new Error(`Orion Stars queryInfo error [code ${json.code}]: ${errMsg}`);
    }

    return json;
  }

  /** Read-only. status 0 is available and status 1 is taken. It does not create a player. */
  public async checkAccountName(
    account: string,
    existingSession?: OrionStarsSession
  ): Promise<{ code: string; message: string; nameState: "available" | "taken" | "unknown" }> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);
    const url = `${this.apiUrl}?action=checkAccountName&account=${encodeURIComponent(
      account
    )}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;
    const json = await this.request(url);
    const code = String(json.code);
    const status = Number(json.status);
    const nameState = code === "200" && status === 0 ? "available" : code === "200" && status === 1 ? "taken" : "unknown";
    return { code, message: String(json.msg || ""), nameState };
  }

  public async rechargePlayer(
    account: string,
    amount: number,
    existingSession?: OrionStarsSession,
    requestId?: string
  ): Promise<{ success: boolean; account: string; amount: number; operationKey: string }> {
    return this.moneyCall("recharge", account, amount, existingSession, requestId);
  }

  public async withdrawPlayer(
    account: string,
    amount: number,
    existingSession?: OrionStarsSession,
    requestId?: string
  ): Promise<{ success: boolean; account: string; amount: number; operationKey: string }> {
    return this.moneyCall("redeem", account, amount, existingSession, requestId);
  }

  public async changePassword(account: string, nextPassword: string, existingSession?: OrionStarsSession): Promise<void> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);
    const url = `${this.apiUrl}?action=changePasswd&account=${encodeURIComponent(
      account
    )}&passwdNew=${encodeURIComponent(md5(nextPassword))}&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;
    const json = await this.request(url);
    if (String(json.code) !== "200") {
      throw new Error(`Orion Stars changePasswd error [code ${json.code}]: ${json.msg || "Password reset failed"}`);
    }
  }

  public async confirmOperation(operationKey: string): Promise<boolean> {
    return this.transferStore.confirm(operationKey);
  }

  private async moneyCall(
    action: "recharge" | "redeem",
    account: string,
    amount: number,
    existingSession: OrionStarsSession | undefined,
    requestId: string | undefined
  ): Promise<{ success: boolean; account: string; amount: number; operationKey: string }> {
    const reservationId = requestId?.trim() || "";
    if (!reservationId) throw new Error("A request id is required before an Orion Stars transfer.");
    let session = existingSession;
    const dollars = Math.floor(amount);
    return executeGuardedTransfer({
      store: this.transferStore,
      claim: {
        operationKey: `orion-stars:${action}:${reservationId}`,
        provider: "orion-stars",
        action,
        amount: dollars,
        requestId: reservationId,
        playerAccount: account,
        providerTransactionId: null,
        providerIdempotent: false,
      },
      prepare: async () => {
        session = session || (await this.getValidSession());
      },
      send: async () => {
        const { sign, time } = this.createSignFromSession(session as OrionStarsSession);
        const url = `${this.apiUrl}?action=${action}&account=${encodeURIComponent(
          account
        )}&amount=${dollars}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;
        const json = await this.request(url);
        return {
          code: json.code,
          msg: json.msg ? `Orion Stars ${action} error [code ${json.code}]: ${json.msg}` : undefined,
          value: { success: true, account, amount: dollars },
        };
      },
    });
  }
}

export function isOrionStarsApiConfigured(): boolean {
  const username = process.env.ORIONSTARS_AGENT_USERNAME || "";
  const password = process.env.ORIONSTARS_AGENT_PASSWORD || "";
  return Boolean(username?.trim() && password?.trim());
}

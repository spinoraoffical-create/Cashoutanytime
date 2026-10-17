import crypto from "crypto";
import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getTransferStore } from "./supabase-transfer-store";
import { terminalGameCount } from "./terminal-account";
import { providerReplyClass, providerReplyFlags, terminalAgentBalance, terminalAgentKey, terminalUserBalance } from "./terminal-response";
import { executeGuardedTransfer } from "./transfer-guard";
import type { DurableTransferStore } from "./transfer-ledger";

/**
 * Milky Way Official Terminal API v1.2.3 Client
 */

export interface MilkyWayLoginResponse {
  code: string | number;
  balance?: string | number;
  Balance?: string | number;
  agentkey?: string;
  agentKey?: string;
  msg?: string;
}

export interface MilkyWayBaseResponse {
  code: string | number;
  msg?: string;
}

export interface MilkyWayQueryResponse extends MilkyWayBaseResponse {
  agentBalance?: number | string;
  gameId?: number | string;
  userBalance?: number | string;
  userbalance?: number | string;
  webLoginUrl?: string;
}

export function parseMilkyWayUserBalance(info: MilkyWayQueryResponse): number | null {
  return terminalUserBalance(info);
}

export interface MilkyWayConfig {
  apiUrl?: string;
  agentName?: string;
  agentPassword?: string;
  proxyUrl?: string | null;
  transferStore?: DurableTransferStore;
}

export interface MilkyWaySession {
  agentKey: string;
  time: string;
  balance: number | null;
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
        reject(new Error(`Milky Way API connection timed out after ${timeoutMs / 1000}s`));
      });

      req.on("error", (e) => reject(e));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export class MilkyWayApiClient {
  private apiUrl: string;
  private agentName: string;
  private agentPasswdHash: string;
  private proxyUrl?: string;
  private transferStore: DurableTransferStore;
  public lastAgentBalance: number | null = null;

  constructor(config: MilkyWayConfig = {}) {
    this.apiUrl = (
      config.apiUrl ||
      process.env.MILKYWAY_API_URL ||
      "https://milkywayapp.xyz:8033/ws/service.ashx"
    ).trim();

    this.agentName = (
      config.agentName ||
      process.env.MILKYWAY_AGENT_USERNAME ||
      ""
    ).trim();

    const rawPass =
      config.agentPassword ||
      process.env.MILKYWAY_AGENT_PASSWORD ||
      "";

    this.agentPasswdHash = md5(rawPass.trim());

    if (config.proxyUrl === null) {
      this.proxyUrl = undefined;
    } else {
      this.proxyUrl = (
        config.proxyUrl ||
        process.env.MILKYWAY_PROXY_URL ||
        process.env.GAMEVAULT_PROXY_URL ||
        ""
      ).trim() || undefined;
    }
    this.transferStore = config.transferStore || getTransferStore();
  }

  private async request(url: string): Promise<any> {
    const text = await httpsPost(url, "milkywayapp.xyz", this.proxyUrl);
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("<")) {
      throw new Error(`Milky Way API unreachable: ${trimmed.slice(0, 120) || "empty response"}`);
    }
    let json: any = {};
    try {
      json = JSON.parse(trimmed);
    } catch {
      throw new Error(`Milky Way invalid JSON response: ${trimmed.slice(0, 200)}`);
    }
    return json;
  }

  public async getFreshSession(): Promise<MilkyWaySession> {
    const time = Date.now().toString();
    const loginUrl = `${this.apiUrl}?action=agentLogin&agentName=${encodeURIComponent(
      this.agentName
    )}&agentPasswd=${encodeURIComponent(this.agentPasswdHash)}&time=${time}`;

    const json: MilkyWayLoginResponse = await this.request(loginUrl);
    const agentKey = terminalAgentKey(json);

    if (String(json.code) !== "200" || !agentKey) {
      const msg = json.msg || `code ${json.code}`;
      throw new Error(`Milky Way agentLogin failed: ${msg}`);
    }

    const bal = terminalAgentBalance(json);
    this.lastAgentBalance = bal;

    return { agentKey, time, balance: bal };
  }

  private createSignFromSession(session: MilkyWaySession): { sign: string; time: string; agentKey: string } {
    // Milky Way requires a fresh timestamp per signed request (not the agentLogin time).
    const time = Date.now().toString();
    const rawSignStr = (this.agentName + time + session.agentKey).toLowerCase();
    const sign = md5(rawSignStr);
    return { sign, time, agentKey: session.agentKey };
  }

  public async createAccount(
    account: string,
    pass: string,
    existingSession?: MilkyWaySession
  ): Promise<{ account: string; pass: string; session: MilkyWaySession }> {
    const session = existingSession || (await this.getFreshSession());
    const { sign, time } = this.createSignFromSession(session);
    const passHash = md5(pass);

    const url = `${this.apiUrl}?action=registerUser&account=${encodeURIComponent(
      account
    )}&passwd=${encodeURIComponent(passHash)}&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;

    const json = await this.request(url);

    if (String(json.code) !== "200") {
      const msg = json.msg || `Registration failed with code ${json.code}`;
      throw new Error(`Milky Way registerUser error [code ${json.code}]: ${msg}`);
    }

    return { account, pass, session };
  }

  public async queryInfo(account: string, existingSession?: MilkyWaySession): Promise<MilkyWayQueryResponse> {
    const session = existingSession || (await this.getFreshSession());
    const { sign, time } = this.createSignFromSession(session);

    const url = `${this.apiUrl}?action=queryInfo&account=${encodeURIComponent(
      account
    )}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;

    const json: MilkyWayQueryResponse = await this.request(url);
    if (String(json.code) !== "200") {
      const msg = json.msg || `Query failed with code ${json.code}`;
      throw new Error(`Milky Way queryInfo error [code ${json.code}]: ${msg}`);
    }

    return json;
  }

  /** Read-only signed call from the official signature example. It does not create a player. */
  public async listGames(
    existingSession?: MilkyWaySession
  ): Promise<{ code: string; message: string; gameCount: number | null }> {
    const session = existingSession || (await this.getFreshSession());
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

  public async rechargePlayer(
    account: string,
    amount: number,
    existingSession?: MilkyWaySession,
    requestId?: string
  ): Promise<{ success: boolean; account: string; amount: number; operationKey: string }> {
    return this.moneyCall("recharge", account, amount, existingSession, requestId);
  }

  public async withdrawPlayer(
    account: string,
    amount: number,
    existingSession?: MilkyWaySession,
    requestId?: string
  ): Promise<{ success: boolean; account: string; amount: number; operationKey: string }> {
    return this.moneyCall("redeem", account, amount, existingSession, requestId);
  }

  public async changePassword(account: string, nextPassword: string, existingSession?: MilkyWaySession): Promise<void> {
    const session = existingSession || (await this.getFreshSession());
    const { sign, time } = this.createSignFromSession(session);
    const url = `${this.apiUrl}?action=changePasswd&account=${encodeURIComponent(
      account
    )}&passwdNew=${encodeURIComponent(md5(nextPassword))}&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;
    const json = await this.request(url);
    if (String(json.code) !== "200") {
      throw new Error(`Milky Way changePasswd error [code ${json.code}]: ${json.msg || "Password reset failed"}`);
    }
  }

  public async confirmOperation(operationKey: string): Promise<boolean> {
    return this.transferStore.confirm(operationKey);
  }

  /** Read-only. Sends the same query timestamp twice and returns codes only. */
  public async compareStampReuse(account: string): Promise<{ firstCode: string; repeatCode: string; balance: number | null; firstClass: string; flags: ReturnType<typeof providerReplyFlags> }> {
    const session = await this.getFreshSession();
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

  private async moneyCall(
    action: "recharge" | "redeem",
    account: string,
    amount: number,
    existingSession: MilkyWaySession | undefined,
    requestId: string | undefined
  ): Promise<{ success: boolean; account: string; amount: number; operationKey: string }> {
    const reservationId = requestId?.trim() || "";
    if (!reservationId) throw new Error("A request id is required before a Milky Way transfer.");
    let session = existingSession;
    const dollars = Math.floor(amount);
    return executeGuardedTransfer({
      store: this.transferStore,
      claim: {
        operationKey: `milky-way:${action}:${reservationId}`,
        provider: "milky-way",
        action,
        amount: dollars,
        requestId: reservationId,
        playerAccount: account,
        providerTransactionId: null,
        providerIdempotent: false,
      },
      prepare: async () => {
        session = session || (await this.getFreshSession());
      },
      send: async () => {
        const { sign, time } = this.createSignFromSession(session as MilkyWaySession);
        const url = `${this.apiUrl}?action=${action}&account=${encodeURIComponent(
          account
        )}&amount=${dollars}&agentName=${encodeURIComponent(this.agentName)}&time=${time}&sign=${sign}`;
        const json = await this.request(url);
        return {
          code: json.code,
          msg: json.msg ? `Milky Way ${action} error [code ${json.code}]: ${json.msg}` : undefined,
          value: { success: true, account, amount: dollars },
        };
      },
    });
  }
}

export function isMilkyWayApiConfigured(): boolean {
  const username = process.env.MILKYWAY_AGENT_USERNAME || "";
  const password = process.env.MILKYWAY_AGENT_PASSWORD || "";
  return Boolean(username?.trim() && password?.trim());
}

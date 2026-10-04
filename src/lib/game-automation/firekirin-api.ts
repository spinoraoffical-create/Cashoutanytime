import crypto from "crypto";
import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";

/**
 * Fire Kirin Terminal API v1.0
 * https://firekirin.xyz:8034/ws/service.ashx
 */

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

export interface FireKirinConfig {
  apiUrl?: string;
  agentName?: string;
  agentPassword?: string;
  /** Set to `null` to skip proxy; omit to use env vars. */
  proxyUrl?: string | null;
}

export interface FireKirinSession {
  agentKey: string;
  time: string;
}

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex").toLowerCase();
}

function makeTransactionId(): string {
  return `fk${Date.now().toString(36)}`.slice(0, 20);
}

function httpsPost(
  urlStr: string,
  hostHeader: string,
  proxyUrlStr?: string,
  timeoutMs: number = 15000
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const agent = proxyUrlStr
        ? new HttpsProxyAgent(proxyUrlStr, { rejectUnauthorized: false })
        : undefined;

      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 8034,
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

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Fire Kirin API connection timed out after ${timeoutMs / 1000}s`));
      });

      req.on("error", (e) => reject(e));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export class FireKirinApiClient {
  private apiUrl: string;
  private agentName: string;
  private agentPasswdHash: string;
  private proxyUrl?: string;
  public lastAgentBalance: number = 0;

  constructor(config: FireKirinConfig = {}) {
    this.apiUrl = (
      config.apiUrl ||
      process.env.FIREKIRIN_API_URL ||
      "https://52.41.26.140:8034/ws/service.ashx"
    ).trim();

    this.agentName = (
      config.agentName ||
      process.env.FIREKIRIN_AGENT_USERNAME ||
      "Darklord1121"
    ).trim();

    const rawPass =
      config.agentPassword ||
      process.env.FIREKIRIN_AGENT_PASSWORD ||
      "Darklord1121";

    this.agentPasswdHash = md5(rawPass.trim());

    if (config.proxyUrl === null) {
      this.proxyUrl = undefined;
    } else {
      this.proxyUrl = (
        config.proxyUrl ||
        process.env.FIREKIRIN_PROXY_URL ||
        process.env.GAMEVAULT_PROXY_URL ||
        ""
      ).trim() || undefined;
    }
  }

  private async request(url: string): Promise<any> {
    const text = await httpsPost(url, "firekirin.xyz", this.proxyUrl);
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("<") || /bad gateway/i.test(trimmed)) {
      const hint = this.proxyUrl
        ? "Proxy cannot reach Fire Kirin on port 8034 (bad gateway). Ask your proxy provider to allow port 8034, or ask Fire Kirin support to confirm the Terminal API host is online."
        : "Direct connection blocked — Fire Kirin requires a whitelisted egress IP (use FIREKIRIN_PROXY_URL).";
      throw new Error(`Fire Kirin API unreachable: ${trimmed.slice(0, 120) || "empty response"}. ${hint}`);
    }
    let json: any = {};
    try {
      json = JSON.parse(trimmed);
    } catch {
      throw new Error(`Fire Kirin invalid JSON response: ${trimmed.slice(0, 200)}`);
    }
    return json;
  }

  public async getAgentBalance(): Promise<number> {
    await this.getValidSession();
    return this.lastAgentBalance;
  }

  public async getValidSession(): Promise<FireKirinSession> {
    const time = Date.now().toString();
    const loginUrl = `${this.apiUrl}?action=agentLogin&agentName=${encodeURIComponent(
      this.agentName
    )}&agentPasswd=${encodeURIComponent(this.agentPasswdHash)}&time=${time}`;

    console.log(
      `[FireKirin API] agentLogin | agentName: "${this.agentName}" | proxy: ${this.proxyUrl ? "ENABLED" : "DIRECT"}`
    );

    const json: FireKirinLoginResponse = await this.request(loginUrl);
    const agentKey = json.agentkey || json.agentKey;
    const balance = json.balance ?? json.Balance;

    console.log(
      `[FireKirin API] agentLogin response | code: ${json.code} | balance: "${balance}" | agentKey: ${agentKey ? String(agentKey).slice(0, 6) + "..." : "NONE"}`
    );

    if (String(json.code) !== "200" || !agentKey) {
      const msg = json.msg || `code ${json.code}`;
      throw new Error(`Fire Kirin agentLogin failed: ${msg}`);
    }

    this.lastAgentBalance = parseFloat(String(balance || "0"));
    return { agentKey: String(agentKey), time };
  }

  private createSignFromSession(session: FireKirinSession): { sign: string; time: string } {
    const time = Date.now().toString();
    const rawSignStr = (this.agentName + time + session.agentKey).toLowerCase();
    const sign = md5(rawSignStr);
    return { sign, time };
  }

  public async createAccount(
    account: string,
    pass: string,
    existingSession?: FireKirinSession
  ): Promise<{ account: string; pass: string; session: FireKirinSession }> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);
    const passHash = md5(pass);

    const url = `${this.apiUrl}?action=registerUser&account=${encodeURIComponent(
      account
    )}&passwd=${encodeURIComponent(passHash)}&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;

    console.log(`[FireKirin API] registerUser for account: "${account}"`);

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      let errMsg = json.msg || `Registration failed with code ${json.code}`;
      if (String(json.code) === "201" && /signature/i.test(errMsg)) {
        errMsg = `${errMsg} (Check IP whitelist and agent store balance on Fire Kirin panel)`;
      }
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
      let errMsg = json.msg || `Query failed with code ${json.code}`;
      if (String(json.code) === "201") {
        errMsg = `${errMsg} (Session timeout or signature error)`;
      }
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
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);
    const txId = (transactionId || makeTransactionId()).slice(0, 20);

    const url = `${this.apiUrl}?action=recharge&account=${encodeURIComponent(
      account
    )}&amount=${Math.floor(amount)}&transactionId=${encodeURIComponent(txId)}&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      const errMsg = json.msg || `Recharge failed with code ${json.code}`;
      throw new Error(`Fire Kirin recharge error [code ${json.code}]: ${errMsg}`);
    }

    return { success: true, account, amount, transactionId: txId };
  }

  public async withdrawPlayer(
    account: string,
    amount: number,
    existingSession?: FireKirinSession,
    transactionId?: string
  ): Promise<{ success: boolean; account: string; amount: number; transactionId: string }> {
    const session = existingSession || (await this.getValidSession());
    const { sign, time } = this.createSignFromSession(session);
    const txId = (transactionId || makeTransactionId()).slice(0, 20);

    const url = `${this.apiUrl}?action=redeem&account=${encodeURIComponent(
      account
    )}&amount=${Math.floor(amount)}&transactionId=${encodeURIComponent(txId)}&agentName=${encodeURIComponent(
      this.agentName
    )}&time=${time}&sign=${sign}`;

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      const errMsg = json.msg || `Redeem failed with code ${json.code}`;
      throw new Error(`Fire Kirin redeem error [code ${json.code}]: ${errMsg}`);
    }

    return { success: true, account, amount, transactionId: txId };
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
  const username = process.env.FIREKIRIN_AGENT_USERNAME || "Darklord1121";
  const password = process.env.FIREKIRIN_AGENT_PASSWORD || "Darklord1121";
  return Boolean(username?.trim() && password?.trim());
}

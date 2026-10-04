import crypto from "crypto";
import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";

/**
 * Milky Way Official Terminal API v1.2.3 Client
 */

export interface MilkyWayLoginResponse {
  code: string | number;
  balance?: string | number;
  agentkey?: string;
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

export function parseMilkyWayUserBalance(info: MilkyWayQueryResponse): number {
  const raw = info.userBalance ?? info.userbalance;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export interface MilkyWayConfig {
  apiUrl?: string;
  agentName?: string;
  agentPassword?: string;
  proxyUrl?: string;
}

export interface MilkyWaySession {
  agentKey: string;
  time: string;
  balance: number;
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
  public lastAgentBalance: number = 0;

  constructor(config: MilkyWayConfig = {}) {
    this.apiUrl = (
      config.apiUrl ||
      process.env.MILKYWAY_API_URL ||
      "https://47.252.40.52:8033/ws/service.ashx"
    ).trim();

    this.agentName = (
      config.agentName ||
      process.env.MILKYWAY_AGENT_USERNAME ||
      "Darklord1121"
    ).trim();

    const rawPass =
      config.agentPassword ||
      process.env.MILKYWAY_AGENT_PASSWORD ||
      "Darklord1121";

    this.agentPasswdHash = md5(rawPass.trim());

    this.proxyUrl = (
      config.proxyUrl ||
      process.env.MILKYWAY_PROXY_URL ||
      process.env.GAMEVAULT_PROXY_URL ||
      "http://sbhxwsxp:xn5frycnonl5@198.23.243.226:6361"
    ).trim();
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

    console.log(`[MW API] agentLogin call | agentName: "${this.agentName}" | proxy: ${this.proxyUrl ? "ENABLED" : "DIRECT"}`);

    const json: MilkyWayLoginResponse = await this.request(loginUrl);

    console.log(`[MW API] agentLogin response | code: ${json.code} | balance: "${json.balance}" | agentKey: ${json.agentkey ? json.agentkey.slice(0, 6) + "..." : "NONE"}`);

    if (String(json.code) !== "200" || !json.agentkey) {
      const msg = json.msg || `code ${json.code}`;
      throw new Error(`Milky Way agentLogin failed: ${msg}`);
    }

    const bal = parseFloat(String(json.balance || "0"));
    this.lastAgentBalance = bal;

    return { agentKey: json.agentkey, time, balance: bal };
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
    const { sign, time, agentKey } = this.createSignFromSession(session);
    const passHash = md5(pass);

    const url = `${this.apiUrl}?action=registerUser&account=${encodeURIComponent(
      account
    )}&passwd=${encodeURIComponent(passHash)}&agentName=${encodeURIComponent(
      this.agentName
    )}&agentkey=${encodeURIComponent(agentKey)}&time=${time}&sign=${sign}`;

    console.log(`[MW API] registerUser calling for account: "${account}"...`);

    const json = await this.request(url);

    console.log(`[MW API] registerUser response | code: ${json.code} | msg: "${json.msg || ""}"`);

    if (String(json.code) !== "200") {
      let msg = json.msg || `Registration failed with code ${json.code}`;
      if (String(json.code) === "201") {
        if (/session timeout/i.test(msg)) {
          msg = `${msg} (Retry the request — session expired)`;
        } else if (/signature/i.test(msg)) {
          msg = `${msg} (Enable Terminal API on the Milky Way agent panel, or ask your distributor to activate signed API access for agent ${this.agentName})`;
        } else {
          msg = `${msg} (Verify store balance on Milky Way agent panel)`;
        }
      }
      throw new Error(`Milky Way registerUser error [code ${json.code}]: ${msg}`);
    }

    return { account, pass, session };
  }

  public async queryInfo(account: string, existingSession?: MilkyWaySession): Promise<MilkyWayQueryResponse> {
    const session = existingSession || (await this.getFreshSession());
    const { sign, time, agentKey } = this.createSignFromSession(session);

    const url = `${this.apiUrl}?action=queryInfo&account=${encodeURIComponent(
      account
    )}&agentName=${encodeURIComponent(this.agentName)}&agentkey=${encodeURIComponent(
      agentKey
    )}&time=${time}&sign=${sign}`;

    const json: MilkyWayQueryResponse = await this.request(url);
    if (String(json.code) !== "200") {
      let msg = json.msg || `Query failed with code ${json.code}`;
      if (String(json.code) === "201") {
        if (/signature/i.test(msg)) {
          msg = `${msg} (Enable Terminal API on the Milky Way agent panel for agent ${this.agentName})`;
        } else {
          msg = `${msg} (Session timeout)`;
        }
      }
      throw new Error(`Milky Way queryInfo error [code ${json.code}]: ${msg}`);
    }

    return json;
  }

  public async rechargePlayer(account: string, amount: number, existingSession?: MilkyWaySession): Promise<{ success: boolean; account: string; amount: number }> {
    const session = existingSession || (await this.getFreshSession());
    const { sign, time, agentKey } = this.createSignFromSession(session);

    const url = `${this.apiUrl}?action=recharge&account=${encodeURIComponent(
      account
    )}&amount=${Math.floor(amount)}&agentName=${encodeURIComponent(
      this.agentName
    )}&agentkey=${encodeURIComponent(agentKey)}&time=${time}&sign=${sign}`;

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      const msg = json.msg || `Recharge failed with code ${json.code}`;
      throw new Error(`Milky Way recharge error [code ${json.code}]: ${msg}`);
    }

    return { success: true, account, amount };
  }

  public async withdrawPlayer(account: string, amount: number, existingSession?: MilkyWaySession): Promise<{ success: boolean; account: string; amount: number }> {
    const session = existingSession || (await this.getFreshSession());
    const { sign, time, agentKey } = this.createSignFromSession(session);

    const url = `${this.apiUrl}?action=redeem&account=${encodeURIComponent(
      account
    )}&amount=${Math.floor(amount)}&agentName=${encodeURIComponent(
      this.agentName
    )}&agentkey=${encodeURIComponent(agentKey)}&time=${time}&sign=${sign}`;

    const json = await this.request(url);
    if (String(json.code) !== "200") {
      const msg = json.msg || `Redeem failed with code ${json.code}`;
      throw new Error(`Milky Way redeem error [code ${json.code}]: ${msg}`);
    }

    return { success: true, account, amount };
  }
}

export function isMilkyWayApiConfigured(): boolean {
  const username = process.env.MILKYWAY_AGENT_USERNAME || "Darklord1121";
  const password = process.env.MILKYWAY_AGENT_PASSWORD || "Darklord1121";
  return Boolean(username?.trim() && password?.trim());
}

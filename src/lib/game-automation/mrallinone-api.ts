import { createHash } from "crypto";
import https from "https";
import tls from "tls";
import net from "net";
import { URL } from "url";

/**
 * MR All-in-One Direct REST API Client
 * Same layui/agent-panel API family as Gameroom / Cash Machine.
 *
 * Host: https://agentserver.mrallinone777.com
 * Auth: POST /api/agent/login → Bearer token
 * Requires whitelisted exit IP (MRALLINONE_PROXY_URL)
 */

export interface MrAllInOneLoginResponse {
  status_code: number;
  message: string;
  data: {
    userName: string;
    nickname: string;
    money: string;
    token: string;
    expires_time: number;
  };
}

export interface MrAllInOnePlayer {
  Account: string;
  nickname: string;
  AddDate: string;
  LoginCount: number;
  lasttime: string;
  loginip: string;
  account_using: number;
  id: number;
  score: number;
}

export interface MrAllInOnePlayerListResponse {
  status_code: number;
  message: string;
  count: number;
  data: MrAllInOnePlayer[];
}

export interface MrAllInOneAddPlayerResponse {
  status_code: number;
  message: string;
  data: {
    account: string;
    password: string;
    balance: string;
    time: string;
  };
}

export interface MrAllInOneGetScoreResponse {
  status_code: number;
  message: string;
  data: {
    username: string;
    balance: number;
    is_game: boolean;
  };
}

export interface MrAllInOneRechargeResponse {
  status_code: number;
  message: string;
  data: {
    game_id: number;
    username: string;
    balance: number;
    remark: string;
    time: string;
  };
}

export interface MrAllInOneWithdrawResponse {
  status_code: number;
  message: string;
  data: {
    game_id: number;
    username: string;
    balance: number;
    remark: string;
    time: string;
  };
}

export interface MrAllInOneApiConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
  proxyUrl?: string;
}

function cleanChunkedResponse(text: string): string {
  const s = text.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

function buildMultipart(formData: Record<string, string>): { boundary: string; body: Buffer } {
  const boundary =
    "----WebKitFormBoundary" + createHash("md5").update(Date.now().toString()).digest("hex").slice(0, 16);
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(formData)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, "utf8")
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return { boundary, body: Buffer.concat(parts) };
}

function httpsViaProxy(
  method: "GET" | "POST",
  targetUrlStr: string,
  headers: Record<string, string>,
  bodyBuffer: Buffer | null,
  proxyUrlStr?: string,
  timeoutMs = 15000
): Promise<{ text: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    try {
      const targetUrl = new URL(targetUrlStr);
      const timer = setTimeout(() => reject(new Error("MR All-in-One API timed out after 15s")), timeoutMs);
      const finish = (text: string, statusCode: number) => {
        clearTimeout(timer);
        resolve({ text, statusCode });
      };

      const writeRequest = (socket: tls.TLSSocket) => {
        const reqPath = targetUrl.pathname + targetUrl.search;
        let httpReq =
          `${method} ${reqPath} HTTP/1.1\r\n` +
          `Host: ${targetUrl.hostname}\r\n` +
          `User-Agent: Mozilla/5.0\r\n` +
          `Connection: close\r\n`;
        for (const [k, v] of Object.entries(headers)) {
          httpReq += `${k}: ${v}\r\n`;
        }
        if (bodyBuffer) httpReq += `Content-Length: ${bodyBuffer.length}\r\n`;
        httpReq += `\r\n`;
        socket.write(httpReq);
        if (bodyBuffer) socket.write(bodyBuffer);

        let resText = "";
        socket.on("data", (data: Buffer) => (resText += data.toString("utf8")));
        socket.on("end", () => {
          const parts = resText.split("\r\n\r\n");
          const head = parts[0] || "";
          const body = parts.slice(1).join("\r\n\r\n");
          const statusMatch = head.match(/HTTP\/\d\.\d\s+(\d+)/i);
          finish(body, statusMatch ? parseInt(statusMatch[1], 10) : 200);
        });
        socket.on("error", (e: Error) => {
          clearTimeout(timer);
          reject(e);
        });
      };

      if (proxyUrlStr) {
        const proxyUrl = new URL(proxyUrlStr);
        const targetHost = targetUrl.hostname;
        const targetPort = targetUrl.port ? Number(targetUrl.port) : 443;
        const proxyAuth =
          proxyUrl.username && proxyUrl.password
            ? Buffer.from(
                `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`
              ).toString("base64")
            : null;

        const socket = net.connect(Number(proxyUrl.port || 80), proxyUrl.hostname, () => {
          let connectReq =
            `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` + `Host: ${targetHost}:${targetPort}\r\n`;
          if (proxyAuth) connectReq += `Proxy-Authorization: Basic ${proxyAuth}\r\n`;
          connectReq += `\r\n`;
          socket.write(connectReq);
        });

        let connectHeaderBuf = "";
        let established = false;
        socket.on("data", function onData(chunk: Buffer) {
          if (established) return;
          connectHeaderBuf += chunk.toString("utf8");
          if (!connectHeaderBuf.includes("\r\n\r\n")) return;
          const firstLine = connectHeaderBuf.split("\r\n")[0];
          if (!/HTTP\/\d\.\d\s+200/i.test(firstLine)) {
            clearTimeout(timer);
            reject(new Error(`Proxy CONNECT failed: ${firstLine}`));
            return;
          }
          established = true;
          socket.removeListener("data", onData);
          const tlsSocket = tls.connect(
            { socket, servername: targetHost, rejectUnauthorized: false },
            () => writeRequest(tlsSocket)
          );
          tlsSocket.on("error", (e) => {
            clearTimeout(timer);
            reject(e);
          });
        });
        socket.on("error", (e) => {
          if (!established) {
            clearTimeout(timer);
            reject(e);
          }
        });
        return;
      }

      const options: https.RequestOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port ? Number(targetUrl.port) : 443,
        path: targetUrl.pathname + targetUrl.search,
        method,
        headers: {
          ...headers,
          ...(bodyBuffer ? { "Content-Length": bodyBuffer.length } : {}),
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => finish(data, res.statusCode || 200));
      });
      req.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      if (bodyBuffer) req.write(bodyBuffer);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export class MrAllInOneApiClient {
  private baseUrl: string;
  private agentUsername: string;
  private agentPassword: string;
  private proxyUrl?: string;
  private token: string | null = null;
  private expiresTime: number | null = null;

  constructor(config: MrAllInOneApiConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      process.env.MRALLINONE_API_BASE_URL ||
      process.env.MRALLINONE_ADMIN_URL?.replace(/\/admin.*$/i, "") ||
      "https://agentserver.mrallinone777.com"
    ).replace(/\/+$/, "");

    this.agentUsername = (
      config.username ||
      process.env.MRALLINONE_AGENT_USERNAME ||
      process.env.MRALLINONE_USERNAME ||
      ""
    ).trim();

    this.agentPassword = (
      config.password ||
      process.env.MRALLINONE_AGENT_PASSWORD ||
      process.env.MRALLINONE_PASSWORD ||
      ""
    ).trim();

    this.proxyUrl = (
      config.proxyUrl ||
      process.env.MRALLINONE_PROXY_URL ||
      process.env.GAMEVAULT_PROXY_URL ||
      ""
    ).trim() || undefined;
  }

  private async ensureAuthenticated(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.expiresTime && this.expiresTime - now > 60) {
      return this.token;
    }
    return this.login();
  }

  private async requestJson<T>(
    endpoint: string,
    method: "GET" | "POST",
    formParams?: Record<string, string | number>,
    requiresAuth = true,
    isRetry = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {};

    if (requiresAuth) {
      headers.Authorization = `Bearer ${await this.ensureAuthenticated()}`;
    }

    let bodyBuffer: Buffer | null = null;
    if (formParams) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(formParams)) fields[k] = String(v);
      const multipart = buildMultipart(fields);
      headers["Content-Type"] = `multipart/form-data; boundary=${multipart.boundary}`;
      bodyBuffer = multipart.body;
    }

    console.log(`[MR All-in-One API] ${method} ${endpoint}`);

    const { text, statusCode } = await httpsViaProxy(method, url, headers, bodyBuffer, this.proxyUrl);
    const cleaned = cleanChunkedResponse(text);

    let json: any;
    try {
      json = JSON.parse(cleaned);
    } catch {
      throw new Error(`Invalid JSON from MR All-in-One API (HTTP ${statusCode}): ${text.slice(0, 200)}`);
    }

    const code = json.status_code ?? json.code ?? statusCode;
    if (code !== 200) {
      const errorMsg = json.message || json.msg || `API call failed with status ${code}`;
      if (code === 401 && requiresAuth && !isRetry) {
        this.token = null;
        this.expiresTime = null;
        return this.requestJson<T>(endpoint, method, formParams, true, true);
      }
      throw new Error(errorMsg);
    }

    return json as T;
  }

  async login(username?: string, password?: string): Promise<string> {
    const user = username || this.agentUsername;
    const pass = password || this.agentPassword;
    if (!user || !pass) {
      throw new Error("MR All-in-One agent credentials missing (MRALLINONE_AGENT_USERNAME / MRALLINONE_AGENT_PASSWORD).");
    }

    const res = await this.requestJson<MrAllInOneLoginResponse>(
      "/api/agent/login",
      "POST",
      { username: user, password: pass },
      false
    );

    if (!res.data?.token) {
      throw new Error(res.message || "Store login failed: no token returned");
    }

    this.token = res.data.token;
    this.expiresTime = res.data.expires_time || Math.floor(Date.now() / 1000) + 3600;
    return this.token;
  }

  async getPlayerList(
    limit = 50,
    page = 1,
    extra: Record<string, string> = {}
  ): Promise<MrAllInOnePlayerListResponse> {
    const params = new URLSearchParams({ limit: String(limit), page: String(page), ...extra });
    return this.requestJson<MrAllInOnePlayerListResponse>(`/api/player/playerList?${params}`, "GET");
  }

  async findPlayerByAccount(accountOrId: string | number): Promise<MrAllInOnePlayer | null> {
    const strVal = String(accountOrId).trim();
    if (/^\d+$/.test(strVal)) {
      return { id: Number(strVal), Account: strVal } as MrAllInOnePlayer;
    }
    try {
      const id = await this.resolvePlayerId(strVal);
      return { id: Number(id), Account: strVal } as MrAllInOnePlayer;
    } catch {
      return null;
    }
  }

  async resolvePlayerId(accountOrId: string | number): Promise<string> {
    const { resolveLayuiPlayerId } = await import("./layui-player-resolve");
    return resolveLayuiPlayerId({
      agentKey: "mrallinone",
      accountOrId,
      fetchList: async (params) => {
        const limit = Number(params.limit || 20);
        const page = Number(params.page || 1);
        const { limit: _l, page: _p, ...extra } = params;
        return this.getPlayerList(limit, page, extra);
      },
    });
  }

  async addPlayer(
    username: string,
    password = "123456",
    nickname?: string,
    money: string | number = "0"
  ): Promise<MrAllInOneAddPlayerResponse> {
    const cleanUser = username.trim();
    let cleanNick = (nickname && nickname !== "-" ? nickname : cleanUser)
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 20);
    if (!cleanNick) cleanNick = "User" + Math.floor(1000 + Math.random() * 9000);

    const res = await this.requestJson<MrAllInOneAddPlayerResponse>("/api/player/insertPlayer", "POST", {
      username: cleanUser,
      nickname: cleanNick,
      password: String(password).trim(),
      money: String(money),
    });
    const pid = (res.data as any)?.id;
    if (pid) {
      const { cachePlayerId } = await import("./layui-player-resolve");
      cachePlayerId("mrallinone", res.data?.account || cleanUser, pid);
    }
    return res;
  }

  async getPlayerScore(idOrAccount: string | number): Promise<MrAllInOneGetScoreResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const params = new URLSearchParams({ id });
    return this.requestJson<MrAllInOneGetScoreResponse>(`/api/player/getScore?${params}`, "GET");
  }

  async rechargePlayer(
    idOrAccount: string | number,
    balance: number | string,
    remark = "webrecharge"
  ): Promise<MrAllInOneRechargeResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const cleanRemark = (remark || "webrecharge").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "webrecharge";
    return this.requestJson<MrAllInOneRechargeResponse>("/api/player/playerRecharge", "POST", {
      id,
      balance: String(balance),
      remark: cleanRemark,
    });
  }

  async withdrawPlayer(
    idOrAccount: string | number,
    balance: number | string,
    remark = "webwithdraw"
  ): Promise<MrAllInOneWithdrawResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const cleanRemark = (remark || "webwithdraw").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "webwithdraw";
    return this.requestJson<MrAllInOneWithdrawResponse>("/api/player/playerWithdraw", "POST", {
      id,
      balance: String(balance),
      remark: cleanRemark,
    });
  }
}

export function isMrAllInOneApiConfigured(): boolean {
  return Boolean(
    process.env.MRALLINONE_AGENT_USERNAME?.trim() && process.env.MRALLINONE_AGENT_PASSWORD?.trim()
  );
}

let globalClient: MrAllInOneApiClient | null = null;
export function getMrAllInOneApiClient(config?: MrAllInOneApiConfig): MrAllInOneApiClient {
  if (config || !globalClient) {
    globalClient = new MrAllInOneApiClient(config);
  }
  return globalClient;
}

import { createHash } from "crypto";
import https from "https";
import tls from "tls";
import net from "net";
import { URL } from "url";

/**
 * Game Vault Official External REST API client
 *
 * Host: https://apius.gamevault999.com (not the agent panel host)
 * Signature: MD5(agent_id + ":" + timestamp + ":" + secret_key) — lowercase hex
 * Timestamp: unix seconds (10-digit)
 * Content-Type: multipart/form-data
 * Requests must exit from a whitelisted IP (GAMEVAULT_PROXY_URL)
 */

export interface GameVaultAddUserResponse {
  code: number;
  msg: string;
  data: {
    account_name: string;
    user_id: string;
  };
  count?: number;
}

export interface GameVaultRechargeResponse {
  code: number;
  msg: string;
  data: {
    agent_balance: string;
    amount: string;
    pay_order_id: string;
    transaction_id: string;
    transaction_time: string;
    user_balance: string;
  };
  count?: number;
}

export interface GameVaultWithdrawResponse {
  code: number;
  msg: string;
  data: {
    agent_balance: string;
    amount: string;
    transaction_id: string;
    transaction_time: string;
    user_balance: string;
    wdw_order_id: string;
  };
  count?: number;
}

export interface GameVaultUserBalanceResponse {
  code: number;
  msg: string;
  data: {
    user_balance: string;
  };
  count?: number;
}

export interface GameVaultAgentBalanceResponse {
  code: number;
  msg: string;
  data: {
    agent_balance: string;
  };
  count?: number;
}

export interface GameVaultGetUserIDResponse {
  code: number;
  msg: string;
  data: {
    user_id: string;
  };
  count?: number;
}

export interface GameVaultResetPasswordResponse {
  code: number;
  msg: string;
  data?: any;
}

export interface GameVaultPlayerOfflineResponse {
  code: number;
  msg: string;
  data?: any;
}

export interface GameVaultApiConfig {
  baseUrl?: string;
  agentId?: string;
  secretKey?: string;
  proxyUrl?: string;
}

/**
 * Clean HTTP chunked encoding bytes if present (extract clean JSON body between '{' and '}')
 */
function cleanChunkedResponse(text: string): string {
  const s = text.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return s;
}

/**
 * Execute multipart/form-data HTTPS POST via HTTP CONNECT proxy tunnel
 */
function httpsPostMultipartViaProxy(
  targetUrlStr: string,
  formData: Record<string, string>,
  proxyUrlStr?: string,
  timeoutMs: number = 15000
): Promise<{ text: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    try {
      const targetUrl = new URL(targetUrlStr);

      const boundary = "----WebKitFormBoundary" + createHash("md5").update(Date.now().toString()).digest("hex").slice(0, 16);
      let bodyParts: Buffer[] = [];

      for (const [k, v] of Object.entries(formData)) {
        const header = `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
        bodyParts.push(Buffer.from(header, "utf8"));
      }
      bodyParts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

      const bodyBuffer = Buffer.concat(bodyParts);

      if (proxyUrlStr) {
        const proxyUrl = new URL(proxyUrlStr);
        const targetHost = targetUrl.hostname;
        const targetPort = targetUrl.port ? Number(targetUrl.port) : 443;

        const proxyHost = proxyUrl.hostname;
        const proxyPort = Number(proxyUrl.port || 80);

        const proxyAuth = proxyUrl.username && proxyUrl.password
          ? Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString("base64")
          : null;

        const socket = net.connect(proxyPort, proxyHost, () => {
          let connectReq = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
            `Host: ${targetHost}:${targetPort}\r\n`;

          if (proxyAuth) {
            connectReq += `Proxy-Authorization: Basic ${proxyAuth}\r\n`;
          }

          connectReq += `\r\n`;
          socket.write(connectReq);
        });

        let connectHeaderBuf = "";
        let isTunnelEstablished = false;

        socket.on("data", onSocketData);
        socket.on("error", (err) => {
          if (!isTunnelEstablished) reject(err);
        });

        function onSocketData(chunk: Buffer) {
          if (isTunnelEstablished) return;

          connectHeaderBuf += chunk.toString("utf8");
          if (connectHeaderBuf.includes("\r\n\r\n")) {
            const firstLine = connectHeaderBuf.split("\r\n")[0];
            if (/HTTP\/\d\.\d\s+200/i.test(firstLine)) {
              isTunnelEstablished = true;
              socket.removeListener("data", onSocketData);

              const tlsOptions = {
                socket: socket,
                servername: targetHost,
                rejectUnauthorized: false,
              };

              const tlsSocket = tls.connect(tlsOptions, () => {
                const reqPath = targetUrl.pathname + targetUrl.search;
                let httpReq = `POST ${reqPath} HTTP/1.1\r\n` +
                  `Host: ${targetHost}\r\n` +
                  `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n` +
                  `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
                  `Content-Length: ${bodyBuffer.length}\r\n` +
                  `Connection: close\r\n\r\n`;

                tlsSocket.write(httpReq);
                tlsSocket.write(bodyBuffer);
              });

              let resText = "";
              tlsSocket.on("data", (data: Buffer) => (resText += data.toString("utf8")));
              tlsSocket.on("end", () => {
                const parts = resText.split("\r\n\r\n");
                const head = parts[0] || "";
                const body = parts.slice(1).join("\r\n\r\n");

                const statusMatch = head.match(/HTTP\/\d\.\d\s+(\d+)/i);
                const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 200;

                resolve({ text: body, statusCode });
              });

              tlsSocket.on("error", (e: any) => reject(e));
            } else {
              reject(new Error(`Proxy CONNECT failed: ${firstLine}`));
            }
          }
        }
        return;
      }

      // Direct fallback
      const options: https.RequestOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port ? Number(targetUrl.port) : 443,
        path: targetUrl.pathname + targetUrl.search,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": bodyBuffer.length,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ text: data, statusCode: res.statusCode || 200 }));
      });

      req.on("error", (e) => reject(e));
      req.write(bodyBuffer);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export class GameVaultApiClient {
  private baseUrl: string;
  private agentId: string;
  private secretKey: string;
  private proxyUrl?: string;

  constructor(config: GameVaultApiConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      process.env.GAMEVAULT_API_BASE_URL ||
      "https://apius.gamevault999.com"
    ).replace(/\/+$/, "");

    this.agentId = (
      config.agentId ||
      process.env.GAMEVAULT_AGENT_ID ||
      "160496"
    ).trim();

    this.secretKey = (
      config.secretKey ||
      process.env.GAMEVAULT_SECRET_KEY ||
      "6f56ce873171c0a455a8a60c039b3b90"
    ).trim();

    this.proxyUrl = (
      config.proxyUrl ||
      process.env.GAMEVAULT_PROXY_URL ||
      "http://sbhxwsxp:xn5frycnonl5@198.23.243.226:6361"
    ).trim();
  }

  /**
   * MD5(agent_id + ":" + unix_seconds + ":" + secret_key) as lowercase hex.
   * Uppercase MD5 / millisecond timestamps are rejected by apius.gamevault999.com.
   */
  private generateAuthParams(): { agent_id: string; timestamp: string; token: string } {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawSig = `${this.agentId}:${timestamp}:${this.secretKey}`;
    const token = createHash("md5").update(rawSig).digest("hex");
    return {
      agent_id: this.agentId,
      timestamp,
      token,
    };
  }

  private async request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const auth = this.generateAuthParams();

    const formData: Record<string, string> = {
      agent_id: auth.agent_id,
      timestamp: auth.timestamp,
      token: auth.token,
    };

    for (const [key, value] of Object.entries(params)) {
      formData[key] = String(value);
    }

    const { text, statusCode } = await httpsPostMultipartViaProxy(url, formData, this.proxyUrl);
    const cleanedText = cleanChunkedResponse(text);

    let json: any;
    try {
      json = JSON.parse(cleanedText);
    } catch (e) {
      throw new Error(`Invalid JSON response from Game Vault API (HTTP ${statusCode}): ${text.slice(0, 200)}`);
    }

    const code = json.code ?? json.status;
    if (code !== 0) {
      const errorMsg = json.msg || json.message || `Game Vault API error code: ${code}`;
      const err = new Error(errorMsg) as any;
      err.code = code;
      err.rawResponse = json;
      throw err;
    }

    return json as T;
  }

  /**
   * 1. Check Agent Store Balance (POST /api/external/agentBalance)
   */
  async getAgentBalance(): Promise<GameVaultAgentBalanceResponse> {
    return this.request<GameVaultAgentBalanceResponse>("/api/external/agentBalance");
  }

  /**
   * 2. Lookup User ID by account name (POST /api/external/getUserID)
   */
  async getUserID(accountName: string): Promise<string> {
    const res = await this.request<GameVaultGetUserIDResponse>("/api/external/getUserID", {
      account_name: accountName.trim(),
    });
    if (!res.data?.user_id) throw new Error(`User ID not found for account '${accountName}'`);
    return String(res.data.user_id);
  }

  /**
   * 3. Add Player Account (POST /api/external/addUser)
   */
  async addUser(account: string, loginPwd: string = "Pass1234"): Promise<GameVaultAddUserResponse> {
    const cleanAccount = account.trim();
    return this.request<GameVaultAddUserResponse>("/api/external/addUser", {
      account: cleanAccount,
      login_pwd: String(loginPwd).trim(),
    });
  }

  /**
   * 4. Recharge Player Balance (POST /api/external/recharge)
   */
  async recharge(userId: string | number, amount: number | string, orderId?: string): Promise<GameVaultRechargeResponse> {
    const order = orderId || `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    return this.request<GameVaultRechargeResponse>("/api/external/recharge", {
      user_id: String(userId).trim(),
      amount: String(amount),
      order_id: order,
    });
  }

  /**
   * 5. Withdraw Player Balance (POST /api/external/withdraw)
   */
  async withdraw(userId: string | number, amount: number | string, orderId?: string): Promise<GameVaultWithdrawResponse> {
    const order = orderId || `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    return this.request<GameVaultWithdrawResponse>("/api/external/withdraw", {
      user_id: String(userId).trim(),
      amount: String(amount),
      order_id: order,
    });
  }

  /**
   * 6. Check Player Balance (POST /api/external/userBalance)
   */
  async getUserBalance(userId: string | number): Promise<GameVaultUserBalanceResponse> {
    return this.request<GameVaultUserBalanceResponse>("/api/external/userBalance", {
      user_id: String(userId).trim(),
    });
  }

  /**
   * 7. Reset Player Password (POST /api/external/resetPassword)
   */
  async resetPassword(userId: string | number, newPassword: string): Promise<GameVaultResetPasswordResponse> {
    return this.request<GameVaultResetPasswordResponse>("/api/external/resetPassword", {
      user_id: String(userId).trim(),
      login_pwd: String(newPassword).trim(),
    });
  }

  /**
   * 8. Force Player Offline (POST /api/external/playerOffline)
   */
  async playerOffline(userId: string | number): Promise<GameVaultPlayerOfflineResponse> {
    return this.request<GameVaultPlayerOfflineResponse>("/api/external/playerOffline", {
      user_id: String(userId).trim(),
    });
  }
}

let globalClient: GameVaultApiClient | null = null;
export function getGameVaultApiClient(config?: GameVaultApiConfig): GameVaultApiClient {
  if (config || !globalClient) {
    globalClient = new GameVaultApiClient(config);
  }
  return globalClient;
}

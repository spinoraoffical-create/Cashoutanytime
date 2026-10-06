import { createHash } from "crypto";
import https from "https";
import tls from "tls";
import net from "net";
import { URL } from "url";

/**
 * Vegas Catalogs / Vegas Sweeps External REST API client
 *
 * Host: https://apius.lasvegassweeps.com
 * Signature: MD5(agent_id + ":" + timestamp + ":" + secret_key).toLowerCase()
 * Timestamp: unix seconds (10-digit)
 * Content-Type: multipart/form-data
 * Requests must exit from a whitelisted IP (VEGAS_PROXY_URL)
 */

export interface VegasBaseResponse {
  code: number;
  msg?: string;
  data?: any;
  count?: number;
}

export interface VegasAddUserResponse extends VegasBaseResponse {
  data?: {
    account_name: string;
    user_id: string;
  };
}

export interface VegasRechargeResponse extends VegasBaseResponse {
  data?: {
    agent_balance: string;
    amount: string;
    pay_order_id: string;
    transaction_id: string;
    transaction_time: string;
    user_balance: string;
  };
}

export interface VegasWithdrawResponse extends VegasBaseResponse {
  data?: {
    agent_balance: string;
    amount: string;
    transaction_id: string;
    transaction_time: string;
    user_balance: string;
    wdw_order_id: string;
  };
}

export interface VegasUserBalanceResponse extends VegasBaseResponse {
  data?: {
    user_balance: string;
  };
}

export interface VegasAgentBalanceResponse extends VegasBaseResponse {
  data?: {
    agent_balance: string;
  };
}

export interface VegasGetUserIDResponse extends VegasBaseResponse {
  data?: {
    user_id: string;
  };
}

export interface VegasApiConfig {
  baseUrl?: string;
  agentId?: string;
  secretKey?: string;
  proxyUrl?: string;
}

const VEGAS_ERROR_MESSAGES: Record<number, string> = {
  1: "Invalid agent ID",
  2: "Invalid request parameters",
  3: "Invalid token",
  4: "Token expired",
  5: "Access IP is not white IP",
  6: "Insufficient agent balance",
  7: "Insufficient user balance",
  8: "Invalid user ID",
  9: "User account frozen",
  10: "User is currently in game. Exit to lobby and try again.",
  11: "Invalid amount",
  12: "Recharge failed, please try again later",
  13: "Recharge permission denied",
  14: "Withdrawal failed, please try again later",
  15: "Withdrawal amount exceeds daily limit",
  16: "Withdrawal under review",
  17: "Withdrawal permission denied",
  18: "Account name format error (must contain only letters, numbers, and underscores)",
  19: "Agent has no register user permission",
  20: "Account name already exists",
  21: "System failed",
  22: "Number of registered IPs exceeds upper limit",
  23: "Password must be between 6 and 32 characters",
  400: "Parameter error",
};

function cleanChunkedResponse(text: string): string {
  const s = text.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return s;
}

function httpsPostMultipartViaProxy(
  targetUrlStr: string,
  formData: Record<string, string>,
  proxyUrlStr?: string,
  timeoutMs: number = 15000
): Promise<{ text: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    try {
      const targetUrl = new URL(targetUrlStr);
      const boundary =
        "----WebKitFormBoundary" + createHash("md5").update(Date.now().toString()).digest("hex").slice(0, 16);
      const bodyParts: Buffer[] = [];

      for (const [k, v] of Object.entries(formData)) {
        bodyParts.push(
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, "utf8")
        );
      }
      bodyParts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
      const bodyBuffer = Buffer.concat(bodyParts);

      const timer = setTimeout(() => reject(new Error("Vegas API connection timed out after 15s")), timeoutMs);
      const finish = (text: string, statusCode: number) => {
        clearTimeout(timer);
        resolve({ text, statusCode });
      };

      if (proxyUrlStr) {
        const proxyUrl = new URL(proxyUrlStr);
        const targetHost = targetUrl.hostname;
        const targetPort = targetUrl.port ? Number(targetUrl.port) : 443;
        const proxyHost = proxyUrl.hostname;
        const proxyPort = Number(proxyUrl.port || 80);
        const proxyAuth =
          proxyUrl.username && proxyUrl.password
            ? Buffer.from(
                `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`
              ).toString("base64")
            : null;

        const socket = net.connect(proxyPort, proxyHost, () => {
          let connectReq =
            `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` + `Host: ${targetHost}:${targetPort}\r\n`;
          if (proxyAuth) connectReq += `Proxy-Authorization: Basic ${proxyAuth}\r\n`;
          connectReq += `\r\n`;
          socket.write(connectReq);
        });

        let connectHeaderBuf = "";
        let isTunnelEstablished = false;

        socket.on("data", onSocketData);
        socket.on("error", (err) => {
          if (!isTunnelEstablished) {
            clearTimeout(timer);
            reject(err);
          }
        });

        function onSocketData(chunk: Buffer) {
          if (isTunnelEstablished) return;
          connectHeaderBuf += chunk.toString("utf8");
          if (!connectHeaderBuf.includes("\r\n\r\n")) return;
          const firstLine = connectHeaderBuf.split("\r\n")[0];
          if (!/HTTP\/\d\.\d\s+200/i.test(firstLine)) {
            clearTimeout(timer);
            reject(new Error(`Proxy CONNECT failed: ${firstLine}`));
            return;
          }
          isTunnelEstablished = true;
          socket.removeListener("data", onSocketData);

          const tlsSocket = tls.connect(
            { socket, servername: targetHost, rejectUnauthorized: false },
            () => {
              const reqPath = targetUrl.pathname + targetUrl.search;
              const httpReq =
                `POST ${reqPath} HTTP/1.1\r\n` +
                `Host: ${targetHost}\r\n` +
                `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n` +
                `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
                `Content-Length: ${bodyBuffer.length}\r\n` +
                `Connection: close\r\n\r\n`;
              tlsSocket.write(httpReq);
              tlsSocket.write(bodyBuffer);
            }
          );

          let resText = "";
          tlsSocket.on("data", (data: Buffer) => (resText += data.toString("utf8")));
          tlsSocket.on("end", () => {
            const parts = resText.split("\r\n\r\n");
            const head = parts[0] || "";
            const body = parts.slice(1).join("\r\n\r\n");
            const statusMatch = head.match(/HTTP\/\d\.\d\s+(\d+)/i);
            finish(body, statusMatch ? parseInt(statusMatch[1], 10) : 200);
          });
          tlsSocket.on("error", (e) => {
            clearTimeout(timer);
            reject(e);
          });
        }
        return;
      }

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
        res.on("end", () => finish(data, res.statusCode || 200));
      });
      req.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      req.write(bodyBuffer);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export class VegasApiClient {
  private baseUrl: string;
  private agentId: string;
  private secretKey: string;
  private proxyUrl?: string;

  constructor(config: VegasApiConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      process.env.VEGAS_API_URL ||
      process.env.VEGAS_API_BASE_URL ||
      "https://apius.lasvegassweeps.com"
    )
      .trim()
      .replace(/\/+$/, "");

    this.agentId = (config.agentId || process.env.VEGAS_AGENT_ID || "").trim();
    this.secretKey = (config.secretKey || process.env.VEGAS_SECRET_KEY || "").trim();
    this.proxyUrl = (
      config.proxyUrl ||
      process.env.VEGAS_PROXY_URL ||
      process.env.GAMEVAULT_PROXY_URL ||
      ""
    ).trim() || undefined;
  }

  private generateAuthParams(): { agent_id: string; timestamp: string; token: string } {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = createHash("md5")
      .update(`${this.agentId}:${timestamp}:${this.secretKey}`)
      .digest("hex");
    return { agent_id: this.agentId, timestamp, token };
  }

  private formatError(json: VegasBaseResponse): string {
    const code = Number(json.code);
    const mapped = VEGAS_ERROR_MESSAGES[code];
    if (mapped) return `Vegas API error [code ${code}]: ${mapped}`;
    return json.msg || `Vegas API operation failed with code ${code}`;
  }

  private async request<T extends VegasBaseResponse>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
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

    console.log(`[Vegas API] POST ${endpoint} | agent_id: ${auth.agent_id} | timestamp: ${auth.timestamp}`);

    const { text, statusCode } = await httpsPostMultipartViaProxy(url, formData, this.proxyUrl);
    const cleanedText = cleanChunkedResponse(text);

    let json: T;
    try {
      json = JSON.parse(cleanedText);
    } catch {
      throw new Error(`Invalid JSON response from Vegas API (HTTP ${statusCode}): ${text.slice(0, 200)}`);
    }

    console.log(`[Vegas API] Response from ${endpoint} | code: ${json.code} | msg: "${json.msg || ""}"`);

    if (Number(json.code) !== 0) {
      throw new Error(this.formatError(json));
    }

    return json;
  }

  async getAgentBalance(): Promise<number> {
    const res = await this.request<VegasAgentBalanceResponse>("/api/external/agentBalance");
    return parseFloat(res.data?.agent_balance || "0");
  }

  async getUserID(accountName: string): Promise<string> {
    const res = await this.request<VegasGetUserIDResponse>("/api/external/getUserID", {
      account_name: accountName.trim(),
    });
    if (!res.data?.user_id) throw new Error(`User ID not found for account '${accountName}'`);
    return String(res.data.user_id);
  }

  async addUser(account: string, loginPwd: string = "Pass1234"): Promise<{ userId: string; accountName: string }> {
    const res = await this.request<VegasAddUserResponse>("/api/external/addUser", {
      account: account.trim(),
      login_pwd: String(loginPwd).trim(),
    });
    return {
      userId: String(res.data?.user_id),
      accountName: res.data?.account_name || account,
    };
  }

  async recharge(userId: string | number, amount: number | string, orderId?: string): Promise<VegasRechargeResponse> {
    const order = orderId || `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return this.request<VegasRechargeResponse>("/api/external/recharge", {
      user_id: String(userId).trim(),
      amount: String(amount),
      order_id: order,
    });
  }

  async withdraw(userId: string | number, amount: number | string, orderId?: string): Promise<VegasWithdrawResponse> {
    const order = orderId || `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return this.request<VegasWithdrawResponse>("/api/external/withdraw", {
      user_id: String(userId).trim(),
      amount: String(amount),
      order_id: order,
    });
  }

  async getUserBalance(userId: string | number): Promise<number> {
    const res = await this.request<VegasUserBalanceResponse>("/api/external/userBalance", {
      user_id: String(userId).trim(),
    });
    return parseFloat(res.data?.user_balance || "0");
  }

  async resetPassword(userId: string | number, newPassword: string): Promise<boolean> {
    await this.request("/api/external/resetPassword", {
      user_id: String(userId).trim(),
      login_pwd: String(newPassword).trim(),
    });
    return true;
  }

  async playerOffline(userId: string | number): Promise<boolean> {
    await this.request("/api/external/playerOffline", {
      user_id: String(userId).trim(),
    });
    return true;
  }
}

export function isVegasApiConfigured(): boolean {
  return Boolean(process.env.VEGAS_SECRET_KEY?.trim() && process.env.VEGAS_AGENT_ID?.trim());
}

let globalClient: VegasApiClient | null = null;
export function getVegasApiClient(config?: VegasApiConfig): VegasApiClient {
  if (config || !globalClient) {
    globalClient = new VegasApiClient(config);
  }
  return globalClient;
}

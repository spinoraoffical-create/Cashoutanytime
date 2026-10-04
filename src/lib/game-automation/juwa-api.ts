import crypto from "crypto";
import https from "https";
import http from "http";
import tls from "tls";
import net from "net";
import { URL } from "url";

/**
 * Juwa External API client
 *
 * Host: https://external.juwa777.com
 * Signature: MD5(agent_id + ":" + unix_seconds + ":" + secret_key) lowercase
 * Content-Type: application/x-www-form-urlencoded
 * Requests must exit from a whitelisted IP when JUWA_PROXY_URL is set
 */

export interface JuwaBaseResponse {
  code: number;
  msg?: string;
  data?: any;
  count?: number;
}

export interface JuwaAddUserResponse extends JuwaBaseResponse {
  data?: {
    account_name: string;
    user_id: string;
  };
}

export interface JuwaRechargeResponse extends JuwaBaseResponse {
  data?: {
    agent_balance: string;
    amount: string;
    pay_order_id: string;
    transaction_id: string;
    transaction_time: string;
    user_balance: string;
  };
}

export interface JuwaWithdrawResponse extends JuwaBaseResponse {
  data?: {
    agent_balance: string;
    amount: string;
    transaction_id: string;
    transaction_time: string;
    user_balance: string;
    wdw_order_id: string;
  };
}

export interface JuwaUserBalanceResponse extends JuwaBaseResponse {
  data?: {
    user_balance: string;
  };
}

export interface JuwaAgentBalanceResponse extends JuwaBaseResponse {
  data?: {
    agent_balance: string;
  };
}

export interface JuwaGetUserIdResponse extends JuwaBaseResponse {
  data?: {
    user_id: string;
  };
}

export interface JuwaConfig {
  apiUrl?: string;
  agentId?: string;
  secretKey?: string;
  proxyUrl?: string;
}

const JUWA_ERROR_MESSAGES: Record<number, string> = {
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

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex").toLowerCase();
}

function cleanChunkedResponse(text: string): string {
  const s = text.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return s;
}

function httpsPostUrlencodedViaProxy(
  targetUrlStr: string,
  formData: Record<string, string>,
  proxyUrlStr?: string,
  timeoutMs: number = 15000
): Promise<{ text: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    try {
      const targetUrl = new URL(targetUrlStr);
      const postData = Object.entries(formData)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
      const bodyBuffer = Buffer.from(postData, "utf8");

      const timer = setTimeout(() => {
        reject(new Error("Juwa API connection timed out after 15s"));
      }, timeoutMs);

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
            `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
            `Host: ${targetHost}:${targetPort}\r\n`;
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
                `Content-Type: application/x-www-form-urlencoded\r\n` +
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
            const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 200;
            finish(body, statusCode);
          });
          tlsSocket.on("error", (e) => {
            clearTimeout(timer);
            reject(e);
          });
        }
        return;
      }

      const isHttps = targetUrl.protocol === "https:";
      const lib = isHttps ? https : http;
      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port ? Number(targetUrl.port) : isHttps ? 443 : 80,
        path: targetUrl.pathname + targetUrl.search,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": bodyBuffer.length,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      };

      const req = lib.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => finish(data, res.statusCode || 200));
      });
      req.on("timeout", () => {
        req.destroy();
        clearTimeout(timer);
        reject(new Error("Juwa API connection timed out after 15s"));
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

export class JuwaApiClient {
  private apiUrl: string;
  private agentId: string;
  private secretKey: string;
  private proxyUrl?: string;

  constructor(config: JuwaConfig = {}) {
    this.apiUrl = (
      config.apiUrl ||
      process.env.JUWA_API_URL ||
      process.env.JUWA_API_BASE_URL ||
      "https://external.juwa777.com"
    )
      .trim()
      .replace(/\/+$/, "");

    this.agentId = (
      config.agentId ||
      process.env.JUWA_AGENT_ID ||
      ""
    ).trim();

    this.secretKey = (
      config.secretKey ||
      process.env.JUWA_SECRET_KEY ||
      ""
    ).trim();

    this.proxyUrl = (
      config.proxyUrl ||
      process.env.JUWA_PROXY_URL ||
      process.env.GAMEVAULT_PROXY_URL ||
      ""
    ).trim() || undefined;
  }

  private getAuthParams(): { agent_id: string; timestamp: string; token: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = md5(`${this.agentId}:${timestamp}:${this.secretKey}`);
    return { agent_id: this.agentId, timestamp, token };
  }

  private async postForm(endpointPath: string, formData: Record<string, string>): Promise<JuwaBaseResponse> {
    const fullUrl = `${this.apiUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;
    const auth = this.getAuthParams();
    const fullPayload = { ...auth, ...formData };

    console.log(`[Juwa API] POST ${endpointPath} | agent_id: ${auth.agent_id} | timestamp: ${auth.timestamp}`);

    const { text, statusCode } = await httpsPostUrlencodedViaProxy(fullUrl, fullPayload, this.proxyUrl);
    const cleaned = cleanChunkedResponse(text);

    let json: JuwaBaseResponse;
    try {
      json = JSON.parse(cleaned);
    } catch {
      throw new Error(`Juwa API invalid JSON response (HTTP ${statusCode}): ${text.slice(0, 200)}`);
    }

    console.log(`[Juwa API] Response from ${endpointPath} | code: ${json.code} | msg: "${json.msg || ""}"`);
    return json;
  }

  private formatError(json: JuwaBaseResponse): string {
    const code = Number(json.code);
    const mapped = JUWA_ERROR_MESSAGES[code];
    if (mapped) return `Juwa API error [code ${code}]: ${mapped}`;
    return json.msg || `Juwa API operation failed with code ${code}`;
  }

  public async addUser(account: string, loginPwd: string): Promise<{ userId: string; accountName: string }> {
    const res = (await this.postForm("/api/external/addUser", {
      account,
      login_pwd: loginPwd,
    })) as JuwaAddUserResponse;

    if (res.code !== 0 || !res.data?.user_id) {
      throw new Error(this.formatError(res));
    }

    return {
      userId: String(res.data.user_id),
      accountName: res.data.account_name || account,
    };
  }

  public async getUserID(accountName: string): Promise<string> {
    const res = (await this.postForm("/api/external/getUserID", {
      account_name: accountName,
    })) as JuwaGetUserIdResponse;

    if (res.code !== 0 || !res.data?.user_id) {
      throw new Error(this.formatError(res));
    }

    return String(res.data.user_id);
  }

  public async recharge(userId: string, amount: number, orderId?: string): Promise<JuwaRechargeResponse> {
    const orderIdToUse = orderId || `req_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const res = (await this.postForm("/api/external/recharge", {
      user_id: userId,
      amount: String(amount),
      order_id: orderIdToUse,
    })) as JuwaRechargeResponse;

    if (res.code !== 0) {
      throw new Error(this.formatError(res));
    }

    return res;
  }

  public async withdraw(userId: string, amount: number, orderId?: string): Promise<JuwaWithdrawResponse> {
    const orderIdToUse = orderId || `wdw_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const res = (await this.postForm("/api/external/withdraw", {
      user_id: userId,
      amount: String(amount),
      order_id: orderIdToUse,
    })) as JuwaWithdrawResponse;

    if (res.code !== 0) {
      throw new Error(this.formatError(res));
    }

    return res;
  }

  public async getPlayerBalance(userId: string): Promise<number> {
    const res = (await this.postForm("/api/external/userBalance", {
      user_id: userId,
    })) as JuwaUserBalanceResponse;

    if (res.code !== 0 || res.data?.user_balance === undefined) {
      throw new Error(this.formatError(res));
    }

    return parseFloat(res.data.user_balance || "0");
  }

  public async getAgentBalance(): Promise<number> {
    const res = (await this.postForm("/api/external/agentBalance", {})) as JuwaAgentBalanceResponse;

    if (res.code !== 0 || res.data?.agent_balance === undefined) {
      throw new Error(this.formatError(res));
    }

    return parseFloat(res.data.agent_balance || "0");
  }

  public async resetPassword(userId: string, newPwd: string): Promise<boolean> {
    const res = await this.postForm("/api/external/resetPassword", {
      user_id: userId,
      login_pwd: newPwd,
    });

    if (res.code !== 0) {
      throw new Error(this.formatError(res));
    }

    return true;
  }

  public async forceOffline(userId: string): Promise<boolean> {
    const res = await this.postForm("/api/external/playerOffline", {
      user_id: userId,
    });

    if (res.code !== 0) {
      throw new Error(this.formatError(res));
    }

    return true;
  }
}

export function isJuwaApiConfigured(): boolean {
  return Boolean(process.env.JUWA_SECRET_KEY?.trim() && process.env.JUWA_AGENT_ID?.trim());
}

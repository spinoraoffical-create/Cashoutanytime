/**
 * CashFrenzy777 Direct REST API Client
 *
 * Official API Integration for agentserver.cashfrenzy777.com:
 * 1. Store Login (POST /api/agent/login)
 * 2. Get player list (GET /api/player/playerList)
 * 3. Add player (POST /api/player/insertPlayer)
 * 4. Get player scores (GET /api/player/getScore)
 * 5. Player recharge (POST /api/player/playerRecharge)
 * 6. Player withdrawal (POST /api/player/playerWithdraw)
 */

export interface CashFrenzyLoginResponse {
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

export interface CashFrenzyPlayer {
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

export interface CashFrenzyPlayerListResponse {
  status_code: number;
  message: string;
  count: number;
  data: CashFrenzyPlayer[];
}

export interface CashFrenzyAddPlayerResponse {
  status_code: number;
  message: string;
  data: {
    account: string;
    password: string;
    balance: string;
    time: string;
  };
}

export interface CashFrenzyGetScoreResponse {
  status_code: number;
  message: string;
  data: {
    username: string;
    balance: number;
    is_game: boolean;
  };
}

export interface CashFrenzyRechargeResponse {
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

export interface CashFrenzyWithdrawResponse {
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

export interface CashFrenzyApiConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
}

export interface ApiRequestOptions extends RequestInit {
  _isRetry?: boolean;
}

export class CashFrenzyApiClient {
  private baseUrl: string;
  private agentUsername: string;
  private agentPassword: string;
  private token: string | null = null;
  private expiresTime: number | null = null;

  constructor(config: CashFrenzyApiConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      process.env.CASHFRENZY_API_BASE_URL ||
      process.env.CASHFRENZY_ADMIN_URL?.replace(/\/admin.*$/i, "") ||
      "https://agentserver.cashfrenzy777.com"
    ).replace(/\/+$/, "");

    this.agentUsername =
      config.username ||
      process.env.CASHFRENZY_AGENT_USERNAME ||
      process.env.CASHFRENZY_USERNAME ||
      "Funstorr111";

    this.agentPassword =
      config.password ||
      process.env.CASHFRENZY_AGENT_PASSWORD ||
      process.env.CASHFRENZY_PASSWORD ||
      "Fun@123@";
  }

  private async ensureAuthenticated(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.expiresTime && this.expiresTime - now > 60) {
      return this.token;
    }
    return this.login();
  }

  private buildFormData(params: Record<string, string | number>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(params)) {
      formData.append(key, String(value));
    }
    return formData;
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
    requiresAuth = true
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (requiresAuth) {
      const token = await this.ensureAuthenticated();
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`Invalid JSON response from CashFrenzy API (${res.status} ${res.statusText})`);
    }

    const statusCode = json.status_code ?? json.code ?? res.status;
    if (statusCode !== 200) {
      const errorMsg = json.message || json.msg || `API call failed with status ${statusCode}`;
      if (statusCode === 401 && requiresAuth && !options._isRetry) {
        this.token = null;
        this.expiresTime = null;
        return this.request<T>(endpoint, { ...options, _isRetry: true }, true);
      }
      throw new Error(errorMsg);
    }

    return json as T;
  }

  async login(username?: string, password?: string): Promise<string> {
    const user = username || this.agentUsername;
    const pass = password || this.agentPassword;

    if (!user || !pass) {
      throw new Error("CashFrenzy agent credentials missing.");
    }

    const body = this.buildFormData({ username: user, password: pass });
    const res = await this.request<CashFrenzyLoginResponse>("/api/agent/login", { method: "POST", body }, false);

    if (!res.data?.token) {
      throw new Error(res.message || "Store login failed: no token returned");
    }

    this.token = res.data.token;
    this.expiresTime = res.data.expires_time || Math.floor(Date.now() / 1000) + 3600;
    return this.token;
  }

  async getPlayerList(limit: number = 50, page: number = 1): Promise<CashFrenzyPlayerListResponse> {
    const params = new URLSearchParams({ limit: String(limit), page: String(page) });
    return this.request<CashFrenzyPlayerListResponse>(`/api/player/playerList?${params.toString()}`);
  }

  async findPlayerByAccount(accountOrId: string | number): Promise<CashFrenzyPlayer | null> {
    const target = String(accountOrId).trim().toLowerCase();
    let listRes = await this.getPlayerList(100, 1);
    let match = listRes.data?.find((p) => p.Account.toLowerCase() === target || String(p.id) === target);
    if (match) return match;

    const totalCount = listRes.count || 0;
    const maxPages = Math.ceil(totalCount / 100);
    for (let p = 2; p <= Math.min(maxPages, 10); p++) {
      listRes = await this.getPlayerList(100, p);
      match = listRes.data?.find((player) => player.Account.toLowerCase() === target || String(player.id) === target);
      if (match) return match;
    }

    return null;
  }

  async resolvePlayerId(accountOrId: string | number): Promise<string> {
    const strVal = String(accountOrId).trim();
    const player = await this.findPlayerByAccount(strVal);
    if (player) return String(player.id);
    if (/^\d+$/.test(strVal)) return strVal;
    throw new Error(`Player '${strVal}' not found on CashFrenzy agent account.`);
  }

  async addPlayer(
    username: string,
    password: string = "123456",
    nickname?: string,
    money: string | number = "0"
  ): Promise<CashFrenzyAddPlayerResponse> {
    const cleanUser = username.trim();
    let cleanNick = (nickname && nickname !== "-" ? nickname : cleanUser).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
    if (!cleanNick) cleanNick = "User" + Math.floor(1000 + Math.random() * 9000);

    const body = this.buildFormData({
      username: cleanUser,
      nickname: cleanNick,
      password: String(password).trim(),
      money: String(money),
    });

    return this.request<CashFrenzyAddPlayerResponse>("/api/player/insertPlayer", { method: "POST", body });
  }

  async getPlayerScore(idOrAccount: string | number): Promise<CashFrenzyGetScoreResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const params = new URLSearchParams({ id });
    return this.request<CashFrenzyGetScoreResponse>(`/api/player/getScore?${params.toString()}`);
  }

  async rechargePlayer(
    idOrAccount: string | number,
    balance: number | string,
    remark: string = "webrecharge"
  ): Promise<CashFrenzyRechargeResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const cleanRemark = (remark || "webrecharge").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "webrecharge";

    const body = this.buildFormData({ id, balance: String(balance), remark: cleanRemark });
    return this.request<CashFrenzyRechargeResponse>("/api/player/playerRecharge", { method: "POST", body });
  }

  async withdrawPlayer(
    idOrAccount: string | number,
    balance: number | string,
    remark: string = "webwithdraw"
  ): Promise<CashFrenzyWithdrawResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const cleanRemark = (remark || "webwithdraw").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "webwithdraw";

    const body = this.buildFormData({ id, balance: String(balance), remark: cleanRemark });
    return this.request<CashFrenzyWithdrawResponse>("/api/player/playerWithdraw", { method: "POST", body });
  }
}

let globalClient: CashFrenzyApiClient | null = null;
export function getCashFrenzyApiClient(config?: CashFrenzyApiConfig): CashFrenzyApiClient {
  if (config || !globalClient) {
    globalClient = new CashFrenzyApiClient(config);
  }
  return globalClient;
}

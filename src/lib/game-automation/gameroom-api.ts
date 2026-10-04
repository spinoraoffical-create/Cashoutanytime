/**
 * Gameroom777 Direct REST API Client
 *
 * Official API Integration for agentserver1.gameroom777.com:
 * 1. Store Login (POST /api/agent/login)
 * 2. Get player list (GET /api/player/playerList)
 * 3. Add player (POST /api/player/insertPlayer)
 * 4. Get player scores (GET /api/player/getScore)
 * 5. Player recharge (POST /api/player/playerRecharge)
 * 6. Player withdrawal (POST /api/player/playerWithdraw)
 */

export interface GameroomLoginResponse {
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

export interface GameroomPlayer {
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

export interface GameroomPlayerListResponse {
  status_code: number;
  message: string;
  count: number;
  data: GameroomPlayer[];
}

export interface GameroomAddPlayerResponse {
  status_code: number;
  message: string;
  data: {
    account: string;
    password: string;
    balance: string;
    time: string;
  };
}

export interface GameroomGetScoreResponse {
  status_code: number;
  message: string;
  data: {
    username: string;
    balance: number;
    is_game: boolean;
  };
}

export interface GameroomRechargeResponse {
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

export interface GameroomWithdrawResponse {
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

export interface GameroomApiConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
}

export interface ApiRequestOptions extends RequestInit {
  _isRetry?: boolean;
}

export class GameroomApiClient {
  private baseUrl: string;
  private agentUsername: string;
  private agentPassword: string;
  private token: string | null = null;
  private expiresTime: number | null = null;

  constructor(config: GameroomApiConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      process.env.GAMEROOM_API_BASE_URL ||
      process.env.GAMEROOM_ADMIN_URL?.replace(/\/admin.*$/i, "") ||
      "https://agentserver1.gameroom777.com"
    ).replace(/\/+$/, "");

    this.agentUsername =
      config.username ||
      process.env.GAMEROOM_AGENT_USERNAME ||
      process.env.GAMEROOM_USERNAME ||
      "House0011";

    this.agentPassword =
      config.password ||
      process.env.GAMEROOM_AGENT_PASSWORD ||
      process.env.GAMEROOM_PASSWORD ||
      "David@123#";
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
      throw new Error(`Invalid JSON response from Gameroom API (${res.status} ${res.statusText})`);
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
      throw new Error("Gameroom agent credentials missing.");
    }

    const body = this.buildFormData({ username: user, password: pass });
    const res = await this.request<GameroomLoginResponse>("/api/agent/login", { method: "POST", body }, false);

    if (!res.data?.token) {
      throw new Error(res.message || "Store login failed: no token returned");
    }

    this.token = res.data.token;
    this.expiresTime = res.data.expires_time || Math.floor(Date.now() / 1000) + 3600;
    return this.token;
  }

  async getPlayerList(
    limit: number = 50,
    page: number = 1,
    extra: Record<string, string> = {}
  ): Promise<GameroomPlayerListResponse> {
    const params = new URLSearchParams({
      limit: String(limit),
      page: String(page),
      ...extra,
    });
    return this.request<GameroomPlayerListResponse>(`/api/player/playerList?${params.toString()}`);
  }

  async findPlayerByAccount(accountOrId: string | number): Promise<GameroomPlayer | null> {
    const { resolveLayuiPlayerId, getCachedPlayerId } = await import("./layui-player-resolve");
    const strVal = String(accountOrId).trim();
    if (/^\d+$/.test(strVal)) {
      return { id: Number(strVal), Account: strVal } as GameroomPlayer;
    }
    const cached = getCachedPlayerId("gameroom", strVal);
    if (cached) return { id: Number(cached), Account: strVal } as GameroomPlayer;
    try {
      const id = await resolveLayuiPlayerId({
        agentKey: "gameroom",
        accountOrId: strVal,
        fetchList: async (params) => {
          const limit = Number(params.limit || 20);
          const page = Number(params.page || 1);
          const { limit: _l, page: _p, ...extra } = params;
          return this.getPlayerList(limit, page, extra);
        },
      });
      return { id: Number(id), Account: strVal } as GameroomPlayer;
    } catch {
      return null;
    }
  }

  async resolvePlayerId(accountOrId: string | number): Promise<string> {
    const { resolveLayuiPlayerId } = await import("./layui-player-resolve");
    return resolveLayuiPlayerId({
      agentKey: "gameroom",
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
    password: string = "123456",
    nickname?: string,
    money: string | number = "0"
  ): Promise<GameroomAddPlayerResponse> {
    const cleanUser = username.trim();
    let cleanNick = (nickname && nickname !== "-" ? nickname : cleanUser).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
    if (!cleanNick) cleanNick = "User" + Math.floor(1000 + Math.random() * 9000);

    const body = this.buildFormData({
      username: cleanUser,
      nickname: cleanNick,
      password: String(password).trim(),
      money: String(money),
    });

    return this.request<GameroomAddPlayerResponse>("/api/player/insertPlayer", { method: "POST", body }).then(
      async (res) => {
        try {
          const { cachePlayerId } = await import("./layui-player-resolve");
          const id = (res.data as any)?.id;
          if (id) cachePlayerId("gameroom", res.data.account || cleanUser, id);
        } catch {}
        return res;
      }
    );
  }

  async getPlayerScore(idOrAccount: string | number): Promise<GameroomGetScoreResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const params = new URLSearchParams({ id });
    return this.request<GameroomGetScoreResponse>(`/api/player/getScore?${params.toString()}`);
  }

  async rechargePlayer(
    idOrAccount: string | number,
    balance: number | string,
    remark: string = "webrecharge"
  ): Promise<GameroomRechargeResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const cleanRemark = (remark || "webrecharge").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "webrecharge";

    const body = this.buildFormData({ id, balance: String(balance), remark: cleanRemark });
    return this.request<GameroomRechargeResponse>("/api/player/playerRecharge", { method: "POST", body });
  }

  async withdrawPlayer(
    idOrAccount: string | number,
    balance: number | string,
    remark: string = "webwithdraw"
  ): Promise<GameroomWithdrawResponse> {
    const id = await this.resolvePlayerId(idOrAccount);
    const cleanRemark = (remark || "webwithdraw").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "webwithdraw";

    const body = this.buildFormData({ id, balance: String(balance), remark: cleanRemark });
    return this.request<GameroomWithdrawResponse>("/api/player/playerWithdraw", { method: "POST", body });
  }
}

let globalClient: GameroomApiClient | null = null;
export function getGameroomApiClient(config?: GameroomApiConfig): GameroomApiClient {
  if (config || !globalClient) {
    globalClient = new GameroomApiClient(config);
  }
  return globalClient;
}

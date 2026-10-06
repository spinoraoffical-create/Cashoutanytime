/**
 * Mafia Direct REST API Client
 *
 * Official API Integration for agentserver.mafia77777.com:
 * 1. Agent Login (POST /api/agent/login)
 * 2. Get player list (GET /api/player/playerList)
 * 3. Add player (POST /api/player/insertPlayer)
 * 4. Get player scores (GET /api/player/getScore)
 * 5. Player recharge (POST /api/player/playerRecharge)
 * 6. Player withdrawal (POST /api/player/playerWithdraw)
 */

export interface MafiaLoginResponse {
  status_code: number;
  message: string;
  data: {
    userName: string;
    money: string;
    token: string;
    expires_time: number;
  };
}

export interface MafiaPlayer {
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

export interface MafiaPlayerListResponse {
  status_code: number;
  message: string;
  count: number;
  data: MafiaPlayer[];
}

export interface MafiaAddPlayerResponse {
  status_code: number;
  message: string;
  data: {
    id: number;
    account: string;
    password: string;
    balance: string;
    time: string;
  };
}

export interface MafiaRechargeResponse {
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

export interface MafiaWithdrawResponse {
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

export interface MafiaConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
}

export class MafiaApiClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private token: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: MafiaConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      process.env.MAFIA_ADMIN_URL ||
      "https://agentserver.mafia77777.com"
    ).replace(/\/admin\/login\/?$/, "").replace(/\/+$/, "");

    this.username =
      config.username ||
      process.env.MAFIA_AGENT_USERNAME ||
      "";

    this.password =
      config.password ||
      process.env.MAFIA_AGENT_PASSWORD ||
      "";
  }

  public async getValidToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.tokenExpiresAt > now + 60) {
      return this.token;
    }

    const loginUrl = `${this.baseUrl}/api/agent/login`;
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!res.ok) {
      throw new Error(`Mafia login request failed (${res.status} ${res.statusText})`);
    }

    const json: MafiaLoginResponse = await res.json();
    if (json.status_code !== 200 || !json.data?.token) {
      throw new Error(`Mafia login authentication failed: ${json.message || "Unknown error"}`);
    }

    this.token = json.data.token;
    this.tokenExpiresAt = json.data.expires_time || now + 3600;
    return this.token;
  }

  public async getPlayerList(page = 1, limit = 50, searchAccount?: string): Promise<MafiaPlayer[]> {
    const token = await this.getValidToken();
    let url = `${this.baseUrl}/api/player/playerList?page=${page}&limit=${limit}`;
    if (searchAccount?.trim()) {
      url += `&account=${encodeURIComponent(searchAccount.trim())}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Mafia getPlayerList HTTP error ${res.status}`);
    }

    const json: MafiaPlayerListResponse = await res.json();
    if (json.status_code !== 200) {
      throw new Error(`Mafia getPlayerList error: ${json.message}`);
    }

    return json.data || [];
  }

  public async findPlayerByAccount(account: string): Promise<MafiaPlayer | null> {
    const target = account.trim();
    if (!target) return null;
    if (/^\d+$/.test(target)) {
      return { id: Number(target), Account: target } as MafiaPlayer;
    }

    const { getCachedPlayerId, cachePlayerId } = await import("./layui-player-resolve");
    const cached = getCachedPlayerId("mafia", target);
    if (cached) return { id: Number(cached), Account: target } as MafiaPlayer;

    const players = await this.getPlayerList(1, 10, target);
    const match = players.find(
      (p) =>
        p.Account.trim().toLowerCase() === target.toLowerCase() ||
        p.nickname.trim().toLowerCase() === target.toLowerCase()
    );
    if (match) cachePlayerId("mafia", target, match.id);
    return match || null;
  }

  public async createAccount(account: string, pass: string): Promise<{ id: number; account: string; pass: string }> {
    const token = await this.getValidToken();
    const url = `${this.baseUrl}/api/player/insertPlayer`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: account,
        password: pass,
      }),
    });

    if (!res.ok) {
      throw new Error(`Mafia createAccount HTTP error ${res.status}`);
    }

    const json: MafiaAddPlayerResponse = await res.json();
    if (json.status_code !== 200) {
      throw new Error(`Mafia createAccount error: ${json.message}`);
    }

    const { cachePlayerId } = await import("./layui-player-resolve");
    if (json.data?.id) cachePlayerId("mafia", json.data.account || account, json.data.id);

    return {
      id: json.data.id,
      account: json.data.account || account,
      pass: json.data.password || pass,
    };
  }

  public async rechargePlayer(account: string, amount: number): Promise<{ game_id: number; balance: number }> {
    let player = await this.findPlayerByAccount(account);
    if (!player) {
      // If player doesn't exist, create it!
      const created = await this.createAccount(account, "123123");
      player = { id: created.id, Account: created.account } as MafiaPlayer;
    }

    const token = await this.getValidToken();
    const url = `${this.baseUrl}/api/player/playerRecharge`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: player.id,
        balance: String(amount),
      }),
    });

    if (!res.ok) {
      throw new Error(`Mafia rechargePlayer HTTP error ${res.status}`);
    }

    const json: MafiaRechargeResponse = await res.json();
    if (json.status_code !== 200) {
      throw new Error(`Mafia rechargePlayer error: ${json.message}`);
    }

    return {
      game_id: json.data.game_id,
      balance: json.data.balance,
    };
  }

  public async withdrawPlayer(account: string, amount: number): Promise<{ game_id: number; balance: number }> {
    const player = await this.findPlayerByAccount(account);
    if (!player) {
      throw new Error(`Player ${account} not found on Mafia agent panel`);
    }

    const token = await this.getValidToken();
    const url = `${this.baseUrl}/api/player/playerWithdraw`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: player.id,
        balance: String(amount),
      }),
    });

    if (!res.ok) {
      throw new Error(`Mafia withdrawPlayer HTTP error ${res.status}`);
    }

    const json: MafiaWithdrawResponse = await res.json();
    if (json.status_code !== 200) {
      throw new Error(`Mafia withdrawPlayer error: ${json.message}`);
    }

    return {
      game_id: json.data.game_id,
      balance: json.data.balance,
    };
  }
}

export function isMafiaApiConfigured(): boolean {
  const username = process.env.MAFIA_AGENT_USERNAME || "";
  const password = process.env.MAFIA_AGENT_PASSWORD || "";
  return Boolean(username?.trim() && password?.trim());
}

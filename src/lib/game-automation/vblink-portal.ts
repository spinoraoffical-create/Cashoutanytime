import "server-only";

import { chromium, type Page } from "playwright";
import { freshAccountName, isAccountTakenError } from "./account-username";

const PORTAL_URL = (process.env.VBLINK_API_URL?.trim() || "https://gm.vblink777.club").replace(/\/+$/, "");

export function isVblinkApiConfigured(): boolean {
  return Boolean(process.env.VBLINK_AGENT_USERNAME?.trim() && process.env.VBLINK_AGENT_PASSWORD?.trim());
}

function agentLogin(): { username: string; password: string } {
  const username = process.env.VBLINK_AGENT_USERNAME?.trim() || "";
  const password = process.env.VBLINK_AGENT_PASSWORD?.trim() || "";
  if (!username || !password) throw new Error("VBlink agent login is not configured.");
  return { username, password };
}

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function portalMessage(code: number, message: string): string {
  const text = message.trim();
  if (/维护/.test(text) || /maintenance/i.test(text)) {
    return "VBlink is under maintenance. Try again shortly.";
  }
  if (/high frequency/i.test(text)) return "VBlink is busy. Try again in a moment.";
  if (/不存在/.test(text)) return "Account not found";
  if (/已存在|already exist/i.test(text)) return "That username is already taken. Try again.";
  if (/不足|insufficient/i.test(text)) return "Insufficient credit";
  if (/密码/.test(text)) return "Password must include letters and numbers.";
  if (/格式|长度/.test(text)) return "Username must be 7–13 letters and numbers.";
  if (text && !/[\u4e00-\u9fff]/.test(text)) return text;
  return "VBlink could not finish that request. Try again.";
}

function readBody(body: unknown): { code: number; message: string; players: { Account?: string; curScore?: number | string }[] } {
  const row = (body ?? {}) as {
    code?: number;
    message?: string;
    msg?: string;
    playerList?: { Account?: string; curScore?: number | string }[];
    data?: { message?: string; playerList?: { Account?: string; curScore?: number | string }[] };
  };
  return {
    code: Number(row.code ?? 0),
    message: String(row.message || row.msg || row.data?.message || ""),
    players: row.playerList || row.data?.playerList || [],
  };
}

function assertOk(body: unknown): { code: number; message: string; players: { Account?: string; curScore?: number | string }[] } {
  const parsed = readBody(body);
  const listed = Array.isArray((body as { playerList?: unknown } | null)?.playerList);
  if (parsed.code === 20000 || parsed.code === 200) return parsed;
  if (listed && parsed.code === 0 && !parsed.message) return parsed;
  throw new Error(portalMessage(parsed.code, parsed.message));
}

async function openPortal(): Promise<{ close: () => Promise<void>; page: Page }> {
  const { username, password } = agentLogin();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${PORTAL_URL}/#/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator('input[type="text"]').first().fill(username);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("**/#/index", { timeout: 25000 });
    await page.evaluate(() => {
      document.querySelectorAll(".el-message-box__wrapper, .app-link-tip-wrap, .v-modal").forEach((node) => {
        (node as HTMLElement).style.display = "none";
      });
    });
    await page.evaluate(async () => {
      const app = (document.querySelector("#app") as { __vue__?: { $store?: { state?: { user?: { first_login?: boolean } } }; $router?: { push: (path: string) => Promise<unknown> } } } | null)?.__vue__;
      if (app?.$store?.state?.user) app.$store.state.user.first_login = false;
      await app?.$router?.push("/manage-user/account");
    });
    await page.waitForURL("**/#/manage-user/account", { timeout: 20000 });
    await page.waitForTimeout(1200);
    return {
      page,
      close: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function withPortal<T>(run: (page: Page) => Promise<T>): Promise<T> {
  return enqueue(async () => {
    const session = await openPortal();
    try {
      return await run(session.page);
    } finally {
      await session.close();
    }
  });
}

export async function createVblinkPlayer(account: string, password: string): Promise<{ account: string }> {
  const clean = account.trim();
  if (!/^[A-Za-z0-9]{7,13}$/.test(clean)) {
    throw new Error("Username must be 7–13 letters and numbers.");
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password) || password.length < 6 || password.length > 16) {
    throw new Error("Password must include letters and numbers.");
  }

  return withPortal(async (page) => {
    await page.waitForFunction(
      () => {
        const app = (document.querySelector("#app") as { __vue__?: { $options?: { name?: string }; $children?: unknown[]; addPlayer?: unknown } } | null)?.__vue__;
        let found = false;
        const walk = (vm?: { $options?: { name?: string }; $children?: unknown[]; addPlayer?: unknown }) => {
          if (!vm) return;
          if (vm.$options?.name === "SetAgentPlayer" && typeof vm.addPlayer === "function") found = true;
          for (const child of (vm.$children || []) as { $options?: { name?: string }; $children?: unknown[]; addPlayer?: unknown }[]) walk(child);
        };
        walk(app);
        return found;
      },
      { timeout: 20000 }
    );

    let name = clean;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const pending = page.waitForResponse((response) => response.url().includes("/api/account/savePlayer"), { timeout: 25000 });
      const started = await page.evaluate(
        ({ account: playerAccount, password: playerPassword }) => {
          type Vm = {
            $options?: { name?: string };
            $children?: Vm[];
            $refs: Record<string, unknown>;
            form?: Record<string, string>;
            addPlayer?: (refName: string) => void;
          };
          const app = (document.querySelector("#app") as { __vue__?: Vm } | null)?.__vue__;
          let form: Vm | null = null;
          const walk = (vm?: Vm) => {
            if (!vm) return;
            if (vm.$options?.name === "SetAgentPlayer" && vm.addPlayer) form = vm;
            for (const child of vm.$children || []) walk(child);
          };
          walk(app);
          if (!form) return false;
          const target = form as Vm;
          target.form = target.form || {};
          target.form.account = playerAccount;
          target.form.pwd = playerPassword;
          target.form.confirm_pwd = playerPassword;
          target.form.score = "0";
          target.form.name = playerAccount;
          target.form.phone = "";
          target.form.tel_area_code = "";
          target.form.remark = "";
          target.$refs.form = { validate(done: (ok: boolean) => void) { done(true); } };
          target.addPlayer?.("form");
          return true;
        },
        { account: name, password }
      );
      if (!started) throw new Error("VBlink is busy. Try again in a moment.");
      const response = await pending;
      const body = await response.json();
      try {
        assertOk(body);
        return { account: name };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!isAccountTakenError(message) || attempt === 3) throw error;
        name = freshAccountName(name, "vblink");
      }
    }
    throw new Error("That username is already taken. Try again.");
  });
}

export async function getVblinkBalance(account: string): Promise<number> {
  const clean = account.trim();
  return withPortal(async (page) => {
    for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
      const pending = page.waitForResponse((response) => response.url().includes("/api/account/getPlayerList"), { timeout: 25000 });
      const started = await page.evaluate((currentPage) => {
        type Vm = {
          $options?: { methods?: { refreshPlayer?: unknown } };
          $children?: Vm[];
          page?: { player?: number };
          limit?: number;
          refreshPlayer?: () => void;
        };
        const app = (document.querySelector("#app") as { __vue__?: Vm } | null)?.__vue__;
        let manage: Vm | null = null;
        const walk = (vm?: Vm) => {
          if (!vm) return;
          const refresh = vm.$options?.methods?.refreshPlayer;
          if (refresh && String(refresh).includes("playerList")) manage = vm;
          for (const child of vm.$children || []) walk(child);
        };
        walk(app);
        if (!manage) return 0;
        const target = manage as Vm;
        if (target.page) target.page.player = currentPage;
        target.refreshPlayer?.();
        return target.limit || 20;
      }, pageNumber);
      if (!started) throw new Error("VBlink is busy. Try again in a moment.");
      const response = await pending;
      const parsed = assertOk(await response.json());
      const match = parsed.players.find((row) => row.Account?.toLowerCase() === clean.toLowerCase());
      if (match) return Number(match.curScore ?? 0);
      if (parsed.players.length < started) break;
    }
    throw new Error("Account not found");
  });
}

export async function changeVblinkScore(account: string, amount: number, direction: "in" | "out"): Promise<void> {
  const clean = account.trim();
  const points = Math.round(Math.abs(amount) * 100) / 100;
  if (!(points > 0)) throw new Error("Enter $5 or more.");
  const score = direction === "out" ? `-${points}` : String(points);

  await withPortal(async (page) => {
    const pending = page.waitForResponse((response) => response.url().includes("/api/account/enterScore"), { timeout: 25000 });
    const started = await page.evaluate(
      ({ playerAccount, playerScore }) => {
        type Vm = {
          $options?: { name?: string; methods?: { setScore?: unknown } };
          $children?: Vm[];
          $refs: Record<string, unknown>;
          form?: { score?: string; remark?: string };
          clickAccount?: string;
          type?: number;
          scoreVerify?: number;
          setScore?: (refName: string) => void;
        };
        const app = (document.querySelector("#app") as { __vue__?: Vm } | null)?.__vue__;
        let scoreForm: Vm | null = null;
        const walk = (vm?: Vm) => {
          if (!vm) return;
          if (vm.$options?.name === "SetScore" && vm.setScore) scoreForm = vm;
          for (const child of vm.$children || []) walk(child);
        };
        walk(app);
        if (!scoreForm) return false;
        const target = scoreForm as Vm;
        target.clickAccount = playerAccount;
        target.type = 2;
        target.scoreVerify = 1;
        target.form = target.form || {};
        target.form.score = playerScore;
        target.form.remark = "wallet";
        target.$refs.form = { validate(done: (ok: boolean) => void) { done(true); } };
        target.setScore?.("form");
        return true;
      },
      { playerAccount: clean, playerScore: score }
    );
    if (!started) throw new Error("VBlink is busy. Try again in a moment.");
    const response = await pending;
    assertOk(await response.json());
  });
}

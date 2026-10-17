/**
 * Read-only agentLogin for Fire Kirin, Orion Stars, and Milky Way.
 * Never calls registerUser, recharge, redeem, queryInfo, or kickPlayerOut.
 * Prints only the provider code and message.
 */
import crypto from "node:crypto";
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";

const env = process.env;

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex").toLowerCase();
}

function post(urlStr, hostHeader, proxyUrl) {
  return new Promise((resolve) => {
    const parsed = new URL(urlStr);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 443,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: { Host: hostHeader, "User-Agent": "SweepstakesHub-readonly" },
        servername: hostHeader,
        rejectUnauthorized: false,
        timeout: 20000,
        agent: proxyUrl ? new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false }) : undefined,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ ok: true, status: res.statusCode, body: data }));
      }
    );
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.on("error", (error) => resolve({ ok: false, error: error.code || error.message }));
    req.end();
  });
}

function classify(code, msg) {
  const text = `${code} ${msg}`.toLowerCase();
  if (/white|whitelist|not white|ip/.test(text) && /ip|white/.test(text)) return "ip-whitelist";
  if (/password|passwd|agent|login|sign|auth|permission|denied/.test(text)) return "auth-or-permission";
  if (String(code) === "200") return "authenticated";
  return "other";
}

function safeMsg(msg, secrets) {
  let text = String(msg || "").replace(/\s+/g, " ").slice(0, 180);
  for (const secret of secrets) {
    if (secret && secret.length > 3) text = text.split(secret).join("[redacted]");
  }
  return text;
}

async function login(label, apiUrl, host, username, password, proxyUrl, secrets) {
  if (!username || !password) {
    console.log(`${label}: credentials missing`);
    return;
  }
  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    console.log(`${label}: transport=invalid-api-url class=configuration`);
    return;
  }
  const time = label.startsWith("fire-kirin") ? String(Math.floor(Date.now() / 1000)) : Date.now().toString();
  parsed.searchParams.set("action", "agentLogin");
  parsed.searchParams.set("agentName", username);
  parsed.searchParams.set("agentPasswd", md5(password));
  parsed.searchParams.set("time", time);
  const result = await post(parsed.toString(), host, proxyUrl);
  if (!result.ok) {
    console.log(`${label}: transport=${result.error} class=unreachable`);
    return;
  }
  const body = result.body.trim();
  let code = "non-json";
  let msg = body.slice(0, 180);
  let key = false;
  try {
    const json = JSON.parse(body);
    code = String(json.code);
    msg = json.msg || json.message || "";
    key = Boolean(json.agentkey || json.agentKey);
  } catch {
    msg = body.startsWith("<") ? "html" : body;
  }
  console.log(
    `${label}: http=${result.status} code=${code} key=${key ? "present" : "absent"} class=${classify(code, msg)} msg=${JSON.stringify(safeMsg(msg, secrets))}`
  );
}

const secrets = Object.values(env).filter((value) => value.length > 3);
const games = [
  {
    name: "fire-kirin",
    url: env.FIREKIRIN_API_URL || "https://firekirin.xyz:8033/ws/service.ashx",
    host: "firekirin.xyz",
    user: env.FIREKIRIN_AGENT_USERNAME,
    pass: env.FIREKIRIN_AGENT_PASSWORD,
    proxy: env.FIREKIRIN_PROXY_URL,
  },
  {
    name: "orion-stars",
    url: env.ORIONSTARS_API_URL || "https://34.212.168.0:8033/ws/service.ashx",
    host: "orionstars.vip",
    user: env.ORIONSTARS_AGENT_USERNAME,
    pass: env.ORIONSTARS_AGENT_PASSWORD,
    proxy: env.ORIONSTARS_PROXY_URL || env.GAMEVAULT_PROXY_URL,
  },
  {
    name: "milky-way",
    url: env.MILKYWAY_API_URL || "https://47.252.40.52:8033/ws/service.ashx",
    host: "milkywayapp.xyz",
    user: env.MILKYWAY_AGENT_USERNAME,
    pass: env.MILKYWAY_AGENT_PASSWORD,
    proxy: env.MILKYWAY_PROXY_URL || env.GAMEVAULT_PROXY_URL,
  },
];

for (const game of games) {
  await login(`${game.name} direct`, game.url, game.host, game.user, game.pass, undefined, secrets);
  if (game.proxy) {
    await login(`${game.name} proxy`, game.url, game.host, game.user, game.pass, game.proxy, secrets);
  } else {
    console.log(`${game.name} proxy: not configured`);
  }
}

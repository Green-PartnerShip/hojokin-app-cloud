/**
 * niche-hojokin-finder local web app
 * - Gets public subsidy data through the jGrants public API.
 * - Generates copy-and-paste prompts for Claude / ChatGPT Web.
 * - Does not use AI API keys or send prompts to AI services from this server.
 *
 * Start: npm install && npm start
 */
import express from "express";
import axios from "axios";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import crypto from "crypto";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
const PUBLIC_ACCESS = truthy(process.env.PUBLIC_ACCESS) || truthy(process.env.CLOUD_MODE);
const AUTH_REQUIRED = PUBLIC_ACCESS || truthy(process.env.AUTH_REQUIRED) || !!process.env.APP_PASSWORD || !!process.env.APP_PASSWORD_HASH;
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const APP_PASSWORD_HASH = process.env.APP_PASSWORD_HASH || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_TTL_MS = Math.max(1, Number(process.env.SESSION_TTL_HOURS || 12)) * 60 * 60 * 1000;
const sessions = new Map();
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

const getDbSslConfig = () => {
  if (!DATABASE_URL) return undefined;
  if (truthy(process.env.DATABASE_SSL)) return { rejectUnauthorized: false };
  try {
    const sslMode = new URL(DATABASE_URL).searchParams.get("sslmode");
    if (sslMode && sslMode !== "disable") return { rejectUnauthorized: false };
  } catch {
    // Keep default connection settings for non-URL connection strings.
  }
  return undefined;
};

const { Pool } = pg;
const dbPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: getDbSslConfig()
    })
  : null;
const dbStatus = { enabled: !!dbPool, ready: false, error: "" };
let dbInitPromise = null;

if (PUBLIC_ACCESS) {
  app.set("trust proxy", 1);
}

if (AUTH_REQUIRED && !APP_PASSWORD && !APP_PASSWORD_HASH) {
  console.error("[fatal] AUTH_REQUIRED/CLOUD_MODE requires APP_PASSWORD or APP_PASSWORD_HASH.");
  process.exit(1);
}

if (AUTH_REQUIRED && SESSION_SECRET.length < 32) {
  console.error("[fatal] AUTH_REQUIRED/CLOUD_MODE requires SESSION_SECRET with at least 32 characters.");
  process.exit(1);
}

const toClientIp = (req) => {
  let ip = (PUBLIC_ACCESS ? req.ip : "") || req.socket?.remoteAddress || req.ip || "";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip.replace(/^\[|\]$/g, "").split("%")[0];
};

const isPrivateIpv4 = (ip) => {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
};

const isPrivateClient = (ip) => {
  const lower = ip.toLowerCase();
  return isPrivateIpv4(ip) || lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd");
};

const extraAllowedClients = new Set((process.env.ALLOWED_CLIENTS || "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean));

const isAllowedClient = (req) => {
  if (PUBLIC_ACCESS) return true;
  const ip = toClientIp(req);
  return isPrivateClient(ip) || extraAllowedClients.has(ip);
};

const isSameHostUrl = (req, value) => {
  try {
    return new URL(value).host === req.headers.host;
  } catch {
    return false;
  }
};

const securityHeaders = (_req, res, next) => {
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join("; "));
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  next();
};

const networkAccessGuard = (req, res, next) => {
  if (!isAllowedClient(req)) {
    const payload = { ok: false, error: "Access denied" };
    if (req.path.startsWith("/api/")) return res.status(403).json(payload);
    return res.status(403).type("text/plain").send(payload.error);
  }
  if (req.url.length > 2048) {
    const payload = { ok: false, error: "Request URL is too long" };
    if (req.path.startsWith("/api/")) return res.status(414).json(payload);
    return res.status(414).type("text/plain").send(payload.error);
  }
  return next();
};

const apiAccessGuard = (req, res, next) => {
  const fetchSite = req.get("sec-fetch-site");
  const origin = req.get("origin");
  const referer = req.get("referer");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return res.status(403).json({ ok: false, error: "Cross-site API request denied" });
  }
  if ((origin && !isSameHostUrl(req, origin)) || (!origin && referer && !isSameHostUrl(req, referer))) {
    return res.status(403).json({ ok: false, error: "Cross-site API request denied" });
  }
  return next();
};

const rateBuckets = new Map();
const rateLimit = ({ name, windowMs, max }) => (req, res, next) => {
  const now = Date.now();
  const key = `${name}:${toClientIp(req)}`;
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > max) {
    res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ ok: false, error: "Too many requests. Please retry later." });
  }
  return next();
};

const parseCookies = (req) => Object.fromEntries((req.headers.cookie || "")
  .split(";")
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return [part, ""];
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));

const timingSafeStringEqual = (a, b) => {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
};

const verifyPasswordHash = (password, encoded) => {
  const parts = String(encoded).split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const [, iterationsText, salt, expectedHex] = parts;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100000 || !salt || !expectedHex) return false;
  const actualHex = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  return timingSafeStringEqual(actualHex, expectedHex);
};

const verifyPassword = (password) => {
  if (APP_PASSWORD_HASH) return verifyPasswordHash(password, APP_PASSWORD_HASH);
  return timingSafeStringEqual(password, APP_PASSWORD);
};

const signSessionToken = (token) => crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("base64url");

const isSecureRequest = (req) => req.secure || req.get("x-forwarded-proto") === "https";

const buildSessionCookie = (req, token) => {
  const signed = `${token}.${signSessionToken(token)}`;
  const attrs = [
    `hf_session=${encodeURIComponent(signed)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (isSecureRequest(req)) attrs.push("Secure");
  return attrs.join("; ");
};

const clearSessionCookie = () => [
  "hf_session=",
  "Path=/",
  "HttpOnly",
  "SameSite=Lax",
  "Max-Age=0"
].join("; ");

const getValidSession = (req) => {
  if (!AUTH_REQUIRED) return { user: "local" };
  const raw = parseCookies(req).hf_session || "";
  const [token, signature] = raw.split(".");
  if (!token || !signature || !timingSafeStringEqual(signature, signSessionToken(token))) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
};

const createSession = (req, user) => {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
  return buildSessionCookie(req, token);
};

const renderLoginPage = (message = "") => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ログイン - ニッチ補助金ファインダー</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7fb;color:#1a202c}
    main{min-height:100vh;display:grid;place-items:center;padding:24px}
    form{width:min(420px,100%);background:white;border:1px solid #dbe3ef;border-radius:8px;padding:28px;box-shadow:0 12px 30px rgba(20,40,70,.08)}
    h1{font-size:22px;margin:0 0 18px}
    label{display:block;font-weight:700;margin:14px 0 6px}
    input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:12px;font-size:16px}
    button{width:100%;margin-top:22px;border:0;border-radius:6px;background:#2563eb;color:white;padding:12px 16px;font-weight:700;font-size:16px;cursor:pointer}
    .error{background:#fff1f2;color:#b91c1c;border:1px solid #fecdd3;border-radius:6px;padding:10px;margin-bottom:14px}
    .note{font-size:13px;color:#64748b;margin-top:14px;line-height:1.6}
  </style>
</head>
<body>
  <main>
    <form method="post" action="/login" autocomplete="on">
      <h1>ニッチ補助金ファインダー</h1>
      ${message ? `<div class="error">${message}</div>` : ""}
      <label for="password">パスワード</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
      <button type="submit">ログイン</button>
      <div class="note">URLを知っている人だけでなく、パスワードを知っている人だけが利用できます。</div>
    </form>
  </main>
</body>
</html>`;

const authGuard = (req, res, next) => {
  if (!AUTH_REQUIRED || req.path === "/login" || req.path === "/api/health") return next();
  if (getValidSession(req)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ ok: false, error: "Login required" });
  return res.redirect(302, "/login");
};

app.use(securityHeaders);
app.use(networkAccessGuard);
app.use(express.json({ limit: "64kb", type: "application/json" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.get("/login", (req, res) => {
  if (!AUTH_REQUIRED || getValidSession(req)) return res.redirect(302, "/");
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(renderLoginPage());
});

app.post("/login", rateLimit({ name: "login", windowMs: 5 * 60 * 1000, max: 20 }), (req, res) => {
  if (!AUTH_REQUIRED) return res.redirect(302, "/");
  const password = String(req.body?.password || "");
  if (verifyPassword(password)) {
    res.setHeader("Set-Cookie", createSession(req, "authenticated"));
    return res.redirect(303, "/");
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(401).type("html").send(renderLoginPage("パスワードが違います。"));
});

app.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.redirect(303, "/login");
});

app.use(authGuard);
app.use("/api", apiAccessGuard, rateLimit({ name: "api", windowMs: 60 * 1000, max: 180 }));
app.use(express.static(path.join(__dirname, "public"), {
  dotfiles: "deny",
  fallthrough: true,
  maxAge: "1h",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store");
    }
  }
}));

const getLanUrls = (port) => Object.values(os.networkInterfaces())
  .flat()
  .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
  .map((iface) => `http://${iface.address}:${port}`);

// ----- ユーティリティ -----
const asStr = (v, def = "") => {
  if (Array.isArray(v)) v = v[0]; // ?keyword=a&keyword=b 対策
  return (v == null ? def : String(v)).trim();
};

const cleanInput = (value, def = "", maxLength = 100) => asStr(value, def)
  .replace(/[\u0000-\u001F\u007F]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maxLength);

const isValidJgrantsId = (value) => /^[A-Za-z0-9_-]{1,80}$/.test(asStr(value));

const initDb = async () => {
  if (!dbPool) return;
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS shared_search_history (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        keyword TEXT NOT NULL DEFAULT '',
        prefecture TEXT NOT NULL DEFAULT '',
        municipality TEXT NOT NULL DEFAULT '',
        theme TEXT NOT NULL DEFAULT '',
        industry TEXT NOT NULL DEFAULT '',
        employees TEXT NOT NULL DEFAULT '',
        entity TEXT NOT NULL DEFAULT '',
        result_count INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'jgrants'
      );

      CREATE INDEX IF NOT EXISTS idx_shared_search_history_created_at
        ON shared_search_history (created_at DESC);

      CREATE TABLE IF NOT EXISTS saved_subsidies (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        subsidy_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        issuer TEXT NOT NULL DEFAULT '',
        target_area TEXT NOT NULL DEFAULT '',
        acceptance_start TEXT NOT NULL DEFAULT '',
        acceptance_end TEXT NOT NULL DEFAULT '',
        subsidy_min_limit TEXT NOT NULL DEFAULT '',
        subsidy_max_limit TEXT NOT NULL DEFAULT '',
        subsidy_rate TEXT NOT NULL DEFAULT '',
        use_purpose TEXT NOT NULL DEFAULT '',
        detail_url TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_saved_subsidies_created_at
        ON saved_subsidies (created_at DESC);
    `);
    dbStatus.ready = true;
    dbStatus.error = "";
    console.log("[db] shared database is ready");
  } catch (e) {
    dbStatus.ready = false;
    dbStatus.error = e.message;
    console.warn("[db] shared database is not ready:", e.message);
  }
};

const ensureDbReady = async () => {
  if (!dbPool) return null;
  if (!dbInitPromise || (!dbStatus.ready && dbStatus.error)) dbInitPromise = initDb();
  await dbInitPromise;
  if (!dbStatus.ready) throw new Error(dbStatus.error || "Shared database is not ready");
  return dbPool;
};

const sharedDbUnavailable = () => ({
  ok: true,
  enabled: false,
  items: [],
  history: [],
  message: "Shared database is not connected."
});

const dbText = (value, maxLength = 500) => cleanInput(value, "", maxLength);

const recordSearchHistory = async (query, resultCount) => {
  if (!dbPool) return;
  try {
    const pool = await ensureDbReady();
    await pool.query(`
      INSERT INTO shared_search_history
        (keyword, prefecture, municipality, theme, industry, employees, entity, result_count, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'jgrants')
    `, [
      dbText(query.keyword, 120),
      dbText(query.prefecture, 40),
      dbText(query.municipality, 120),
      dbText(query.theme, 120),
      dbText(query.industry, 120),
      dbText(query.employees, 40),
      dbText(query.entity, 80),
      Math.max(0, Number(resultCount) || 0)
    ]);
  } catch (e) {
    console.warn("[db] search history skipped:", e.message);
  }
};

const upstreamErrorPayload = (error, fallback = {}) => ({
  ok: false,
  error: error?.response?.status ? `Upstream API error: HTTP ${error.response.status}` : "Upstream API error",
  ...fallback,
  ...(process.env.DEBUG_ERRORS === "1" ? { debug: error.message, detail: error?.response?.data || null } : {})
});

const stripHtml = (value) => asStr(value)
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const compactText = (value, maxLength = 34) => {
  const text = stripHtml(value)
    .replace(/[【】「」『』（）()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

const compactSummary = (value, maxLength = 200) => {
  const text = stripHtml(value)
    .replace(/\s+/g, " ")
    .replace(/^(?:■|●|◆)?\s*(?:目的・概要|目的|概要)[:：\s]*/, "")
    .replace(/^[:：・\s]+/, "")
    .trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

const extractOverviewText = (it) => {
  const catchPhrase = compactSummary(it.subsidy_catch_phrase, 180);
  if (catchPhrase) return catchPhrase;

  const detail = stripHtml(it.detail);
  if (!detail) return "";
  const overview = detail.match(/(?:目的・概要|目的|概要)[:：\s]*(.{30,320}?)(?:応募資格|対象者|対象事業|対象経費|補助率|補助額|備考|問合せ先|お問い合わせ先|参照URL|$)/);
  if (overview) return compactSummary(overview[1], 200);

  const firstSentence = detail.match(/(.{40,220}?。)/);
  return firstSentence ? compactSummary(firstSentence[1], 200) : compactSummary(detail, 200);
};

const parseJapaneseMoneyAmount = (value) => {
  const text = asStr(value)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[,，\s]/g, "");
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)(億|万|千)?円?/);
  if (!match) return "";
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return "";
  const unit = match[2] || "";
  const multiplier = unit === "億" ? 100000000 : unit === "万" ? 10000 : unit === "千" ? 1000 : 1;
  return String(Math.round(amount * multiplier));
};

const extractSubsidyMinLimit = (it) => {
  const direct = asStr(it.subsidy_min_limit || it.subsidy_min_amount || it.min_subsidy_limit || it.lower_limit);
  if (direct) return direct;

  const detail = stripHtml(it.detail);
  if (!detail) return "";
  const patterns = [
    /(?:補助|助成)?下限(?:額)?[:：\s]*([0-9０-９,，.]+(?:億|万|千)?円?)/,
    /(?:補助|助成)金額[^。]{0,50}?下限[:：\s]*([0-9０-９,，.]+(?:億|万|千)?円?)/,
    /([0-9０-９,，.]+(?:億|万|千)?円?)\s*(?:以上|から)[^。]{0,30}(?:補助|助成)/
  ];
  for (const pattern of patterns) {
    const match = detail.match(pattern);
    if (match) return parseJapaneseMoneyAmount(match[1]) || match[1];
  }
  return "";
};

const decodeHtmlEntities = (value) => asStr(value)
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">");

const normalizeUrl = (value) => {
  const raw = decodeHtmlEntities(value)
    .replace(/[、。)\]）】>]+$/g, "")
    .trim();
  if (!raw || /^(mailto|tel|javascript):/i.test(raw)) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  return raw;
};

const safeExternalUrl = (value, allowedHosts = []) => {
  try {
    const url = new URL(normalizeUrl(value));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (allowedHosts.length && !allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return "";
    return url.toString();
  } catch {
    return "";
  }
};

const extractUrls = (value) => {
  const text = decodeHtmlEntities(value);
  const urls = [];
  for (const match of text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    urls.push(normalizeUrl(match[1]));
  }
  for (const match of text.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    urls.push(normalizeUrl(match[0]));
  }
  return [...new Set(urls)].filter(Boolean);
};

const isVerifiedOfficialSourceUrl = (value) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (hostname === "jgrants-portal.go.jp" || hostname.endsWith(".jgrants-portal.go.jp")) return false;
    return hostname.endsWith(".go.jp") || hostname.endsWith(".lg.jp");
  } catch {
    return false;
  }
};

const pickOfficialSourceUrl = (item) => {
  const candidates = [];
  const pushUrls = (value) => candidates.push(...extractUrls(value));

  pushUrls(item.detail);
  pushUrls(item.subsidy_catch_phrase);
  for (const [key, value] of Object.entries(item || {})) {
    if (/url/i.test(key) && typeof value === "string") pushUrls(value);
  }

  const url = candidates.find(isVerifiedOfficialSourceUrl);
  if (!url) return null;
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  return {
    url,
    host,
    verified_by: host.endsWith(".lg.jp") ? "localgov_lg_jp" : "government_go_jp"
  };
};

const detailSummaryCache = new Map();
const DETAIL_SUMMARY_CACHE_MS = 1000 * 60 * 60 * 6;
const DETAIL_ENRICH_LIMIT = 25;
const DETAIL_FETCH_CONCURRENCY = 4;

const getDetailSummary = async (id) => {
  const cached = detailSummaryCache.get(id);
  if (cached && Date.now() - cached.ts < DETAIL_SUMMARY_CACHE_MS) return cached.value;
  const r = await axios.get(`${JGRANTS_BASE}/subsidies/id/${encodeURIComponent(id)}`, {
    timeout: 20000,
    headers: { "User-Agent": "niche-hojokin-finder-app/1.0" }
  });
  const item = r.data?.result?.[0] || r.data;
  const value = {
    subsidy_rate: asStr(item.subsidy_rate),
    subsidy_min_limit: extractSubsidyMinLimit(item),
    subsidy_max_limit: asStr(item.subsidy_max_limit || item.subsidy_max_amount || item.max_subsidy_limit || item.upper_limit),
    use_purpose: summarizePurpose(item),
    official_source: pickOfficialSourceUrl(item)
  };
  detailSummaryCache.set(id, { ts: Date.now(), value });
  return value;
};

const getOfficialSource = async (id) => (await getDetailSummary(id)).official_source;

const enrichItemsWithDetails = async (items) => {
  const targets = items.filter((item) => item.id).slice(0, DETAIL_ENRICH_LIMIT);
  let next = 0;
  const workers = Array.from({ length: Math.min(DETAIL_FETCH_CONCURRENCY, targets.length) }, async () => {
    while (next < targets.length) {
      const item = targets[next++];
      try {
        const summary = await getDetailSummary(item.id);
        if (summary.subsidy_rate) item.subsidy_rate = summary.subsidy_rate;
        if (summary.subsidy_min_limit) item.subsidy_min_limit = summary.subsidy_min_limit;
        if (summary.subsidy_max_limit) item.subsidy_max_limit = summary.subsidy_max_limit;
        if (summary.use_purpose) item.use_purpose = summary.use_purpose;
        if (summary.official_source?.url) {
          item.official_source_url = summary.official_source.url;
          item.official_source_host = summary.official_source.host;
        }
      } catch {
        // 詳細取得に失敗しても一覧検索自体は止めない
      }
    }
  });
  await Promise.all(workers);
  return items;
};

const summarizePurpose = (it) => {
  const rawPurpose = asStr(it.use_purpose);
  const overview = extractOverviewText(it);
  if (rawPurpose) {
    const parts = rawPurpose
      .split(/\s*[/／、,]\s*/)
      .map((part) => part.replace(/をしたい$/, "").replace(/したい$/, "").trim())
      .filter(Boolean);
    const purpose = parts.slice(0, 3).join("・") || compactText(rawPurpose, 80);
    return compactSummary(overview ? `${purpose}。${overview}` : purpose, 200);
  }
  if (overview) return compactSummary(overview, 200);

  const title = asStr(it.title || it.institution_name || it.subsidy_name || it.name);
  const detail = stripHtml(it.subsidy_catch_phrase || it.detail);
  const haystack = `${title} ${detail}`;
  const rules = [
    [/海外出願|外国出願|特許|知的財産|知財|商標|意匠/, "海外出願・知財取得支援"],
    [/海外展開|輸出|国際展開|グローバル|越境EC/, "海外展開・輸出支援"],
    [/テレワーク|在宅勤務|サテライトオフィス/, "テレワーク導入支援"],
    [/人材育成|研修|リスキリング|職業訓練|技能/, "人材育成・研修支援"],
    [/人材確保|採用|雇用|地域の人事部|働き方/, "人材確保・組織づくり支援"],
    [/製品開発|商品開発|研究開発|共同研究|試作|技術開発/, "製品開発・研究開発支援"],
    [/市場開拓|販路開拓|展示会|商談会|販売促進|マーケティング/, "販路開拓・販売促進支援"],
    [/省エネ|省エネルギー|脱炭素|CO2|二酸化炭素|再エネ|水力発電|太陽光|蓄電池/, "省エネ・脱炭素設備支援"],
    [/IT導入|DX|デジタル|システム|ソフトウェア|EC構築|キャッシュレス/, "IT導入・DX支援"],
    [/創業|起業|スタートアップ|新規開業/, "創業・起業支援"],
    [/事業承継|後継者|M&A/, "事業承継支援"],
    [/設備投資|設備導入|機器導入|機械装置|施設整備/, "設備投資・機器導入支援"],
    [/物流|配送|輸送|倉庫|コールドチェーン/, "物流効率化支援"],
    [/観光|インバウンド|宿泊|旅行|ユニバーサルツーリズム/, "観光・インバウンド支援"],
    [/商店街|中心市街地|地域産業|地域活性|ふるさと納税/, "地域産業・商店街支援"],
    [/農業|林業|漁業|水産|食品|畜産|農林水産/, "農業・食品産業支援"],
    [/医療|福祉|介護|ヘルスケア|精神科/, "医療・福祉体制支援"],
    [/住宅|建築|建物|リフォーム|耐震/, "住宅・建築関連支援"],
    [/防災|災害|復旧|BCP/, "防災・事業継続支援"]
  ];

  for (const [pattern, label] of rules) {
    if (pattern.test(haystack)) return `${label}。制度名から判断した概要です。対象経費・対象者は公式ページで確認してください。`;
  }

  const fallback = title
    .replace(/^【[^】]+】/, "")
    .replace(/令和[0-9０-９]+年度|20[0-9]{2}年度/g, "")
    .replace(/補助事業者公募|間接補助事業者公募|公募|募集|補助金|助成金|奨励金|支援事業|事業/g, "")
    .trim();
  const fallbackText = compactText(fallback || title, 80);
  return fallbackText ? `${fallbackText}に関する制度です。対象経費・対象者は公式ページで確認してください。` : "制度内容を公式ページで確認してください。";
};

const inferIssuer = (it) => {
  const rawIssuer = asStr(it.organization || it.competent_authority || it.issuer || it.subsidy_provider);
  if (rawIssuer && rawIssuer !== "—" && rawIssuer !== "-") return rawIssuer;

  const title = asStr(it.title || it.institution_name || it.name);
  const detail = stripHtml(it.detail);
  const haystack = `${title} ${detail}`;

  const bracket = title.match(/^【([^】]+)】/) || title.match(/【([^】]*(?:省|庁|局|都|道|府|県|市|区|町|村|機構|財団|協会)[^】]*)】/);
  if (bracket) {
    const value = bracket[1].replace(/\s+/g, "").replace(/_.*$/, "");
    if (value && !/^近畿支部$|^関東支部$|^中部支部$|^九州支部$/.test(value)) return value;
  }

  const localPrefix = title.match(/^(.{2,16}?(?:都|道|府|県|市|区|町|村))(?=.{0,40}(?:補助金|助成金|奨励金|支援|事業|制度))/);
  if (localPrefix) return localPrefix[1];

  const localInText = haystack.match(/(?:実施主体|お問合せ先|お問い合わせ先|申請先|提出先)[:：\s]*([^。\n]{0,24}?(?:都|道|府|県|市|区|町|村))/);
  if (localInText) return localInText[1].trim();

  const knownRules = [
    [/経済産業局|中堅・中核企業|地域の人事部|伝統的工芸品|ものづくり|水力発電|鉱山|省エネ|再エネ|エネルギー使用合理化|海外展開支援事業費補助金|知的財産支援/, "経済産業省"],
    [/IT導入補助金|サービス等生産性向上IT導入支援事業/, "経済産業省"],
    [/小規模事業者持続化補助金|小規模持続化補助金/, "中小企業庁"],
    [/事業再構築補助金|中小企業省力化投資補助金|中小企業成長加速化補助金/, "中小企業庁"],
    [/観光庁|インバウンド|観光地|宿泊施設/, "観光庁"],
    [/厚生労働省|雇用調整|人材開発|キャリアアップ|業務改善助成金/, "厚生労働省"],
    [/農林水産省|農業|林業|漁業|水産|食品産業/, "農林水産省"],
    [/環境省|脱炭素|地域脱炭素|二酸化炭素|CO2|省CO2/, "環境省"],
    [/国土交通省|住宅|建築物|物流|交通|港湾/, "国土交通省"]
  ];

  for (const [pattern, issuer] of knownRules) {
    if (pattern.test(haystack)) return issuer;
  }

  const targetArea = asStr(it.target_area_search || it.target_area);
  if (targetArea && targetArea !== "全国" && !targetArea.includes("/")) {
    return targetArea;
  }

  return "—";
};

// ----- jグランツ公開API -----
// ドキュメント: https://api.jgrants-portal.go.jp/exp/v1/public/swagger-ui/index.html
const JGRANTS_BASE = "https://api.jgrants-portal.go.jp/exp/v1/public";

app.get("/api/search-jgrants", rateLimit({ name: "search", windowMs: 5 * 60 * 1000, max: 30 }), async (req, res) => {
  const keyword = cleanInput(req.query.keyword, "補助金", 80);
  const prefecture = cleanInput(req.query.prefecture, "", 20);
  const acceptanceRaw = asStr(req.query.acceptance, "1");
  const acceptance = ["0", "1"].includes(acceptanceRaw) ? acceptanceRaw : "1";
  const requestedSort = cleanInput(req.query.sort, "created_date", 40);
  const sort = new Set(["created_date", "acceptance_start_datetime", "acceptance_end_datetime"]).has(requestedSort) ? requestedSort : "created_date";
  const requestedOrder = cleanInput(req.query.order, "DESC", 4).toUpperCase();
  const order = ["ASC", "DESC"].includes(requestedOrder) ? requestedOrder : "DESC";

  try {
    const r = await axios.get(`${JGRANTS_BASE}/subsidies`, {
      params: {
        keyword: keyword.length >= 2 ? keyword : "補助金",
        sort,
        order,
        acceptance
      },
      timeout: 20000,
      headers: { "User-Agent": "niche-hojokin-finder-app/1.0" }
    });

    let items = (r.data && r.data.result) || [];

    // 都道府県でフィルタ（target_area_search に都道府県名 or "全国" を含む）
    if (prefecture) {
      items = items.filter((it) => {
        const area = (it.target_area_search || it.target_area || "").toString();
        return area.includes(prefecture) || area.includes("全国");
      });
    }

    // フロント側で扱いやすい形に絞る
    const normalized = items.map((it) => ({
      id: it.id,
      subsidy_name: it.title || it.institution_name || it.subsidy_name || it.name || it.id,
      management_number: it.name || it.subsidy_no || it.id,
      name: it.title || it.institution_name || it.name || it.id,
      issuer: inferIssuer(it),
      target_area: it.target_area_search || it.target_area || "—",
      acceptance_start: it.acceptance_start_datetime || "",
      acceptance_end: it.acceptance_end_datetime || "",
      subsidy_min_limit: extractSubsidyMinLimit(it),
      subsidy_max_limit: it.subsidy_max_limit || "",
      subsidy_rate: it.subsidy_rate || "",
      use_purpose: summarizePurpose(it),
      industry: it.industry || "",
      detail_url: safeExternalUrl(it.detail_url, ["jgrants-portal.go.jp"]) || `https://www.jgrants-portal.go.jp/subsidy/${encodeURIComponent(it.id)}`,
      front_subsidy_detail_page_url: safeExternalUrl(it.front_subsidy_detail_page_url, ["jgrants-portal.go.jp"])
    }));

    await enrichItemsWithDetails(normalized);
    await recordSearchHistory(req.query, normalized.length);

    res.json({ ok: true, source: "jgrants", count: normalized.length, items: normalized });
  } catch (e) {
    res.status(502).json(upstreamErrorPayload(e, {
      source: "jgrants",
      fallback_search_url: `https://www.jgrants-portal.go.jp/subsidy/search?keyword=${encodeURIComponent(keyword)}`
    }));
  }
});

// ----- 単一補助金の詳細 -----
app.get("/api/jgrants/:id", async (req, res) => {
  if (!isValidJgrantsId(req.params.id)) {
    return res.status(400).json({ ok: false, error: "Invalid subsidy id" });
  }
  try {
    const r = await axios.get(`${JGRANTS_BASE}/subsidies/id/${encodeURIComponent(req.params.id)}`, {
      timeout: 20000,
      headers: { "User-Agent": "niche-hojokin-finder-app/1.0" }
    });
    res.json({ ok: true, item: r.data?.result?.[0] || r.data });
  } catch (e) {
    res.status(502).json(upstreamErrorPayload(e));
  }
});

// ----- 省庁・自治体の公式元URLだけを安全に開く -----
app.get("/api/official-source/:id", async (req, res) => {
  if (!isValidJgrantsId(req.params.id)) {
    return res.status(400).json({ ok: false, error: "Invalid subsidy id" });
  }
  try {
    const source = await getOfficialSource(req.params.id);
    if (!source) {
      res.status(404).json({
        ok: false,
        error: "省庁（.go.jp）または地方公共団体（.lg.jp）の公式元URLを確認できませんでした。誤リンク防止のため補助金名からは開きません。"
      });
      return;
    }
    res.json({ ok: true, ...source });
  } catch (e) {
    res.status(502).json(upstreamErrorPayload(e));
  }
});

app.get("/api/official-source/:id/redirect", async (req, res) => {
  if (!isValidJgrantsId(req.params.id)) {
    return res.status(400).type("text/plain").send("Invalid subsidy id");
  }
  try {
    const source = await getOfficialSource(req.params.id);
    if (!source) {
      res.status(404).send("省庁（.go.jp）または地方公共団体（.lg.jp）の公式元URLを確認できませんでした。");
      return;
    }
    res.redirect(302, source.url);
  } catch (e) {
    res.status(502).type("text/plain").send("公式元URLの確認に失敗しました。");
  }
});

// ----- AI補完はAPI連携なし -----
app.post("/api/ask-ai", (_req, res) => {
  res.status(410).json({
    ok: false,
    error: "API連携は無効です。画面の Claude / ChatGPT Web版ボタンを使ってください。"
  });
});

app.get("/api/shared/status", async (_req, res) => {
  if (!dbPool) return res.json({ ok: true, enabled: false, ready: false });
  try {
    await ensureDbReady();
  } catch {
    // Keep the main app available even when the shared DB is temporarily unavailable.
  }
  res.json({
    ok: true,
    enabled: true,
    ready: dbStatus.ready,
    error: dbStatus.ready ? "" : dbStatus.error
  });
});

app.get("/api/shared/history", async (req, res) => {
  if (!dbPool) return res.json(sharedDbUnavailable());
  try {
    const pool = await ensureDbReady();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const { rows } = await pool.query(`
      SELECT id, created_at, keyword, prefecture, municipality, theme, industry, employees, entity, result_count, source
      FROM shared_search_history
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ ok: true, enabled: true, history: rows });
  } catch (e) {
    res.status(503).json({ ok: false, enabled: true, error: e.message });
  }
});

app.get("/api/shared/saved", async (req, res) => {
  if (!dbPool) return res.json(sharedDbUnavailable());
  try {
    const pool = await ensureDbReady();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const { rows } = await pool.query(`
      SELECT id, created_at, updated_at, subsidy_id, title, issuer, target_area,
             acceptance_start, acceptance_end, subsidy_min_limit, subsidy_max_limit,
             subsidy_rate, use_purpose, detail_url, source_url, note
      FROM saved_subsidies
      ORDER BY updated_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ ok: true, enabled: true, items: rows });
  } catch (e) {
    res.status(503).json({ ok: false, enabled: true, error: e.message });
  }
});

app.post("/api/shared/saved", async (req, res) => {
  if (!dbPool) return res.status(503).json({ ok: false, enabled: false, error: "Shared database is not connected." });
  try {
    const item = req.body?.item || req.body || {};
    const subsidyId = dbText(item.id || item.subsidy_id, 120);
    const title = dbText(item.subsidy_name || item.title || item.name, 500);
    if (!subsidyId || !title) return res.status(400).json({ ok: false, error: "Invalid subsidy item." });

    const pool = await ensureDbReady();
    const { rows } = await pool.query(`
      INSERT INTO saved_subsidies
        (subsidy_id, title, issuer, target_area, acceptance_start, acceptance_end,
         subsidy_min_limit, subsidy_max_limit, subsidy_rate, use_purpose, detail_url, source_url, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (subsidy_id) DO UPDATE SET
        title = EXCLUDED.title,
        issuer = EXCLUDED.issuer,
        target_area = EXCLUDED.target_area,
        acceptance_start = EXCLUDED.acceptance_start,
        acceptance_end = EXCLUDED.acceptance_end,
        subsidy_min_limit = EXCLUDED.subsidy_min_limit,
        subsidy_max_limit = EXCLUDED.subsidy_max_limit,
        subsidy_rate = EXCLUDED.subsidy_rate,
        use_purpose = EXCLUDED.use_purpose,
        detail_url = EXCLUDED.detail_url,
        source_url = EXCLUDED.source_url,
        note = EXCLUDED.note,
        updated_at = NOW()
      RETURNING id, created_at, updated_at, subsidy_id, title, issuer, target_area,
                acceptance_start, acceptance_end, subsidy_min_limit, subsidy_max_limit,
                subsidy_rate, use_purpose, detail_url, source_url, note
    `, [
      subsidyId,
      title,
      dbText(item.issuer, 300),
      dbText(item.target_area, 300),
      dbText(item.acceptance_start, 80),
      dbText(item.acceptance_end, 80),
      dbText(item.subsidy_min_limit, 80),
      dbText(item.subsidy_max_limit, 80),
      dbText(item.subsidy_rate, 300),
      dbText(item.use_purpose, 2500),
      dbText(item.detail_url || item.front_subsidy_detail_page_url, 1000),
      dbText(item.official_source_url || item.source_url, 1000),
      dbText(item.note, 1000)
    ]);
    res.json({ ok: true, enabled: true, item: rows[0] });
  } catch (e) {
    res.status(503).json({ ok: false, enabled: true, error: e.message });
  }
});

app.delete("/api/shared/saved/:id", async (req, res) => {
  if (!dbPool) return res.status(503).json({ ok: false, enabled: false, error: "Shared database is not connected." });
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ ok: false, error: "Invalid saved item id." });
  try {
    const pool = await ensureDbReady();
    const { rowCount } = await pool.query("DELETE FROM saved_subsidies WHERE id = $1", [id]);
    res.json({ ok: true, deleted: rowCount });
  } catch (e) {
    res.status(503).json({ ok: false, enabled: true, error: e.message });
  }
});

// ----- ヘルスチェック -----
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    ai_mode: "web",
    shared_db: {
      enabled: dbStatus.enabled,
      ready: dbStatus.ready
    },
    lan_urls: getLanUrls(ACTIVE_PORT)
  });
});

// ----- ポート自動フォールバック付き起動 -----
const PORT_PREFERRED = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const STRICT_PORT = process.env.STRICT_PORT === "1";
let ACTIVE_PORT = PORT_PREFERRED;

function startServer(port, retriesLeft = 5) {
  const server = app.listen(port, HOST, () => {
    ACTIVE_PORT = port;
    const lanUrls = getLanUrls(port);
    console.log("=".repeat(60));
    console.log(`  niche-hojokin-finder app`);
    console.log(`  Local: http://localhost:${port}`);
    if (lanUrls.length) {
      console.log(`  Company LAN: ${lanUrls.join("  /  ")}`);
    }
    console.log(`  AI mode: Web版AIへ貼り付け（APIキー不要）`);
    console.log(`  停止: Ctrl + C`);
    console.log("=".repeat(60));
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && STRICT_PORT) {
      console.error(`[fatal] port ${port} is already in use. Strict fixed-port mode is enabled.`);
      process.exit(1);
    } else if (err.code === "EADDRINUSE" && retriesLeft > 0) {
      console.warn(`[警告] ポート ${port} は使用中。${port + 1} を試します...（残り${retriesLeft}回）`);
      setTimeout(() => startServer(port + 1, retriesLeft - 1), 200);
    } else if (err.code === "EACCES") {
      console.error(`[致命] ポート ${port} の使用権限がありません。.env で PORT を 1024以上に変更してください。`);
      process.exit(1);
    } else {
      console.error(`[致命] ポート ${port} で起動失敗:`, err.message);
      process.exit(1);
    }
  });
}

if (dbPool) {
  dbInitPromise = initDb();
}

startServer(PORT_PREFERRED);

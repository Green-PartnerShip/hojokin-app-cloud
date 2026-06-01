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
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import crypto from "crypto";
import pg from "pg";
import { transformMemo } from "./explanation-transform.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
const { Pool } = pg;

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
const PUBLIC_ACCESS = truthy(process.env.PUBLIC_ACCESS) || truthy(process.env.CLOUD_MODE);
const AUTH_REQUIRED = PUBLIC_ACCESS || truthy(process.env.AUTH_REQUIRED) || !!process.env.APP_PASSWORD || !!process.env.APP_PASSWORD_HASH;
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const APP_PASSWORD_HASH = process.env.APP_PASSWORD_HASH || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_TTL_MS = Math.max(1, Number(process.env.SESSION_TTL_HOURS || 12)) * 60 * 60 * 1000;
const sessions = new Map();
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const GP_APP_FILE = path.join(__dirname, "public", "GP業務管理.html");
const GP_SHARED_DATA_LIMIT = Number(process.env.GP_SHARED_DATA_LIMIT || 5 * 1024 * 1024);

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
const pgPool = dbPool;
const hearingEventClients = new Set();
const APP_DATA_DIR = path.resolve(process.env.APP_DATA_DIR || process.env.DATA_DIR || path.join(__dirname, ".data"));
const hearingDataDir = path.resolve(process.env.HEARING_DATA_DIR || path.join(APP_DATA_DIR, "hearing"));
const hearingCasesFile = path.join(hearingDataDir, "hearing-cases.json");
let hearingStoreReady = null;
let hearingFileQueue = Promise.resolve();
const TASKS_FILE = path.join(APP_DATA_DIR, "shared-tasks.json");
const EXPLANATION_DRAFTS_FILE = path.join(APP_DATA_DIR, "explanation-drafts.json");
const PHRASE_STOCK_FILE = path.join(APP_DATA_DIR, "phrase-stock-templates.json");
const SHARED_HISTORY_FILE = path.join(APP_DATA_DIR, "shared-search-history.json");
const SAVED_SUBSIDIES_FILE = path.join(APP_DATA_DIR, "saved-subsidies.json");
const GP_STORE_FILE = path.join(APP_DATA_DIR, "gp-shared-store.json");
const GP_BACKUPS_FILE = path.join(APP_DATA_DIR, "gp-shared-backups.json");
const PHRASE_STOCK_STORE_ID = "main";
let taskStoreReady = null;
let taskFileQueue = Promise.resolve();
let explanationDraftFileQueue = Promise.resolve();
let phraseStockFileQueue = Promise.resolve();
let sharedDataFileQueue = Promise.resolve();
let gpFileQueue = Promise.resolve();

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
    "script-src 'self' https://cdn.jsdelivr.net https://unpkg.com 'unsafe-inline'",
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

const priorityValues = new Set(["critical", "high", "normal", "low"]);

const cleanTaskText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

const readJsonFile = async (filePath, fallback) => {
  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
};

const writeJsonFile = async (filePath, value) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.promises.rename(temporaryFile, filePath);
  return value;
};

const emptyPhraseStockStore = () => ({ revision: 0, updatedAt: "", templates: [] });

const normalizePhraseStockStore = (value = {}) => ({
  revision: Number(value.revision || 0),
  updatedAt: value.updatedAt || value.updated_at || "",
  templates: Array.isArray(value.templates) ? value.templates : []
});

const mergePhraseStockTemplates = (current, incoming, deletedIds = []) => {
  const deleted = new Set(deletedIds.map(String));
  const merged = new Map();

  current.forEach((template) => {
    const id = String(template?.id || "");
    if (id && !deleted.has(id)) merged.set(id, template);
  });
  incoming.forEach((template) => {
    const id = String(template?.id || "");
    if (id && !deleted.has(id)) merged.set(id, template);
  });

  return [...merged.values()].sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))
  );
};

const ensurePhraseStockStore = async () => {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS phrase_stock_state (
      id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      templates JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `);
};

const readPhraseStockStore = async () => {
  if (!pgPool) {
    return normalizePhraseStockStore(await readJsonFile(PHRASE_STOCK_FILE, emptyPhraseStockStore()));
  }
  await ensurePhraseStockStore();
  const result = await pgPool.query(
    "SELECT revision, updated_at, templates FROM phrase_stock_state WHERE id = $1",
    [PHRASE_STOCK_STORE_ID]
  );
  const row = result.rows[0];
  if (!row) return emptyPhraseStockStore();
  return normalizePhraseStockStore({
    revision: row.revision,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
    templates: row.templates
  });
};

const savePhraseStockStore = async ({ templates, baseRevision, deletedIds = [], replace = false }) => {
  const incoming = Array.isArray(templates) ? templates.slice(0, 1000) : [];
  if (!pgPool) {
    const run = phraseStockFileQueue.then(async () => {
      const current = normalizePhraseStockStore(await readJsonFile(PHRASE_STOCK_FILE, emptyPhraseStockStore()));
      const stale = Number.isFinite(Number(baseRevision)) && Number(baseRevision) < current.revision;
      const nextTemplates = stale && !replace ? mergePhraseStockTemplates(current.templates, incoming, deletedIds) : incoming;
      const next = {
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
        templates: nextTemplates
      };
      await writeJsonFile(PHRASE_STOCK_FILE, next);
      return { ...next, merged: stale && !replace, storage: "file" };
    });
    phraseStockFileQueue = run.catch(() => {});
    return run;
  }

  await ensurePhraseStockStore();
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      "SELECT revision, updated_at, templates FROM phrase_stock_state WHERE id = $1 FOR UPDATE",
      [PHRASE_STOCK_STORE_ID]
    );
    const current = normalizePhraseStockStore(currentResult.rows[0] || emptyPhraseStockStore());
    const stale = Number.isFinite(Number(baseRevision)) && Number(baseRevision) < current.revision;
    const nextTemplates = stale && !replace ? mergePhraseStockTemplates(current.templates, incoming, deletedIds) : incoming;
    const next = {
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      templates: nextTemplates
    };
    await client.query(
      `INSERT INTO phrase_stock_state (id, revision, updated_at, templates)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id)
       DO UPDATE SET revision = EXCLUDED.revision, updated_at = EXCLUDED.updated_at, templates = EXCLUDED.templates`,
      [PHRASE_STOCK_STORE_ID, next.revision, next.updatedAt, JSON.stringify(next.templates)]
    );
    await client.query("COMMIT");
    return { ...next, merged: stale && !replace, storage: "postgres" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const normalizeTask = (task = {}) => {
  const now = Date.now();
  return {
    id: cleanTaskText(task.id, 120) || crypto.randomUUID(),
    title: cleanTaskText(task.title, 80) || "無題のタスク",
    project: cleanTaskText(task.project, 60),
    owner: cleanTaskText(task.owner, 40),
    date: /^\d{4}-\d{2}-\d{2}$/.test(task.date || "") ? task.date : new Date().toISOString().slice(0, 10),
    time: /^\d{2}:\d{2}$/.test(task.time || "") ? task.time : "",
    category: cleanTaskText(task.category, 24) || "その他",
    priority: priorityValues.has(task.priority) ? task.priority : "normal",
    notes: cleanTaskText(task.notes, 240),
    done: Boolean(task.done),
    createdAt: Number.isFinite(Number(task.createdAt)) ? Number(task.createdAt) : now
  };
};

const normalizeExplanationDraft = (draft = {}) => ({
  id: cleanTaskText(draft.id, 120) || crypto.randomUUID(),
  createdAt: draft.createdAt || new Date().toISOString(),
  title: cleanTaskText(draft.title, 120) || "下書き",
  memo: cleanTaskText(draft.memo, 12000),
  output: cleanTaskText(draft.output, 12000),
  audience: cleanTaskText(draft.audience, 40) || "boss",
  purpose: cleanTaskText(draft.purpose, 40) || "report",
  tone: cleanTaskText(draft.tone, 40) || "polite",
  format: cleanTaskText(draft.format, 40) || "email",
  detail: cleanTaskText(draft.detail, 40) || "standard"
});

const ensureExplanationDraftStore = async () => {
  if (!pgPool) return false;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS explanation_drafts (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  return true;
};

const readExplanationDraftFile = async () => {
  const parsed = await readJsonFile(EXPLANATION_DRAFTS_FILE, { drafts: [] });
  const drafts = Array.isArray(parsed.drafts) ? parsed.drafts.map(normalizeExplanationDraft) : [];
  return drafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
};

const writeExplanationDraftFile = async (drafts) => {
  const store = {
    drafts: drafts
      .map(normalizeExplanationDraft)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50),
    updatedAt: new Date().toISOString()
  };
  await writeJsonFile(EXPLANATION_DRAFTS_FILE, store);
  return store.drafts;
};

const mutateExplanationDraftFile = async (work) => {
  const run = explanationDraftFileQueue.then(async () => {
    const drafts = await readExplanationDraftFile();
    const nextDrafts = await work(drafts);
    return writeExplanationDraftFile(nextDrafts || drafts);
  });
  explanationDraftFileQueue = run.catch(() => {});
  return run;
};

const ensureTaskStore = async () => {
  if (taskStoreReady) return taskStoreReady;
  taskStoreReady = (async () => {
    if (pgPool) {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS shared_tasks (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      return;
    }
    await fs.promises.mkdir(path.dirname(TASKS_FILE), { recursive: true });
    try {
      await fs.promises.access(TASKS_FILE);
    } catch {
      await fs.promises.writeFile(TASKS_FILE, JSON.stringify({ tasks: [], updatedAt: null }, null, 2), "utf8");
    }
  })();
  return taskStoreReady;
};

const readTaskStore = async () => {
  await ensureTaskStore();
  if (pgPool) {
    const result = await pgPool.query("SELECT payload, updated_at FROM shared_tasks ORDER BY updated_at DESC");
    const tasks = result.rows.map((row) => normalizeTask(row.payload));
    const updatedAt = result.rows[0]?.updated_at ? new Date(result.rows[0].updated_at).toISOString() : null;
    return { tasks, updatedAt };
  }
  const content = await fs.promises.readFile(TASKS_FILE, "utf8");
  const parsed = JSON.parse(content);
  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask) : [],
    updatedAt: parsed.updatedAt || null
  };
};

const writeTaskFile = async (tasks) => {
  await ensureTaskStore();
  const store = { tasks: tasks.map(normalizeTask), updatedAt: new Date().toISOString() };
  await fs.promises.mkdir(path.dirname(TASKS_FILE), { recursive: true });
  const temporaryFile = `${TASKS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.promises.rename(temporaryFile, TASKS_FILE);
  return store;
};

const mutateTaskStore = async (work) => {
  if (pgPool) {
    await ensureTaskStore();
    return work();
  }
  const run = taskFileQueue.then(async () => {
    const current = await readTaskStore();
    const nextTasks = await work(current.tasks);
    if (!nextTasks) return null;
    return writeTaskFile(nextTasks);
  });
  taskFileQueue = run.catch(() => {});
  return run;
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const safeNextPath = (value) => {
  const next = String(value || "/");
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.startsWith("/login")) return "/";
  return next;
};

const cleanHearingText = (value, maxLength = 160) => String(value || "").trim().slice(0, maxLength);

const sanitizeHearingMode = (value) => (value === "personal" ? "personal" : "company");

const sanitizeHearingState = (value) => (
  value && typeof value === "object" && !Array.isArray(value) ? value : {}
);

const isoDate = (value, fallback = new Date().toISOString()) => {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const getHearingStateText = (state, keys, maxLength = 160) => {
  for (const key of keys) {
    const value = cleanHearingText(state?.[key], maxLength);
    if (value) return value;
  }
  return "";
};

const normalizeStoredHearingCase = (record = {}) => {
  const now = new Date().toISOString();
  const state = sanitizeHearingState(record.state);
  const clientName = cleanHearingText(
    record.clientName || record.client_name || getHearingStateText(state, ["companyName", "businessName", "contactName", "representativeName"]),
    140
  );
  const subsidyType = cleanHearingText(record.subsidyType || record.subsidy_type || state.subsidyType, 100);
  const title = cleanHearingText(record.title || clientName || getHearingStateText(state, ["projectName", "planName"]), 180) || "名称未入力";
  return {
    id: cleanHearingText(record.id, 120) || crypto.randomUUID(),
    mode: sanitizeHearingMode(record.mode || state.mode),
    title,
    clientName,
    subsidyType,
    state,
    createdAt: isoDate(record.createdAt || record.created_at, now),
    updatedAt: isoDate(record.updatedAt || record.updated_at, now),
    updatedBy: cleanHearingText(record.updatedBy || record.updated_by || "利用者", 80),
    lastClientId: cleanHearingText(record.lastClientId || record.last_client_id || "", 160),
    revision: Math.max(1, Number(record.revision || 1))
  };
};

const buildHearingCaseRecord = (body = {}, current = null) => {
  const now = new Date().toISOString();
  const state = sanitizeHearingState(body.state ?? current?.state);
  const base = normalizeStoredHearingCase({ ...current, state });
  const clientName = cleanHearingText(
    body.clientName || body.client_name || getHearingStateText(state, ["companyName", "businessName", "contactName", "representativeName"]),
    140
  );
  const subsidyType = cleanHearingText(body.subsidyType || body.subsidy_type || state.subsidyType, 100);
  const title = cleanHearingText(body.title || clientName || getHearingStateText(state, ["projectName", "planName"]), 180) || "名称未入力";
  return {
    id: current?.id || cleanHearingText(body.id, 120) || crypto.randomUUID(),
    mode: sanitizeHearingMode(body.mode || state.mode || current?.mode),
    title,
    clientName,
    subsidyType,
    state,
    createdAt: current?.createdAt || base.createdAt || now,
    updatedAt: now,
    updatedBy: cleanHearingText(body.updatedBy || body.updated_by || current?.updatedBy || "利用者", 80),
    lastClientId: cleanHearingText(body.clientId || body.lastClientId || body.last_client_id || current?.lastClientId || "", 160),
    revision: current ? Math.max(1, Number(current.revision || 1) + 1) : 1
  };
};

const hearingCaseSummary = (record) => {
  const item = normalizeStoredHearingCase(record);
  return {
    id: item.id,
    mode: item.mode,
    title: item.title,
    clientName: item.clientName,
    subsidyType: item.subsidyType,
    updatedAt: item.updatedAt,
    updatedBy: item.updatedBy,
    lastClientId: item.lastClientId,
    revision: item.revision
  };
};

const rowToHearingCase = (row = {}) => normalizeStoredHearingCase({
  id: row.id,
  mode: row.mode,
  title: row.title,
  clientName: row.client_name,
  subsidyType: row.subsidy_type,
  state: row.state,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
  lastClientId: row.last_client_id,
  revision: row.revision
});

const ensureHearingStore = async () => {
  if (hearingStoreReady) return hearingStoreReady;
  hearingStoreReady = (async () => {
    if (pgPool) {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS gp_hearing_cases (
          id TEXT PRIMARY KEY,
          mode TEXT NOT NULL,
          title TEXT NOT NULL,
          client_name TEXT,
          subsidy_type TEXT,
          state JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          updated_by TEXT,
          last_client_id TEXT,
          revision INTEGER NOT NULL DEFAULT 1
        )
      `);
      await pgPool.query("CREATE INDEX IF NOT EXISTS gp_hearing_cases_mode_updated_idx ON gp_hearing_cases(mode, updated_at DESC)");
      return;
    }
    await fs.promises.mkdir(hearingDataDir, { recursive: true });
    try {
      await fs.promises.access(hearingCasesFile);
    } catch {
      await fs.promises.writeFile(hearingCasesFile, JSON.stringify({ version: 1, cases: [], updatedAt: null }, null, 2), "utf8");
    }
  })();
  return hearingStoreReady;
};

const readHearingFile = async () => {
  await ensureHearingStore();
  const content = await fs.promises.readFile(hearingCasesFile, "utf8");
  const parsed = JSON.parse(content);
  const cases = Array.isArray(parsed.cases) ? parsed.cases.map(normalizeStoredHearingCase) : [];
  return { cases, updatedAt: parsed.updatedAt || null };
};

const writeHearingFile = async (cases) => {
  await ensureHearingStore();
  const store = {
    version: 1,
    cases: cases.map(normalizeStoredHearingCase),
    updatedAt: new Date().toISOString()
  };
  const temporaryFile = `${hearingCasesFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.promises.rename(temporaryFile, hearingCasesFile);
  return store;
};

const listHearingCases = async ({ mode, query }) => {
  await ensureHearingStore();
  const normalizedMode = sanitizeHearingMode(mode);
  const normalizedQuery = cleanHearingText(query, 80).toLowerCase();
  if (pgPool) {
    const values = [normalizedMode];
    let where = "WHERE mode = $1";
    if (normalizedQuery) {
      values.push(`%${normalizedQuery}%`);
      where += ` AND (
        lower(title) LIKE $2 OR
        lower(coalesce(client_name, '')) LIKE $2 OR
        lower(coalesce(subsidy_type, '')) LIKE $2
      )`;
    }
    const result = await pgPool.query(`
      SELECT id, mode, title, client_name, subsidy_type, state, created_at, updated_at, updated_by, last_client_id, revision
      FROM gp_hearing_cases
      ${where}
      ORDER BY updated_at DESC
      LIMIT 200
    `, values);
    return result.rows.map(rowToHearingCase);
  }
  const store = await readHearingFile();
  return store.cases
    .filter((item) => item.mode === normalizedMode)
    .filter((item) => !normalizedQuery || [item.title, item.clientName, item.subsidyType].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 200);
};

const getHearingCase = async (id) => {
  const caseId = cleanHearingText(id, 120);
  await ensureHearingStore();
  if (pgPool) {
    const result = await pgPool.query(`
      SELECT id, mode, title, client_name, subsidy_type, state, created_at, updated_at, updated_by, last_client_id, revision
      FROM gp_hearing_cases
      WHERE id = $1
    `, [caseId]);
    return result.rowCount ? rowToHearingCase(result.rows[0]) : null;
  }
  const store = await readHearingFile();
  return store.cases.find((item) => item.id === caseId) || null;
};

const saveNewHearingCase = async (body) => {
  const record = buildHearingCaseRecord(body);
  await ensureHearingStore();
  if (pgPool) {
    await pgPool.query(`
      INSERT INTO gp_hearing_cases
        (id, mode, title, client_name, subsidy_type, state, created_at, updated_at, updated_by, last_client_id, revision)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
    `, [
      record.id,
      record.mode,
      record.title,
      record.clientName,
      record.subsidyType,
      JSON.stringify(record.state),
      record.createdAt,
      record.updatedAt,
      record.updatedBy,
      record.lastClientId,
      record.revision
    ]);
    return record;
  }
  const run = hearingFileQueue.then(async () => {
    const current = await readHearingFile();
    return writeHearingFile([record, ...current.cases]);
  });
  hearingFileQueue = run.catch(() => {});
  const store = await run;
  return store.cases.find((item) => item.id === record.id) || record;
};

const updateHearingCase = async (id, body) => {
  const caseId = cleanHearingText(id, 120);
  await ensureHearingStore();
  if (pgPool) {
    const current = await getHearingCase(caseId);
    if (!current) return { status: "missing" };
    if (Number(body.revision || 0) && Number(body.revision) !== Number(current.revision || 0)) {
      return { status: "conflict", case: current };
    }
    const record = buildHearingCaseRecord(body, current);
    await pgPool.query(`
      UPDATE gp_hearing_cases
      SET mode = $2,
          title = $3,
          client_name = $4,
          subsidy_type = $5,
          state = $6::jsonb,
          updated_at = $7,
          updated_by = $8,
          last_client_id = $9,
          revision = $10
      WHERE id = $1
    `, [
      record.id,
      record.mode,
      record.title,
      record.clientName,
      record.subsidyType,
      JSON.stringify(record.state),
      record.updatedAt,
      record.updatedBy,
      record.lastClientId,
      record.revision
    ]);
    return { status: "saved", case: record };
  }
  const run = hearingFileQueue.then(async () => {
    const current = await readHearingFile();
    const index = current.cases.findIndex((item) => item.id === caseId);
    if (index === -1) return { status: "missing" };
    const existing = current.cases[index];
    if (Number(body.revision || 0) && Number(body.revision) !== Number(existing.revision || 0)) {
      return { status: "conflict", case: existing };
    }
    const record = buildHearingCaseRecord(body, existing);
    const nextCases = [...current.cases];
    nextCases[index] = record;
    await writeHearingFile(nextCases);
    return { status: "saved", case: record };
  });
  hearingFileQueue = run.catch(() => {});
  return run;
};

const publishHearingCasesChanged = (record) => {
  const payload = `event: cases-changed\ndata: ${JSON.stringify({ case: hearingCaseSummary(record) })}\n\n`;
  for (const res of hearingEventClients) {
    res.write(payload);
  }
};

const renderInternalHub = () => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>統合メニュー - 補助金クラウド</title>
  <link rel="stylesheet" href="/app-switcher.css?v=20260602h">
  <script defer src="/app-switcher.js?v=20260602h"></script>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f6f8f7;color:#18221f}
    .wrap{max-width:1040px;margin:0 auto;padding:28px}
    header{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:22px}
    h1{font-size:26px;margin:0 0 6px}
    p{margin:0;color:#5f6f69;line-height:1.7}
    .logout{border:1px solid #cdd8d4;border-radius:8px;background:white;color:#263b35;padding:10px 14px;text-decoration:none;font-weight:700}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:22px}
    .tile{display:flex;flex-direction:column;gap:10px;min-height:142px;padding:18px;border:1px solid #d8e3df;border-radius:8px;background:white;text-decoration:none;color:inherit;box-shadow:0 10px 24px rgba(31,57,49,.06)}
    .tile strong{font-size:18px}
    .tile span{color:#64746f;line-height:1.6}
    .tag{width:max-content;border-radius:999px;padding:4px 9px;background:#e5f3ed;color:#0f6b4f;font-weight:700;font-size:12px}
    @media (max-width:640px){.wrap{padding:18px}header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="wrap">
    <header>
      <div>
        <h1>統合メニュー</h1>
        <p>補助金検索、ヒアリング、説明変換、タスク管理を1つのWebサービス内で切り替えます。</p>
      </div>
      <a class="logout" href="/logout">ログアウト</a>
    </header>
    <section class="grid" aria-label="利用できるアプリ">
        <a class="tile" href="/">
          <span class="tag">検索</span>
          <strong>補助金検索</strong>
          <span>国・自治体の補助金を探し、候補整理に使います。</span>
        </a>
        <a class="tile" href="/internal/gp">
          <span class="tag">業務管理</span>
          <strong>GP業務管理</strong>
          <span>顧問先、案件進捗、チャット相談、書類ひな形、月次レポートを管理します。</span>
        </a>
        <a class="tile" href="/phrase-stock/">
          <span class="tag">文章共有</span>
          <strong>定型文ストック</strong>
          <span>社内共有の定型文を検索・追加・編集し、自然な日本語文をすぐ使える形にします。</span>
        </a>
        <a class="tile" href="/internal/hearing/company">
          <span class="tag">共有保存</span>
          <strong>ヒアリング整理（会社用）</strong>
        <span>法人・会社向けのヒアリング内容を整理し、社内で共有保存します。</span>
      </a>
      <a class="tile" href="/internal/hearing/personal">
        <span class="tag">共有保存</span>
        <strong>ヒアリング整理（個人用）</strong>
        <span>個人事業主向けのヒアリング内容を整理し、外出先からも確認できます。</span>
      </a>
      <a class="tile" href="/explanation/">
        <span class="tag">文章整理</span>
        <strong>説明変換ワークベンチ</strong>
        <span>業務メモを、お客様や社内で共有しやすい説明文に整えます。</span>
      </a>
      <a class="tile" href="/tasks/">
        <span class="tag">社内管理</span>
        <strong>業務タスクボード</strong>
        <span>社内の作業予定や担当を共有して、対応漏れを減らします。</span>
      </a>
    </section>
  </main>
</body>
</html>`;

const renderLoginPage = (nextPath = "/", message = "") => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ログイン - 補助金クラウド</title>
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
      <input type="hidden" name="next" value="${escapeHtml(safeNextPath(nextPath))}">
      <h1>補助金クラウド</h1>
      ${message ? `<div class="error">${escapeHtml(message)}</div>` : ""}
      <label for="password">パスワード</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
      <button type="submit">ログイン</button>
      <div class="note">URLを知っている人だけでなく、パスワードを知っている人だけが利用できます。</div>
    </form>
  </main>
</body>
</html>`;

const authGuard = (req, res, next) => {
  const isApiLikePath = req.path.startsWith("/api/") ||
    req.path.startsWith("/explanation/api/") ||
    req.path.startsWith("/internal/hearing/api/") ||
    req.path.startsWith("/phrase-stock/api/");
  if (
    !AUTH_REQUIRED ||
    req.path === "/login" ||
    req.path === "/api/health" ||
    req.path === "/explanation/api/health" ||
    req.path === "/phrase-stock/api/session" ||
    req.path === "/phrase-stock/api/login" ||
    req.path === "/phrase-stock/api/logout" ||
    req.path === "/api/session" ||
    req.path === "/api/login" ||
    req.path === "/api/logout"
  ) return next();
  if (getValidSession(req)) return next();
  if (isApiLikePath) return res.status(401).json({ ok: false, error: "Login required", message: "ログインが必要です。" });
  return res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl || req.url || "/")}`);
};

app.use(securityHeaders);
app.use(networkAccessGuard);
app.use(express.json({ limit: "6mb", type: "application/json" }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));

app.get("/login", (req, res) => {
  const nextPath = safeNextPath(req.query.next);
  if (!AUTH_REQUIRED || getValidSession(req)) return res.redirect(302, nextPath);
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(renderLoginPage(nextPath));
});

app.post("/login", rateLimit({ name: "login", windowMs: 5 * 60 * 1000, max: 20 }), (req, res) => {
  const nextPath = safeNextPath(req.body?.next);
  if (!AUTH_REQUIRED) return res.redirect(302, nextPath);
  const password = String(req.body?.password || "");
  if (verifyPassword(password)) {
    res.setHeader("Set-Cookie", createSession(req, "authenticated"));
    return res.redirect(303, nextPath);
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(401).type("html").send(renderLoginPage(nextPath, "パスワードが違います。"));
});

app.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.redirect(303, "/login");
});

app.get("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.redirect(303, "/login");
});

app.get("/api/session", (req, res) => {
  res.json({
    ok: true,
    configured: !AUTH_REQUIRED || Boolean(APP_PASSWORD || APP_PASSWORD_HASH),
    authenticated: Boolean(getValidSession(req))
  });
});

app.post("/api/login", rateLimit({ name: "api-login", windowMs: 5 * 60 * 1000, max: 20 }), (req, res) => {
  if (!AUTH_REQUIRED) return res.json({ ok: true });
  const password = String(req.body?.password || "");
  if (!verifyPassword(password)) {
    return res.status(401).json({ ok: false, message: "パスワードが違います。" });
  }
  res.setHeader("Set-Cookie", createSession(req, "authenticated"));
  return res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie(req));
  res.json({ ok: true });
});

app.use(authGuard);
app.use("/api", apiAccessGuard, rateLimit({ name: "api", windowMs: 60 * 1000, max: 180 }));
app.use("/explanation/api", apiAccessGuard, rateLimit({ name: "explanation-api", windowMs: 60 * 1000, max: 180 }));
app.use("/internal/hearing/api", apiAccessGuard, rateLimit({ name: "hearing-api", windowMs: 60 * 1000, max: 240 }));
app.use("/phrase-stock/api", apiAccessGuard, rateLimit({ name: "phrase-stock-api", windowMs: 60 * 1000, max: 240 }));

app.get(/^\/phrase-stock$/, (_req, res) => {
  res.redirect(302, "/phrase-stock/");
});

app.get("/phrase-stock/api/session", (req, res) => {
  const session = getValidSession(req);
  res.json({
    ok: true,
    authenticated: Boolean(session),
    authRequired: AUTH_REQUIRED,
    authConfigured: !AUTH_REQUIRED || Boolean(APP_PASSWORD || APP_PASSWORD_HASH),
    user: session?.user || null,
    shared: true
  });
});

app.post("/phrase-stock/api/login", rateLimit({ name: "phrase-stock-login", windowMs: 5 * 60 * 1000, max: 20 }), (req, res) => {
  if (!AUTH_REQUIRED) return res.json({ ok: true, user: "local", authRequired: false });
  const password = String(req.body?.password || "");
  if (!verifyPassword(password)) {
    return res.status(401).json({ ok: false, message: "ログイン情報が正しくありません。" });
  }
  res.setHeader("Set-Cookie", createSession(req, "authenticated"));
  return res.json({ ok: true, user: "authenticated", authRequired: true });
});

app.post("/phrase-stock/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie(req));
  res.json({ ok: true });
});

app.get("/phrase-stock/api/templates", async (_req, res) => {
  try {
    const store = await readPhraseStockStore();
    res.json({ ok: true, shared: true, storage: pgPool ? "postgres" : "file", ...store });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "定型文を読み込めませんでした。" });
  }
});

app.put("/phrase-stock/api/templates", async (req, res) => {
  try {
    if (!Array.isArray(req.body?.templates)) {
      return res.status(400).json({ ok: false, message: "保存データの形式が正しくありません。" });
    }
    const saved = await savePhraseStockStore({
      templates: req.body.templates,
      baseRevision: req.body.baseRevision ?? req.body.revision,
      deletedIds: Array.isArray(req.body.deletedIds) ? req.body.deletedIds : [],
      replace: req.body.replace === true
    });
    res.json({
      ok: true,
      shared: true,
      savedAt: saved.updatedAt,
      revision: saved.revision,
      merged: Boolean(saved.merged),
      storage: saved.storage,
      templates: saved.templates
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "定型文を保存できませんでした。" });
  }
});

app.get("/app-switch", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>アプリ切替 - 補助金クラウド</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fb;color:#1a202c;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Yu Gothic UI",sans-serif}
    .window{width:min(760px,calc(100vw - 32px));background:#fff;border:1px solid #dbe3ef;border-radius:10px;padding:26px;box-shadow:0 16px 42px rgba(20,40,70,.12)}
    h1{margin:0 0 8px;font-size:24px}
    p{margin:0;color:#64748b;line-height:1.75}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:18px}
    .tile{border:1px solid #dbe3ef;border-radius:8px;padding:15px;background:#fff}
    .tile.primary{border-color:#2d5a3d;background:#f5f8f5}
    .tile h2{margin:0 0 6px;font-size:16px;color:#1f4a30}
    .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    a.button,button{border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#1a202c;padding:10px 14px;font-size:14px;font-weight:700;text-decoration:none;cursor:pointer}
    .open{background:#2d5a3d!important;color:#fff!important;border-color:#2d5a3d!important}
    .small{margin-top:14px;font-size:12px;color:#64748b}
  </style>
</head>
<body>
  <main class="window">
    <h1>アプリ切替</h1>
    <p>このWebサービス内で使うアプリを選べます。</p>
    <div class="grid">
      <section class="tile primary">
        <h2>GREEN PARTNERSHIP 業務管理</h2>
        <p>顧問先、案件進捗、チャット相談、書類ひな形、カレンダー、月次レポートを管理します。</p>
        <div class="actions">
          <a class="button open" href="/internal/gp">GP業務管理を開く</a>
          <button type="button" onclick="window.open('/internal/gp','gpBusinessManagement','width=1280,height=860,noopener')">別ウィンドウで開く</button>
        </div>
      </section>
      <section class="tile">
        <h2>定型文ストック</h2>
        <p>社内共有の定型文を検索・追加・編集し、自然な日本語文をすぐ使える形にします。</p>
        <div class="actions">
          <a class="button open" href="/phrase-stock/">定型文ストックを開く</a>
          <button type="button" onclick="window.open('/phrase-stock/','phraseStock','width=1280,height=860,noopener')">別ウィンドウで開く</button>
        </div>
      </section>
      <section class="tile">
        <h2>統合メニュー</h2>
        <p>補助金検索、ヒアリング、説明変換、タスク管理の入口へ戻ります。</p>
        <div class="actions">
          <a class="button" href="/internal">統合メニューを開く</a>
        </div>
      </section>
    </div>
    <div class="small">トップ画面からも「アプリ切替」で各アプリへ移動できます。</div>
  </main>
</body>
</html>`);
});

app.get(["/internal", "/internal/"], (_req, res) => {
  res.type("html").send(renderInternalHub());
});

app.get(["/internal/gp", "/internal/gp/", "/gp", "/gp/", "/GP業務管理.html"], async (_req, res) => {
  try {
    const html = await fs.promises.readFile(GP_APP_FILE, "utf8");
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(html);
  } catch (error) {
    console.error(error);
    res.status(500).type("text/plain").send("GP業務管理を読み込めませんでした。");
  }
});

app.get(["/internal/hearing", "/internal/hearing/"], (_req, res) => {
  res.redirect(302, "/internal/hearing/company");
});

app.get(["/internal/hearing/company", "/internal/hearing/personal"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "internal", "hearing", "index.html"));
});

app.get("/internal/hearing/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.write(": connected\n\n");
  hearingEventClients.add(res);
  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 25_000);
  req.on("close", () => {
    clearInterval(keepAlive);
    hearingEventClients.delete(res);
  });
});

app.get("/internal/hearing/api/cases", async (req, res) => {
  try {
    const cases = await listHearingCases({ mode: req.query.mode, query: req.query.q });
    res.json({
      ok: true,
      cases: cases.map(hearingCaseSummary),
      storage: pgPool ? "postgres" : "file"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "共有データを読み込めませんでした。" });
  }
});

app.post("/internal/hearing/api/cases", async (req, res) => {
  try {
    const record = await saveNewHearingCase(req.body || {});
    publishHearingCasesChanged(record);
    res.status(201).json({ ok: true, case: record, storage: pgPool ? "postgres" : "file" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "共有データを保存できませんでした。" });
  }
});

app.get("/internal/hearing/api/cases/:id", async (req, res) => {
  try {
    const record = await getHearingCase(req.params.id);
    if (!record) return res.status(404).json({ ok: false, message: "共有データが見つかりません。" });
    return res.json({ ok: true, case: record, storage: pgPool ? "postgres" : "file" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "共有データを読み込めませんでした。" });
  }
});

app.put("/internal/hearing/api/cases/:id", async (req, res) => {
  try {
    const result = await updateHearingCase(req.params.id, req.body || {});
    if (result.status === "missing") return res.status(404).json({ ok: false, message: "共有データが見つかりません。" });
    if (result.status === "conflict") {
      return res.status(409).json({
        ok: false,
        message: "他の方が先に保存しています。最新の共有データを読み込んでください。",
        case: result.case
      });
    }
    publishHearingCasesChanged(result.case);
    return res.json({ ok: true, case: result.case, storage: pgPool ? "postgres" : "file" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "共有データを保存できませんでした。" });
  }
});

app.get(/^\/tasks$/, (_req, res) => {
  res.redirect(302, "/tasks/");
});

app.get("/api/tasks", async (_req, res) => {
  try {
    const store = await readTaskStore();
    res.json({ ok: true, ...store, storage: pgPool ? "postgres" : "file" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "タスクを読み込めませんでした。" });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const task = normalizeTask({ ...req.body, id: crypto.randomUUID(), createdAt: Date.now() });
    if (pgPool) {
      await ensureTaskStore();
      await pgPool.query(
        "INSERT INTO shared_tasks (id, payload, updated_at) VALUES ($1, $2::jsonb, now())",
        [task.id, JSON.stringify(task)]
      );
      const store = await readTaskStore();
      return res.status(201).json({ ok: true, ...store, storage: "postgres" });
    }
    const store = await mutateTaskStore((tasks) => [...tasks, task]);
    res.status(201).json({ ok: true, ...store, storage: "file" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "タスクを保存できませんでした。" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const id = cleanTaskText(req.params.id, 120);
    if (pgPool) {
      await ensureTaskStore();
      const current = await pgPool.query("SELECT payload FROM shared_tasks WHERE id = $1", [id]);
      if (!current.rowCount) return res.status(404).json({ ok: false, message: "タスクが見つかりません。" });
      const task = normalizeTask({ ...current.rows[0].payload, ...req.body, id, createdAt: current.rows[0].payload.createdAt });
      await pgPool.query("UPDATE shared_tasks SET payload = $2::jsonb, updated_at = now() WHERE id = $1", [id, JSON.stringify(task)]);
      const store = await readTaskStore();
      return res.json({ ok: true, ...store, storage: "postgres" });
    }
    const store = await mutateTaskStore((tasks) => {
      const index = tasks.findIndex((task) => task.id === id);
      if (index === -1) return null;
      const next = [...tasks];
      next[index] = normalizeTask({ ...next[index], ...req.body, id, createdAt: next[index].createdAt });
      return next;
    });
    if (!store) return res.status(404).json({ ok: false, message: "タスクが見つかりません。" });
    res.json({ ok: true, ...store, storage: "file" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "タスクを更新できませんでした。" });
  }
});

app.post("/api/tasks/:id/toggle", async (req, res) => {
  try {
    const id = cleanTaskText(req.params.id, 120);
    if (pgPool) {
      await ensureTaskStore();
      const current = await pgPool.query("SELECT payload FROM shared_tasks WHERE id = $1", [id]);
      if (!current.rowCount) return res.status(404).json({ ok: false, message: "タスクが見つかりません。" });
      const task = normalizeTask({ ...current.rows[0].payload, done: !current.rows[0].payload.done });
      await pgPool.query("UPDATE shared_tasks SET payload = $2::jsonb, updated_at = now() WHERE id = $1", [id, JSON.stringify(task)]);
      const store = await readTaskStore();
      return res.json({ ok: true, ...store, storage: "postgres" });
    }
    const store = await mutateTaskStore((tasks) => {
      const index = tasks.findIndex((task) => task.id === id);
      if (index === -1) return null;
      const next = [...tasks];
      next[index] = normalizeTask({ ...next[index], done: !next[index].done });
      return next;
    });
    if (!store) return res.status(404).json({ ok: false, message: "タスクが見つかりません。" });
    res.json({ ok: true, ...store, storage: "file" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "タスクを更新できませんでした。" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const id = cleanTaskText(req.params.id, 120);
    if (pgPool) {
      await ensureTaskStore();
      const result = await pgPool.query("DELETE FROM shared_tasks WHERE id = $1", [id]);
      if (!result.rowCount) return res.status(404).json({ ok: false, message: "タスクが見つかりません。" });
      const store = await readTaskStore();
      return res.json({ ok: true, ...store, storage: "postgres" });
    }
    const store = await mutateTaskStore((tasks) => {
      const next = tasks.filter((task) => task.id !== id);
      return next.length === tasks.length ? null : next;
    });
    if (!store) return res.status(404).json({ ok: false, message: "タスクが見つかりません。" });
    res.json({ ok: true, ...store, storage: "file" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "タスクを削除できませんでした。" });
  }
});

app.get("/explanation/api/health", (req, res) => {
  res.json({
    app: "explanation-converter",
    version: "1.0.0",
    ok: true,
    mode: PUBLIC_ACCESS ? "cloud" : "local",
    authRequired: AUTH_REQUIRED,
    authenticated: Boolean(getValidSession(req)),
    sharedDrafts: true,
    storage: pgPool ? "postgres" : "file"
  });
});

app.post("/explanation/api/transform", (req, res) => {
  try {
    res.json(transformMemo(req.body || {}));
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "transform_failed" });
  }
});

app.get("/explanation/api/drafts", async (_req, res) => {
  try {
    if (!pgPool) {
      const drafts = await readExplanationDraftFile();
      return res.json({ ok: true, shared: true, storage: "file", drafts });
    }
    await ensureExplanationDraftStore();
    const result = await pgPool.query(
      "SELECT id, payload, created_at FROM explanation_drafts ORDER BY created_at DESC LIMIT 50"
    );
    const drafts = result.rows.map((row) => normalizeExplanationDraft({
      id: row.id,
      ...row.payload,
      createdAt: row.payload?.createdAt || new Date(row.created_at).toISOString()
    }));
    res.json({ ok: true, shared: true, drafts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "下書きを読み込めませんでした。" });
  }
});

app.post("/explanation/api/drafts", async (req, res) => {
  try {
    const draft = normalizeExplanationDraft(req.body || {});
    if (!pgPool) {
      await mutateExplanationDraftFile((drafts) => [draft, ...drafts.filter((item) => item.id !== draft.id)]);
      return res.status(201).json({ ok: true, shared: true, storage: "file", draft });
    }
    await ensureExplanationDraftStore();
    await pgPool.query(
      `INSERT INTO explanation_drafts (id, payload, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (id) DO UPDATE SET payload = $2::jsonb, updated_at = now()`,
      [draft.id, JSON.stringify(draft), draft.createdAt]
    );
    res.status(201).json({ ok: true, shared: true, draft });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "下書きを保存できませんでした。" });
  }
});

app.delete("/explanation/api/drafts/:id", async (req, res) => {
  try {
    const id = cleanTaskText(req.params.id, 120);
    if (!pgPool) {
      await mutateExplanationDraftFile((drafts) => drafts.filter((draft) => draft.id !== id));
      return res.json({ ok: true, shared: true, storage: "file" });
    }
    await ensureExplanationDraftStore();
    await pgPool.query("DELETE FROM explanation_drafts WHERE id = $1", [id]);
    res.json({ ok: true, shared: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "下書きを削除できませんでした。" });
  }
});

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

      CREATE TABLE IF NOT EXISTS gp_shared_store (
        id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        updated_at TIMESTAMPTZ,
        data JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gp_shared_backups (
        id BIGSERIAL PRIMARY KEY,
        revision INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data JSONB NOT NULL
      );
    `);
    await dbPool.query(
      "INSERT INTO gp_shared_store (id, revision, updated_at, data) VALUES ($1, 0, NULL, $2::jsonb) ON CONFLICT (id) DO NOTHING",
      ["main", JSON.stringify({ clients: [], staff: [], cases: [], chats: [], templates: {} })]
    );
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

const defaultGpStore = () => ({ clients: [], staff: [], cases: [], chats: [], templates: {} });

const normalizeGpStore = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("shared data must be an object");
  const normalized = {
    clients: Array.isArray(data.clients) ? data.clients : [],
    staff: Array.isArray(data.staff) ? data.staff : [],
    cases: Array.isArray(data.cases) ? data.cases : [],
    chats: Array.isArray(data.chats) ? data.chats : [],
    templates: data.templates && typeof data.templates === "object" && !Array.isArray(data.templates) ? data.templates : {}
  };
  if (Buffer.byteLength(JSON.stringify(normalized), "utf8") > GP_SHARED_DATA_LIMIT) {
    throw new Error("shared data is too large");
  }
  return normalized;
};

const readGpEnvelope = async () => {
  if (!dbPool) {
    const parsed = await readJsonFile(GP_STORE_FILE, null);
    if (!parsed) {
      return { revision: 0, updatedAt: null, data: defaultGpStore() };
    }
    return {
      revision: Number(parsed.revision) || 0,
      updatedAt: parsed.updatedAt || null,
      data: normalizeGpStore(parsed.data || defaultGpStore())
    };
  }
  const pool = await ensureDbReady();
  const { rows } = await pool.query("SELECT revision, updated_at, data FROM gp_shared_store WHERE id = $1", ["main"]);
  if (!rows.length) {
    await pool.query(
      "INSERT INTO gp_shared_store (id, revision, updated_at, data) VALUES ($1, 0, NULL, $2::jsonb) ON CONFLICT (id) DO NOTHING",
      ["main", JSON.stringify(defaultGpStore())]
    );
    return { revision: 0, updatedAt: null, data: defaultGpStore() };
  }
  const row = rows[0];
  return {
    revision: Number(row.revision) || 0,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    data: row.data && typeof row.data === "object" ? row.data : defaultGpStore()
  };
};

const backupGpEnvelope = async (envelope) => {
  if (!dbPool) {
    try {
      const parsed = await readJsonFile(GP_BACKUPS_FILE, { backups: [] });
      const backups = Array.isArray(parsed.backups) ? parsed.backups : [];
      backups.unshift({
        revision: Number(envelope.revision) || 0,
        createdAt: new Date().toISOString(),
        data: normalizeGpStore(envelope.data || defaultGpStore())
      });
      await writeJsonFile(GP_BACKUPS_FILE, { backups: backups.slice(0, 30) });
    } catch (e) {
      console.warn("[file-store] GP backup skipped:", e.message);
    }
    return;
  }
  try {
    const pool = await ensureDbReady();
    await pool.query(
      "INSERT INTO gp_shared_backups (revision, data) VALUES ($1, $2::jsonb)",
      [envelope.revision || 0, JSON.stringify(envelope.data || defaultGpStore())]
    );
    await pool.query(`
      DELETE FROM gp_shared_backups
      WHERE id NOT IN (
        SELECT id FROM gp_shared_backups ORDER BY id DESC LIMIT 30
      )
    `);
  } catch (e) {
    console.warn("[db] GP backup skipped:", e.message);
  }
};

const dbText = (value, maxLength = 500) => cleanInput(value, "", maxLength);

const normalizeHistoryRow = (row = {}) => ({
  id: Number.isSafeInteger(Number(row.id)) ? Number(row.id) : Date.now(),
  created_at: row.created_at || row.createdAt || new Date().toISOString(),
  keyword: dbText(row.keyword, 120),
  prefecture: dbText(row.prefecture, 40),
  municipality: dbText(row.municipality, 120),
  theme: dbText(row.theme, 120),
  industry: dbText(row.industry, 120),
  employees: dbText(row.employees, 40),
  entity: dbText(row.entity, 80),
  result_count: Math.max(0, Number(row.result_count ?? row.resultCount) || 0),
  source: dbText(row.source || "jgrants", 40)
});

const normalizeSavedSubsidyRow = (item = {}, id = null) => ({
  id: Number.isSafeInteger(Number(id ?? item.id)) ? Number(id ?? item.id) : Date.now(),
  created_at: item.created_at || item.createdAt || new Date().toISOString(),
  updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
  subsidy_id: dbText(item.subsidy_id || item.id, 120),
  title: dbText(item.title || item.subsidy_name || item.name, 500),
  issuer: dbText(item.issuer, 300),
  target_area: dbText(item.target_area, 300),
  acceptance_start: dbText(item.acceptance_start, 80),
  acceptance_end: dbText(item.acceptance_end, 80),
  subsidy_min_limit: dbText(item.subsidy_min_limit, 80),
  subsidy_max_limit: dbText(item.subsidy_max_limit, 80),
  subsidy_rate: dbText(item.subsidy_rate, 300),
  use_purpose: dbText(item.use_purpose, 2500),
  detail_url: dbText(item.detail_url || item.front_subsidy_detail_page_url, 1000),
  source_url: dbText(item.source_url || item.official_source_url, 1000),
  note: dbText(item.note, 1000)
});

const readSharedFileStore = async () => {
  const [historyStore, savedStore] = await Promise.all([
    readJsonFile(SHARED_HISTORY_FILE, { history: [], lastId: 0 }),
    readJsonFile(SAVED_SUBSIDIES_FILE, { items: [], lastId: 0 })
  ]);
  return {
    history: Array.isArray(historyStore.history) ? historyStore.history.map(normalizeHistoryRow) : [],
    historyLastId: Number(historyStore.lastId) || 0,
    items: Array.isArray(savedStore.items) ? savedStore.items.map((item) => normalizeSavedSubsidyRow(item, item.id)) : [],
    savedLastId: Number(savedStore.lastId) || 0
  };
};

const writeSharedFileStore = async (store) => {
  await Promise.all([
    writeJsonFile(SHARED_HISTORY_FILE, {
      lastId: store.historyLastId || 0,
      history: (store.history || [])
        .map(normalizeHistoryRow)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 200)
    }),
    writeJsonFile(SAVED_SUBSIDIES_FILE, {
      lastId: store.savedLastId || 0,
      items: (store.items || [])
        .map((item) => normalizeSavedSubsidyRow(item, item.id))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 500)
    })
  ]);
  return store;
};

const mutateSharedFileStore = async (work) => {
  const run = sharedDataFileQueue.then(async () => {
    const store = await readSharedFileStore();
    const nextStore = await work(store);
    return writeSharedFileStore(nextStore || store);
  });
  sharedDataFileQueue = run.catch(() => {});
  return run;
};

const recordSearchHistory = async (query, resultCount) => {
  if (!dbPool) {
    try {
      await mutateSharedFileStore((store) => {
        const nextId = Math.max(store.historyLastId || 0, ...store.history.map((row) => Number(row.id) || 0)) + 1;
        store.historyLastId = nextId;
        store.history.unshift(normalizeHistoryRow({
          id: nextId,
          keyword: query.keyword,
          prefecture: query.prefecture,
          municipality: query.municipality,
          theme: query.theme,
          industry: query.industry,
          employees: query.employees,
          entity: query.entity,
          result_count: resultCount,
          source: "jgrants"
        }));
        store.history = store.history.slice(0, 200);
        return store;
      });
    } catch (e) {
      console.warn("[file-store] search history skipped:", e.message);
    }
    return;
  }
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
  if (!dbPool) return res.json({ ok: true, enabled: true, ready: true, storage: "file" });
  try {
    await ensureDbReady();
  } catch {
    // Keep the main app available even when the shared DB is temporarily unavailable.
  }
  res.json({
    ok: true,
    enabled: true,
    ready: dbStatus.ready,
    storage: "postgres",
    error: dbStatus.ready ? "" : dbStatus.error
  });
});

app.get("/api/store", async (_req, res) => {
  try {
    const envelope = await readGpEnvelope();
    res.json({ ok: true, storage: dbPool ? "postgres" : "file", ...envelope });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

app.put("/api/store", async (req, res) => {
  try {
    const payload = req.body || {};
    const expected = Number(payload.revision || 0);
    const force = payload.force === true;
    const current = dbPool ? await readGpEnvelope() : await gpFileQueue.then(() => readGpEnvelope());
    if (!force && expected !== current.revision) {
      return res.status(409).json({ ok: false, error: "revision conflict", ...current });
    }
    const next = {
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      data: normalizeGpStore(payload.data)
    };
    if (!dbPool) {
      const run = gpFileQueue.then(async () => {
        const latest = await readGpEnvelope();
        if (!force && expected !== latest.revision) {
          return { conflict: true, latest };
        }
        const fileNext = {
          revision: latest.revision + 1,
          updatedAt: new Date().toISOString(),
          data: normalizeGpStore(payload.data)
        };
        await backupGpEnvelope(latest);
        await writeJsonFile(GP_STORE_FILE, fileNext);
        return { next: fileNext };
      });
      gpFileQueue = run.catch(() => {});
      const fileResult = await run;
      if (fileResult.conflict) {
        return res.status(409).json({ ok: false, error: "revision conflict", ...fileResult.latest });
      }
      return res.json({ ok: true, storage: "file", ...fileResult.next });
    }
    await backupGpEnvelope(current);
    const pool = await ensureDbReady();
    const { rowCount } = await pool.query(
      `UPDATE gp_shared_store
       SET revision = $2, updated_at = $3, data = $4::jsonb
       WHERE id = $1 AND ($5::boolean OR revision = $6)`,
      ["main", next.revision, next.updatedAt, JSON.stringify(next.data), force, current.revision]
    );
    if (!rowCount) {
      const latest = await readGpEnvelope();
      return res.status(409).json({ ok: false, error: "revision conflict", ...latest });
    }
    res.json({ ok: true, ...next });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get("/api/shared/history", async (req, res) => {
  if (!dbPool) {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const store = await readSharedFileStore();
    return res.json({
      ok: true,
      enabled: true,
      storage: "file",
      history: store.history
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit)
    });
  }
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
  if (!dbPool) {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const store = await readSharedFileStore();
    return res.json({
      ok: true,
      enabled: true,
      storage: "file",
      items: store.items
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, limit)
    });
  }
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
  try {
    const item = req.body?.item || req.body || {};
    const subsidyId = dbText(item.id || item.subsidy_id, 120);
    const title = dbText(item.subsidy_name || item.title || item.name, 500);
    if (!subsidyId || !title) return res.status(400).json({ ok: false, error: "Invalid subsidy item." });

    if (!dbPool) {
      let savedItem = null;
      await mutateSharedFileStore((store) => {
        const now = new Date().toISOString();
        const existing = store.items.find((candidate) => candidate.subsidy_id === subsidyId);
        const nextId = existing?.id || Math.max(store.savedLastId || 0, ...store.items.map((row) => Number(row.id) || 0)) + 1;
        store.savedLastId = Math.max(store.savedLastId || 0, nextId);
        savedItem = normalizeSavedSubsidyRow({
          ...item,
          id: nextId,
          subsidy_id: subsidyId,
          title,
          created_at: existing?.created_at || now,
          updated_at: now
        }, nextId);
        store.items = [savedItem, ...store.items.filter((candidate) => candidate.subsidy_id !== subsidyId)];
        return store;
      });
      return res.json({ ok: true, enabled: true, storage: "file", item: savedItem });
    }

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
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ ok: false, error: "Invalid saved item id." });
  if (!dbPool) {
    let deleted = 0;
    await mutateSharedFileStore((store) => {
      const before = store.items.length;
      store.items = store.items.filter((item) => Number(item.id) !== id);
      deleted = before - store.items.length;
      return store;
    });
    return res.json({ ok: true, storage: "file", deleted });
  }
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
    shared_storage: {
      enabled: true,
      type: dbPool ? "postgres" : "file",
      data_dir: APP_DATA_DIR
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

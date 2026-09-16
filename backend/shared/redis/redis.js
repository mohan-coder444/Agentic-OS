import { Redis } from "ioredis";

// Session store used for the Redis-backed auth session (Hour 2, Part C).
// If REDIS_URL is set we use a real Redis instance; otherwise we fall back to
// an in-memory Map so the app still runs locally without Docker. The in-memory
// store is per-process and lost on restart — fine for dev, not for production.
//
// Lazy init() so we read REDIS_URL AFTER dotenv has loaded (ESM import hoisting
// would otherwise evaluate it before the auth service's dotenv.config() call).
let client = null;
let useMemory = false;
let initialized = false;
const memory = new Map(); // key -> { value, expiresAt }
const counters = new Map(); // key -> { count, expiresAt } — for rate-limit fallback

function init() {
  if (initialized) return;
  initialized = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    useMemory = true;
    console.warn(
      "[session] REDIS_URL not set — using in-memory store (dev only; not shared across restarts)"
    );
    return;
  }

  client = new Redis(url);
  client.on("error", (err) => {
    console.warn("[session] Redis error, falling back to in-memory store:", err.message);
    useMemory = true;
  });
  client.on("connect", () => console.log("[session] Redis connected"));
}

export async function setSession(key, value, ttlSeconds) {
  init();
  const json = JSON.stringify(value);
  if (useMemory || !client) {
    memory.set(key, { value: json, expiresAt: Date.now() + ttlSeconds * 1000 });
    return "OK";
  }
  return client.set(key, json, "EX", ttlSeconds);
}

export async function getSession(key) {
  init();
  if (useMemory || !client) {
    const entry = memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      memory.delete(key);
      return null;
    }
    return JSON.parse(entry.value);
  }
  const raw = await client.get(key);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteSession(key) {
  init();
  if (useMemory || !client) {
    memory.delete(key);
    return 1;
  }
  return client.del(key);
}

// Increment a counter and set TTL on first hit. Used for per-user rate limiting.
// Returns the new count. Works with the in-memory fallback so dev works without Redis.
export async function incrCounter(key, ttlSeconds) {
  init();
  if (useMemory || !client) {
    const now = Date.now();
    const entry = counters.get(key);
    if (!entry || (entry.expiresAt && entry.expiresAt < now)) {
      counters.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
  const count = await client.incr(key);
  if (count === 1) await client.expire(key, ttlSeconds);
  return count;
}

// Seconds remaining on a key's TTL (used to tell the user when to retry).
export async function ttlSeconds(key) {
  init();
  if (useMemory || !client) {
    const entry = counters.get(key);
    if (!entry) return -2;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
  return client.ttl(key);
}

export default { setSession, getSession, deleteSession, incrCounter, ttlSeconds };

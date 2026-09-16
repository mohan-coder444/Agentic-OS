import redis from "../../../shared/redis/redis.js";

// Per-user per-agent rate limits (requests per 60s window).
// Chat is generous; generation endpoints are tighter because they hit paid LLMs/S3.
// Tune these to your budget — they protect OpenRouter credits from a runaway user.
export const limits = {
  chat: 20,
  search: 5,
  coding: 5,
  pdf: 5,
  ppt: 5,
  image: 5,
  "pdf-rag": 10,
  "image-analyzer": 10,
};

const WINDOW_SECONDS = 60;

/**
 * Throws a rate-limit error when the user has exceeded the per-minute allowance
 * for the given agent. Otherwise records the hit and returns { count, max, resetIn }.
 *
 * Key shape: `ratelimit:{agent}:{userId}` — one counter per (user, agent) pair.
 */
export async function checkAgentLimit(agent, userId) {
  if (!userId) return { count: 0, max: 0, resetIn: 0 };
  const normalized = agent || "chat";
  const max = limits[normalized] ?? limits.chat;
  const key = `ratelimit:${normalized}:${userId}`;

  const count = await redis.incrCounter(key, WINDOW_SECONDS);
  if (count > max) {
    const resetIn = await redis.ttlSeconds(key);
    const wait = resetIn > 0 ? resetIn : WINDOW_SECONDS;
    const err = new Error(
      `Rate limit exceeded for ${normalized}: ${max} requests per minute. Try again in ${wait}s.`
    );
    err.status = 429;
    err.resetIn = wait;
    err.agent = normalized;
    err.limit = max;
    throw err;
  }
  const resetIn = await redis.ttlSeconds(key);
  return { count, max, resetIn: resetIn > 0 ? resetIn : WINDOW_SECONDS };
}

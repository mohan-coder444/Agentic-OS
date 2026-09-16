import redis from "../../../shared/redis/redis.js";
import axios from "axios";

export const getMemory = async (conversationId, userId) => {
  if (!conversationId) return [];
  const key = `conversation:${conversationId}`;
  try {
    const cached = await redis.getSession(key);
    if (cached) {
      if (Array.isArray(cached)) return cached;
      if (typeof cached === "string") return JSON.parse(cached);
      return cached;
    }
  } catch {}
  let messages = [];
  if (userId) {
    try {
      const res = await axios.get(`${process.env.CHAT_SERVICE_URL}/conversations/${conversationId}/messages`, {
        headers: { "x-user-id": userId },
      });
      messages = res.data.messages?.map((m) => ({ role: m.role, content: m.content })) || [];
      if (messages.length > 20) messages = messages.slice(-20);
    } catch (e) {
      console.warn("getMemory fetch failed:", e.message);
    }
  }
  try {
    await redis.setSession(key, messages, 86400);
  } catch {}
  return messages;
};

export const addMessage = async (conversationId, role, content) => {
  if (!conversationId) return;
  const key = `conversation:${conversationId}`;
  let messages = [];
  try {
    const cached = await redis.getSession(key);
    if (cached) {
      messages = Array.isArray(cached) ? cached : JSON.parse(cached);
    }
  } catch {
    messages = [];
  }
  messages.push({ role, content });
  if (messages.length > 20) messages.shift();
  try {
    await redis.setSession(key, messages, 86400);
  } catch (e) {
    console.warn("addMessage set failed:", e.message);
  }
};

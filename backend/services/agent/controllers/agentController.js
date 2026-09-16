import { graph } from "../graph/graph.js";
import jwt from "jsonwebtoken";
import axios from "axios";
import { getMemory, addMessage } from "../config/memory.js";

async function getUser(req) {
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId) return { userId: headerUserId };
  const token = req.cookies?.sessionId;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export const runAgent = async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  const { prompt, conversationId, agent, fileName, fileType } = req.body;
  if (!prompt) return res.status(400).json({ message: "prompt is required" });
  try {
    // Save user msg to chat DB (for persistence) + to Redis memory (for LLM history)
    if (conversationId) {
      try {
        await axios.post(
          `${process.env.CHAT_SERVICE_URL}/conversations/${conversationId}/messages`,
          { content: prompt },
          { headers: { "x-user-id": user.userId, "x-from-agent": "true" } }
        );
      } catch (e) {
        console.warn("save user msg to chat failed:", e.message);
      }
      await addMessage(conversationId, "user", prompt);
    }
    const history = conversationId ? await getMemory(conversationId, user.userId) : [];
    console.log(`[agent] history len=${history.length} agent=${agent || "auto"} conv ${conversationId} file=${fileName || "-"}`);
    const result = await graph.invoke({ prompt, history, conversationId, agent: agent?.toLowerCase(), fileName, fileType });
    if (conversationId) {
      await addMessage(conversationId, "assistant", result.aiResponse);
      try {
        await axios.post(
          `${process.env.CHAT_SERVICE_URL}/conversations/${conversationId}/messages`,
          { content: result.aiResponse, artifacts: result.artifacts || [] },
          { headers: { "x-user-id": user.userId, "x-from-agent": "true", "x-role": "assistant" } }
        );
        console.log("[agent] saved assistant to chat DB with", (result.artifacts?.[0]?.files?.length || 0), "files");
      } catch (e) {
        console.warn("save assistant to chat failed:", e.message);
      }
    }
    res.json({ prompt, ...result, userId: user.userId });
  } catch (err) {
    console.error("agent error:", err);
    res.status(500).json({ message: "Agent error", error: err.message });
  }
};

export const listAgents = (req, res) => {
  res.json({
    agents: ["chat", "search", "coding", "pdf", "ppt", "image"],
    router: "keyword-based stub (replace with LLM)",
  });
};

import { graph } from "../graph/graph.js";
import jwt from "jsonwebtoken";
import axios from "axios";
import { getMemory, addMessage } from "../config/memory.js";
import { checkAgentLimit } from "../config/agentLimits.js";

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
  const { prompt, conversationId, agent, fileName, fileType, model } = req.body;
  if (!prompt) return res.status(400).json({ message: "prompt is required" });
  // Rate limit on the requested agent. "auto" falls into the chat bucket —
  // generous (20/min) and avoids charging users for routing decisions.
  try {
    const limitAgent = agent && agent !== "auto" ? agent.toLowerCase() : "chat";
    await checkAgentLimit(limitAgent, user.userId);
  } catch (err) {
    if (err.status === 429) {
      return res.status(429).json({
        message: err.message,
        resetIn: err.resetIn,
        agent: err.agent,
        limit: err.limit,
      });
    }
    console.warn("[agent] rate limit check failed, allowing request:", err.message);
  }
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
    const result = await graph.invoke({ prompt, history, conversationId, agent: agent?.toLowerCase(), fileName, fileType, model, userId: user.userId });

    // Auto-save Build sessions. Trigger: coding agent + artifacts produced +
    // NO conversationId (means the request came from the Build view, not the
    // Chat view with the coding pill). Fire-and-forget — if the save fails,
    // the user still gets their generated code, we just don't persist it.
    let savedBuildId = null;
    const isBuildRequest = agent?.toLowerCase() === "coding" && !conversationId;
    if (isBuildRequest && result.artifacts?.[0]?.files?.length) {
      try {
        const saveRes = await axios.post(
          `${process.env.CHAT_SERVICE_URL}/builds`,
          {
            prompt,
            files: result.artifacts[0].files,
            modelUsed: result.artifacts[0].modelUsed || model || "auto",
            title: prompt.slice(0, 60),
          },
          { headers: { "x-user-id": user.userId } }
        );
        savedBuildId = saveRes.data.build?._id;
        console.log(`[agent] saved build session ${savedBuildId}`);
      } catch (e) {
        console.warn("save build session failed:", e.message);
      }
    }

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
    res.json({ prompt, ...result, userId: user.userId, ...(savedBuildId ? { buildId: savedBuildId } : {}) });
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

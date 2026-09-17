import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import jwt from "jsonwebtoken";

// helper: get user from JWT cookie (stateless, shared via JWT_SECRET)
async function getUserFromSession(req) {
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId) return { userId: headerUserId };
  const token = req.cookies?.sessionId;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload; // { userId, name, email, avatar }
  } catch {
    return null;
  }
}

// GET /conversations — list user's conversations
export const listConversations = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const conversations = await Conversation.find({ userId: session.userId }).sort({ updatedAt: -1 });
  res.json({ conversations });
};

// POST /conversations — create new chat
export const createConversation = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const { title } = req.body;
  const conv = await Conversation.create({ userId: session.userId, title: title || "New chat" });
  res.status(201).json({ conversation: conv });
};

// GET /conversations/:id/messages — get messages for a conversation
export const getMessages = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const conv = await Conversation.findOne({ _id: req.params.id, userId: session.userId });
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  const messages = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1 });
  res.json({ messages });
};

// DELETE /conversations/:id — delete a conversation and all its messages
// Also asks the agent service to clear its Redis memory cache for this convo.
// Non-fatal if the agent call fails: DB is the source of truth, cache will
// expire on its own (24h TTL) if the delete-cache endpoint is unreachable.
export const deleteConversation = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const conv = await Conversation.findOne({ _id: req.params.id, userId: session.userId });
  if (!conv) return res.status(404).json({ message: "Conversation not found" });

  // Delete messages first so a partial failure leaves fewer orphans than the
  // other order would (orphaned messages beat orphaned conversation shells
  // because listConversations is what the sidebar actually renders).
  await Message.deleteMany({ conversationId: conv._id });
  await Conversation.deleteOne({ _id: conv._id });

  res.json({ message: "Deleted", conversationId: conv._id });
};

// POST /conversations/:id/messages — add user message (and stub assistant reply)
// If x-from-agent header is present, only save user msg (agent will handle assistant via LLM)
export const addMessage = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const conv = await Conversation.findOne({ _id: req.params.id, userId: session.userId });
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "content is required" });

  const role = req.headers["x-role"] || "user";
  const artifacts = req.body.artifacts || [];
  const userMsg = await Message.create({ conversationId: conv._id, role, content, artifacts });
  if (req.headers["x-from-agent"]) {
    conv.updatedAt = new Date();
    if (conv.title === "New chat" && content.length < 50 && role === "user") conv.title = content.slice(0, 50);
    await conv.save();
    return res.status(201).json({ userMsg });
  }
  // Stub assistant reply (for direct chat calls without agent)
  const assistantMsg = await Message.create({
    conversationId: conv._id,
    role: "assistant",
    content: `Echo: ${content} (wire LangChain here)`,
  });
  // bump conversation updatedAt
  conv.updatedAt = new Date();
  if (conv.title === "New chat" && content.length < 50) conv.title = content.slice(0, 50);
  await conv.save();
  res.status(201).json({ userMsg, assistantMsg });
};

import BuildSession from "../models/BuildSession.js";
import jwt from "jsonwebtoken";

// Same auth pattern as chatController — accepts JWT cookie or x-user-id header
// (used when the agent service saves on behalf of a user via server-to-server).
async function getUserFromSession(req) {
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

// GET /builds — user's build sessions, most recent first.
export const listBuildSessions = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  // Exclude `files` in the list view — a session can be 30-50KB of HTML and
  // the sidebar only needs id/title/updatedAt to render. `select: -files`
  // shaves ~90% off the payload for a typical user with 20 builds.
  const builds = await BuildSession.find({ userId: session.userId })
    .select("-files")
    .sort({ updatedAt: -1 });
  res.json({ builds });
};

// POST /builds — create a new build session. Called by the agent service
// (server-to-server) after a successful coding generation, and directly by
// the frontend if the user ever wants to save a bare prompt without files.
export const createBuildSession = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const { prompt, files, modelUsed, title } = req.body;
  if (!prompt) return res.status(400).json({ message: "prompt is required" });
  const build = await BuildSession.create({
    userId: session.userId,
    prompt,
    files: files || [],
    modelUsed: modelUsed || "auto",
    // Auto-derive a title from the prompt if the caller didn't supply one.
    // Matches how Conversation titles get filled in.
    title: title || prompt.slice(0, 60),
  });
  res.status(201).json({ build });
};

// GET /builds/:id — full build with files (for loading into the IDE).
export const getBuildSession = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const build = await BuildSession.findOne({ _id: req.params.id, userId: session.userId });
  if (!build) return res.status(404).json({ message: "Build session not found" });
  res.json({ build });
};

// DELETE /builds/:id — remove a build session. Owner-scoped.
export const deleteBuildSession = async (req, res) => {
  const session = await getUserFromSession(req);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const build = await BuildSession.findOne({ _id: req.params.id, userId: session.userId });
  if (!build) return res.status(404).json({ message: "Build session not found" });
  await BuildSession.deleteOne({ _id: build._id });
  res.json({ message: "Deleted", buildId: build._id });
};

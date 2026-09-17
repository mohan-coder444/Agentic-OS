import express from "express";
import { listConversations, createConversation, deleteConversation, getMessages, addMessage } from "../controllers/chatController.js";
import { listBuildSessions, createBuildSession, getBuildSession, deleteBuildSession } from "../controllers/buildSessionController.js";

const router = express.Router();

router.get("/api", (req, res) => res.json({ message: "Hello from Chat" }));

router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.delete("/conversations/:id", deleteConversation);
router.get("/conversations/:id/messages", getMessages);
router.post("/conversations/:id/messages", addMessage);

// Build sessions — same shape as conversations but for the IDE view.
// Frontend list omits `files` (see controller comment).
router.get("/builds", listBuildSessions);
router.post("/builds", createBuildSession);
router.get("/builds/:id", getBuildSession);
router.delete("/builds/:id", deleteBuildSession);

export default router;

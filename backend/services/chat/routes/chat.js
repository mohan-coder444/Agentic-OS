import express from "express";
import { listConversations, createConversation, deleteConversation, getMessages, addMessage } from "../controllers/chatController.js";

const router = express.Router();

router.get("/api", (req, res) => res.json({ message: "Hello from Chat" }));

router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.delete("/conversations/:id", deleteConversation);
router.get("/conversations/:id/messages", getMessages);
router.post("/conversations/:id/messages", addMessage);

export default router;

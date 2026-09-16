import express from "express";
import { googleLogin, logout, me } from "../controllers/authController.js";

const router = express.Router();

// Sanity check (reachable via gateway at /auth/api)
router.get("/api", (req, res) => {
  res.json({ message: "Hello from Auth" });
});

// Google sign-in: frontend sends { idToken } from "Continue with Google"
router.post("/google", googleLogin);

// Session management (cookie + Redis)
router.post("/logout", logout);
router.get("/me", me);

export default router;

import { admin, getAuth } from "../config/firebase.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days, in seconds

// POST /google  (reachable as /auth/google through the gateway)
// Body: { idToken }  — the Google ID token from "Continue with Google" on the frontend
export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    // Verify the Google ID token using Firebase Admin (proves it's a real Google user)
    const decoded = await getAuth(admin).verifyIdToken(idToken);
    const { uid, email, name, picture } = decoded;

    // Find existing user, or create a new one (Google-only auth -> no password)
    let user = await User.findOne({ firebaseUID: uid });
    if (!user) {
      user = await User.create({
        firebaseUID: uid,
        email: email || "",
        name: name || "",
        avatar: picture || "",
      });
    }

    // Create JWT session (stateless, shared across microservices via same JWT_SECRET)
    const sessionJwt = jwt.sign(
      {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      process.env.JWT_SECRET,
      { expiresIn: SESSION_TTL }
    );

    res.cookie("sessionId", sessionJwt, {
      httpOnly: true,
      secure: false,
      sameSite: "lax", // allow cross-port localhost:5173 -> 8000 (strict blocks XHR)
      maxAge: SESSION_TTL * 1000,
    });

    res.status(200).json({ user });
  } catch (err) {
    console.log("googleLogin error:", err.message);
    res.status(401).json({ message: "Invalid or expired token", error: err.message });
  }
};

// POST /logout  (reachable as /auth/logout) — clears the session + cookie
export const logout = async (req, res) => {
  try {
    res.clearCookie("sessionId", { sameSite: "lax", secure: false });
    res.status(200).json({ message: "Logged out" });
  } catch (err) {
    console.log("logout error:", err.message);
    res.status(500).json({ message: "Logout failed" });
  }
};

// GET /me  (reachable as /auth/me) — returns the current user from the session cookie (JWT)
export const me = async (req, res) => {
  try {
    const token = req.cookies?.sessionId;
    if (!token) return res.status(401).json({ message: "Not authenticated" });
    const session = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({
      user: {
        _id: session.userId,
        name: session.name,
        email: session.email,
        avatar: session.avatar,
      },
    });
  } catch (err) {
    console.log("me error:", err.message);
    res.status(500).json({ message: "Session error" });
  }
};

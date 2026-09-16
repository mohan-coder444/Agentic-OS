import sessionStore from "../../shared/redis/redis.js";

export const protect = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.sessionId;
    if (!sessionId) return res.status(401).json({ message: "Not authenticated" });
    const session = await sessionStore.getSession(sessionId);
    if (!session) return res.status(401).json({ message: "Session expired" });
    req.user = session; // { userId, name, email, avatar }
    next();
  } catch (err) {
    console.error("protect error:", err.message);
    res.status(500).json({ message: "Protect error" });
  }
};

export default protect;

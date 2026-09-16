import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const port = process.env.PORT || 8000;
const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
const chatServiceUrl = process.env.CHAT_SERVICE_URL || "http://localhost:8002";
const agentServiceUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8003";

const app = express();
app.use(morgan("dev"));

// Behind Cloudflare Tunnel / any reverse proxy, trust the forwarded headers so
// req.protocol and req.ip reflect the original client instead of the proxy hop.
app.set("trust proxy", 1);

// CORS allowlist. credentials:true means we can NOT use origin:"*" — browsers
// reject a wildcard when cookies are involved, so each allowed origin must be
// echoed back explicitly.
//
// FRONTEND_URLS takes a comma-separated list so local dev and the deployed
// frontend can both be live at once:
//   FRONTEND_URLS=http://localhost:5173,https://your-app.vercel.app
// Falls back to the older single-value FRONTEND_URL when URLS is unset.
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

console.log("[gateway] CORS allowlist:", allowedOrigins.join(", "));

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: curl, health checks, server-to-server. Not a browser
      // cross-origin request, so there is nothing to guard against here.
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) return callback(null, true);
      // Deny by omission, not by throwing. Passing an Error here surfaces as a
      // confusing 500 and pollutes logs; returning false just omits the
      // Access-Control-Allow-Origin header, which is what actually makes the
      // browser block the response.
      console.warn(`[gateway] CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(cookieParser());

app.get("/api", (req,res)=>res.json({msg:"gateway"}));

app.use("/auth", proxy(authServiceUrl, { proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/auth/, "") || "/" }));
app.use("/chat", proxy(chatServiceUrl, { proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/chat/, "") || "/" }));
app.use("/agent", proxy(agentServiceUrl, { proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/agent/, "") || "/" }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.listen(port, ()=>console.log(`gateway working copy at ${port} -> auth ${authServiceUrl}`));

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
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());

app.get("/api", (req,res)=>res.json({msg:"gateway"}));

app.use("/auth", proxy(authServiceUrl, { proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/auth/, "") || "/" }));
app.use("/chat", proxy(chatServiceUrl, { proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/chat/, "") || "/" }));
app.use("/agent", proxy(agentServiceUrl, { proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/agent/, "") || "/" }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.listen(port, ()=>console.log(`gateway working copy at ${port} -> auth ${authServiceUrl}`));

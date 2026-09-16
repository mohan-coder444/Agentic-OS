import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import agentRoutes from "./routes/agent.js";
import { fileURLToPath } from "url";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const port = process.env.PORT || 8003;

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan("dev"));
app.use(cookieParser());

app.use("/", agentRoutes);

app.listen(port, () => {
  console.log(`agent started at ${port}`);
});

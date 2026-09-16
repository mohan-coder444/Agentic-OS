import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import connectDB from "./config/connectDB.js";
import "./config/firebase.js";
import authRoutes from "./routes/auth.js"; // initializes Firebase admin at startup (logs if key missing)
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const port = process.env.PORT || 8001;

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan("dev"));
app.use(cookieParser());

// Mount auth routes (gateway strips /auth, so these are reachable at /auth/*)
app.use("/", authRoutes);

app.listen(port, async () => {
  console.log(`auth started at ${port}`);
  await connectDB();
});

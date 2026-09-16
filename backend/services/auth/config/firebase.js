import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// firebase.js lives in config/, so the service-account key is one level up (auth root)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");

// Only initialize Firebase if the service-account key exists, so the auth
// service can still boot before credentials are added.
let admin;
try {
  admin = initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"))),
  });
  console.log("Firebase admin initialized");
} catch (err) {
  console.log("skipping Firebase init:", err.message);
}

export { admin, getAuth };

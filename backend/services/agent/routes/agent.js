import express from "express";
import { runAgent, listAgents } from "../controllers/agentController.js";
import { addDocuments, similaritySearch, listDocs } from "../vector/vectorStore.js";
import { CODING_MODELS } from "../config/models.js";
import { extractPdfText, extractPptxText } from "../utils/extractText.js";
import upload from "../config/multer.js";
import path from "path";
import { uploadDir } from "../config/multer.js";
import jwt from "jsonwebtoken";

async function getUser(req) {
  const h = req.headers["x-user-id"];
  if (h) return { userId: h };
  const t = req.cookies?.sessionId;
  if (!t) return null;
  try { return jwt.verify(t, process.env.JWT_SECRET); } catch { return null; }
}

const router = express.Router();

router.get("/api", (req, res) => res.json({ message: "Hello from Agent" }));
router.get("/agents", listAgents);
// Exposes the curated model list for the frontend build-view dropdown.
// Public info — no auth check. Frontend caches this on mount.
router.get("/models", (req, res) => res.json({ models: CODING_MODELS }));
router.post("/run", runAgent);

// File upload (PDF/PPTX/image) — multer diskStorage to config/temp
router.post("/upload", upload.single("file"), async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  if (!req.file) return res.status(400).json({ message: "file required (PDF, PPTX, or image)" });
  const storedName = req.file.filename;
  const filePath = path.join(uploadDir, storedName);
  const mime = req.file.mimetype;

  // fileType categorizes the upload for downstream agents. `reference`
  // means "the coding agent should read the extracted text as context"
  // — used for PPTX and PDFs attached in the Build view.
  let fileType = "image";
  if (mime === "application/pdf") fileType = "pdf";
  else if (mime.includes("presentation") || mime === "application/vnd.ms-powerpoint") fileType = "pptx";

  let chunks = 0;
  let extractedText = "";

  // PDF: extract text, chunk (~1000 chars), store in Vector DB for RAG,
  // AND return the full text so the Build view can pass it as context.
  if (fileType === "pdf") {
    try {
      const text = await extractPdfText(filePath);
      extractedText = text;
      const docs = [];
      for (let i = 0; i < text.length; i += 1000) {
        const chunk = text.slice(i, i + 1000);
        if (chunk.trim()) docs.push({ content: chunk, metadata: { source: storedName } });
      }
      if (docs.length) await addDocuments(docs);
      chunks = docs.length;
    } catch (e) {
      console.warn("pdf extract failed:", e.message);
    }
  }

  // PPTX: extract slide text so the coding agent can reference the deck's
  // content. Not stored in the vector DB — Build view uses it as inline
  // context, not for RAG search. Cap at 20k chars to protect LLM token budgets.
  if (fileType === "pptx") {
    try {
      const text = await extractPptxText(filePath);
      extractedText = text.slice(0, 20000);
    } catch (e) {
      console.warn("pptx extract failed:", e.message);
    }
  }

  res.json({
    fileName: storedName,
    originalName: req.file.originalname,
    fileType,
    chunks,
    // Only returned for pdf/pptx. Frontend passes this back on /agent/run so
    // the coding agent can include it verbatim in the prompt.
    ...(extractedText ? { extractedText } : {}),
  });
});

// Vector DB ingest — Hour 9+ RAG
router.post("/vector/ingest", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  const { content, documents, metadata } = req.body;
  const docs = documents || (content ? [{ content, metadata }] : []);
  if (!docs.length) return res.status(400).json({ message: "content or documents required" });
  await addDocuments(docs);
  res.json({ added: docs.length, total: listDocs().length });
});

router.get("/vector/docs", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  res.json({ docs: listDocs() });
});

router.post("/vector/search", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  const { query, k } = req.body;
  if (!query) return res.status(400).json({ message: "query required" });
  const results = await similaritySearch(query, k || 3);
  res.json({ query, results });
});

export default router;

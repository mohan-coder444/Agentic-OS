import { ChromaClient } from "chromadb";

let client = null;
let collection = null;

// Mistral embeddings via API
async function mistralEmbed(texts) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");
  const res = await fetch("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "mistral-embed", input: texts }),
  });
  const data = await res.json();
  if (!data.data) throw new Error(`Mistral embed failed: ${JSON.stringify(data).slice(0,300)}`);
  return data.data.map((d) => d.embedding);
}

// Fake deterministic fallback (if Mistral fails, no key, or offline)
function fakeEmbed(text) {
  const dim = 384;
  const vec = new Array(dim).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    vec[i % dim] += (hash % 100) / 100;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function embed(texts) {
  try {
    return await mistralEmbed(texts);
  } catch (e) {
    console.warn("[vector] Mistral embed failed, fallback to fake:", e.message);
    return texts.map((t) => fakeEmbed(t));
  }
}

async function getCollection() {
  if (collection) return collection;
  try {
    client = new ChromaClient();
    // Try to create collection with custom embedding function that uses our embed
    collection = await client.getOrCreateCollection({
      name: "cortex_docs",
      embeddingFunction: {
        generate: async (texts) => await embed(texts),
      },
    });
    const count = await collection.count();
    if (count === 0) {
      await collection.add({
        ids: ["1", "2", "3"],
        documents: [
          "Cortex AI is a Multi-Agent platform with Chat, Search, Coding, PDF, PPT, Image agents. Router picks the agent via LangGraph.",
          "Trending watches on Amazon in 2025: Titan Smart Watch, Noise ColorFit, Fire-Boltt Phoenix, all with AMOLED and 7-day battery. Prices $50-$400, 4.5+ stars.",
          "JavaScript is a high-level language for web, Node.js, etc. Use React for UI, Vite for build, Tailwind for CSS.",
        ],
        metadatas: [{ source: "intro" }, { source: "watches" }, { source: "js" }],
      });
      console.log("[vector] Chroma seeded 3 docs with Mistral/fake embeddings");
    }
    return collection;
  } catch (e) {
    console.warn("[vector] Chroma init failed, fallback to in-memory:", e.message);
    return null;
  }
}

// Fallback in-memory when Chroma not available
const fallbackDocs = [
  { id: "1", pageContent: "Cortex AI is a Multi-Agent platform with Chat, Search, Coding, PDF, PPT, Image agents. Router picks the agent via LangGraph.", metadata: { source: "intro" }, embedding: fakeEmbed("Cortex AI is a Multi-Agent platform") },
  { id: "2", pageContent: "Trending watches on Amazon in 2025: Titan Smart Watch, Noise ColorFit, Fire-Boltt Phoenix, all with AMOLED and 7-day battery. Prices $50-$400, 4.5+ stars.", metadata: { source: "watches" }, embedding: fakeEmbed("Trending watches on Amazon") },
  { id: "3", pageContent: "JavaScript is a high-level language for web, Node.js, etc. Use React for UI, Vite for build, Tailwind for CSS.", metadata: { source: "js" }, embedding: fakeEmbed("JavaScript is a high-level language") },
];
let nextId = 4;

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export async function addDocuments(newDocs) {
  const col = await getCollection();
  if (col) {
    const ids = newDocs.map((_, i) => `doc_${Date.now()}_${i}`);
    const docs = newDocs.map((d) => d.content || d.pageContent);
    const embeddings = await embed(docs);
    await col.add({ ids, documents: docs, embeddings, metadatas: newDocs.map((d) => d.metadata || {}) });
    console.log(`[vector] Chroma added ${newDocs.length} docs`);
    return;
  }
  for (const d of newDocs) {
    const content = d.content || d.pageContent;
    fallbackDocs.push({ id: String(nextId++), pageContent: content, metadata: d.metadata || {}, embedding: fakeEmbed(content) });
  }
  console.log(`[vector] fallback added ${newDocs.length} docs, total ${fallbackDocs.length}`);
}

export async function similaritySearch(query, k = 3) {
  const col = await getCollection();
  if (col) {
    try {
      const results = await col.query({ queryTexts: [query], nResults: k });
      const docs = results.documents?.[0] || [];
      if (docs.length > 0) {
        console.log(`[vector] Chroma query "${query.slice(0,30)}" → ${docs.length} docs`);
        return docs.join("\n---\n");
      }
    } catch (e) {
      console.warn("[vector] Chroma query failed, fallback:", e.message);
    }
  }
  const qEmb = fakeEmbed(query);
  const scored = fallbackDocs.map((d) => ({ doc: d, score: cosine(qEmb, d.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k);
  console.log(`[vector] fallback query "${query.slice(0,30)}" scores:`, top.map((s) => `${s.doc.metadata?.source || s.doc.id}:${s.score.toFixed(2)}`).join(", "));
  return top.map((s) => s.doc.pageContent).join("\n---\n");
}

export function listDocs() {
  // For Chroma, we can't easily list without query, so return fallback count
  return fallbackDocs.map((d) => ({ id: d.id, source: d.metadata.source, content: d.pageContent.slice(0,60) }));
}

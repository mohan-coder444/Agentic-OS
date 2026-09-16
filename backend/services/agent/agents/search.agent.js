import { getGroq } from "../config/llm.js";
import { similaritySearch } from "../vector/vectorStore.js";

async function fetchTavily(query) {
  if (!process.env.TAVILY_API_KEY) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: 3, include_answer: true }),
    });
    const data = await res.json();
    const results = (data.results || []).map((r) => `${r.title}: ${r.content?.slice(0, 300)}`).join("\n---\n");
    return results || data.answer || null;
  } catch (e) {
    console.warn("Tavily failed:", e.message);
    return null;
  }
}

async function fetchDuckDuckGo(query) {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&pretty=1`);
    const data = await res.json();
    const topics = (data.RelatedTopics || []).slice(0, 3).map((t) => t.Text || t.Result || "").filter(Boolean).join("\n");
    const abstract = data.AbstractText || "";
    return [abstract, topics].filter(Boolean).join("\n---\n").slice(0, 1500) || "No DuckDuckGo results";
  } catch (e) {
    return `DuckDuckGo error: ${e.message}`;
  }
}

export const searchAgent = async (state) => {
  const prompt = state.prompt || "";
  let vectorContext = "";
  try {
    vectorContext = await similaritySearch(prompt, 2);
  } catch {}
  let webContext = "";
  const tavily = await fetchTavily(prompt);
  if (tavily) {
    webContext = tavily;
    console.log(`[search] Tavily hit for "${prompt.slice(0,30)}" → ${tavily.slice(0,80)}...`);
  } else {
    webContext = await fetchDuckDuckGo(prompt);
    console.log(`[search] DuckDuckGo fallback for "${prompt.slice(0,30)}"`);
  }
  const context = [vectorContext, webContext].filter(Boolean).join("\n---\n");
  try {
    const groq = getGroq();
    if (groq) {
      const res = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: `You are a search agent. Use this context to answer real-time queries. Vector DB:\n${vectorContext}\nWeb:\n${webContext}` },
          { role: "user", content: prompt },
        ],
        max_tokens: 700,
      });
      return { aiResponse: res.choices[0]?.message?.content || `[search] ${prompt}` };
    }
  } catch (e) {
    console.warn("search groq failed:", e.message);
  }
  return { aiResponse: `[search] ${prompt}\nContext:\n${context.slice(0,600)}` };
};

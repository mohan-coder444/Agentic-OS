import { getMistral, getOpenRouterCoding, getModelForIntent } from "../config/llm.js";

export const codingAgent = async (state) => {
  const prompt = state.prompt || "";
  // Intent classification (as per Part 2 Hour 1)
  let intent = "code-generation";
  try {
    const intentLlm = getOpenRouterCoding() || (await import("../config/llm.js").then((m) => m.getGroq()))?.();
    // Use a cheap model for intent
    if (intentLlm?.invoke) {
      const res = await intentLlm.invoke(`You are an intent classifier. Return ONLY one of: code-generation, code-review, code-explanation, debugging, optimization, conversion, documentation. Request: ${prompt}`);
      const raw = (res.content || res.choices?.[0]?.message?.content || "").trim().toLowerCase();
      if (["code-generation", "code-review", "code-explanation", "debugging", "optimization", "conversion", "documentation"].includes(raw)) {
        intent = raw;
      }
    }
  } catch {}
  console.log(`[coding] intent=${intent} for "${prompt.slice(0,30)}"`);

  // If not code-generation, return markdown explanation (no artifacts)
  if (intent !== "code-generation") {
    try {
      const llm = getOpenRouterCoding() || getMistral();
      if (llm?.invoke) {
        const res = await llm.invoke(`You are a coding assistant. Provide a concise markdown explanation for: ${prompt}. Use headings like Overview, Explanation, Best Practices.`);
        return { aiResponse: res.content || res.choices?.[0]?.message?.content, artifacts: [] };
      }
    } catch {}
    return { aiResponse: `**${intent}** for: ${prompt}\n\nThis is a *${intent}* task — not code generation.`, artifacts: [] };
  }

  // Code generation — return JSON with files
  const systemPrompt = `You are Cortex AI coding agent, generate the requested project. Default stack: HTML, CSS, JavaScript (use React/Next only if explicitly requested). Rules: responsive, modern UI, CSS variables, flexbox, smooth hover, beautiful spacing, single page unless asked otherwise. Return ONLY valid JSON: {"files": [{"name": "index.html", "content": "..."}, {"name": "style.css", "content": "..."}, {"name": "script.js", "content": "..."}]} No markdown, no explanation. User request: ${prompt}`;

  // Try OpenCode Zen (frontier) first
  try {
    const { getOpenCodeZen } = await import("../config/llm.js");
    const zen = getOpenCodeZen();
    if (zen) {
      const res = await zen.invoke(systemPrompt);
      const text = res.content || "";
      console.log(`[coding] Zen raw:`, text.slice(0,200));
      let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const s = t.indexOf("{"), e = t.lastIndexOf("}");
      if (s !== -1 && e > s) t = t.slice(s, e + 1);
      const json = JSON.parse(t);
      if (json.files) {
        return {
          aiResponse: "code generated successfully",
          artifacts: [{ id: Date.now(), type: "project", files: json.files }],
        };
      }
    }
  } catch (e) {
    console.warn("coding Zen failed, fallback to DeepSeek:", e.message?.slice(0,120));
  }

  try {
    const llm = getOpenRouterCoding();
    if (llm) {
      const res = await llm.invoke(systemPrompt);
      let text = (res.content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s !== -1 && e > s) text = text.slice(s, e + 1);
      console.log(`[coding] DeepSeek raw:`, text.slice(0,200));
      const json = JSON.parse(text);
      if (json.files) {
        return {
          aiResponse: "code generated successfully",
          artifacts: [{ id: Date.now(), type: "project", files: json.files }],
        };
      }
    }
  } catch (e) {
    console.warn("coding DeepSeek failed, fallback to Mistral:", e.message);
  }

  // Fallback to Mistral (old behavior) — wrap as single file artifact
  try {
    const { getMistral } = await import("../config/llm.js");
    const mistral = getMistral();
    if (mistral) {
      const res = await mistral.chat.complete({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: "You are a coding agent. Generate a COMPLETE, runnable SINGLE HTML file with embedded CSS & JS. Wrap in ```html code block." },
          { role: "user", content: prompt },
        ],
        maxTokens: 2000,
      });
      const content = res.choices?.[0]?.message?.content;
      if (content) {
        // Extract HTML for artifact
        const match = content.match(/```html([\s\S]*?)```/i);
        const html = match ? match[1].trim() : content;
        return {
          aiResponse: "code generated successfully",
          artifacts: [{ id: Date.now(), type: "project", files: [{ name: "index.html", content: html }] }],
        };
      }
    }
  } catch {}

  return { aiResponse: `[coding] Echo: ${prompt}`, artifacts: [] };
};

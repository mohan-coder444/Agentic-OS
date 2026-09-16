import { getMistral } from "../config/llm.js";
import { uploadToS3 } from "../config/s3.js";
import { generatePpt } from "../utils/generatePpt.js";

// Strip markdown fences / prose around JSON so JSON.parse doesn't choke
const cleanJson = (text) => {
  let t = (text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s !== -1 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
};

export const pptAgent = async (state) => {
  const prompt = state.prompt || "";
  let data = null;
  // Try DeepSeek via OpenRouter first (less rate limited than Mistral)
  try {
    const { getOpenRouterCoding } = await import("../config/llm.js");
    const openRouter = getOpenRouterCoding();
    if (openRouter) {
      const sysPrompt = `You are a professional presentation designer. Return ONLY valid JSON: {"title": "...", "subtitle": "...", "slides": [{"title": "...", "points": ["...","..."]}]} Generate exactly 6 content slides (each 4-6 bullet points), no markdown. Topic: ${prompt}`;
      const res = await openRouter.invoke(sysPrompt);
      const text = res.content || "";
      data = cleanJson(text);
      console.log("[ppt] DeepSeek succeeded");
    }
  } catch (e) {
    console.warn("ppt DeepSeek failed, fallback to Mistral:", e.message.slice(0,100));
  }
  if (!data) {
  try {
    const mistral = getMistral();
    if (mistral) {
      const sysPrompt = `You are a professional presentation designer. Return ONLY valid JSON: {"title": "...", "subtitle": "...", "slides": [{"title": "...", "points": ["...","..."]}]} Generate exactly 6 content slides (each 4-6 bullet points), no markdown. Topic: ${prompt}`;
      const res = await mistral.chat.complete({ model: "mistral-small-latest", messages: [{ role: "user", content: sysPrompt }], maxTokens: 1200 });
      const text = res.choices?.[0]?.message?.content || "";
      data = cleanJson(text);
    }
  } catch (e) {
    console.warn("ppt mistral JSON failed:", e.message);
  }
  }
  if (!data || !data.slides) {
    // Fallback: try Mistral, then Groq, then stub
    try {
      const mistral = getMistral();
      if (mistral) {
        const res = await mistral.chat.complete({ model: "mistral-small-latest", messages: [{ role: "user", content: `Create outline for PPT about: ${prompt}` }], maxTokens: 700 });
        if (res.choices?.[0]?.message?.content) return { aiResponse: res.choices[0].message.content };
      }
    } catch (e) { console.warn("ppt Mistral fallback failed:", e.message.slice(0,80)); }
    try {
      const { getGroq } = await import("../config/llm.js");
      const groq = getGroq();
      if (groq) {
        const res = await groq.chat.completions.create({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: `Create a PPT outline for: ${prompt}. Provide title and 6 slides with points.` }], max_tokens: 700 });
        if (res.choices?.[0]?.message?.content) return { aiResponse: res.choices[0].message.content };
      }
    } catch (e) { console.warn("ppt Groq fallback failed:", e.message.slice(0,80)); }
    return { aiResponse: `[ppt] PPT outline for: ${prompt} (stub — all LLMs rate-limited)` };
  }
  try {
    const ppt = await generatePpt(data);
    const buffer = await ppt.write({ outputType: "nodebuffer" });
    const key = `ppts/${Date.now()}-${prompt.slice(0,20).replace(/\W/g, "_")}.pptx`;
    const url = await uploadToS3(key, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    return { aiResponse: `## PPT Generated\n**${data.title}**\n[Download PPT](${url})\n*Link expires in 10 minutes*\n\nSlides: ${data.slides.length}` };
  } catch (e) {
    console.warn("ppt gen failed:", e.message);
    return { aiResponse: `PPT data for: ${prompt}\n\n${JSON.stringify(data, null, 2)}` };
  }
};

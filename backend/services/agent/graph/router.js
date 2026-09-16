import { getGroq } from "../config/llm.js";

// Router agent — if frontend selected a specific agent, use it; else classify via Groq
export const routerAgent = async (state) => {
  if (state.agent && state.agent !== "auto") {
    const valid = ["chat", "search", "coding", "pdf", "ppt", "image", "image_gen", "pdf-rag", "image-analyzer"];
    if (valid.includes(state.agent)) return state.agent === "image_gen" ? "image" : state.agent;
  }
  const prompt = state.prompt || "";
  try {
    const groq = getGroq();
    if (groq) {
      const res = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: `Classify the user prompt into one of: chat, search, coding, pdf, ppt, image. Reply with ONLY one word. Examples: "hello"->chat, "search Amazon trending"->search, "generate code for calculator"->coding, "make PDF on AI"->pdf, "create PPT"->ppt, "generate image of dog"->image.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 10,
      });
      const choice = res.choices[0]?.message?.content?.trim().toLowerCase();
      if (["chat", "search", "coding", "pdf", "ppt", "image", "image_gen"].includes(choice)) {
        return choice === "image_gen" ? "image" : choice;
      }
    }
  } catch (e) {
    console.warn("router groq failed, fallback:", e.message);
  }
  // Fallback keywords
  const lower = prompt.toLowerCase();
  if (lower.includes("search") || lower.includes("amazon") || lower.includes("trending") || lower.includes("news")) return "search";
  if (lower.includes("code") || lower.includes("generate") && (lower.includes("component") || lower.includes("website") || lower.includes("function"))) return "coding";
  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("ppt") || lower.includes("powerpoint") || lower.includes("presentation")) return "ppt";
  if (lower.includes("image") || lower.includes("picture") || lower.includes("photo")) return "image";
  return "chat";
};

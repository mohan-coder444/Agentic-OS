import { getGroq } from "../config/llm.js";

export const chatAgent = async (state) => {
  const prompt = state.prompt || "";
  const history = state.history || [];
  // Build messages with history (last 20) + current prompt
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  // Avoid duplicating prompt if already in history (we added user msg before invoke)
  if (!history.length || history[history.length - 1]?.content !== prompt) {
    messages.push({ role: "user", content: prompt });
  }
  try {
    const groq = getGroq();
    if (groq) {
      const res = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "system", content: "You are Cortex AI, a helpful AI assistant. Use conversation history to answer." }, ...messages],
        temperature: 0.7,
        max_tokens: 600,
      });
      return { aiResponse: res.choices[0]?.message?.content || `[chat] Echo: ${prompt}` };
    }
  } catch (e) {
    console.warn("chat groq failed:", e.message);
  }
  return { aiResponse: `[chat] Echo: ${prompt} (stub — groq error)` };
};

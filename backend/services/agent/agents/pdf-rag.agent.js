import { getGroq } from "../config/llm.js";
import { similaritySearch } from "../vector/vectorStore.js";

// PDF RAG agent — answers from uploaded PDF chunks stored in the Vector DB
export const pdfRagAgent = async (state) => {
  const prompt = state.prompt || "";
  const fileName = state.fileName || "";
  let context = "";
  try {
    context = await similaritySearch(prompt, 4);
  } catch (e) {
    console.warn("pdf-rag vector search failed:", e.message);
  }
  try {
    const groq = getGroq();
    if (!groq) return { aiResponse: `[pdf-rag] No LLM available for: ${prompt}` };
    const res = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: `You answer questions using ONLY the PDF context below. If the answer is not in the context, say so. Context:\n${context}` },
        { role: "user", content: fileName ? `[PDF: ${fileName}] ${prompt}` : prompt },
      ],
      max_tokens: 700,
    });
    return { aiResponse: res.choices[0]?.message?.content || `[pdf-rag] No answer for: ${prompt}` };
  } catch (e) {
    console.warn("pdf-rag groq failed:", e.message);
    return { aiResponse: `[pdf-rag] Error: ${e.message}` };
  }
};

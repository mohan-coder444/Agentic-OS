import { routerAgent } from "./router.js";
import { chatAgent } from "../agents/chat.agent.js";
import { searchAgent } from "../agents/search.agent.js";
import { codingAgent } from "../agents/coding.agent.js";
import { pdfAgent } from "../agents/pdf.agent.js";
import { pptAgent } from "../agents/ppt.agent.js";
import { imageAgent } from "../agents/image.agent.js";
import { pdfRagAgent } from "../agents/pdf-rag.agent.js";
import { imageAnalyzerAgent } from "../agents/image-analyzer.agent.js";

// Simple graph without LangGraph dependency (stub)
// When you install @langchain/langgraph, replace this with StateGraph workflow
const agents = {
  chat: chatAgent,
  search: searchAgent,
  coding: codingAgent,
  pdf: pdfAgent,
  ppt: pptAgent,
  image_gen: imageAgent,
  image: imageAgent,
  "pdf-rag": pdfRagAgent,
  "image-analyzer": imageAnalyzerAgent,
};

export const graph = {
  // invoke({prompt}) -> {aiResponse, route}
  async invoke(state) {
    const route = await routerAgent(state);
    // Search special: search -> chat -> END
    if (route === "search") {
      const searchRes = await searchAgent(state);
      const chatRes = await chatAgent({ prompt: searchRes.aiResponse });
      return { aiResponse: chatRes.aiResponse, route: "search->chat" };
    }
    const agent = agents[route] || chatAgent;
    const result = await agent(state);
    return { ...result, route };
  },
};

// For future LangGraph version, export workflow for inspection
export const workflow = null;

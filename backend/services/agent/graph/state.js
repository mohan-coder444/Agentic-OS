// Simple state for LangGraph — keep it plain object for now (no Annotation yet, add when langgraph installed)
// When @langchain/langgraph is installed, replace with:
// import { Annotation } from "@langchain/langgraph";
// export const AgentState = Annotation.Root({ prompt: Annotation(), aiResponse: Annotation() });

export const AgentState = {
  prompt: null,
  aiResponse: null,
};

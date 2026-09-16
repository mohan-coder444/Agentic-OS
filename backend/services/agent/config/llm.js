import Groq from "groq-sdk";
import { Mistral } from "@mistralai/mistralai";
import { ChatOpenAI } from "@langchain/openai";

let groq = null;
let mistral = null;

export function getGroq() {
  if (!groq && process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

export function getMistral() {
  if (!mistral && process.env.MISTRAL_API_KEY) {
    mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  }
  return mistral;
}

let openRouterCoding = null;
export function getOpenRouterCoding() {
  if (!openRouterCoding && process.env.OPENROUTER_API_KEY) {
    openRouterCoding = new ChatOpenAI({
      model: "deepseek/deepseek-chat",
      temperature: 0,
      maxTokens: 1500,
      apiKey: process.env.OPENROUTER_API_KEY,
      configuration: { baseURL: "https://openrouter.ai/api/v1" },
    });
  }
  return openRouterCoding;
}

let openCodeZen = null;
export function getOpenCodeZen() {
  if (!openCodeZen && process.env.OPENCODE_ZEN_API_KEY) {
    openCodeZen = new ChatOpenAI({
      model: process.env.OPENCODE_ZEN_MODEL || "gpt-5.3-codex",
      temperature: 0,
      maxTokens: 3000,
      apiKey: process.env.OPENCODE_ZEN_API_KEY,
      configuration: { baseURL: process.env.OPENCODE_ZEN_BASE_URL || "https://opencode.ai/zen/v1" },
    });
  }
  return openCodeZen;
}

let openCodeGo = null;
export function getOpenCodeGo() {
  if (!openCodeGo && process.env.OPENCODE_ZEN_API_KEY) {
    openCodeGo = new ChatOpenAI({
      model: process.env.OPENCODE_GO_MODEL || "muse-spark-1.2-contributor",
      temperature: 0,
      maxTokens: 3000,
      apiKey: process.env.OPENCODE_ZEN_API_KEY,
      configuration: { baseURL: "https://opencode.ai/zen/go/v1" },
    });
  }
  return openCodeGo;
}

export async function getModelForIntent(intent) {
  if (intent === "coding") return getOpenCodeZen() || getOpenRouterCoding() || getMistral();
  return getGroq();
}

import Groq from "groq-sdk";
import { Mistral } from "@mistralai/mistralai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatBedrockConverse } from "@langchain/aws";

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

// AWS Bedrock via LangChain Converse API.
//
// Reads AWS_BEARER_TOKEN_BEDROCK from env (the ABSK-format API key). AWS SDK
// v3 picks this up automatically for Bedrock calls, no SigV4 signing needed.
// If you have classic AWS_ACCESS_KEY_ID/SECRET instead, those also work.
//
// Model ID is env-driven so you can swap without a code deploy. Cross-region
// inference profiles are prefixed `eu.` / `us.` because eu-north-1 (Stockholm)
// doesn't host larger Claude models directly — the profile routes to another
// EU region. Same billing pool.
//
// Default: Claude Sonnet 4 via EU inference profile. Change via env:
//   BEDROCK_MODEL_ID=eu.anthropic.claude-3-5-sonnet-20241022-v2:0    # cheaper
//   BEDROCK_MODEL_ID=eu.anthropic.claude-3-haiku-20240307-v1:0        # cheapest
let bedrock = null;
export function getBedrock() {
  if (bedrock) return bedrock;
  const hasBearer = !!process.env.AWS_BEARER_TOKEN_BEDROCK;
  const hasSigv4 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  if (!hasBearer && !hasSigv4) return null;

  bedrock = new ChatBedrockConverse({
    model: process.env.BEDROCK_MODEL_ID || "eu.anthropic.claude-sonnet-4-20250514-v1:0",
    // NOTE: intentionally does NOT fall back to AWS_REGION — that env is set
    // to your S3 bucket region (ap-south-1) which does NOT host Bedrock at
    // all. Bedrock lives in a separate region set. Set BEDROCK_REGION
    // explicitly if your Bedrock account is not in eu-north-1.
    region: process.env.BEDROCK_REGION || "eu-north-1",
    temperature: 0.3,
    maxTokens: Number(process.env.BEDROCK_MAX_TOKENS) || 8000,
  });
  return bedrock;
}

// Same as getBedrock() but for an explicit model ID. Cached per ID so we don't
// rebuild the client every request. Used by the model-switcher feature so the
// user can pick Claude Sonnet 4, Haiku, Nova Pro etc. from the UI.
const bedrockByModel = new Map();
export function getBedrockForModel(modelId) {
  if (!modelId) return getBedrock();
  if (bedrockByModel.has(modelId)) return bedrockByModel.get(modelId);
  const hasBearer = !!process.env.AWS_BEARER_TOKEN_BEDROCK;
  const hasSigv4 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  if (!hasBearer && !hasSigv4) return null;

  const client = new ChatBedrockConverse({
    model: modelId,
    region: process.env.BEDROCK_REGION || "eu-north-1",
    temperature: 0.3,
    maxTokens: Number(process.env.BEDROCK_MAX_TOKENS) || 8000,
  });
  bedrockByModel.set(modelId, client);
  return client;
}

// OpenRouter for a specific model. Same reasoning as getBedrockForModel:
// cached per model ID so switching from deepseek -> some other openrouter
// model doesn't rebuild the client every request.
const openRouterByModel = new Map();
export function getOpenRouterForModel(modelId) {
  if (!modelId) return getOpenRouterCoding();
  if (openRouterByModel.has(modelId)) return openRouterByModel.get(modelId);
  if (!process.env.OPENROUTER_API_KEY) return null;

  const client = new ChatOpenAI({
    model: modelId,
    temperature: 0.2,
    maxTokens: Number(process.env.CODING_MAX_TOKENS) || 1000,
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
  });
  openRouterByModel.set(modelId, client);
  return client;
}

let openRouterCoding = null;
export function getOpenRouterCoding() {
  if (!openRouterCoding && process.env.OPENROUTER_API_KEY) {
    openRouterCoding = new ChatOpenAI({
      model: "deepseek/deepseek-chat",
      temperature: 0.2,
      // Capped to fit remaining OpenRouter free-tier credits. Bump when you
      // top up: `CODING_MAX_TOKENS=8000` in the agent env for full sites.
      // OpenRouter checks maxTokens against your BALANCE, not usage — asking
      // for more than you can afford 402s even if the actual output is short.
      maxTokens: Number(process.env.CODING_MAX_TOKENS) || 1000,
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
      temperature: 0.2,
      maxTokens: 8000,
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
  if (intent === "coding") return getBedrock() || getOpenCodeZen() || getOpenRouterCoding() || getMistral();
  return getGroq();
}

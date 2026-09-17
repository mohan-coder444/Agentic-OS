// Curated model registry for the coding agent.
//
// `auto` uses the existing fallback chain (Bedrock -> Zen -> DeepSeek -> Mistral -> Groq).
// Everything else forces a specific provider + model ID.
//
// Frontend renders this list in the Build view dropdown. Adding a new option
// here makes it selectable without any frontend change.

export const CODING_MODELS = [
  {
    id: "auto",
    label: "Auto",
    provider: "auto",
    description: "Best available. Falls through Bedrock -> Zen -> DeepSeek -> Mistral -> Groq.",
    tier: "auto",
  },
  {
    id: "claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "bedrock",
    modelId: "eu.anthropic.claude-sonnet-4-20250514-v1:0",
    description: "Highest quality. Best design taste. ~$0.12/site.",
    tier: "premium",
  },
  {
    id: "claude-3-5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "bedrock",
    modelId: "eu.anthropic.claude-3-5-sonnet-20241022-v2:0",
    description: "Great design quality. Cheaper than Sonnet 4. ~$0.10/site.",
    tier: "premium",
  },
  {
    id: "claude-3-haiku",
    label: "Claude 3 Haiku",
    provider: "bedrock",
    modelId: "eu.anthropic.claude-3-haiku-20240307-v1:0",
    description: "Fast + cheap. Good for iteration. ~$0.005/site.",
    tier: "fast",
  },
  {
    id: "nova-pro",
    label: "Amazon Nova Pro",
    provider: "bedrock",
    modelId: "eu.amazon.nova-pro-v1:0",
    description: "Good design, low cost. ~$0.03/site.",
    tier: "budget",
  },
  {
    id: "llama-3-3-70b",
    label: "Llama 3.3 70B",
    provider: "bedrock",
    modelId: "eu.meta.llama3-3-70b-instruct-v1:0",
    description: "Solid open model. ~$0.006/site.",
    tier: "budget",
  },
  {
    id: "deepseek",
    label: "DeepSeek (OpenRouter)",
    provider: "openrouter",
    modelId: "deepseek/deepseek-chat",
    description: "Strong coder. Requires OpenRouter credits.",
    tier: "premium",
  },
  {
    id: "groq-oss",
    label: "Groq gpt-oss-20b",
    provider: "groq",
    modelId: "openai/gpt-oss-20b",
    description: "Free tier. Fast but less design taste.",
    tier: "free",
  },
];

export function findModel(id) {
  return CODING_MODELS.find((m) => m.id === id) || CODING_MODELS[0];
}

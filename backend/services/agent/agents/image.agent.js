import { getMistral, getGroq } from "../config/llm.js";
import axios from "axios";
import { uploadToS3 } from "../config/s3.js";

export const imageAgent = async (state) => {
  const prompt = state.prompt || "";
  let enhanced = prompt;
  // 1. Enhance prompt via LLM (if rate limited, just use original prompt)
  try {
    const mistral = getMistral();
    if (mistral) {
      try {
        const res = await mistral.chat.complete({ model: "mistral-small-latest", messages: [{ role: "user", content: `You are an elite AI image prompt engineer. Convert into a detailed prompt, cinematic 8K photorealistic. Return ONLY prompt. User: ${prompt}` }], maxTokens: 250 });
        enhanced = res.choices?.[0]?.message?.content?.trim() || prompt;
      } catch (e) {
        if (e.message.includes("429") || e.message.includes("Rate limit")) console.warn("[image] Mistral rate limited, using original prompt");
        else throw e;
      }
    }
  } catch (e) {
    console.warn("image prompt enhance failed:", e.message);
  }

  // 2. Generate image via Pollinations (free, no key)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced)}`;
  try {
    const imageRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 30000 });
    const buffer = Buffer.from(imageRes.data);
    const fileName = `${Date.now()}.png`;
    let s3Url = imageUrl;
    try {
      s3Url = await uploadToS3(fileName, buffer, "image/png");
    } catch (s3Err) {
      console.warn("[image] S3 upload failed, using direct Pollinations URL:", s3Err.message);
      s3Url = imageUrl;
    }
    return {
      aiResponse: `### Generated Image\n![Generated Image](${s3Url})\n[Download Image](${s3Url})\n*Link expires in 10 minutes*\n\n*Prompt used:* ${enhanced}`,
    };
  } catch (e) {
    console.warn("Pollinations failed:", e.message);
    return { aiResponse: `Failed to generate image: ${e.message}\n\n*Prompt:* ${enhanced}\n*Direct URL (try in browser):* ${imageUrl}` };
  }
};

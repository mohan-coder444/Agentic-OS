import fs from "fs";
import path from "path";
import { getMistral } from "../config/llm.js";
import { uploadDir } from "../config/multer.js";

// Image Analyzer agent — image-to-text (distinct from vision/image-generate)
export const imageAnalyzerAgent = async (state) => {
  const prompt = state.prompt || "";
  const fileName = state.fileName || "";
  if (!fileName) return { aiResponse: "[image-analyzer] No image file provided. Attach an image first." };
  const filePath = path.join(uploadDir, fileName);
  if (!fs.existsSync(filePath)) return { aiResponse: `[image-analyzer] File not found: ${fileName}` };
  try {
    const mistral = getMistral();
    if (!mistral) return { aiResponse: "[image-analyzer] No LLM available." };
    const b64 = fs.readFileSync(filePath).toString("base64");
    const ext = path.extname(fileName).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const res = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt || "Describe this image in detail." },
            { type: "image_url", imageUrl: `data:${mime};base64,${b64}` },
          ],
        },
      ],
      maxTokens: 600,
    });
    return { aiResponse: res.choices?.[0]?.message?.content || "[image-analyzer] No description returned." };
  } catch (e) {
    console.warn("image-analyzer failed:", e.message?.slice(0,120));
    return { aiResponse: `[image-analyzer] Failed to analyze image: ${e.message?.slice(0,200)}` };
  }
};

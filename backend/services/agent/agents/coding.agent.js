import { getMistral, getOpenRouterCoding, getModelForIntent, getGroq, getBedrock, getBedrockForModel, getOpenRouterForModel } from "../config/llm.js";
import { findModel } from "../config/models.js";

export const codingAgent = async (state) => {
  const prompt = state.prompt || "";
  // Intent classification (as per Part 2 Hour 1)
  let intent = "code-generation";
  try {
    const intentLlm = getOpenRouterCoding() || (await import("../config/llm.js").then((m) => m.getGroq()))?.();
    // Use a cheap model for intent
    if (intentLlm?.invoke) {
      const res = await intentLlm.invoke(`You are an intent classifier. Return ONLY one of: code-generation, code-review, code-explanation, debugging, optimization, conversion, documentation. Request: ${prompt}`);
      const raw = (res.content || res.choices?.[0]?.message?.content || "").trim().toLowerCase();
      if (["code-generation", "code-review", "code-explanation", "debugging", "optimization", "conversion", "documentation"].includes(raw)) {
        intent = raw;
      }
    }
  } catch {}
  console.log(`[coding] intent=${intent} for "${prompt.slice(0,30)}"`);

  // If not code-generation, return markdown explanation (no artifacts)
  if (intent !== "code-generation") {
    try {
      const llm = getOpenRouterCoding() || getMistral();
      if (llm?.invoke) {
        const res = await llm.invoke(`You are a coding assistant. Provide a concise markdown explanation for: ${prompt}. Use headings like Overview, Explanation, Best Practices.`);
        return { aiResponse: res.content || res.choices?.[0]?.message?.content, artifacts: [] };
      }
    } catch {}
    return { aiResponse: `**${intent}** for: ${prompt}\n\nThis is a *${intent}* task — not code generation.`, artifacts: [] };
  }

  // Code generation — return JSON with files. The system prompt below is the
  // single biggest lever between "generic bootstrap-looking site" and something
  // that looks like it belongs in an award-nomination. Every line is load-bearing.
  //
  // If the user attached a PDF or PPTX in the Build view, `state.extractedText`
  // holds its content. We inject it as REFERENCE MATERIAL so the agent grounds
  // the site in real content from the doc (resume details, brand names,
  // product descriptions, talking points from a pitch deck) instead of
  // inventing generic copy.
  //
  // The wording is deliberately strict — earlier versions used softer
  // language ("use it to ground") and models happily ignored it. This
  // version is imperative and explicit about what "use" means.
  const referenceBlock = state.extractedText
    ? `\n\n=== REFERENCE MATERIAL (user attached a file) ===\nThis is the user's actual document. The generated site MUST use its real content: real names, real dates, real employers, real projects, real skills, real descriptions. DO NOT invent or replace ANY of these facts. If the doc is a resume, the portfolio site MUST include every job, every project, every skill mentioned. If it's a pitch deck, the site MUST use the deck's product name, features, and copy verbatim. Ignoring this material is a bug.\n\nDOCUMENT CONTENT:\n"""\n${state.extractedText.slice(0, 15000)}\n"""\n=== END REFERENCE MATERIAL ===\n`
    : "";

  if (state.extractedText) {
    console.log(`[coding] reference material attached: ${state.extractedText.length} chars`);
  }

  const systemPrompt = `You are Cortex AI, a senior frontend engineer + designer that ships production-quality single-page websites.

OUTPUT FORMAT (strict): Return ONLY valid JSON. No prose, no markdown fences.
{"files":[{"name":"index.html","content":"..."},{"name":"style.css","content":"..."},{"name":"script.js","content":"..."}]}

DESIGN RULES (non-negotiable):
- Design language must match the request. If ambiguous, pick a distinctive aesthetic: dark editorial, glassmorphism, brutalist, retro-terminal, or modern minimal — NEVER generic Bootstrap.
- Real content only. NO 'Lorem ipsum'. NO placeholder text like 'Feature 1' or 'Company Name'. Invent believable product/brand names, taglines, real feature descriptions, real testimonial names and quotes.
- Full page structure: nav + hero + at least 3 content sections (features/how-it-works/testimonials/pricing/FAQ) + CTA + footer. Not a stub.
- Typography: use Google Fonts via <link>. Pair a display font (e.g. Fraunces, Playfair, Space Grotesk, Instrument Serif) with a body font (Inter, DM Sans, Manrope). Set font-feature-settings, letter-spacing, line-height like a designer would.
- Color: a real palette with a hero accent, deep neutrals, and 1 signal color. Use CSS custom properties (--bg, --fg, --accent, --muted). No default browser blues.
- Images: use Unsplash source URLs like https://images.unsplash.com/photo-{id}?w=1600&q=80 (invent plausible IDs, or use CSS gradients / SVG shapes). Set width/height attrs so layout doesn't jump.
- Motion: at least 3 real interactions — hover states with transform, scroll-reveal (IntersectionObserver in script.js), a subtle animated gradient or blob, a working nav (mobile menu toggle).
- Responsive down to 375px. Test flex/grid don't overflow.
- Accessibility: semantic HTML5 (<nav>, <main>, <section>, <article>, <footer>), aria-labels on icon buttons, prefers-reduced-motion respected in the animation code.

CODE QUALITY:
- index.html: DOCTYPE, meta viewport, <title>, <meta description>, Open Graph tags for a portfolio-grade site.
- style.css: mobile-first, custom properties at :root, container max-widths, real spacing scale (--space-1..--space-8), no inline styles unless truly one-off.
- script.js: modern ES6+, addEventListener, IntersectionObserver for scroll effects, no jQuery, no external deps.

FORBIDDEN:
- Lorem ipsum, 'placeholder' text, 'Company Name', 'Feature 1', generic 'card' components with no purpose.
- Empty <div> content. Every section must MEAN something.
- Loading a CSS framework CDN (Tailwind CDN, Bootstrap, etc.). Write real CSS.
- Broken JavaScript that references undefined DOM ids.${referenceBlock}

User request: ${prompt}`;

  // ---- Explicit model requested? Try it first. ----
  // The frontend model dropdown sends state.model (e.g. "claude-3-haiku").
  // "auto" or absent falls through to the existing chain below.
  //
  // The strategy: attempt ONLY the chosen model. If it fails, fall through
  // to the auto chain rather than surfacing the error — users typically want
  // "generate a site" more than "generate a site using this specific model".
  // The auto chain is the same safety net that has kept the app working
  // through OpenRouter credit exhaustion.
  const modelChoice = state.model && state.model !== "auto" ? findModel(state.model) : null;
  if (modelChoice && modelChoice.provider !== "auto") {
    console.log(`[coding] explicit model=${modelChoice.id} provider=${modelChoice.provider}`);
    try {
      let client = null;
      if (modelChoice.provider === "bedrock") client = getBedrockForModel(modelChoice.modelId);
      else if (modelChoice.provider === "openrouter") client = getOpenRouterForModel(modelChoice.modelId);

      if (client) {
        const res = await client.invoke(systemPrompt);
        let text = (res.content || "").trim();
        text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
        const s = text.indexOf("{"), e = text.lastIndexOf("}");
        if (s !== -1 && e > s) text = text.slice(s, e + 1);
        console.log(`[coding] ${modelChoice.id} raw:`, text.slice(0, 200));
        const json = JSON.parse(text);
        if (json.files?.length) {
          return {
            aiResponse: "code generated successfully",
            artifacts: [{ id: Date.now(), type: "project", files: json.files, modelUsed: modelChoice.id }],
          };
        }
      }
      // Groq path uses a different SDK (not LangChain), so handled separately.
      if (modelChoice.provider === "groq") {
        const groq = getGroq();
        if (groq) {
          const res = await groq.chat.completions.create({
            model: modelChoice.modelId,
            temperature: 0.3,
            max_tokens: 8000,
            messages: [
              { role: "system", content: systemPrompt.replace(/OUTPUT FORMAT[\s\S]*?\}/, "OUTPUT FORMAT (strict): Return ONLY a single ```html code block containing a complete self-contained HTML file with embedded <style> and <script>. No prose, no other text.") },
              { role: "user", content: prompt },
            ],
          });
          const content = res.choices?.[0]?.message?.content || "";
          const match = content.match(/```html\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/);
          const html = (match ? match[1] : content).trim();
          if (html && html.length > 200) {
            return {
              aiResponse: "code generated successfully",
              artifacts: [{ id: Date.now(), type: "project", files: [{ name: "index.html", content: html }], modelUsed: modelChoice.id }],
            };
          }
        }
      }
    } catch (e) {
      console.warn(`[coding] explicit model ${modelChoice.id} failed, falling through to auto:`, e.message?.slice(0, 200));
    }
  }

  // Try Bedrock (Claude Sonnet 4 via EU inference profile) first — highest
  // quality on our provider chain. Uses the JSON-output pattern because
  // Claude is very reliable at producing valid JSON when asked.
  try {
    const bedrock = getBedrock();
    if (bedrock) {
      const res = await bedrock.invoke(systemPrompt);
      let text = (res.content || "").trim();
      // Claude sometimes wraps in ```json fences even when told not to.
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s !== -1 && e > s) text = text.slice(s, e + 1);
      console.log(`[coding] Bedrock raw:`, text.slice(0, 200));
      const json = JSON.parse(text);
      if (json.files?.length) {
        return {
          aiResponse: "code generated successfully",
          artifacts: [{ id: Date.now(), type: "project", files: json.files, modelUsed: "auto:bedrock" }],
        };
      }
    }
  } catch (e) {
    console.warn("[coding] Bedrock failed, fallback to Zen:", e.message?.slice(0, 200));
  }

  // Try OpenCode Zen (frontier) first
  try {
    const { getOpenCodeZen } = await import("../config/llm.js");
    const zen = getOpenCodeZen();
    if (zen) {
      const res = await zen.invoke(systemPrompt);
      const text = res.content || "";
      console.log(`[coding] Zen raw:`, text.slice(0,200));
      let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const s = t.indexOf("{"), e = t.lastIndexOf("}");
      if (s !== -1 && e > s) t = t.slice(s, e + 1);
      const json = JSON.parse(t);
      if (json.files) {
        return {
          aiResponse: "code generated successfully",
          artifacts: [{ id: Date.now(), type: "project", files: json.files }],
        };
      }
    }
  } catch (e) {
    console.warn("coding Zen failed, fallback to DeepSeek:", e.message?.slice(0,120));
  }

  try {
    const llm = getOpenRouterCoding();
    if (llm) {
      const res = await llm.invoke(systemPrompt);
      let text = (res.content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s !== -1 && e > s) text = text.slice(s, e + 1);
      console.log(`[coding] DeepSeek raw:`, text.slice(0,200));
      const json = JSON.parse(text);
      if (json.files) {
        return {
          aiResponse: "code generated successfully",
          artifacts: [{ id: Date.now(), type: "project", files: json.files }],
        };
      }
    }
  } catch (e) {
    console.warn("coding DeepSeek failed, fallback to Mistral:", e.message);
  }

  // Fallback to Mistral (old behavior) — wrap as single file artifact.
  // NOTE: OpenCode Zen needs billing, OpenRouter DeepSeek needs credits.
  // Mistral has a free tier that works, so it's the reliable backstop.
  //
  // Uses the full systemPrompt (which includes referenceBlock) rather than a
  // hardcoded string. The previous version had a hardcoded system message
  // that ignored attached resumes/decks entirely — users complained the site
  // had zero details from their doc. That was the bug.
  try {
    const { getMistral } = await import("../config/llm.js");
    const mistral = getMistral();
    if (mistral) {
      const res = await mistral.chat.complete({
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content:
              systemPrompt +
              "\n\nOUTPUT OVERRIDE for this call: instead of the JSON format above, output ONE complete runnable HTML file with embedded <style> and <script>, wrapped in a ```html code block. Nothing before or after the fence.",
          },
          { role: "user", content: prompt },
        ],
        maxTokens: 8000,
      });
      const content = res.choices?.[0]?.message?.content;
      if (content) {
        const match = content.match(/```html([\s\S]*?)```/i);
        const html = match ? match[1].trim() : content;
        return {
          aiResponse: "code generated successfully",
          artifacts: [{ id: Date.now(), type: "project", files: [{ name: "index.html", content: html }] }],
        };
      }
      console.warn("[coding] Mistral returned empty content");
    } else {
      console.warn("[coding] Mistral not configured (MISTRAL_API_KEY missing)");
    }
  } catch (e) {
    console.warn("[coding] Mistral fallback failed:", e.message?.slice(0, 200));
  }

  // Last-resort fallback: Groq. Uses the HTML-in-markdown-block pattern
  // (same as Mistral) rather than JSON output, because LLM-generated JSON
  // with embedded HTML/CSS/JS strings is fragile — one unescaped quote in
  // the content and JSON.parse throws "Unterminated string". Code fences
  // are far more robust: just find the opening ```html and closing ```.
  //
  // CRITICAL: uses the full systemPrompt (with referenceBlock) rather than a
  // hardcoded message. Groq is the current end of the chain on the free
  // tier, so this is the one that actually runs for most users. If this
  // ignores attachments, every request ignores attachments.
  try {
    const groq = getGroq();
    if (groq) {
      const res = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        temperature: 0.3,
        max_tokens: 8000,
        messages: [
          {
            role: "system",
            content:
              systemPrompt +
              "\n\nOUTPUT OVERRIDE for this call: instead of the JSON format above, output ONE complete runnable HTML file with embedded <style> and <script>, wrapped in a ```html code block. Nothing before or after the fence.",
          },
          { role: "user", content: prompt },
        ],
      });
      const content = res.choices?.[0]?.message?.content || "";
      const match = content.match(/```html\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/);
      const html = (match ? match[1] : content).trim();
      if (html && html.length > 200) {
        console.log(`[coding] Groq HTML fallback OK: ${html.length} chars`);
        return {
          aiResponse: "code generated successfully",
          artifacts: [
            { id: Date.now(), type: "project", files: [{ name: "index.html", content: html }] },
          ],
        };
      }
      console.warn("[coding] Groq returned unusably short content:", html.slice(0, 100));
    }
  } catch (e) {
    console.warn("[coding] Groq final fallback failed:", e.message?.slice(0, 200));
  }

  return { aiResponse: `[coding] All providers unavailable. Check OpenRouter credits / Mistral rate limit / Groq status. Prompt was: ${prompt}`, artifacts: [] };
};

import { getMistral, getOpenRouterCoding, getModelForIntent, getGroq } from "../config/llm.js";

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
- Broken JavaScript that references undefined DOM ids.

User request: ${prompt}`;

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
  try {
    const { getMistral } = await import("../config/llm.js");
    const mistral = getMistral();
    if (mistral) {
      const res = await mistral.chat.complete({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: "You are Cortex AI, a senior frontend engineer + designer. Generate a COMPLETE, runnable SINGLE HTML file with embedded <style> and <script>. Follow every rule: real content (NO lorem ipsum), Google Fonts, distinctive design language (not generic), full page (nav + hero + 3+ sections + footer), scroll-reveal via IntersectionObserver, responsive, semantic HTML5. Wrap in \`\`\`html code block." },
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
            content: "You are Cortex AI, a senior frontend engineer + designer. Generate ONE complete, runnable HTML file with embedded <style> and <script>. STRICT RULES: real content (invent brand names, real testimonials, no lorem ipsum), Google Fonts via <link>, distinctive design language (dark editorial / glassmorphism / brutalist / minimal — never generic Bootstrap), full page (nav + hero + at least 3 sections + footer), scroll-reveal via IntersectionObserver, mobile-responsive down to 375px, semantic HTML5 (<nav>, <main>, <section>, <footer>). Output ONLY the HTML wrapped in a ```html code block. Nothing before or after.",
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

import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCode,
  FiEye,
  FiRefreshCw,
  FiDownload,
  FiSend,
  FiZap,
  FiMonitor,
  FiSmartphone,
  FiTablet,
} from "react-icons/fi";
import api from "../axios";
import LoadingAnimation from "./LoadingAnimation";

/**
 * BuildView — Antigravity-style IDE for the coding agent.
 *
 * Layout: preview on the left, Monaco editor + file tabs on the right, prompt
 * input pinned to the bottom. The whole panel is one artifact at a time; each
 * "Generate" replaces the previous project. History is not persisted yet —
 * that's a future feature (would need a new Mongo model + list UI).
 */
export default function BuildView() {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [artifact, setArtifact] = useState(null); // { id, type, files: [{name, content}] }
  const [activeIdx, setActiveIdx] = useState(0);
  const [tab, setTab] = useState("preview"); // preview | code
  const [device, setDevice] = useState("desktop"); // desktop | tablet | mobile
  const [previewKey, setPreviewKey] = useState(0); // bump to force iframe reload
  const inputRef = useRef(null);

  const files = artifact?.files || [];
  const activeFile = files[activeIdx];

  // Assemble the preview doc from whichever files exist. Supports both
  // multi-file (html + css + js separate) and single-file HTML outputs.
  const previewDoc = useMemo(() => {
    if (!files.length) return "";
    const html = files.find((f) => f.name === "index.html")?.content || "";
    const css = files.find((f) => f.name === "style.css")?.content || "";
    const js = files.find((f) => f.name === "script.js")?.content || "";
    // Single-file HTML case: css + js empty, html has everything inline.
    if (!css && !js) return html;
    // Multi-file: inject css into <head> and js before </body>.
    // If html has its own <head>/<body>, insert into them; else build a doc.
    if (/<html[\s>]/i.test(html)) {
      return html
        .replace(/<\/head>/i, `<style>${css}</style></head>`)
        .replace(/<\/body>/i, `<script>${js}</script></body>`);
    }
    return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
  }, [files]);

  const handleGenerate = async () => {
    if (!prompt.trim() || sending) return;
    const request = prompt.trim();
    setPrompt("");
    setSending(true);
    try {
      // Coding agent is dispatched directly (no conversation persistence).
      const res = await api.post("/agent/run", { prompt: request, agent: "coding" });
      const gen = res.data.artifacts?.[0];
      if (gen && gen.files?.length) {
        setArtifact(gen);
        setActiveIdx(0);
        setTab("preview");
        setPreviewKey((k) => k + 1);
      } else {
        // Agent responded but no files came back — surface the text so the
        // user isn't left staring at an unchanged empty state.
        alert(res.data.aiResponse || "No code generated. Try being more specific about what you want.");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      const resetIn = err.response?.data?.resetIn;
      alert(resetIn ? `${msg} (wait ${resetIn}s)` : `Generation failed: ${msg}`);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleDownload = () => {
    // Bundle all files into a single .html when possible, else download each.
    if (files.length === 1) {
      downloadBlob(files[0].content, files[0].name, mimeFor(files[0].name));
      return;
    }
    // Multi-file: emit a single self-contained HTML so users can open it directly.
    const html = files.find((f) => f.name === "index.html")?.content || "";
    const css = files.find((f) => f.name === "style.css")?.content || "";
    const js = files.find((f) => f.name === "script.js")?.content || "";
    const combined = /<html[\s>]/i.test(html)
      ? html
          .replace(/<\/head>/i, `<style>${css}</style></head>`)
          .replace(/<\/body>/i, `<script>${js}</script></body>`)
      : `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
    downloadBlob(combined, "site.html", "text/html");
  };

  const languageFor = (name = "") => {
    if (name.endsWith(".css")) return "css";
    if (name.endsWith(".js")) return "javascript";
    if (name.endsWith(".json")) return "json";
    return "html";
  };

  const deviceWidth = { desktop: "100%", tablet: "768px", mobile: "375px" }[device];

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 shrink-0">
        <span className="font-semibold text-sm text-white">Build</span>
        <span className="text-xs text-slate-500 truncate flex-1">
          {artifact ? `${files.length} file${files.length === 1 ? "" : "s"}` : "AI website builder"}
        </span>

        {/* Preview/Code tab switch */}
        {artifact && (
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/10">
            {[
              { id: "preview", label: "Preview", icon: FiEye },
              { id: "code", label: "Code", icon: FiCode },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    isActive ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon size={11} /> {t.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Device switch — only visible on preview tab */}
        {artifact && tab === "preview" && (
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/10">
            {[
              { id: "desktop", icon: FiMonitor, label: "Desktop" },
              { id: "tablet", icon: FiTablet, label: "Tablet" },
              { id: "mobile", icon: FiSmartphone, label: "Mobile" },
            ].map((d) => {
              const Icon = d.icon;
              const isActive = device === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDevice(d.id)}
                  title={d.label}
                  className={`p-1.5 rounded-md transition-colors ${
                    isActive ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon size={12} />
                </button>
              );
            })}
          </div>
        )}

        {artifact && (
          <>
            <button
              onClick={() => setPreviewKey((k) => k + 1)}
              title="Reload preview"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-none cursor-pointer"
            >
              <FiRefreshCw size={13} />
            </button>
            <button
              onClick={handleDownload}
              title="Download as .html"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-none cursor-pointer"
            >
              <FiDownload size={13} />
            </button>
          </>
        )}
      </div>

      {/* Body: preview or code, plus sidebar file list when in code mode */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {!artifact && !sending && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center">
              <FiZap size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Build a website</h2>
            <p className="text-sm text-slate-400 max-w-md">
              Describe what you want. The AI generates a full single-page site with real content, custom design, and working code. Preview it here, tweak with follow-up prompts, download when ready.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-xl">
              {[
                "Landing page for a dark-mode note-taking app called Fable, with pricing and testimonials",
                "Portfolio site for a photographer named Vera, editorial serif type, image-first",
                "Product page for wireless earbuds, brutalist design, bold typography",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="text-xs text-slate-400 bg-white/[0.04] border border-white/7 px-3 py-1.5 rounded-full hover:bg-white/[0.08] hover:text-slate-200 transition-colors cursor-pointer text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {sending && !artifact && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingAnimation />
          </div>
        )}

        {artifact && tab === "preview" && (
          <div className="flex-1 flex items-center justify-center bg-zinc-900 p-4 overflow-auto">
            <motion.div
              key={device}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{ width: deviceWidth, maxWidth: "100%", height: device === "desktop" ? "100%" : "812px", maxHeight: "100%" }}
              className="bg-white rounded-lg overflow-hidden shadow-2xl"
            >
              <iframe
                key={previewKey}
                title="site preview"
                srcDoc={previewDoc}
                className="w-full h-full bg-white border-none"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </motion.div>
          </div>
        )}

        {artifact && tab === "code" && (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex border-b border-white/5 overflow-x-auto shrink-0">
              {files.map((f, idx) => {
                const isActive = activeIdx === idx;
                return (
                  <button
                    key={f.name}
                    onClick={() => setActiveIdx(idx)}
                    className={`px-4 py-2 text-[11px] font-medium whitespace-nowrap border-r border-white/5 relative bg-transparent cursor-pointer ${
                      isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {f.name}
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                language={languageFor(activeFile?.name)}
                value={activeFile?.content || ""}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Prompt input pinned to bottom. Also shows the loader over an existing
          artifact so the user knows the next generation is running. */}
      <div className="p-3 border-t border-white/5 shrink-0">
        <AnimatePresence>
          {sending && artifact && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-2"
            >
              <LoadingAnimation />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col gap-2">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder={
              artifact
                ? "Refine or rebuild — e.g. 'add a testimonials section' or 'make the hero more dramatic'"
                : "Describe the website you want to build..."
            }
            rows={2}
            className="w-full bg-transparent outline-none resize-none text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed min-h-[48px] max-h-[160px]"
            disabled={sending}
            style={{ scrollbarWidth: "none" }}
          />
          <div className="flex items-center justify-end">
            <button
              onClick={handleGenerate}
              disabled={sending || !prompt.trim()}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border-none cursor-pointer transition-all ${
                prompt.trim() && !sending
                  ? "bg-gradient-to-br from-indigo-500 to-violet-700 text-white hover:opacity-90"
                  : "bg-zinc-800 text-zinc-600"
              } disabled:opacity-50`}
            >
              <FiSend size={13} /> {artifact ? "Regenerate" : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function mimeFor(name = "") {
  if (name.endsWith(".css")) return "text/css";
  if (name.endsWith(".js")) return "application/javascript";
  if (name.endsWith(".json")) return "application/json";
  return "text/html";
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

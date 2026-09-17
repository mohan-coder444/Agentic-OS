import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
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
  FiChevronDown,
  FiPaperclip,
  FiFileText,
  FiX,
} from "react-icons/fi";
import api from "../axios";
import LoadingAnimation from "./LoadingAnimation";
import {
  setModels,
  setSelectedModel,
  addBuild,
  cacheBuild,
  setActiveBuildId,
} from "../slices/builderSlice";

/**
 * BuildView — Antigravity-style IDE for the coding agent.
 *
 * Layout: preview left, Monaco editor + file tabs right, prompt input pinned
 * to the bottom, model dropdown in the top bar. Sidebar (in Chat.jsx) shows
 * saved sessions when Build view is active.
 *
 * State is Redux-backed via builderSlice so switching sidebar sessions
 * survives view toggles and reloads.
 */
export default function BuildView() {
  const dispatch = useDispatch();
  const { models, selectedModel, activeBuildId, buildsById } = useSelector((s) => s.builder);

  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tab, setTab] = useState("preview"); // preview | code
  const [device, setDevice] = useState("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  // Attached reference file (PDF or PPTX). Its extracted text gets injected
  // into the coding agent's prompt as REFERENCE MATERIAL so the site grounds
  // in real content from the deck/document instead of inventing generic copy.
  const [attachedFile, setAttachedFile] = useState(null);
  const inputRef = useRef(null);
  const modelMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  // The active artifact comes from the cache. `null` means empty state.
  const artifact = activeBuildId ? buildsById[activeBuildId] : null;
  const files = artifact?.files || [];
  const activeFile = files[activeIdx];

  // Fetch model list once on mount. Cached in Redux so switching views
  // doesn't refetch.
  useEffect(() => {
    if (models.length > 0) return;
    api
      .get("/agent/models")
      .then((r) => dispatch(setModels(r.data.models || [])))
      .catch((e) => console.warn("failed to load models:", e.message));
  }, [dispatch, models.length]);

  // If activeBuildId is set but we don't have its files cached, fetch.
  // Happens when the user clicks a session in the sidebar list.
  useEffect(() => {
    if (!activeBuildId) return;
    if (buildsById[activeBuildId]?.files) return;
    api
      .get(`/chat/builds/${activeBuildId}`)
      .then((r) => {
        dispatch(cacheBuild(r.data.build));
        setActiveIdx(0);
        setTab("preview");
        setPreviewKey((k) => k + 1);
      })
      .catch((e) => console.warn("failed to load build:", e.message));
  }, [activeBuildId, buildsById, dispatch]);

  // Close model dropdown on outside click.
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onClick = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [modelMenuOpen]);

  // Preview doc: multi-file (html+css+js) or single-file HTML.
  const previewDoc = useMemo(() => {
    if (!files.length) return "";
    const html = files.find((f) => f.name === "index.html")?.content || "";
    const css = files.find((f) => f.name === "style.css")?.content || "";
    const js = files.find((f) => f.name === "script.js")?.content || "";
    if (!css && !js) return html;
    if (/<html[\s>]/i.test(html)) {
      return html
        .replace(/<\/head>/i, `<style>${css}</style></head>`)
        .replace(/<\/body>/i, `<script>${js}</script></body>`);
    }
    return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
  }, [files]);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  const clearAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Show the chip immediately so the user sees the upload is in flight.
    setAttachedFile({ name: f.name, size: f.size, type: f.type, uploading: true });
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await api.post("/agent/upload", form);
      const { fileName, fileType, extractedText } = res.data;
      if (!extractedText && fileType !== "image") {
        alert("Could not extract text from that file. The build will still work but without reference material.");
      }
      setAttachedFile({
        name: f.name,
        size: f.size,
        type: f.type,
        fileName,
        fileType,
        extractedText: extractedText || "",
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      alert(`Upload failed: ${msg}`);
      clearAttachedFile();
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || sending) return;
    const request = prompt.trim();
    const ref = attachedFile?.extractedText;
    const refName = attachedFile?.name;
    setPrompt("");
    clearAttachedFile();
    setSending(true);
    try {
      const res = await api.post("/agent/run", {
        prompt: request,
        agent: "coding",
        model: selectedModel,
        ...(ref ? { extractedText: ref, fileName: refName } : {}),
      });
      const gen = res.data.artifacts?.[0];
      const buildId = res.data.buildId;
      if (gen && gen.files?.length && buildId) {
        // Fresh generation was auto-saved server-side. Add to Redux + activate.
        dispatch(
          addBuild({
            _id: buildId,
            title: request.slice(0, 60),
            prompt: request,
            modelUsed: gen.modelUsed || selectedModel,
            files: gen.files,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        );
        setActiveIdx(0);
        setTab("preview");
        setPreviewKey((k) => k + 1);
      } else if (gen && gen.files?.length) {
        // Save failed server-side but generation worked. Show ephemerally.
        dispatch(
          addBuild({
            _id: `local-${Date.now()}`,
            title: request.slice(0, 60),
            prompt: request,
            modelUsed: gen.modelUsed || selectedModel,
            files: gen.files,
            _ephemeral: true,
          })
        );
        setActiveIdx(0);
        setTab("preview");
        setPreviewKey((k) => k + 1);
      } else {
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
    if (!files.length) return;
    if (files.length === 1) {
      downloadBlob(files[0].content, files[0].name, mimeFor(files[0].name));
      return;
    }
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

        {/* Model picker */}
        <div className="relative" ref={modelMenuRef}>
          <button
            onClick={() => setModelMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-medium rounded-md text-slate-200 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Choose model"
          >
            <FiZap size={11} className="text-indigo-400" />
            {currentModel?.label || "Model"}
            <FiChevronDown size={11} />
          </button>
          {modelMenuOpen && models.length > 0 && (
            <div className="absolute right-0 top-9 z-30 w-64 rounded-lg bg-zinc-900 border border-white/10 shadow-2xl py-1 max-h-96 overflow-auto">
              {models.map((m) => {
                const isActive = m.id === selectedModel;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      dispatch(setSelectedModel(m.id));
                      setModelMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors cursor-pointer border-none bg-transparent ${
                      isActive ? "bg-indigo-600/20 text-white" : "text-slate-300 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierColor(m.tier)}`}>{m.tier}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{m.description}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

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
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer border-none ${
                    isActive ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 bg-transparent"
                  }`}
                >
                  <Icon size={11} /> {t.label}
                </button>
              );
            })}
          </div>
        )}

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
                  className={`p-1.5 rounded-md transition-colors cursor-pointer border-none ${
                    isActive ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 bg-transparent"
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

      <div className="flex-1 flex overflow-hidden min-h-0">
        {!artifact && !sending && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center">
              <FiZap size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Build a website</h2>
            <p className="text-sm text-slate-400 max-w-md">
              Describe what you want. The AI generates a full single-page site with real content, custom design, and working code. Pick a model, preview it here, tweak with follow-up prompts, download when ready.
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
                    className={`px-4 py-2 text-[11px] font-medium whitespace-nowrap border-r border-white/5 relative bg-transparent cursor-pointer border-none ${
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
          {/* Attached file chip — PDF/PPTX icon + name + size + clear.
              Extracted text is passed as REFERENCE MATERIAL to the coding
              agent on generate. Chip persists across regenerations until
              the user removes it — lets them iterate multiple site variants
              from the same deck. */}
          {attachedFile && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/10">
              <FiFileText
                size={18}
                className={
                  attachedFile.fileType === "pptx"
                    ? "text-amber-500 shrink-0"
                    : "text-red-500 shrink-0"
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 truncate">{attachedFile.name}</p>
                <p className="text-[10px] text-slate-500">
                  {attachedFile.uploading
                    ? "Extracting text..."
                    : `${Math.ceil((attachedFile.size || 0) / 1024)} KB · ${attachedFile.extractedText?.length || 0} chars extracted`}
                </p>
              </div>
              <button
                onClick={clearAttachedFile}
                aria-label="Remove attached file"
                title="Remove attached file"
                className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0"
              >
                <FiX size={14} />
              </button>
            </div>
          )}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Paperclip — attach PDF or PPTX as reference material.
                  Backend extracts text server-side and returns it. Frontend
                  passes that text back on /agent/run so the coding agent
                  can ground the site in the doc's real content. */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx,.ppt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach PDF or PPTX as reference"
                aria-label="Attach PDF or PPTX as reference"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer bg-white/[0.04]"
              >
                <FiPaperclip size={14} />
              </button>
              <span className="text-[10px] text-slate-500">
                Model: <span className="text-slate-300">{currentModel?.label || "Auto"}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {artifact && (
                <button
                  onClick={() => {
                    dispatch(setActiveBuildId(null));
                    inputRef.current?.focus();
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-300 bg-transparent border-none cursor-pointer"
                >
                  New build
                </button>
              )}
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
    </div>
  );
}

function tierColor(tier) {
  switch (tier) {
    case "premium": return "bg-indigo-600/20 text-indigo-300";
    case "fast": return "bg-emerald-600/20 text-emerald-300";
    case "budget": return "bg-amber-600/20 text-amber-300";
    case "free": return "bg-slate-600/20 text-slate-300";
    default: return "bg-white/10 text-slate-400";
  }
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

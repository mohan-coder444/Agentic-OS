import { useState } from "react";
import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import { FiCopy, FiCode, FiEye, FiX } from "react-icons/fi";

export default function ArtifactPanel({ artifact }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [tab, setTab] = useState("code"); // code | preview
  const [showMobile, setShowMobile] = useState(false);
  const files = artifact?.files || [];
  const activeFile = files[activeIdx];

  if (!artifact || !files.length) return null;

  const htmlFile = files.find((f) => f.name === "index.html")?.content || "";
  const cssFile = files.find((f) => f.name === "style.css")?.content || "";
  const jsFile = files.find((f) => f.name === "script.js")?.content || "";
  const canPreview = !!htmlFile;
  const previewDoc = `<!DOCTYPE html><html><head><style>${cssFile}</style></head><body>${htmlFile}<script>${jsFile}</script></body></html>`;

  const activeContent = activeFile?.content || "";

  // Extracted so the same panel renders inline on desktop and in the mobile overlay
  const panelContent = (onClose) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">Artifact</span>
          <span className="text-[11px] text-zinc-500">{files.length} files</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigator.clipboard.writeText(activeContent)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-transparent transition-colors"
          >
            <FiCopy size={12} /> Copy
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close code view"
              title="Close code view"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors duration-150 bg-transparent border-none cursor-pointer"
            >
              <FiX size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Code / Preview toggle — only if canPreview */}
      {canPreview && (
        <div className="flex items-center gap-1 px-3 py-2 bg-white/[0.04] border-b border-white/10 shrink-0">
          {[
            { id: "code", label: "Code", icon: FiCode },
            { id: "preview", label: "Preview", icon: FiEye },
          ].map((t) => {
            const isActive = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${isActive ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                <Icon size={11} /> {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* File tabs — only when code tab */}
      {tab === "code" && (
        <div className="flex border-b border-white/5 overflow-x-auto scrollbar-none shrink-0">
          {files.map((f, idx) => {
            const isActive = activeIdx === idx;
            return (
              <button
                key={f.name}
                onClick={() => setActiveIdx(idx)}
                className={`px-4 py-2 text-[11px] font-medium whitespace-nowrap border-r border-white/5 relative ${isActive ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                {f.name}
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "preview" && canPreview ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="h-full">
            <iframe title="preview" srcDoc={previewDoc} className="w-full h-full bg-white" sandbox="allow-scripts" />
          </motion.div>
        ) : (
          <Editor
            height="100%"
            language={activeFile?.name.endsWith(".css") ? "css" : activeFile?.name.endsWith(".js") ? "javascript" : "html"}
            value={activeContent}
            theme="vs-dark"
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, wordWrap: "on", scrollBeyondLastLine: false }}
          />
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop — inline panel */}
      <div className="mt-3 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 hidden lg:flex flex-col h-[380px]">
        {panelContent()}
      </div>

      {/* Mobile — compact trigger instead of a cramped inline editor */}
      <button
        onClick={() => setShowMobile(true)}
        className="lg:hidden mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-br from-indigo-500 to-violet-700 text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
      >
        <FiCode size={13} /> View code
        <span className="text-[10px] opacity-70">({files.length} files)</span>
      </button>

      {/* Mobile — fullscreen overlay */}
      {showMobile && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-3 flex flex-col">
          <div className="flex-1 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 flex flex-col min-h-0">
            {panelContent(() => setShowMobile(false))}
          </div>
        </div>
      )}
    </>
  );
}

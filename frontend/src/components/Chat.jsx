import { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FiMessageSquare, FiPlus, FiPaperclip, FiMic, FiSend, FiZap, FiGlobe, FiCode, FiFileText, FiImage, FiMenu, FiX } from "react-icons/fi";
import { MdOutlineCoPresent } from "react-icons/md";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodePreview from "./CodePreview";
import ArtifactPanel from "./ArtifactPanel";
import LoadingAnimation from "./LoadingAnimation";
import api from "../axios";
import {
  setConversations,
  setActiveId,
  setMessages,
  addConversation,
  addMessages,
  updateConversationTitle,
} from "../slices/chatSlice";

export default function Chat() {
  const dispatch = useDispatch();
  const { conversations, activeId, messages } = useSelector((s) => s.chat);
  const user = useSelector((s) => s.user.userData);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("auto");
  const agents = [
    { id: "auto", level: "Auto", icon: FiZap },
    { id: "chat", level: "Chat", icon: FiMessageSquare },
    { id: "search", level: "Search", icon: FiGlobe },
    { id: "coding", level: "Coding", icon: FiCode },
    { id: "pdf", level: "PDF", icon: FiFileText },
    { id: "ppt", level: "PPT", icon: MdOutlineCoPresent },
    { id: "image", level: "Image", icon: FiImage },
  ];

  const activeMessages = messages[activeId] || [];

  // Object URL for the image thumbnail — revoked on change/unmount so blobs don't leak.
  // Keyed on the File itself so the upload-complete state update doesn't recreate it.
  const attachedRaw = attachedFile?.file;
  useEffect(() => {
    if (!attachedRaw || !attachedRaw.type?.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(attachedRaw);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachedRaw]);

  const clearAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Load conversations on mount
  useEffect(() => {
    api
      .get("/chat/conversations")
      .then((r) => dispatch(setConversations(r.data.conversations)))
      .catch(() => {});
  }, [dispatch]);

  // Load messages when active changes
  useEffect(() => {
    if (!activeId || messages[activeId]) return;
    api
      .get(`/chat/conversations/${activeId}/messages`)
      .then((r) => dispatch(setMessages({ conversationId: activeId, messages: r.data.messages })))
      .catch(() => {});
  }, [activeId, messages, dispatch]);

  const handleNewChat = async () => {
    try {
      const res = await api.post("/chat/conversations", { title: "New chat" });
      dispatch(addConversation(res.data.conversation));
    } catch (e) {
      console.error("new chat failed:", e.response?.data || e.message);
      alert(`New chat failed: ${e.response?.data?.message || e.message} — please re-login (cookie SameSite was fixed to lax)`);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeId) return;
    const content = input.trim();
    // If a file was uploaded, route to the matching analyzer agent
    const upload = attachedFile?.fileName ? attachedFile : null;
    const agent = upload ? (upload.fileType === "pdf" ? "pdf-rag" : "image-analyzer") : selectedAgent.toLowerCase();
    setInput("");
    clearAttachedFile();
    setSending(true);
    try {
      const agentRes = await api.post("/agent/run", { prompt: content, conversationId: activeId, agent, ...(upload ? { fileName: upload.fileName, fileType: upload.fileType } : {}) });
      const realContent = agentRes.data.aiResponse || "No response";
      const artifacts = agentRes.data.artifacts || [];
      const userMsg = { _id: `u-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() };
      const assistantMsg = { _id: `a-${Date.now() + 1}`, role: "assistant", content: realContent, artifacts, createdAt: new Date().toISOString() };
      dispatch(addMessages({ conversationId: activeId, userMsg, assistantMsg }));
      const activeConv = conversations.find((c) => c._id === activeId);
      if (activeConv?.title === "New chat") {
        dispatch(updateConversationTitle({ id: activeId, title: content.slice(0, 50) }));
      }
    } catch (e) {
      console.error("agent error:", e);
      // Surface the server's message (rate limit, auth, upstream failure) instead
      // of a generic "agent unavailable" — users need to know when to retry.
      const serverMsg = e.response?.data?.message;
      const status = e.response?.status;
      const resetIn = e.response?.data?.resetIn;
      let text = serverMsg || "Error: agent unavailable. Check console.";
      if (status === 429 && resetIn) text = `${serverMsg} (wait ${resetIn}s)`;
      const userMsg = { _id: `u-${Date.now()}`, role: "user", content };
      const assistantMsg = { _id: `a-${Date.now() + 1}`, role: "assistant", content: text };
      dispatch(addMessages({ conversationId: activeId, userMsg, assistantMsg }));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full bg-black text-white">
      {/* Mobile backdrop — tap outside to close the drawer */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar — indigo style, Hour 8: slides in as a drawer under lg */}
      <div
        className={`w-[280px] bg-zinc-900 border-r border-zinc-800 flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3 flex items-center justify-between">
          <span className="font-bold text-white">AgenticOS</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              title="New chat"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition"
            >
              <FiPlus size={16} />
            </button>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
              title="Close sidebar"
              className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer"
            >
              <FiX size={16} />
            </button>
          </div>
        </div>
        <div className="px-3 pb-2">
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition flex items-center justify-center gap-2"
          >
            <FiPlus size={16} /> New chat
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="px-5 pt-4 pb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-slate-600">
            No recent conversations
          </div>
        ) : (
          <div className="px-5 pt-4 pb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-slate-600">Recent</div>
        )}

        <div className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
          {conversations.map((c) => {
            const isActive = activeId === c._id;
            return (
              <button
                key={c._id}
                onClick={() => {
                  dispatch(setActiveId(c._id));
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border text-left transition-colors duration-150 ${
                  isActive ? "bg-indigo-600 border-indigo-500 text-white" : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <div
                  className={`flex items-center justify-center shrink-0 w-7 h-7 rounded-lg transition-colors ${isActive ? "bg-white text-indigo-600" : "bg-zinc-800 text-zinc-400"}`}
                >
                  <FiMessageSquare size={13} />
                </div>
                <span className="text-[13px] truncate">{c.title || "New chat"}</span>
              </button>
            );
          })}
        </div>

        <div className="mx-2.5 h-px bg-white/5" />
        <div className="px-3.5 py-3.5">
          {user ? (
            <div className="flex items-center gap-2.5">
              {user.avatar ? (
                <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  {(user.name || user.email || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name || user.email}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 text-center">Not logged in</p>
          )}
        </div>
      </div>

      {/* Main — MessageList + ChatInput */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0">
        {/* Mobile top bar — hamburger opens the sidebar drawer */}
        <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-white/5 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
            title="Open sidebar"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors duration-150 bg-transparent border-none cursor-pointer"
          >
            <FiMenu size={16} />
          </button>
          <span className="text-xs font-semibold text-slate-400 truncate">AgenticOS</span>
        </div>
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <p className="text-lg">Select or create a conversation</p>
              <p className="text-xs mt-1 text-zinc-600">Messages are stored per conversation — like ChatGPT</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: "none" }}>
              {activeMessages.length === 0 && !sending ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Cortex AI</h1>
                  <p className="text-[13px] text-slate-600 max-w-[260px] leading-relaxed">How can I help you? Ask me anything — code, ideas, explanations, or just a question.</p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                    {["Write a Netflix clone", "Explain Redis", "Build a dashboard"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setInput(t)}
                        className="text-xs text-slate-400 bg-white/[0.04] border border-white/7 px-3 py-1.5 rounded-full hover:bg-white/[0.08] hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                activeMessages.map((m) => {
                  const isPdf = m.role === "assistant" && /pdf/i.test(m.content);
                  const s3Match = m.content.match(/https:\/\/[^\s]+\.pdf[^\s]*/i) || m.content.match(/https:\/\/mock-s3[^\s]*/i);
                  const s3Url = s3Match ? s3Match[0] : null;
                  const downloadPdf = async (e) => {
                    e?.preventDefault();
                    e?.stopPropagation();
                    console.log("Download PDF clicked, s3Url:", s3Url);
                    if (s3Url && s3Url.includes("s3.amazonaws.com")) {
                      // Real S3 presigned URL — open directly
                      window.open(s3Url, "_blank");
                      // Also trigger download
                      try {
                        const res = await fetch(s3Url);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = s3Url.split("/").pop().split("?")[0];
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        return;
                      } catch {}
                    }
                    // Fallback: generate PDF locally from markdown (handle long content with multi-pages)
                    try {
                      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
                      const pdfDoc = await PDFDocument.create();
                      let page = pdfDoc.addPage([595, 842]);
                      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                      const sanitized = m.content.replace(/[^\x00-\x7F]/g, "");
                      const lines = sanitized.split("\n");
                      let y = 750;
                      page.drawText("Cortex AI — PDF", { x: 50, y, size: 14, font: fontBold, color: rgb(0.2,0.2,0.8) });
                      y -= 20;
                      page.drawText("Generated by AgenticOS", { x: 50, y, size: 8, font, color: rgb(0.5,0.5,0.5) });
                      y -= 20;
                      for (const line of lines) {
                        if (y < 30) {
                          page = pdfDoc.addPage([595, 842]);
                          y = 780;
                        }
                        try {
                          page.drawText(line.slice(0, 90), { x: 50, y, size: 8, font, color: rgb(0,0,0) });
                        } catch {}
                        y -= 10;
                      }
                      const bytes = await pdfDoc.save();
                      const blob = new Blob([bytes], { type: "application/pdf" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "AgenticOS.pdf";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (err) {
                      console.error("PDF gen failed:", err);
                      alert("PDF generation failed: " + err.message);
                    }
                  };
                  return (
                    <div key={m._id} className={m.role === "user" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[85%]"}>
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-indigo-600 text-white whitespace-pre-wrap" : "bg-zinc-800 text-white"}`}>
                        {m.role === "user" ? (
                          m.content
                        ) : (
                          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-table:border prose-table:border-zinc-700 prose-th:bg-zinc-900 prose-th:p-2 prose-th:text-left prose-td:p-2 prose-tr:border-b prose-tr:border-zinc-800 prose-strong:text-white">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                      {m.role === "assistant" && !m.artifacts?.length && <CodePreview content={m.content} />}
                      {m.artifacts?.length > 0 && <ArtifactPanel artifact={m.artifacts[0]} />}
                      {isPdf && (
                        <button onClick={downloadPdf} className="mt-2 text-xs px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-500">
                          Download PDF
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              {/* Multi-phase loader — shown until the agent responds */}
              {sending && <LoadingAnimation />}
            </div>
            {/* Agent Selector — Hour 10 */}
            <div className="px-3 pt-3 flex flex-wrap gap-2">
              {agents.map((a) => {
                const isActive = selectedAgent === a.level.toLowerCase() || selectedAgent === a.id;
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAgent(a.level.toLowerCase())}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer flex-shrink-0 ${isActive ? "bg-gradient-to-br from-indigo-500 to-violet-700 text-white border-transparent shadow" : "bg-white/[0.04] text-slate-400 border-white/10 hover:bg-white/[0.08] hover:text-slate-200"}`}
                  >
                    <Icon size={14} className={isActive ? "text-white" : "text-slate-500"} />
                    {a.level}
                  </button>
                );
              })}
            </div>
            {/* ChatInput — Hour 8: textarea + paperclip/mic + gradient Send */}
            <div className="p-3 m-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col gap-2">
              {/* Attached file chip — PDF icon or image thumbnail, name, size, clear */}
              {attachedFile && (
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/10">
                  {attachedFile.type === "application/pdf" || attachedFile.name?.toLowerCase().endsWith(".pdf") ? (
                    <FiFileText size={18} className="text-red-500 shrink-0" />
                  ) : previewUrl ? (
                    <img src={previewUrl} alt={attachedFile.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <FiImage size={18} className="text-indigo-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 truncate">{attachedFile.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {attachedFile.uploading ? "Uploading..." : `${Math.ceil((attachedFile.size || 0) / 1024)} KB`}
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything..."
                rows={1}
                className="w-full bg-transparent outline-none resize-none text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed min-h-[24px] max-h-[120px]"
                disabled={sending}
                style={{ scrollbarWidth: "none" }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const meta = { name: f.name, file: f, size: f.size, type: f.type };
                    setAttachedFile({ ...meta, uploading: true });
                    try {
                      const form = new FormData();
                      form.append("file", f);
                      const res = await api.post("/agent/upload", form);
                      const { fileName, fileType } = res.data;
                      setAttachedFile({ ...meta, fileName, fileType });
                      // Chip shows the file, so only seed a prompt when the box is empty
                      setInput((prev) => prev || (fileType === "pdf" ? "Summarize this PDF" : "Describe this image"));
                    } catch (err) {
                      console.error("upload failed:", err.response?.data || err.message);
                      alert(`Upload failed: ${err.response?.data?.message || err.message}`);
                      clearAttachedFile();
                    }
                  }} />
                  <button onClick={() => fileInputRef.current?.click()} title="Attach PDF/image" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer bg-white/[0.04]">
                    <FiPaperclip size={16} />
                  </button>
                  <button onClick={() => alert("Voice input coming soon — for now type your prompt")} title="Voice" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-400 hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer">
                    <FiMic size={16} />
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all ${input.trim() ? "bg-gradient-to-br from-indigo-500 to-violet-700 text-white hover:opacity-90" : "bg-zinc-800 text-zinc-600"} disabled:opacity-50`}
                >
                  <FiSend size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

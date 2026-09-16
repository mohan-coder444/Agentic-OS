export default function CodePreview({ content }) {
  let html = null;
  // Try to find the largest HTML block — the dashboard is usually the *last* code block
  const allBlocks = [...content.matchAll(/```(?:html)?\n?([\s\S]*?)```/gi)];
  if (allBlocks.length > 0) {
    // Pick the longest block (the dashboard, not a small CSS fragment)
    html = allBlocks.map(m => m[1]).sort((a,b) => b.length - a.length)[0].trim();
    // If the longest block is CSS-only, wrap it — but prefer a block that contains <html or <!DOCTYPE
    const htmlBlock = allBlocks.find(m => /<html|<!DOCTYPE/i.test(m[1]));
    if (htmlBlock) html = htmlBlock[1].trim();
  } else if (content.includes("<!DOCTYPE") || content.includes("<html")) {
    // Raw HTML without fences (extract from first <html to last </html>)
    const start = content.indexOf("<");
    const end = content.lastIndexOf("</html>");
    html = end > start ? content.slice(start, end + 7) : content.slice(start);
  }
  if (!html || html.length < 50) return null;
  // If the extracted block is CSS-only (no <html), wrap it
  if (!/<html/i.test(html) && (html.includes(".stats-grid") || html.includes("display: grid"))) {
    html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${html}</style></head><body style="font-family: sans-serif; padding: 20px; background: #f5f7fa;"><h2 style="color: #4361ee;">Dashboard Preview</h2><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;"><div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"><h3>Revenue</h3><p style="font-size: 24px; font-weight: 700;">$12,345</p></div><div style="background: white; padding: 20px; border-radius: 10px;"><h3>Users</h3><p style="font-size: 24px; font-weight: 700;">1,234</p></div></div></body></html>`;
  }
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-zinc-800 bg-white">
      <div className="px-3 py-1.5 bg-zinc-900 text-xs text-zinc-400 border-b border-zinc-800">Live Preview</div>
      <iframe
        title="preview"
        srcDoc={html}
        className="w-full h-[300px] bg-white"
        sandbox="allow-scripts"
      />
    </div>
  );
}

import fs from "fs";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";

// PPTX is a ZIP containing XML per slide. We only care about the text inside
// <a:t> tags — headings, bullets, notes. Everything else (positions, styles,
// theme colors) is design noise the coding agent doesn't need.
//
// Slides live at ppt/slides/slide1.xml, slide2.xml, ... We sort by number so
// slide order matches the deck. If a slide has speaker notes those live in a
// parallel notesSlides/ folder we could add later; skipping for now.
export async function extractPptxText(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)[1]);
      const nb = Number(b.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });

  const slides = [];
  for (const name of slideEntries) {
    const xml = await zip.file(name).async("string");
    // Grab everything between <a:t> tags. Simple regex is fine here because
    // pptx XML has no nested a:t elements. Multiple runs on one line stay
    // space-separated so "Hello World" doesn't become "HelloWorld".
    const runs = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) =>
      decodeXmlEntities(m[1])
    );
    const slideText = runs.join(" ").replace(/\s+/g, " ").trim();
    if (slideText) slides.push(`Slide ${slides.length + 1}: ${slideText}`);
  }

  return slides.join("\n\n");
}

// PDF text via pdf-parse v2. Same shape as the existing /upload code path.
export async function extractPdfText(filePath) {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  const data = await parser.getText();
  return (data.text || "").replace(/\s+/g, " ").trim();
}

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

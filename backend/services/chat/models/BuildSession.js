import mongoose from "mongoose";

// A single file inside a build artifact. Same shape the frontend already
// expects (see BuildView.jsx and ArtifactPanel.jsx).
const fileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

// One build session = one prompt + resulting artifact. Separate from
// Conversation because it's a fundamentally different shape (single artifact
// vs many messages) and users expect them to live in different sidebars.
const buildSessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    // Short human-readable title derived from the prompt (first ~60 chars).
    // Same convention as Conversation.title.
    title: { type: String, default: "Untitled build" },
    // Full prompt text kept so users can see what they asked for.
    prompt: { type: String, required: true },
    // Model that produced the artifact. Free-text so we can log auto-selected
    // provider (e.g. "auto:bedrock") alongside explicit ("claude-sonnet-4").
    modelUsed: { type: String, default: "auto" },
    // The generated files. Single artifact per session, keeps the shape flat.
    files: { type: [fileSchema], default: [] },
  },
  { timestamps: true }
);

const BuildSession = mongoose.model("BuildSession", buildSessionSchema);
export default BuildSession;

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Cycles through phase phrases so waits over 2s feel like progress, not a hang.
// AnimatePresence swaps them with a scale/fade so it reads as animation, not a jump.
const PHASES = ["Thinking", "Analyzing", "Generating", "Almost there"];

export default function LoadingAnimation() {
  const [levelIndex, setLevelIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLevelIndex((prev) => (prev + 1) % PHASES.length);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="mr-auto max-w-[85%]"
      role="status"
      aria-live="polite"
      aria-label="Generating response"
    >
      <div className="rounded-2xl px-4 py-3 bg-zinc-800 inline-flex items-center gap-3">
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400"
              initial={{ scale: 0.6, opacity: 0.4 }}
              animate={{ scale: [0.6, 1, 0.6], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15,
              }}
            />
          ))}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={levelIndex}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="text-xs text-slate-400"
          >
            {PHASES[levelIndex]}...
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

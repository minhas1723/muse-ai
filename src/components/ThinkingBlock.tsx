import React, { useState, useEffect, useRef } from "react";
import { renderMarkdown } from "./MarkdownRenderer";

interface ThinkingBlockProps {
  thinking: string;
  /** True while the parent message is still streaming */
  isStreaming: boolean;
  /** True when this is the last (in-progress) message */
  isLast: boolean;
  /** True once the answer text has started arriving */
  hasAnswer: boolean;
}

export function ThinkingBlock({ thinking, isStreaming, isLast, hasAnswer }: ThinkingBlockProps) {
  // Auto-expand while thinking is streaming; auto-collapse once answer starts.
  // After that the user can manually toggle.
  const [open, setOpen] = useState(true);
  const [manuallyToggled, setManuallyToggled] = useState(false);
  const [collapsedAt, setCollapsedAt] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-collapse the moment the answer appears, unless user has taken control
  useEffect(() => {
    if (hasAnswer && !manuallyToggled && open) {
      setOpen(false);
      setCollapsedAt(Date.now());
    }
  }, [hasAnswer, manuallyToggled]);

  // Keep the thinking text scrolled to the bottom while streaming
  useEffect(() => {
    if (open && scrollRef.current && isStreaming && !hasAnswer) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking, open, isStreaming, hasAnswer]);

  const handleToggle = () => {
    setManuallyToggled(true);
    setOpen((v) => !v);
  };

  // Estimate seconds of thinking time
  const thoughtSeconds = collapsedAt
    ? null // always show "Thought for Xs" chip after collapse
    : null;
  void thoughtSeconds;

  const isActivelyThinking = isLast && isStreaming && !hasAnswer;

  return (
    <div className="mb-2 w-full select-none">
      {/* ── Header chip ── */}
      <button
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[length:var(--font-size-xs)] font-medium transition-all group ${
          open
            ? "bg-accent-primary/8 text-accent-primary hover:bg-accent-primary/14"
            : "bg-transparent text-text-tertiary hover:bg-surface-1 hover:text-text-secondary"
        }`}
      >
        {/* Icon — pulsing brain when live, static when done */}
        <span className={`text-[13px] leading-none ${isActivelyThinking ? "animate-pulse" : ""}`}>
          💭
        </span>

        {isActivelyThinking ? (
          <span className="flex items-center gap-1.5">
            Thinking
            <span className="flex gap-[3px] items-center">
              <span className="w-1 h-1 rounded-full bg-accent-primary/70 animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-accent-primary/70 animate-bounce [animation-delay:120ms]" />
              <span className="w-1 h-1 rounded-full bg-accent-primary/70 animate-bounce [animation-delay:240ms]" />
            </span>
          </span>
        ) : (
          <span>Thought process</span>
        )}

        {/* Chevron */}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          className={`ml-0.5 shrink-0 transition-transform duration-200 opacity-60 group-hover:opacity-100 ${
            open ? "rotate-180" : ""
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Expandable body ── */}
      {open && (
        <div
          ref={scrollRef}
          className="mt-1 pl-1 text-[length:var(--font-size-xs)] text-text-secondary leading-relaxed max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent animate-slide-up"
        >
          {renderMarkdown(thinking)}
          {/* Blinking cursor at the end while streaming */}
          {isActivelyThinking && (
            <span className="inline-block w-[2px] h-[1em] ml-[1px] bg-accent-primary/60 animate-pulse align-middle" />
          )}
        </div>
      )}
    </div>
  );
}

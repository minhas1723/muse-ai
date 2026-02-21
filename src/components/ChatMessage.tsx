import React, { useState, useEffect } from "react";
import type { Message } from "../types";
import { renderMarkdown } from "./MarkdownRenderer";
import { ThinkingBlock } from "./ThinkingBlock";

// ─── Slot Machine Text Animation ───
function SlotText({ items, isAnimating }: { items: string[]; isAnimating: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (!isAnimating || items.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
      setAnimKey(prev => prev + 1);
    }, 700);

    return () => clearInterval(interval);
  }, [isAnimating, items.length]);

  if (items.length === 0) return null;

  // Static: show all items
  if (!isAnimating) {
    return <span className="font-mono opacity-70">{items.join(", ")}</span>;
  }

  // Animating: single item rolling through
  return (
    <span
      className="inline-flex overflow-hidden font-mono opacity-70"
      style={{ height: "1.3em", verticalAlign: "middle", minWidth: "3em" }}
    >
      <span key={animKey} className="slot-roll-in">
        {items[currentIndex]}
      </span>
    </span>
  );
}

interface ChatMessageProps {
  message: Message;
  isLast: boolean;
  model: string;
  isStreaming: boolean;
}

export function ChatMessage({ message, isLast, model, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  // Tool animations run until the LLM starts producing text
  const toolsAnimating = isLast && isStreaming && !message.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className={`flex px-4 py-1.5 animate-fade-in ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div className={`${isUser ? "max-w-[85%]" : "w-full"}`}>
        {/* Thinking — only for assistant, shown above content */}
        {!isUser && message.thinking && (
          <ThinkingBlock
            thinking={message.thinking}
            isStreaming={isStreaming}
            isLast={isLast}
            hasAnswer={message.content.length > 0}
          />
        )}

        {/* Tool calls — subtle inline indicators above content */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-1 flex flex-col gap-0.5">
            {message.toolCalls.map((tc, i) => {
              const isRead = tc.name === "read_editable_content";
              const isWrite = tc.name === "write_editable_content";
              const isEditorTool = isRead || isWrite;
              const source = tc.source ?? "latest";
              const round = tc.round ?? 0;

              // Build list of items to animate
              let items: string[] = [];
              if (isRead) {
                items = tc.args?.keys
                  ? tc.args.keys
                  : tc.args?.key
                    ? [tc.args.key]
                    : [];
              } else if (isWrite) {
                items = tc.args?.key ? [tc.args.key] : [];
              } else {
                const indices: number[] = tc.args?.indices ?? [];
                items = indices.map((idx: number) => `section ${idx}`);
              }

              let label: string;
              let icon: string;
              if (isWrite) {
                label = "Editing editor";
                icon = "✏";
              } else if (isRead) {
                label = "Reading editor";
                icon = "✎";
              } else if (source === "previous") {
                label = "Reviewing previous state";
                icon = "◷";
              } else if (round > 0) {
                label = "Re-reading page";
                icon = "⊙";
              } else {
                label = "Scanning page";
                icon = "⊙";
              }

              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 py-0.5 text-[length:var(--font-size-xs)] text-text-tertiary"
                >
                  <span className="opacity-60">{icon}</span>
                  <span className="italic">{label}</span>
                  {toolsAnimating && items.length > 0 && (
                    <>
                      <span className="opacity-40">—</span>
                      <SlotText items={items} isAnimating={toolsAnimating} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div
          className={`text-[length:var(--font-size-base)] leading-[1.6] break-words ${
            isUser
              ? "rounded-2xl rounded-br-md px-3.5 py-2 bg-surface-1 border border-border text-text-primary"
              : "text-text-primary"
          }`}
        >
          {!isUser && !message.content && isLast ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary/60 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary/60 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary/60 animate-bounce [animation-delay:300ms]" />
            </div>
          ) : (
            renderMarkdown(message.content)
          )}
        </div>

        {/* Action buttons — info + copy */}
        {!isUser && message.content && (
          <div className="flex items-center gap-1 mt-1.5">
            {/* Info tooltip */}
            {message.usage && (
              <div className="relative group">
                <button
                  className="w-5 h-5 p-0 flex items-center justify-center rounded text-text-tertiary/50 hover:text-text-secondary hover:bg-surface-1 transition-colors"
                  tabIndex={-1}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
                <div className="absolute bottom-full left-0 mb-1.5 px-2.5 py-1.5 bg-neutral-800 text-white text-[length:var(--font-size-xxs)] rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-20">
                  {message.usage.total} tokens ({message.usage.input} in, {message.usage.output} out) · {message.model || model}
                  <div className="absolute top-full left-[6px] w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-800" />
                </div>
              </div>
            )}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="w-5 h-5 p-0 flex items-center justify-center rounded text-text-tertiary/50 hover:text-text-secondary hover:bg-surface-1 transition-colors"
              title="Copy message"
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import type { Message } from "../types";
import { renderMarkdown } from "./MarkdownRenderer";

interface ChatMessageProps {
  message: Message;
  isLast: boolean;
  model: string;
}

export function ChatMessage({ message, isLast, model }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

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
          <div className="mb-1.5 w-full text-xs">
            <details>
              <summary className="cursor-pointer text-text-tertiary text-[length:var(--font-size-xs)] py-1 select-none flex items-center gap-1 hover:text-text-primary transition-colors">
                <span className="opacity-70">Thinking Process</span>
              </summary>
              <div className="mt-1 p-2.5 bg-surface-1 rounded-lg text-[length:var(--font-size-xs)] text-text-secondary whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto border border-border">
                {renderMarkdown(message.thinking)}
              </div>
            </details>
          </div>
        )}

        {/* Tool calls — only for assistant, shown above content */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-1.5 flex flex-col gap-1.5">
            {message.toolCalls.map((tc, i) => {
              const source = tc.source ?? "latest";
              const round = tc.round ?? 0;
              const indices = tc.args?.indices ?? [];
              const sectionLabel = indices.length === 1
                ? `section ${indices[0]}`
                : `sections ${indices.join(", ")}`;

              let label: string;
              let icon: React.ReactNode;

              if (source === "previous") {
                label = "Reviewing previous state";
                icon = (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 8 14" />
                  </svg>
                );
              } else if (round > 0) {
                label = "Re-reading page";
                icon = (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                );
              } else {
                label = "Scanning page";
                icon = (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                );
              }

              return (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-1 border border-border text-[length:var(--font-size-xs)] w-fit transition-colors"
                >
                  <span className="text-accent-primary">{icon}</span>
                  <span className="font-medium text-text-secondary">{label}</span>
                  <span className="text-text-tertiary">·</span>
                  <span className="text-text-tertiary font-mono">{sectionLabel}</span>
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

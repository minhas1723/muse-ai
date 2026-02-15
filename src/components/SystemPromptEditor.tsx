import React, { useState, useRef, useEffect } from "react";

interface SystemPromptEditorProps {
  systemPrompt: string;
  onSystemPromptChange: (val: string) => void;
}

export function SystemPromptEditor({
  systemPrompt,
  onSystemPromptChange,
}: SystemPromptEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(systemPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasPrompt = systemPrompt.trim().length > 0;

  // Sync draft when systemPrompt changes externally
  useEffect(() => {
    if (!isOpen) {
      setDraft(systemPrompt);
    }
  }, [systemPrompt, isOpen]);

  // Auto-focus textarea when panel opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, draft]);

  const handleClose = () => {
    // Auto-save on close
    onSystemPromptChange(draft);
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraft("");
    onSystemPromptChange("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* ── Chip Toggle ── */}
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            handleClose();
          } else {
            setDraft(systemPrompt);
            setIsOpen(true);
          }
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
          isOpen
            ? "bg-accent-primary/10 text-accent-primary"
            : hasPrompt
              ? "bg-accent-primary/8 text-accent-primary hover:bg-accent-primary/15"
              : "bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        }`}
        title={hasPrompt ? "Edit system prompt" : "Add system prompt"}
      >
        {/* Sparkles icon */}
        <div className="relative">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
          </svg>
          {hasPrompt && !isOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent-primary rounded-full border border-bg-primary" />
          )}
        </div>
        System
        {isOpen && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="transition-transform duration-200"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        )}
      </button>

      {/* ── Expanding Editor Panel ── */}
      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[260px] max-w-[calc(100vw-32px)] z-40 animate-slide-up">
          <div className="bg-bg-primary border border-border rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-bg-secondary/50">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                System Prompt
              </span>
              <div className="flex items-center gap-1">
                {hasPrompt && (
                  <span className="text-[10px] text-text-tertiary mr-1">
                    {systemPrompt.trim().length} chars
                  </span>
                )}
              </div>
            </div>

            {/* Textarea */}
            <div className="p-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. You are a senior developer who explains code clearly..."
                rows={3}
                className="w-full p-2 bg-bg-secondary/40 border border-transparent rounded-lg text-text-primary text-xs leading-relaxed resize-y min-h-[60px] max-h-[160px] outline-none transition-all placeholder:text-text-tertiary focus:border-accent-primary/30 focus:bg-bg-primary"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border-subtle bg-bg-secondary/30">
              <button
                type="button"
                onClick={handleClear}
                disabled={!draft.trim()}
                className="text-[11px] text-text-tertiary hover:text-red-500 transition-colors disabled:opacity-30 disabled:hover:text-text-tertiary px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="text-[11px] font-medium text-white bg-gradient-to-r from-accent-primary to-accent-secondary px-3 py-1 rounded-lg hover:shadow-md transition-all hover:-translate-y-px"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

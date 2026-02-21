import React, { useState, useRef, useEffect } from "react";
import {
  DEFAULT_PERSONALITIES,
  CUSTOM_ID,
  NONE_ID,
  type Personality,
} from "../personalities";

interface PersonalityPickerProps {
  activeId: string;
  customPrompt: string;
  onSelect: (id: string) => void;
  onCustomPromptChange: (val: string) => void;
}

export function PersonalityPicker({
  activeId,
  customPrompt,
  onSelect,
  onCustomPromptChange,
}: PersonalityPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customDraft, setCustomDraft] = useState(customPrompt);
  const containerRef = useRef<HTMLDivElement>(null);
  const customTextareaRef = useRef<HTMLTextAreaElement>(null);

  const activePersonality: Personality | undefined = DEFAULT_PERSONALITIES.find(
    (p) => p.id === activeId
  );
  const isActive = activeId !== NONE_ID;

  // Sync draft when customPrompt changes externally
  useEffect(() => {
    if (!isOpen) setCustomDraft(customPrompt);
  }, [customPrompt, isOpen]);

  // Auto-focus textarea when custom editor opens
  useEffect(() => {
    if (showCustomEditor && customTextareaRef.current) {
      customTextareaRef.current.focus();
    }
  }, [showCustomEditor]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, customDraft]);

  const handleClose = () => {
    // Auto-save custom prompt on close
    if (showCustomEditor) onCustomPromptChange(customDraft);
    setIsOpen(false);
    setShowCustomEditor(false);
  };

  const handleSelect = (id: string) => {
    if (id === CUSTOM_ID) {
      setShowCustomEditor(true);
      onSelect(CUSTOM_ID);
    } else {
      onSelect(id);
      setIsOpen(false);
      setShowCustomEditor(false);
    }
  };

  const buttonLabel = activeId === CUSTOM_ID
    ? "Custom"
    : (activePersonality?.label ?? "Default");
  const buttonEmoji = activeId === CUSTOM_ID
    ? "✏️"
    : (activePersonality?.emoji ?? "✦");

  return (
    <div className="relative" ref={containerRef}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            handleClose();
          } else {
            setCustomDraft(customPrompt);
            setShowCustomEditor(activeId === CUSTOM_ID);
            setIsOpen(true);
          }
        }}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary ${isOpen ? "bg-bg-hover text-text-primary" : "bg-transparent"
          }`}
        title="Personality"
      >
        <span>{buttonLabel}</span>
        <svg
          width="8" height="8" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Dropdown Panel ── */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-[230px] max-w-[calc(100vw-32px)] z-40 animate-slide-up">
          <div className="bg-bg-primary border border-border rounded-xl shadow-lg overflow-hidden">

            {/* Header */}
            <div className="px-3 py-2 border-b border-border-subtle bg-bg-secondary/50">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Personality
              </span>
            </div>

            {/* Personality List */}
            <div className="p-1.5 space-y-0.5">
              {DEFAULT_PERSONALITIES.map((p) => {
                const isSelected = activeId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${isSelected
                      ? "bg-accent-primary/10 text-accent-primary"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                      }`}
                  >
                    <span className="text-[15px] leading-none shrink-0">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] font-medium leading-tight ${isSelected ? "text-accent-primary" : "text-text-primary"}`}>
                        {p.label}
                      </div>
                      <div className="text-[10px] text-text-tertiary truncate leading-tight mt-0.5">
                        {p.description}
                      </div>
                    </div>
                    {isSelected && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}

              {/* Divider + Custom option */}
              <div className="my-1 border-t border-border-subtle" />
              <button
                type="button"
                onClick={() => handleSelect(CUSTOM_ID)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${activeId === CUSTOM_ID
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
              >
                <span className="text-[15px] leading-none shrink-0">✏️</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-medium leading-tight ${activeId === CUSTOM_ID ? "text-accent-primary" : "text-text-primary"}`}>
                    Custom
                  </div>
                  <div className="text-[10px] text-text-tertiary truncate leading-tight mt-0.5">
                    Write your own system prompt
                  </div>
                </div>
                {activeId === CUSTOM_ID && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </div>

            {/* ── Custom Prompt Editor (inline, only when Custom selected) ── */}
            {showCustomEditor && (
              <div className="border-t border-border-subtle">
                <div className="p-2">
                  <textarea
                    ref={customTextareaRef}
                    value={customDraft}
                    onChange={(e) => setCustomDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && handleClose()}
                    placeholder="e.g. You are a senior developer who explains code clearly..."
                    rows={4}
                    className="w-full p-2 bg-bg-secondary/40 border border-transparent rounded-lg text-text-primary text-xs leading-relaxed resize-y min-h-[72px] max-h-[140px] outline-none transition-all placeholder:text-text-tertiary focus:border-accent-primary/30 focus:bg-bg-primary"
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2 border-t border-border-subtle bg-bg-secondary/30">
                  <button
                    type="button"
                    onClick={() => { setCustomDraft(""); onCustomPromptChange(""); }}
                    disabled={!customDraft.trim()}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

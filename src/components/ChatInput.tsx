import React, { type FormEvent, useState, useRef, useEffect, useLayoutEffect } from "react";
import { useTheme } from "../hooks/useTheme";

import type { AuthProvider } from "../providers";
import { PersonalityPicker } from "./PersonalityPicker";

export interface ChatInputProps {
  input: string;
  onInputChange: (val: string) => void;
  onSend: (e?: FormEvent) => void;
  onStop?: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isStreaming: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  model: string;
  onModelChange: (val: string) => void;
  onLogout: () => void;
  agentMode: "ask" | "edit";
  onAgentModeChange: (mode: "ask" | "edit") => void;
  activePersonalityId: string;
  onPersonalityChange: (id: string) => void;
  customPrompt: string;
  onCustomPromptChange: (val: string) => void;
  thinkingLevel: "high" | "low";
  onThinkingLevelChange: (level: "high" | "low") => void;
  provider?: AuthProvider;
}

const GEMINI_MODELS = [
  { value: "gemini-3-pro-preview", label: "Gemini 3.0 Pro" },
  { value: "gemini-3-flash-preview", label: "Gemini 3.0 Flash" },
];

const CLAUDE_MODELS: { value: string; label: string }[] = [
  // Claude models are currently restricted/unavailable for this account project.
  // { value: "claude-sonnet-4-5-thinking", label: "Claude Sonnet 4.5 (Beta)" },
];

export function ChatInput({
  input,
  onInputChange,
  onSend,
  onStop,
  onKeyDown,
  isStreaming,
  inputRef,
  model,
  onModelChange,
  onLogout,
  agentMode,
  onAgentModeChange,
  activePersonalityId,
  onPersonalityChange,
  customPrompt,
  onCustomPromptChange,
  thinkingLevel,
  onThinkingLevelChange,
  provider,
}: ChatInputProps) {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();

  const MODELS = provider === "antigravity"
    ? [...CLAUDE_MODELS, ...GEMINI_MODELS]
    : GEMINI_MODELS;

  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const currentModel = MODELS.find((m) => m.value === model) || MODELS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Model menu
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelOpen(false);
      }
      // Mode menu
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeOpen(false);
      }
      // Settings menu
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isModelOpen || isModeOpen || isSettingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isModelOpen, isModeOpen, isSettingsOpen]);

  // Auto-resize logic
  useLayoutEffect(() => {
    if (inputRef.current) {
      const minHeight = 40; // Match min-h-[40px]

      // Only check if we need to resize when scrollHeight exceeds current height
      if (inputRef.current.scrollHeight > inputRef.current.offsetHeight) {
        inputRef.current.style.height = "auto";
        const newHeight = Math.max(minHeight, inputRef.current.scrollHeight);
        inputRef.current.style.height = `${newHeight}px`;
      } else if (input === "") {
        // Reset to min height when cleared
        inputRef.current.style.height = `${minHeight}px`;
      }
    }
  }, [input, inputRef]);

  return (
    <div className="bg-bg-primary p-3">
      <div className="bg-bg-primary border border-border rounded-2xl transition-colors focus-within:border-accent-primary focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.08)]">
        {/* Textarea Area with Send Button */}
        <div className="relative p-4 pb-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything..."
            className="w-full bg-transparent border-none text-text-primary font-sans text-[length:var(--font-size-base)] leading-[1.6] resize-none outline-none min-h-[40px] max-h-[160px] placeholder:text-text-tertiary disabled:opacity-60 pr-10"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onStop?.();
              }}
              className="absolute top-4 right-4 w-[28px] h-[28px] p-0 shrink-0 flex items-center justify-center rounded-[8px] transition-colors bg-text-primary hover:bg-red-500 group"
              title="Stop generating"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-bg-primary transition-colors">
                <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onSend();
              }}
              className="absolute top-4 right-4 w-[28px] h-[28px] p-0 shrink-0 flex items-center justify-center rounded-[8px] transition-colors disabled:text-text-tertiary text-text-primary"
              disabled={!input.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Bottom Row - Buttons */}
        <div className="px-4 pb-3 pt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Ask / Edit Mode Selector */}
            <div className="relative" ref={modeMenuRef}>
              <button
                type="button"
                onClick={() => setIsModeOpen(!isModeOpen)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary ${isModeOpen ? "bg-bg-hover text-text-primary" : "bg-transparent"
                  }`}
              >
                <span className="capitalize">{agentMode}</span>
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`transition-transform duration-200 ${isModeOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isModeOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-[180px] bg-bg-primary border border-border shadow-lg rounded-xl overflow-hidden animate-slide-up z-30">
                  <div className="p-1.5">
                    {[
                      {
                        value: "ask" as const,
                        label: "Ask",
                        icon: (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        ),
                        desc: "Read-only, lower token usage",
                      },
                      {
                        value: "edit" as const,
                        label: "Edit",
                        icon: (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a1.5 1.5 0 0 1 2.1 2.1L12 13.2l-3.5.9.9-3.5L18.5 2.5z" />
                          </svg>
                        ),
                        desc: "Can type into fields & edit code",
                      },
                    ].map((m) => {
                      const isSelected = m.value === agentMode;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            onAgentModeChange(m.value);
                            setIsModeOpen(false);
                          }}
                          className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-left ${isSelected
                            ? "bg-accent-primary/10 text-accent-primary"
                            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                            }`}
                        >
                          <div className={`mt-0.5 shrink-0 ${isSelected ? "text-accent-primary" : "text-text-tertiary"}`}>
                            {m.icon}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-[length:var(--font-size-sm)] ${isSelected ? "font-semibold" : "font-medium"}`}>
                              {m.label}
                            </span>
                            <span className="text-[10px] text-text-tertiary leading-[1.3] block">
                              {m.desc}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="ml-auto mt-0.5 shrink-0 text-accent-primary">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Model Selector */}
            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setIsModelOpen(!isModelOpen)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary ${isModelOpen ? "bg-bg-hover text-text-primary" : "bg-transparent"
                  }`}
              >
                {currentModel.label}
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`transition-transform duration-200 ${isModelOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isModelOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-[180px] bg-bg-primary border border-border shadow-lg rounded-xl overflow-hidden animate-slide-up z-30">
                  <div className="p-1.5">
                    {MODELS.map((m) => {
                      const isSelected = m.value === model;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            onModelChange(m.value);
                            setIsModelOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-[length:var(--font-size-sm)] rounded-lg transition-colors ${isSelected
                            ? "bg-accent-primary/10 text-accent-primary font-semibold"
                            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                            }`}
                        >
                          {m.label}
                          {isSelected && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Personality Picker */}
            <PersonalityPicker
              activeId={activePersonalityId}
              customPrompt={customPrompt}
              onSelect={onPersonalityChange}
              onCustomPromptChange={onCustomPromptChange}
            />

            <div className="relative" ref={settingsMenuRef}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`w-[22px] h-[22px] p-0 rounded flex items-center justify-center transition-colors ${isSettingsOpen
                  ? "bg-bg-hover text-text-primary"
                  : "bg-transparent text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                title="Settings"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </button>

              {isSettingsOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-[200px] bg-bg-primary border border-border shadow-lg rounded-xl overflow-hidden animate-slide-up z-30 flex flex-col">

                  {/* Theme Toggle */}
                  <div className="p-3 border-b border-border">
                    <div className="text-[11px] font-medium text-text-tertiary mb-2 px-1 uppercase tracking-wider">Appearance</div>
                    <div className="flex bg-bg-secondary p-1 rounded-lg border border-border-subtle gap-1">
                      <button
                        onClick={() => setTheme("light")}
                        className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === "light"
                          ? "bg-bg-primary text-text-primary shadow-sm ring-1 ring-border-subtle"
                          : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                          }`}
                        title="Light Mode"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5"></circle>
                          <line x1="12" y1="1" x2="12" y2="3"></line>
                          <line x1="12" y1="21" x2="12" y2="23"></line>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                          <line x1="1" y1="12" x2="3" y2="12"></line>
                          <line x1="21" y1="12" x2="23" y2="12"></line>
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                        </svg>
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === "dark"
                          ? "bg-bg-primary text-text-primary shadow-sm ring-1 ring-border-subtle"
                          : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                          }`}
                        title="Dark Mode"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => setTheme("system")}
                        className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${theme === "system"
                          ? "bg-bg-primary text-text-primary shadow-sm ring-1 ring-border-subtle"
                          : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                          }`}
                        title="System (Auto)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                          <line x1="8" y1="21" x2="16" y2="21"></line>
                          <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Font Size Toggle */}
                  <div className="p-3 border-b border-border">
                    <div className="text-[11px] font-medium text-text-tertiary mb-2 px-1 uppercase tracking-wider">Text Size</div>
                    <div className="flex bg-bg-secondary p-1 rounded-lg border border-border-subtle gap-1">
                      {[
                        { val: "small" as const, label: "A-", title: "Small" },
                        { val: "normal" as const, label: "A", title: "Default" },
                        { val: "large" as const, label: "A+", title: "Large" },
                        { val: "xl" as const, label: "XL", title: "Extra Large" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          onClick={() => setFontSize(opt.val)}
                          className={`flex-1 p-1.5 rounded-md flex items-center justify-center text-[11px] font-semibold transition-all ${fontSize === opt.val
                            ? "bg-bg-primary text-text-primary shadow-sm ring-1 ring-border-subtle"
                            : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                            }`}
                          title={opt.title}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Thinking Depth Toggle */}
                  <div className="p-3 border-b border-border">
                    <div className="text-[11px] font-medium text-text-tertiary mb-2 px-1 uppercase tracking-wider">Thinking Depth</div>
                    <div className="flex bg-bg-secondary p-1 rounded-lg border border-border-subtle gap-1">
                      {([["high", "🔬", "Deep reasoning (slower)"], ["low", "⚡", "Quick thinking (faster)"]] as const).map(([level, icon, hint]) => (
                        <button
                          key={level}
                          onClick={() => onThinkingLevelChange(level)}
                          className={`flex-1 p-1.5 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-all ${thinkingLevel === level
                            ? "bg-bg-primary text-text-primary shadow-sm ring-1 ring-border-subtle"
                            : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                            }`}
                          title={hint}
                        >
                          <span>{icon}</span>
                          <span className="capitalize">{level}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        onLogout();
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[length:var(--font-size-base)] text-red-500 rounded-lg transition-colors hover:bg-bg-secondary text-left font-medium"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

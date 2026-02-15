import React, { type FormEvent, useState, useRef, useEffect, useLayoutEffect } from "react";
import { useTheme } from "../hooks/useTheme";

import type { AuthProvider } from "../providers";
import { SystemPromptEditor } from "./SystemPromptEditor";

interface ChatInputProps {
  input: string;
  onInputChange: (val: string) => void;
  onSend: (e?: FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isStreaming: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  model: string;
  onModelChange: (val: string) => void;
  onNewChat: () => void;
  onToggleHistory: () => void;

  onLogout: () => void;
  pageContextEnabled: boolean;
  onPageContextToggle: () => void;
  systemPrompt: string;
  onSystemPromptChange: (val: string) => void;
  provider?: AuthProvider;
}

const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
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
  onKeyDown,
  isStreaming,
  inputRef,
  model,
  onModelChange,
  onNewChat,
  onToggleHistory,
  onLogout,
  pageContextEnabled,
  onPageContextToggle,
  systemPrompt,
  onSystemPromptChange,
  provider,
}: ChatInputProps) {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();

  const MODELS = provider === "antigravity"
    ? [...CLAUDE_MODELS, ...GEMINI_MODELS]
    : GEMINI_MODELS;
  
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const currentModel = MODELS.find((m) => m.value === model) || MODELS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Model menu
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelOpen(false);
      }
      // Settings menu
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isModelOpen || isSettingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isModelOpen, isSettingsOpen]);

  // Auto-resize logic
  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input, inputRef, isModelOpen]);

  return (
    <div className="border-t border-border bg-bg-chat-input p-3 shadow-top">
      {/* 1. Context / System Prompt / Model Row */}
      <div className="flex items-center justify-between px-3 py-1.5">
        {/* Model Selector */}
        <div className="relative" ref={modelMenuRef}>
          <button
            type="button"
            onClick={() => setIsModelOpen(!isModelOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[length:var(--font-size-sm)] font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary ${
              isModelOpen ? "bg-bg-hover text-text-primary" : "bg-transparent"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.6" />
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" />
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" />
            </svg>
            {currentModel.label}
            <svg
              width="10"
              height="10"
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
                      className={`w-full flex items-center justify-between px-3 py-2 text-[length:var(--font-size-sm)] rounded-lg transition-colors ${
                        isSelected
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

        {/* System Prompt Editor */}
        <SystemPromptEditor 
          systemPrompt={systemPrompt} 
          onSystemPromptChange={onSystemPromptChange} 
        />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onPageContextToggle}
            className={`w-[30px] h-[30px] p-0 rounded-lg flex items-center justify-center transition-all ${
              pageContextEnabled
                ? "bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20"
                : "bg-transparent text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            }`}
            title={pageContextEnabled ? "Page context active" : "Include page context"}
          >
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {pageContextEnabled && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-bg-primary" />
              )}
            </div>
          </button>
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`w-[30px] h-[30px] p-0 rounded-lg flex items-center justify-center transition-colors ${
                isSettingsOpen
                  ? "bg-bg-hover text-text-primary"
                  : "bg-transparent text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
              }`}
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${
                        theme === "light"
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
                      className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${
                        theme === "dark"
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
                      className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${
                        theme === "system"
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
                        className={`flex-1 p-1.5 rounded-md flex items-center justify-center text-[11px] font-semibold transition-all ${
                          fontSize === opt.val
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
          <button
            type="button"
            onClick={onToggleHistory}
            className="w-[30px] h-[30px] p-0 bg-transparent text-text-tertiary rounded-lg flex items-center justify-center transition-colors hover:bg-bg-hover hover:text-text-primary"
            title="History"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNewChat}
            className="w-[30px] h-[30px] p-0 bg-gradient-to-br from-accent-primary to-accent-secondary text-white rounded-lg flex items-center justify-center transition-all hover:shadow-md hover:-translate-y-px"
            title="New Chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="px-1.5 pb-2.5">
        <form onSubmit={onSend}>
          <div className="flex items-end gap-2 bg-bg-primary border border-border rounded-2xl pl-4 pr-2 py-2 transition-colors focus-within:border-accent-primary focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.08)]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 bg-transparent border-none text-text-primary font-sans text-[length:var(--font-size-base)] leading-[1.6] resize-none outline-none max-h-[160px] min-h-[24px] placeholder:text-text-tertiary placeholder:truncate disabled:opacity-60 my-auto overflow-y-hidden"
            />
            <button
              type="submit"
              className="w-[32px] h-[32px] p-0 shrink-0 flex items-center justify-center rounded-lg text-white bg-gradient-to-br from-accent-primary to-accent-secondary disabled:bg-none disabled:bg-surface-1 disabled:text-text-muted transition-all hover:shadow-[0_2px_12px_rgba(124,58,237,0.3)] hover:-translate-y-px disabled:hover:translate-y-0 disabled:hover:shadow-none"
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <div className="w-2.5 h-2.5 bg-white rounded-sm animate-pulse" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

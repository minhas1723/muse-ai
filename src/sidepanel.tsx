/**
 * Side Panel — React Chat UI
 *
 * Flow:
 * 1. Check credential setup → show setup screen if not configured
 * 2. Check auth status → show login screen if not logged in
 * 3. Show chat interface
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import { createRoot } from "react-dom/client";
import "./app.css";

// Shared Types & Utils
import type { AuthStatus, Message, SessionMetadata } from "./types";
import type { AuthProvider } from "./providers";
import { messagesToApiHistory } from "./utils";
import { resolveSystemPrompt, NONE_ID } from "./personalities";

// Components
import { ChatInput } from "./components/ChatInput";
import { ChatMessage } from "./components/ChatMessage";
import { EmptyState } from "./components/EmptyState";
import { HistorySidebar } from "./components/HistorySidebar";
import { LoginScreen } from "./components/LoginScreen";
import { ManualAuthScreen } from "./components/ManualAuthScreen";

import { ErrorBoundary } from "./components/ErrorBoundary";

// ═══════════════════════════════════════════════════════════
// MESSAGES AREA — fills all space above the input bar
// Uses ResizeObserver so it always knows the exact input bar height.
// ═══════════════════════════════════════════════════════════

interface MessagesAreaProps {
  auth: AuthStatus | null;
  messages: Message[];
  isStreaming: boolean;
  model: string;
  loginLoading: boolean;
  loginError: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onLogin: () => void;
  onSuggestionClick: (s: string) => void;
}

function MessagesArea({
  auth,
  messages,
  isStreaming,
  model,
  loginLoading,
  loginError,
  messagesEndRef,
  onLogin,
  onSuggestionClick,
}: MessagesAreaProps) {
  const [inputBarHeight, setInputBarHeight] = React.useState(0);
  const [topBarHeight, setTopBarHeight] = React.useState(0);

  React.useEffect(() => {
    const bar = document.getElementById("chat-input-bar");
    const topBar = document.getElementById("chat-top-bar");

    if (bar) {
      // Measure immediately
      setInputBarHeight(bar.getBoundingClientRect().height);

      // Watch for size changes (textarea grow/shrink, menus opening, etc.)
      const ro = new ResizeObserver(() => {
        setInputBarHeight(bar.getBoundingClientRect().height);
      });
      ro.observe(bar);
    }

    if (topBar) {
      setTopBarHeight(topBar.getBoundingClientRect().height);

      const ro = new ResizeObserver(() => {
        setTopBarHeight(topBar.getBoundingClientRect().height);
      });
      ro.observe(topBar);
    }

    return () => {
      // Cleanup handled by closure
    };
  }, [auth?.loggedIn]); // re-run when we go logged-in so the bars appear

  return (
    <div
      style={{
        position: 'absolute',
        top: topBarHeight,
        left: 0,
        right: 0,
        bottom: inputBarHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
      className="scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent"
    >
      {!auth?.loggedIn ? (
        <LoginScreen
          onLogin={onLogin}
          loading={loginLoading}
          error={loginError}
        />
      ) : messages.length === 0 ? (
        <EmptyState
          email={auth.email}
          onSuggestionClick={onSuggestionClick}
        />
      ) : (
        <div className="py-3">
          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              message={msg}
              isLast={i === messages.length - 1}
              model={model}
              isStreaming={isStreaming && i === messages.length - 1}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// APP COMPONENT
// ═══════════════════════════════════════════════════════════

export function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState("gemini-3-pro-preview");
  const [agentMode, setAgentMode] = useState<"ask" | "edit">("ask");
  const [thinkingLevel, setThinkingLevel] = useState<"high" | "low">("high");

  // Session State
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // UI State
  const [loginLoading, setLoginLoading] = useState(false);
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginProvider, setLoginProvider] = useState<AuthProvider>("gemini-cli");
  const [activePersonalityId, setActivePersonalityId] = useState<string>(NONE_ID);
  const [customPrompt, setCustomPrompt] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activePortRef = useRef<chrome.runtime.Port | null>(null);

  // ─── Init ───
  const checkAuth = useCallback(async () => {
    try {
      const status = await chrome.runtime.sendMessage({
        type: "getAuthStatus",
      });
      setAuth(status);
    } catch {
      setAuth({ loggedIn: false, email: null, projectId: null });
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: "listSessions" });
      if (res.sessions) {
        setSessions(res.sessions);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await checkAuth();
      await loadSessions();
      // Load persisted page context preference
      try {
        const stored = await chrome.storage.local.get(["activePersonalityId", "customSystemPrompt", "thinkingLevel", "agentMode"]);
        if (typeof stored.activePersonalityId === "string") {
          setActivePersonalityId(stored.activePersonalityId);
        }
        if (typeof stored.customSystemPrompt === "string") {
          setCustomPrompt(stored.customSystemPrompt);
        }
        if (stored.thinkingLevel === "high" || stored.thinkingLevel === "low") {
          setThinkingLevel(stored.thinkingLevel);
        }
        if (stored.agentMode === "ask" || stored.agentMode === "edit") {
          setAgentMode(stored.agentMode);
        }
      } catch { }
    })();
  }, [checkAuth, loadSessions]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Session Management ───

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
    setInput("");
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleLoadSession = async (id: string) => {
    try {
      const res = await chrome.runtime.sendMessage({ type: "loadSession", id });
      if (res.session) {
        setMessages(res.session.messages);
        setCurrentSessionId(res.session.id);
        setShowHistory(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;

    try {
      await chrome.runtime.sendMessage({ type: "deleteSession", id });
      setSessions((prev) => prev.filter((s) => s.id !== id));

      if (currentSessionId === id) {
        handleNewChat();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── Auth Handlers ───
  const handleLogin = async (provider: AuthProvider = "gemini-cli") => {
    setLoginLoading(true);
    setLoginError(null);
    setLoginProvider(provider);
    try {
      const result = await chrome.runtime.sendMessage({ type: "login", provider });
      if (result.error === "MANUAL_FLOW_REQUIRED") {
        setShowManualAuth(true);
      } else if (result.error) {
        setLoginError(result.error);
      } else {
        setAuth(result);
      }
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleManualAuthComplete = (status: AuthStatus) => {
    setAuth(status);
    setShowManualAuth(false);
  };

  const handleLogout = async () => {
    const result = await chrome.runtime.sendMessage({ type: "logout" });
    setAuth(result);
    setMessages([]);
    setCurrentSessionId(null);
  };

  // ─── Personality ───
  const handlePersonalityChange = (id: string) => {
    setActivePersonalityId(id);
    chrome.storage.local.set({ activePersonalityId: id });
  };

  const handleCustomPromptChange = (val: string) => {
    setCustomPrompt(val);
    chrome.storage.local.set({ customSystemPrompt: val });
  };

  // Derive the effective system prompt from the active personality
  const effectiveSystemPrompt = resolveSystemPrompt(activePersonalityId, customPrompt);

  const handleStop = () => {
    if (activePortRef.current) {
      activePortRef.current.postMessage({ type: "stop" });
    }
  };

  // ─── Send Message ───
  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // 1. Update UI immediately
    const userMsg: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    inputRef.current?.focus();

    const assistantIdx = newMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "", model }]);

    // 2. Prepare Session
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      try {
        const res = await chrome.runtime.sendMessage({ type: "createSession" });
        if (res.session) {
          activeSessionId = res.session.id;
          setCurrentSessionId(activeSessionId);
          // Add to session list immediately
          setSessions((prev) => [
            {
              id: activeSessionId!,
              title: "New Chat",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...prev,
          ]);
        }
      } catch (e) {
        console.error("Failed to create session", e);
      }
    }

    // 3. Connect to API
    const history = messagesToApiHistory(messages);
    const port = chrome.runtime.connect({ name: "gemini-stream" });
    activePortRef.current = port;

    // Helper to save session progress
    const saveProgress = (msgs: Message[]) => {
      if (!activeSessionId) return;
      chrome.runtime.sendMessage({
        type: "saveSession",
        session: {
          id: activeSessionId,
          title: "New Chat", // backend will update title
          messages: msgs,
          createdAt: Date.now(), // ignored by backend for updates usually
          updatedAt: Date.now(),
        },
      }).then(() => {
        // Refresh list to update titles/timestamps
        loadSessions();
      }).catch(() => { });
    };

    // Buffer for text chunks to throttle re-renders
    let textBuffer = "";
    let thinkingBuffer = "";
    let rafId: number | null = null;

    const flush = () => {
      if (!textBuffer && !thinkingBuffer) {
        rafId = requestAnimationFrame(flush);
        return;
      }

      const currentText = textBuffer;
      const currentThinking = thinkingBuffer;
      textBuffer = "";
      thinkingBuffer = "";

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[assistantIdx];
        if (last) {
          updated[assistantIdx] = {
            ...last,
            content: last.content + currentText,
            thinking: (last.thinking ?? "") + currentThinking,
          };
        }
        return updated;
      });

      rafId = requestAnimationFrame(flush);
    };

    // Start flushing loop
    rafId = requestAnimationFrame(flush);

    port.onMessage.addListener((msg: any) => {
      if (msg.type === "chunk") {
        if (msg.text) {
          textBuffer += msg.text;
        }
        if (msg.thinking) {
          thinkingBuffer += msg.thinking;
        }
        if (msg.usage) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[assistantIdx];
            if (last) {
              updated[assistantIdx] = { ...last, usage: msg.usage };
            }
            return updated;
          });
        }
        if (msg.error) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[assistantIdx];
            if (last) {
              updated[assistantIdx] = {
                ...last,
                content: `❌ Error: ${msg.error}`,
              };
            }
            return updated;
          });
        }
      }
      if (msg.type === "toolCall") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[assistantIdx];
          if (last) {
            const existing = last.toolCalls ?? [];
            updated[assistantIdx] = {
              ...last,
              toolCalls: [...existing, {
                name: msg.name,
                args: msg.args,
                source: msg.source ?? "latest",
                round: msg.round ?? 0,
              }],
            };
          }
          return updated;
        });
      }
      if (msg.type === "error") {
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = {
            ...updated[assistantIdx],
            content: `❌ Error: ${msg.error}`,
          };
          saveProgress(updated);
          return updated;
        });
      }
      if (msg.type === "done") {
        setIsStreaming(false);
        activePortRef.current = null;
        if (rafId) cancelAnimationFrame(rafId);
        port.disconnect();

        // Final flush and save
        setMessages((prev) => {
          // Flush any remaining buffer
          let updated = [...prev];
          if (textBuffer || thinkingBuffer) {
            const last = updated[assistantIdx];
            if (last) {
              updated[assistantIdx] = {
                ...last,
                content: last.content + textBuffer,
                thinking: (last.thinking ?? "") + thinkingBuffer,
              };
            }
            textBuffer = "";
            thinkingBuffer = "";
          }
          
          if (msg.aborted) {
            const last = updated[assistantIdx];
            if (last) {
              updated[assistantIdx] = {
                ...last,
                content: last.content + "\n\n*[Stopped by user]*"
              };
            }
          }

          saveProgress(updated);
          return updated;
        });
      }
    });

    port.postMessage({
      type: "chat",
      prompt: trimmed,
      history,
      model,
      systemPrompt: effectiveSystemPrompt || undefined,
      pageContextEnabled: true,
      agentMode,
      thinkingLevel,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  // Loading state
  if (auth === null) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-bg-primary">
        <span className="w-[28px] h-[28px] border-[3px] border-accent-primary/20 border-t-accent-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Manual Auth Screen
  if (showManualAuth) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg-primary text-text-primary">
        <ManualAuthScreen
          provider={loginProvider}
          onComplete={handleManualAuthComplete}
          onCancel={() => setShowManualAuth(false)}
        />
      </div>
    );
  }

  // Main App
  return (
    <ErrorBoundary>
      {/*
        ROOT CONTAINER:
        position:fixed pins us to exactly the panel viewport,
        completely immune to document flow or content size changes.
        position:relative here so children can use position:absolute
        relative to this container.
      */}
      <div
        className="bg-bg-primary text-text-primary"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
        }}
      >
        {/* History Sidebar — absolute overlay */}
        {showHistory && auth?.loggedIn && (
          <HistorySidebar
            sessions={sessions}
            currentId={currentSessionId}
            onSelect={handleLoadSession}
            onDelete={handleDeleteSession}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/*
          TOP BAR — pinned absolutely to the top.
          Fixed position, never moves.
        */}
        {auth?.loggedIn && (
          <div
            id="chat-top-bar"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 5,
            }}
            className="border-b border-border bg-bg-primary"
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Muse</h2>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
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
                  onClick={handleNewChat}
                  className="w-[30px] h-[30px] p-0 bg-transparent text-text-tertiary rounded-lg flex items-center justify-center transition-colors hover:bg-bg-hover hover:text-text-primary"
                  title="New Chat"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/*
          INPUT AREA — pinned absolutely to the bottom.
          This is measured by the browser INDEPENDENTLY of the messages area.
          It will NEVER move, regardless of how much content is above it.
        */}
        {auth?.loggedIn && (
          <div
            id="chat-input-bar"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 5,
            }}
          >
            <ChatInput
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              onStop={handleStop}
              onKeyDown={handleKeyDown}
              isStreaming={isStreaming}
              inputRef={inputRef}
              model={model}
              onModelChange={setModel}
              activePersonalityId={activePersonalityId}
              onPersonalityChange={handlePersonalityChange}
              customPrompt={customPrompt}
              onCustomPromptChange={handleCustomPromptChange}
              thinkingLevel={thinkingLevel}
              onThinkingLevelChange={(level) => {
                setThinkingLevel(level);
                chrome.storage.local.set({ thinkingLevel: level });
              }}
              provider={auth?.provider}
              agentMode={agentMode}
              onAgentModeChange={(mode) => {
                setAgentMode(mode);
                chrome.storage.local.set({ agentMode: mode });
              }}
              onLogout={handleLogout}
            />
          </div>
        )}

        {/*
          MESSAGES AREA — fills the remaining space by using top:0 and
          bottom equal to the height of the input bar.
          We use a CSS custom property set by a ResizeObserver so the
          messages area always knows exactly how tall the input bar is.
        */}
        <MessagesArea
          auth={auth}
          messages={messages}
          isStreaming={isStreaming}
          model={model}
          loginLoading={loginLoading}
          loginError={loginError}
          messagesEndRef={messagesEndRef}
          onLogin={handleLogin}
          onSuggestionClick={(s: string) => {
            setInput(s);
            inputRef.current?.focus();
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}

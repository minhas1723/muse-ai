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

// Components
import { ChatInput } from "./components/ChatInput";
import { ChatMessage } from "./components/ChatMessage";
import { EmptyState } from "./components/EmptyState";
import { HistorySidebar } from "./components/HistorySidebar";
import { LoginScreen } from "./components/LoginScreen";
import { ManualAuthScreen } from "./components/ManualAuthScreen";

import { ErrorBoundary } from "./components/ErrorBoundary";

// ═══════════════════════════════════════════════════════════
// APP COMPONENT
// ═══════════════════════════════════════════════════════════

function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState("gemini-3-flash-preview");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [pageContextEnabled, setPageContextEnabled] = useState(true);
  
  // Session State
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // UI State
  const [loginLoading, setLoginLoading] = useState(false);
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginProvider, setLoginProvider] = useState<AuthProvider>("gemini-cli");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        const stored = await chrome.storage.local.get("pageContextEnabled");
        if (typeof stored.pageContextEnabled === "boolean") {
          setPageContextEnabled(stored.pageContextEnabled);
        }
      } catch {}
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
      }).catch(() => {});
    };

    port.onMessage.addListener((msg: any) => {
      if (msg.type === "chunk") {
        if (msg.text) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[assistantIdx];
            if (last) {
              updated[assistantIdx] = {
                ...last,
                content: last.content + msg.text,
              };
            }
            return updated;
          });
        }
        if (msg.thinking) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[assistantIdx];
            if (last) {
              updated[assistantIdx] = {
                ...last,
                thinking: (last.thinking ?? "") + msg.thinking,
              };
            }
            return updated;
          });
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
        port.disconnect();
        // Final save
        setMessages((current) => {
          saveProgress(current);
          return current;
        });
      }
    });

    port.postMessage({
      type: "chat",
      prompt: trimmed,
      history,
      model,
      systemPrompt: systemPrompt || undefined,
      pageContextEnabled,
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
      <div className="flex flex-col h-screen items-center justify-center bg-bg-primary">
        <span className="w-[28px] h-[28px] border-[3px] border-accent-primary/20 border-t-accent-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Manual Auth Screen
  if (showManualAuth) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-bg-primary text-text-primary">
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
      <div className="flex flex-col h-screen overflow-hidden bg-bg-primary text-text-primary">


        {/* History Sidebar */}
        {showHistory && auth?.loggedIn && (
          <HistorySidebar 
            sessions={sessions}
            currentId={currentSessionId}
            onSelect={handleLoadSession}
            onDelete={handleDeleteSession}
            onClose={() => setShowHistory(false)}
          />
        )}



        {/* Main area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent">
          {!auth?.loggedIn ? (
            <LoginScreen 
              onLogin={handleLogin} 
              loading={loginLoading} 
              error={loginError} 
            />
          ) : messages.length === 0 ? (
            <EmptyState 
              email={auth.email} 
              onSuggestionClick={(s) => {
                setInput(s);
                inputRef.current?.focus();
              }} 
            />
          ) : (
            <div className="py-3">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  message={msg}
                  isLast={i === messages.length - 1}
                  model={model}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input area */}
        {auth?.loggedIn && (
          <ChatInput
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            isStreaming={isStreaming}
            inputRef={inputRef}
            model={model}
            onModelChange={setModel}
            onNewChat={handleNewChat}
            onToggleHistory={() => {
              setShowHistory(!showHistory);
            }}
            onLogout={handleLogout}
            pageContextEnabled={pageContextEnabled}
            onPageContextToggle={() => {
              const next = !pageContextEnabled;
              setPageContextEnabled(next);
              chrome.storage.local.set({ pageContextEnabled: next });
            }}
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            provider={auth?.provider}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

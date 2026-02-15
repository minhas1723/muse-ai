/**
 * Background Service Worker
 *
 * Handles all chrome extension events:
 * - Message passing from side panel
 * - OAuth login/logout
 * - Credential setup (manual, default)
 * - Streaming chat via port connections
 * - Opening side panel on action click
 */

import {
  login,
  logout,
  getAuthStatus,
  ensureValidToken,
  getCredentials,
  getLoginUrl,
  exchangeManualCode,
} from "./auth";
import type { AuthProvider } from "./providers";
import { streamGeminiChat, PAGE_CONTENT_TOOLS, type ChatMessage } from "./gemini";
import { snapshotStore, type DiffResult } from "./chunker";
import {
  createSession,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  type ChatSession,
} from "./sessions";

// ═══════════════════════════════════════════════════════════
// OPEN SIDE PANEL ON ACTION CLICK
// ═══════════════════════════════════════════════════════════

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ═══════════════════════════════════════════════════════════
// MESSAGE HANDLERS (request/response — non-streaming)
// ═══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = messageHandlers[message.type as string];
  if (handler) {
    handler(message)
      .then(sendResponse)
      .catch((err: Error) => sendResponse({ error: err.message }));
    return true; // keep the message channel open for async response
  }
  return false;
});

const messageHandlers: Record<string, (msg: any) => Promise<any>> = {
  // ─── Auth ───
  async getAuthStatus() {
    return getAuthStatus();
  },

  async login(msg: { provider?: AuthProvider }) {
    try {
      const creds = await login(msg.provider ?? "gemini-cli");
      return {
        loggedIn: true,
        email: creds.email ?? null,
        projectId: creds.projectId ?? null,
        provider: creds.provider,
      };
    } catch (err: any) {
      // If user closed the auth tab, signal frontend to show manual flow
      if (err.message === "AUTH_TAB_CLOSED") {
        return { error: "MANUAL_FLOW_REQUIRED" };
      }
      return { error: err.message };
    }
  },

  async logout() {
    await logout();
    return { loggedIn: false, email: null, projectId: null };
  },

  // ─── Manual Auth Flow (copy-paste fallback) ───
  async getAuthUrl(msg: { provider?: AuthProvider }) {
    try {
      const url = await getLoginUrl(msg.provider ?? "gemini-cli");
      return { url };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async exchangeCode(msg: { code: string; provider?: AuthProvider }) {
    try {
      const creds = await exchangeManualCode(msg.code, msg.provider ?? "gemini-cli");
      return {
        loggedIn: true,
        email: creds.email ?? null,
        projectId: creds.projectId ?? null,
        provider: creds.provider,
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ─── Chat Sessions ───
  async createSession() {
    try {
      const session = await createSession();
      return { session };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async saveSession(msg: { session: ChatSession }) {
    try {
      await saveSession(msg.session);
      return { ok: true };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async loadSession(msg: { id: string }) {
    try {
      const session = await loadSession(msg.id);
      return { session };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async listSessions() {
    try {
      const sessions = await listSessions();
      return { sessions };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async deleteSession(msg: { id: string }) {
    try {
      await deleteSession(msg.id);
      return { ok: true };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ─── Content Script ───
  async getPageContent() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { error: "No active tab found" };

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "getPageContent",
      });
      return response;
    } catch (err: any) {
      return { error: err.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════
// BASE SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════

const BASE_SYSTEM_PROMPT = `You are Muse, a smart and friendly AI assistant that lives in the user's browser sidebar.

Core principles:
- Be concise and conversational. This is a side panel — space is limited. Get to the point.
- Use markdown (headings, bold, lists, code blocks) to organize information clearly.
- Keep code snippets short and well-commented. Avoid very long lines — the panel is narrow (~400px).
- Be warm and approachable. You're a companion, not a corporate chatbot.

Page context:
- If the user asks about the page but no page context is available, suggest they enable the 🌐 toggle to share the page with you.
- When page context IS available, reference it naturally — don't dump raw content back. Summarize, explain, and answer questions about it.
- NEVER fabricate or guess page content. If you haven't read specific chunks yet, say so and offer to read them.
- If the user navigates to a new page mid-conversation, acknowledge the change and offer to read the new page.

Response style:
- For simple questions, give brief direct answers.
- For complex topics, use structured markdown with headers.
- When the user says "explain" or "summarize", be thorough but organized.
- If unsure, ask a clarifying question rather than guessing.`;

function buildPageContextPrompt(
  url: string,
  title: string,
  latestChunks: number,
  previousChunks: number | null,
  diff: DiffResult,
): string {
  let prompt = `\n\nThe user has enabled page context for their current browser tab.
Page details:
- URL: ${url}
- Title: ${title}
- The page content has been split into ${latestChunks} chunks (indices 0 to ${latestChunks - 1}).

Use the read_page_chunks tool with source="latest" to read the current page.`;

  if (previousChunks !== null) {
    prompt += `\nYou can also use source="previous" to read the previous version (${previousChunks} chunks).`;
  }

  prompt += `\nStart with chunks [0, 1] for an overview. Read more for detailed questions.
You can request multiple chunks at once. Do NOT read all chunks at once — only what you need.`;

  switch (diff.type) {
    case "no_previous":
      prompt += "\n\nThis is the first time reading this page — no previous version available.";
      break;
    case "unchanged":
      prompt += "\n\nThe page content has NOT changed since your last read. No need to re-read unless the user asks about something specific you haven't read yet.";
      break;
    case "small_diff": {
      prompt += `\n\nThe page has been modified since your last read (${diff.changedLines} lines changed out of ${diff.totalLines}). Here is a unified diff of the changes:\n\n\`\`\`diff\n${diff.patch}\n\`\`\`\n\nUse this diff to understand what changed.`;
      if (diff.changedChunks.length > 0) {
        prompt += ` If you need more context, the changes are in chunk${diff.changedChunks.length > 1 ? "s" : ""} [${diff.changedChunks.join(", ")}].`;
      }
      break;
    }
    case "large_diff": {
      prompt += `\n\nThe page content has changed significantly since your last read (${diff.changedLines} lines changed out of ${diff.totalLines}). The diff is too large to include.`;
      if (diff.changedChunks.length > 0) {
        prompt += ` Changes are in chunk${diff.changedChunks.length > 1 ? "s" : ""} [${diff.changedChunks.join(", ")}] — you can read those if needed.`;
      }
      break;
    }
    case "url_changed":
      prompt += `\n\nThe user has navigated to a different page (was: ${diff.oldUrl}, now: ${diff.newUrl}). Use read_page_chunks with source="latest" to read the new page. You can still access the old page with source="previous" if the user refers to it.`;
      break;
  }

  return prompt;
}

// ═══════════════════════════════════════════════════════════
// FETCH PAGE CONTENT (with content script fallback)
// ═══════════════════════════════════════════════════════════

async function fetchPageContent(tabId: number): Promise<any> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || 
        tab.url.startsWith("chrome://") || 
        tab.url.startsWith("about:") || 
        tab.url.startsWith("edge://") || 
        tab.url.startsWith("extension://") ||
        tab.url.startsWith("devtools://") ||
        tab.url.startsWith("view-source:")
       ) {
      console.log(`[Content] Skipping restricted URL: ${tab.url}`);
      return null;
    }

    return await chrome.tabs.sendMessage(tabId, { type: "getPageContent" });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      await new Promise((r) => setTimeout(r, 300));
      return await chrome.tabs.sendMessage(tabId, { type: "getPageContent" });
    } catch (injectErr) {
      console.warn("Failed to inject content script:", injectErr);
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PORT-BASED STREAMING — AGENTIC LOOP
// ═══════════════════════════════════════════════════════════

const MAX_TOOL_ROUNDS = 5;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "gemini-stream") return;

  // Track the last tab/URL the LLM saw across messages on this port
  let lastSeenTabId: number | null = null;
  let lastSeenUrl: string | null = null;

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== "chat") return;

    try {
      const accessToken = await ensureValidToken();
      const creds = await getCredentials();

      if (!creds) {
        port.postMessage({ type: "error", error: "Not logged in" });
        port.postMessage({ type: "done" });
        return;
      }

      // ─── Build System Prompt ───
      let systemPrompt = BASE_SYSTEM_PROMPT;

      if (msg.systemPrompt?.trim()) {
        systemPrompt += `\n\nAdditional user instructions:\n${msg.systemPrompt.trim()}`;
      }

      // ─── Page Context: Fetch, Snapshot, Diff ───
      let useTools = false;
      let activeTabId: number | null = null;

      if (msg.pageContextEnabled) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            activeTabId = tab.id;

            // Always tell the LLM which page the user is currently on
            const currentUrl = tab.url || "";
            const currentTitle = tab.title || "Untitled";

            // Detect tab switch OR URL change from what the LLM last saw
            const tabSwitched = lastSeenTabId !== null && lastSeenTabId !== tab.id;
            const urlChangedSameTab = !tabSwitched && lastSeenUrl !== null && lastSeenUrl !== currentUrl;

            const pageRes = await fetchPageContent(tab.id);

            if (pageRes && !pageRes.error && pageRes.markdown) {
              snapshotStore.pruneStale();

              const { snapshot, diff } = snapshotStore.push(tab.id, {
                url: pageRes.url || currentUrl,
                title: pageRes.title || currentTitle,
                markdown: pageRes.markdown,
              });

              console.log("📊 [DIFF]", JSON.stringify(diff, null, 2));

              const meta = snapshotStore.getMeta(tab.id);

              // If user switched tabs, override the diff to url_changed
              const effectiveDiff = tabSwitched
                ? { type: "url_changed" as const, oldUrl: lastSeenUrl || "unknown", newUrl: currentUrl }
                : diff;

              systemPrompt += buildPageContextPrompt(
                snapshot.url,
                snapshot.title,
                snapshot.chunks.length,
                meta.previous?.totalChunks ?? null,
                effectiveDiff,
              );

              useTools = true;
            } else {
              // Content script failed, but still tell the LLM about the current page
              systemPrompt += `\n\nThe user has page context enabled. Their current tab is: ${currentTitle} (${currentUrl}).`;
              if (tabSwitched || urlChangedSameTab) {
                systemPrompt += `\nIMPORTANT: The user has navigated to a DIFFERENT page since the last message (was: ${lastSeenUrl}). Do NOT reference information from the previous page unless the user explicitly asks about it. If they ask about page content, tell them you need a moment to load the new page.`;
              }
              systemPrompt += `\nPage content could not be extracted — the content script may not have loaded yet.`;
            }

            // Update tracking
            lastSeenTabId = tab.id;
            lastSeenUrl = currentUrl;
          }
        } catch (e) {
          console.error("Failed to fetch page content", e);
        }
      }

      // ─── Build Conversation ───
      console.log("📝 [SYSTEM PROMPT]\n", systemPrompt);

      const conversation: ChatMessage[] = [
        ...(msg.history ?? []),
        { role: "user", parts: [{ text: msg.prompt }] },
      ];

      // ─── Agentic Loop ───
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let pendingFunctionCall: { name: string; args: Record<string, any> } | null = null;
        const modelParts: any[] = [];
        let heldUsage: any = null;
        let heldFinishReason: string | undefined;

        for await (const chunk of streamGeminiChat({
          accessToken,
          projectId: creds.projectId,
          messages: conversation,
          model: msg.model,
          systemPrompt,
          tools: useTools ? PAGE_CONTENT_TOOLS : undefined,
          provider: creds.provider as AuthProvider | undefined,
        })) {
          if (chunk.rawPart) {
            modelParts.push(chunk.rawPart);
          }

          if (chunk.functionCall) {
            pendingFunctionCall = chunk.functionCall;
          } else {
            const { rawPart, ...uiChunk } = chunk;

            if (uiChunk.finishReason) {
              heldFinishReason = uiChunk.finishReason;
            } else if (uiChunk.usage) {
              heldUsage = uiChunk.usage;
            } else {
              port.postMessage({ type: "chunk", ...uiChunk });
            }
          }
        }

        // No tool call — forward held metrics
        if (!pendingFunctionCall) {
          if (heldFinishReason) port.postMessage({ type: "chunk", finishReason: heldFinishReason });
          if (heldUsage) port.postMessage({ type: "chunk", usage: heldUsage });
          break;
        }

        // ─── Execute Tool Call ───
        if (pendingFunctionCall) {
          const { name, args } = pendingFunctionCall;
          let functionResponse: any;

          try {
            if (activeTabId === null) {
              throw new Error("No active tab found to read content from.");
            }

            const source: "latest" | "previous" = args.source ?? "latest";
            const indices: number[] = args.indices ?? [];

            console.log("🔧 [TOOL INPUT]", { name, source, indices });
            
            // Execute tool
            const chunks = snapshotStore.getChunks(activeTabId, source, indices);
            
            console.log("🔧 [TOOL OUTPUT]", JSON.stringify(chunks, null, 2));
            
            // Send tool call event to UI
            port.postMessage({
              type: "toolCall",
              name,
              args,
              source,
              round,
            });

            functionResponse = { chunks };

          } catch (toolError: any) {
            console.error("❌ [TOOL ERROR]", toolError);
            functionResponse = { 
              error: toolError.message || "Unknown tool error",
              status: "failed" 
            };
          }

          // Append Model Call
          conversation.push({
            role: "model",
            parts: modelParts,
          });

          // Append Tool Response (Success or Error)
          conversation.push({
            role: "user",
            parts: [
              {
                functionResponse: {
                  name,
                  response: functionResponse,
                },
              },
            ],
          });
        }
      } // End of agentic loop

      port.postMessage({ type: "done" });
    } catch (err: any) {
      port.postMessage({ type: "error", error: err.message });
      port.postMessage({ type: "done" });
    }
  });
});

// Log startup
console.log("🚀 Muse background service worker started");

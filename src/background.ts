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
import { streamGeminiChat, ASK_TOOLS, EDIT_TOOLS, type ChatMessage } from "./gemini";
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
- Page context is automatically enabled. If you cannot read the page, explain that it might be a restricted browser page (e.g. chrome://) or the page hasn't finished loading.
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
  editorMetadata: { key: string; label: string }[],
  agentMode: "ask" | "edit" = "ask",
): string {
  const lines: string[] = [
    "",
    "The user has enabled page context for their current browser tab.",
    "Page details:",
    "- URL: " + url,
    "- Title: " + title,
    "- The page content has been split into " + latestChunks + " chunks (indices 0 to " + (latestChunks - 1) + ").",
    "",
    "**How to use your tools:**",
    "",
    "1. **Explore first** — Start by reading chunks [0, 1] to understand the page layout. Read more chunks as needed.",
    "2. **Act on targets** — Use the right tool:",
    "   - `read_page_chunks` to read specific sections of the page",
    "   - `read_editable_content` to read code editors and form fields",
    ...(agentMode === "edit" ? [
      "   - `write_editable_content` to type into fields or edit code",
      "3. **Verify when editing** — After using `write_editable_content`, you can re-read to confirm the change was applied.",
    ] : []),
    "",
    "Common patterns:",
    "- **User asks about the page** → Read relevant chunks, summarize concisely.",
    ...(agentMode === "edit" ? [
      "- **User asks to fill a form / type something** → Check the editable areas listed below, then use `write_editable_content` with find='' to type into empty fields.",
      "- **User asks to edit code** → First `read_editable_content` to see the current code, then `write_editable_content` with the exact text to find and replace.",
    ] : []),
    "- **User asks 'what changed'** → Use the diff information provided below.",
    "",
    "You can request multiple chunks at once. Do NOT read all chunks — only what you need.",
  ];

  if (previousChunks !== null) {
    lines.push('You can also use source="previous" to read the previous version (' + previousChunks + " chunks).");
  }

  // Editable areas
  if (editorMetadata && editorMetadata.length > 0) {
    const editorList = editorMetadata.map(m => "- Key: '" + m.key + "' (" + m.label + ")").join("\n");
    lines.push("");
    lines.push("🎯 **Editable Areas Found:**");
    lines.push("The following text inputs/code editors were detected on screen:");
    lines.push(editorList);
    lines.push("");
    lines.push("If the user asks about their code or what they are typing, use the `read_editable_content` tool with the specific keys to read them accurately.");
    if (agentMode === "edit") {
      lines.push("You can also EDIT or TYPE INTO these areas using the `write_editable_content` tool — specify the key, the exact text to find, and what to replace it with. To type into an empty field, use find='' and replace='your text'. Always read first before editing existing content.");
    }
  }

  // Diff information
  switch (diff.type) {
    case "no_previous":
      lines.push("", "This is the first time reading this page — no previous version available.");
      break;
    case "unchanged":
      lines.push("", "The page content has NOT changed since your last read. No need to re-read unless the user asks about something specific you haven't read yet.");
      break;
    case "small_diff":
      lines.push("", "The page has been modified since your last read (" + diff.changedLines + " lines changed out of " + diff.totalLines + "). Here is a unified diff:");
      lines.push("", "```diff", diff.patch, "```", "");
      lines.push("Use this diff to understand what changed.");
      if (diff.changedChunks.length > 0) {
        lines.push("If you need more context, the changes are in chunk" + (diff.changedChunks.length > 1 ? "s" : "") + " [" + diff.changedChunks.join(", ") + "].");
      }
      break;
    case "large_diff":
      lines.push("", "The page content has changed significantly since your last read (" + diff.changedLines + " lines changed out of " + diff.totalLines + "). The diff is too large to include.");
      if (diff.changedChunks.length > 0) {
        lines.push("Changes are in chunk" + (diff.changedChunks.length > 1 ? "s" : "") + " [" + diff.changedChunks.join(", ") + "] — you can read those if needed.");
      }
      break;
    case "url_changed":
      lines.push("", 'The user has navigated to a different page (was: ' + diff.oldUrl + ', now: ' + diff.newUrl + '). Use read_page_chunks with source="latest" to read the new page. You can still access the old page with source="previous" if the user refers to it.');
      break;
  }

  return "\n" + lines.join("\n");
}

// ═══════════════════════════════════════════════════════════
// WRITE EDITOR CONTENT (main world injection)
// ═══════════════════════════════════════════════════════════

/**
 * Self-contained function injected into the page's MAIN world.
 * Has access to editor APIs (Monaco, CodeMirror, Ace).
 * Must have zero closures — only uses its arguments.
 */
function mainWorldWriteEditor(key: string, find: string, replace: string): { success: boolean; error?: string } {
  const match = key.match(/^(\w+?)_(\d+)$/);
  if (!match) return { success: false, error: `Invalid key format: ${key}` };

  const type = match[1];
  const index = parseInt(match[2], 10) - 1; // keys are 1-based

  try {
    switch (type) {
      case "monaco": {
        const els = document.querySelectorAll(".monaco-editor");
        if (index >= els.length) return { success: false, error: `${key} not found (${els.length} Monaco editors)` };
        const targetEl = els[index];

        const m = (window as any).monaco;
        if (!m) return { success: false, error: "Monaco API not available on this page" };

        const editors = m.editor.getEditors();
        const editor = editors.find((e: any) => {
          const container = e.getContainerDomNode();
          return container === targetEl || targetEl.contains(container) || container?.contains(targetEl);
        });
        if (!editor) return { success: false, error: `Monaco instance not found for ${key}` };

        const model = editor.getModel();
        if (!model) return { success: false, error: "Editor has no model" };

        if (find === "") {
          model.setValue(replace);
        } else {
          const matches = model.findMatches(find, false, false, true, null, false);
          if (matches.length === 0) return { success: false, error: `Text not found in ${key}` };
          editor.executeEdits("muse", [{ range: matches[0].range, text: replace }]);
        }
        return { success: true };
      }

      case "codemirror5": {
        const els = document.querySelectorAll(".CodeMirror");
        if (index >= els.length) return { success: false, error: `${key} not found` };

        const cm = (els[index] as any).CodeMirror;
        if (!cm) return { success: false, error: "CodeMirror 5 instance not found" };

        if (find === "") {
          cm.setValue(replace);
        } else {
          const content = cm.getValue();
          const idx = content.indexOf(find);
          if (idx === -1) return { success: false, error: `Text not found in ${key}` };
          cm.replaceRange(replace, cm.posFromIndex(idx), cm.posFromIndex(idx + find.length));
        }
        return { success: true };
      }

      case "codemirror6": {
        const els = document.querySelectorAll(".cm-editor");
        if (index >= els.length) return { success: false, error: `${key} not found` };

        const el = els[index] as any;
        const view = el.cmView?.view;
        if (!view) return { success: false, error: "CodeMirror 6 EditorView not found" };

        if (find === "") {
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: replace } });
        } else {
          const content = view.state.doc.toString();
          const idx = content.indexOf(find);
          if (idx === -1) return { success: false, error: `Text not found in ${key}` };
          view.dispatch({ changes: { from: idx, to: idx + find.length, insert: replace } });
        }
        return { success: true };
      }

      case "ace": {
        const els = document.querySelectorAll(".ace_editor");
        if (index >= els.length) return { success: false, error: `${key} not found` };

        const editor = (window as any).ace?.edit?.(els[index]);
        if (!editor) return { success: false, error: "Ace instance not found" };

        const content = editor.getValue();
        const idx = content.indexOf(find);
        if (idx === -1) return { success: false, error: `Text not found in ${key}` };

        const doc = editor.getSession().getDocument();
        const startPos = doc.indexToPosition(idx);
        const endPos = doc.indexToPosition(idx + find.length);
        const Range = (window as any).ace.require("ace/range").Range;
        doc.replace(new Range(startPos.row, startPos.column, endPos.row, endPos.column), replace);
        return { success: true };
      }

      case "input": {
        const selector = "textarea, input[type='text'], input[type='search'], input:not([type]), [role='textbox'], [role='searchbox']";
        const allEls = document.querySelectorAll(selector);
        const filtered: Element[] = [];
        for (const el of allEls) {
          if (el.getAttribute("type") === "password") continue;
          filtered.push(el);
        }

        if (index >= filtered.length) return { success: false, error: `${key} not found` };

        const inputEl = filtered[index] as HTMLInputElement | HTMLTextAreaElement;
        const value = inputEl.value || "";

        // Empty find = set entire value (e.g. typing into an empty field)
        let newValue: string;
        if (find === "") {
          newValue = replace;
        } else {
          const idx = value.indexOf(find);
          if (idx === -1) return { success: false, error: `Text not found in ${key}` };
          newValue = value.substring(0, idx) + replace + value.substring(idx + find.length);
        }

        // Use native setter for React compatibility
        const isTextArea = inputEl.tagName.toLowerCase() === "textarea";
        const prototype = isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

        if (setter) {
          setter.call(inputEl, newValue);
        } else {
          inputEl.value = newValue;
        }

        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        return { success: true };
      }

      case "richtext": {
        const selector = '.ProseMirror, .ql-editor, [data-slate-editor="true"], .public-DraftEditor-content';
        const els = document.querySelectorAll(selector);
        if (index >= els.length) return { success: false, error: `${key} not found` };

        const el = els[index] as HTMLElement;
        const text = el.innerText || "";
        const idx = text.indexOf(find);
        if (idx === -1) return { success: false, error: `Text not found in ${key}` };

        el.focus();
        el.innerText = text.substring(0, idx) + replace + text.substring(idx + find.length);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return { success: true };
      }

      case "editable": {
        const allEditables = document.querySelectorAll('[contenteditable="true"]');
        const filtered: Element[] = [];
        for (const el of allEditables) {
          if (!el.closest('.monaco-editor, .CodeMirror, .cm-editor, .ace_editor, .ProseMirror, .ql-editor, [data-slate-editor="true"], .public-DraftEditor-content')) {
            filtered.push(el);
          }
        }

        if (index >= filtered.length) return { success: false, error: `${key} not found` };

        const el = filtered[index] as HTMLElement;
        const text = el.innerText || "";
        const idx = text.indexOf(find);
        if (idx === -1) return { success: false, error: `Text not found in ${key}` };

        el.focus();
        el.innerText = text.substring(0, idx) + replace + text.substring(idx + find.length);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return { success: true };
      }

      default:
        return { success: false, error: `Unknown editor type: ${type}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" };
  }
}

/**
 * Execute an editor write by injecting the function into the page's main world.
 */
async function writeEditorContent(
  tabId: number,
  key: string,
  find: string,
  replace: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const results = await (chrome.scripting.executeScript as any)({
      target: { tabId },
      world: "MAIN",
      func: mainWorldWriteEditor,
      args: [key, find, replace],
    });

    return results?.[0]?.result ?? { success: false, error: "No result from injected script" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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

const MAX_TOOL_ROUNDS = 50;

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
      const agentMode: "ask" | "edit" = msg.agentMode === "edit" ? "edit" : "ask";

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
              await snapshotStore.pruneStale();

              const { snapshot, diff } = await snapshotStore.push(tab.id, {
                url: pageRes.url || currentUrl,
                title: pageRes.title || currentTitle,
                markdown: pageRes.markdown,
                editorContents: pageRes.editorContents,
              });

              console.log("📊 [DIFF]", JSON.stringify(diff, null, 2));

              const meta = await snapshotStore.getMeta(tab.id);

              // If user switched tabs, override the diff to url_changed
              const effectiveDiff = tabSwitched
                ? { type: "url_changed" as const, oldUrl: lastSeenUrl || "unknown", newUrl: currentUrl }
                : diff;

              // Extract metadata for prompt
              const editorMetadata = snapshot.editorContents 
                ? Object.entries(snapshot.editorContents).map(([k, v]) => ({ key: k, label: v.label }))
                : [];

              systemPrompt += buildPageContextPrompt(
                snapshot.url,
                snapshot.title,
                snapshot.chunks.length,
                meta.previous?.totalChunks ?? null,
                effectiveDiff,
                editorMetadata,
                agentMode
              );

              useTools = true;
            } else {
              if (pageRes?.error) {
                console.error("❌ [CONTENT EXTRACTION ERROR]", pageRes.error);
              }

              // Push an empty snapshot to clear 'latest' and move the old data to 'previous'
              await snapshotStore.push(tab.id, {
                url: currentUrl,
                title: currentTitle,
                markdown: "",
              });

              // Content script failed, but still tell the LLM about the current page
              systemPrompt += `\n\nThe user has page context enabled. Their current tab is: ${currentTitle} (${currentUrl}).`;
              if (tabSwitched || urlChangedSameTab) {
                systemPrompt += `\nIMPORTANT: The user has navigated to a DIFFERENT page since the last message (was: ${lastSeenUrl}). Do NOT reference information from the previous page unless the user explicitly asks about it. If they ask about page content, tell them you need a moment to load the new page.`;
              }
              systemPrompt += `\nPage content could not be extracted. Reason: ${pageRes?.error ? pageRes.error : "The page might be restricted (e.g., chrome://) or the content script may not have loaded yet."}`;
              
              useTools = true;
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

      // Setup Cancellation
      const controller = new AbortController();
      
      // Listen for explicit "stop" message from UI
      const handleMessage = (m: any) => {
        if (m.type === "stop") {
          console.log("🛑 [STREAM] Received stop command from UI.");
          controller.abort();
        }
      };
      port.onMessage.addListener(handleMessage);

      // Also abort if the port disconnects (e.g. UI unmounts/switches chats)
      const handleDisconnect = () => {
        console.log("🛑 [STREAM] Port disconnected, aborting generation.");
        controller.abort();
      };
      port.onDisconnect.addListener(handleDisconnect);

      let streamAborted = false;

      // ─── Agentic Loop ───
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (controller.signal.aborted) {
          streamAborted = true;
          break;
        }

        const modelParts: any[] = [];
        let heldUsage: any = null;
        let heldFinishReason: string | undefined;

        for await (const chunk of streamGeminiChat({
          accessToken,
          projectId: creds.projectId,
          messages: conversation,
          model: msg.model,
          systemPrompt,
          tools: useTools ? (agentMode === "edit" ? EDIT_TOOLS : ASK_TOOLS) : undefined,
          provider: creds.provider as AuthProvider | undefined,
          thinkingLevel: msg.thinkingLevel,
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) {
             streamAborted = true;
             break;
          }
          if (chunk.rawPart) {
            modelParts.push(chunk.rawPart);
          }

          if (!chunk.functionCall) {
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

        const functionCallsToExecute = modelParts
          .filter(p => p.functionCall)
          .map(p => p.functionCall);

        // No tool call — forward held metrics
        if (functionCallsToExecute.length === 0) {
          if (heldFinishReason) port.postMessage({ type: "chunk", finishReason: heldFinishReason });
          if (heldUsage) port.postMessage({ type: "chunk", usage: heldUsage });
          break;
        }

        // ─── Execute Tool Calls ───
        const functionResponses: any[] = [];

        for (const functionCall of functionCallsToExecute) {
          const { name, args } = functionCall;
          let toolResult: any;

          try {
            if (activeTabId === null) {
              throw new Error("No active tab found to read content from.");
            }

            const source: "latest" | "previous" = args?.source ?? "latest";
            console.log("🔧 [TOOL INPUT]", { name, source, args });

            if (name === "read_page_chunks") {
              const indices: number[] = args?.indices ?? [];
              const chunks = await snapshotStore.getChunks(activeTabId, source, indices);
              console.log("🔧 [TOOL OUTPUT]", JSON.stringify(chunks, null, 2));
              toolResult = { chunks };
            } else if (name === "read_editable_content") {
              const keys: string[] = args?.keys;
              if (!keys || !Array.isArray(keys)) throw new Error("Missing 'keys' parameter for read_editable_content");
              
              const resultObj: Record<string, string> = {};
              for (const key of keys) {
                const content = await snapshotStore.getEditorContent(activeTabId, source, key);
                if (content !== null) {
                  resultObj[key] = content;
                }
              }
              
              toolResult = JSON.stringify(resultObj);
              console.log(`🔧 [TOOL OUTPUT: keys read: ${Object.keys(resultObj).length}]`);
            } else if (name === "write_editable_content") {
              const key = args?.key;
              const find = args?.find;
              const replaceText = args?.replace;
              if (!key || find == null || replaceText == null) {
                throw new Error("Missing required parameters (key, find, replace) for write_editable_content");
              }

              console.log(`✏️ [WRITE] key=${key}, find=${JSON.stringify(find).slice(0, 80)}, replace=${JSON.stringify(replaceText).slice(0, 80)}`);

              const result = await writeEditorContent(activeTabId, key, find, replaceText);
              if (!result.success) {
                throw new Error(result.error || "Write failed");
              }

              toolResult = { success: true, key, message: `Successfully edited ${key}` };
              console.log(`✏️ [WRITE OK] ${key}`);
            } else {
              throw new Error(`Unknown tool: ${name}`);
            }
            // Send tool call event to UI
            port.postMessage({
              type: "toolCall",
              name,
              args,
              source,
              round,
            });

          } catch (toolError: any) {
            console.error("❌ [TOOL ERROR]", toolError);
            toolResult = {
              error: toolError.message || "Unknown tool error",
              status: "failed"
            };
          }

          functionResponses.push({
            functionResponse: {
              name,
              response: {
                name,
                content: toolResult,
              },
            },
          });
        }

        // Append Model Call
        conversation.push({
          role: "model",
          parts: modelParts,
        });

        if (controller.signal.aborted) {
           streamAborted = true;
           break;
        }

        // Append Tool Responses
        conversation.push({
          role: "user",
          parts: functionResponses,
        });
      } // End of agentic loop

      // Cleanup listeners
      port.onMessage.removeListener(handleMessage);
      port.onDisconnect.removeListener(handleDisconnect);

      if (streamAborted) {
         port.postMessage({ type: "done", aborted: true });
      } else {
         port.postMessage({ type: "done" });
      }
    } catch (err: any) {
      port.postMessage({ type: "error", error: err.message });
      port.postMessage({ type: "done" });
    }
  });
});

// Log startup
console.log("🚀 Muse background service worker started");

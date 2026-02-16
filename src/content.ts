import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const MAX_CONTENT_LENGTH = 12000;

// ═══════════════════════════════════════════════════════════
// EDITOR EXTRACTION — Monaco, CodeMirror, contenteditable
// ═══════════════════════════════════════════════════════════

/**
 * Try to extract code from known editor types.
 * Returns { language, code } or null if no editor found.
 */
function extractEditorContent(): { label: string; code: string }[] {
  const editors: { label: string; code: string }[] = [];

  const monacoEls: Element[] = [];
  const cm5Els: Element[] = [];
  const cm6Els: Element[] = [];
  const aceEls: Element[] = [];
  const editables: Element[] = [];

  // Optimized: Single query for all potential editors to reduce DOM traversals
  const selector =
    ".monaco-editor, .CodeMirror, .cm-editor, .ace_editor, [contenteditable='true']";
  const elements = document.querySelectorAll(selector);

  // Categorize elements
  for (const el of elements) {
    if (el.classList.contains("monaco-editor")) {
      monacoEls.push(el);
    } else if (el.classList.contains("CodeMirror")) {
      cm5Els.push(el);
    } else if (el.classList.contains("cm-editor")) {
      cm6Els.push(el);
    } else if (el.classList.contains("ace_editor")) {
      aceEls.push(el);
    } else {
      // It must be a generic contenteditable because of the selector.
      // Filter out those inside known editors.
      if (!el.closest(".monaco-editor, .CodeMirror, .cm-editor, .ace_editor")) {
        editables.push(el);
      }
    }
  }

  // ─── Monaco Editor (VS Code, LeetCode, etc.) ───
  monacoEls.forEach((el, i) => {
    // Monaco keeps a hidden textarea with the full content for accessibility
    const textarea = el.querySelector("textarea") as HTMLTextAreaElement | null;
    if (textarea?.value?.trim()) {
      editors.push({
        label: `Monaco Editor${monacoEls.length > 1 ? ` #${i + 1}` : ""}`,
        code: textarea.value,
      });
      return;
    }
    // Fallback: read from .view-lines
    const viewLines = el.querySelector(".view-lines");
    if (viewLines?.textContent?.trim()) {
      editors.push({
        label: `Monaco Editor${monacoEls.length > 1 ? ` #${i + 1}` : ""}`,
        code: viewLines.textContent,
      });
    }
  });

  // ─── CodeMirror 5 (.CodeMirror wrapper) ───
  cm5Els.forEach((el: any, i) => {
    // CodeMirror 5 stores the instance on the DOM element
    const value = el.CodeMirror?.getValue?.();
    if (value?.trim()) {
      editors.push({
        label: `CodeMirror${cm5Els.length > 1 ? ` #${i + 1}` : ""}`,
        code: value,
      });
    }
  });

  // ─── CodeMirror 6 (.cm-editor wrapper) ───
  cm6Els.forEach((el, i) => {
    const content = el.querySelector(".cm-content");
    if (content?.textContent?.trim()) {
      editors.push({
        label: `CodeMirror${cm6Els.length > 1 ? ` #${i + 1}` : ""}`,
        code: content.textContent,
      });
    }
  });

  // ─── Ace Editor ───
  aceEls.forEach((el, i) => {
    // Ace stores content in .ace_text-layer or via the ace.edit API
    const textLayer = el.querySelector(".ace_text-layer");
    if (textLayer?.textContent?.trim()) {
      editors.push({
        label: `Ace Editor${aceEls.length > 1 ? ` #${i + 1}` : ""}`,
        code: textLayer.textContent,
      });
    }
  });

  // ─── Generic contenteditable blocks (not inside known editors) ───
  editables.forEach((el, i) => {
    const text = el.textContent?.trim();
    if (text && text.length > 20) {
      editors.push({
        label: `Editable Block${editables.length > 1 ? ` #${i + 1}` : ""}`,
        code: text,
      });
    }
  });

  return editors;
}

// ═══════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "getPageContent") return false;

  try {
    // 1. Try editor extraction first
    const editorBlocks = extractEditorContent();

    // 2. Extract main page content with Readability
    const doc = document.cloneNode(true) as Document;
    const reader = new Readability(doc);
    const article = reader.parse();

    // 3. Convert page content to Markdown
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    const html = article?.content ?? document.body.innerHTML;
    let markdown = turndown.turndown(html);

    // 4. Prepend editor content (if found)
    if (editorBlocks.length > 0) {
      const editorSection = editorBlocks
        .map((e) => `### ${e.label}\n\`\`\`\n${e.code}\n\`\`\``)
        .join("\n\n");

      markdown = `## Editor Content\n\n${editorSection}\n\n---\n\n## Page Content\n\n${markdown}`;
    }

    // 5. Truncate
    if (markdown.length > MAX_CONTENT_LENGTH) {
      markdown = markdown.slice(0, MAX_CONTENT_LENGTH) + "\n\n[...content truncated]";
    }

    sendResponse({
      title: article?.title ?? document.title,
      url: window.location.href,
      markdown,
    });
  } catch (err: any) {
    sendResponse({ error: err.message });
  }

  return true; // async response
});

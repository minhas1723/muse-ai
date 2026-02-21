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
function extractEditorContent(): { key: string; label: string; code: string }[] {
  const editors: { key: string; label: string; code: string }[] = [];

  const monacoEls: Element[] = [];
  const cm5Els: Element[] = [];
  const cm6Els: Element[] = [];
  const aceEls: Element[] = [];
  const richTextEls: Element[] = [];
  const inputEls: Element[] = [];
  const editables: Element[] = [];

  // Optimized: Single query for all potential editors to reduce DOM traversals
  const selector =
    ".monaco-editor, .CodeMirror, .cm-editor, .ace_editor, textarea, input[type='text'], input[type='search'], input:not([type]), [role='textbox'], [role='searchbox'], .ProseMirror, .ql-editor, [data-slate-editor='true'], .public-DraftEditor-content, [contenteditable='true']";
  
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
    } else if (
      el.classList.contains("ProseMirror") ||
      el.classList.contains("ql-editor") ||
      el.getAttribute("data-slate-editor") === "true" ||
      el.classList.contains("public-DraftEditor-content")
    ) {
      richTextEls.push(el);
    } else if (
      el.tagName.toLowerCase() === "textarea" ||
      el.tagName.toLowerCase() === "input" ||
      el.getAttribute("role") === "textbox" ||
      el.getAttribute("role") === "searchbox"
    ) {
      // Ignore password fields explicitly
      if (el.getAttribute("type") !== "password") {
         inputEls.push(el);
      }
    } else {
      // It must be a generic contenteditable because of the selector.
      // Filter out those inside known editors.
      if (!el.closest(".monaco-editor, .CodeMirror, .cm-editor, .ace_editor, .ProseMirror, .ql-editor, [data-slate-editor='true'], .public-DraftEditor-content")) {
        editables.push(el);
      }
    }
  }

  // Helper to generate safe keys
  const makeKey = (prefix: string, index: number) => `${prefix}_${index + 1}`;

  // ─── Monaco Editor (VS Code, LeetCode, etc.) ───
  monacoEls.forEach((el, i) => {
    // Monaco keeps a hidden textarea with the full content for accessibility
    const textarea = el.querySelector("textarea") as HTMLTextAreaElement | null;
    if (textarea?.value?.trim()) {
      editors.push({
        key: makeKey("monaco", i),
        label: `Monaco Editor${monacoEls.length > 1 ? ` #${i + 1}` : ""}`,
        code: textarea.value,
      });
      return;
    }
    // Fallback: read from .view-lines
    const viewLines = el.querySelector(".view-lines");
    if (viewLines?.textContent?.trim()) {
      editors.push({
        key: makeKey("monaco", i),
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
        key: makeKey("codemirror5", i),
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
        key: makeKey("codemirror6", i),
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
        key: makeKey("ace", i),
        label: `Ace Editor${aceEls.length > 1 ? ` #${i + 1}` : ""}`,
        code: textLayer.textContent,
      });
    }
  });

  // ─── Rich Text Editors (Notion, Tiptap, Quill, etc) ───
  richTextEls.forEach((el, i) => {
    // Most rich text editors render to innerText cleanly based on block elements
    const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim();
    if (text && text.length > 5) {
      editors.push({
        key: makeKey("richtext", i),
        label: `Rich Text Editor${richTextEls.length > 1 ? ` #${i + 1}` : ""}`,
        code: text,
      });
    }
  });

  // ─── Standard Inputs & Textareas ───
  inputEls.forEach((el, i) => {
    const htmlEl = el as HTMLInputElement | HTMLTextAreaElement;

    // Skip hidden/invisible elements
    if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) return;

    const text = htmlEl.value?.trim() || el.textContent?.trim() || "";

    // Build a descriptive label from the field's attributes
    const hint =
      htmlEl.placeholder ||
      htmlEl.getAttribute("aria-label") ||
      htmlEl.getAttribute("name") ||
      htmlEl.id ||
      "";
    const suffix = inputEls.length > 1 ? ` #${i + 1}` : "";
    const label = hint
      ? `Text Input: "${hint}"${suffix}`
      : `Text Input${suffix}`;

    editors.push({
      key: makeKey("input", i),
      label,
      code: text,
    });
  });

  // ─── Generic contenteditable blocks (not inside known editors) ───
  editables.forEach((el, i) => {
    // Use innerText to preserve basic line breaks visually
    const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim();
    if (text && text.length > 20) {
      editors.push({
        key: makeKey("editable", i),
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
    let article: any = null;
    let html = "";
    try {
      // ⚠️ Stitch uses complex DOMs that can fail cloning or Readability parsing
      const doc = document.cloneNode(true) as Document;
      const reader = new Readability(doc);
      article = reader.parse();
      html = article?.content ?? document.body.innerHTML;
    } catch (e: any) {
      console.warn("Readability or cloneNode failed, falling back to raw body", e);
      html = document.body.innerHTML; 
    }

    // 3. Convert page content to Markdown
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    let markdown = turndown.turndown(html);

    // 4. Prepend editor content (if found) to Markdown
    let editorContentsPayload: Record<string, { label: string; code: string }> | undefined;

    if (editorBlocks.length > 0) {
      const editorSection = editorBlocks
        .map((e) => `### ${e.label}\n\`\`\`\n${e.code}\n\`\`\``)
        .join("\n\n");

      markdown = `## Editor Content\n\n${editorSection}\n\n---\n\n## Page Content\n\n${markdown}`;

      // Build dictionary for background.ts
      editorContentsPayload = {};
      for (const block of editorBlocks) {
        editorContentsPayload[block.key] = { label: block.label, code: block.code };
      }
    }

    // 5. Truncate
    if (markdown.length > MAX_CONTENT_LENGTH) {
      markdown = markdown.slice(0, MAX_CONTENT_LENGTH) + "\n\n[...content truncated]";
    }

    sendResponse({
      title: article?.title ?? document.title,
      url: window.location.href,
      markdown,
      editorContents: editorContentsPayload,
    });
  } catch (err: any) {
    sendResponse({ error: err.message });
  }

  return true; // async response
});

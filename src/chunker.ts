/**
 * Snapshot Store & Text Chunker
 *
 * Two-slot per-tab snapshot store with diff support.
 * Enables the LLM to see what changed between messages
 * and selectively read page content via tool calling.
 */

import { diffLines, createTwoFilesPatch } from "diff";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const DEFAULT_CHUNK_SIZE = 2000;
const DEFAULT_OVERLAP = 200;
const MAX_CHUNKS = 100;
const TTL_MS = 30 * 60 * 1000; // 30 minutes
const DIFF_THRESHOLD_RATIO = 0.3; // 30% of lines changed = "too much"

// ═══════════════════════════════════════════════════════════
// TEXT SPLITTER
// ═══════════════════════════════════════════════════════════

/**
 * Finds the best split index for a chunk, preferring paragraph or newline boundaries.
 */
function findSplitIndex(
  text: string,
  start: number,
  end: number,
  minChunkSize: number,
): number {
  if (end >= text.length) return end;

  const slice = text.slice(start, end);

  // Try to break at a paragraph boundary (double newline)
  const lastParagraph = slice.lastIndexOf("\n\n");
  if (lastParagraph > minChunkSize) {
    return start + lastParagraph + 2;
  }

  // Try to break at a newline
  const lastNewline = slice.lastIndexOf("\n");
  if (lastNewline > minChunkSize) {
    return start + lastNewline + 1;
  }

  return end;
}

/**
 * Split text into character-based chunks with overlap.
 * Tries to break at paragraph/newline boundaries when possible.
 * Caps at MAX_CHUNKS to prevent memory blowup.
 */
export function splitIntoChunks(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
): string[] {
  if (!text || text.length === 0) return [];
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;
  // Threshold for finding a "good" break point (50% of chunk size)
  const minChunkSize = chunkSize * 0.5;

  while (start < text.length && chunks.length < MAX_CHUNKS) {
    const maxEnd = Math.min(start + chunkSize, text.length);
    const end = findSplitIndex(text, start, maxEnd, minChunkSize);

    chunks.push(text.slice(start, end).trim());

    // Calculate overlap: ensure we advance at least 1 character
    // The next chunk starts 'overlap' characters before the current one ends.
    // step = current_chunk_length - overlap
    const step = Math.max(end - start - overlap, 1);
    start += step;
  }

  return chunks;
}

// ═══════════════════════════════════════════════════════════
// CONTENT HASH
// ═══════════════════════════════════════════════════════════

/** Fast djb2 string hash — used as a gate before expensive diffing. */
function hashContent(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

// ═══════════════════════════════════════════════════════════
// SNAPSHOT TYPES
// ═══════════════════════════════════════════════════════════

export type Snapshot = {
  url: string;
  title: string;
  markdown: string;
  chunks: string[];
  hash: string;
  updatedAt: number;
  editorContents?: Record<string, { label: string; code: string }>;
};

export type DiffResult =
  | { type: "unchanged" }
  | { type: "small_diff"; patch: string; changedLines: number; totalLines: number; changedChunks: number[] }
  | { type: "large_diff"; changedLines: number; totalLines: number; changedChunks: number[] }
  | { type: "url_changed"; oldUrl: string; newUrl: string }
  | { type: "no_previous" };

// ═══════════════════════════════════════════════════════════
// SNAPSHOT STORE (per tab)
// ═══════════════════════════════════════════════════════════

type TabEntry = {
  latest: Snapshot;
  previous: Snapshot | null;
};

class SnapshotStoreImpl {
  // In-memory cache to avoid constant storage reads
  private tabs = new Map<number, TabEntry>();

  /**
   * Load tab state from storage (or use cache).
   */
  private async loadTab(tabId: number): Promise<TabEntry | null> {
    if (this.tabs.has(tabId)) {
      return this.tabs.get(tabId)!;
    }

    try {
      const key = `snapshot_${tabId}`;
      const result = await chrome.storage.local.get(key);
      const entry = result[key] as TabEntry | undefined;
      
      if (entry) {
        this.tabs.set(tabId, entry);
        return entry;
      }
    } catch (err) {
      console.error("Failed to load snapshot from storage", err);
    }
    return null;
  }

  /**
   * Save tab state to storage (and update cache).
   */
  private async saveTab(tabId: number, entry: TabEntry): Promise<void> {
    this.tabs.set(tabId, entry);
    try {
      const key = `snapshot_${tabId}`;
      await chrome.storage.local.set({ [key]: entry });
    } catch (err) {
      console.error("Failed to save snapshot to storage", err);
    }
  }

  /**
   * Push new content for a tab.
   * Moves current `latest` → `previous`, stores new content as `latest`.
   * Returns the diff result between old latest and new content.
   */
  async push(
    tabId: number,
    content: { url: string; title: string; markdown: string; editorContents?: Record<string, { label: string; code: string }> },
  ): Promise<{ snapshot: Snapshot; diff: DiffResult }> {
    const newHash = hashContent(content.markdown);
    const newChunks = splitIntoChunks(content.markdown);
    const newSnapshot: Snapshot = {
      url: content.url,
      title: content.title,
      markdown: content.markdown,
      chunks: newChunks,
      hash: newHash,
      updatedAt: Date.now(),
      editorContents: content.editorContents,
    };

    const existing = await this.loadTab(tabId);

    // First time for this tab
    if (!existing) {
      const entry = { latest: newSnapshot, previous: null };
      await this.saveTab(tabId, entry);
      return { snapshot: newSnapshot, diff: { type: "no_previous" } };
    }

    const oldLatest = existing.latest;

    // Check if stale (TTL expired) — treat as fresh start
    if (Date.now() - oldLatest.updatedAt > TTL_MS) {
      const entry = { latest: newSnapshot, previous: null };
      await this.saveTab(tabId, entry);
      return { snapshot: newSnapshot, diff: { type: "no_previous" } };
    }

    // Slide: latest → previous, new → latest
    const newEntry = { latest: newSnapshot, previous: oldLatest };
    await this.saveTab(tabId, newEntry);

    // URL changed — different page entirely
    if (oldLatest.url !== content.url) {
      return {
        snapshot: newSnapshot,
        diff: { type: "url_changed", oldUrl: oldLatest.url, newUrl: content.url },
      };
    }

    // Hash identical — nothing changed
    if (oldLatest.hash === newHash) {
      return { snapshot: newSnapshot, diff: { type: "unchanged" } };
    }

    // Compute diff
    return {
      snapshot: newSnapshot,
      diff: this.computeDiff(oldLatest.markdown, content.markdown, oldLatest.chunks, newChunks),
    };
  }

  /** Get chunks from a specific source for a tab. */
  async getChunks(
    tabId: number,
    source: "latest" | "previous",
    indices: number[],
  ): Promise<{ index: number; content: string }[]> {
    const entry = await this.loadTab(tabId);
    if (!entry) return [];

    const snapshot = source === "latest" ? entry.latest : entry.previous;
    if (!snapshot) return [];

    return indices
      .filter((i) => i >= 0 && i < snapshot.chunks.length)
      .map((i) => ({ index: i, content: snapshot.chunks[i] }));
  }

  /** Get specific extracted editor/input content by key. */
  async getEditorContent(
    tabId: number,
    source: "latest" | "previous",
    key: string,
  ): Promise<string | null> {
    const entry = await this.loadTab(tabId);
    if (!entry) return null;

    const snapshot = source === "latest" ? entry.latest : entry.previous;
    if (!snapshot || !snapshot.editorContents) return null;

    return snapshot.editorContents[key]?.code || null;
  }

  /** Get metadata for a tab's snapshots. */
  async getMeta(tabId: number): Promise<{
    latest: { url: string; title: string; totalChunks: number } | null;
    previous: { url: string; title: string; totalChunks: number } | null;
  }> {
    const entry = await this.loadTab(tabId);
    if (!entry) return { latest: null, previous: null };

    return {
      latest: {
        url: entry.latest.url,
        title: entry.latest.title,
        totalChunks: entry.latest.chunks.length,
      },
      previous: entry.previous
        ? {
            url: entry.previous.url,
            title: entry.previous.title,
            totalChunks: entry.previous.chunks.length,
          }
        : null,
    };
  }

  async pruneStale(): Promise<void> {
    const now = Date.now();
    try {
      const allData = await chrome.storage.local.get(null);
      const keysToRemove: string[] = [];

      for (const key in allData) {
        if (key.startsWith("snapshot_")) {
          const entry = allData[key] as TabEntry;
          // Safety check: ensure entry has the expected structure
          if (entry?.latest?.updatedAt && now - entry.latest.updatedAt > TTL_MS) {
            keysToRemove.push(key);
            // Also remove from in-memory cache if present
            const tabId = parseInt(key.replace("snapshot_", ""), 10);
            if (!isNaN(tabId)) {
              this.tabs.delete(tabId);
            }
          }
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch (err) {
      console.error("Failed to prune stale snapshots:", err);
    }
  }

  /** Clear a specific tab's data. */
  async clearTab(tabId: number): Promise<void> {
    this.tabs.delete(tabId);
    await chrome.storage.local.remove(`snapshot_${tabId}`);
  }

  // ─── Private ───

  private computeDiff(
    oldText: string,
    newText: string,
    oldChunks: string[],
    newChunks: string[],
  ): DiffResult {
    const changes = diffLines(oldText, newText);

    // Count changed lines
    let changedLines = 0;
    let totalLines = 0;
    for (const change of changes) {
      const count = change.count ?? 0;
      if (change.added || change.removed) {
        changedLines += count;
      }
      totalLines += count;
    }

    // Avoid division by zero
    if (totalLines === 0) return { type: "unchanged" };

    // Find which chunks changed
    const changedChunks: number[] = [];
    const maxLen = Math.max(oldChunks.length, newChunks.length);
    for (let i = 0; i < maxLen; i++) {
      if (oldChunks[i] !== newChunks[i]) changedChunks.push(i);
    }

    const ratio = changedLines / totalLines;

    if (ratio > DIFF_THRESHOLD_RATIO) {
      return { type: "large_diff", changedLines, totalLines, changedChunks };
    }

    // Generate unified diff patch
    const patch = createTwoFilesPatch(
      "previous",
      "current",
      oldText,
      newText,
      "",
      "",
      { context: 3 },
    );

    return { type: "small_diff", patch, changedLines, totalLines, changedChunks };
  }
}

// Singleton — lives as long as the service worker
export const snapshotStore = new SnapshotStoreImpl();

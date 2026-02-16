import { ChatMessage } from "./gemini";

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type SessionMetadata = Omit<ChatSession, "messages">;

const STORAGE_KEYS = {
  INDEX: "sessions_index",
  SESSION_PREFIX: "session_",
};

/**
 * Simple mutex to prevent race conditions during session saves.
 */
class AsyncMutex {
  private mutex = Promise.resolve();

  lock(): Promise<() => void> {
    let begin: (unlock: () => void) => void = () => {};

    this.mutex = this.mutex.then(() => {
      return new Promise<void>(resolve => {
        begin = resolve;
      });
    });

    return new Promise<() => void>(resolve => {
      resolve(begin);
    });
  }

  async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
    const unlock = await this.lock();
    try {
      return await callback();
    } finally {
      unlock();
    }
  }
}

const sessionSaveMutex = new AsyncMutex();

/**
 * Generate a title for the session based on the first user message.
 */
export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Chat";

  // Handle both backend (parts) and frontend (content) message formats
  const msg: any = firstUserMsg;
  let text = "";
  
  if (msg.content) {
    text = msg.content;
  } else if (msg.parts) {
    text = msg.parts.map((p: any) => p.text).join(" ");
  }
  
  text = text.trim();
  
  if (!text) return "New Chat";
  
  return text.length > 40 ? text.slice(0, 40) + "..." : text;
}

/**
 * Create a new empty session.
 */
export async function createSession(): Promise<ChatSession> {
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  await saveSession(session);
  return session;
}

/**
 * Save a session (updates messages and the sessions index).
 */
export async function saveSession(session: ChatSession): Promise<void> {
  // Update title if needed (e.g. first message added)
  if (session.title === "New Chat" && session.messages.length > 0) {
    session.title = generateTitle(session.messages);
  }
  
  session.updatedAt = Date.now();

  
  return sessionSaveMutex.runExclusive(async () => {
    try {
      // 1. Save full session data
      const key = `${STORAGE_KEYS.SESSION_PREFIX}${session.id}`;
      await chrome.storage.local.set({ [key]: session });

      // 2. Update index
      // Re-fetch index to ensure it's fresh
      const index = await listSessions();
      const existingIdx = index.findIndex((s) => s.id === session.id);
      
      const metadata: SessionMetadata = {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };

      if (existingIdx >= 0) {
        index[existingIdx] = metadata;
      } else {
        index.unshift(metadata);
      }

      // Sort by updatedAt desc
      index.sort((a, b) => b.updatedAt - a.updatedAt);
      
      await chrome.storage.local.set({ [STORAGE_KEYS.INDEX]: index });
    } catch (error: any) {
      console.error("Failed to save session:", error);
      if (error.message?.includes("QUOTA_BYTES")) {
        // Handle quota exceeded (maybe trim old sessions? for now just log)
        console.warn("Storage quota exceeded!");
      }
      throw error;
    }
  });
}

/**
 * Load a full session by ID.
 */
export async function loadSession(id: string): Promise<ChatSession | null> {
  const key = `${STORAGE_KEYS.SESSION_PREFIX}${id}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

/**
 * List all sessions (metadata only).
 */
export async function listSessions(): Promise<SessionMetadata[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.INDEX);
  return result[STORAGE_KEYS.INDEX] || [];
}

/**
 * Delete a session and remove it from the index.
 */
export async function deleteSession(id: string): Promise<void> {
  const key = `${STORAGE_KEYS.SESSION_PREFIX}${id}`;
  
  // 1. Remove session data
  await chrome.storage.local.remove(key);
  
  // 2. Remove from index
  const index = await listSessions();
  const newIndex = index.filter((s) => s.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.INDEX]: newIndex });
}

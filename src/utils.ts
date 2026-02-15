import type { Message, ApiMessage } from "./types";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

export const MAX_HISTORY_MESSAGES = 25;

export function messagesToApiHistory(messages: Message[]): ApiMessage[] {
  const filtered = messages
    .filter((m) => m.content)
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.content }],
    }));
  // Sliding window: only send the last N messages to the API
  return filtered.slice(-MAX_HISTORY_MESSAGES);
}

export function formatTime(ms: number) {
  const date = new Date(ms);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

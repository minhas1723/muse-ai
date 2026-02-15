
// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

import type { AuthProvider } from "./providers";

export type AuthStatus = {
  loggedIn: boolean;
  email: string | null;
  projectId: string | null;
  provider?: AuthProvider;
  error?: string;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  usage?: { input: number; output: number; total: number };
  model?: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, any>;
    source: "latest" | "previous";
    round: number;
  }>;
};

export type ApiMessage = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

// Re-export specific types from sessions if needed
export type { SessionMetadata } from "./sessions";

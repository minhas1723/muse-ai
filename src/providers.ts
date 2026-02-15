/**
 * Provider Configurations — Antigravity & Gemini CLI
 *
 * Single source of truth for all provider-specific constants:
 * client credentials, scopes, endpoints, and headers.
 */

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type AuthProvider = "gemini-cli" | "antigravity";

export type ProviderConfig = {
  id: AuthProvider;
  label: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  /** Endpoints for streaming API calls, in fallback order */
  endpoints: string[];
  /** Endpoints for project ID discovery during login (may differ in order) */
  projectDiscoveryEndpoints: string[];
  /** HTTP headers for API calls */
  headers: Record<string, string>;
  /** Value for `userAgent` field in request body */
  userAgent: string;
  /** Value for `requestType` field in request body (omitted if undefined) */
  requestType?: string;
};

// ═══════════════════════════════════════════════════════════
// GEMINI CLI
// ═══════════════════════════════════════════════════════════

export const GEMINI_CLI_PROVIDER: ProviderConfig = {
  id: "gemini-cli",
  label: "Gemini CLI",
  clientId: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
  clientSecret: "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",
  redirectUri: "http://localhost:8085/oauth2callback",
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  endpoints: [
    "https://cloudcode-pa.googleapis.com",
  ],
  projectDiscoveryEndpoints: [
    "https://cloudcode-pa.googleapis.com",
    "https://daily-cloudcode-pa.sandbox.googleapis.com",
  ],
  headers: {
    "User-Agent": "google-cloud-sdk vscode_cloudshelleditor/0.1",
    "X-Goog-Api-Client": "gl-node/22.17.0",
    "Client-Metadata": JSON.stringify({
      ideType: "IDE_UNSPECIFIED",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "GEMINI",
    }),
  },
  userAgent: "pi-coding-agent",
};

// ═══════════════════════════════════════════════════════════
// ANTIGRAVITY (Cloud Code Assist / Jules)
// ═══════════════════════════════════════════════════════════

export const ANTIGRAVITY_PROVIDER: ProviderConfig = {
  id: "antigravity",
  label: "Antigravity",
  clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
  clientSecret: "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",
  redirectUri: "http://localhost:51121/oauth-callback",
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
  ],
  // SDK order: daily/sandbox first, prod second
  endpoints: [
    "https://daily-cloudcode-pa.sandbox.googleapis.com",
    "https://cloudcode-pa.googleapis.com",
  ],
  // Login/project discovery: prod first
  projectDiscoveryEndpoints: [
    "https://cloudcode-pa.googleapis.com",
    "https://daily-cloudcode-pa.sandbox.googleapis.com",
  ],
  headers: {
    "User-Agent": "antigravity/1.15.8 darwin/arm64",
    "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
    "Client-Metadata": JSON.stringify({
      ideType: "IDE_UNSPECIFIED",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "GEMINI",
    }),
  },
  userAgent: "antigravity",
  requestType: "agent",
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

const PROVIDERS: Record<AuthProvider, ProviderConfig> = {
  "gemini-cli": GEMINI_CLI_PROVIDER,
  "antigravity": ANTIGRAVITY_PROVIDER,
};

export function getProvider(id: AuthProvider): ProviderConfig {
  return PROVIDERS[id];
}

export const DEFAULT_PROJECT_ID = "rising-fact-p41fc";

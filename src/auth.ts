/**
 * Auth Module for Chrome Extension
 *
 * Supports two providers: Gemini CLI and Antigravity.
 *
 * Tab-based OAuth flow:
 *   1. Opens a new tab with Google consent screen
 *   2. Auto-captures the auth code from the redirect URL via chrome.tabs.onUpdated
 *   3. Exchanges the code for access + refresh tokens
 *
 * Fallback: Manual copy-paste flow via getLoginUrl() + exchangeManualCode()
 */

import {
  type AuthProvider,
  type ProviderConfig,
  getProvider,
  GEMINI_CLI_PROVIDER,
  DEFAULT_PROJECT_ID,
} from "./providers";

// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════

/**
 * Simple mutex to prevent race conditions during token refresh.
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

const tokenRefreshMutex = new AsyncMutex();

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type StoredCredentials = {
  accessToken: string;
  refreshToken: string;
  expires: number;
  email?: string;
  projectId: string;
  provider: AuthProvider;
};

export type AuthStatus = {
  loggedIn: boolean;
  email: string | null;
  projectId: string | null;
  provider?: AuthProvider;
};

// ═══════════════════════════════════════════════════════════
// TOKEN STORAGE
// ═══════════════════════════════════════════════════════════

async function saveCredentials(creds: StoredCredentials): Promise<void> {
  await chrome.storage.local.set({ auth: creds });
}

export async function getCredentials(): Promise<StoredCredentials | null> {
  const result = await chrome.storage.local.get("auth");
  return result.auth ?? null;
}

export async function clearCredentials(): Promise<void> {
  await chrome.storage.local.remove("auth");
}

// ═══════════════════════════════════════════════════════════
// OAUTH URL BUILDER
// ═══════════════════════════════════════════════════════════

function buildOAuthUrl(config: ProviderConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ═══════════════════════════════════════════════════════════
// TAB-BASED AUTO-CAPTURE
// ═══════════════════════════════════════════════════════════

/**
 * Opens a new tab and waits for the OAuth redirect.
 * Auto-extracts the auth code from the redirect URL,
 * then closes the tab.
 */
function waitForAuthRedirect(tabId: number, config: ProviderConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(updateListener);
      chrome.tabs.onRemoved.removeListener(removeListener);
    };

    const updateListener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId !== tabId || !changeInfo.url) return;

      // Check if the URL starts with our provider's redirect URI
      if (changeInfo.url.startsWith(config.redirectUri)) {
        cleanup();
        // Close the tab immediately (don't wait for connection refused)
        chrome.tabs.remove(tabId).catch(() => {});

        try {
          const code = extractCodeFromUrl(changeInfo.url);
          if (code) {
            resolve(code);
          } else {
            reject(new Error("No authorization code in redirect URL"));
          }
        } catch (err: any) {
          reject(err);
        }
      }
    };

    const removeListener = (removedTabId: number) => {
      if (removedTabId !== tabId) return;
      cleanup();
      reject(new Error("AUTH_TAB_CLOSED"));
    };

    chrome.tabs.onUpdated.addListener(updateListener);
    chrome.tabs.onRemoved.addListener(removeListener);
  });
}

/**
 * Extract auth code from a redirect URL or raw code string.
 * Accepts:
 *   - Full URL: http://localhost:8085/oauth2callback?code=4/0A...&scope=...
 *   - Just the code: 4/0AfgkS...
 */
function extractCodeFromUrl(input: string): string | null {
  try {
    if (input.includes("?") || input.includes("://")) {
      const url = new URL(input);
      const error = url.searchParams.get("error");
      if (error) {
        throw new Error(`Google OAuth error: ${error}`);
      }
      return url.searchParams.get("code");
    }
    // Raw code string
    return input.trim() || null;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Google OAuth")) {
      throw err;
    }
    return input.trim() || null;
  }
}

// ═══════════════════════════════════════════════════════════
// LOGIN FLOW (Tab-based)
// ═══════════════════════════════════════════════════════════

export async function login(providerId: AuthProvider = "gemini-cli"): Promise<StoredCredentials> {
  const config = getProvider(providerId);

  const authUrl = buildOAuthUrl(config);
  console.log(`🚀 Opening OAuth tab [${config.label}]:`, authUrl);

  // Open a new tab with the Google consent screen
  const tab = await chrome.tabs.create({ url: authUrl });
  if (!tab.id) throw new Error("Failed to open auth tab");

  // Wait for the redirect and auto-capture the code
  const code = await waitForAuthRedirect(tab.id, config);

  // Exchange code for tokens
  return await completeLogin(code, config);
}

// ═══════════════════════════════════════════════════════════
// MANUAL FLOW (Copy-Paste Fallback)
// ═══════════════════════════════════════════════════════════

/**
 * Get the OAuth URL for the manual copy-paste flow.
 * The user opens this URL in a browser, signs in, then copies
 * the code (or full URL) from the redirect page.
 */
export async function getLoginUrl(providerId: AuthProvider = "gemini-cli"): Promise<string> {
  const config = getProvider(providerId);
  return buildOAuthUrl(config);
}

/**
 * Exchange a manually-pasted code or redirect URL for credentials.
 * Accepts either the raw auth code or the full redirect URL.
 */
export async function exchangeManualCode(
  codeOrUrl: string,
  providerId: AuthProvider = "gemini-cli"
): Promise<StoredCredentials> {
  const config = getProvider(providerId);

  const code = extractCodeFromUrl(codeOrUrl);
  if (!code) {
    throw new Error("Could not extract auth code. Please try again.");
  }

  try {
    return await completeLogin(code, config);
  } catch (err: any) {
    console.error("Manual auth failed:", err);
    throw new Error(`Manual authentication failed: ${err.message || "Unknown error"}`);
  }
}

// ═══════════════════════════════════════════════════════════
// SHARED: Code → Tokens → Credentials
// ═══════════════════════════════════════════════════════════

async function completeLogin(
  code: string,
  config: ProviderConfig
): Promise<StoredCredentials> {
  const tokens = await exchangeCodeForTokens(
    code,
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  const email = await fetchUserEmail(tokens.accessToken);
  const projectId = await fetchProjectId(tokens.accessToken, config.projectDiscoveryEndpoints);

  const creds: StoredCredentials = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expires: Date.now() + tokens.expiresIn * 1000 - 60000,
    email,
    projectId,
    provider: config.id,
  };

  await saveCredentials(creds);
  console.log(`✅ Logged in as ${email ?? "unknown"} via ${config.label} | Project: ${projectId}`);
  return creds;
}

// ═══════════════════════════════════════════════════════════
// LOGOUT / STATUS
// ═══════════════════════════════════════════════════════════

export async function logout(): Promise<void> {
  const creds = await getCredentials();
  if (creds?.accessToken) {
    try {
      await fetch(
        `https://accounts.google.com/o/oauth2/revoke?token=${creds.accessToken}`
      );
    } catch {}
  }
  await clearCredentials();
  console.log("🚪 Logged out");
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const creds = await getCredentials();
  if (!creds) {
    return { loggedIn: false, email: null, projectId: null };
  }
  return {
    loggedIn: true,
    email: creds.email ?? null,
    projectId: creds.projectId ?? null,
    provider: creds.provider,
  };
}

export async function ensureValidToken(): Promise<string> {
  let creds = await getCredentials();
  if (!creds || !creds.accessToken) throw new Error("Not logged in");

  // Check expiry again inside the lock (double-checked locking)
  return await tokenRefreshMutex.runExclusive(async () => {
    // Re-read credentials to ensure we have the latest
    creds = await getCredentials();
    if (!creds || !creds.accessToken) throw new Error("Not logged in");

    if (Date.now() > creds.expires) {
      console.log("🔄 Token expired, refreshing...");
      if (!creds.refreshToken)
        throw new Error("Session expired and no refresh token");

      // Use the stored provider for refresh
      const config = getProvider(creds.provider ?? "gemini-cli");
      const newTokens = await refreshAccessToken(
        creds.refreshToken,
        config.clientId,
        config.clientSecret
      );

      creds = {
        ...creds,
        accessToken: newTokens.accessToken,
        expires: Date.now() + newTokens.expiresIn * 1000 - 60000,
      };
      await saveCredentials(creds);
    }
    
    return creds.accessToken;
  });
}

// ═══════════════════════════════════════════════════════════
// TOKEN EXCHANGE HELPERS
// ═══════════════════════════════════════════════════════════

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error_description || "Token exchange failed");

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error_description || "Token refresh failed");

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

async function fetchUserEmail(
  accessToken: string
): Promise<string | undefined> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.email;
  } catch {
    return undefined;
  }
}

async function fetchProjectId(
  accessToken: string,
  endpoints: readonly string[]
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "google-cloud-sdk vscode_cloudshelleditor/0.1",
    "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
    "Client-Metadata": JSON.stringify({
      ideType: "IDE_UNSPECIFIED",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "GEMINI",
    }),
  };

  try {
    return await Promise.any(
      endpoints.map(async (endpoint) => {
        const res = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            metadata: {
              ideType: "IDE_UNSPECIFIED",
              platform: "PLATFORM_UNSPECIFIED",
              pluginType: "GEMINI",
            },
          }),
        });

        if (!res.ok) {
          throw new Error("Request failed");
        }

        const data = await res.json();
        if (typeof data.cloudaicompanionProject === "string") {
          return data.cloudaicompanionProject;
        }
        if (data.cloudaicompanionProject?.id) {
          return data.cloudaicompanionProject.id;
        }
        throw new Error("Invalid response format");
      })
    );
  } catch {
    return DEFAULT_PROJECT_ID;
  }
}

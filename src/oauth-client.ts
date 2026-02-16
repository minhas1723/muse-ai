/**
 * OAuth Client Helper Module
 *
 * Handles direct communication with the OAuth token endpoint.
 * Extracted from auth.ts to improve maintainability and testability.
 */

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface CodeExchangeResponse extends TokenResponse {
  refreshToken: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

// ═══════════════════════════════════════════════════════════
// HELPER: performTokenRequest
// ═══════════════════════════════════════════════════════════

async function performTokenRequest(
  params: URLSearchParams,
  errorMessageFallback: string
): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok) {
    throw new Error(data.error_description || errorMessageFallback);
  }
  return data;
}

// ═══════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS
// ═══════════════════════════════════════════════════════════

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<CodeExchangeResponse> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const data = await performTokenRequest(params, "Token exchange failed");

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token!, // refresh_token is expected for code exchange
    expiresIn: data.expires_in,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const data = await performTokenRequest(params, "Token refresh failed");

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

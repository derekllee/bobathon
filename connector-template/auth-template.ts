/**
 * auth-template.ts — OAuth2 Client-Credentials Token Manager
 *
 * [CUSTOMIZE: This template covers OAuth2 client_credentials flow (IBM App ID,
 *  Keycloak, Okta, Azure AD, etc.). If your system uses API keys or session
 *  cookies instead, see the "Alternative auth patterns" section at the bottom.]
 *
 * Usage:
 *   const auth  = new TokenManager({ clientId: "...", clientSecret: "..." });
 *   const token = await auth.getToken();   // cached; safe to call on every request
 *
 * Required env vars (if not passed to constructor):
 *   MY_CLIENT_ID      — OAuth2 client_id   [CUSTOMIZE: rename prefix]
 *   MY_CLIENT_SECRET  — OAuth2 client_secret
 *   MY_TOKEN_URL      — Full token endpoint URL (optional; falls back to DEFAULT_TOKEN_URL)
 */

import axios from "axios";

// ─── Error class ──────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  token_type:   string;
  expires_in:   number; // seconds
}

interface CachedToken {
  token:     string;
  expiresAt: number; // epoch ms
}

// ─── Config ───────────────────────────────────────────────────────────────────

// [CUSTOMIZE: replace with your system's real token endpoint]
const DEFAULT_TOKEN_URL = "https://YOUR_IDP_HOST/oauth/token";

// Refresh this many ms before actual expiry to avoid using a token that just expired
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

// ─── Token Manager ────────────────────────────────────────────────────────────

export class TokenManager {
  // [CUSTOMIZE: rename to match your system, e.g. "IamTokenManager", "OktaTokenManager"]
  private clientId:     string;
  private clientSecret: string;
  private tokenUrl:     string;
  private cached:       CachedToken | null = null;

  constructor(config?: {
    clientId?:     string;
    clientSecret?: string;
    tokenUrl?:     string;
  }) {
    this.clientId     = config?.clientId     ?? process.env.MY_CLIENT_ID     ?? ""; // [CUSTOMIZE: env var names]
    this.clientSecret = config?.clientSecret ?? process.env.MY_CLIENT_SECRET ?? "";
    this.tokenUrl     = config?.tokenUrl     ?? process.env.MY_TOKEN_URL     ?? DEFAULT_TOKEN_URL;

    if (!this.clientId || !this.clientSecret) {
      throw new AuthError(
        "MY_CLIENT_ID and MY_CLIENT_SECRET must be set. " +
        "[CUSTOMIZE: describe where to obtain credentials, e.g. 1Password vault name]"
      );
    }
  }

  /**
   * Returns a valid Bearer token. Fetches a new one only when the cached
   * token is absent or within REFRESH_BUFFER_MS of expiry.
   */
  async getToken(): Promise<string> {
    if (this.cached && Date.now() < this.cached.expiresAt) {
      return this.cached.token;
    }
    return this.fetchToken();
  }

  /** Convenience method — returns the full "Bearer <token>" header value. */
  async getAuthHeader(): Promise<string> {
    return `Bearer ${await this.getToken()}`;
  }

  /** Force-expire the cached token. Useful in tests. */
  clearCache(): void {
    this.cached = null;
  }

  private async fetchToken(): Promise<string> {
    // Standard client_credentials grant — works with IBM App ID, Keycloak, Okta, Azure AD
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    let response: TokenResponse;
    try {
      const res = await axios.post<TokenResponse>(
        this.tokenUrl,
        "grant_type=client_credentials", // [CUSTOMIZE: add scope= param if required]
        {
          headers: {
            Authorization:  `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 10_000,
        },
      );
      response = res.data;
    } catch (err: any) {
      const status = err.response?.status;
      const msg    = err.response?.data?.error_description ?? err.message;
      if (status === 401) {
        throw new AuthError(
          `Authentication failed (401). Verify MY_CLIENT_ID / MY_CLIENT_SECRET. Detail: ${msg}`
          // [CUSTOMIZE: env var names in the error message]
        );
      }
      throw new AuthError(`Failed to fetch token (${status ?? "network error"}): ${msg}`);
    }

    if (!response.access_token) {
      throw new AuthError("Token endpoint returned no access_token.");
    }

    const expiresInMs = (response.expires_in ?? 3600) * 1000; // [CUSTOMIZE: default if missing]
    this.cached = {
      token:     response.access_token,
      expiresAt: Date.now() + expiresInMs - REFRESH_BUFFER_MS,
    };

    console.log(`[TokenManager] Token refreshed. Expires in ~${Math.round(expiresInMs / 60000)}m.`);
    return this.cached.token;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Call once at server startup; inject the returned instance into MyClient. */
export function createTokenManager(config?: ConstructorParameters<typeof TokenManager>[0]): TokenManager {
  return new TokenManager(config);
}

// ─── Alternative auth patterns ────────────────────────────────────────────────
//
// API KEY (simplest):
//   Skip this file entirely. Pass a token provider directly in index-template.ts:
//     async () => process.env.MY_API_KEY ?? ""
//
// SESSION / COOKIE auth:
//   Replace fetchToken() with a login POST that returns a session cookie.
//   Store the cookie string in this.cached.token and add it as a
//   "Cookie: session=..." header instead of "Authorization: Bearer ...".
//
// IBM IAM (watsonx / Cloud services):
//   Use the same pattern but with IBM's IAM token endpoint:
//     POST https://iam.cloud.ibm.com/identity/token
//     body: grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={IBM_API_KEY}
//   Set DEFAULT_TOKEN_URL accordingly and use "apikey" not client_id/secret.

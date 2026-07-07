"use strict";
/**
 * IBM App ID Token Manager
 *
 * CSP's API Gateway authenticates via IBM App ID OAuth2 (client_credentials grant).
 * Credentials are stored in 1Password:
 *   Vault: "CSP Test Automation"
 *   Item:  "API case requests SF_Bot/API_Gateway"
 *
 * Token endpoint:
 *   POST https://us-south.appid.cloud.ibm.com/oauth/v4/cdbe3fa4-35a9-45b9-9efa-15b1a50cdc11/token
 *
 * Token lifetime: 24 hours (as documented in CSP Dev Playbook)
 *
 * Required env vars:
 *   CSP_CLIENT_ID      — App ID client_id from 1Password
 *   CSP_CLIENT_SECRET  — App ID client_secret from 1Password
 *   CSP_TOKEN_URL      — Token endpoint URL (defaults to prod App ID URL above)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IamTokenManager = exports.AuthError = void 0;
exports.createTokenManager = createTokenManager;
const axios_1 = __importDefault(require("axios"));
class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthError";
    }
}
exports.AuthError = AuthError;
const DEFAULT_TOKEN_URL = "https://us-south.appid.cloud.ibm.com/oauth/v4/cdbe3fa4-35a9-45b9-9efa-15b1a50cdc11/token";
// Refresh 5 minutes before actual expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
class IamTokenManager {
    clientId;
    clientSecret;
    tokenUrl;
    cached = null;
    constructor(config) {
        this.clientId = config?.clientId ?? process.env.CSP_CLIENT_ID ?? "";
        this.clientSecret = config?.clientSecret ?? process.env.CSP_CLIENT_SECRET ?? "";
        this.tokenUrl = config?.tokenUrl ?? process.env.CSP_TOKEN_URL ?? DEFAULT_TOKEN_URL;
        if (!this.clientId || !this.clientSecret) {
            throw new AuthError("CSP_CLIENT_ID and CSP_CLIENT_SECRET env vars must be set. " +
                "Get credentials from 1Password → Vault: 'CSP Test Automation' → " +
                "Item: 'API case requests SF_Bot/API_Gateway'.");
        }
    }
    /**
     * Returns a valid Bearer token, fetching or refreshing as needed.
     * Tokens are cached for their lifetime (24h) minus a 5-minute buffer.
     */
    async getToken() {
        if (this.cached && Date.now() < this.cached.expiresAt) {
            return this.cached.token;
        }
        return this.fetchToken();
    }
    /**
     * Returns the Authorization header value ready for use with axios.
     * @example headers: { Authorization: await auth.getAuthHeader() }
     */
    async getAuthHeader() {
        return `Bearer ${await this.getToken()}`;
    }
    async fetchToken() {
        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
        let response;
        try {
            const res = await axios_1.default.post(this.tokenUrl, "grant_type=client_credentials", {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout: 10_000,
            });
            response = res.data;
        }
        catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data?.error_description ?? err.message;
            if (status === 401) {
                throw new AuthError(`CSP authentication failed (401). Check CSP_CLIENT_ID and CSP_CLIENT_SECRET. Detail: ${msg}`);
            }
            throw new AuthError(`Failed to fetch CSP access token (${status ?? "network error"}): ${msg}`);
        }
        if (!response.access_token) {
            throw new AuthError("CSP token endpoint returned no access_token.");
        }
        const expiresInMs = (response.expires_in ?? 86400) * 1000;
        this.cached = {
            token: response.access_token,
            expiresAt: Date.now() + expiresInMs - REFRESH_BUFFER_MS,
        };
        console.log(`[IamTokenManager] Token refreshed. Valid for ~${Math.round(expiresInMs / 3600000)}h.`);
        return this.cached.token;
    }
    /** Force-clear the cached token (useful for testing). */
    clearCache() {
        this.cached = null;
    }
}
exports.IamTokenManager = IamTokenManager;
/**
 * Singleton factory — reads from env vars.
 * Call once at server startup; pass the instance to CspClient.
 *
 * @example
 * const auth = createTokenManager();
 * const client = new CspClient({ auth });
 */
function createTokenManager() {
    return new IamTokenManager();
}
//# sourceMappingURL=iam_auth.js.map
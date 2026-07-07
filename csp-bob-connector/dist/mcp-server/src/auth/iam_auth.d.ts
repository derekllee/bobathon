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
export declare class AuthError extends Error {
    constructor(message: string);
}
export declare class IamTokenManager {
    private clientId;
    private clientSecret;
    private tokenUrl;
    private cached;
    constructor(config?: {
        clientId?: string;
        clientSecret?: string;
        tokenUrl?: string;
    });
    /**
     * Returns a valid Bearer token, fetching or refreshing as needed.
     * Tokens are cached for their lifetime (24h) minus a 5-minute buffer.
     */
    getToken(): Promise<string>;
    /**
     * Returns the Authorization header value ready for use with axios.
     * @example headers: { Authorization: await auth.getAuthHeader() }
     */
    getAuthHeader(): Promise<string>;
    private fetchToken;
    /** Force-clear the cached token (useful for testing). */
    clearCache(): void;
}
/**
 * Singleton factory — reads from env vars.
 * Call once at server startup; pass the instance to CspClient.
 *
 * @example
 * const auth = createTokenManager();
 * const client = new CspClient({ auth });
 */
export declare function createTokenManager(): IamTokenManager;
//# sourceMappingURL=iam_auth.d.ts.map
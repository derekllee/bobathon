/**
 * Salesforce Session Token Auth
 *
 * CSP runs on Salesforce (ibmsf--test2.sandbox.my.salesforce.com).
 * Auth is via a Salesforce session ID used as a Bearer token.
 *
 * The session token must be obtained manually from the browser (DevTools →
 * Application → Cookies → ibmsf.lightning.force.com → sid) and set as the
 * CSP_SESSION_TOKEN env var before starting the server.
 *
 * Salesforce session tokens expire after inactivity. If you get
 * INVALID_SESSION_ID errors, refresh the token using the instructions in
 * docs/runbook.md.
 */
export declare class AuthError extends Error {
    constructor(message: string);
}
export interface SessionAuthConfig {
    /** Salesforce session token (sid cookie value). Read from CSP_SESSION_TOKEN env var. */
    sessionToken: string;
    /** ISO timestamp of when the token was set, used for expiry warnings. */
    tokenSetAt?: string;
    /** Warn if token is older than this many hours (default: 8). */
    warnAfterHours?: number;
}
export declare class SalesforceSessionAuth {
    private sessionToken;
    private tokenSetAt;
    private warnAfterMs;
    constructor(config?: Partial<SessionAuthConfig>);
    /**
     * Returns the session token as a Bearer token string.
     * Use in Authorization header: `Bearer ${auth.getToken()}`
     */
    getToken(): string;
    /**
     * Returns the Authorization header value ready to use with axios.
     */
    getAuthHeader(): string;
    private checkAgeWarning;
}
/**
 * Singleton factory — reads from env vars.
 * Call once at server startup; pass the instance to CspClient.
 *
 * @example
 * const auth = createSessionAuth();
 * const client = new CspClient({ baseUrl: process.env.CSP_BASE_URL!, auth });
 */
export declare function createSessionAuth(): SalesforceSessionAuth;
//# sourceMappingURL=session_auth.d.ts.map
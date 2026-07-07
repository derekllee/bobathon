"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesforceSessionAuth = exports.AuthError = void 0;
exports.createSessionAuth = createSessionAuth;
class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthError";
    }
}
exports.AuthError = AuthError;
class SalesforceSessionAuth {
    sessionToken;
    tokenSetAt;
    warnAfterMs;
    constructor(config) {
        const token = config?.sessionToken ?? process.env.CSP_SESSION_TOKEN ?? "";
        if (!token || token.trim() === "") {
            throw new AuthError("CSP_SESSION_TOKEN env var is not set. " +
                "Get the token from DevTools → Application → Cookies → ibmsf.lightning.force.com → sid. " +
                "See docs/runbook.md for full instructions.");
        }
        // Basic Salesforce token format validation: starts with org ID prefix (15 chars) + "!"
        if (!token.includes("!")) {
            throw new AuthError("CSP_SESSION_TOKEN does not look like a valid Salesforce session ID. " +
                "Expected format: 00Dxxxxxxxxxx!AQEAQ...");
        }
        this.sessionToken = token.trim();
        const setAtStr = config?.tokenSetAt ?? process.env.CSP_TOKEN_SET_AT;
        this.tokenSetAt = setAtStr ? new Date(setAtStr) : null;
        const warnHours = config?.warnAfterHours ?? Number(process.env.CSP_TOKEN_WARN_HOURS ?? "8");
        this.warnAfterMs = warnHours * 60 * 60 * 1000;
        this.checkAgeWarning();
    }
    /**
     * Returns the session token as a Bearer token string.
     * Use in Authorization header: `Bearer ${auth.getToken()}`
     */
    getToken() {
        return this.sessionToken;
    }
    /**
     * Returns the Authorization header value ready to use with axios.
     */
    getAuthHeader() {
        return `Bearer ${this.sessionToken}`;
    }
    checkAgeWarning() {
        if (!this.tokenSetAt)
            return;
        const ageMs = Date.now() - this.tokenSetAt.getTime();
        if (ageMs > this.warnAfterMs) {
            const ageHours = Math.round(ageMs / (1000 * 60 * 60));
            console.warn(`[SalesforceSessionAuth] WARNING: CSP session token is ~${ageHours}h old. ` +
                "It may have expired. If you see INVALID_SESSION_ID errors, refresh the token. " +
                "See docs/runbook.md §4.");
        }
    }
}
exports.SalesforceSessionAuth = SalesforceSessionAuth;
/**
 * Singleton factory — reads from env vars.
 * Call once at server startup; pass the instance to CspClient.
 *
 * @example
 * const auth = createSessionAuth();
 * const client = new CspClient({ baseUrl: process.env.CSP_BASE_URL!, auth });
 */
function createSessionAuth() {
    return new SalesforceSessionAuth();
}
//# sourceMappingURL=session_auth.js.map
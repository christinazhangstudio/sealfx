export const DEFAULT_SESSION_MAX_AGE = 24 * 60 * 60;
export const REMEMBERED_SESSION_MAX_AGE = 30 * DEFAULT_SESSION_MAX_AGE;

/** Only a member's explicit, signed choice enables the longer session. */
export function sessionMaxAgeSeconds(token?: Record<string, unknown>): number {
    return token?.rememberDevice === true && token.isGuest !== true
        ? REMEMBERED_SESSION_MAX_AGE
        : DEFAULT_SESSION_MAX_AGE;
}

/** Preserve the deadline across JWT re-signing, including pre-migration tokens. */
export function sessionExpiresAt(token?: Record<string, unknown>): number {
    const deadline = token && "sessionExpiresAt" in token ? token.sessionExpiresAt : token?.exp;
    if (deadline === undefined) {
        return Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds(token);
    }
    if (typeof deadline !== "number" || !Number.isSafeInteger(deadline) || deadline <= 0) {
        throw new Error("Invalid session expiration deadline");
    }
    return deadline;
}

/**
 * Build-time feature flags, read from Vite env vars. `VITE_`-prefixed vars
 * are the only ones Vite exposes to client code, and they're baked into the
 * bundle at build time - not readable/writable at runtime - so flipping one
 * of these means rebuilding, not just restarting the server. See the README
 * for how to set these on Render (or locally via client/.env).
 */

/** Kill switch for the word-definition lookup on the results screen. Defaults on. */
export const DEFINITIONS_ENABLED = import.meta.env.VITE_ENABLE_DEFINITIONS !== 'false';

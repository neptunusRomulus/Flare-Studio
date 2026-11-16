/**
 * Tiny debug logger for renderer diagnostics.
 *
 * Off unless Debug Mode is enabled in Engine Settings. Real problems must keep
 * using `console.warn` / `console.error`; those are never gated.
 */

let enabled = false;

/** Turn debug logging on or off (driven by the Debug Mode setting). */
export function setDebugLogEnabled(next: boolean): void {
  enabled = Boolean(next);
}

/** Whether debug logging is currently on. */
export function isDebugLogEnabled(): boolean {
  return enabled;
}

/** `console.log`, but only when Debug Mode is on. */
export function debugLog(...args: unknown[]): void {
  if (!enabled) return;
  console.log(...args);
}

/**
 * Full-window loading overlay state. Each source (project open, template import) holds a token;
 * the overlay is visible while any token is active. Tokens auto-expire (fallback) so it can never stick.
 */
export type LoadingToken = { key: string; startedAt: number; done?: number; total?: number; label?: string };
export type LoadingState = { tokens: LoadingToken[] };

export const LOADING_TIMEOUT_MS = 30000;

export function beginLoading(s: LoadingState, key: string, now: number): LoadingState {
  return { tokens: [...s.tokens.filter(t => t.key !== key), { key, startedAt: now }] };
}
export function endLoading(s: LoadingState, key: string): LoadingState {
  return { tokens: s.tokens.filter(t => t.key !== key) };
}
export function progressLoading(s: LoadingState, key: string, done: number, total: number, label?: string): LoadingState {
  return { tokens: s.tokens.map(t => t.key === key ? { ...t, done, total, ...(label !== undefined ? { label } : {}) } : t) };
}
export function expireLoading(s: LoadingState, now: number, timeout = LOADING_TIMEOUT_MS): LoadingState {
  return { tokens: s.tokens.filter(t => now - t.startedAt < timeout) };
}
/** Step label of the first token that has one (e.g. "Loading NPCs…"). */
export function loadingLabel(s: LoadingState): string | null {
  return s.tokens.find(x => x.label)?.label ?? null;
}
export function isLoading(s: LoadingState): boolean { return s.tokens.length > 0; }
export function loadingCount(s: LoadingState): string | null {
  const t = s.tokens.find(x => typeof x.total === 'number' && x.total > 0);
  return t ? `${t.done ?? 0}/${t.total}` : null;
}

// Tiny global store (module singleton) + subscribe for React.
let state: LoadingState = { tokens: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const set = (next: LoadingState) => { state = next; emit(); };

export const loadingOverlay = {
  get: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  begin: (key: string) => {
    set(beginLoading(state, key, Date.now()));
    setTimeout(() => set(expireLoading(state, Date.now())), LOADING_TIMEOUT_MS + 50);
  },
  end: (key: string) => set(endLoading(state, key)),
  progress: (key: string, done: number, total: number, label?: string) => set(progressLoading(state, key, done, total, label)),
};

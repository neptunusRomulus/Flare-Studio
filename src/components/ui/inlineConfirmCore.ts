/**
 * Non-React core of the inline "Are you sure?" confirm: where to place it and
 * the promise-based askConfirm() queue that replaces window.confirm.
 */
export type Rect = { left: number; top: number; width: number; height: number };
export type ConfirmSide = 'auto' | 'top' | 'bottom';

const GAP = 4;
const MARGIN = 8;

/** Top-left of the popover: centered under the anchor, flipped above when it won't fit, clamped to the viewport. */
export function placeConfirm(anchor: Rect, popW: number, popH: number, vw: number, vh: number, side: ConfirmSide = 'auto') {
  const below = anchor.top + anchor.height + GAP;
  const above = anchor.top - popH - GAP;
  let top = side === 'top' ? above : below;
  if (side === 'auto' && below + popH > vh - MARGIN && above >= MARGIN) top = above;
  top = Math.max(MARGIN, Math.min(vh - popH - MARGIN, top));
  let left = anchor.left + anchor.width / 2 - popW / 2;
  left = Math.max(MARGIN, Math.min(vw - popW - MARGIN, left));
  return { left, top };
}

// Last element the user pressed, so a confirm opened from state or a hook still appears under its button.
let lastAnchor: { el: Element | null; x: number; y: number } = { el: null, x: 0, y: 0 };
if (typeof document !== 'undefined') {
  const track = (e: MouseEvent) => {
    const t = e.target as Element | null;
    if (t && typeof t.closest === 'function' && t.closest('[data-inline-confirm]')) return;
    const el = t && typeof t.closest === 'function' ? t.closest('button,[role="button"],[role="menuitem"],a,input,label') ?? t : null;
    lastAnchor = { el, x: e.clientX, y: e.clientY };
  };
  document.addEventListener('pointerdown', track as EventListener, true);
  document.addEventListener('contextmenu', track as EventListener, true);
}

/** Rect of the last pressed control, or a point at the last pointer position if it is gone. */
export function lastAnchorRect(): Rect {
  const el = lastAnchor.el;
  if (el && el.isConnected) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  return { left: lastAnchor.x, top: lastAnchor.y, width: 0, height: 0 };
}

export type PendingConfirm = { id: number; message: string; anchor: Rect; resolve: (ok: boolean) => void };

let pending: PendingConfirm | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeConfirm(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function getPendingConfirm() { return pending; }

/** Inline replacement for window.confirm. Resolves true on ✓, false on ✕ / Escape / outside click. */
export function askConfirm(message = 'Are you sure?', anchor?: Rect): Promise<boolean> {
  if (pending) pending.resolve(false);
  return new Promise<boolean>((resolve) => {
    const id = nextId++;
    pending = {
      id,
      message,
      anchor: anchor ?? lastAnchorRect(),
      resolve: (ok) => {
        if (pending?.id === id) { pending = null; emit(); }
        resolve(ok);
      },
    };
    emit();
  });
}

export function answerConfirm(ok: boolean) { pending?.resolve(ok); }

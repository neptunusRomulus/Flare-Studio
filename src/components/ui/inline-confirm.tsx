import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  placeConfirm, lastAnchorRect, subscribeConfirm, getPendingConfirm, answerConfirm,
  subscribeChoice, getPendingChoice, answerChoice,
  type Rect, type ConfirmSide, type ChoiceOption,
} from './inlineConfirmCore';

export { askConfirm, askChoice, topCenterAnchor, recentAnchorOrTop } from './inlineConfirmCore';

/** The floating "Are you sure? ✕ ✓" bubble, portaled to body at a fixed spot next to the anchor. */
function ConfirmBubble({ anchor, side = 'auto', message, onCancel, onConfirm, triggerRef }: {
  anchor: Rect; side?: ConfirmSide; message: string; onCancel: () => void; onConfirm: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placeConfirm(anchor, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight, side));
  }, [anchor, side, message]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // Presses on the trigger itself are left to its own onClick (it usually toggles).
      if (ref.current?.contains(t) || triggerRef?.current?.contains(t)) return;
      onCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onCancel(); }
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onCancel, triggerRef]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      data-inline-confirm
      role="alertdialog"
      aria-label={message}
      style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, zIndex: 20000 }}
      className="flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2 py-1 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs">{message}</span>
      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel} aria-label="Cancel">
        <X className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onConfirm} aria-label="Confirm" autoFocus>
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      </Button>
    </div>,
    document.body,
  );
}

type InlineConfirmProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  message?: string;
  side?: ConfirmSide;
  children: React.ReactNode;
};

/**
 * Small "Are you sure?" popover anchored to its children (the trigger).
 * It floats over the layout (portaled), flips above near the bottom edge,
 * and closes on Escape or an outside click.
 */
export function InlineConfirm({ open, onCancel, onConfirm, message = 'Are you sure?', side = 'auto', children }: InlineConfirmProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) { setAnchor(null); return; }
    const r = wrapRef.current.getBoundingClientRect();
    setAnchor({ left: r.left, top: r.top, width: r.width, height: r.height });
  }, [open]);
  return (
    <div ref={wrapRef} className="relative">
      {children}
      {open && anchor && <ConfirmBubble anchor={anchor} side={side} message={message} onCancel={onCancel} onConfirm={onConfirm} triggerRef={wrapRef} />}
    </div>
  );
}

/**
 * Same bubble for confirms driven by state far from their button
 * (e.g. a hook sets "pending delete"): it anchors to the control the user last pressed.
 */
export function AnchoredConfirm({ open, onCancel, onConfirm, message = 'Are you sure?', side = 'auto' }: Omit<InlineConfirmProps, 'children'>) {
  const [anchor, setAnchor] = useState<Rect | null>(null);
  useLayoutEffect(() => { setAnchor(open ? lastAnchorRect() : null); }, [open]);
  if (!open || !anchor) return null;
  return <ConfirmBubble anchor={anchor} side={side} message={message} onCancel={onCancel} onConfirm={onConfirm} />;
}

/**
 * Small choice card in the same style: a short title, optional muted detail,
 * and compact buttons. ✕ / Escape / outside click answer with onCancel only
 * when onCancel is given; without it the card stays until a button is chosen.
 */
export function InlineChoice({ anchor, side = 'auto', title, detail, options, onChoose, onCancel, busy = false }: {
  anchor: Rect; side?: ConfirmSide; title: string; detail?: string; options: ChoiceOption[];
  onChoose: (id: string) => void; onCancel?: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placeConfirm(anchor, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight, side));
  }, [anchor, side, title, detail, options.length, busy]);
  useEffect(() => {
    if (!onCancel) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onCancel(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onCancel(); } };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey, true); };
  }, [onCancel]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      data-inline-confirm
      role="alertdialog"
      aria-label={title}
      style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, zIndex: 20000 }}
      className="flex max-w-[22rem] items-center gap-1 rounded-md border border-border bg-background px-2 py-1 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mr-1 min-w-0">
        <div className="whitespace-nowrap text-xs">{title}</div>
        {detail && <div className="truncate text-[10px] text-muted-foreground">{detail}</div>}
      </div>
      {options.map((o, i) => (
        <Button
          key={o.id}
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className={`h-6 px-2 text-xs ${o.primary ? 'text-orange-500 hover:text-orange-400' : ''}`}
          onClick={() => onChoose(o.id)}
          autoFocus={o.primary || (i === 0 && !options.some((x) => x.primary))}
        >
          {o.label}
        </Button>
      ))}
      {onCancel && (
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel} aria-label="Cancel" disabled={busy}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>,
    document.body,
  );
}

function PendingChoiceView() {
  const c = useSyncExternalStore(subscribeChoice, getPendingChoice, () => null);
  if (!c) return null;
  const cancelId = c.cancelId;
  return (
    <InlineChoice
      key={c.id}
      anchor={c.anchor}
      title={c.title}
      detail={c.detail}
      options={c.options}
      onChoose={(id) => answerChoice(id)}
      onCancel={cancelId !== undefined ? () => answerChoice(cancelId) : undefined}
    />
  );
}

/** Mount once at the app root; renders askConfirm() and askChoice() requests. */
export function InlineConfirmHost() {
  const pending = useSyncExternalStore(subscribeConfirm, getPendingConfirm, () => null);
  if (!pending) return <PendingChoiceView />;
  return (
    <ConfirmBubble
      key={pending.id}
      anchor={pending.anchor}
      message={pending.message}
      onCancel={() => answerConfirm(false)}
      onConfirm={() => answerConfirm(true)}
    />
  );
}

export default InlineConfirm;

import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import AppContext from '@/context/AppContext';
import { placeConfirm, type Rect } from '@/components/ui/inlineConfirmCore';
import { loadProjectTextMap } from '@/editor/projectFiles';
import {
  displayIdentity,
  renameProjectIdentity,
  usageCountMessage,
  validateRename,
  type IdentityKind,
} from '@/editor/identityRename';

type Props = {
  kind: IdentityKind;
  currentId: string;
  onRenamed?: (nextId: string) => void;
  projectPath?: string | null;
};

/** Pencil button that opens a floating Rename field (no modal, no layout shift). */
export default function RenameIdButton({ kind, currentId, onRenamed, projectPath }: Props) {
  const ctx = useContext(AppContext);
  const root = projectPath
    ?? (typeof ctx?.currentProjectPath === 'string' ? ctx.currentProjectPath : null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [usage, setUsage] = useState('Checking references…');
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const anchor = (): Rect => {
    const el = triggerRef.current;
    if (!el) return { left: 0, top: 0, width: 0, height: 0 };
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  useEffect(() => {
    if (!open) return;
    setDraft(displayIdentity(kind, currentId));
    setError('');
    setUsage('Checking references…');
    let cancelled = false;
    void (async () => {
      const files = root ? await loadProjectTextMap(root) : {};
      if (cancelled) return;
      const check = validateRename(files, kind, currentId, displayIdentity(kind, currentId));
      setUsage(usageCountMessage(check.usageCount));
    })();
    return () => { cancelled = true; };
  }, [open, kind, currentId, root]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = bubbleRef.current;
    if (!el) return;
    setPos(placeConfirm(anchor(), el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight, 'auto'));
  }, [open, draft, error, usage]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (bubbleRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const confirm = async () => {
    if (!root || busy) return;
    setBusy(true);
    try {
      const result = await renameProjectIdentity(root, kind, currentId, draft);
      if (!result.ok) {
        setError(result.error || 'Could not rename.');
        setBusy(false);
        return;
      }
      toast({ title: 'Renamed', description: usageCountMessage(result.usageCount) });
      setOpen(false);
      onRenamed?.(result.nextId);
    } catch (err) {
      console.error(err);
      setError('Could not rename.');
    } finally {
      setBusy(false);
    }
  };

  if (!currentId) return null;

  return (
    <>
      <Tooltip content="Rename">
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label="Rename"
          onClick={() => setOpen((v) => !v)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={bubbleRef}
          data-inline-confirm
          role="dialog"
          aria-label="Rename"
          style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, zIndex: 20000 }}
          className="w-64 rounded-md border border-border bg-background p-2 shadow-lg space-y-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            autoFocus
            className="h-7 text-xs font-mono"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void confirm(); } }}
            aria-label="New id"
          />
          <p className="text-[11px] text-muted-foreground">{usage}</p>
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Cancel" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Confirm rename" onClick={() => void confirm()} disabled={busy || !root}>
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

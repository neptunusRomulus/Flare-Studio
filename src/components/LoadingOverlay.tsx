import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { loadingOverlay, isLoading, loadingCount, loadingLabel } from '@/components/loadingOverlayStore';

const FADE_MS = 180;

/** Opaque full-window overlay while a project and its tilesets load. */
const LoadingOverlay: React.FC = () => {
  const s = useSyncExternalStore(loadingOverlay.subscribe, loadingOverlay.get, loadingOverlay.get);
  const active = isLoading(s);
  const count = loadingCount(s);
  const label = loadingLabel(s) ?? 'Loading tilesets…';
  const [mounted, setMounted] = useState(active);
  useEffect(() => {
    if (active) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [active]);
  if (!mounted) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      style={{ opacity: active ? 1 : 0, transition: `opacity ${FADE_MS}ms ease`, pointerEvents: active ? 'auto' : 'none' }}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>{label}{count ? <span className="ml-1.5 tabular-nums">{count}</span> : null}</span>
      </div>
    </div>
  );
};

export default LoadingOverlay;

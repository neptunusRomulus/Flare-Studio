import { useEffect } from 'react';

export default function useBrushActionListener(args: {
  onSeparate: (tileIndex: number) => void;
  onRemove: (tileIndex: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const { onSeparate, onRemove, onReorder } = args;

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const custom = event as CustomEvent<Record<string, unknown>>;
        const detail = (custom.detail ?? {}) as {
          action?: string;
          tileIndex?: number;
          from?: number;
          to?: number;
        };

        switch (detail.action) {
          case 'separate':
            if (typeof detail.tileIndex === 'number') onSeparate(detail.tileIndex);
            break;
          case 'remove':
            if (typeof detail.tileIndex === 'number') onRemove(detail.tileIndex);
            break;
          case 'drop':
            if (typeof detail.from === 'number' && typeof detail.to === 'number') onReorder(detail.from, detail.to);
            break;
          default:
            break;
        }
      } catch {
        // ignore
      }
    };

    document.addEventListener('brushAction', handler as EventListener);
    return () => document.removeEventListener('brushAction', handler as EventListener);
  }, [onSeparate, onRemove, onReorder]);
}

import { useEffect } from 'react';
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
        const custom = event as CustomEvent;
        const { action } = (custom.detail || {}) as any;
        switch (action) {
          case 'separate':
            onSeparate(custom.detail.tileIndex);
            break;
          case 'remove':
            onRemove(custom.detail.tileIndex);
            break;
          case 'drop':
            if (custom.detail.from != null && custom.detail.to != null) onReorder(custom.detail.from, custom.detail.to);
            break;
          default:
            break;
        }
      } catch (err) {
        // ignore
      }
    };

    document.addEventListener('brushAction', handler as EventListener);
    return () => document.removeEventListener('brushAction', handler as EventListener);
  }, [onSeparate, onRemove, onReorder]);
}

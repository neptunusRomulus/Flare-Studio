import { useEffect, useRef } from 'react';
import { decideClose } from '@/hooks/closePrompt';
import { useSaveQueue } from '@/context/SaveQueueContext';

type CloseApi = {
  onBeforeClose?: (callback: (() => void) | null) => void;
  confirmClose?: (decision: 'close' | 'save' | 'discard' | 'cancel' | boolean) => Promise<boolean>;
  onSaveAndClose?: (callback: (() => void) | null) => void;
  closeAfterSave?: () => void;
  onAppBeforeQuit?: (callback: (() => void) | null) => void;
  appShutdownComplete?: () => void;
};

/**
 * Ask Save / Don't save / Cancel on window close when anything is dirty,
 * run a full save when the user chooses Save, and flush the save queue on quit.
 */
export default function useCloseGuard(opts: {
  isDirty: () => boolean;
  saveAll: () => Promise<void>;
  onDiscard?: () => void;
}): void {
  const { waitForAllSaves } = useSaveQueue();
  const isDirtyRef = useRef(opts.isDirty);
  isDirtyRef.current = opts.isDirty;
  const saveAllRef = useRef(opts.saveAll);
  saveAllRef.current = opts.saveAll;
  const onDiscardRef = useRef(opts.onDiscard);
  onDiscardRef.current = opts.onDiscard;
  const waitRef = useRef(waitForAllSaves);
  waitRef.current = waitForAllSaves;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const api = (window as unknown as { electronAPI?: CloseApi }).electronAPI;
    if (!api) return;

    api.onBeforeClose?.(async () => {
      try {
        const decision = await decideClose(!!isDirtyRef.current());
        if (decision === 'discard') onDiscardRef.current?.();
        await api.confirmClose?.(decision);
      } catch (err) {
        console.error('onBeforeClose handler failed:', err);
      }
    });

    api.onSaveAndClose?.(async () => {
      try {
        await saveAllRef.current();
      } catch (err) {
        console.error('Failed to save before close:', err);
      } finally {
        api.closeAfterSave?.();
      }
    });

    api.onAppBeforeQuit?.(async () => {
      try {
        await waitRef.current(30000);
      } catch (err) {
        console.warn('Flush before quit failed:', err);
      } finally {
        api.appShutdownComplete?.();
      }
    });

    return () => {
      api.onBeforeClose?.(null);
      api.onSaveAndClose?.(null);
      api.onAppBeforeQuit?.(null);
    };
  }, []);
}

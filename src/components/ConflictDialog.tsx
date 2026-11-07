import React, { useCallback, useMemo, useState } from 'react';
import { useConflictResolution, type ConflictResolution } from '@/context/ConflictResolutionContext';
import { InlineChoice, topCenterAnchor } from '@/components/ui/inline-confirm';

/**
 * File changed outside the app: small choice card at the top of the window.
 * ✕ / Escape / outside click = cancel (keep things as they are, decide later).
 */
export default function ConflictDialog() {
  const { isPromptVisible, currentConflict, resolveConflict } = useConflictResolution();
  const [busy, setBusy] = useState(false);
  const anchor = useMemo(() => topCenterAnchor(), [currentConflict]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = useCallback((action: ConflictResolution) => {
    if (busy) return;
    setBusy(true);
    // Small delay so the click registers visually before the card goes away.
    setTimeout(() => {
      resolveConflict(action);
      setBusy(false);
    }, 150);
  }, [busy, resolveConflict]);

  if (!isPromptVisible || !currentConflict) return null;
  const count = currentConflict.conflictingFiles?.length ?? 1;
  const name = currentConflict.filePath.split(/[\\/]/).pop() || currentConflict.filePath;

  return (
    <InlineChoice
      anchor={anchor}
      side="bottom"
      title="File changed on disk"
      detail={count > 1 ? `${name} +${count - 1} more` : name}
      options={[
        { id: 'reload', label: 'Reload', primary: true },
        { id: 'keep_app', label: 'Keep mine' },
      ]}
      busy={busy}
      onChoose={(id) => choose(id as ConflictResolution)}
      onCancel={() => choose('cancel')}
    />
  );
}

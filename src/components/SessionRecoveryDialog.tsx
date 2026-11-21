import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SessionRecoveryDialogProps {
  isOpen: boolean;
  isRecovering?: boolean;
  error?: string | null;
  onRecover: () => Promise<void> | void;
  onDismiss: () => void;
  /** @deprecated Kept so existing callers can pass map/time; the dialog text is fixed. */
  mapName?: string | null;
  crashTime?: string | null;
  timeSinceCrash?: string | null;
}

/**
 * Modal shown when a project opens with a leftover crash backup.
 * The user must choose Restore or Discard; outside clicks and Escape do not dismiss it.
 */
const SessionRecoveryDialog: React.FC<SessionRecoveryDialogProps> = ({
  isOpen, isRecovering, error, onRecover, onDismiss,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => { /* require an explicit button */ }}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Unsaved changes found from your last session. Restore them?</DialogTitle>
          {error ? <DialogDescription>{error}</DialogDescription> : (
            <DialogDescription className="sr-only">Choose Restore to bring the backup back, or Discard to delete it.</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDismiss} disabled={!!isRecovering}>
            Discard
          </Button>
          <Button
            type="button"
            onClick={() => { void Promise.resolve(onRecover()).catch((err) => console.error('Recovery failed:', err)); }}
            disabled={!!isRecovering}
          >
            {isRecovering ? 'Restoring…' : 'Restore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionRecoveryDialog;

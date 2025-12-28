import { useCallback } from 'react';
import type { MapObject } from '@/types';

export default function useObjectDialogClose(args: {
  setShowObjectDialog: (v: boolean) => void;
  setEditingObject: (o: MapObject | null) => void;
  setObjectValidationErrors: (e: any[]) => void;
  setShowDeleteNpcConfirm: (v: boolean) => void;
  setShowDeleteEnemyConfirm: (v: boolean) => void;
}) {
  const { setShowObjectDialog, setEditingObject, setObjectValidationErrors, setShowDeleteNpcConfirm, setShowDeleteEnemyConfirm } = args;

  const handleObjectDialogClose = useCallback(() => {
    setShowObjectDialog(false);
    setEditingObject(null);
    setObjectValidationErrors([]);
    setShowDeleteNpcConfirm(false);
    setShowDeleteEnemyConfirm(false);
  }, [setShowObjectDialog, setEditingObject, setObjectValidationErrors, setShowDeleteNpcConfirm, setShowDeleteEnemyConfirm]);

  return { handleObjectDialogClose };
}

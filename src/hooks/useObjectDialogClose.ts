import { useCallback } from 'react';
import type { MapObject } from '@/types';
import type { Dispatch, SetStateAction } from 'react';

export default function useObjectDialogClose(args: {
  setShowObjectDialog: (v: boolean) => void;
  setEditingObject: (o: MapObject | null) => void;
  setObjectValidationErrors: Dispatch<SetStateAction<string[]>>;
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

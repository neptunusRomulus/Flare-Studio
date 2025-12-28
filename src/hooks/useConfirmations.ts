import { useRef, useState } from 'react';

type ConfirmPayload = { layerType: string; tabId: number };

export default function useConfirmations() {
  const [showClearLayerDialog, setShowClearLayerDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | { type: 'removeBrush' | 'removeTileset' | 'removeTab'; payload?: number | ConfirmPayload }>(null);
  const [tabToDelete, setTabToDelete] = useState<null | ConfirmPayload>(null);
  const confirmPayloadRef = useRef<null | ConfirmPayload>(null);

  return {
    showClearLayerDialog,
    setShowClearLayerDialog,
    confirmAction,
    setConfirmAction,
    tabToDelete,
    setTabToDelete,
    confirmPayloadRef
  };
}

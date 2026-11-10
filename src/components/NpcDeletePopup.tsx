import React from 'react';
import { ElementContextMenuPanel } from '@/components/ElementContextMenu';

type Props = {
  npcDeletePopup: { npcId: number; screenX: number; screenY: number } | null;
  onConfirm: (npcId: number) => void;
  onCancel: () => void;
  onDuplicate?: (npcId: number) => void;
};

/** Map-instance menu: delete this placement only, and duplicate onto a free tile. */
const NpcDeletePopup: React.FC<Props> = ({ npcDeletePopup, onConfirm, onCancel, onDuplicate }) => (
  <ElementContextMenuPanel
    open={Boolean(npcDeletePopup)}
    x={npcDeletePopup?.screenX ?? 0}
    y={npcDeletePopup?.screenY ?? 0}
    onClose={onCancel}
    onDuplicate={() => { if (npcDeletePopup && onDuplicate) onDuplicate(npcDeletePopup.npcId); }}
    onDelete={() => { if (npcDeletePopup) onConfirm(npcDeletePopup.npcId); }}
  />
);

export default NpcDeletePopup;

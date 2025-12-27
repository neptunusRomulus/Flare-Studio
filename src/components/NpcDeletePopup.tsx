import React from 'react';
import { Check, X } from 'lucide-react';

type Props = {
  npcDeletePopup: { npcId: number; screenX: number; screenY: number } | null;
  onConfirm: (npcId: number) => void;
  onCancel: () => void;
};

const NpcDeletePopup: React.FC<Props> = ({ npcDeletePopup, onConfirm, onCancel }) => {
  if (!npcDeletePopup) return null;
  return (
    <div
      className="fixed z-50 flex items-center gap-1 px-2 py-1.5 bg-black rounded-lg shadow-xl border border-neutral-700"
      style={{ left: npcDeletePopup.screenX, top: npcDeletePopup.screenY, transform: 'translate(-50%, -120%)' }}
    >
      <span className="text-white text-xs font-medium mr-1">Remove NPC?</span>
      <button
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-700 transition-colors"
        onClick={() => { onConfirm(npcDeletePopup.npcId); }}
        title="Confirm"
      >
        <Check className="w-4 h-4 text-emerald-500" />
      </button>
      <button
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-700 transition-colors"
        onClick={onCancel}
        title="Cancel"
      >
        <X className="w-4 h-4 text-red-500" />
      </button>
    </div>
  );
};

export default NpcDeletePopup;

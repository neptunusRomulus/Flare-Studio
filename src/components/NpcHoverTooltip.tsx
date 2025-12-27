import React from 'react';
import { MousePointer } from 'lucide-react';

type Props = {
  npcHoverTooltip: { x: number; y: number } | null;
};

const NpcHoverTooltip: React.FC<Props> = ({ npcHoverTooltip }) => {
  if (!npcHoverTooltip) return null;
  return (
    <div
      className="fixed z-50 px-2 py-1 bg-black/90 text-white text-xs rounded shadow-lg pointer-events-none flex items-center gap-1.5"
      style={{ left: npcHoverTooltip.x + 12, top: npcHoverTooltip.y + 12 }}
    >
      <MousePointer className="w-3 h-3" />
      <span>Click to Edit</span>
    </div>
  );
};

export default NpcHoverTooltip;

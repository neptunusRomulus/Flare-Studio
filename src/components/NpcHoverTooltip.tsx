import React from 'react';
import { MousePointer2 } from 'lucide-react';

type Props = {
  npcHoverTooltip: { x: number; y: number } | null;
};

const NpcHoverTooltip: React.FC<Props> = ({ npcHoverTooltip }) => {
  if (!npcHoverTooltip) return null;
  return (
    <div
      className="fixed z-50 px-2 py-1.5 bg-black border border-gray-400/50 text-gray-300 text-xs rounded-md shadow-md pointer-events-none flex items-center gap-1.5 font-medium"
      style={{ left: npcHoverTooltip.x + 12, top: npcHoverTooltip.y + 12 }}
    >
      <MousePointer2 className="w-3.5 h-3.5 text-gray-300" />
      <span>Click to Edit</span>
    </div>
  );
};

export default NpcHoverTooltip;

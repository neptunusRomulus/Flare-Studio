import React from 'react';
import { MapPin } from 'lucide-react';

type Props = {
  hoverCoords: { x: number; y: number } | null;
  showActiveGid: boolean;
  isEnemyTabActive: boolean;
};

const MapHoverDisplay: React.FC<Props> = ({ hoverCoords, showActiveGid, isEnemyTabActive }) => {
  if (!hoverCoords) return null;
  return (
    <div
      className={`absolute bottom-4 left-4 z-10 p-2 rounded-md text-xs font-mono flex items-center gap-2 transition-opacity duration-200 ${hoverCoords ? 'opacity-100 pointer-events-auto bg-white/90 dark:bg-neutral-900/90 border border-gray-200 dark:border-neutral-600 text-gray-800 dark:text-white shadow-sm' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!hoverCoords}
    >
      <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      <span>{hoverCoords ? `${hoverCoords.x}, ${hoverCoords.y}` : ''}</span>
      <div className={`ml-2 transition-opacity duration-200 ${hoverCoords && showActiveGid && !isEnemyTabActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      </div>
    </div>
  );
};

export default MapHoverDisplay;

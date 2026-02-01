import React from 'react';
import { MapPin } from 'lucide-react';

type Props = {
  hoverCoords: { x: number; y: number } | null;
  showActiveGid: boolean;
  activeGidValue: string;
  hoverGidValue: string;
  isEnemyTabActive: boolean;
};

const MapHoverDisplay: React.FC<Props> = ({ hoverCoords, showActiveGid, activeGidValue, hoverGidValue, isEnemyTabActive }) => {
  
  // Show nothing if no hover coords and not showing active GID
  if (!hoverCoords && (!showActiveGid || isEnemyTabActive)) return null;
  
  const hasContent = hoverCoords || (showActiveGid && !isEnemyTabActive);
  // Use hover GID when hovering, otherwise use active GID
  const displayGid = hoverCoords ? hoverGidValue : activeGidValue;
  
  return (
    <div
      className={`absolute bottom-4 left-4 z-10 p-2 rounded-md text-xs font-mono flex items-center gap-2 transition-opacity duration-200 ${hasContent ? 'opacity-100 pointer-events-auto bg-white/90 dark:bg-neutral-900/90 border border-gray-200 dark:border-neutral-600 text-gray-800 dark:text-white shadow-sm' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!hasContent}
    >
      {hoverCoords && (
        <>
          <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{`${hoverCoords.x}, ${hoverCoords.y}`}</span>
        </>
      )}
      {showActiveGid && !isEnemyTabActive && (
        <span className={`${hoverCoords ? 'ml-2' : ''} px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded text-xs`}>
          {hoverCoords ? `(${hoverCoords.x}, ${hoverCoords.y}) GID: ${displayGid}` : `GID: ${displayGid}`}
        </span>
      )}
    </div>
  );
};

export default MapHoverDisplay;

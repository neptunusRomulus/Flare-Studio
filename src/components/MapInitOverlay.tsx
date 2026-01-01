import React, { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type Props = {
  mapInitialized: boolean;
  handleOpenCreateMapDialog?: () => void;
  isPreparingNewMap: boolean;
};

const MapInitOverlay: React.FC<Props> = ({ mapInitialized, handleOpenCreateMapDialog, isPreparingNewMap }) => {
  if (mapInitialized) return null;
  const appCtx = useAppContext() as any;
  const openCreateFallback = () => {
    try {
      if (appCtx && typeof appCtx.setShowCreateMapDialog === 'function') {
        appCtx.setShowCreateMapDialog(true);
        return;
      }
    } catch (e) {
      // ignore
    }
  };

  const handleClick = (e?: React.MouseEvent) => {
    // debug: confirm click reached
    // eslint-disable-next-line no-console
    console.log('MapInitOverlay + clicked', { hasPropHandler: !!handleOpenCreateMapDialog, isPreparingNewMap, appCtxHasSetter: !!(appCtx && typeof appCtx.setShowCreateMapDialog === 'function') });
    if (isPreparingNewMap) return;
    if (handleOpenCreateMapDialog) {
      try { handleOpenCreateMapDialog(); } catch (err) { /* swallow */ }
    } else {
      openCreateFallback();
    }
  };
  const [clicked, setClicked] = useState(false);
  const triggerBlink = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 700);
  };
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${!mapInitialized ? 'opacity-100 pointer-events-auto bg-background/80 backdrop-blur-sm' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!mapInitialized}
      onClick={() => { console.log('MapInitOverlay overlay clicked'); }}
      onMouseDown={() => { console.log('MapInitOverlay overlay mousedown'); }}
    >
      <div className={`flex items-center gap-3 px-4 py-2 rounded-full border-2 border-orange-500/80 bg-background/95 shadow-lg backdrop-blur-sm transition-opacity duration-200 ${!mapInitialized ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-sm font-medium text-muted-foreground">Create a map</span>
        <Button
          size="sm"
          variant="default"
          className="w-9 h-9 p-0 rounded-full bg-orange-500 text-white shadow-sm transition-all duration-150 hover:bg-orange-600 hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          onClick={(e) => { handleClick(e); triggerBlink(); }}
          disabled={isPreparingNewMap}
        >
          {clicked ? <span className="text-xs font-semibold">OK</span> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default MapInitOverlay;

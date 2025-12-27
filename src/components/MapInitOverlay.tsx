import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type Props = {
  mapInitialized: boolean;
  handleOpenCreateMapDialog: () => void;
  isPreparingNewMap: boolean;
};

const MapInitOverlay: React.FC<Props> = ({ mapInitialized, handleOpenCreateMapDialog, isPreparingNewMap }) => {
  if (mapInitialized) return null;
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${!mapInitialized ? 'opacity-100 pointer-events-auto bg-background/80 backdrop-blur-sm' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!mapInitialized}
    >
      <div className={`flex items-center gap-3 px-4 py-2 rounded-full border-2 border-orange-500/80 bg-background/95 shadow-lg backdrop-blur-sm transition-opacity duration-200 ${!mapInitialized ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-sm font-medium text-muted-foreground">Create a map</span>
        <Button
          size="sm"
          variant="default"
          className="w-9 h-9 p-0 rounded-full bg-orange-500 text-white shadow-sm transition-all duration-150 hover:bg-orange-600 hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          onClick={handleOpenCreateMapDialog}
          disabled={isPreparingNewMap}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default MapInitOverlay;

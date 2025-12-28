import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { X } from 'lucide-react';

type StampEntry = {
  id: string;
  name: string;
  width: number;
  height: number;
};

type StampsPanelProps = {
  stampMode: 'select' | 'create' | 'place';
  setStampMode: (m: 'select' | 'create' | 'place') => void;
  newStampName: string;
  setNewStampName: (s: string) => void;
  handleCreateStamp: () => void;
  stamps: StampEntry[];
  selectedStamp: string | null;
  handleStampSelect: (id: string) => void;
  handleDeleteStamp: (id: string) => void;
};

export default function StampsPanel({
  stampMode,
  setStampMode,
  newStampName,
  setNewStampName,
  handleCreateStamp,
  stamps,
  selectedStamp,
  handleStampSelect,
  handleDeleteStamp
}: StampsPanelProps) {
  return (
    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-[200px] z-10">
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          <Button
            variant={stampMode === 'select' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setStampMode('select')}
          >
            Select
          </Button>
          <Button
            variant={stampMode === 'create' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setStampMode('create')}
          >
            Create
          </Button>
        </div>

        {stampMode === 'create' && (
          <div className="border-t pt-2">
            <div className="text-xs font-medium mb-1">Create New Stamp</div>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Stamp name"
                value={newStampName}
                onChange={(event) => setNewStampName(event.target.value)}
                className="flex-1 text-xs px-2 py-1 border rounded"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleCreateStamp();
                  }
                }}
              />
              <Button size="sm" className="text-xs" onClick={handleCreateStamp} disabled={!newStampName.trim()}>
                Create
              </Button>
            </div>
            <div className="text-xs text-gray-500 mt-1">First select tiles, then create stamp</div>
          </div>
        )}

        {stampMode === 'select' && (
          <div className="border-t pt-2 max-h-32 overflow-y-auto">
            <div className="text-xs font-medium mb-1">Available Stamps</div>
            {stamps.length === 0 ? (
              <div className="text-xs text-gray-500">No stamps created yet</div>
            ) : (
              <div className="flex flex-col gap-1">
                {stamps.map((stamp) => (
                  <div key={stamp.id} className="flex items-center gap-1">
                    <Tooltip content={`${stamp.name} (${stamp.width}x${stamp.height})`}>
                      <Button
                        variant={selectedStamp === stamp.id ? 'default' : 'ghost'}
                        size="sm"
                        className="flex-1 text-xs justify-start"
                        onClick={() => handleStampSelect(stamp.id)}
                      >
                        {stamp.name}
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete stamp">
                      <Button variant="ghost" size="sm" className="w-6 h-6 p-0 text-red-500" onClick={() => handleDeleteStamp(stamp.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

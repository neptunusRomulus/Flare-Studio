import React from 'react';
import { Input } from '@/components/ui/input';
import type { MapObject } from '@/types';

type EventEditDialogProps = {
  editingObject: MapObject;
  setEditingObject: (obj: MapObject) => void;
};

const EventEditDialog = ({ editingObject, setEditingObject }: EventEditDialogProps) => (
  <>
    <div>
      <label className="block text-sm font-medium mb-1">Activate</label>
      <Input
        value={editingObject.activate || 'on_trigger'}
        onChange={(e) => setEditingObject({ ...editingObject, activate: e.target.value })}
        placeholder="on_trigger, on_load, etc."
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">Hotspot</label>
      <Input
        value={editingObject.hotspot || '0,0,1,1'}
        onChange={(e) => setEditingObject({ ...editingObject, hotspot: e.target.value })}
        placeholder="x,y,width,height"
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">Tooltip</label>
      <Input
        value={editingObject.tooltip || ''}
        onChange={(e) => setEditingObject({ ...editingObject, tooltip: e.target.value })}
        placeholder="Hover text"
      />
    </div>
  </>
);

export default EventEditDialog;

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MapObject } from '@/types';

type EventEditDialogProps = {
  editingObject: MapObject;
  setEditingObject: (obj: MapObject) => void;
};

const EventEditDialog = ({ editingObject, setEditingObject }: EventEditDialogProps) => (
  <>
    <div>
      <Label className="block text-sm font-medium mb-1">Activate</Label>
      <Input
        value={editingObject.activate || 'on_trigger'}
        onChange={(e) => setEditingObject({ ...editingObject, activate: e.target.value })}
        placeholder="on_trigger, on_load, etc."
      />
    </div>
    <div>
      <Label className="block text-sm font-medium mb-1">Hotspot</Label>
      <Input
        value={editingObject.hotspot || '0,0,1,1'}
        onChange={(e) => setEditingObject({ ...editingObject, hotspot: e.target.value })}
        placeholder="x,y,width,height"
      />
    </div>
    <div>
      <Label className="block text-sm font-medium mb-1">Tooltip</Label>
      <Input
        value={editingObject.tooltip || ''}
        onChange={(e) => setEditingObject({ ...editingObject, tooltip: e.target.value })}
        placeholder="Hover text"
      />
    </div>
  </>
);

export default EventEditDialog;

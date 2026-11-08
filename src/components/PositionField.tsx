import React from 'react';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';

type PositionFieldProps = {
  x: number;
  y: number;
  onChangeX: (value: number) => void;
  onChangeY: (value: number) => void;
  label?: string;
};

const PositionField = ({
  x,
  y,
  onChangeX,
  onChangeY,
  label = 'Position',
}: PositionFieldProps) => (
  <div>
    <label className="text-xs text-muted-foreground">{label}</label>
    {x < 0 || y < 0 ? (
      // Unplaced dock entity: position is instance data, set by placing it on the map
      <div className="flex items-center h-7 mt-1">
        <Tooltip content="Place it from the Entities dock: click its pin, then click the map (or drag it onto the map).">
          <span className="text-xs text-muted-foreground italic cursor-help">Not placed</span>
        </Tooltip>
      </div>
    ) : (
    <div className="flex items-center gap-1 mt-1">
      <Input
        type="number"
        value={x}
        onChange={(e) => onChangeX(Number(e.target.value))}
        className="h-7 w-11 px-1 text-center text-xs"
      />
      <span className="text-muted-foreground text-xs">,</span>
      <Input
        type="number"
        value={y}
        onChange={(e) => onChangeY(Number(e.target.value))}
        className="h-7 w-11 px-1 text-center text-xs"
      />
    </div>
    )}
  </div>
);

export default PositionField;

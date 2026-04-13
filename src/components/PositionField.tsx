import React from 'react';
import { Input } from '@/components/ui/input';

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
  </div>
);

export default PositionField;

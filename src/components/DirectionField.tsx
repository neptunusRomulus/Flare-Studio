import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import { ArrowUp, ArrowUpRight, ArrowRight, ArrowDownRight, ArrowDown, ArrowDownLeft, ArrowLeft, ArrowUpLeft, HelpCircle } from 'lucide-react';

type DirectionFieldProps = {
  value: string;
  onChange: (value: string | null) => void;
  label?: string;
  tooltip?: string;
};

const directions = [
  { value: '7', label: 'NW', icon: ArrowUpLeft },
  { value: '0', label: 'N', icon: ArrowUp },
  { value: '1', label: 'NE', icon: ArrowUpRight },
  { value: '6', label: 'W', icon: ArrowLeft },
  { value: 'center', label: '', icon: null },
  { value: '2', label: 'E', icon: ArrowRight },
  { value: '5', label: 'SW', icon: ArrowDownLeft },
  { value: '4', label: 'S', icon: ArrowDown },
  { value: '3', label: 'SE', icon: ArrowDownRight },
] as const;

const DirectionField = ({
  value,
  onChange,
  label = 'Direction',
  tooltip,
}: DirectionFieldProps) => (
  <div>
    <div className="flex items-center gap-1 mb-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {tooltip && (
        <Tooltip content={tooltip}>
          <HelpCircle className="w-3 h-3 text-muted-foreground" />
        </Tooltip>
      )}
    </div>
    <div className="grid grid-cols-3 gap-1 w-[fit-content]">
      {directions.map((dir) => {
        if (dir.value === 'center') {
          return (
            <div key="center" className="flex items-center justify-center w-9 h-9">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
          );
        }
        const Icon = dir.icon!;
        const isSelected = value === dir.value;
        return (
          <button
            key={dir.value}
            type="button"
            onClick={() => onChange(isSelected ? null : dir.value)}
            className={`flex flex-col items-center justify-center w-9 h-9 gap-0.5 rounded text-[9px] font-medium transition-colors ${
              isSelected
                ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/50'
                : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
            }`}
            title={dir.label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{dir.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

export default DirectionField;

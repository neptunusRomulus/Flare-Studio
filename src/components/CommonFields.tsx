export { default as NameField } from './NameField';
export { default as PositionField } from './PositionField';
export { default as DirectionField } from './DirectionField';
export { default as MinimapToggle } from './MinimapToggle';
export { default as SpawnFieldOverlay } from './SpawnFieldOverlay';

type PositionFieldProps = {
  x: number;
  y: number;
  onChangeX: (value: number) => void;
  onChangeY: (value: number) => void;
  label?: string;
};

export const PositionField = ({ x, y, onChangeX, onChangeY, label = 'Position' }: PositionFieldProps) => (
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

type SizeFieldProps = {
  width: number;
  height: number;
  onChangeWidth: (value: number) => void;
  onChangeHeight: (value: number) => void;
  label?: string;
};

export const SizeField = ({ width, height, onChangeWidth, onChangeHeight, label = 'Size' }: SizeFieldProps) => (
  <div>
    <label className="text-xs text-muted-foreground">{label}</label>
    <div className="flex items-center gap-1 mt-1">
      <Input
        type="number"
        value={width}
        min={1}
        onChange={(e) => onChangeWidth(Number(e.target.value))}
        className="h-7 w-20 px-1 text-center text-xs"
      />
      <span className="text-muted-foreground text-xs">×</span>
      <Input
        type="number"
        value={height}
        min={1}
        onChange={(e) => onChangeHeight(Number(e.target.value))}
        className="h-7 w-20 px-1 text-center text-xs"
      />
    </div>
  </div>
);

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

export const DirectionField = ({ value, onChange, label = 'Direction', tooltip }: DirectionFieldProps) => (
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

type MinimapToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export const MinimapToggle = ({ checked, onChange }: MinimapToggleProps) => (
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      className="w-4 h-4"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <div className="flex items-center gap-1">
      <label className="text-xs text-muted-foreground">Show on Minimap</label>
      <Tooltip content="If true, this NPC will be shown on the minimap. The default is true.">
        <HelpCircle className="w-3 h-3 text-muted-foreground" />
      </Tooltip>
    </div>
  </div>
);

type SpawnFieldOverlayProps = {
  active: boolean;
  onActivate: () => void;
  children: React.ReactNode;
};

export const SpawnFieldOverlay = ({ active, onActivate, children }: SpawnFieldOverlayProps) => (
  <div className="relative">
    <div className={active ? '' : 'pointer-events-none'}>{children}</div>
    {!active && (
      <div
        className="absolute top-5 left-0 right-0 bottom-0 rounded-md bg-black/50 flex items-center justify-center cursor-pointer z-10 transition-opacity hover:bg-black/40"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onActivate(); }}
      >
        <span className="flex items-center gap-1 text-xs font-medium text-white/90">
          <span className="w-3 h-3 rounded-full bg-white/90 text-[10px] flex items-center justify-center">+</span>
          Add
        </span>
      </div>
    )}
  </div>
);

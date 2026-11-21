import { Input } from '@/components/ui/input';
import { applyHexToFlareColor, flareColorToHex } from '@/editor/uiEngine';

/** Native swatch plus a content-sized text field for Flare r,g,b or r,g,b,a colors. */
export function FlareColorField({
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  'aria-label'?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        aria-label={ariaLabel ? `${ariaLabel} swatch` : 'Color swatch'}
        className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
        value={flareColorToHex(value)}
        onChange={(event) => onChange(applyHexToFlareColor(event.target.value, value))}
      />
      <Input
        aria-label={ariaLabel}
        width="name"
        className="h-7 text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

import DraftInput from './DraftInput';
import { Label } from '@/components/ui/label';
import * as SliderPrimitive from '@radix-ui/react-slider';
import Tooltip from '@/components/ui/tooltip';
import { rawFromSlider, sliderMax, sliderStep, sliderValue, tierBand, tierOf, TIER_SOURCE } from '@/editor/powers/powerTiers';

const TIER_COLOR = { Weak: 'text-muted-foreground', Balanced: 'text-sky-500', Strong: 'text-orange-500' } as const;

type Props = { label: string; flareKey: string; raw: string; unit?: string; tooltip?: string; onChange: (raw: string | null) => void };

/** Slider with a Weak / Balanced / Strong hint; the raw Flare value stays editable on the right. */
const PowerSlider = ({ label, flareKey, raw, unit = '', tooltip, onChange }: Props) => {
  const value = sliderValue(flareKey, raw);
  const tier = tierOf(flareKey, value);
  const band = tierBand(flareKey);
  const max = sliderMax(flareKey, value);
  const hint = band ? `Weak < ${band.p33}${unit} · Strong > ${band.p66}${unit} (${TIER_SOURCE})` : '';
  return (
    <div className="grid grid-cols-[7rem_1fr_4.5rem_5.5rem] items-center gap-2">
      <Tooltip content={`${tooltip ? `${tooltip} · ` : ''}${flareKey}`} side="left">
        <Label className="text-xs truncate font-normal">{label}</Label>
      </Tooltip>
      <SliderPrimitive.Root
        aria-label={label}
        min={0}
        max={max}
        step={sliderStep(flareKey)}
        value={[value ?? 0]}
        onValueChange={(vals) => { const n = vals[0] ?? 0; onChange(n <= 0 ? null : rawFromSlider(flareKey, n, raw)); }}
        className="relative flex w-full touch-none select-none items-center h-4 cursor-pointer"
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-orange-500" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-3 w-3 rounded-full border-2 border-orange-500 bg-background shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
      </SliderPrimitive.Root>
      <Tooltip content={hint || flareKey} side="top">
        <span className={`text-[11px] ${tier ? TIER_COLOR[tier] : 'text-muted-foreground/50'}`}>{tier || '—'}</span>
      </Tooltip>
      <DraftInput className="h-7 text-xs" value={raw} placeholder="—" aria-label={`${label} value`}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} />
    </div>
  );
};

export default PowerSlider;

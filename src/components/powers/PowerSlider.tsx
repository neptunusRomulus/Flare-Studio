import DraftInput from './DraftInput';
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
        <label className="text-xs truncate">{label}</label>
      </Tooltip>
      <input type="range" aria-label={label} min={0} max={max} step={sliderStep(flareKey)} value={value ?? 0}
        className="w-full h-1 accent-orange-500 cursor-pointer"
        onChange={(e) => { const n = parseFloat(e.target.value); onChange(n <= 0 ? null : rawFromSlider(flareKey, n, raw)); }} />
      <Tooltip content={hint || flareKey} side="top">
        <span className={`text-[11px] ${tier ? TIER_COLOR[tier] : 'text-muted-foreground/50'}`}>{tier || '—'}</span>
      </Tooltip>
      <DraftInput className="h-7 text-xs" value={raw} placeholder="—" aria-label={`${label} value`}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} />
    </div>
  );
};

export default PowerSlider;

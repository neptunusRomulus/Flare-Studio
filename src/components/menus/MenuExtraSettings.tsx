import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { MenuPanel } from '@/editor/menuLayout';

// eslint-disable-next-line no-unused-vars -- type-only parameter names
type UpdateValue = (key: string, values: string[]) => void;

type Props = {
  panel: MenuPanel;
  onChange: UpdateValue;
};

type Point = { x: string; y: string; rest: string[] };

function splitPoint(raw: string): Point {
  const parts = String(raw || '').split(',').map((part) => part.trim());
  return { x: parts[0] || '', y: parts[1] || '', rest: parts.slice(2) };
}

function pointText(x: string, y: string, rest: string[] = []) {
  const tail = rest.filter((part) => part !== '').join(',');
  return `${x || '0'},${y || '0'}${tail ? `,${tail}` : ''}`;
}

function parseDurationSeconds(raw: string): string {
  const match = String(raw || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*(ms|s)?$/i);
  if (!match) return '';
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return '';
  return String(match[2]?.toLowerCase() === 'ms' ? Math.round(value / 100) / 10 : value);
}

const STAT_BARS: Record<string, string> = {
  'hp.txt': 'Health bar',
  'mp.txt': 'Mana bar',
  'xp.txt': 'Experience bar',
};

const MenuExtraSettings = ({ panel, onChange }: Props) => {
  const baseName = panel.file.split('/').pop() || '';
  const isActionBar = baseName === 'actionbar.txt';
  const statBarTitle = STAT_BARS[baseName];
  const value = (key: string) => panel.values[key]?.[0] ?? '';
  const set = (key: string, next: string) => onChange(key, next.trim() ? [next] : []);
  const setBool = (key: string, checked: boolean) => set(key, checked ? 'true' : 'false');
  const boolValue = (key: string, fallback: boolean) => {
    const raw = value(key).toLowerCase();
    if (!raw) return fallback;
    return raw !== 'false' && raw !== '0';
  };

  const PointFields = ({
    label,
    storageKey,
    ariaPrefix,
  }: {
    label: string;
    storageKey: string;
    ariaPrefix: string;
  }) => {
    const point = splitPoint(value(storageKey));
    const update = (patch: Partial<Point>) => {
      const next = { ...point, ...patch };
      set(storageKey, pointText(next.x, next.y, next.rest));
    };
    return (
      <div className="space-y-1">
        <span className="block text-[10px] text-muted-foreground">{label}</span>
        <div className="flex items-end gap-1">
          <label className="space-y-1">
            <span className="block text-[10px] text-muted-foreground">X</span>
            <Input aria-label={`${ariaPrefix} X`} className="h-7 w-16 text-xs" inputMode="numeric" value={point.x} onChange={(event) => update({ x: event.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-muted-foreground">Y</span>
            <Input aria-label={`${ariaPrefix} Y`} className="h-7 w-16 text-xs" inputMode="numeric" value={point.y} onChange={(event) => update({ y: event.target.value })} />
          </label>
        </div>
      </div>
    );
  };

  if (!isActionBar && !statBarTitle) return null;

  if (statBarTitle) {
    const position = splitPoint(value('bar_pos'));
    const fillSize = splitPoint(value('bar_fill_size'));
    const fillOffset = splitPoint(value('bar_fill_offset'));
    const text = splitPoint(value('text_pos'));
    const textHidden = value('text_pos').trim() === 'hidden';
    const updateText = (patch: Partial<Point>) => {
      const next = { ...text, ...patch };
      set('text_pos', pointText(next.x || '0', next.y || '0', next.rest.length ? next.rest : ['center', 'center']));
    };

    return (
      <section aria-label={`${statBarTitle} settings`} className="border-b border-border bg-muted/10 px-3 py-2 space-y-3">
        <Tooltip content="How this bar looks and when it hides.">
          <div className="text-[11px] font-medium">{statBarTitle}</div>
        </Tooltip>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-normal text-muted-foreground">Bar position</Label>
            <div className="flex gap-1">
              {(['x', 'y', 'w', 'h'] as const).map((part, index) => (
                <Input
                  key={part}
                  aria-label={`Bar position ${part.toUpperCase()}`}
                  className="h-7 w-14 text-xs"
                  inputMode="numeric"
                  value={[position.x, position.y, position.rest[0] || '', position.rest[1] || ''][index]}
                  onChange={(event) => {
                    const values = [position.x, position.y, position.rest[0] || '0', position.rest[1] || '0'];
                    values[index] = event.target.value;
                    set('bar_pos', values.map((item) => item || '0').join(','));
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-normal text-muted-foreground">Fill size</Label>
            <div className="flex gap-1">
              {(['w', 'h'] as const).map((part, index) => (
                <Input
                  key={part}
                  aria-label={`Fill ${part === 'w' ? 'width' : 'height'}`}
                  className="h-7 w-16 text-xs"
                  inputMode="numeric"
                  placeholder={index === 0 ? 'Match bar' : 'Match bar'}
                  value={[fillSize.x, fillSize.y][index]}
                  onChange={(event) => {
                    const values = [fillSize.x, fillSize.y];
                    values[index] = event.target.value;
                    set('bar_fill_size', values.filter(Boolean).join(','));
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-normal text-muted-foreground">Fill offset</Label>
            <div className="flex gap-1">
              {(['x', 'y'] as const).map((part, index) => (
                <Input
                  key={part}
                  aria-label={`Fill offset ${part.toUpperCase()}`}
                  className="h-7 w-16 text-xs"
                  inputMode="numeric"
                  value={[fillOffset.x, fillOffset.y][index]}
                  onChange={(event) => {
                    const values = [fillOffset.x, fillOffset.y];
                    values[index] = event.target.value;
                    set('bar_fill_offset', values.filter(Boolean).join(','));
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-normal text-muted-foreground">Orientation</Label>
            <Select value={boolValue('orientation', false) ? 'vertical' : 'horizontal'} onValueChange={(next) => setBool('orientation', next === 'vertical')}>
              <SelectTrigger aria-label="Bar orientation" className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal">Horizontal</SelectItem>
                <SelectItem value="vertical">Vertical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-normal text-muted-foreground" htmlFor={`${baseName}-bar-fill`}>Fill image</Label>
            <Input id={`${baseName}-bar-fill`} aria-label="Fill image" className="h-7 w-52 text-xs" width="path" value={value('bar_gfx')} onChange={(event) => set('bar_gfx', event.target.value)} placeholder="Fill image" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-normal text-muted-foreground" htmlFor={`${baseName}-bar-background`}>Background image</Label>
            <Input id={`${baseName}-bar-background`} aria-label="Background image" className="h-7 w-52 text-xs" width="path" value={value('bar_gfx_background')} onChange={(event) => set('bar_gfx_background', event.target.value)} placeholder="Background image" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-normal text-muted-foreground" htmlFor={`${baseName}-hide`}>Hide after</Label>
            <div className="flex items-center gap-1">
              <Input id={`${baseName}-hide`} aria-label="Hide after seconds" className="h-7 w-20 text-xs" inputMode="decimal" placeholder="Never" value={parseDurationSeconds(value('hide_timeout'))} onChange={(event) => {
                const seconds = event.target.value.trim();
                set('hide_timeout', seconds ? `${seconds}s` : '');
              }} />
              <span className="text-[10px] text-muted-foreground">sec</span>
            </div>
          </div>
          <label className="flex items-center gap-2 pb-1">
            <Switch aria-label="Show bar when empty" checked={boolValue('visible_when_empty', true)} onCheckedChange={(checked) => setBool('visible_when_empty', checked)} />
            <span className="text-[11px] text-muted-foreground">Show when empty</span>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 pb-1">
            <Switch aria-label="Show value text" checked={!textHidden} onCheckedChange={(checked) => (checked ? updateText({ x: text.x || '0', y: text.y || '0', rest: ['center', 'center'] }) : set('text_pos', 'hidden'))} />
            <span className="text-[11px] text-muted-foreground">Show value text</span>
          </label>
          {!textHidden ? (
            <>
              <label className="space-y-1">
                <span className="block text-[10px] text-muted-foreground">Text X</span>
                <Input aria-label="Text X" className="h-7 w-16 text-xs" inputMode="numeric" value={text.x} onChange={(event) => updateText({ x: event.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] text-muted-foreground">Text Y</span>
                <Input aria-label="Text Y" className="h-7 w-16 text-xs" inputMode="numeric" value={text.y} onChange={(event) => updateText({ y: event.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] text-muted-foreground">Text align</span>
                <Select value={text.rest[0] || 'center'} onValueChange={(next) => updateText({ rest: [next, text.rest[1] || 'center'] })}>
                  <SelectTrigger aria-label="Text alignment" className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] text-muted-foreground">Text vertical</span>
                <Select value={text.rest[1] || 'center'} onValueChange={(next) => updateText({ rest: [text.rest[0] || 'center', next] })}>
                  <SelectTrigger aria-label="Text vertical alignment" className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </>
          ) : null}
        </div>
      </section>
    );
  }

  type ActionSlot = { index: string; x: string; y: string; locked: boolean };
  const parseSlot = (raw: string): ActionSlot => {
    const parts = String(raw || '').split(',').map((part) => part.trim());
    return { index: parts[0] || '', x: parts[1] || '', y: parts[2] || '', locked: parts[3] === 'true' || parts[3] === '1' };
  };
  const slots = (panel.values.slot || []).map(parseSlot);
  const writeSlots = (next: ActionSlot[]) => onChange('slot', next.map((slot) => `${slot.index},${slot.x || '0'},${slot.y || '0'}${slot.locked ? ',true' : ''}`));
  const updateSlot = (position: number, patch: Partial<ActionSlot>) => {
    writeSlots(slots.map((slot, index) => (index === position ? { ...slot, ...patch } : slot)));
  };
  const addSlot = () => {
    if (slots.length >= 10) return;
    const used = new Set(slots.map((slot) => slot.index));
    const index = Array.from({ length: 10 }, (_, i) => String(i + 1)).find((candidate) => !used.has(candidate)) || '1';
    writeSlots([...slots, { index, x: '0', y: '0', locked: false }]);
  };

  const lockedPoint = (key: string, label: string) => {
    const point = splitPoint(value(key));
    const locked = point.rest[0] === 'true' || point.rest[0] === '1';
    const update = (next: { x?: string; y?: string; locked?: boolean }) => {
      const merged = { x: point.x, y: point.y, locked, ...next };
      set(key, `${merged.x || '0'},${merged.y || '0'}${merged.locked ? ',true' : ''}`);
    };
    return (
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <span className="block text-[10px] text-muted-foreground">{label}</span>
          <div className="flex gap-1">
            <Input aria-label={`${label} X`} className="h-7 w-14 text-xs" inputMode="numeric" value={point.x} onChange={(event) => update({ x: event.target.value })} />
            <Input aria-label={`${label} Y`} className="h-7 w-14 text-xs" inputMode="numeric" value={point.y} onChange={(event) => update({ y: event.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-1 pb-1">
          <Switch aria-label={`${label} locked`} checked={locked} onCheckedChange={(checked) => update({ locked: checked })} />
          <span className="text-[10px] text-muted-foreground">Locked</span>
        </label>
      </div>
    );
  };

  return (
    <section aria-label="Action bar settings" className="border-b border-border bg-muted/10 px-3 py-2 space-y-3">
      <Tooltip content="Where the slots and menu buttons sit, and how tooltips behave.">
        <div className="text-[11px] font-medium">Action bar</div>
      </Tooltip>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-normal">Power slots</Label>
          <Button type="button" size="sm" variant="outline" className="h-6 text-[11px]" onClick={addSlot} disabled={slots.length >= 10}>Add slot</Button>
        </div>
        {slots.length ? slots.map((slot, position) => (
          <div key={`${slot.index}-${position}`} className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-[10px] text-muted-foreground">Slot</span>
              <Select value={slot.index} onValueChange={(next) => updateSlot(position, { index: next })}>
                <SelectTrigger aria-label={`Slot ${position + 1} number`} className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((number) => <SelectItem key={number} value={number}>{number}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] text-muted-foreground">X</span>
              <Input aria-label={`Slot ${position + 1} X`} className="h-7 w-14 text-xs" inputMode="numeric" value={slot.x} onChange={(event) => updateSlot(position, { x: event.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] text-muted-foreground">Y</span>
              <Input aria-label={`Slot ${position + 1} Y`} className="h-7 w-14 text-xs" inputMode="numeric" value={slot.y} onChange={(event) => updateSlot(position, { y: event.target.value })} />
            </label>
            <label className="flex items-center gap-1 pb-1">
              <Switch aria-label={`Slot ${position + 1} locked`} checked={slot.locked} onCheckedChange={(checked) => updateSlot(position, { locked: checked })} />
              <span className="text-[10px] text-muted-foreground">Locked</span>
            </label>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" aria-label={`Remove slot ${position + 1}`} onClick={() => writeSlots(slots.filter((_, index) => index !== position))}>Remove</Button>
          </div>
        )) : <p className="text-[10px] text-muted-foreground">No power slots yet. Add one to place it on the bar.</p>}
      </div>

      <div className="flex flex-wrap gap-4">
        {lockedPoint('slot_M1', 'Primary action')}
        {lockedPoint('slot_M2', 'Secondary action')}
      </div>

      <div className="flex flex-wrap gap-4">
        {PointFields({ label: 'Character button', storageKey: 'char_menu', ariaPrefix: 'Character button' })}
        {PointFields({ label: 'Inventory button', storageKey: 'inv_menu', ariaPrefix: 'Inventory button' })}
        {PointFields({ label: 'Powers button', storageKey: 'powers_menu', ariaPrefix: 'Powers button' })}
        {PointFields({ label: 'Log button', storageKey: 'log_menu', ariaPrefix: 'Log button' })}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-[10px] font-normal text-muted-foreground">Power tooltips</Label>
          <Select value={value('tooltip_length') || 'long_menu'} onValueChange={(next) => set('tooltip_length', next)}>
            <SelectTrigger aria-label="Power tooltip length" className="h-7 w-52 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Name only</SelectItem>
              <SelectItem value="long_menu">Full for powers in the menu</SelectItem>
              <SelectItem value="long_all">Full for every power</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-1">
          <Switch aria-label="Show powers over empty slots" checked={boolValue('powers_overlap_slots', false)} onCheckedChange={(checked) => setBool('powers_overlap_slots', checked)} />
          <span className="text-[11px] text-muted-foreground">Draw powers over empty slots</span>
        </label>
        <label className="flex items-center gap-2 pb-1">
          <Switch aria-label="Gamepad navigation" checked={boolValue('enable_gamepad_nav', true)} onCheckedChange={(checked) => setBool('enable_gamepad_nav', checked)} />
          <span className="text-[11px] text-muted-foreground">Gamepad navigation</span>
        </label>
        <label className="flex items-center gap-2 pb-1">
          <Switch aria-label="Secondary key activates slots" checked={boolValue('enable_main2_activate', true)} onCheckedChange={(checked) => setBool('enable_main2_activate', checked)} />
          <span className="text-[11px] text-muted-foreground">Secondary key activates slots</span>
        </label>
      </div>
    </section>
  );
};

export default MenuExtraSettings;

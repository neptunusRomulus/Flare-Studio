import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { MenuPanel } from '@/editor/menuLayout';
import { MENU_FIELDS, type MenuField } from '@/editor/menuFields';

// eslint-disable-next-line no-unused-vars -- type-only parameter names
type UpdateValue = (key: string, values: string[]) => void;
// eslint-disable-next-line no-unused-vars -- type-only parameter names
type SetValue = (next: string) => void;

type Props = {
  panel: MenuPanel;
  onChange: UpdateValue;
};

const menuName = (file: string) => file.split('/').pop() || '';

function parts(raw: string): string[] {
  return String(raw || '').split(',').map((part) => part.trim());
}

function pointText(x: string, y: string, rest: string[]) {
  const tail = rest.filter((part) => part !== '').join(',');
  return `${x || '0'},${y || '0'}${tail ? `,${tail}` : ''}`;
}

function rectText(x: string, y: string, w: string, h: string, rest: string[]) {
  const tail = rest.filter((part) => part !== '').join(',');
  return `${x || '0'},${y || '0'},${w || '0'},${h || '0'}${tail ? `,${tail}` : ''}`;
}

function colorText(hex: string, alpha: string) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return `${r},${g},${b}${alpha ? `,${alpha}` : ''}`;
}

const FieldLabel = ({ field }: { field: MenuField }) => {
  const label = <span className="block text-[10px] text-muted-foreground">{field.label}</span>;
  return field.hint ? <Tooltip content={field.hint}>{label}</Tooltip> : label;
};

const TEXT_ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const VERTICAL_ALIGNMENTS = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
];

function labelText(x: string, y: string, align: string, valign: string, font: string) {
  return `${x || '0'},${y || '0'},${align || 'left'},${valign || 'center'}${font ? `,${font}` : ''}`;
}

const LabelInputs = ({ fieldLabel, raw, onChange }: { fieldLabel: string; raw: string; onChange: SetValue }) => {
  const hidden = raw.trim() === 'hidden';
  const values = parts(raw);
  const [x, y, align, valign, font] = [
    values[0] || '',
    values[1] || '',
    TEXT_ALIGNMENTS.some((entry) => entry.value === values[2]) ? values[2] : 'left',
    VERTICAL_ALIGNMENTS.some((entry) => entry.value === values[3]) ? values[3] : 'center',
    values[4] || '',
  ];
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Switch
          aria-label={`Hide ${fieldLabel.toLowerCase()}`}
          checked={hidden}
          onCheckedChange={(next) => onChange(next ? 'hidden' : labelText(x, y, align, valign, font))}
        />
        <span className="text-[10px] text-muted-foreground">Hide this text</span>
      </div>
      {hidden ? null : (
        <div className="flex flex-wrap items-center gap-1">
          <Input aria-label={`${fieldLabel} X`} className="h-7 w-14 text-xs" inputMode="numeric" value={x} onChange={(event) => onChange(labelText(event.target.value, y, align, valign, font))} />
          <Input aria-label={`${fieldLabel} Y`} className="h-7 w-14 text-xs" inputMode="numeric" value={y} onChange={(event) => onChange(labelText(x, event.target.value, align, valign, font))} />
          <select
            aria-label={`${fieldLabel} alignment`}
            className="h-7 rounded border border-input bg-background px-1 text-[10px]"
            value={align}
            onChange={(event) => onChange(labelText(x, y, event.target.value, valign, font))}
          >
            {TEXT_ALIGNMENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            aria-label={`${fieldLabel} vertical alignment`}
            className="h-7 rounded border border-input bg-background px-1 text-[10px]"
            value={valign}
            onChange={(event) => onChange(labelText(x, y, align, event.target.value, font))}
          >
            {VERTICAL_ALIGNMENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
};

const StringPointField = ({ field, raw, onChange }: { field: MenuField; raw: string; onChange: SetValue }) => {
  const values = parts(raw);
  const name = values[0] || '';
  const x = values[1] || '';
  const y = values[2] || '';
  return (
    <div className="space-y-1 sm:col-span-2">
      <FieldLabel field={field} />
      <div className="flex items-end gap-1">
        <Input aria-label={`${field.label} name`} className="h-7 flex-1 text-xs" placeholder={field.placeholder} value={name} onChange={(event) => onChange(`${event.target.value},${x || '0'},${y || '0'}`)} />
        <Input aria-label={`${field.label} X`} className="h-7 w-14 text-xs" inputMode="numeric" value={x} onChange={(event) => onChange(`${name},${event.target.value},${y || '0'}`)} />
        <Input aria-label={`${field.label} Y`} className="h-7 w-14 text-xs" inputMode="numeric" value={y} onChange={(event) => onChange(`${name},${x || '0'},${event.target.value}`)} />
      </div>
    </div>
  );
};

const StringRectField = ({ field, raw, onChange }: { field: MenuField; raw: string; onChange: SetValue }) => {
  const values = parts(raw);
  const [name, x, y, w, h] = [values[0] || '', values[1] || '', values[2] || '', values[3] || '', values[4] || ''];
  return (
    <div className="space-y-1 sm:col-span-2">
      <FieldLabel field={field} />
      <div className="flex items-end gap-1">
        <Input aria-label={`${field.label} name`} className="h-7 flex-1 text-xs" placeholder={field.placeholder} value={name} onChange={(event) => onChange(`${event.target.value},${x || '0'},${y || '0'},${w || '0'},${h || '0'}`)} />
        <Input aria-label={`${field.label} X`} className="h-7 w-12 text-xs" inputMode="numeric" value={x} onChange={(event) => onChange(`${name},${event.target.value},${y || '0'},${w || '0'},${h || '0'}`)} />
        <Input aria-label={`${field.label} Y`} className="h-7 w-12 text-xs" inputMode="numeric" value={y} onChange={(event) => onChange(`${name},${x || '0'},${event.target.value},${w || '0'},${h || '0'}`)} />
        <Input aria-label={`${field.label} width`} className="h-7 w-12 text-xs" inputMode="numeric" value={w} onChange={(event) => onChange(`${name},${x || '0'},${y || '0'},${event.target.value},${h || '0'}`)} />
        <Input aria-label={`${field.label} height`} className="h-7 w-12 text-xs" inputMode="numeric" value={h} onChange={(event) => onChange(`${name},${x || '0'},${y || '0'},${w || '0'},${event.target.value}`)} />
      </div>
    </div>
  );
};

const StringLabelField = ({ field, raw, onChange }: { field: MenuField; raw: string; onChange: SetValue }) => {
  const comma = raw.indexOf(',');
  const name = comma >= 0 ? raw.slice(0, comma) : raw;
  const label = comma >= 0 ? raw.slice(comma + 1) : '';
  return (
    <div className="space-y-1 sm:col-span-2">
      <FieldLabel field={field} />
      <Input aria-label={`${field.label} name`} className="h-7 text-xs" placeholder={field.placeholder} value={name} onChange={(event) => onChange(`${event.target.value}${label ? `,${label}` : ''}`)} />
      <LabelInputs fieldLabel={field.label} raw={label} onChange={(next) => onChange(`${name},${next}`)} />
    </div>
  );
};

const PointPathField = ({ field, raw, onChange }: { field: MenuField; raw: string; onChange: SetValue }) => {
  const values = parts(raw);
  const [x, y] = [values[0] || '', values[1] || ''];
  const path = values.slice(2).join(',');
  return (
    <div className="space-y-1 sm:col-span-2">
      <FieldLabel field={field} />
      <div className="flex items-end gap-1">
        <Input aria-label={`${field.label} X`} className="h-7 w-14 text-xs" inputMode="numeric" value={x} onChange={(event) => onChange(`${event.target.value},${y || '0'}${path ? `,${path}` : ''}`)} />
        <Input aria-label={`${field.label} Y`} className="h-7 w-14 text-xs" inputMode="numeric" value={y} onChange={(event) => onChange(`${x || '0'},${event.target.value}${path ? `,${path}` : ''}`)} />
        <Input aria-label={`${field.label} image`} className="h-7 flex-1 text-xs" placeholder={field.placeholder} value={path} onChange={(event) => onChange(`${x || '0'},${y || '0'}${event.target.value ? `,${event.target.value}` : ''}`)} />
      </div>
    </div>
  );
};

const PointField = ({ field, raw, onChange }: { field: MenuField; raw: string; onChange: SetValue }) => {
  const values = parts(raw);
  const x = values[0] || '';
  const y = values[1] || '';
  const rest = values.slice(2);
  return (
    <div className="space-y-1">
      <FieldLabel field={field} />
      <div className="flex items-end gap-1">
        <Input aria-label={`${field.label} X`} className="h-7 w-16 text-xs" inputMode="numeric" value={x} onChange={(event) => onChange(pointText(event.target.value, y, rest))} />
        <Input aria-label={`${field.label} Y`} className="h-7 w-16 text-xs" inputMode="numeric" value={y} onChange={(event) => onChange(pointText(x, event.target.value, rest))} />
      </div>
    </div>
  );
};

const RectField = ({ field, raw, onChange }: { field: MenuField; raw: string; onChange: SetValue }) => {
  const values = parts(raw);
  const [x, y, w, h] = [values[0] || '', values[1] || '', values[2] || '', values[3] || ''];
  const rest = values.slice(4);
  const update = (next: [string, string, string, string]) => onChange(rectText(next[0], next[1], next[2], next[3], rest));
  return (
    <div className="space-y-1">
      <FieldLabel field={field} />
      <div className="flex items-end gap-1">
        <Input aria-label={`${field.label} X`} className="h-7 w-14 text-xs" inputMode="numeric" value={x} onChange={(event) => update([event.target.value, y, w, h])} />
        <Input aria-label={`${field.label} Y`} className="h-7 w-14 text-xs" inputMode="numeric" value={y} onChange={(event) => update([x, event.target.value, w, h])} />
        <Input aria-label={`${field.label} width`} className="h-7 w-14 text-xs" inputMode="numeric" value={w} onChange={(event) => update([x, y, event.target.value, h])} />
        <Input aria-label={`${field.label} height`} className="h-7 w-14 text-xs" inputMode="numeric" value={h} onChange={(event) => update([x, y, w, event.target.value])} />
      </div>
    </div>
  );
};

const ColorField = ({ field, raw, onChange }: { field: MenuField; raw: string; onChange: SetValue }) => {
  const values = parts(raw);
  const alpha = values.length > 3 ? values[3] : '';
  const hex = `#${[values[0], values[1], values[2]].map((part) => {
    const n = Math.max(0, Math.min(255, Number(part) || 0));
    return n.toString(16).padStart(2, '0');
  }).join('')}`;
  return (
    <div className="space-y-1">
      <FieldLabel field={field} />
      <input
        type="color"
        aria-label={field.label}
        className="h-7 w-14 cursor-pointer rounded border border-input bg-transparent p-0.5"
        value={hex}
        onChange={(event) => onChange(colorText(event.target.value, alpha))}
      />
    </div>
  );
};

const Field = ({ field, raw, onChange }: { field: MenuField; raw: string; onChange: SetValue }) => {
  if (field.kind === 'switch') {
    const checked = raw === '' ? Boolean(field.defaultValue) : raw !== 'false' && raw !== '0';
    return (
      <div className="flex items-center gap-2">
        <Switch aria-label={field.label} checked={checked} onCheckedChange={(next) => onChange(next ? 'true' : 'false')} />
        <span className="text-[11px] text-muted-foreground">{field.label}</span>
      </div>
    );
  }
  if (field.kind === 'duration') {
    const isSeconds = /^\d+(?:\.\d+)?s$/.test(raw.trim());
    const shown = isSeconds ? raw.trim().slice(0, -1) : raw;
    return (
      <div className="space-y-1">
        <FieldLabel field={field} />
        <div className="flex items-center gap-1">
          <Input
            aria-label={field.label}
            className="h-7 w-24 text-xs"
            inputMode="decimal"
            placeholder="10s"
            value={shown}
            onChange={(event) => {
              const next = event.target.value.trim();
              onChange(next === '' ? '' : /^\d+(?:\.\d+)?$/.test(next) ? `${next}s` : next);
            }}
          />
          <span className="text-[10px] text-muted-foreground">{isSeconds || raw === '' ? 'sec' : ''}</span>
        </div>
      </div>
    );
  }
  if (field.kind === 'point') return <PointField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'rect') return <RectField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'color') return <ColorField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'label') {
    return (
      <div className="space-y-1">
        <FieldLabel field={field} />
        <LabelInputs fieldLabel={field.label} raw={raw} onChange={onChange} />
      </div>
    );
  }
  if (field.kind === 'string-point') return <StringPointField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'string-rect') return <StringRectField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'string-label') return <StringLabelField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'point-path') return <PointPathField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'select') {
    const options = field.options || [];
    return (
      <div className="space-y-1">
        <FieldLabel field={field} />
        <Select value={raw || '__default'} onValueChange={(next) => onChange(next === '__default' ? '' : next)}>
          <SelectTrigger aria-label={field.label} className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value || '__default'} value={option.value || '__default'}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.kind === 'path-rest') {
    const [path, ...rest] = parts(raw);
    return (
      <div className="space-y-1 sm:col-span-2">
        <FieldLabel field={field} />
        <Input
          aria-label={field.label}
          width="path"
          className="h-7 text-xs"
          placeholder={field.placeholder}
          value={path}
          onChange={(event) => onChange(`${event.target.value}${rest.length ? `,${rest.join(',')}` : ''}`)}
        />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <FieldLabel field={field} />
      <div className="flex items-center gap-1">
        <Input
          aria-label={field.label}
          width={field.kind === 'path' ? 'path' : undefined}
          className="h-7 text-xs"
          type={field.kind === 'number' ? 'number' : undefined}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={raw}
          onChange={(event) => onChange(event.target.value)}
        />
        {field.suffix ? <span className="text-[10px] text-muted-foreground">{field.suffix}</span> : null}
      </div>
    </div>
  );
};

const MenuPerPanelSettings = ({ panel, onChange }: Props) => {
  const fields = MENU_FIELDS[menuName(panel.file)];
  if (!fields?.length) return null;
  const value = (key: string) => panel.values[key]?.[0] ?? '';
  return (
    <section aria-label="Panel settings" className="border-b border-border bg-muted/20 px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium">Panel settings</span>
        <span className="text-[10px] text-muted-foreground">Positions, sizes and display options for this panel.</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <div key={field.key} className="min-w-0">
            <Field field={field} raw={value(field.key)} onChange={(next) => onChange(field.key, next.trim() ? [next] : [])} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default MenuPerPanelSettings;

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
    return (
      <div className="flex items-center gap-2">
        <Switch aria-label={field.label} checked={raw !== 'false' && raw !== '0'} onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')} />
        <span className="text-[11px] text-muted-foreground">{field.label}</span>
      </div>
    );
  }
  if (field.kind === 'point') return <PointField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'rect') return <RectField field={field} raw={raw} onChange={onChange} />;
  if (field.kind === 'color') return <ColorField field={field} raw={raw} onChange={onChange} />;
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

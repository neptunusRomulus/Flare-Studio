import { useState } from 'react';
import { X } from 'lucide-react';
import SearchablePalette, { type SearchablePaletteEntry } from '@/components/ui/searchable-palette';
import DraftInput from '@/components/powers/DraftInput';
import { Switch } from '@/components/ui/switch';
import Tooltip from '@/components/ui/tooltip';
import { InlineConfirm } from '@/components/ui/inline-confirm';

export type EditorProperty = {
  key: string;
  label: string;
  value: string;
  tooltip?: string;
  /** 'toggle' renders an on/off switch writing "true"/"false". */
  kind?: 'text' | 'toggle';
};

type Props = {
  title?: string;
  properties: EditorProperty[];
  catalog: SearchablePaletteEntry[];
  onChange: (key: string, value: string) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
};

/** Properties list + Add property palette, same shape as the NPC editor. */
const EditorPropertyList = ({ title = 'Properties', properties, catalog, onChange, onAdd, onRemove }: Props) => {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  return (
    <section className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-1">
        {properties.map((property) => (
          <div key={property.key} className="flex items-center gap-2">
            <Tooltip content={property.tooltip || property.key} side="left">
              <label className="w-36 shrink-0 text-xs text-foreground truncate">{property.label}</label>
            </Tooltip>
            {property.kind === 'toggle' ? (
              <div className="flex-1 h-7 flex items-center">
                <Switch
                  checked={property.value.trim().toLowerCase() !== 'false'}
                  onCheckedChange={(checked) => onChange(property.key, checked ? 'true' : 'false')}
                  aria-label={property.label}
                />
              </div>
            ) : (
              <DraftInput
                className="h-7 text-xs"
                value={property.value}
                onChange={(event) => onChange(property.key, event.target.value)}
                aria-label={property.label}
              />
            )}
            <InlineConfirm
              open={confirmKey === property.key}
              onCancel={() => setConfirmKey(null)}
              onConfirm={() => {
                onRemove(property.key);
                setConfirmKey(null);
              }}
              message="Remove this property?"
            >
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                aria-label={`Remove ${property.label}`}
                onClick={() => setConfirmKey(property.key)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </InlineConfirm>
          </div>
        ))}
      </div>
      {catalog.length > 0 && <SearchablePalette entries={catalog} onSelect={onAdd} />}
    </section>
  );
};

export default EditorPropertyList;

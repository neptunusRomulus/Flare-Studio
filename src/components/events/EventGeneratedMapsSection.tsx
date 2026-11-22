import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { HintLabel } from '@/components/ui/field-hint';
import { PROCGEN_RULES_LIST_ID } from '@/editor/procgenRules';

export type ProcgenValues = {
  filename: string;
  link: string;
  doorLevel: string;
};

type Props = {
  values: ProcgenValues;
  /** Another event already owns this map's single layout file. */
  conflicting: boolean;
  onChange: (patch: Partial<ProcgenValues>) => void;
};

/** The generated-map fields: layout file, which side the door connects to, and its level. */
export default function EventGeneratedMapsSection({ values, conflicting, onChange }: Props) {
  const bind = (key: keyof ProcgenValues) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ [key]: event.target.value } as Partial<ProcgenValues>);
  };
  return (
    <div className="space-y-2 px-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated maps</div>
      {conflicting ? (
        <p className="text-[11px] leading-snug text-amber-500">
          Only one layout file is used per map. Another event already has one.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-28 shrink-0" hint="A layout that fills this event's area when the map loads. Only one is used per map.">Layout file</HintLabel>
        <Input
          width="path"
          className="h-7 text-xs"
          list={PROCGEN_RULES_LIST_ID}
          aria-label="Layout file"
          value={values.filename}
          onChange={bind('filename')}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-28 shrink-0" hint="Which side of a generated map this door connects to.">Connects to</HintLabel>
        <Input
          width="id"
          className="h-7 text-xs"
          list="procgen-link-dirs"
          aria-label="Connects to"
          value={values.link}
          onChange={bind('link')}
        />
        <datalist id="procgen-link-dirs">
          <option value="north" />
          <option value="south" />
          <option value="west" />
          <option value="east" />
        </datalist>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-28 shrink-0" hint="The door levels where this event is active.">Door level</HintLabel>
        <Input
          width="id"
          className="h-7 text-xs"
          aria-label="Door level"
          value={values.doorLevel}
          onChange={bind('doorLevel')}
        />
      </div>
    </div>
  );
}

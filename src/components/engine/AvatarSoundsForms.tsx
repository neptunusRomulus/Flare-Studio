import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import {
  AVATAR_SFX_DIR,
  avatarSfxRelPath,
  emptyAvatarSfx,
  parseAvatarSfx,
  parseStepSounds,
  serializeAvatarSfx,
  serializeStepSounds,
  type AvatarSfxFile,
  type StepSoundSet,
} from '@/editor/avatarSounds';

const PathList = ({
  label,
  hint,
  values,
  onChange,
}: {
  label: string;
  hint: string;
  values: string[];
  onChange: (next: string[]) => void;
}) => (
  <div className="space-y-1">
    <HintLabel className="text-xs font-normal" hint={hint}>{label}</HintLabel>
    {values.map((value, index) => (
      <div key={index} className="flex flex-wrap items-center gap-1">
        <Input width="path" className="h-6 text-xs" aria-label={`${label} ${index + 1}`} value={value} onChange={(e) => onChange(values.map((item, i) => (i === index ? e.target.value : item)))} />
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={`Remove ${label} ${index + 1}`} onClick={() => onChange(values.filter((_, i) => i !== index))}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    ))}
    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([...values, ''])}><Plus className="w-3 h-3 mr-1" />{label}</Button>
  </div>
);

export function StepSoundsForm({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const sets = parseStepSounds(text);
  const write = (next: StepSoundSet[]) => onChange(serializeStepSounds(next, text));
  return (
    <div className="space-y-2">
      <FieldHint hint="items/step_sounds.txt. Each id is a set of footstep files. engine/stats.txt sfx_step is one of these ids (cloth, leather, metal, …).">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step sounds</div>
      </FieldHint>
      {sets.map((set, index) => (
        <div key={index} className="space-y-1 rounded-md border border-border p-2">
          <div className="flex flex-wrap items-center gap-1">
            <HintLabel className="text-xs font-normal w-10 shrink-0" hint="Id used by sfx_step and by item step sounds.">id</HintLabel>
            <Input width="id" className="h-7 text-xs" value={set.id} onChange={(e) => write(sets.map((item, i) => (i === index ? { ...item, id: e.target.value } : item)))} />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remove step set ${set.id || index + 1}`} onClick={() => write(sets.filter((_, i) => i !== index))}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <PathList label="step" hint="Filename of one footstep sound. Several files are picked at random." values={set.steps} onChange={(steps) => write(sets.map((item, i) => (i === index ? { ...item, steps } : item)))} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => write([...sets, { id: '', steps: [''] }])}>
        <Plus className="w-3 h-3 mr-1" />Set
      </Button>
    </div>
  );
}

export function AvatarSfxTablesForm({ files, onChange }: { files: Record<string, string>; onChange: (files: Record<string, string>) => void }) {
  const paths = Object.keys(files).sort();
  const [selected, setSelected] = useState(paths[0] || '');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  useEffect(() => {
    if (selected && files[selected] != null) return;
    setSelected(Object.keys(files).sort()[0] || '');
  }, [files, selected]);
  const text = selected ? files[selected] ?? '' : '';
  const file = selected ? parseAvatarSfx(text) : emptyAvatarSfx();
  const write = (next: AvatarSfxFile) => {
    if (!selected) return;
    onChange({ ...files, [selected]: serializeAvatarSfx(next, text) });
  };
  const create = () => {
    let rel = avatarSfxRelPath(title || 'body');
    let n = 2;
    const used = new Set(Object.keys(files).map((item) => item.toLowerCase()));
    while (used.has(rel.toLowerCase())) {
      rel = avatarSfxRelPath(`${title || 'body'}_${n}`);
      n += 1;
    }
    onChange({ ...files, [rel]: serializeAvatarSfx(emptyAvatarSfx()) });
    setSelected(rel);
    setCreating(false);
    setTitle('');
  };
  return (
    <div className="space-y-3">
      <FieldHint hint={`${AVATAR_SFX_DIR}/<base>.txt, loaded for the hero's gfx_base (male, female, …). sfx_attack is animation,filename. sfx_lowhp is filename or filename,true to loop. Empty keys are not written.`}>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avatar sounds</div>
      </FieldHint>
      <div className="flex flex-wrap items-center gap-1">
        {paths.map((path) => (
          <Button key={path} type="button" size="sm" variant={selected === path ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={selected === path} onClick={() => setSelected(path)}>
            {path.replace(new RegExp(`^${AVATAR_SFX_DIR}/`), '').replace(/\.txt$/i, '')}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}><Plus className="w-3 h-3 mr-1" />Body</Button>
      </div>
      {creating && (
        <div className="flex flex-wrap items-center gap-1">
          <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Filename stem under engine/avatar/, matching a hero option base.">base</HintLabel>
          <Input width="name" className="h-7 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
          <Button type="button" size="sm" className="h-7 text-xs" onClick={create}>Create</Button>
        </div>
      )}
      {selected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground truncate">{selected}</div>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { const next = { ...files }; delete next[selected]; onChange(next); }}>
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
          </div>
          <div className="space-y-1">
            <HintLabel className="text-xs font-normal" hint="sfx_attack=animation,filename. Repeat for several files of the same animation; the engine picks one.">sfx_attack</HintLabel>
            {file.attacks.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1">
                <Input width="id" className="h-6 text-xs" aria-label={`Attack animation ${index + 1}`} value={row.animation} onChange={(e) => write({ ...file, attacks: file.attacks.map((item, i) => (i === index ? { ...item, animation: e.target.value } : item)) })} />
                <Input width="path" className="h-6 text-xs" aria-label={`Attack sound ${index + 1}`} value={row.file} onChange={(e) => write({ ...file, attacks: file.attacks.map((item, i) => (i === index ? { ...item, file: e.target.value } : item)) })} />
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={`Remove attack sound ${index + 1}`} onClick={() => write({ ...file, attacks: file.attacks.filter((_, i) => i !== index) })}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => write({ ...file, attacks: [...file.attacks, { animation: 'swing', file: '' }] })}><Plus className="w-3 h-3 mr-1" />Attack</Button>
          </div>
          <PathList label="sfx_hit" hint="Sound when the hero is hit." values={file.hit} onChange={(hit) => write({ ...file, hit })} />
          <PathList label="sfx_die" hint="Sound when the hero dies." values={file.die} onChange={(die) => write({ ...file, die })} />
          <PathList label="sfx_critdie" hint="Sound when the hero dies to a critical hit." values={file.critdie} onChange={(critdie) => write({ ...file, critdie })} />
          <PathList label="sfx_block" hint="Sound when the hero blocks a hit." values={file.block} onChange={(block) => write({ ...file, block })} />
          <div className="flex flex-wrap items-center gap-2">
            <HintLabel className="text-xs font-normal w-24 shrink-0" hint="Sound played on level up.">sfx_levelup</HintLabel>
            <Input width="path" className="h-7 text-xs" value={file.levelup} onChange={(e) => write({ ...file, levelup: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <HintLabel className="text-xs font-normal w-24 shrink-0" hint="Low-health warning. Use filename,true to loop it.">sfx_lowhp</HintLabel>
            <Input width="path" className="h-7 text-xs" value={file.lowhp} onChange={(e) => write({ ...file, lowhp: e.target.value })} />
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No body sound files yet. Create one named after a hero base (male, female).</div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { FlareColorField } from '@/components/ui/flare-color-field';
import {
  SOUND_FILE_LIST_ID,
  parseSubtitlesFile,
  serializeSubtitlesFile,
  type SubtitleRow,
  type SubtitleStyle,
} from '@/editor/subtitlesFile';

const ALIGN_VALUES = [
  'topleft', 'top', 'topright', 'left', 'center', 'right', 'bottomleft', 'bottom', 'bottomright',
];

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

const isSound = (name: string) => /\.(ogg|wav|opus|flac)$/i.test(name);

async function listSounds(root: string, rel = 'soundfx'): Promise<string[]> {
  if (!window.electronAPI?.readDir) return [];
  const entries = (await window.electronAPI.readDir(projectFile(root, rel)).catch(() => [])) || [];
  const out: string[] = [];
  for (const entry of entries as Array<{ name: string; isDirectory?: boolean }>) {
    if (!entry?.name || entry.name === '.' || entry.name === '..') continue;
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory) out.push(...await listSounds(root, child));
    else if (isSound(entry.name)) out.push(child);
  }
  return out.sort();
}

export default function SubtitlesForm({
  text, projectPath, onChange,
}: {
  text: string;
  projectPath: string | null;
  onChange: (text: string) => void;
}) {
  const file = parseSubtitlesFile(text);
  const [sounds, setSounds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!projectPath) { setSounds([]); return; }
    setSounds(await listSounds(projectPath.replace(/\\/g, '/')));
  }, [projectPath]);

  useEffect(() => { void refresh(); }, [refresh]);

  const write = (style: SubtitleStyle, rows: SubtitleRow[]) => {
    onChange(serializeSubtitlesFile({ header: file.header, style, rows }, text));
  };

  const setStyle = (patch: Partial<SubtitleStyle>) => write({ ...file.style, ...patch }, file.rows);
  const setRow = (index: number, patch: Partial<SubtitleRow>) => {
    write(file.style, file.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  return (
    <div className="space-y-3">
      <FieldHint hint="soundfx/subtitles.txt. A subtitle is tied to a sound file by id. text is the string shown while that sound plays (about one second per ten letters). The player can still turn subtitles off in settings.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subtitles</div>
      </FieldHint>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Label style: x, y, justify (left/center/right), valign (top/center/bottom), font id. Or hidden.">text_pos</HintLabel>
        <Input aria-label="text_pos" width="path" className="h-7 text-xs" value={file.style.text_pos} onChange={(e) => setStyle({ text_pos: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Position of the subtitle text relative to align.">pos</HintLabel>
        <Input aria-label="pos" width="short" className="h-7 text-xs" placeholder="x,y" value={file.style.pos} onChange={(e) => setStyle({ pos: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Screen alignment: topleft, top, topright, left, center, right, bottomleft, bottom, bottomright. Frame alignments also work.">align</HintLabel>
        <Input aria-label="align" width="name" className="h-7 text-xs" list="subtitle-align-values" value={file.style.align} onChange={(e) => setStyle({ align: e.target.value })} />
        <datalist id="subtitle-align-values">
          {ALIGN_VALUES.map((value) => <option key={value} value={value} />)}
        </datalist>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Background rectangle color and alpha (r,g,b,a). Alpha 0 hides the background.">background_color</HintLabel>
        <FlareColorField aria-label="background_color" value={file.style.background_color} onChange={(next) => setStyle({ background_color: next })} />
      </div>
      {file.rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1">
          <Input aria-label={`subtitle ${index + 1} id`} width="path" className="h-7 text-xs" placeholder="sound file" list={SOUND_FILE_LIST_ID} value={row.id} onChange={(e) => setRow(index, { id: e.target.value })} />
          <Input aria-label={`subtitle ${index + 1} text`} width="path" className="h-7 text-xs" placeholder="text" value={row.text} onChange={(e) => setRow(index, { text: e.target.value })} />
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove subtitle ${index + 1}`} onClick={() => write(file.style, file.rows.filter((_, rowIndex) => rowIndex !== index))}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => write(file.style, [...file.rows, { id: '', text: '', comment: '' }])}>
        <Plus className="w-3 h-3 mr-1" />Subtitle
      </Button>
      <datalist id={SOUND_FILE_LIST_ID}>
        {sounds.map((path) => <option key={path} value={path} />)}
        {file.rows.filter((row) => row.id.trim() && !sounds.includes(row.id.trim())).map((row) => (
          <option key={`row-${row.id}`} value={row.id.trim()} />
        ))}
      </datalist>
    </div>
  );
}


import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';

export const FONT_FILE_LIST_ID = 'project-font-files';
export const FONTS_DIR = 'fonts';

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

const isFontName = (name: string) => /\.ttf$/i.test(name);

/** List, add and preview TTF files in fonts/. There is no fonts.txt; Flare reads files named in font_settings.txt from this folder. */
export default function FontLibrary({ projectPath }: { projectPath: string | null }) {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [src, setSrc] = useState('');
  const [sample, setSample] = useState('The quick brown fox jumps over the lazy dog 0123456789');
  const [point, setPoint] = useState('16');

  const refresh = useCallback(async () => {
    if (!root || !window.electronAPI?.readDir) { setFiles([]); return; }
    const entries = (await window.electronAPI.readDir(projectFile(root, FONTS_DIR)).catch(() => [])) || [];
    const names = entries
      .filter((entry: { isDirectory?: boolean; name: string }) => !entry.isDirectory && isFontName(entry.name))
      .map((entry: { name: string }) => entry.name)
      .sort();
    setFiles(names);
    setSelected((current) => (current && names.includes(current) ? current : names[0] || ''));
  }, [root]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!root || !selected || !window.electronAPI?.readFileAsDataURL) { setSrc(''); return; }
      const url = await window.electronAPI.readFileAsDataURL(projectFile(root, `${FONTS_DIR}/${selected}`));
      if (!cancelled) setSrc(url || '');
    };
    void load();
    return () => { cancelled = true; };
  }, [root, selected]);

  const add = async () => {
    if (!root || !window.electronAPI?.importIntoProject) {
      toast({ title: 'Cannot add a font', description: 'Restart the app so the file importer is available.', variant: 'destructive' });
      return;
    }
    const result = await window.electronAPI.importIntoProject({
      projectPath: root,
      destDir: FONTS_DIR,
      title: 'Add a font file',
      filters: [{ name: 'TrueType fonts', extensions: ['ttf'] }],
    });
    if (result?.cancelled) return;
    if (!result?.success) {
      toast({ title: 'Could not add the font', description: result?.error || 'Copy failed.', variant: 'destructive' });
      return;
    }
    await refresh();
    if (result.name) setSelected(result.name);
  };

  const family = selected ? `flare-font-${selected.replace(/[^A-Za-z0-9]+/g, '-')}` : '';

  return (
    <div className="space-y-2">
      <FieldHint hint="TTF files in fonts/. Flare has no fonts.txt; font_settings.txt style lines name a file in this folder (usually just the filename). Only .ttf is supported.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Font files</div>
      </FieldHint>
      <div className="flex flex-wrap items-center gap-1">
        {files.map((name) => (
          <Button key={name} type="button" size="sm" variant={selected === name ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={selected === name} onClick={() => setSelected(name)}>
            {name}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => { void add(); }}>
          <Plus className="w-3 h-3 mr-1" />Add font
        </Button>
      </div>
      {selected ? (
        <div className="space-y-2 rounded-md border border-border p-2">
          <style>{src ? `@font-face { font-family: '${family}'; src: url('${src}'); }` : ''}</style>
          <div className="flex flex-wrap items-center gap-2">
            <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Preview only. The point size in font_settings.txt is what the engine uses.">preview</HintLabel>
            <Input width="num" className="h-7 text-xs" aria-label="Preview point size" value={point} onChange={(e) => setPoint(e.target.value)} />
            <Input width="path" className="h-7 text-xs" aria-label="Preview sample text" value={sample} onChange={(e) => setSample(e.target.value)} />
          </div>
          <div className="min-h-10 rounded-md bg-muted/40 px-2 py-1 text-foreground" style={{ fontFamily: family, fontSize: `${parseInt(point, 10) || 16}px` }}>
            {sample || ' '}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No .ttf files in fonts/ yet. Add one, then mention its filename in a style line below.</div>
      )}
      <datalist id={FONT_FILE_LIST_ID}>
        {files.map((name) => <option key={name} value={name} />)}
      </datalist>
    </div>
  );
}

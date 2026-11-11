import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { engineTextFromSections, sectionsFromEngineText } from '@/adapters/flare/flareAdapter.cjs';
import { loadConfigDocument, saveConfigDocument } from '@/editor/projectFiles';
import { useAppContext } from '@/context/AppContext';

const FILES = [
  { path: 'items/types.txt', label: 'Types', section: 'type' },
  { path: 'items/qualities.txt', label: 'Qualities', section: 'quality' },
  { path: 'items/sets.txt', label: 'Sets', section: 'set' },
] as const;

type Section = { type: string; fields: Array<{ key: string; value: string; comment?: string }> };

export default function ItemMetaEditor({ initialFile }: { initialFile?: string }) {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [active, setActive] = useState(initialFile || FILES[0].path);
  const [docs, setDocs] = useState<Record<string, Section[]>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialFile) setActive(initialFile);
  }, [initialFile]);

  useEffect(() => {
    if (!projectPath) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, Section[]> = {};
      for (const file of FILES) {
        const text = await loadConfigDocument(projectPath, file.path);
        next[file.path] = (sectionsFromEngineText(text || '') || []) as Section[];
      }
      if (!cancelled) { setDocs(next); setDirty({}); }
    })();
    return () => { cancelled = true; };
  }, [projectPath]);

  const sections = docs[active] || [];
  const meta = FILES.find((f) => f.path === active) || FILES[0];

  const remember = (path: string, sections: Section[]) => {
    setDocs((prev) => ({ ...prev, [path]: sections }));
    setDirty((prev) => ({ ...prev, [path]: true }));
  };

  const save = async () => {
    if (!projectPath) return;
    const text = engineTextFromSections(docs[active] || []);
    const saved = await saveConfigDocument(projectPath, active, text);
    if (saved) {
      setDirty((prev) => ({ ...prev, [active]: false }));
      toast({ title: 'Saved', description: active });
    } else {
      toast({ title: 'Save failed', description: active, variant: 'destructive' });
    }
  };

  const updateField = (si: number, fi: number, key: 'key' | 'value', value: string) => {
    const next = sections.map((sec, i) => i !== si ? sec : { ...sec, fields: sec.fields.map((f, j) => (j === fi ? { ...f, [key]: value } : f)) });
    remember(active, next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        {FILES.map((file) => (
          <button key={file.path} type="button" onClick={() => setActive(file.path)}
            className={`h-7 px-2 rounded border text-xs ${active === file.path ? 'bg-orange-600 text-white border-orange-600' : 'border-border text-muted-foreground'}`}>
            {file.label}{dirty[file.path] ? ' ●' : ''}
          </button>
        ))}
        <div className="flex-1" />
        <Button size="sm" className="h-7 text-xs" onClick={() => void save()} disabled={!dirty[active]}>Save</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <p className="text-[11px] text-muted-foreground">{meta.path} — short id/name forms. Extra keys stay editable.</p>
        {sections.map((section, si) => (
          <div key={si} className="border border-border/50 rounded-md p-2 space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground">[{section.type || meta.section}]</div>
            {section.fields.map((field, fi) => field.comment !== undefined && !field.key ? (
              <p key={fi} className="text-[11px] italic text-muted-foreground">{field.comment}</p>
            ) : (
              <div key={fi} className="flex items-center gap-1">
                <Input className="h-6 w-32 text-xs font-mono" value={field.key} onChange={(e) => updateField(si, fi, 'key', e.target.value)} />
                <Input className="h-6 flex-1 text-xs" value={field.value} onChange={(e) => updateField(si, fi, 'value', e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove field" onClick={() => remember(active, sections.map((s, i) => i !== si ? s : { ...s, fields: s.fields.filter((_, j) => j !== fi) }))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => remember(active, sections.map((s, i) => i !== si ? s : { ...s, fields: [...s.fields, { key: '', value: '' }] }))}>
              <Plus className="w-3 h-3 mr-1" />Field
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => remember(active, [...sections, { type: meta.section, fields: [{ key: 'id', value: '' }, { key: 'name', value: '' }] }])}>
          <Plus className="w-3 h-3 mr-1" />{meta.label.slice(0, -1)}
        </Button>
      </div>
    </div>
  );
}

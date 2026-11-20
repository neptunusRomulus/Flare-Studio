import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldHint } from '@/components/ui/field-hint';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { loadConfigDocument, projectRoot, writeProjectFiles } from '@/editor/projectFiles';
import {
  DATA_POT_PATH,
  LANGUAGES_TXT_PATH,
  SOURCE_LANGUAGE,
  dataPoPath,
  defaultLanguageName,
  emptyPo,
  ensureSourceLanguage,
  mergeCatalogIntoPo,
  normalizeLanguageCode,
  parseLanguagesTxt,
  parsePo,
  serializeLanguagesTxt,
  serializePo,
  translationProgress,
  type CatalogString,
  type LanguageEntry,
  type PoFile,
} from '@/editor/poFile';
import { scanProjectStrings } from '@/editor/stringScan';

type Props = {
  projectPath?: string | null;
  onBack?: () => void;
};

function clonePo(file: PoFile): PoFile {
  return {
    headerComments: [...file.headerComments],
    header: file.header,
    entries: file.entries.map((entry) => ({ ...entry, comments: [...entry.comments], flags: [...entry.flags] })),
  };
}

const StringEditorView: React.FC<Props> = ({ projectPath, onBack }) => {
  const [languages, setLanguages] = useState<LanguageEntry[]>(ensureSourceLanguage([]));
  const [selected, setSelected] = useState(SOURCE_LANGUAGE);
  const [pos, setPos] = useState<Record<string, PoFile>>({});
  const [catalog, setCatalog] = useState<CatalogString[]>([]);
  const [search, setSearch] = useState('');
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addCode, setAddCode] = useState('');
  const [addName, setAddName] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const selectedPo = selected === SOURCE_LANGUAGE ? null : pos[selected] ?? emptyPo(selected);
  const progress = selectedPo ? translationProgress(selectedPo) : { total: 0, done: 0 };
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  const loadAll = useCallback(async () => {
    if (!projectPath) {
      setLanguages(ensureSourceLanguage([]));
      setPos({});
      setCatalog([]);
      setSelected(SOURCE_LANGUAGE);
      setDirty(false);
      setLoaded(false);
      return;
    }
    const list = parseLanguagesTxt(await loadConfigDocument(projectPath, LANGUAGES_TXT_PATH));
    const potRaw = await loadConfigDocument(projectPath, DATA_POT_PATH);
    const loadedCatalog: CatalogString[] = potRaw
      ? parsePo(potRaw).entries.filter((entry) => !entry.obsolete && entry.msgid).map((entry) => ({
        msgid: entry.msgid,
        msgctxt: entry.msgctxt,
        comments: entry.comments,
      }))
      : [];
    const nextPos: Record<string, PoFile> = {};
    for (const language of list) {
      if (language.code === SOURCE_LANGUAGE) continue;
      const raw = await loadConfigDocument(projectPath, dataPoPath(language.code));
      nextPos[language.code] = raw ? parsePo(raw) : (loadedCatalog.length ? mergeCatalogIntoPo(emptyPo(language.code), loadedCatalog) : emptyPo(language.code));
    }
    setLanguages(list);
    setPos(nextPos);
    setCatalog(loadedCatalog);
    setSelected((current) => list.some((language) => language.code === current) ? current : (list[1]?.code ?? SOURCE_LANGUAGE));
    setDirty(false);
    setLoaded(true);
  }, [projectPath]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const rows = useMemo(() => {
    if (!selectedPo) return [];
    const query = search.trim().toLowerCase();
    return selectedPo.entries.filter((entry) => {
      if (entry.obsolete || !entry.msgid) return false;
      if (untranslatedOnly && entry.msgstr.trim()) return false;
      if (!query) return true;
      return entry.msgid.toLowerCase().includes(query) || entry.msgstr.toLowerCase().includes(query) || (entry.msgctxt || '').toLowerCase().includes(query);
    });
  }, [search, selectedPo, untranslatedOnly]);

  const obsoleteCount = selectedPo ? selectedPo.entries.filter((entry) => entry.obsolete).length : 0;

  const updateMsgstr = (indexInFile: number, msgstr: string) => {
    if (!selected || selected === SOURCE_LANGUAGE) return;
    setPos((current) => {
      const file = current[selected];
      if (!file) return current;
      const entries = file.entries.map((entry, index) => index === indexInFile ? { ...entry, msgstr } : entry);
      return { ...current, [selected]: { ...file, entries } };
    });
    setDirty(true);
  };

  const addLanguage = () => {
    const code = normalizeLanguageCode(addCode);
    if (!code) {
      toast({ title: 'Invalid language code', description: 'Use a code like tr, de, or pt_BR.', variant: 'destructive' });
      return;
    }
    if (code === SOURCE_LANGUAGE || languages.some((language) => language.code === code)) {
      toast({ title: 'Already added', description: `${code} is already in the language list.` });
      return;
    }
    const name = addName.trim() || defaultLanguageName(code);
    setLanguages(ensureSourceLanguage([...languages, { code, name }]));
    setPos((current) => ({
      ...current,
      [code]: current[code] ?? (catalog.length ? mergeCatalogIntoPo(emptyPo(code), catalog) : emptyPo(code)),
    }));
    setSelected(code);
    setDirty(true);
    setAddOpen(false);
    setAddCode('');
    setAddName('');
  };

  const removeLanguage = () => {
    if (!selected || selected === SOURCE_LANGUAGE) return;
    const code = selected;
    setLanguages((current) => current.filter((language) => language.code !== code));
    setPos((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
    setSelected(SOURCE_LANGUAGE);
    setDirty(true);
    setRemoveOpen(false);
  };

  const scan = async () => {
    if (!projectPath || !window.electronAPI?.readDir || !window.electronAPI.readFile) {
      toast({ title: 'No project', description: 'Open a project before scanning strings.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const nextCatalog = await scanProjectStrings(projectRoot(projectPath), {
        readDir: window.electronAPI.readDir,
        readFile: window.electronAPI.readFile,
      });
      setCatalog(nextCatalog);
      setPos((current) => {
        const next: Record<string, PoFile> = {};
        for (const language of languages) {
          if (language.code === SOURCE_LANGUAGE) continue;
          next[language.code] = mergeCatalogIntoPo(current[language.code] ?? emptyPo(language.code), nextCatalog);
        }
        return next;
      });
      setDirty(true);
      toast({ title: 'Scan complete', description: `Found ${nextCatalog.length} source string${nextCatalog.length === 1 ? '' : 's'}. Save to write the catalog and translations.` });
    } catch (error) {
      toast({ title: 'Scan failed', description: error instanceof Error ? error.message : 'Could not scan the project.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!projectPath) {
      toast({ title: 'No project', description: 'Open a project before saving strings.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      let catalogEntries = catalog;
      if (!catalogEntries.length) {
        const seen = new Set<string>();
        catalogEntries = [];
        for (const file of Object.values(pos)) {
          for (const entry of file.entries) {
            if (entry.obsolete || !entry.msgid) continue;
            const key = `${entry.msgctxt ?? ''}\0${entry.msgid}`;
            if (seen.has(key)) continue;
            seen.add(key);
            catalogEntries.push({ msgid: entry.msgid, msgctxt: entry.msgctxt, comments: entry.comments });
          }
        }
      }
      const pot = mergeCatalogIntoPo(emptyPo(), catalogEntries);
      const files = [
        { path: LANGUAGES_TXT_PATH, content: serializeLanguagesTxt(languages) },
        { path: DATA_POT_PATH, content: serializePo(pot) },
      ];
      for (const language of languages) {
        if (language.code === SOURCE_LANGUAGE) continue;
        files.push({
          path: dataPoPath(language.code),
          content: serializePo(pos[language.code] ?? emptyPo(language.code)),
        });
      }
      const saved = await writeProjectFiles(projectPath, files);
      if (!saved) {
        toast({ title: 'Save failed', description: 'Could not write language files.', variant: 'destructive' });
        return;
      }
      setDirty(false);
      toast({
        title: 'Saved',
        description: `Wrote ${LANGUAGES_TXT_PATH}, ${DATA_POT_PATH}${languages.filter((language) => language.code !== SOURCE_LANGUAGE).map((language) => `, ${dataPoPath(language.code)}`).join('')}.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const selectedName = languages.find((language) => language.code === selected)?.name || selected;
  const canRemove = Boolean(selected && selected !== SOURCE_LANGUAGE);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {onBack ? (
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 mb-1 text-xs" onClick={onBack}>Back to UI Settings</Button>
          ) : null}
          <FieldHint hint="English is the source language. Add other languages, scan the project, then translate. Engine UI files (engine.*.po) are not included.">
            <div className="text-sm font-semibold">Localization</div>
          </FieldHint>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)} disabled={!projectPath}>Add language</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setRemoveOpen(true)} disabled={!projectPath || !canRemove}>Remove</Button>
        </div>
      </div>

      {!projectPath ? (
        <p className="text-sm text-muted-foreground">Open a project to edit strings.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-[160px]">
              <Label className="text-[11px] text-muted-foreground font-normal" htmlFor="string-language">Language</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="string-language" className="h-8 w-[200px]">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.name} ({language.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected !== SOURCE_LANGUAGE ? (
              <div className="text-xs text-muted-foreground pb-1.5" aria-label="Translation progress">
                {progress.done}/{progress.total} ({percent}%)
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pb-1.5">Add a language to start translating.</p>
            )}
            <div className="flex-1 min-w-[160px] space-y-1">
              <Label className="text-[11px] text-muted-foreground font-normal" htmlFor="string-search">Search</Label>
              <Input id="string-search" width="full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search source or translation" className="h-8" />
            </div>
            <div className="flex items-center gap-2 pb-1.5">
              <Switch id="string-untranslated" checked={untranslatedOnly} onCheckedChange={(checked) => setUntranslatedOnly(checked === true)} disabled={selected === SOURCE_LANGUAGE} />
              <Label htmlFor="string-untranslated" className="text-xs font-normal">Show untranslated only</Label>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button type="button" size="sm" variant="outline" onClick={() => { void scan(); }} disabled={busy}>Scan project</Button>
              <Button type="button" size="sm" onClick={() => { void save(); }} disabled={busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
            </div>
          </div>

          {selected === SOURCE_LANGUAGE ? (
            <div className="flex-1 min-h-0 rounded-lg border border-border p-3 text-sm text-muted-foreground">
              {loaded && languages.length <= 1
                ? 'No extra languages yet. Use Add language, then Scan project to fill the table.'
                : 'English is the source column. Select another language to edit translations.'}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-background z-[1] border-b border-border">
                  <tr>
                    <th className="text-left font-medium p-2 w-1/2">English</th>
                    <th className="text-left font-medium p-2 w-1/2">{selectedName}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-3 text-muted-foreground">
                        {progress.total === 0
                          ? 'No strings yet. Scan the project to collect source text.'
                          : 'No rows match the current filter.'}
                      </td>
                    </tr>
                  ) : rows.map((entry) => {
                    const indexInFile = selectedPo?.entries.indexOf(entry) ?? -1;
                    return (
                      <tr key={`${entry.msgctxt ?? ''}::${entry.msgid}`} className="border-t border-border align-top">
                        <td className="p-2 whitespace-pre-wrap break-words text-foreground">
                          {entry.msgctxt ? <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">context: {entry.msgctxt}</div> : null}
                          {entry.msgid}
                        </td>
                        <td className="p-2">
                          <Textarea
                            aria-label={`Translation for ${entry.msgid}`}
                            value={entry.msgstr}
                            onChange={(event) => updateMsgstr(indexInFile, event.target.value)}
                            className="min-h-[2.25rem] h-auto w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            rows={Math.min(6, Math.max(1, entry.msgstr.split('\n').length))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {obsoleteCount > 0 ? (
            <p className="text-[11px] text-muted-foreground">{obsoleteCount} obsolete string{obsoleteCount === 1 ? '' : 's'} kept in the file (marked #~), hidden from this table.</p>
          ) : null}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <FieldHint hint="Adds a language to engine/languages.txt. Translations are stored in languages/data.*.po.">
              <DialogTitle>Add language</DialogTitle>
            </FieldHint>
            <DialogDescription className="sr-only">Adds a language to engine/languages.txt. Translations are stored in languages/data.*.po.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="add-lang-code">Code</Label>
            <Input id="add-lang-code" width="short" value={addCode} onChange={(event) => {
              const value = event.target.value;
              setAddCode(value);
              const code = normalizeLanguageCode(value);
              if (code && !addName) setAddName(defaultLanguageName(code));
            }} placeholder="tr" className="h-8" />
            <Label htmlFor="add-lang-name">Display name</Label>
            <Input id="add-lang-name" width="name" value={addName} onChange={(event) => setAddName(event.target.value)} placeholder="Türkçe" className="h-8" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="button" onClick={addLanguage}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <FieldHint hint={`This removes ${selected} from engine/languages.txt. The languages/data.${selected}.po file stays on disk and will be reused if you add the language again. English cannot be removed.`}>
              <DialogTitle>Remove {selectedName}?</DialogTitle>
            </FieldHint>
            <DialogDescription className="sr-only">
              This removes {selected} from engine/languages.txt. The languages/data.{selected}.po file stays on disk and will be reused if you add the language again. English cannot be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={removeLanguage}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StringEditorView;

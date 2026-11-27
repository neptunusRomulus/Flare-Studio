import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { Input } from '@/components/ui/input';
import { askConfirm } from '@/components/ui/inlineConfirmCore';
import { toast } from '@/hooks/use-toast';
import {
  PROCGEN_SETTING_HINTS,
  PROCGEN_SETTING_KEYS,
  PROCGEN_SETTING_LABELS,
  parseProcgenFile,
  visibleSettingKeys,
} from '@/editor/procgenRules';
import { projectRoot } from '@/editor/projectFiles';
import {
  CARD_TYPES,
  DEFAULT_DUNGEON_SETTINGS,
  buildDungeonRulesFile,
  buildHostMapText,
  buildOpeningsMapText,
  buildRoomMapText,
  dungeonPaths,
  dungeonStatus,
  intermapForHost,
  listProcgenMaps,
  nextRoomRelPath,
  parseMapHeader,
  roomLabel,
  roomsForCard,
  roomSizeFromRooms,
  serializeDungeonRules,
  uniqueDungeonSlug,
  type DungeonCardType,
  type DungeonRoom,
  type DungeonStatus,
  type MapStyle,
} from '@/editor/randomDungeon';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';

export type RandomDungeonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string | null;
  flarePath: string | null;
  /** Existing slug, or empty to create one. */
  slug?: string | null;
  defaultName?: string;
  style?: MapStyle;
  onWired?: (info: { slug: string; host: string; intermap: string; title: string }) => void;
  onOpenRoom?: (relPath: string) => Promise<void> | void;
  onTryInGame?: (hostRel: string) => Promise<void> | void;
};

const CARD_META: Record<DungeonCardType, { title: string; hint: string }> = {
  start: { title: 'Entrance room', hint: 'Where the hero starts.' },
  normal: { title: 'Normal rooms', hint: 'Rooms that fill the path between the entrance and the exit.' },
  end: { title: 'Exit room', hint: 'The last room on the path.' },
};

type Fs = {
  readFile: (abs: string) => Promise<string | null>;
  writeFile: (abs: string, content: string) => Promise<boolean>;
  readDir?: (abs: string) => Promise<Array<{ name: string; isDirectory?: boolean }>>;
};

function apiFs(): Fs | null {
  const api = window.electronAPI;
  if (!api?.readFile || !api?.writeFile) return null;
  return {
    readFile: (abs) => api.readFile(abs),
    writeFile: (abs, content) => api.writeFile(abs, content),
    readDir: api.readDir,
  };
}

async function writeRel(fs: Fs, root: string, rel: string, text: string) {
  const ok = await fs.writeFile(`${root}/${rel}`, text);
  if (!ok) throw new Error(`Could not write ${rel}`);
}

async function readRel(fs: Fs, root: string, rel: string): Promise<string> {
  return (await fs.readFile(`${root}/${rel}`).catch(() => '')) || '';
}

function roomsFromRules(
  filenames: string[],
  texts: Record<string, string>,
): DungeonRoom[] {
  return filenames.map((path) => {
    const text = texts[path];
    if (text == null || text === '') {
      return { path, type: '', width: 0, height: 0, title: '', missing: true };
    }
    const header = parseMapHeader(text);
    return {
      path,
      type: header.procgenType,
      width: header.width,
      height: header.height,
      title: header.title,
      missing: false,
    };
  });
}

export default function RandomDungeonDialog({
  open,
  onOpenChange,
  projectPath,
  flarePath,
  slug: slugProp,
  defaultName = 'Dungeon',
  style,
  onWired,
  onOpenRoom,
  onTryInGame,
}: RandomDungeonDialogProps) {
  const [title, setTitle] = useState(defaultName);
  const [slug, setSlug] = useState(slugProp || '');
  const [settings, setSettings] = useState<Record<string, string>>({ ...DEFAULT_DUNGEON_SETTINGS });
  const [rooms, setRooms] = useState<DungeonRoom[]>([]);
  const [openingsPresent, setOpeningsPresent] = useState(false);
  const [pool, setPool] = useState<DungeonRoom[]>([]);
  const [addPath, setAddPath] = useState<Record<DungeonCardType, string>>({ start: '', normal: '', end: '' });
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');

  const paths = slug ? dungeonPaths(slug) : null;
  const listedRooms = useMemo(() => rooms.filter((room) => room.type !== 'links'), [rooms]);
  const status: DungeonStatus = dungeonStatus(listedRooms, openingsPresent);
  const roomSize = roomSizeFromRooms(listedRooms);

  const loadPool = useCallback(async () => {
    const fs = apiFs();
    if (!projectPath || !fs) { setPool([]); return; }
    const listed = await listProcgenMaps({
      projectPath,
      flarePath,
      fs,
      types: [...CARD_TYPES],
    });
    setPool(listed);
  }, [projectPath, flarePath]);

  const persistRules = useCallback(async (nextSlug: string, nextRooms: string[], nextSettings: Record<string, string>) => {
    const fs = apiFs();
    if (!projectPath || !fs) throw new Error('No project');
    const root = projectRoot(projectPath);
    const dest = dungeonPaths(nextSlug);
    const size = roomSizeFromRooms(
      nextRooms.map((path) => rooms.find((room) => room.path === path) || { path, type: '', width: roomSize.width, height: roomSize.height, title: '' }),
    );
    const openingsText = await readRel(fs, root, dest.openings);
    if (!openingsText.trim()) {
      await writeRel(fs, root, dest.openings, buildOpeningsMapText({ width: size.width, height: size.height, style, title: `${title || 'Dungeon'} openings` }));
    }
    const hostText = await readRel(fs, root, dest.host);
    if (!hostText.trim()) {
      await writeRel(fs, root, dest.host, buildHostMapText({
        roomWidth: size.width,
        roomHeight: size.height,
        rulesPath: dest.rules,
        style,
        title: title || 'Dungeon',
      }));
    }
    const file = buildDungeonRulesFile({ settings: nextSettings, rooms: nextRooms.filter((path) => path !== dest.openings), openingsPath: dest.openings });
    await writeRel(fs, root, dest.rules, serializeDungeonRules(file));
  }, [projectPath, rooms, roomSize.width, roomSize.height, style, title]);

  const refreshFromDisk = useCallback(async (nextSlug: string) => {
    const fs = apiFs();
    if (!projectPath || !fs) return;
    const root = projectRoot(projectPath);
    const dest = dungeonPaths(nextSlug);
    const rulesText = await readRel(fs, root, dest.rules);
    const file = rulesText.trim() ? parseProcgenFile(rulesText) : buildDungeonRulesFile({ openingsPath: dest.openings, rooms: [] });
    const names = file.parts
      .filter((part): part is Extract<typeof file.parts[number], { kind: 'chunks' }> => part.kind === 'chunks')
      .flatMap((part) => part.keys.filter((row) => row.key === 'filename').map((row) => row.value.trim()))
      .filter(Boolean);
    const texts: Record<string, string> = {};
    for (const path of names) texts[path] = await readRel(fs, root, path);
    const openingsText = texts[dest.openings] ?? (await readRel(fs, root, dest.openings));
    setOpeningsPresent(Boolean(openingsText.trim()) && names.includes(dest.openings));
    setRooms(roomsFromRules(names, { ...texts, [dest.openings]: openingsText }));
    const settingPart = file.parts.find((part): part is Extract<typeof file.parts[number], { kind: 'settings' }> => part.kind === 'settings');
    if (settingPart) {
      const next = { ...DEFAULT_DUNGEON_SETTINGS };
      for (const row of visibleSettingKeys(settingPart)) {
        if (row.value) next[row.key] = row.value;
      }
      setSettings(next);
    }
    const host = parseMapHeader(await readRel(fs, root, dest.host));
    if (host.title) setTitle(host.title);
  }, [projectPath]);

  const ensureDungeon = useCallback(async (nameForNew?: string) => {
    const fs = apiFs();
    if (!projectPath || !fs) throw new Error('Open a project first.');
    const root = projectRoot(projectPath);
    if (slugProp) {
      setSlug(slugProp);
      await refreshFromDisk(slugProp);
      return slugProp;
    }
    if (slug) {
      await refreshFromDisk(slug);
      return slug;
    }
    const dungeonTitle = nameForNew || title || defaultName || 'Dungeon';
    const existing = ((await fs.readDir?.(`${root}/maps`).catch(() => [])) || [])
      .filter((entry) => !entry.isDirectory && entry.name.toLowerCase().endsWith('.txt'))
      .map((entry) => entry.name.replace(/\.txt$/i, ''));
    const nextSlug = uniqueDungeonSlug(dungeonTitle, existing);
    const dest = dungeonPaths(nextSlug);
    const size = { width: roomSize.width, height: roomSize.height };
    await writeRel(fs, root, dest.openings, buildOpeningsMapText({ ...size, style, title: `${dungeonTitle} openings` }));
    await writeRel(fs, root, dest.host, buildHostMapText({
      roomWidth: size.width,
      roomHeight: size.height,
      rulesPath: dest.rules,
      style,
      title: dungeonTitle,
    }));
    await writeRel(fs, root, dest.rules, serializeDungeonRules(buildDungeonRulesFile({
      settings: DEFAULT_DUNGEON_SETTINGS,
      rooms: [],
      openingsPath: dest.openings,
    })));
    setSlug(nextSlug);
    setOpeningsPresent(true);
    setRooms([]);
    onWired?.({ slug: nextSlug, host: dest.host, intermap: intermapForHost(dest.host), title: dungeonTitle });
    return nextSlug;
  }, [projectPath, slugProp, slug, title, defaultName, roomSize.width, roomSize.height, style, refreshFromDisk, onWired]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setTitle(defaultName);
    setSlug(slugProp || '');
    setSettings({ ...DEFAULT_DUNGEON_SETTINGS });
    setRooms([]);
    setBusy(true);
    void (async () => {
      try {
        await loadPool();
        await ensureDungeon(defaultName);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the dungeon.');
      } finally {
        setBusy(false);
      }
    })();
    // Create once when the dialog opens; later slug updates must not rebuild the files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectPath]);

  const listedPaths = useMemo(() => listedRooms.map((room) => room.path), [listedRooms]);

  const addRoom = async (type: DungeonCardType, path: string, kind: 'draw' | 'existing') => {
    const fs = apiFs();
    if (!projectPath || !fs || !slug) return;
    setBusy(true);
    setError('');
    try {
      const root = projectRoot(projectPath);
      let rel = path;
      if (kind === 'draw') {
        rel = nextRoomRelPath(slug, type, [
          ...listedPaths,
          ...(((await fs.readDir?.(`${root}/maps`).catch(() => [])) || [])
            .filter((entry) => !entry.isDirectory)
            .map((entry) => `maps/${entry.name}`)),
        ]);
        const label = type === 'start' ? 'Entrance' : type === 'end' ? 'Exit' : 'Room';
        await writeRel(fs, root, rel, buildRoomMapText({
          width: roomSize.width,
          height: roomSize.height,
          type,
          style,
          title: `${title || 'Dungeon'} ${label}`.trim(),
        }));
      }
      const next = [...listedPaths, rel];
      await persistRules(slug, next, settings);
      await refreshFromDisk(slug);
      if (kind === 'draw') await onOpenRoom?.(rel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the room.');
    } finally {
      setBusy(false);
    }
  };

  const removeRoom = async (path: string) => {
    if (!slug) return;
    if (!(await askConfirm('Are you sure?'))) return;
    setBusy(true);
    try {
      const next = listedPaths.filter((entry) => entry !== path);
      await persistRules(slug, next, settings);
      await refreshFromDisk(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the room.');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (nextSettings: Record<string, string>) => {
    if (!slug) return;
    setSettings(nextSettings);
    try {
      await persistRules(slug, listedPaths, nextSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    }
  };

  const tryInGame = async () => {
    if (!paths || status !== 'Ready') return;
    setBusy(true);
    try {
      await persistRules(slug, listedPaths, settings);
      await onTryInGame?.(paths.host);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not launch the dungeon.';
      setError(message);
      toast({ title: 'Try in game failed', description: message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const unusedPool = (type: DungeonCardType) =>
    pool.filter((room) => room.type === type && !listedPaths.includes(room.path));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} zIndex={70}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Random dungeon</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <HintLabel className="text-xs font-normal w-12 shrink-0" hint="The name of this dungeon.">Name</HintLabel>
            <Input
              width="path"
              className="h-7 text-xs"
              aria-label="Dungeon name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {CARD_TYPES.map((type) => {
              const meta = CARD_META[type];
              const entries = roomsForCard(listedRooms, type);
              const suggestions = unusedPool(type);
              return (
                <Card key={type} className="shadow-none">
                  <CardHeader className="p-3 pb-2">
                    <FieldHint hint={meta.hint}>
                      <CardTitle className="text-sm font-medium">{meta.title}</CardTitle>
                    </FieldHint>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0">
                    {entries.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">None yet.</p>
                    ) : entries.map((room) => (
                      <div key={room.path} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left text-xs truncate"
                          title={room.path}
                          onClick={() => { void onOpenRoom?.(room.path); }}
                        >
                          <span className={`mr-1.5 inline-block h-2 w-2 rounded-sm align-middle ${type === 'start' ? 'bg-emerald-500' : type === 'end' ? 'bg-red-500' : 'bg-muted-foreground/60'}`} />
                          {roomLabel(room)}
                          {room.missing ? ' (missing)' : ''}
                        </button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={`Remove ${roomLabel(room)}`} onClick={() => { void removeRoom(room.path); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs" disabled={busy} aria-label={`Draw ${type === 'start' ? 'entrance' : type === 'end' ? 'exit' : 'normal'} room`} onClick={() => { void addRoom(type, '', 'draw'); }}>
                      <Plus className="w-3 h-3 mr-1" />Draw room
                    </Button>
                    {suggestions.length ? (
                      <div className="flex items-center gap-1">
                        <Input
                          width="path"
                          className="h-7 text-xs"
                          list={`random-dungeon-${type}`}
                          aria-label={`Add existing ${meta.title}`}
                          placeholder="Add existing…"
                          value={addPath[type]}
                          onChange={(e) => setAddPath((prev) => ({ ...prev, [type]: e.target.value }))}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2"
                          disabled={busy || !addPath[type].trim()}
                          onClick={() => {
                            const path = addPath[type].trim();
                            setAddPath((prev) => ({ ...prev, [type]: '' }));
                            void addRoom(type, path, 'existing');
                          }}
                        >
                          Add
                        </Button>
                        <datalist id={`random-dungeon-${type}`}>
                          {suggestions.map((room) => <option key={room.path} value={room.path} label={roomLabel(room)} />)}
                        </datalist>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className={`text-xs ${status === 'Ready' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {status === 'Ready' ? '✓ Ready' : `⚠ ${status}`}
          </div>
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-1">
                <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                Advanced settings
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1">
              {PROCGEN_SETTING_KEYS.filter((key) => key !== 'doors_max').map((key) => (
                <div key={key} className="flex flex-wrap items-center gap-1">
                  <HintLabel className="text-xs font-normal w-44 shrink-0" hint={PROCGEN_SETTING_HINTS[key]}>{PROCGEN_SETTING_LABELS[key]}</HintLabel>
                  <Input
                    width="num"
                    className="h-7 text-xs"
                    aria-label={PROCGEN_SETTING_LABELS[key]}
                    value={settings[key] ?? ''}
                    onChange={(e) => { void saveSettings({ ...settings, [key]: e.target.value }); }}
                  />
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
              <X className="w-3 h-3 mr-1" />Close
            </Button>
            <FieldHint hint={status === 'Ready' ? 'Write the test save at this dungeon entrance and launch Play.' : status}>
              <Button type="button" size="sm" className="h-7 text-xs" disabled={busy || status !== 'Ready' || !onTryInGame} onClick={() => { void tryInGame(); }}>
                Try in game
              </Button>
            </FieldHint>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

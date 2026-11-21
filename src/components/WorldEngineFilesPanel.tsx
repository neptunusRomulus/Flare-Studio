import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { writeProjectFiles } from '@/editor/projectFiles';
import { loadEngineFileWithFallback } from '@/editor/engineFileFallback';
import type { FieldWidth } from '@/components/ui/fieldWidth';
import { LootSettingsForm } from '@/components/engine/EngineSpecialForms';
import {
  DEATH_PENALTY_KEYS,
  DEATH_PENALTY_PATH,
  DEFAULT_MUSIC_KEYS,
  DEFAULT_MUSIC_PATH,
  GAMEPLAY_KEYS,
  GAMEPLAY_PATH,
  MISC_KEYS,
  MISC_PATH,
  LOOT_PATH,
  parseKeyedValues,
  upsertKeyedValues,
} from '@/editor/worldEngine';
import { useRegisterDirty } from '@/context/SaveHealthContext';

type WorldPane = 'world' | 'gameplay' | 'misc' | 'death' | 'music' | 'loot';

type FieldMeta = { key: string; tip: string; width: FieldWidth };

const GAMEPLAY_FIELDS: FieldMeta[] = [
  { key: 'enable_playgame', tip: 'Enables the Play Game button on the main menu. 0/false disables it.', width: 'short' },
];

const DEATH_FIELDS: FieldMeta[] = [
  { key: 'enable', tip: 'Enable the death penalty.', width: 'short' },
  { key: 'permadeath', tip: 'Force permadeath for all new saves.', width: 'short' },
  { key: 'currency', tip: 'Percentage of currency removed on death.', width: 'num' },
  { key: 'xp_total', tip: 'Percentage of total XP removed on death.', width: 'num' },
  { key: 'xp_current_level', tip: 'Percentage of XP gained since the last level that is removed on death.', width: 'num' },
  { key: 'random_item', tip: 'If true, removes a random item from the player inventory.', width: 'short' },
];

const MUSIC_FIELDS: FieldMeta[] = [
  { key: 'music', tip: 'Music file played during game states that do not already have music (title, config, load game).', width: 'path' },
];

const MISC_FIELDS: FieldMeta[] = [
  { key: 'save_hpmp', tip: 'When saving the game, keep the hero\'s current HP and MP.', width: 'short' },
  { key: 'corpse_timeout', tip: 'How long a corpse stays on the map, in ms or s. 0 keeps corpses indefinitely.', width: 'short' },
  { key: 'sell_without_vendor', tip: 'Allows selling items when not at a vendor via CTRL-Click.', width: 'short' },
  { key: 'aim_assist', tip: 'Pixel offset for powers that use aim_assist.', width: 'num' },
  { key: 'window_title', tip: 'Text in the window title bar.', width: 'name' },
  { key: 'save_prefix', tip: 'Prepended to save filenames to prevent conflicts between mods. Required; Flare warns if it is missing.', width: 'id' },
  { key: 'sound_falloff', tip: 'Maximum radius in tiles that a single sound is audible.', width: 'num' },
  { key: 'party_exp_percentage', tip: 'Percentage of XP given to allies.', width: 'num' },
  { key: 'enable_ally_collision', tip: 'Allows allies to block the player\'s path.', width: 'short' },
  { key: 'enable_ally_collision_ai', tip: 'Allows allies to block the path of other AI creatures.', width: 'short' },
  { key: 'currency_id', tip: 'Item id used as currency.', width: 'num' },
  { key: 'interact_range', tip: 'Distance at which the player can interact with objects and NPCs.', width: 'num' },
  { key: 'menus_pause', tip: 'Opening any menu pauses the game.', width: 'short' },
  { key: 'save_onload', tip: 'Save the game when changing maps.', width: 'short' },
  { key: 'save_onexit', tip: 'Save the game when quitting to the title screen or desktop.', width: 'short' },
  { key: 'save_pos_onexit', tip: 'If the game is saved on exit, store the current position instead of the map spawn.', width: 'short' },
  { key: 'save_oncutscene', tip: 'Save the game when an Event triggers a cutscene.', width: 'short' },
  { key: 'save_onstash', tip: 'Save when a stash changes. true (default), false, private, or shared. false or private can allow item duplication on shared stashes.', width: 'short' },
  { key: 'save_anywhere', tip: 'Adds a save button in the pause menu.', width: 'short' },
  { key: 'camera_speed', tip: 'How fast the camera recenters on the player. Larger is slower. Default 10.', width: 'num' },
  { key: 'save_buyback', tip: 'Save vendor buyback stock whenever the game is saved.', width: 'short' },
  { key: 'keep_buyback_on_map_change', tip: 'If true, NPC buyback stocks persist when the map changes. If false, save_buyback is disabled.', width: 'short' },
  { key: 'sfx_unable_to_cast', tip: 'Sound played when the player lacks the MP to cast a power.', width: 'path' },
  { key: 'combat_aborts_npc_interact', tip: 'If true, NPC dialog and vendor menus close when the player is attacked.', width: 'short' },
  { key: 'fogofwar', tip: 'Engine default fog of war type: 0 disabled, 1 minimap, 2 tint, 3 overlay. A map header can override this.', width: 'num' },
  { key: 'save_fogofwar', tip: 'If true, the fog of war layer keeps exploration progress. A map header can override this.', width: 'short' },
  { key: 'mouse_move_enabled', tip: 'Enables the Move hero using mouse input option. Defaults to true.', width: 'short' },
  { key: 'mouse_move_deadzone', tip: 'Deadzone circle around the player: moving,not-moving. Defaults 0.25,0.75.', width: 'short' },
  { key: 'passive_trigger_effect_stacking', tip: 'Backwards compatibility. Allows stacking the same effect from a power with the same passive trigger. False by default.', width: 'short' },
  { key: 'fade_wall_alpha', tip: 'Minimum opacity (0-255) walls fade to when covering the player. 255 disables fading.', width: 'num' },
  { key: 'raycast_resolution', tip: 'Step size for line-of-sight tests. Smaller is more accurate and slower. Default 0.1.', width: 'num' },
  { key: 'min_fps', tip: 'Minimum frame limit offered in Video options. 0 ignores this property.', width: 'num' },
];

function KeyedFields({
  text, keys, fields, onChange,
}: {
  text: string;
  keys: readonly string[];
  fields: FieldMeta[];
  onChange: (text: string) => void;
}) {
  const values = parseKeyedValues(text, keys);
  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-wrap items-center gap-2">
          <HintLabel className="text-xs font-normal w-52 shrink-0" hint={field.tip}>{field.key}</HintLabel>
          <Input
            aria-label={field.key}
            width={field.width}
            className="h-7 text-xs"
            value={values[field.key] ?? ''}
            onChange={(event) => onChange(upsertKeyedValues(text, keys, { [field.key]: event.target.value }))}
          />
        </div>
      ))}
    </div>
  );
}

/** Engine gameplay files that belong on the World Settings card. Cutscenes, parallax, FOW and procgen stay in StudioWorldPanel. */
export default function WorldEngineFilesPanel({ worldEditors }: { worldEditors: ReactNode }) {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [pane, setPane] = useState<WorldPane>('world');
  const [gameplayText, setGameplayText] = useState('');
  const [miscText, setMiscText] = useState('');
  const [deathText, setDeathText] = useState('');
  const [musicText, setMusicText] = useState('');
  const [lootText, setLootText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const skipDiskLoadRef = useRef(false);

  const mark = (write: (value: string) => void) => (next: string) => { write(next); setDirty(true); };

  const loadAll = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.readFile) {
      setGameplayText('');
      setMiscText('');
      setDeathText('');
      setMusicText('');
      setLootText('');
      setDirty(false);
      return;
    }
    const fs = { readFile: window.electronAPI.readFile };
    const flarePath = getStoredFlarePath();
    const [gameplay, misc, death, music, loot] = await Promise.all([
      loadEngineFileWithFallback({ projectPath, relative: GAMEPLAY_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: MISC_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: DEATH_PENALTY_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: DEFAULT_MUSIC_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: LOOT_PATH, flarePath, fs }),
    ]);
    if (skipDiskLoadRef.current) return;
    setGameplayText(gameplay.text);
    setMiscText(misc.text);
    setDeathText(death.text);
    setMusicText(music.text);
    setLootText(loot.text);
    setDirty(false);
  }, [projectPath]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const save = async () => {
    if (!projectPath) {
      toast({ title: 'No project', description: 'Open a project before saving world engine files.', variant: 'destructive' });
      return;
    }
    const files = [
      gameplayText.trim() ? { path: GAMEPLAY_PATH, content: gameplayText.endsWith('\n') ? gameplayText : `${gameplayText}\n` } : null,
      miscText.trim() ? { path: MISC_PATH, content: miscText.endsWith('\n') ? miscText : `${miscText}\n` } : null,
      deathText.trim() ? { path: DEATH_PENALTY_PATH, content: deathText.endsWith('\n') ? deathText : `${deathText}\n` } : null,
      musicText.trim() ? { path: DEFAULT_MUSIC_PATH, content: musicText.endsWith('\n') ? musicText : `${musicText}\n` } : null,
      lootText.trim() ? { path: LOOT_PATH, content: lootText.endsWith('\n') ? lootText : `${lootText}\n` } : null,
    ].filter(Boolean) as Array<{ path: string; content: string }>;
    if (!files.length) {
      toast({ title: 'Nothing to write', description: 'No world engine files were loaded.' });
      return;
    }
    setBusy(true);
    try {
      const saved = await writeProjectFiles(projectPath, files);
      if (!saved) {
        toast({ title: 'Save failed', description: 'Could not write the world engine files.', variant: 'destructive' });
        return;
      }
      setDirty(false);
      toast({ title: 'Saved', description: `Wrote ${files.map((file) => file.path).join(', ')}.` });
    } finally {
      setBusy(false);
    }
  };

  const draftFiles = useMemo(() => ([
    gameplayText.trim() ? { path: GAMEPLAY_PATH, content: gameplayText.endsWith('\n') ? gameplayText : `${gameplayText}\n` } : null,
    miscText.trim() ? { path: MISC_PATH, content: miscText.endsWith('\n') ? miscText : `${miscText}\n` } : null,
    deathText.trim() ? { path: DEATH_PENALTY_PATH, content: deathText.endsWith('\n') ? deathText : `${deathText}\n` } : null,
    musicText.trim() ? { path: DEFAULT_MUSIC_PATH, content: musicText.endsWith('\n') ? musicText : `${musicText}\n` } : null,
    lootText.trim() ? { path: LOOT_PATH, content: lootText.endsWith('\n') ? lootText : `${lootText}\n` } : null,
  ].filter(Boolean) as Array<{ path: string; content: string }>), [gameplayText, miscText, deathText, musicText, lootText]);
  const applyWorldDrafts = (incoming: Array<{ path: string; content: string }>) => {
    skipDiskLoadRef.current = true;
    const setters: Record<string, (value: string) => void> = {
      [GAMEPLAY_PATH]: setGameplayText,
      [MISC_PATH]: setMiscText,
      [DEATH_PENALTY_PATH]: setDeathText,
      [DEFAULT_MUSIC_PATH]: setMusicText,
      [LOOT_PATH]: setLootText,
    };
    let any = false;
    for (const file of incoming) {
      const set = setters[file.path.replace(/\\/g, '/')];
      if (!set) continue;
      set(file.content);
      any = true;
    }
    if (any) setDirty(true);
  };
  useRegisterDirty('world-engine-files', dirty, save, dirty ? draftFiles : [], applyWorldDrafts);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {([
            { id: 'world', label: 'World' },
            { id: 'gameplay', label: 'Gameplay' },
            { id: 'misc', label: 'Misc' },
            { id: 'death', label: 'Death penalty' },
            { id: 'music', label: 'Music' },
            { id: 'loot', label: 'Loot' },
          ] as const).map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={pane === item.id ? 'default' : 'outline'}
              aria-pressed={pane === item.id}
              className={pane === item.id ? 'h-7 bg-orange-600 text-white hover:bg-orange-600 hover:text-white' : 'h-7'}
              onClick={() => setPane(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {pane !== 'world' ? (
          <Button type="button" size="sm" onClick={() => { void save(); }} disabled={!projectPath || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
        ) : null}
      </div>

      {!projectPath && pane !== 'world' ? (
        <p className="text-sm text-muted-foreground">Open a project to edit world engine files.</p>
      ) : pane === 'world' ? worldEditors
        : pane === 'gameplay' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/gameplay.txt. Empty keys are not written.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gameplay</div>
            </FieldHint>
            <KeyedFields text={gameplayText} keys={GAMEPLAY_KEYS} fields={GAMEPLAY_FIELDS} onChange={mark(setGameplayText)} />
          </div>
        ) : pane === 'misc' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/misc.txt. Empty keys are not written; commented defaults stay commented until you set a value. Unknown keys are kept. fogofwar and save_fogofwar here are the engine defaults; a map header can override them.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Miscellaneous</div>
            </FieldHint>
            <KeyedFields text={miscText} keys={MISC_KEYS} fields={MISC_FIELDS} onChange={mark(setMiscText)} />
          </div>
        ) : pane === 'death' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/death_penalty.txt. Percent fields are percentages of currency or XP removed on death.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Death penalty</div>
            </FieldHint>
            <KeyedFields text={deathText} keys={DEATH_PENALTY_KEYS} fields={DEATH_FIELDS} onChange={mark(setDeathText)} />
          </div>
        ) : pane === 'music' ? (
          <div className="space-y-2">
            <FieldHint hint="engine/default_music.txt. Leave music empty to omit the key.">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default music</div>
            </FieldHint>
            <KeyedFields text={musicText} keys={DEFAULT_MUSIC_KEYS} fields={MUSIC_FIELDS} onChange={mark(setMusicText)} />
          </div>
        ) : (
          <LootSettingsForm text={lootText} onChange={(next) => mark(setLootText)(next)} />
        )}
    </div>
  );
}

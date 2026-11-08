import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import AnimationPreview from '@/components/AnimationPreview';
import { ChevronDown, ChevronUp, HandCoins, HelpCircle, MessagesSquare, MessageCircleQuestionMark } from 'lucide-react';
import type { MapObject } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { ItemSummary } from '@/utils/items';
import NameField from '@/components/NameField';
import PositionField from '@/components/PositionField';
import DirectionField from '@/components/DirectionField';
import MinimapToggle from '@/components/MinimapToggle';
import NpcAdvancedSection, { countStatsAndEffects } from '@/components/NpcAdvancedSection';
import NpcAdvancedSubSection from '@/components/NpcAdvancedSubSection';
import NpcAppearanceSection from '@/components/NpcAppearanceSection';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import NpcSpawnConditions, { countSpawnConditionGroups } from '@/components/NpcSpawnConditions';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { isAnimationDefinitionFilePath, isImageFilePath } from '@/utils/animationUtils';

export type NpcEditDialogProps = {
  editingObject: MapObject;
  setEditingObject: (obj: MapObject) => void;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
  updateEditingObjectBoolean: (key: string, checked: boolean) => void;
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  editor?: TileMapEditor | null;
  canUseTilesetDialog: boolean;
  handleEditingTilesetBrowse: () => Promise<void> | void;
  handleEditingPortraitBrowse: () => Promise<void> | void;
  handleAutoDetectAnim: () => Promise<void> | void;
  handleOpenVendorSettingsDialog: () => void;
  handleOpenQuestSettingsDialog: () => void;
  setShowDialogueTreeDialog: (v: boolean) => void;
  itemsList: ItemSummary[];
};

const ANIM_BASIC_KEYS = [
  'anim_render_width',
  'anim_render_height',
  'anim_render_offset_x',
  'anim_render_offset_y',
  'anim_frames',
  'anim_duration',
  'anim_type',
] as const;

const ANIM_MORE_KEYS = ['anim_blend_mode', 'anim_alpha_mod', 'anim_color_mod'] as const;

const isAnimDefault = (key: string, value: string) => {
  if (!value) return true;
  if (key === 'anim_type') return value === 'looped';
  if (key === 'anim_blend_mode') return value === 'normal';
  if (key === 'anim_alpha_mod') return value === '255';
  if (key === 'anim_color_mod') return value === '255,255,255';
  return false;
};

const isCustomTilesetAppearance = (tilesetPath: string, tilesetSourcePath: string) =>
  Boolean(tilesetSourcePath) || (Boolean(tilesetPath) && isImageFilePath(tilesetPath));

const countAnimChanges = (get: (key: string, fallback?: string) => string, custom: boolean) => {
  if (!custom) return 0;
  let n = 0;
  for (const key of [...ANIM_BASIC_KEYS, ...ANIM_MORE_KEYS]) {
    const value = get(key, '');
    if (!isAnimDefault(key, value) && value) n += 1;
  }
  return n;
};

const countOtherChanges = (_properties: Record<string, unknown> | undefined, get: (key: string, fallback?: string) => string) => {
  let n = 0;
  if (get('show_on_minimap', 'true') === 'false') n += 1;
  return n;
};

const countAdvancedChanges = (
  properties: Record<string, unknown> | undefined,
  get: (key: string, fallback?: string) => string,
) => {
  const custom = isCustomTilesetAppearance(get('tilesetPath', ''), get('tilesetSourcePath', ''));
  return (
    countAnimChanges(get, custom)
    + countSpawnConditionGroups(properties)
    + (get('vox_intro', '').trim() ? 1 : 0)
    + countStatsAndEffects(get)
    + countOtherChanges(properties, get)
  );
};

const appearanceFileLabel = (tilesetPath: string) => {
  const cleaned = tilesetPath.replace(/\\/g, '/');
  return cleaned.split('/').pop() || cleaned || 'appearance';
};

const NpcEditDialog = ({
  editingObject,
  setEditingObject,
  updateEditingObjectProperty,
  updateEditingObjectBoolean,
  getEditingObjectProperty,
  editor,
  canUseTilesetDialog,
  handleEditingTilesetBrowse,
  handleEditingPortraitBrowse,
  handleAutoDetectAnim,
  handleOpenVendorSettingsDialog,
  handleOpenQuestSettingsDialog,
  setShowDialogueTreeDialog,
}: NpcEditDialogProps) => {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [animMoreOpen, setAnimMoreOpen] = useState(false);
  const [previewSpritePath, setPreviewSpritePath] = useState<string | null>(null);
  const [previewPortraitPath, setPreviewPortraitPath] = useState<string | null>(null);

  const isTalker = editingObject?.properties?.talker === 'true';
  const isVendor = editingObject?.properties?.vendor === 'true';
  const isQuestGiver = editingObject?.properties?.questGiver === 'true';
  const advancedChanged = countAdvancedChanges(editingObject.properties, getEditingObjectProperty);
  const tilesetPath = getEditingObjectProperty('tilesetPath', '');
  const templateImage = getEditingObjectProperty('templateImage', '');
  const tilesetSourcePath = getEditingObjectProperty('tilesetSourcePath', '');
  const portraitPath = getEditingObjectProperty('portraitPath', '');
  const projectPath = editor?.getCurrentProjectPath() ?? null;
  const customTileset = isCustomTilesetAppearance(tilesetPath, tilesetSourcePath);
  const showAnimPreview = Boolean(customTileset && getEditingObjectProperty('anim_render_width', ''));
  const animChanged = countAnimChanges(getEditingObjectProperty, customTileset);
  const spawnChanged = countSpawnConditionGroups(editingObject.properties);
  const audioChanged = getEditingObjectProperty('vox_intro', '').trim() ? 1 : 0;
  const statsChanged = countStatsAndEffects(getEditingObjectProperty);
  const otherChanged = countOtherChanges(editingObject.properties, getEditingObjectProperty);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const api = window.electronAPI;
      const root = projectPath?.replace(/\\/g, '/').replace(/\/$/, '') || '';
      let sprite: string | null = null;
      if (tilesetSourcePath) sprite = tilesetSourcePath;
      else if (tilesetPath && isImageFilePath(tilesetPath)) {
        sprite = /^([a-zA-Z]:|\/)/.test(tilesetPath) ? tilesetPath : (root ? `${root}/${tilesetPath}` : tilesetPath);
      } else if (templateImage) {
        const flarePath = getStoredFlarePath();
        if (flarePath && api?.listTemplateActors) {
          try {
            const listing = await api.listTemplateActors(flarePath);
            const match = listing.npcLooks?.find((l) => l.animation === tilesetPath || l.image === templateImage);
            sprite = match?.imagePath || (listing.modDir && templateImage ? `${listing.modDir.replace(/\\/g, '/')}/${templateImage}` : null);
          } catch {
            sprite = null;
          }
        }
      } else if (tilesetPath && isAnimationDefinitionFilePath(tilesetPath) && api?.listTemplateActors) {
        const flarePath = getStoredFlarePath();
        if (flarePath) {
          try {
            const listing = await api.listTemplateActors(flarePath);
            sprite = listing.npcLooks?.find((l) => l.animation === tilesetPath)?.imagePath || null;
          } catch {
            sprite = null;
          }
        }
      }

      let portrait: string | null = null;
      if (portraitPath.startsWith('data:')) portrait = portraitPath;
      else if (portraitPath && /^([a-zA-Z]:|\/)/.test(portraitPath)) portrait = portraitPath;
      else if (portraitPath) {
        if (root && api?.fileExists && await api.fileExists(`${root}/${portraitPath}`)) portrait = `${root}/${portraitPath}`;
        else {
          const flarePath = getStoredFlarePath();
          if (flarePath && api?.listTemplateActors) {
            try {
              const listing = await api.listTemplateActors(flarePath);
              portrait = listing.portraits?.find((p) => p.path === portraitPath)?.imagePath
                || (listing.modDir ? `${listing.modDir.replace(/\\/g, '/')}/${portraitPath}` : null);
            } catch {
              portrait = null;
            }
          }
        }
      }

      if (!cancelled) {
        setPreviewSpritePath(sprite);
        setPreviewPortraitPath(portrait);
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [tilesetPath, templateImage, tilesetSourcePath, portraitPath, projectPath]);

  const setPositionX = (newX: number) => {
    if (editor) {
      const conflict = editor.getMapObjects().find(
        (o) => o.type === 'npc' && o.id !== editingObject.id && o.x === newX && o.y === editingObject.y,
      );
      if (conflict) return;
    }
    setEditingObject({ ...editingObject, x: newX });
  };

  const setPositionY = (newY: number) => {
    if (editor) {
      const conflict = editor.getMapObjects().find(
        (o) => o.type === 'npc' && o.id !== editingObject.id && o.x === editingObject.x && o.y === newY,
      );
      if (conflict) return;
    }
    setEditingObject({ ...editingObject, y: newY });
  };

  const applyPropertyBag = (props: Record<string, string | null>) => {
    setEditingObject({
      ...editingObject,
      properties: (() => {
        const next = { ...(editingObject.properties || {}) };
        for (const [key, value] of Object.entries(props)) {
          if (value === null) delete next[key];
          else next[key] = value;
        }
        return next;
      })(),
    });
  };

  const hasAnyRole = isTalker || isVendor || isQuestGiver;

  const toggleRole = (key: 'talker' | 'vendor' | 'questGiver') => {
    const newProps = { ...(editingObject.properties || {}) };
    if (newProps[key] === 'true') delete newProps[key];
    else newProps[key] = 'true';
    setEditingObject({ ...editingObject, properties: newProps });
  };

  const roleCardClass = (active: boolean, activeTone: string) =>
    `flex flex-col items-stretch rounded-md border p-2.5 text-left transition-colors min-h-[4.5rem] ${
      active
        ? `${activeTone} border-current/40`
        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
    }`;

  return (
    <>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Who</h4>
        <div className="flex gap-3 items-start border border-border rounded-md p-3 bg-muted/20">
          <div className="shrink-0">
            {showAnimPreview ? (
              <AnimationPreview
                tilesetPath={tilesetSourcePath || tilesetPath}
                direction={parseInt(getEditingObjectProperty('direction', '0'), 10) || 0}
                properties={{
                  anim_render_width: getEditingObjectProperty('anim_render_width', ''),
                  anim_render_height: getEditingObjectProperty('anim_render_height', ''),
                  anim_render_offset_x: getEditingObjectProperty('anim_render_offset_x', ''),
                  anim_render_offset_y: getEditingObjectProperty('anim_render_offset_y', ''),
                  anim_frames: getEditingObjectProperty('anim_frames', ''),
                  anim_duration: getEditingObjectProperty('anim_duration', ''),
                  anim_type: getEditingObjectProperty('anim_type', ''),
                  anim_blend_mode: getEditingObjectProperty('anim_blend_mode', ''),
                  anim_alpha_mod: getEditingObjectProperty('anim_alpha_mod', ''),
                  anim_color_mod: getEditingObjectProperty('anim_color_mod', ''),
                  anim_image_width: getEditingObjectProperty('anim_image_width', ''),
                  anim_image_height: getEditingObjectProperty('anim_image_height', ''),
                }}
              />
            ) : (
              <NpcAssetThumb imagePath={previewSpritePath} alt="Sprite" className="h-20 w-20" />
            )}
          </div>
          <NpcAssetThumb imagePath={previewPortraitPath || (portraitPath.startsWith('data:') ? portraitPath : null)} alt="Portrait" className="h-20 w-20 shrink-0" />
          <div className="flex-1 min-w-0">
            <NameField
              value={editingObject.name || ''}
              onChange={(value) => setEditingObject({ ...editingObject, name: value })}
              placeholder="NPC name"
            />
          </div>
        </div>

        <NpcAppearanceSection
          projectPath={projectPath}
          selectedAnimation={tilesetPath}
          selectedPortrait={portraitPath}
          stanceDirection={getEditingObjectProperty('direction', '')}
          canUseTilesetDialog={canUseTilesetDialog}
          hasTilesetPath={Boolean(tilesetPath)}
          onSelectLook={applyPropertyBag}
          onSelectPortrait={applyPropertyBag}
          onStanceChange={(value) => updateEditingObjectProperty('direction', value)}
          onImportTileset={() => { void handleEditingTilesetBrowse(); }}
          onAutoDetect={() => { void handleAutoDetectAnim(); }}
          onBrowsePortrait={() => { void handleEditingPortraitBrowse(); }}
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-1">
          <h4 className="text-sm font-semibold">What it does</h4>
          <Tooltip content="Turning a role off hides its editor but keeps the data. Turn it back on to edit again.">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </Tooltip>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="min-h-[6.25rem] flex flex-col">
            <Tooltip content="talker — Player can talk to this NPC. Turning off keeps dialogue data.">
              <button type="button" onClick={() => toggleRole('talker')} className={roleCardClass(isTalker, 'bg-blue-500/15 text-blue-600 dark:text-blue-400')}>
                <MessagesSquare className="w-5 h-5 mb-1" />
                <span className="text-sm font-semibold">Talks</span>
              </button>
            </Tooltip>
            <div className="h-8 mt-1.5 flex items-center">
              {isTalker && (
                <button
                  type="button"
                  onClick={() => setShowDialogueTreeDialog(true)}
                  className="h-7 w-full px-2 text-xs rounded-md border border-border bg-background hover:bg-muted"
                >
                  Edit what they say
                </button>
              )}
            </div>
          </div>

          <div className="min-h-[6.25rem] flex flex-col">
            <Tooltip content="vendor — Player can buy and sell here. Turning off keeps stock and prices.">
              <button type="button" onClick={() => toggleRole('vendor')} className={roleCardClass(isVendor, 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')}>
                <HandCoins className="w-5 h-5 mb-1" />
                <span className="text-sm font-semibold">Sells</span>
              </button>
            </Tooltip>
            <div className="h-8 mt-1.5 flex items-center">
              {isVendor && (
                <button
                  type="button"
                  onClick={() => handleOpenVendorSettingsDialog()}
                  className="h-7 w-full px-2 text-xs rounded-md border border-border bg-background hover:bg-muted"
                >
                  Edit what they sell
                </button>
              )}
            </div>
          </div>

          <div className="min-h-[6.25rem] flex flex-col">
            <Tooltip content="questGiver — Player can get quests here. Turning off keeps quest settings.">
              <button type="button" onClick={() => toggleRole('questGiver')} className={roleCardClass(isQuestGiver, 'bg-amber-500/15 text-amber-600 dark:text-amber-400')}>
                <MessageCircleQuestionMark className="w-5 h-5 mb-1" />
                <span className="text-sm font-semibold">Gives quests</span>
              </button>
            </Tooltip>
            <div className="h-8 mt-1.5 flex items-center">
              {isQuestGiver && (
                <button
                  type="button"
                  onClick={() => handleOpenQuestSettingsDialog()}
                  className="h-7 w-full px-2 text-xs rounded-md border border-border bg-background hover:bg-muted"
                >
                  Edit quests
                </button>
              )}
            </div>
          </div>
        </div>
        {!hasAnyRole && (
          <p className="text-xs text-muted-foreground/70">Just stands there</p>
        )}
      </section>

      <section className="space-y-2 border border-border rounded-md p-3 bg-muted/20">
        <h4 className="text-sm font-semibold">Where on the map</h4>
        <div className="flex flex-wrap gap-6 items-start">
          <div className="w-28">
            <PositionField x={editingObject.x} y={editingObject.y} onChangeX={setPositionX} onChangeY={setPositionY} />
          </div>
          <DirectionField
            value={getEditingObjectProperty('spawn_direction', '')}
            onChange={(value) => updateEditingObjectProperty('spawn_direction', value)}
            label="Facing on map"
            tooltip="spawn_direction — Which way they face when they appear"
          />
        </div>
      </section>

      <div className="border border-border rounded-md bg-muted/20">
        <button
          type="button"
          onClick={() => setAdvancedExpanded(!advancedExpanded)}
          className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
        >
          {advancedExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          <span>
            Advanced
            {!advancedExpanded && advancedChanged > 0 ? ` · ${advancedChanged} changed` : ''}
          </span>
        </button>
        {advancedExpanded && (
          <div className="space-y-2 px-3 pb-3">
            <NpcAdvancedSubSection title="Animation" changedCount={animChanged}>
              {!customTileset ? (
                <Tooltip content="Values come from the selected appearance">
                  <p className="text-xs text-muted-foreground truncate">
                    {tilesetPath ? appearanceFileLabel(tilesetPath) : 'No appearance selected'}
                  </p>
                </Tooltip>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tooltip content="anim_render_width × anim_render_height">
                      <label className="text-[10px] text-muted-foreground w-16 shrink-0">Frame size</label>
                    </Tooltip>
                    <Input
                      type="number"
                      value={getEditingObjectProperty('anim_render_width', '')}
                      onChange={(e) => updateEditingObjectProperty('anim_render_width', e.target.value || null)}
                      className="h-6 w-14 px-1 text-center text-xs"
                      min={1}
                    />
                    <span className="text-muted-foreground text-xs">×</span>
                    <Input
                      type="number"
                      value={getEditingObjectProperty('anim_render_height', '')}
                      onChange={(e) => updateEditingObjectProperty('anim_render_height', e.target.value || null)}
                      className="h-6 w-14 px-1 text-center text-xs"
                      min={1}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip content="anim_render_offset_x, anim_render_offset_y">
                      <label className="text-[10px] text-muted-foreground w-16 shrink-0">Offset</label>
                    </Tooltip>
                    <Input
                      type="number"
                      value={getEditingObjectProperty('anim_render_offset_x', '')}
                      onChange={(e) => updateEditingObjectProperty('anim_render_offset_x', e.target.value || null)}
                      className="h-6 w-14 px-1 text-center text-xs"
                    />
                    <span className="text-muted-foreground text-xs">,</span>
                    <Input
                      type="number"
                      value={getEditingObjectProperty('anim_render_offset_y', '')}
                      onChange={(e) => updateEditingObjectProperty('anim_render_offset_y', e.target.value || null)}
                      className="h-6 w-14 px-1 text-center text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip content="anim_frames">
                      <label className="text-[10px] text-muted-foreground w-16 shrink-0">Frames</label>
                    </Tooltip>
                    <Input
                      type="number"
                      value={getEditingObjectProperty('anim_frames', '')}
                      onChange={(e) => updateEditingObjectProperty('anim_frames', e.target.value || null)}
                      className="h-6 w-14 px-1 text-center text-xs"
                      min={1}
                    />
                    <Tooltip content="anim_duration">
                      <label className="text-[10px] text-muted-foreground shrink-0">Duration</label>
                    </Tooltip>
                    <Input
                      type="text"
                      value={getEditingObjectProperty('anim_duration', '')}
                      onChange={(e) => updateEditingObjectProperty('anim_duration', e.target.value || null)}
                      className="h-6 w-20 px-1 text-center text-xs"
                      placeholder="1200ms"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip content="anim_type">
                      <label className="text-[10px] text-muted-foreground w-16 shrink-0">Type</label>
                    </Tooltip>
                    <Select
                      value={getEditingObjectProperty('anim_type', 'looped')}
                      onValueChange={(value) => updateEditingObjectProperty('anim_type', value)}
                    >
                      <SelectTrigger className="h-6 px-1 text-xs rounded border border-border bg-background w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="looped">Looped</SelectItem>
                        <SelectItem value="play_once">Play once</SelectItem>
                        <SelectItem value="back_forth">Back and forth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded border border-border/60">
                    <button
                      type="button"
                      className="w-full px-2 py-1 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/40 text-left"
                      onClick={() => setAnimMoreOpen((v) => !v)}
                    >
                      {animMoreOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      More
                    </button>
                    {animMoreOpen && (
                      <div className="space-y-2 px-2 pb-2">
                        <div className="flex items-center gap-2">
                          <Tooltip content="anim_blend_mode">
                            <label className="text-[10px] text-muted-foreground w-16 shrink-0">Blend</label>
                          </Tooltip>
                          <Select
                            value={getEditingObjectProperty('anim_blend_mode', 'normal')}
                            onValueChange={(value) => updateEditingObjectProperty('anim_blend_mode', value)}
                          >
                            <SelectTrigger className="h-6 px-1 text-xs rounded border border-border bg-background w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="add">Add</SelectItem>
                            </SelectContent>
                          </Select>
                          <Tooltip content="anim_alpha_mod">
                            <label className="text-[10px] text-muted-foreground shrink-0">Alpha</label>
                          </Tooltip>
                          <Input
                            type="number"
                            value={getEditingObjectProperty('anim_alpha_mod', '')}
                            onChange={(e) => updateEditingObjectProperty('anim_alpha_mod', e.target.value || null)}
                            className="h-6 w-14 px-1 text-center text-xs"
                            min={0}
                            max={255}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Tooltip content="anim_color_mod">
                            <label className="text-[10px] text-muted-foreground w-16 shrink-0">Color mod</label>
                          </Tooltip>
                          <Input
                            type="text"
                            value={getEditingObjectProperty('anim_color_mod', '')}
                            onChange={(e) => updateEditingObjectProperty('anim_color_mod', e.target.value || null)}
                            className="h-6 w-24 px-1 text-center text-xs"
                            placeholder="255,255,255"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </NpcAdvancedSubSection>

            <NpcAdvancedSubSection title="Spawn conditions" changedCount={spawnChanged}>
              <NpcSpawnConditions
                properties={editingObject.properties}
                get={getEditingObjectProperty}
                setProp={updateEditingObjectProperty}
              />
            </NpcAdvancedSubSection>

            <NpcAdvancedSubSection title="Audio" changedCount={audioChanged}>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs text-muted-foreground">Intro voice</label>
                <Tooltip content="vox_intro — Sound file to play when initially interacting with the NPC.">
                  <HelpCircle className="w-3 h-3 text-muted-foreground" />
                </Tooltip>
              </div>
              <Input
                className="h-7 text-xs"
                value={getEditingObjectProperty('vox_intro', '')}
                onChange={(e) => updateEditingObjectProperty('vox_intro', e.target.value)}
                placeholder="sound_file.ogg"
              />
            </NpcAdvancedSubSection>

            <NpcAdvancedSubSection title="Stats & Effects" changedCount={statsChanged}>
              <NpcAdvancedSection
                embedded
                forceExpanded
                npcFilename={getEditingObjectProperty('npcFilename', '')}
                projectPath={projectPath}
                getEditingObjectProperty={getEditingObjectProperty}
                updateEditingObjectProperty={updateEditingObjectProperty}
              />
            </NpcAdvancedSubSection>

            <NpcAdvancedSubSection title="Other" changedCount={otherChanged}>
              <MinimapToggle
                checked={getEditingObjectProperty('show_on_minimap', 'true') === 'true'}
                onChange={(checked) => updateEditingObjectBoolean('show_on_minimap', checked)}
              />
            </NpcAdvancedSubSection>
          </div>
        )}
      </div>
    </>
  );
};

export default NpcEditDialog;

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
import SpawnFieldOverlay from '@/components/SpawnFieldOverlay';
import NpcAdvancedSection from '@/components/NpcAdvancedSection';
import NpcAppearanceSection from '@/components/NpcAppearanceSection';
import NpcAssetThumb from '@/components/NpcAssetThumb';
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

const ANIM_TECH_KEYS = [
  'anim_render_width',
  'anim_render_height',
  'anim_render_offset_x',
  'anim_render_offset_y',
  'anim_frames',
  'anim_duration',
  'anim_type',
  'anim_blend_mode',
  'anim_alpha_mod',
  'anim_color_mod',
] as const;

const SPAWN_KEYS = [
  'requires_status',
  'requires_not_status',
  'requires_level',
  'requires_not_level',
  'requires_currency',
  'requires_not_currency',
  'requires_item',
  'requires_item_quantity',
  'requires_not_item',
  'requires_not_item_quantity',
  'requires_class',
  'requires_not_class',
  'spawn_direction',
] as const;

const isAnimDefault = (key: string, value: string) => {
  if (!value) return true;
  if (key === 'anim_type') return value === 'looped';
  if (key === 'anim_blend_mode') return value === 'normal';
  return false;
};

const countAdvancedChanges = (
  properties: Record<string, unknown> | undefined,
  get: (key: string, fallback?: string) => string,
) => {
  let count = 0;
  let animChanged = false;
  for (const key of ANIM_TECH_KEYS) {
    const value = get(key, '');
    if (!isAnimDefault(key, value) && value) {
      animChanged = true;
      break;
    }
  }
  if (animChanged) count += 1;

  for (const key of SPAWN_KEYS) {
    if (properties && key in properties) count += 1;
  }

  if (get('vox_intro', '').trim()) count += 1;
  if (get('show_on_minimap', 'true') === 'false') count += 1;
  if (get('npc_stats', '').trim()) count += 1;
  if (get('npc_visual_effects', '').trim()) count += 1;
  return count;
};

const FieldLabel = ({
  label,
  flareKey,
  tip,
}: {
  label: string;
  flareKey?: string;
  tip?: string;
}) => (
  <div className="flex items-center gap-1 mb-1">
    <label className="text-xs text-muted-foreground">{label}</label>
    {(flareKey || tip) && (
      <Tooltip content={[flareKey, tip].filter(Boolean).join(' — ')}>
        <HelpCircle className="w-3 h-3 text-muted-foreground" />
      </Tooltip>
    )}
  </div>
);

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
  const showAnimPreview = Boolean(
    (tilesetSourcePath || (tilesetPath && isImageFilePath(tilesetPath)))
    && getEditingObjectProperty('anim_render_width', ''),
  );

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

  const roleActionClass = (enabled: boolean) =>
    `h-7 px-2 text-xs rounded-md border border-border bg-background hover:bg-muted ${
      enabled ? '' : 'opacity-40 pointer-events-none'
    }`;

  return (
    <>
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
        <div className="flex-1 min-w-0 space-y-2">
          <NameField
            value={editingObject.name || ''}
            onChange={(value) => setEditingObject({ ...editingObject, name: value })}
            placeholder="NPC name"
          />
          <div className="w-24">
            <PositionField x={editingObject.x} y={editingObject.y} onChangeX={setPositionX} onChangeY={setPositionY} />
          </div>
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

      <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
        <div className="flex items-center gap-1">
          <h4 className="text-sm font-semibold">Roles</h4>
          <Tooltip content="Select the special roles for this NPC.">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1">
            <Tooltip content="Allows this NPC to be talked to.">
              <button
                type="button"
                onClick={() => {
                  const newProps = { ...editingObject.properties };
                  if (newProps.talker === 'true') delete newProps.talker;
                  else newProps.talker = 'true';
                  setEditingObject({ ...editingObject, properties: newProps });
                }}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  editingObject.properties?.talker === 'true'
                    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                    : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                }`}
              >
                <MessagesSquare className="w-3 h-3 mr-1 inline-block" />
                Talker
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => isTalker && setShowDialogueTreeDialog(true)}
              aria-label="Edit dialogue"
              disabled={!isTalker}
              className={roleActionClass(isTalker)}
            >
              Edit dialogue
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip content="Allows this NPC to buy/sell items.">
              <button
                type="button"
                onClick={() => {
                  const newProps = { ...editingObject.properties };
                  if (newProps.vendor === 'true') delete newProps.vendor;
                  else newProps.vendor = 'true';
                  setEditingObject({ ...editingObject, properties: newProps });
                }}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  editingObject.properties?.vendor === 'true'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50'
                    : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                }`}
              >
                <HandCoins className="w-3 h-3 mr-1 inline-block" />
                Vendor
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => isVendor && handleOpenVendorSettingsDialog()}
              aria-label="Vendor settings"
              disabled={!isVendor}
              className={roleActionClass(isVendor)}
            >
              Vendor settings
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip content="Allows this NPC to give quests.">
              <button
                type="button"
                onClick={() => {
                  const newProps = { ...editingObject.properties };
                  if (newProps.questGiver === 'true') delete newProps.questGiver;
                  else newProps.questGiver = 'true';
                  setEditingObject({ ...editingObject, properties: newProps });
                }}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  editingObject.properties?.questGiver === 'true'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50'
                    : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                }`}
              >
                <MessageCircleQuestionMark className="w-3 h-3 mr-1 inline-block" />
                Quest
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => isQuestGiver && handleOpenQuestSettingsDialog()}
              aria-label="Quest settings"
              disabled={!isQuestGiver}
              className={roleActionClass(isQuestGiver)}
            >
              Quest settings
            </button>
          </div>
        </div>
      </div>

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
          <div className="space-y-4 px-3 pb-3">
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Animation</h5>
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

            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Spawn requirements</h5>
                <Tooltip content="Conditions for this NPC to appear on the map.">
                  <HelpCircle className="w-3 h-3 text-muted-foreground" />
                </Tooltip>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SpawnFieldOverlay
                  active={'requires_status' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_status', ''); }}
                >
                  <div>
                    <FieldLabel label="Have status" flareKey="requires_status" tip="The NPC will only appear if the listed statuses are currently active" />
                    <Input
                      className="h-7 text-xs"
                      value={getEditingObjectProperty('requires_status', '')}
                      onChange={(e) => updateEditingObjectProperty('requires_status', e.target.value)}
                      placeholder="e.g. quest_started"
                    />
                  </div>
                </SpawnFieldOverlay>
                <SpawnFieldOverlay
                  active={'requires_not_status' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_not_status', ''); }}
                >
                  <div>
                    <FieldLabel label="Have not status" flareKey="requires_not_status" tip="The NPC will only appear if the listed statuses are not active" />
                    <Input
                      className="h-7 text-xs"
                      value={getEditingObjectProperty('requires_not_status', '')}
                      onChange={(e) => updateEditingObjectProperty('requires_not_status', e.target.value)}
                      placeholder="e.g. quest_complete"
                    />
                  </div>
                </SpawnFieldOverlay>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SpawnFieldOverlay
                  active={'requires_level' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_level', ''); }}
                >
                  <div>
                    <FieldLabel label="Min level" flareKey="requires_level" tip="Player level must be equal or greater to load NPC" />
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={getEditingObjectProperty('requires_level', '')}
                      onChange={(e) => updateEditingObjectProperty('requires_level', e.target.value)}
                      min="0"
                    />
                  </div>
                </SpawnFieldOverlay>
                <SpawnFieldOverlay
                  active={'requires_not_level' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_not_level', ''); }}
                >
                  <div>
                    <FieldLabel label="Max level" flareKey="requires_not_level" tip="Player level must be lesser to load NPC" />
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={getEditingObjectProperty('requires_not_level', '')}
                      onChange={(e) => updateEditingObjectProperty('requires_not_level', e.target.value)}
                      min="0"
                    />
                  </div>
                </SpawnFieldOverlay>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SpawnFieldOverlay
                  active={'requires_currency' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_currency', ''); }}
                >
                  <div>
                    <FieldLabel label="Min currency" flareKey="requires_currency" tip="Player currency must be equal or greater to load NPC" />
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={getEditingObjectProperty('requires_currency', '')}
                      onChange={(e) => updateEditingObjectProperty('requires_currency', e.target.value)}
                      min="0"
                    />
                  </div>
                </SpawnFieldOverlay>
                <SpawnFieldOverlay
                  active={'requires_not_currency' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_not_currency', ''); }}
                >
                  <div>
                    <FieldLabel label="Max currency" flareKey="requires_not_currency" tip="Player currency must be lesser to load NPC" />
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={getEditingObjectProperty('requires_not_currency', '')}
                      onChange={(e) => updateEditingObjectProperty('requires_not_currency', e.target.value)}
                      min="0"
                    />
                  </div>
                </SpawnFieldOverlay>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SpawnFieldOverlay
                  active={'requires_item' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_item', ''); }}
                >
                  <div>
                    <FieldLabel label="Have item" flareKey="requires_item" tip="Item required to exist in player inventory to load NPC" />
                    <div className="flex gap-1">
                      <Input
                        className="h-7 text-xs flex-1"
                        value={getEditingObjectProperty('requires_item', '')}
                        onChange={(e) => updateEditingObjectProperty('requires_item', e.target.value)}
                        placeholder="Item"
                      />
                      <Tooltip content="requires_item quantity">
                        <Input
                          type="number"
                          className="h-7 text-xs w-14"
                          value={getEditingObjectProperty('requires_item_quantity', '')}
                          onChange={(e) => updateEditingObjectProperty('requires_item_quantity', e.target.value)}
                          placeholder="Qty"
                          min="1"
                        />
                      </Tooltip>
                    </div>
                  </div>
                </SpawnFieldOverlay>
                <SpawnFieldOverlay
                  active={'requires_not_item' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_not_item', ''); }}
                >
                  <div>
                    <FieldLabel label="Have not item" flareKey="requires_not_item" tip="Item required to not exist in player inventory to load NPC" />
                    <div className="flex gap-1">
                      <Input
                        className="h-7 text-xs flex-1"
                        value={getEditingObjectProperty('requires_not_item', '')}
                        onChange={(e) => updateEditingObjectProperty('requires_not_item', e.target.value)}
                        placeholder="Item"
                      />
                      <Tooltip content="requires_not_item quantity">
                        <Input
                          type="number"
                          className="h-7 text-xs w-14"
                          value={getEditingObjectProperty('requires_not_item_quantity', '')}
                          onChange={(e) => updateEditingObjectProperty('requires_not_item_quantity', e.target.value)}
                          placeholder="Qty"
                          min="1"
                        />
                      </Tooltip>
                    </div>
                  </div>
                </SpawnFieldOverlay>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SpawnFieldOverlay
                  active={'requires_class' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_class', ''); }}
                >
                  <div>
                    <FieldLabel label="Have class" flareKey="requires_class" tip="Player base class required to load NPC" />
                    <Input
                      className="h-7 text-xs"
                      value={getEditingObjectProperty('requires_class', '')}
                      onChange={(e) => updateEditingObjectProperty('requires_class', e.target.value)}
                      placeholder="e.g. warrior"
                    />
                  </div>
                </SpawnFieldOverlay>
                <SpawnFieldOverlay
                  active={'requires_not_class' in (editingObject.properties || {})}
                  onActivate={() => { updateEditingObjectProperty('requires_not_class', ''); }}
                >
                  <div>
                    <FieldLabel label="Have not class" flareKey="requires_not_class" tip="Player base class not required to load NPC" />
                    <Input
                      className="h-7 text-xs"
                      value={getEditingObjectProperty('requires_not_class', '')}
                      onChange={(e) => updateEditingObjectProperty('requires_not_class', e.target.value)}
                      placeholder="e.g. mage"
                    />
                  </div>
                </SpawnFieldOverlay>
              </div>

              <SpawnFieldOverlay
                active={'spawn_direction' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('spawn_direction', '0'); }}
              >
                <div>
                  <DirectionField
                    value={getEditingObjectProperty('spawn_direction', '')}
                    onChange={(value) => updateEditingObjectProperty('spawn_direction', value)}
                    label="Facing on map"
                    tooltip="spawn_direction — Direction that NPC will initially face"
                  />
                </div>
              </SpawnFieldOverlay>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audio</h5>
                <Tooltip content="Sound effects for this NPC.">
                  <HelpCircle className="w-3 h-3 text-muted-foreground" />
                </Tooltip>
              </div>
              <div>
                <FieldLabel
                  label="Intro voice"
                  flareKey="vox_intro"
                  tip="Filename of a sound file to play when initially interacting with the NPC."
                />
                <Input
                  className="h-7 text-xs"
                  value={getEditingObjectProperty('vox_intro', '')}
                  onChange={(e) => updateEditingObjectProperty('vox_intro', e.target.value)}
                  placeholder="sound_file.ogg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stats &amp; effects</h5>
              <NpcAdvancedSection
                embedded
                forceExpanded
                npcFilename={getEditingObjectProperty('npcFilename', '')}
                projectPath={editor?.getCurrentProjectPath() ?? null}
                getEditingObjectProperty={getEditingObjectProperty}
                updateEditingObjectProperty={updateEditingObjectProperty}
              />
            </div>

            <MinimapToggle
              checked={getEditingObjectProperty('show_on_minimap', 'true') === 'true'}
              onChange={(checked) => updateEditingObjectBoolean('show_on_minimap', checked)}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default NpcEditDialog;

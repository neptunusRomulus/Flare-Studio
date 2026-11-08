import React, { useEffect, useState } from 'react';
import Tooltip from '@/components/ui/tooltip';
import AnimationPreview from '@/components/AnimationPreview';
import { HandCoins, HelpCircle, MessagesSquare, MessageCircleQuestionMark } from 'lucide-react';
import type { MapObject } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { ItemSummary } from '@/utils/items';
import NameField from '@/components/NameField';
import PositionField from '@/components/PositionField';
import NpcAppearanceSection from '@/components/NpcAppearanceSection';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import NpcPropertyList from '@/components/NpcPropertyList';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { isAnimationDefinitionFilePath, isImageFilePath } from '@/utils/animationUtils';
import { isCustomTilesetAppearance } from '@/editor/npcPropertyCards';
import {
  dialogueSummary,
  dialogueSummaryText,
  questSummary,
  questSummaryText,
  vendorSummary,
  vendorSummaryText,
} from '@/editor/roleSummary';

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

const NpcEditDialog = ({
  editingObject,
  setEditingObject,
  updateEditingObjectProperty,
  updateEditingObjectBoolean: _updateEditingObjectBoolean,
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
  const [previewSpritePath, setPreviewSpritePath] = useState<string | null>(null);
  const [previewPortraitPath, setPreviewPortraitPath] = useState<string | null>(null);

  const isTalker = editingObject?.properties?.talker === 'true';
  const isVendor = editingObject?.properties?.vendor === 'true';
  const isQuestGiver = editingObject?.properties?.questGiver === 'true';
  const tilesetPath = getEditingObjectProperty('tilesetPath', '');
  const templateImage = getEditingObjectProperty('templateImage', '');
  const tilesetSourcePath = getEditingObjectProperty('tilesetSourcePath', '');
  const portraitPath = getEditingObjectProperty('portraitPath', '');
  const projectPath = editor?.getCurrentProjectPath() ?? null;
  const customTileset = isCustomTilesetAppearance(tilesetPath, tilesetSourcePath);
  const showAnimPreview = Boolean(customTileset && getEditingObjectProperty('anim_render_width', ''));

  const roleProps = editingObject?.properties as Record<string, unknown> | undefined;
  const roleLines = {
    dialogue: dialogueSummaryText(dialogueSummary(roleProps)),
    vendor: vendorSummaryText(vendorSummary(roleProps)),
    quest: questSummaryText(questSummary(roleProps)),
  };

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

  const toggleRole = (key: 'talker' | 'vendor' | 'questGiver') => {
    const newProps = { ...(editingObject.properties || {}) };
    if (newProps[key] === 'true') delete newProps[key];
    else newProps[key] = 'true';
    setEditingObject({ ...editingObject, properties: newProps });
  };

  const roleCardClass = (active: boolean, activeTone: string) =>
    `flex flex-col items-stretch rounded-md border p-2.5 text-left transition-colors min-h-[5.5rem] ${
      active
        ? `${activeTone} border-current/40`
        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
    }`;

  return (
    <>
      <section className="space-y-3">
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
          <h4 className="text-sm font-semibold">Roles</h4>
          <Tooltip content="talker / vendor / questGiver — Turning a role off hides its editor but keeps the data. Turn it back on to edit again.">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </Tooltip>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="min-h-[6.25rem] flex flex-col">
            <Tooltip content="talker — Player can talk to this NPC. Turning off keeps dialogue data.">
              <button type="button" onClick={() => toggleRole('talker')} className={roleCardClass(isTalker, 'bg-blue-500/15 text-blue-600 dark:text-blue-400')}>
                <MessagesSquare className="w-5 h-5 mb-1" />
                <span className="text-sm font-semibold">Talker</span>
                <span className="text-[10px] leading-tight mt-0.5 truncate opacity-80">{roleLines.dialogue}</span>
              </button>
            </Tooltip>
            <div className="h-8 mt-1.5 flex items-center">
              {isTalker && (
                <button
                  type="button"
                  onClick={() => setShowDialogueTreeDialog(true)}
                  className="h-7 w-full px-2 text-xs rounded-md border border-border bg-background hover:bg-muted"
                >
                  Open
                </button>
              )}
            </div>
          </div>

          <div className="min-h-[6.25rem] flex flex-col">
            <Tooltip content="vendor — Player can buy and sell here. Turning off keeps stock and prices.">
              <button type="button" onClick={() => toggleRole('vendor')} className={roleCardClass(isVendor, 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')}>
                <HandCoins className="w-5 h-5 mb-1" />
                <span className="text-sm font-semibold">Vendor</span>
                <span className="text-[10px] leading-tight mt-0.5 truncate opacity-80">{roleLines.vendor}</span>
              </button>
            </Tooltip>
            <div className="h-8 mt-1.5 flex items-center">
              {isVendor && (
                <button
                  type="button"
                  onClick={() => handleOpenVendorSettingsDialog()}
                  className="h-7 w-full px-2 text-xs rounded-md border border-border bg-background hover:bg-muted"
                >
                  Open
                </button>
              )}
            </div>
          </div>

          <div className="min-h-[6.25rem] flex flex-col">
            <Tooltip content="questGiver — Player can get quests here. Turning off keeps quest settings.">
              <button type="button" onClick={() => toggleRole('questGiver')} className={roleCardClass(isQuestGiver, 'bg-amber-500/15 text-amber-600 dark:text-amber-400')}>
                <MessageCircleQuestionMark className="w-5 h-5 mb-1" />
                <span className="text-sm font-semibold">Quest</span>
                <span className="text-[10px] leading-tight mt-0.5 truncate opacity-80">{roleLines.quest}</span>
              </button>
            </Tooltip>
            <div className="h-8 mt-1.5 flex items-center">
              {isQuestGiver && (
                <button
                  type="button"
                  onClick={() => handleOpenQuestSettingsDialog()}
                  className="h-7 w-full px-2 text-xs rounded-md border border-border bg-background hover:bg-muted"
                >
                  Open
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2 border border-border rounded-md p-3 bg-muted/20">
        <div className="w-28">
          <PositionField x={editingObject.x} y={editingObject.y} onChangeX={setPositionX} onChangeY={setPositionY} />
        </div>
      </section>

      <NpcPropertyList
        editingObject={editingObject}
        get={getEditingObjectProperty}
        setProp={updateEditingObjectProperty}
        applyPatch={applyPropertyBag}
        projectPath={projectPath}
      />
    </>
  );
};

export default NpcEditDialog;

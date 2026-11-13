import React, { useEffect, useState } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import AnimationPreview from '@/components/AnimationPreview';
import { HandCoins, HelpCircle, MessagesSquare, MessageCircleQuestionMark, Settings } from 'lucide-react';
import type { MapObject } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { ItemSummary } from '@/utils/items';
import NameField from '@/components/NameField';
import PositionField from '@/components/PositionField';
import NpcAppearanceSection from '@/components/NpcAppearanceSection';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import NpcPropertyList from '@/components/NpcPropertyList';
import { resolveNpcPreviewPaths } from '@/flare/npcPreviewPaths';
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
  onOpenRoleCenter: (tab: 'dialogue' | 'vendor' | 'quest') => void;
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
  onOpenRoleCenter,
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
      const { sprite, portrait } = await resolveNpcPreviewPaths({
        tilesetPath, templateImage, tilesetSourcePath, portraitPath, projectPath,
      });
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

  const setRole = (key: 'talker' | 'vendor' | 'questGiver', on: boolean) => {
    const newProps = { ...(editingObject.properties || {}) };
    if (on) newProps[key] = 'true';
    else delete newProps[key];
    setEditingObject({ ...editingObject, properties: newProps });
  };

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
        <div className="grid grid-cols-3 gap-1.5">
          {([
            {
              key: 'talker' as const,
              active: isTalker,
              icon: <MessagesSquare className="w-4 h-4 shrink-0" />,
              label: 'Talker',
              summary: roleLines.dialogue,
              tip: 'talker — Player can talk to this NPC. Turning off keeps dialogue data.',
              settingsTip: 'Dialogue settings',
              tab: 'dialogue' as const,
            },
            {
              key: 'vendor' as const,
              active: isVendor,
              icon: <HandCoins className="w-4 h-4 shrink-0" />,
              label: 'Vendor',
              summary: roleLines.vendor,
              tip: 'vendor — Player can buy and sell here. Turning off keeps stock and prices.',
              settingsTip: 'Shop settings',
              tab: 'vendor' as const,
            },
            {
              key: 'questGiver' as const,
              active: isQuestGiver,
              icon: <MessageCircleQuestionMark className="w-4 h-4 shrink-0" />,
              label: 'Quest',
              summary: roleLines.quest,
              tip: 'questGiver — Player can get quests here. Turning off keeps quest settings.',
              settingsTip: 'Quest settings',
              tab: 'quest' as const,
            },
          ]).map((role) => (
            <div key={role.key} className="min-w-0 rounded-md border border-border bg-muted/20 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <Tooltip content={role.tip}>
                  <span className="text-muted-foreground">{role.icon}</span>
                </Tooltip>
                <span className="text-sm font-medium leading-none truncate flex-1 min-w-0">{role.label}</span>
                <Switch
                  checked={role.active}
                  onCheckedChange={(on) => setRole(role.key, on)}
                  aria-label={role.label}
                />
                <div className="h-6 w-6 shrink-0 flex items-center justify-center">
                  {role.active ? (
                    <Tooltip content={role.settingsTip}>
                      <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted"
                        aria-label={role.settingsTip}
                        onClick={() => onOpenRoleCenter(role.tab)}
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  ) : null}
                </div>
              </div>
              <div className="h-3.5 mt-1">
                {role.summary ? (
                  <Tooltip content={role.summary}>
                    <div className="text-[10px] leading-[14px] text-muted-foreground truncate">{role.summary}</div>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          ))}
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

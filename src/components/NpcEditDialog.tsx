import React, { useEffect, useState } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { askConfirm } from '@/components/ui/inline-confirm';
import AnimationPreview from '@/components/AnimationPreview';
import { HandCoins, HelpCircle, MessagesSquare, MessageCircleQuestionMark, MoreHorizontal } from 'lucide-react';
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
import { NPC_ROLE_META_LOOKUP, NPC_STATIC_BADGE_CLASS } from '@/editor/actorRoles';
import {
  dialogueSummary,
  questSummary,
  vendorSummary,
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
  const dialogueTopics = dialogueSummary(roleProps).topics;
  const vendorItems = vendorSummary(roleProps).products;
  const questName = questSummary(roleProps)?.name;
  const roleLines = {
    dialogue: `${dialogueTopics} topic${dialogueTopics === 1 ? '' : 's'}`,
    vendor: `${vendorItems} item${vendorItems === 1 ? '' : 's'}`,
    quest: questName || 'No quest',
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

  const addRole = (key: 'talker' | 'vendor' | 'questGiver', tab: 'dialogue' | 'vendor' | 'quest') => {
    setRole(key, true);
    onOpenRoleCenter(tab);
  };

  const removeRole = async (key: 'talker' | 'vendor' | 'questGiver') => {
    if (await askConfirm('Remove this role? Settings are kept.')) setRole(key, false);
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
          <Tooltip content="A removed role stays in the file. Add it again to edit.">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </Tooltip>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            {
              key: 'talker' as const,
              active: isTalker,
              icon: <MessagesSquare className="w-4 h-4 shrink-0" />,
              label: 'Dialogue',
              summary: roleLines.dialogue,
              tip: 'Player can talk to this NPC.',
              tab: 'dialogue' as const,
              badgeClass: NPC_ROLE_META_LOOKUP.isTalker.badgeClass,
            },
            {
              key: 'vendor' as const,
              active: isVendor,
              icon: <HandCoins className="w-4 h-4 shrink-0" />,
              label: 'Shop',
              summary: roleLines.vendor,
              tip: 'Player can buy and sell here.',
              tab: 'vendor' as const,
              badgeClass: NPC_ROLE_META_LOOKUP.isVendor.badgeClass,
            },
            {
              key: 'questGiver' as const,
              active: isQuestGiver,
              icon: <MessageCircleQuestionMark className="w-4 h-4 shrink-0" />,
              label: 'Quest',
              summary: roleLines.quest,
              tip: 'Player can get quests here.',
              tab: 'quest' as const,
              badgeClass: NPC_ROLE_META_LOOKUP.isQuestGiver.badgeClass,
            },
          ]).map((role) => (
            role.active ? (
              <div
                key={role.key}
                className={`relative min-w-0 rounded-md border px-2 py-1.5 ${role.badgeClass}`}
              >
                <Tooltip content={role.tip}>
                  <button
                    type="button"
                    className="w-full text-left pr-5"
                    aria-label={`Open ${role.label}`}
                    onClick={() => onOpenRoleCenter(role.tab)}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="shrink-0">{role.icon}</span>
                      <span className="text-sm font-medium leading-none truncate">{role.label}</span>
                    </span>
                    <span className="block h-3.5 mt-1 text-[10px] leading-[14px] truncate opacity-80">{role.summary}</span>
                  </button>
                </Tooltip>
                <div className="absolute top-1 right-0.5">
                  <Popover>
                    <PopoverTrigger>
                      <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-black/10 dark:hover:bg-white/10"
                        aria-label={`${role.label} menu`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-36 p-1">
                      <button
                        type="button"
                        className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeRole(role.key);
                        }}
                      >
                        Remove role
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ) : (
              <Tooltip key={role.key} content={role.tip}>
                <button
                  type="button"
                  className={`min-w-0 rounded-md border px-2 py-1.5 text-left ${NPC_STATIC_BADGE_CLASS}`}
                  aria-label={`Add ${role.label}`}
                  onClick={() => addRole(role.key, role.tab)}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="shrink-0 text-muted-foreground">{role.icon}</span>
                    <span className="text-sm font-medium leading-none truncate">{role.label}</span>
                  </span>
                  <span className="block h-3.5 mt-1 text-[10px] leading-[14px] truncate">+ Add</span>
                </button>
              </Tooltip>
            )
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

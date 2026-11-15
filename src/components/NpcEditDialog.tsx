import React, { useEffect, useState } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import AnimationPreview from '@/components/AnimationPreview';
import { HelpCircle, Settings } from 'lucide-react';
import type { MapObject } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { ItemSummary } from '@/utils/items';
import NameField from '@/components/NameField';
import NpcAppearanceSection from '@/components/NpcAppearanceSection';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import NpcPropertyList from '@/components/NpcPropertyList';
import { resolveNpcPreviewPaths } from '@/flare/npcPreviewPaths';
import { isCustomTilesetAppearance } from '@/editor/npcPropertyCards';
import { NPC_ROLE_META_LOOKUP, NPC_STATIC_BADGE_CLASS } from '@/editor/actorRoles';

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

  const roleFlags = ['talker', 'questGiver', 'vendor'] as const;
  const activeRoles = roleFlags.filter((key) => {
    if (key === 'talker') return isTalker;
    if (key === 'questGiver') return isQuestGiver;
    return isVendor;
  });
  const setRoles = (values: string[]) => {
    const newProps = { ...(editingObject.properties || {}) };
    for (const key of roleFlags) {
      if (values.includes(key)) newProps[key] = 'true';
      else delete newProps[key];
    }
    setEditingObject({ ...editingObject, properties: newProps });
  };
  const roleStateClass = (badgeClass: string) =>
    [
      badgeClass,
      ...badgeClass.split(' ').map((cls) => (
        cls.startsWith('dark:') ? `dark:data-[state=on]:${cls.slice(5)}` : `data-[state=on]:${cls}`
      )),
    ].join(' ');

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
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-1">
          <h4 className="text-sm font-semibold">Roles</h4>
          <Tooltip content="Turning a role off keeps its settings.">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </Tooltip>
        </div>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={activeRoles}
          onValueChange={setRoles}
          className="flex flex-wrap items-center justify-start gap-1.5"
        >
          {([
            {
              key: 'talker' as const,
              active: isTalker,
              label: 'Dialogue',
              tab: 'dialogue' as const,
              badgeClass: NPC_ROLE_META_LOOKUP.isTalker.badgeClass,
            },
            {
              key: 'questGiver' as const,
              active: isQuestGiver,
              label: 'Quest',
              tab: 'quest' as const,
              badgeClass: NPC_ROLE_META_LOOKUP.isQuestGiver.badgeClass,
            },
            {
              key: 'vendor' as const,
              active: isVendor,
              label: 'Vendor',
              tab: 'vendor' as const,
              badgeClass: NPC_ROLE_META_LOOKUP.isVendor.badgeClass,
            },
          ]).map((role) => (
            <div key={role.key} className="inline-flex items-center gap-0.5">
              <ToggleGroupItem
                value={role.key}
                aria-label={role.label}
                className={cn(
                  'h-8',
                  role.active ? roleStateClass(role.badgeClass) : NPC_STATIC_BADGE_CLASS,
                )}
              >
                {role.label}
              </ToggleGroupItem>
              <div className="h-8 w-8 shrink-0 flex items-center justify-center">
                {role.active ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label={`${role.label} settings`}
                    onClick={() => onOpenRoleCenter(role.tab)}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </ToggleGroup>
      </section>

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

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ItemSummary } from '@/utils/items';
import { ArrowUp, ArrowUpRight, ArrowRight, ArrowDownRight, ArrowDown, ArrowDownLeft, ArrowLeft, ArrowUpLeft, Check, HelpCircle, Save, Trash2, User, X } from 'lucide-react';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import Tooltip from '@/components/ui/tooltip';
import EventEditDialog from '@/components/EventEditDialog';
import NpcInstanceEditDialog from '@/components/NpcInstanceEditDialog';
import NpcQuestSettingsDialog from '@/components/NpcQuestSettingsDialog';
import NpcVendorSettingsDialog from '@/components/NpcVendorSettingsDialog';
import type { DialogueTree, MapObject } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type ObjectManagementDialogProps = {
  showObjectDialog: boolean;
  editingObject: MapObject | null;
  objectValidationErrors: string[];
  setEditingObject: (obj: MapObject | null) => void;
  handleObjectDialogClose: () => void;
  handleObjectDialogSave: () => void;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
  updateEditingObjectBoolean: (key: string, checked: boolean) => void;
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  editor?: TileMapEditor | null;
  syncMapObjects: () => void;
  canUseTilesetDialog: boolean;
  handleEditingTilesetBrowse: () => Promise<void> | void;
  handleEditingPortraitBrowse: () => Promise<void> | void;
  handleAutoDetectAnim: () => Promise<void> | void;
  handleOpenVendorStockDialog: () => void;
  itemsList: ItemSummary[];
  handleOpenVendorUnlockDialog: () => void;
  handleOpenVendorRandomDialog: () => void;
  handleCreateVendorStockGroup: (stockType: 'constant' | 'status' | 'random', selectedGroupId: string | null, npcName: string) => Promise<ItemSummary | null>;
  handleOpenVendorSettingsDialog: () => void;
  handleCloseVendorSettingsDialog: () => void;
  showVendorSettingsDialog: boolean;
  handleOpenQuestSettingsDialog: () => void;
  handleCloseQuestSettingsDialog: () => void;
  showQuestSettingsDialog: boolean;
  setDialogueTrees: (trees: DialogueTree[]) => void;
  setActiveDialogueTab: (idx: number) => void;
  setShowDialogueTreeDialog: (v: boolean) => void;
  showDeleteNpcConfirm: boolean;
  setShowDeleteNpcConfirm: (v: boolean) => void;
  showDeleteEnemyConfirm: boolean;
  setShowDeleteEnemyConfirm: (v: boolean) => void;
};

/**
 * Overlay wrapper for spawn requirement fields.
 * When inactive (no value set), shows a dark tint with "+ Add" text.
 * Clicking activates the field for editing.
 */
const ObjectManagementDialog = ({
  showObjectDialog,
  editingObject,
  objectValidationErrors,
  setEditingObject,
  handleObjectDialogClose,
  handleObjectDialogSave,
  updateEditingObjectProperty,
  updateEditingObjectBoolean,
  getEditingObjectProperty,
  editor,
  syncMapObjects,
  canUseTilesetDialog,
  handleEditingTilesetBrowse: _handleEditingTilesetBrowse,
  handleEditingPortraitBrowse,
  handleAutoDetectAnim,
  handleOpenVendorStockDialog,
  handleOpenVendorUnlockDialog,
  handleOpenVendorRandomDialog,
  handleCreateVendorStockGroup,
  itemsList,
  handleOpenVendorSettingsDialog,
  handleCloseVendorSettingsDialog,
  showVendorSettingsDialog,
  handleOpenQuestSettingsDialog,
  handleCloseQuestSettingsDialog,
  showQuestSettingsDialog,
  setShowDialogueTreeDialog,
  showDeleteNpcConfirm,
  setShowDeleteNpcConfirm,
  showDeleteEnemyConfirm,
  setShowDeleteEnemyConfirm
}: ObjectManagementDialogProps) => {
  const isOpen = showObjectDialog && !!editingObject;

  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'object_management_dialog', initialWidth: 1024, initialHeight: 600 });


  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleObjectDialogClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleObjectDialogClose]);

  useEffect(() => {
    if (!showQuestSettingsDialog) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseQuestSettingsDialog();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showQuestSettingsDialog, handleCloseQuestSettingsDialog]);

  if (!isOpen) return null;

  const dialogContent = (
    <>
      <div
      ref={dialogRef}
      className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 50,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center justify-between cursor-move select-none rounded-t-lg"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          {editingObject?.type === 'enemy' ? (
            'Edit Enemy Instance'
          ) : (
            <>
              {editingObject?.type === 'npc' && (
                <User className="w-5 h-5 text-orange-500" />
              )}
              {editingObject?.type !== 'enemy' && (editingObject ? `Edit ${editingObject.type.toUpperCase()}` : 'Add Object')}
            </>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleObjectDialogClose}
          className="h-6 w-6 text-foreground/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    {objectValidationErrors.length > 0 && (
          <div className="mx-6 mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-semibold mb-1">Please fix the following:</p>
            <ul className="ml-4 list-disc space-y-1">
              {objectValidationErrors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 minimal-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
          {editingObject && (
            <div className="space-y-3 pb-4">
        {editingObject.type === 'enemy' ? (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    value={editingObject.name || ''}
                    onChange={(e) => setEditingObject({ ...editingObject, name: e.target.value })}
                    placeholder="Enemy name"
                    className="h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Spawn Count</label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={editingObject.number ?? 1}
                      min={1}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        setEditingObject({ ...editingObject, number: Number.isFinite(parsed) ? parsed : undefined });
                      }}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Location</label>
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      type="number"
                      value={editingObject.x}
                      onChange={(e) => setEditingObject({ ...editingObject, x: Number(e.target.value) })}
                      className="h-8 w-20 px-1 text-center"
                    />
                    <span className="text-muted-foreground text-xs"> , </span>
                    <Input
                      type="number"
                      value={editingObject.y}
                      onChange={(e) => setEditingObject({ ...editingObject, y: Number(e.target.value) })}
                      className="h-8 w-20 px-1 text-center"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Map location coordinates for the enemy spawn.</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Size</label>
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      type="number"
                      value={editingObject.width}
                      min={1}
                      onChange={(e) => setEditingObject({ ...editingObject, width: Number(e.target.value) })}
                      className="h-8 w-20 px-1 text-center"
                    />
                    <span className="text-muted-foreground text-xs">Ã—</span>
                    <Input
                      type="number"
                      value={editingObject.height}
                      min={1}
                      onChange={(e) => setEditingObject({ ...editingObject, height: Number(e.target.value) })}
                      className="h-8 w-20 px-1 text-center"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Width and height used in the enemy location block.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Wander Radius</label>
                  <Tooltip content="Radius in tiles this enemy can move from its spawn location.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground ml-1" />
                  </Tooltip>
                  <Input
                    type="number"
                    value={editingObject.wander_radius ?? 0}
                    min={0}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      setEditingObject({ ...editingObject, wander_radius: Number.isFinite(parsed) ? parsed : undefined });
                    }}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Waypoints</label>
                  <Tooltip content="Optional patrol path: x1,y1;x2,y2;...">
                    <HelpCircle className="w-3 h-3 text-muted-foreground ml-1" />
                  </Tooltip>
                  <Input
                    className="h-8 mt-1"
                    value={getEditingObjectProperty('waypoints', '')}
                    onChange={(e) => updateEditingObjectProperty('waypoints', e.target.value)}
                    placeholder="e.g. 5,5;10,5;10,10"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Direction</label>
                  <Tooltip content="The facing direction when this enemy spawns on the map.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="grid grid-cols-3 gap-1 w-[fit-content]">
                  {([
                    { value: '7', label: 'NW', icon: ArrowUpLeft },
                    { value: '0', label: 'N', icon: ArrowUp },
                    { value: '1', label: 'NE', icon: ArrowUpRight },
                    { value: '6', label: 'W', icon: ArrowLeft },
                    { value: 'center', label: '', icon: null },
                    { value: '2', label: 'E', icon: ArrowRight },
                    { value: '5', label: 'SW', icon: ArrowDownLeft },
                    { value: '4', label: 'S', icon: ArrowDown },
                    { value: '3', label: 'SE', icon: ArrowDownRight },
                  ] as const).map(dir => {
                    if (dir.value === 'center') {
                      return (
                        <div key="center" className="flex items-center justify-center w-9 h-9">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                        </div>
                      );
                    }
                    const Icon = dir.icon!;
                    const currentDir = getEditingObjectProperty('direction', '');
                    const isSelected = currentDir === dir.value;
                    return (
                      <button
                        key={dir.value}
                        type="button"
                        onClick={() => updateEditingObjectProperty('direction', isSelected ? null : dir.value)}
                        className={`flex flex-col items-center justify-center w-9 h-9 gap-0.5 rounded text-[9px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/50'
                            : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                        }`}
                        title={dir.label}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{dir.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Enemy template details are edited in the enemy tab. This dialog only adjusts map-instance fields.
            </div>
          </>
        ) : (
          <>
        {editingObject.type === 'npc' && (
          <NpcInstanceEditDialog
            editingObject={editingObject}
            setEditingObject={setEditingObject}
            updateEditingObjectProperty={updateEditingObjectProperty}
            updateEditingObjectBoolean={updateEditingObjectBoolean}
            getEditingObjectProperty={getEditingObjectProperty}
            editor={editor}
            canUseTilesetDialog={canUseTilesetDialog}
            handleEditingPortraitBrowse={handleEditingPortraitBrowse}
            handleAutoDetectAnim={handleAutoDetectAnim}
            handleOpenVendorSettingsDialog={handleOpenVendorSettingsDialog}
            handleOpenQuestSettingsDialog={handleOpenQuestSettingsDialog}
            setShowDialogueTreeDialog={setShowDialogueTreeDialog}
            itemsList={itemsList}
          />
        )}

        {/* Non-NPC basic info (events etc.) */}
        {editingObject.type !== 'npc' && (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={editingObject.name || ''}
                onChange={(e) => setEditingObject({...editingObject, name: e.target.value})}
                placeholder="Object name"
                className="h-8"
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-muted-foreground">Position</label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={editingObject.x}
                  onChange={(e) => setEditingObject({...editingObject, x: Number(e.target.value)})}
                  className="h-8 w-11 px-1 text-center"
                />
                <span className="text-muted-foreground text-xs">,</span>
                <Input
                  type="number"
                  value={editingObject.y}
                  onChange={(e) => setEditingObject({...editingObject, y: Number(e.target.value)})}
                  className="h-8 w-11 px-1 text-center"
                />
              </div>
            </div>
          </div>
        )}



        {editingObject.type === 'event' && (
          <EventEditDialog editingObject={editingObject} setEditingObject={setEditingObject} />
        )}
        </>
        )}
      </div>
    )}
    </div>

    <div className="sticky bottom-0 border-t border-border/50 bg-background px-6 py-3 flex-shrink-0">
      <div className="flex w-full justify-between items-center">
        {/* Delete buttons */}
        <div className="flex items-center gap-2">
          {editingObject?.type === 'npc' && (
            <>
              {showDeleteNpcConfirm ? (
                <>
                  <span className="text-xs text-muted-foreground">Delete?</span>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      if (editingObject) {
                        editor?.removeMapObject(editingObject.id);
                        syncMapObjects();
                        handleObjectDialogClose();
                        setShowDeleteNpcConfirm(false);
                      }
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowDeleteNpcConfirm(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteNpcConfirm(true)}
                  aria-label="Delete NPC"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
          {editingObject?.type === 'enemy' && (
            <>
              {showDeleteEnemyConfirm ? (
                <>
                  <span className="text-xs text-muted-foreground">Delete?</span>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      if (editingObject) {
                        editor?.removeMapObject(editingObject.id);
                        syncMapObjects();
                        handleObjectDialogClose();
                        setShowDeleteEnemyConfirm(false);
                      }
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowDeleteEnemyConfirm(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteEnemyConfirm(true)}
                  aria-label="Delete Enemy"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button size="icon" onClick={handleObjectDialogSave} aria-label="Save">
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>

    {/* Resize handle */}
    <div
      onMouseDown={handleResizeMouseDown}
      className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
      title="Drag to resize"
    >
      <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
    </div>
  </div>

        <NpcVendorSettingsDialog
          isOpen={showVendorSettingsDialog}
          onClose={handleCloseVendorSettingsDialog}
          onOpenStockDialog={handleOpenVendorStockDialog}
          onOpenUnlockDialog={handleOpenVendorUnlockDialog}
          onOpenRandomDialog={handleOpenVendorRandomDialog}
          onCreateVendorStockGroup={handleCreateVendorStockGroup}
          itemsList={itemsList}
          getEditingObjectProperty={getEditingObjectProperty}
          updateEditingObjectProperty={updateEditingObjectProperty}
        />

        <NpcQuestSettingsDialog
          isOpen={showQuestSettingsDialog}
          onClose={handleCloseQuestSettingsDialog}
          itemsList={itemsList}
          getEditingObjectProperty={getEditingObjectProperty}
          updateEditingObjectProperty={updateEditingObjectProperty}
        />
      </>
  );

  return createPortal(dialogContent, document.body);
};

export default ObjectManagementDialog;

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { ArrowUp, ArrowUpRight, ArrowRight, ArrowDownRight, ArrowDown, ArrowDownLeft, ArrowLeft, ArrowUpLeft, Check, ChevronDown, ChevronUp, Gift, HelpCircle, Image, MessagesSquare, Package, Plus, Save, Sparkles, Trash2, User, X } from 'lucide-react';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import AnimationPreview from '@/components/AnimationPreview';
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
  handleOpenVendorUnlockDialog: () => void;
  handleOpenVendorRandomDialog: () => void;
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
const SpawnFieldOverlay = ({ active, onActivate, children }: { active: boolean; onActivate: () => void; children: React.ReactNode }) => (
  <div className="relative">
    <div className={active ? '' : 'pointer-events-none'}>
      {children}
    </div>
    {!active && (
      <div
        className="absolute top-5 left-0 right-0 bottom-0 rounded-md bg-black/50 flex items-center justify-center cursor-pointer z-10 transition-opacity hover:bg-black/40"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onActivate(); }}
      >
        <span className="flex items-center gap-1 text-xs font-medium text-white/90">
          <Plus className="w-3 h-3" />
          Add
        </span>
      </div>
    )}
  </div>
);

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
  handleEditingTilesetBrowse,
  handleEditingPortraitBrowse,
  handleAutoDetectAnim,
  handleOpenVendorStockDialog,
  handleOpenVendorUnlockDialog,
  handleOpenVendorRandomDialog,
  setDialogueTrees,
  setActiveDialogueTab,
  setShowDialogueTreeDialog,
  showDeleteNpcConfirm,
  setShowDeleteNpcConfirm,
  showDeleteEnemyConfirm,
  setShowDeleteEnemyConfirm
}: ObjectManagementDialogProps) => {
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [animationExpanded, setAnimationExpanded] = useState(false);
  const [spawnReqExpanded, setSpawnReqExpanded] = useState(false);
  const [audioExpanded, setAudioExpanded] = useState(false);

  const isOpen = showObjectDialog && editingObject?.type !== 'enemy';

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

  if (!isOpen) return null;

  const dialogContent = (
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
            'Edit Enemy'
          ) : (
            <>
              {editingObject?.type === 'npc' && (
                <User className="w-5 h-5 text-orange-500" />
              )}
              {editingObject?.type === 'enemy' && (
                <div className="flex items-center gap-2">
                  <span>{editingObject ? `Edit ${editingObject.type.toUpperCase()}` : 'Add Object'}</span>
                  <Tooltip
                    content={
                      <div
                        className="max-w-lg whitespace-normal break-words text-sm text-foreground leading-snug p-2"
                        style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}
                      >
                        Enemy stats normally scale with level. Overriding a stat disables scaling for that stat.
                      </div>
                    }
                    side="right"
                  >
                    <span className="inline-flex items-center text-orange-500 font-semibold">
                      <HelpCircle className="w-4 h-4" strokeWidth={2.4} />
                    </span>
                  </Tooltip>
                </div>
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
          {/* Basic Info Row for enemies */}
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
                <Input type="number" value={editingObject.x} disabled className="h-8 w-11 px-1 text-center opacity-50" />
                <span className="text-muted-foreground text-xs">,</span>
                <Input type="number" value={editingObject.y} disabled className="h-8 w-11 px-1 text-center opacity-50" />
              </div>
            </div>
          </div>
          {/* Tileset for Enemy */}
          <div className="flex gap-2">
            <Input
              className="h-8 flex-1 text-xs"
              value={getEditingObjectProperty('tilesetPath', '')}
              onChange={(e) => updateEditingObjectProperty('tilesetPath', e.target.value)}
              placeholder="Tileset path..."
              readOnly={canUseTilesetDialog}
              onClick={canUseTilesetDialog ? () => { void handleEditingTilesetBrowse(); } : undefined}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 gap-2"
              onClick={() => { void handleEditingTilesetBrowse(); }}
              disabled={!canUseTilesetDialog}
            >
              <Image className="w-4 h-4" />
              <span className="text-xs">Tileset</span>
            </Button>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Enemy details are edited in the enemy tab.
          </div>
          </>
        ) : (
          <>

        {/* NPC Appearance Section */}
        {editingObject.type === 'npc' && (
          <div className="border border-border rounded-md bg-muted/20">
            <button
              type="button"
              onClick={() => setAppearanceExpanded(!appearanceExpanded)}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
            >
              {appearanceExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
              <span>Identity</span>
            </button>
            {appearanceExpanded && <div className="space-y-3 px-3 pb-3">

            {/* Name & Position */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={editingObject.name || ''}
                  onChange={(e) => setEditingObject({...editingObject, name: e.target.value})}
                  placeholder="NPC name"
                  className="h-7 text-xs"
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground">Position</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={editingObject.x}
                    onChange={(e) => {
                      const newX = Number(e.target.value);
                      if (editor) {
                        const allObjects = editor.getMapObjects();
                        const conflict = allObjects.find(o => o.type === 'npc' && o.id !== editingObject.id && o.x === newX && o.y === editingObject.y);
                        if (conflict) return;
                      }
                      setEditingObject({...editingObject, x: newX});
                    }}
                    className="h-7 w-11 px-1 text-center text-xs"
                  />
                  <span className="text-muted-foreground text-xs">,</span>
                  <Input
                    type="number"
                    value={editingObject.y}
                    onChange={(e) => {
                      const newY = Number(e.target.value);
                      if (editor) {
                        const allObjects = editor.getMapObjects();
                        const conflict = allObjects.find(o => o.type === 'npc' && o.id !== editingObject.id && o.x === editingObject.x && o.y === newY);
                        if (conflict) return;
                      }
                      setEditingObject({...editingObject, y: newY});
                    }}
                    className="h-7 w-11 px-1 text-center text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Portrait - preview and button */}
            <div className="space-y-2">
              {getEditingObjectProperty('portraitPath', '') && (
                <div className="w-20 h-20 border border-border rounded bg-muted/40 flex items-center justify-center overflow-hidden">
                  <img
                    src={getEditingObjectProperty('portraitPath', '')}
                    alt="Portrait"
                    className="max-w-full max-h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 gap-1.5"
                    onClick={() => { void handleEditingPortraitBrowse(); }}
                    disabled={!canUseTilesetDialog}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span className="text-xs">Portrait</span>
                  </Button>
                  {getEditingObjectProperty('portraitPath', '') && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500">
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Direction */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs text-muted-foreground">Direction</label>
                <Tooltip content="The direction to use for this NPC's stance animation">
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
                  const isSelected = getEditingObjectProperty('direction', '') === dir.value;
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

            {/* Show on Minimap */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={getEditingObjectProperty('show_on_minimap', 'true') === 'true'}
                onChange={(e) => updateEditingObjectBoolean('show_on_minimap', e.target.checked)}
              />
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">Show on Minimap</label>
                <Tooltip content="If true, this NPC will be shown on the minimap. The default is true.">
                  <HelpCircle className="w-3 h-3 text-muted-foreground" />
                </Tooltip>
              </div>
            </div>
            </div>}
          </div>
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

        {/* NPC Roles */}
        {editingObject.type === 'npc' && (
          <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
            <div>
              <h4 className="text-sm font-semibold">Roles</h4>
              <p className="text-xs text-muted-foreground">Select the special roles for this NPC.</p>
            </div>
            <div className="flex gap-1.5">
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
                  Talker
                </button>
              </Tooltip>

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
                  Vendor
                </button>
              </Tooltip>

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
                  Quest
                </button>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Role-specific compact options */}
        {editingObject.type === 'npc' && editingObject.properties?.talker === 'true' && (
          <div className="pl-3 border-l-[3px] border-blue-500/80 py-1">
            <button
              type="button"
              onClick={() => setShowDialogueTreeDialog(true)}
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:opacity-80"
            >
              <MessagesSquare className="w-3 h-3" />
              Dialogue Trees
            </button>
          </div>
        )}

        {editingObject.type === 'npc' && editingObject.properties?.vendor === 'true' && (
          <div className="pl-3 border-l-[3px] border-emerald-500/80 space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Vendor Requires Status</label>
                  <Tooltip content="The player must have these statuses in order to use this NPC as a vendor.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  className="h-7 text-xs border-emerald-500/30 bg-emerald-500/5"
                  value={getEditingObjectProperty('vendor_requires_status', '')}
                  onChange={(e) => updateEditingObjectProperty('vendor_requires_status', e.target.value)}
                  placeholder="e.g. hero_status"
                />
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Vendor Requires Not Status</label>
                  <Tooltip content="The player must not have these statuses in order to use this NPC as a vendor.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  className="h-7 text-xs border-emerald-500/30 bg-emerald-500/5"
                  value={getEditingObjectProperty('vendor_requires_not_status', '')}
                  onChange={(e) => updateEditingObjectProperty('vendor_requires_not_status', e.target.value)}
                  placeholder="e.g. thief_status"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Constant Stock</label>
                  <Tooltip content="A list of items this vendor has for sale.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="flex gap-1">
                  <Input
                    className="h-7 text-xs flex-1 border-emerald-500/30 bg-emerald-500/5"
                    value={getEditingObjectProperty('constant_stock', '')}
                    onChange={(e) => updateEditingObjectProperty('constant_stock', e.target.value)}
                    placeholder="item_id"
                  />
                  <Input
                    type="number"
                    className="h-7 text-xs w-14 border-emerald-500/30 bg-emerald-500/5"
                    value={getEditingObjectProperty('constant_stock_quantity', '')}
                    onChange={(e) => updateEditingObjectProperty('constant_stock_quantity', e.target.value)}
                    placeholder="Qty"
                    min="1"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Status Stock</label>
                  <Tooltip content="A list of items this vendor will have for sale if the required status is met.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="flex gap-1">
                  <Input
                    className="h-7 text-xs flex-1 border-emerald-500/30 bg-emerald-500/5"
                    value={getEditingObjectProperty('status_stock', '')}
                    onChange={(e) => updateEditingObjectProperty('status_stock', e.target.value)}
                    placeholder="item_id"
                  />
                  <Input
                    type="number"
                    className="h-7 text-xs w-14 border-emerald-500/30 bg-emerald-500/5"
                    value={getEditingObjectProperty('status_stock_quantity', '')}
                    onChange={(e) => updateEditingObjectProperty('status_stock_quantity', e.target.value)}
                    placeholder="Qty"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Random Stock</label>
                <Tooltip content="Use a loot table to add random items to the stock; either a filename or an inline definition.">
                  <HelpCircle className="w-3 h-3 text-muted-foreground" />
                </Tooltip>
              </div>
              <Input
                className="h-7 text-xs border-emerald-500/30 bg-emerald-500/5"
                value={getEditingObjectProperty('random_stock', '')}
                onChange={(e) => updateEditingObjectProperty('random_stock', e.target.value)}
                placeholder="loot table definition"
              />
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Random Stock Count</label>
                <Tooltip content="Sets the minimum (and optionally, the maximum) amount of random items this npc can have.">
                  <HelpCircle className="w-3 h-3 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs text-muted-foreground">Min</span>
                  <Input
                    type="number"
                    className="h-7 text-xs border-emerald-500/30 bg-emerald-500/5"
                    value={getEditingObjectProperty('random_stock_count_min', '')}
                    onChange={(e) => updateEditingObjectProperty('random_stock_count_min', e.target.value)}
                    placeholder="Min"
                    min="0"
                  />
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs text-muted-foreground">Max</span>
                  <Input
                    type="number"
                    className="h-7 text-xs border-emerald-500/30 bg-emerald-500/5"
                    value={getEditingObjectProperty('random_stock_count_max', '')}
                    onChange={(e) => updateEditingObjectProperty('random_stock_count_max', e.target.value)}
                    placeholder="Max"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium truncate">Ratio Buy</label>
                  <Tooltip content="NPC-specific version of vendor_ratio_buy from engine/loot.txt. Uses the global setting when set to 0.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground shrink-0" />
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  className="h-7 text-xs border-emerald-500/30 bg-emerald-500/5"
                  value={getEditingObjectProperty('vendor_ratio_buy', '')}
                  onChange={(e) => updateEditingObjectProperty('vendor_ratio_buy', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium truncate">Ratio Sell</label>
                  <Tooltip content="NPC-specific version of vendor_ratio_sell from engine/loot.txt. Uses the global setting when set to 0.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground shrink-0" />
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  className="h-7 text-xs border-emerald-500/30 bg-emerald-500/5"
                  value={getEditingObjectProperty('vendor_ratio_sell', '')}
                  onChange={(e) => updateEditingObjectProperty('vendor_ratio_sell', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium truncate">Ratio Sell Old</label>
                  <Tooltip content="NPC-specific version of vendor_ratio_sell_old from engine/loot.txt. Uses the global setting when set to 0.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground shrink-0" />
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  className="h-7 text-xs border-emerald-500/30 bg-emerald-500/5"
                  value={getEditingObjectProperty('vendor_ratio_sell_old', '')}
                  onChange={(e) => updateEditingObjectProperty('vendor_ratio_sell_old', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {editingObject.type === 'npc' && editingObject.properties?.questGiver === 'true' && (
          <div className="pl-2 border-l-2 border-amber-500/50 space-y-1.5">
            <Input
              className="h-7 text-xs"
              value={getEditingObjectProperty('questRequiresStatus', '')}
              onChange={(e) => updateEditingObjectProperty('questRequiresStatus', e.target.value)}
              placeholder="Requires status..."
            />
            <Input
              className="h-7 text-xs"
              value={getEditingObjectProperty('questSetStatus', '')}
              onChange={(e) => updateEditingObjectProperty('questSetStatus', e.target.value)}
              placeholder="Set status on accept..."
            />
          </div>
        )}

        {/* NPC Spawn Requirements & Behavior */}
        {editingObject.type === 'npc' && (
          <div className="border border-border rounded-md bg-muted/20">
            <button
              type="button"
              onClick={() => setSpawnReqExpanded(!spawnReqExpanded)}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
            >
              {spawnReqExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
              <div>
                <span>Spawn Requirements</span>
                <p className="text-xs text-muted-foreground font-normal">Conditions for this NPC to appear on the map.</p>
              </div>
            </button>
            {spawnReqExpanded && <div className="space-y-3 px-3 pb-3">

            {/* Status requirements */}
            {/* Status requirements */}
            <div className="grid grid-cols-2 gap-3">
              <SpawnFieldOverlay
                active={'requires_status' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('requires_status', ''); }}
              >
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Have Status</label>
                  <Tooltip content="The NPC will only appear if the listed statuses are currently active">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
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
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Have Not Status</label>
                  <Tooltip content="The NPC will only appear if the listed statuses are not active">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  className="h-7 text-xs"
                  value={getEditingObjectProperty('requires_not_status', '')}
                  onChange={(e) => updateEditingObjectProperty('requires_not_status', e.target.value)}
                  placeholder="e.g. quest_complete"
                />
              </div>
              </SpawnFieldOverlay>
            </div>

            {/* Level requirements */}
            <div className="grid grid-cols-2 gap-3">
              <SpawnFieldOverlay
                active={'requires_level' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('requires_level', ''); }}
              >
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Required Min Level</label>
                  <Tooltip content="Player level must be equal or greater to load NPC">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
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
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Required Max Level</label>
                  <Tooltip content="Player level must be lesser to load NPC">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
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

            {/* Currency requirements */}
            <div className="grid grid-cols-2 gap-3">
              <SpawnFieldOverlay
                active={'requires_currency' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('requires_currency', ''); }}
              >
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Required Min Currency</label>
                  <Tooltip content="Player currency must be equal or greater to load NPC">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
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
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Required Max Currency</label>
                  <Tooltip content="Player currency must be lesser to load NPC">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
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

            {/* Item requirements */}
            <div className="grid grid-cols-2 gap-3">
              <SpawnFieldOverlay
                active={'requires_item' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('requires_item', ''); }}
              >
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Required Have Item</label>
                  <Tooltip content="Item required to exist in player inventory to load NPC">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="flex gap-1">
                  <Input
                    className="h-7 text-xs flex-1"
                    value={getEditingObjectProperty('requires_item', '')}
                    onChange={(e) => updateEditingObjectProperty('requires_item', e.target.value)}
                    placeholder="item_id"
                  />
                  <Input
                    type="number"
                    className="h-7 text-xs w-14"
                    value={getEditingObjectProperty('requires_item_quantity', '')}
                    onChange={(e) => updateEditingObjectProperty('requires_item_quantity', e.target.value)}
                    placeholder="Qty"
                    min="1"
                  />
                </div>
              </div>
              </SpawnFieldOverlay>
              <SpawnFieldOverlay
                active={'requires_not_item' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('requires_not_item', ''); }}
              >
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Required Have Not Item</label>
                  <Tooltip content="Item required to not exist in player inventory to load NPC">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="flex gap-1">
                  <Input
                    className="h-7 text-xs flex-1"
                    value={getEditingObjectProperty('requires_not_item', '')}
                    onChange={(e) => updateEditingObjectProperty('requires_not_item', e.target.value)}
                    placeholder="item_id"
                  />
                  <Input
                    type="number"
                    className="h-7 text-xs w-14"
                    value={getEditingObjectProperty('requires_not_item_quantity', '')}
                    onChange={(e) => updateEditingObjectProperty('requires_not_item_quantity', e.target.value)}
                    placeholder="Qty"
                    min="1"
                  />
                </div>
              </div>
              </SpawnFieldOverlay>
            </div>

            {/* Class requirements */}
            <div className="grid grid-cols-2 gap-3">
              <SpawnFieldOverlay
                active={'requires_class' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('requires_class', ''); }}
              >
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Required Have Class</label>
                  <Tooltip content="Player base class required to load NPC">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
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
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Required Have Not Class</label>
                  <Tooltip content="Player base class not required to load NPC">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  className="h-7 text-xs"
                  value={getEditingObjectProperty('requires_not_class', '')}
                  onChange={(e) => updateEditingObjectProperty('requires_not_class', e.target.value)}
                  placeholder="e.g. mage"
                />
              </div>
              </SpawnFieldOverlay>
            </div>

            {/* Direction */}
            <SpawnFieldOverlay
              active={'spawn_direction' in (editingObject.properties || {})}
              onActivate={() => { updateEditingObjectProperty('spawn_direction', '0'); }}
            >
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs text-muted-foreground">Direction</label>
                <Tooltip content="Direction that NPC will initially face">
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
                  const isSelected = getEditingObjectProperty('spawn_direction', '') === dir.value;
                  return (
                    <button
                      key={dir.value}
                      type="button"
                      onClick={() => updateEditingObjectProperty('spawn_direction', isSelected ? null : dir.value)}
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
            </SpawnFieldOverlay>

            {/* Waypoints & Wander Radius */}
            <div className="grid grid-cols-2 gap-3">
              <SpawnFieldOverlay
                active={'waypoints' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('waypoints', ''); }}
              >
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Waypoints</label>
                  <Tooltip content="NPC waypoints; negates wander_radius">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  className="h-7 text-xs"
                  value={getEditingObjectProperty('waypoints', '')}
                  onChange={(e) => updateEditingObjectProperty('waypoints', e.target.value)}
                  placeholder="Will be implemented later"
                />
              </div>
              </SpawnFieldOverlay>
              <SpawnFieldOverlay
                active={'wander_radius' in (editingObject.properties || {})}
                onActivate={() => { updateEditingObjectProperty('wander_radius', ''); }}
              >
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-muted-foreground">Wander Radius</label>
                  <Tooltip content="The radius (in tiles) that an NPC will wander around randomly; negates waypoints">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={getEditingObjectProperty('wander_radius', '')}
                  onChange={(e) => updateEditingObjectProperty('wander_radius', e.target.value)}
                  placeholder="Will be implemented later"
                  min="0"
                />
              </div>
              </SpawnFieldOverlay>
            </div>
            </div>}
          </div>
        )}

        {/* NPC Animation */}
        {editingObject.type === 'npc' && (
          <div className="border border-border rounded-md bg-muted/20">
            <button
              type="button"
              onClick={() => setAnimationExpanded(!animationExpanded)}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
            >
              {animationExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
              <span>Animation</span>
            </button>
            {animationExpanded && (
              <div className="space-y-3 px-3 pb-3">

            {/* Live Animation Preview - always visible */}
            <div className="relative">
              <AnimationPreview
                tilesetPath={getEditingObjectProperty('tilesetPath', '')}
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
            </div>

            {/* Tileset import button */}
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 gap-1.5"
                  onClick={() => { void handleEditingTilesetBrowse(); }}
                  disabled={!canUseTilesetDialog}
                >
                  <Image className="w-3.5 h-3.5" />
                  <span className="text-xs">Import Tileset</span>
                </Button>
                {getEditingObjectProperty('tilesetPath', '') && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </span>
                )}
              </div>
              {getEditingObjectProperty('tilesetPath', '') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                  onClick={() => { void handleAutoDetectAnim(); }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs">Auto Detect</span>
                </Button>
              )}
              {getEditingObjectProperty('anim_image_width', '') && (
                <span className="text-[10px] text-muted-foreground">
                  {getEditingObjectProperty('anim_image_width', '?')}×{getEditingObjectProperty('anim_image_height', '?')} &bull; {getEditingObjectProperty('anim_frames', '?')} frame{getEditingObjectProperty('anim_frames', '1') !== '1' ? 's' : ''}
                </span>
              )}
            </div>

            {/* Animation Settings - always visible */}
            <div className="space-y-2">
              {/* Frame Size */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground w-16 shrink-0">Frame Size</label>
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
              {/* Render Offset */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground w-16 shrink-0">Offset</label>
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
              {/* Frames & Duration */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground w-16 shrink-0">Frames</label>
                <Input
                  type="number"
                  value={getEditingObjectProperty('anim_frames', '')}
                  onChange={(e) => updateEditingObjectProperty('anim_frames', e.target.value || null)}
                  className="h-6 w-14 px-1 text-center text-xs"
                  min={1}
                />
                <label className="text-[10px] text-muted-foreground shrink-0">Duration</label>
                <Input
                  type="text"
                  value={getEditingObjectProperty('anim_duration', '')}
                  onChange={(e) => updateEditingObjectProperty('anim_duration', e.target.value || null)}
                  className="h-6 w-20 px-1 text-center text-xs"
                  placeholder="1200ms"
                />
              </div>
              {/* Type */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground w-16 shrink-0">Type</label>
                <select
                  value={getEditingObjectProperty('anim_type', 'looped')}
                  onChange={(e) => updateEditingObjectProperty('anim_type', e.target.value)}
                  className="h-6 px-1 text-xs rounded border border-border bg-background w-28"
                >
                  <option value="looped">looped</option>
                  <option value="play_once">play_once</option>
                  <option value="back_forth">back_forth</option>
                </select>
              </div>
              {/* Blend Mode & Alpha */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground w-16 shrink-0">Blend</label>
                <select
                  value={getEditingObjectProperty('anim_blend_mode', 'normal')}
                  onChange={(e) => updateEditingObjectProperty('anim_blend_mode', e.target.value)}
                  className="h-6 px-1 text-xs rounded border border-border bg-background w-20"
                >
                  <option value="normal">normal</option>
                  <option value="add">add</option>
                </select>
                <label className="text-[10px] text-muted-foreground shrink-0">Alpha</label>
                <Input
                  type="number"
                  value={getEditingObjectProperty('anim_alpha_mod', '')}
                  onChange={(e) => updateEditingObjectProperty('anim_alpha_mod', e.target.value || null)}
                  className="h-6 w-14 px-1 text-center text-xs"
                  min={0}
                  max={255}
                />
              </div>
              {/* Color Mod */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground w-16 shrink-0">Color Mod</label>
                <Input
                  type="text"
                  value={getEditingObjectProperty('anim_color_mod', '')}
                  onChange={(e) => updateEditingObjectProperty('anim_color_mod', e.target.value || null)}
                  className="h-6 w-24 px-1 text-center text-xs"
                  placeholder="255,255,255"
                />
              </div>
            </div>

              </div>
            )}
          </div>
        )}

        {/* NPC Audio */}
        {editingObject.type === 'npc' && (
          <div className="border border-border rounded-md bg-muted/20">
            <button
              type="button"
              onClick={() => setAudioExpanded(!audioExpanded)}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
            >
              {audioExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
              <div>
                <span>Audio</span>
                <p className="text-xs text-muted-foreground font-normal">Sound effects for this NPC.</p>
              </div>
            </button>
            {audioExpanded && <div className="space-y-3 px-3 pb-3">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs text-muted-foreground">Intro Vox (vox_intro)</label>
                <Tooltip content="Filename of a sound file to play when initially interacting with the NPC.">
                  <HelpCircle className="w-3 h-3 text-muted-foreground" />
                </Tooltip>
              </div>
              <Input
                className="h-7 text-xs"
                value={getEditingObjectProperty('vox_intro', '')}
                onChange={(e) => updateEditingObjectProperty('vox_intro', e.target.value)}
                placeholder="sound_file.ogg"
              />
            </div>
            </div>}
          </div>
        )}

        {editingObject.type === 'enemy' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Level</label>
                <Input
                  type="number"
                  value={editingObject.level || 1}
                  onChange={(e) => setEditingObject({...editingObject, level: Number(e.target.value)})}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Number</label>
                <Input
                  type="number"
                  value={editingObject.number || 1}
                  onChange={(e) => setEditingObject({...editingObject, number: Number(e.target.value)})}
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Wander Radius</label>
              <Input
                type="number"
                value={editingObject.wander_radius || 4}
                onChange={(e) => setEditingObject({...editingObject, wander_radius: Number(e.target.value)})}
                min="0"
              />
            </div>

            <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
              <div>
                <h4 className="text-sm font-semibold">Enemy Specifications</h4>
                <p className="text-xs text-muted-foreground">Configure Flare StatBlock-compatible values.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">XP</label>
                  <Input
                    type="number"
                    value={getEditingObjectProperty('xp', '')}
                    onChange={(e) => updateEditingObjectProperty('xp', e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">XP Scaling Table</label>
                  <Input
                    value={getEditingObjectProperty('xp_scaling', '')}
                    onChange={(e) => updateEditingObjectProperty('xp_scaling', e.target.value)}
                    placeholder="tables/xp_scaling.txt"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Defeat Status</label>
                  <Input
                    value={getEditingObjectProperty('defeat_status', '')}
                    onChange={(e) => updateEditingObjectProperty('defeat_status', e.target.value)}
                    placeholder="campaign_status_id"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Convert Status</label>
                  <Input
                    value={getEditingObjectProperty('convert_status', '')}
                    onChange={(e) => updateEditingObjectProperty('convert_status', e.target.value)}
                    placeholder="campaign_status_id"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Defeat Loot</label>
                  <Input
                    value={getEditingObjectProperty('first_defeat_loot', '')}
                    onChange={(e) => updateEditingObjectProperty('first_defeat_loot', e.target.value)}
                    placeholder="items/id.txt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Animations Definition</label>
                  <Input
                    value={getEditingObjectProperty('animations', '')}
                    onChange={(e) => updateEditingObjectProperty('animations', e.target.value)}
                    placeholder="animations/enemies/foo.txt"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Loot Entries (one per line)</label>
                <textarea
                  className="w-full min-h-[80px] text-sm rounded-md border border-border bg-background px-2 py-1"
                  value={getEditingObjectProperty('loot', '')}
                  onChange={(e) => updateEditingObjectProperty('loot', e.target.value)}
                  placeholder="item_id, chance"
                />
              </div>

              {(() => {
                const lootCountRaw = getEditingObjectProperty('loot_count', '');
                const [lootCountMin = '', lootCountMax = ''] = lootCountRaw.split(',').map((part) => part.trim());
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Loot Count Min</label>
                      <Input
                        type="number"
                        value={lootCountMin}
                        min="0"
                        onChange={(e) => {
                          const newMin = e.target.value;
                          if (!newMin) {
                            updateEditingObjectProperty('loot_count', '');
                          } else {
                            updateEditingObjectProperty('loot_count', lootCountMax ? `${newMin},${lootCountMax}` : newMin);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Loot Count Max</label>
                      <Input
                        type="number"
                        value={lootCountMax}
                        min="0"
                        onChange={(e) => {
                          const newMax = e.target.value;
                          if (!lootCountMin) {
                            updateEditingObjectProperty('loot_count', '');
                          } else {
                            updateEditingObjectProperty('loot_count', newMax ? `${lootCountMin},${newMax}` : lootCountMin);
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Threat Range (engage, stop)</label>
                  {(() => {
                    const raw = getEditingObjectProperty('threat_range', '');
                    const [engage = '', stop = ''] = raw.split(',').map((part) => part.trim());
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          value={engage}
                          onChange={(e) => {
                            const newEngage = e.target.value;
                            if (!newEngage) {
                              updateEditingObjectProperty('threat_range', stop ? `0,${stop}` : '');
                            } else {
                              updateEditingObjectProperty('threat_range', stop ? `${newEngage},${stop}` : newEngage);
                            }
                          }}
                        />
                        <Input
                          type="number"
                          value={stop}
                          onChange={(e) => {
                            const newStop = e.target.value;
                            if (!engage) {
                              updateEditingObjectProperty('threat_range', '');
                            } else {
                              updateEditingObjectProperty('threat_range', newStop ? `${engage},${newStop}` : engage);
                            }
                          }}
                        />
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Flee Range</label>
                  <Input
                    type="number"
                    value={getEditingObjectProperty('flee_range', '')}
                    onChange={(e) => updateEditingObjectProperty('flee_range', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Chance Pursue (%)</label>
                  <Input
                    type="number"
                    value={getEditingObjectProperty('chance_pursue', '')}
                    onChange={(e) => updateEditingObjectProperty('chance_pursue', e.target.value)}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Chance Flee (%)</label>
                  <Input
                    type="number"
                    value={getEditingObjectProperty('chance_flee', '')}
                    onChange={(e) => updateEditingObjectProperty('chance_flee', e.target.value)}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Waypoint Pause</label>
                  <Input
                    value={getEditingObjectProperty('waypoint_pause', '')}
                    onChange={(e) => updateEditingObjectProperty('waypoint_pause', e.target.value)}
                    placeholder="250ms"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Turn Delay</label>
                  <Input
                    value={getEditingObjectProperty('turn_delay', '')}
                    onChange={(e) => updateEditingObjectProperty('turn_delay', e.target.value)}
                    placeholder="100ms"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Combat Style</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                  value={getEditingObjectProperty('combat_style', '')}
                  onChange={(e) => updateEditingObjectProperty('combat_style', e.target.value)}
                >
                  <option value="">Default</option>
                  <option value="default">default</option>
                  <option value="aggressive">aggressive</option>
                  <option value="passive">passive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Triggered Powers (state,power,chance per line)</label>
                <textarea
                  className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                  value={getEditingObjectProperty('power', '')}
                  onChange={(e) => updateEditingObjectProperty('power', e.target.value)}
                  placeholder="melee,power/melee_slash,25"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Passive Powers (one power id per line)</label>
                <textarea
                  className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                  value={getEditingObjectProperty('passive_powers', '')}
                  onChange={(e) => updateEditingObjectProperty('passive_powers', e.target.value)}
                  placeholder="power_id"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quest Loot (one per line: status,not_status,item_id)</label>
                <textarea
                  className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                  value={getEditingObjectProperty('quest_loot', '')}
                  onChange={(e) => updateEditingObjectProperty('quest_loot', e.target.value)}
                  placeholder="status_required,status_block,item_id"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Flee Duration</label>
                  <Input
                    value={getEditingObjectProperty('flee_duration', '')}
                    onChange={(e) => updateEditingObjectProperty('flee_duration', e.target.value)}
                    placeholder="1.5s"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Flee Cooldown</label>
                  <Input
                    value={getEditingObjectProperty('flee_cooldown', '')}
                    onChange={(e) => updateEditingObjectProperty('flee_cooldown', e.target.value)}
                    placeholder="5s"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'humanoid', label: 'Humanoid' },
                  { key: 'lifeform', label: 'Lifeform' },
                  { key: 'flying', label: 'Flying' },
                  { key: 'intangible', label: 'Intangible' },
                  { key: 'facing', label: 'Facing' },
                  { key: 'suppress_hp', label: 'Hide HP Bar' }
                ].map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={getEditingObjectProperty(field.key, 'false') === 'true'}
                      onChange={(e) => updateEditingObjectBoolean(field.key, e.target.checked)}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {editingObject.type === 'event' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Activate</label>
              <Input
                value={editingObject.activate || 'on_trigger'}
                onChange={(e) => setEditingObject({...editingObject, activate: e.target.value})}
                placeholder="on_trigger, on_load, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hotspot</label>
              <Input
                value={editingObject.hotspot || '0,0,1,1'}
                onChange={(e) => setEditingObject({...editingObject, hotspot: e.target.value})}
                placeholder="x,y,width,height"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tooltip</label>
              <Input
                value={editingObject.tooltip || ''}
                onChange={(e) => setEditingObject({...editingObject, tooltip: e.target.value})}
                placeholder="Hover text"
              />
            </div>
          </>
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
  );

  return createPortal(dialogContent, document.body);
};

export default ObjectManagementDialog;

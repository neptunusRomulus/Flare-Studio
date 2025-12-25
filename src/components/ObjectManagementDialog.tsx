import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { AlertTriangle, Check, Gift, HelpCircle, Image, MessageSquare, Package, Save, Sparkles, Trash2, User, Users, X } from 'lucide-react';
import type { DialogueTree, FlareNPC, MapObject } from '@/types';
import { NPC_ROLE_OPTIONS, ENEMY_ROLE_OPTIONS } from '@/editor/actorRoles';
import { ITEM_ROLE_META, RESOURCE_SUBTYPE_META } from '@/editor/itemRoles';
import type { ItemResourceSubtype } from '@/editor/itemRoles';

const ObjectManagementDialog = ({
  showObjectDialog,
  editingObject,
  objectValidationErrors,
  setEditingObject,
  handleObjectDialogClose,
  handleObjectDialogSave,
  updateEditingObjectProperty,
  editor,
  syncMapObjects,
  canUseTilesetDialog,
  handleEditingTilesetBrowse,
  handleEditingPortraitBrowse,
  handleEditingPreviewBrowse,
  handleOpenVendorStockDialog,
  handleOpenVendorUnlockDialog,
  handleOpenVendorRandomDialog,
  handleOpenVendorStockAdd,
  handleOpenVendorUnlockAdd,
  handleOpenVendorRandomAdd,
  handleEditDialogueTrees,
  handleDeleteEditingObject,
  handleToggleActorRole,
  handleEditObjectField,
  editingNpcDialogues,
  setEditingNpcDialogues,
  dialogueTrees,
  setDialogueTrees,
  setActiveDialogueTab,
  setShowDialogueTreeDialog,
  editingItem,
  setEditingItem,
  updateEditingItemField,
  editingNpcVendorStock,
  setEditingNpcVendorStock,
  editingNpcVendorUnlocks,
  setEditingNpcVendorUnlocks,
  editingNpcVendorRandom,
  setEditingNpcVendorRandom,
  editingNpcDisplayName,
  setEditingNpcDisplayName,
  editingNpcTitle,
  setEditingNpcTitle,
  editingNpcDialogue,
  setEditingNpcDialogue,
  editingNpcCanTalk,
  setEditingNpcCanTalk,
  editingNpcCanTrade,
  setEditingNpcCanTrade,
  editingNpcCanQuest,
  setEditingNpcCanQuest,
  editingNpcHeroStartX,
  setEditingNpcHeroStartX,
  editingNpcHeroStartY,
  setEditingNpcHeroStartY,
  editingNpcLevelOverride,
  setEditingNpcLevelOverride,
  editingNpcNoStatScaling,
  setEditingNpcNoStatScaling,
  editingNpcAbilityIds,
  setEditingNpcAbilityIds,
  editingNpcPowerLevel,
  setEditingNpcPowerLevel,
  editingNpcPowerMods,
  setEditingNpcPowerMods,
  editingNpcPowerModsDesc,
  setEditingNpcPowerModsDesc,
  editingNpcDialogueNpc,
  setEditingNpcDialogueNpc,
  editingNpcDialoguePlayer,
  setEditingNpcDialoguePlayer,
  editingNpcDialogueTrigger,
  setEditingNpcDialogueTrigger,
  editingNpcDialogueQuest,
  setEditingNpcDialogueQuest,
  editingNpcDialogueReward,
  setEditingNpcDialogueReward,
  editingNpcDialogueStatus,
  setEditingNpcDialogueStatus,
  editingNpcDialogueType,
  setEditingNpcDialogueType,
  editingNpcDialogueName,
  setEditingNpcDialogueName,
  editingNpcDialogueText,
  setEditingNpcDialogueText,
  editingNpcDialogueEvents,
  setEditingNpcDialogueEvents,
  editingNpcDialogueLineIndex,
  setEditingNpcDialogueLineIndex,
  editingNpcDialogueTopic,
  setEditingNpcDialogueTopic,
  editingNpcDialogueRequirements,
  setEditingNpcDialogueRequirements,
  editingNpcDialogueRewards,
  setEditingNpcDialogueRewards,
  editingNpcDialogueWorldEffects,
  setEditingNpcDialogueWorldEffects,
  editingNpcDialoguePreview,
  setEditingNpcDialoguePreview,
  editingNpcDialogueEditor,
  setEditingNpcDialogueEditor,
  setEditingNpcDialogue,
  setEditingNpcDialogueEvent,
  setEditingNpcDialogueNode,
  setEditingNpcDialogueTextNode,
  setEditingNpcDialogueTopicNode,
  setEditingNpcDialogueChoice,
  setEditingNpcDialogueChoiceNode,
  setEditingNpcDialogueRewardNode,
  setEditingNpcDialogueRequirementNode,
  setEditingNpcDialogueWorldEffectNode,
  setEditingNpcDialogueTriggerNode,
  showDeleteNpcConfirm,
  setShowDeleteNpcConfirm,
  showDeleteEnemyConfirm,
  setShowDeleteEnemyConfirm
}: any) => (
<Dialog
  open={showObjectDialog && editingObject?.type !== 'enemy'}
  onOpenChange={(open) => {
    if (!open) {
      handleObjectDialogClose();
    }
  }}
>
  <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col">
    <DialogHeader className="mb-4">
      <DialogTitle className="flex items-center gap-2">
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
      </DialogTitle>
    </DialogHeader>
    {objectValidationErrors.length > 0 && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-semibold mb-1">Please fix the following:</p>
            <ul className="ml-4 list-disc space-y-1">
              {objectValidationErrors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 minimal-scroll">
          {editingObject && (
            <div className="space-y-3 pb-4">
        {/* Basic Info Row */}
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
                disabled={editingObject.type === 'npc' || editingObject.type === 'enemy'}
                className={`h-8 w-11 px-1 text-center ${(editingObject.type === 'npc' || editingObject.type === 'enemy') ? 'opacity-50' : ''}`}
              />
              <span className="text-muted-foreground text-xs">,</span>
              <Input
                type="number"
                value={editingObject.y}
                onChange={(e) => setEditingObject({...editingObject, y: Number(e.target.value)})}
                disabled={editingObject.type === 'npc' || editingObject.type === 'enemy'}
                className={`h-8 w-11 px-1 text-center ${(editingObject.type === 'npc' || editingObject.type === 'enemy') ? 'opacity-50' : ''}`}
              />
            </div>
          </div>
        </div>

        {editingObject.type === 'enemy' ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Enemy details are edited in the enemy tab.
          </div>
        ) : (
          <>

        {/* NPC Roles */}
        {editingObject.type === 'npc' && (
          <div className="flex gap-1.5">
            {[
              { key: 'talker', label: 'Talker', color: 'blue' },
              { key: 'vendor', label: 'Vendor', color: 'emerald' },
              { key: 'questGiver', label: 'Quest', color: 'amber' }
            ].map(role => (
              <button
                key={role.key}
                type="button"
                onClick={() => {
                  const newProps = { ...editingObject.properties };
                  if (newProps[role.key] === 'true') {
                    delete newProps[role.key];
                  } else {
                    newProps[role.key] = 'true';
                  }
                  setEditingObject({ ...editingObject, properties: newProps });
                }}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  editingObject.properties?.[role.key] === 'true'
                    ? role.color === 'blue' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                    : role.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50'
                    : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        )}

        {/* Tileset & Portrait for NPC/Enemy */}
        {(editingObject.type === 'npc' || editingObject.type === 'enemy') && (
          <div className="space-y-2">
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
            {editingObject.type === 'npc' && (
              <div className="flex gap-2">
                <Input
                  className="h-8 flex-1 text-xs"
                  value={getEditingObjectProperty('portraitPath', '')}
                  onChange={(e) => updateEditingObjectProperty('portraitPath', e.target.value)}
                  placeholder="Portrait path..."
                  readOnly={canUseTilesetDialog}
                  onClick={canUseTilesetDialog ? () => { void handleEditingPortraitBrowse(); } : undefined}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 gap-2"
                  onClick={() => { void handleEditingPortraitBrowse(); }}
                  disabled={!canUseTilesetDialog}
                >
                  <User className="w-4 h-4" />
                  <span className="text-xs">Portrait</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Role-specific compact options */}
        {editingObject.type === 'npc' && editingObject.properties?.talker === 'true' && (
          <div className="pl-2 border-l-2 border-blue-500/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs gap-2"
              onClick={() => {
                // Load existing dialogue trees from properties if any
                const existingTrees = editingObject.properties?.dialogueTrees;
                if (existingTrees) {
                  try {
                    const parsed = JSON.parse(existingTrees as string);
                    // Ensure rewards and worldEffects exist for backward compatibility
                    const normalized = parsed.map((t: DialogueTree) => ({
                      ...t,
                      rewards: t.rewards || [],
                      worldEffects: t.worldEffects || []
                    }));
                    setDialogueTrees(normalized);
                  } catch {
                    setDialogueTrees([{ id: '1', topic: '', requirements: [], dialogues: [], rewards: [], worldEffects: [] }]);
                  }
                } else {
                  setDialogueTrees([{ id: '1', topic: '', requirements: [], dialogues: [], rewards: [], worldEffects: [] }]);
                }
                setActiveDialogueTab(0);
                setShowDialogueTreeDialog(true);
              }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Edit Dialogue Trees
            </Button>
          </div>
        )}

        {editingObject.type === 'npc' && editingObject.properties?.vendor === 'true' && (
          <div className="pl-2 border-l-2 border-emerald-500/50">
            <div className="space-y-1.5 flex flex-col">
              <div className="w-full">
                <Tooltip content="Items that are always in this vendor's shop.">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs gap-2 justify-start"
                    onClick={handleOpenVendorStockDialog}
                  >
                    <Package className="w-3.5 h-3.5" />
                    Edit Always Available Items
                  </Button>
                </Tooltip>
              </div>
              <div className="w-full">
                <Tooltip content="Extra items that appear after certain quests or story steps.">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs gap-2 justify-start"
                    onClick={handleOpenVendorUnlockDialog}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    Edit Unlockable Items
                  </Button>
                </Tooltip>
              </div>
              <div className="w-full">
                <Tooltip content="Extra items randomly picked from a loot table each time.">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs gap-2 justify-start"
                    onClick={handleOpenVendorRandomDialog}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Edit Random Offers
                  </Button>
                </Tooltip>
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

    <DialogFooter className="mt-4 flex-shrink-0">
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
          <Button variant="outline" size="icon" onClick={handleObjectDialogClose} aria-label="Cancel edit">
            <X className="w-4 h-4" />
          </Button>
          <Button size="icon" onClick={handleObjectDialogSave} aria-label="Save">
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>

);

export default ObjectManagementDialog;

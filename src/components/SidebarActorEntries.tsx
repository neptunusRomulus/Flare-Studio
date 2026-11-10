import type { DragEvent } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { entityPlacement } from '@/components/entityPlacement';
import { AlertTriangle, Check, GripVertical, HelpCircle, Plus, User, X } from 'lucide-react';
import type { MapObject } from '@/types';
import { propertyText } from '@/editor/propertyText';
import { ENEMY_ROLE_META_LOOKUP } from '@/editor/actorRoles';
import { checkNpcDraftName } from '@/editor/npcDraft';
import ElementContextMenu from '@/components/ElementContextMenu';
import ListItemTooltip from '@/components/ListItemTooltip';
import useListReorder from '@/hooks/useListReorder';

type ActorEntriesPanelProps = {
  isNpcLayer: boolean;
  isEnemyLayer: boolean;
  actorEntries: MapObject[];
  leftCollapsed: boolean;
  draggingNpcId: number | null;
  onEditObject: (actorId: number) => void;
  onEditEnemyTemplate: (actorId: number) => void;
  onDuplicateObject: (actorId: number) => void;
  onDeleteObject: (actorId: number) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, actorId: number) => void;
  onDragEnd: () => void;
  onReorderActors: (fromIndex: number, toIndex: number) => void;
  onAddNpc: () => void;
  onAddEnemy: () => void;
  /** Creates an NPC from the inline draft row and returns its id (null on failure). */
  onCreateActorShell?: (name: string, type?: 'npc' | 'enemy') => Promise<number | null>;
};

const SidebarActorEntries = ({
  isNpcLayer,
  isEnemyLayer,
  actorEntries,
  leftCollapsed,
  draggingNpcId,
  onEditObject,
  onEditEnemyTemplate,
  onDuplicateObject,
  onDeleteObject,
  onDragStart,
  onDragEnd,
  onReorderActors,
  onAddNpc,
  onAddEnemy,
  onCreateActorShell,
}: ActorEntriesPanelProps) => {
  const armed = React.useSyncExternalStore(entityPlacement.subscribe, entityPlacement.get, entityPlacement.get);
  const { getItemDragProps, reorderClass } = useListReorder(
    actorEntries,
    (a) => a.id,
    onReorderActors,
  );

  // "+ NPC" opens a draft row instead of a dialog: name first, roles later in Edit NPC.
  const [draftName, setDraftName] = React.useState<string | null>(null);
  const [draftBusy, setDraftBusy] = React.useState(false);
  const [draftHeadsUp, setDraftHeadsUp] = React.useState<null | { message: string; confirmLabel?: string }>(null);
  const draftInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (draftName !== null) draftInputRef.current?.focus();
  }, [draftName]);

  const openDraft = () => {
    // No shell creator wired (e.g. another host): keep the old add dialog.
    if (!onCreateActorShell) {
      onAddNpc();
      return;
    }
    setDraftName('');
    setDraftHeadsUp(null);
  };

  const closeDraft = () => {
    setDraftName(null);
    setDraftHeadsUp(null);
    setDraftBusy(false);
  };

  const submitDraft = async (force = false) => {
    if (draftName === null || draftBusy) return;
    const check = checkNpcDraftName(draftName, actorEntries.map((actor) => actor.name || ''), force);
    if (!check.ok) {
      setDraftHeadsUp({ message: check.message, confirmLabel: check.needsConfirm ? 'Create anyway' : undefined });
      return;
    }
    if (!onCreateActorShell) {
      setDraftHeadsUp({ message: 'NPC could not be created here.' });
      return;
    }
    setDraftBusy(true);
    const id = await onCreateActorShell(check.name, 'npc');
    setDraftBusy(false);
    if (id === null) {
      setDraftHeadsUp({ message: 'NPC could not be created. Place a map first.' });
      return;
    }
    closeDraft();
  };

  return (
  <>
    {/* Add button sits right under the sub-switch, above the list */}
    {isNpcLayer && (
      <div className="flex justify-center py-2">
        <Tooltip content="Add NPC" side="bottom">
          <Button
            variant="default"
            size="sm"
            aria-label="Add NPC"
            className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              openDraft();
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            NPC
          </Button>
        </Tooltip>
      </div>
    )}
    {isEnemyLayer && (
      <div className="flex justify-center py-2">
        <Tooltip content="Add Enemy" side="bottom">
          <Button
            variant="default"
            size="sm"
            aria-label="Add Enemy"
            className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              console.log('[UI] Add Enemy button clicked');
              onAddEnemy();
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            Enemy
          </Button>
        </Tooltip>
      </div>
    )}
    {(isNpcLayer || isEnemyLayer) && (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {actorEntries.length === 0 && draftName === null ? (
          <div className="h-full border border-dashed border-border rounded-md flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
            {isNpcLayer ? 'No NPCs added yet. Use the Add control to create your first NPC.' : 'No enemies added yet. Use the Add control to place an enemy.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {draftName !== null && (
              <div className="rounded-md border border-dashed border-orange-500/60 bg-background px-2 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="shrink-0 w-10 h-10 rounded border border-dashed border-muted-foreground/40 bg-muted/50 flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <Input
                    ref={draftInputRef}
                    className="h-7 text-sm flex-1 min-w-0"
                    value={draftName}
                    placeholder="NPC name"
                    aria-label="New NPC name"
                    disabled={draftBusy}
                    onChange={(event) => { setDraftName(event.target.value); setDraftHeadsUp(null); }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') { event.preventDefault(); void submitDraft(); }
                      if (event.key === 'Escape') { event.preventDefault(); closeDraft(); }
                    }}
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Cancel NPC"
                      disabled={draftBusy}
                      onClick={closeDraft}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Create NPC"
                      disabled={draftBusy}
                      onClick={() => void submitDraft()}
                    >
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </Button>
                  </div>
                </div>
                {draftHeadsUp && (
                  <div className="rounded-md border border-amber-500/50 bg-muted/30 shadow-sm text-xs p-2 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[13px] font-semibold text-foreground">Heads up</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{draftHeadsUp.message}</div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Dismiss"
                        onClick={() => setDraftHeadsUp(null)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                      {draftHeadsUp.confirmLabel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={draftHeadsUp.confirmLabel}
                          onClick={() => { setDraftHeadsUp(null); void submitDraft(true); }}
                        >
                          <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {actorEntries.map((actor, index) => {
              const isTalker = actor.properties?.talker === 'true' || actor.properties?.talker === '1';
              const isVendor = actor.properties?.vendor === 'true' || actor.properties?.vendor === '1';
              const isQuestGiver = actor.properties?.questGiver === 'true' || actor.properties?.questGiver === '1';
              const hasNpcRole = isTalker || isVendor || isQuestGiver;
              const enemyRoles = {
                melee: actor.properties?.melee === 'true' || actor.properties?.melee === '1',
                ranged: actor.properties?.ranged === 'true' || actor.properties?.ranged === '1',
                caster: actor.properties?.caster === 'true' || actor.properties?.caster === '1',
                summoner: actor.properties?.summoner === 'true' || actor.properties?.summoner === '1',
                boss: actor.properties?.boss === 'true' || actor.properties?.boss === '1',
                passive: actor.properties?.passive === 'true' || actor.properties?.passive === '1',
                stationary: actor.properties?.stationary === 'true' || actor.properties?.stationary === '1'
              };
              const hasEnemyRole = Object.values(enemyRoles).some(Boolean);
              const portraitPath = propertyText(actor.properties?.portraitPath) || undefined;
              const isPlacedOnMap = actor.x >= 0 && actor.y >= 0;

              return (
                <ListItemTooltip key={actor.id} item={{ id: actor.id, name: actor.name || `${actor.type === 'npc' ? 'NPC' : 'Enemy'} #${actor.id}` }}>
                <ElementContextMenu
                  elementType={isNpcLayer ? 'npc' : 'enemy'}
                  onEdit={() => isEnemyLayer ? onEditEnemyTemplate(actor.id) : onEditObject(actor.id)}
                  onDuplicate={() => onDuplicateObject(actor.id)}
                  onDelete={() => onDeleteObject(actor.id)}
                >
                <div
                  {...getItemDragProps(index)}
                  className={`w-full box-border rounded-md px-2 py-2 hover:bg-background transition-colors cursor-pointer border border-dashed border-gray-400 dark:border-gray-600 flex ${
                    isPlacedOnMap ? 'bg-background/50' : 'bg-muted/20'
                  } ${draggingNpcId === actor.id ? 'opacity-50' : ''} ${reorderClass(index)}`}
                  onClick={() => isEnemyLayer ? onEditEnemyTemplate(actor.id) : onEditObject(actor.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={`flex-shrink-0 w-10 h-10 rounded border bg-muted/50 flex items-center justify-center overflow-hidden ${
                      isPlacedOnMap ? 'border-border' : 'border-dashed border-muted-foreground/40'
                    }`}
                    >
                      {portraitPath ? (
                        <img
                          src={portraitPath}
                          alt={actor.name || 'NPC portrait'}
                          className={`w-full h-full object-cover ${!isPlacedOnMap ? 'opacity-50' : ''}`}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                            event.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <HelpCircle className={`w-5 h-5 text-muted-foreground ${portraitPath ? 'hidden' : ''}`} />
                    </div>
                    <div className="space-y-1 text-sm flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        <span className={leftCollapsed ? 'sr-only' : ''}>{actor.name || `${actor.type === 'npc' ? 'NPC' : 'Enemy'} #${actor.id}`}</span>
                        {!actor.name && leftCollapsed && <span className="text-xs text-muted-foreground">#{actor.id}</span>}
                      </div>
                      {isNpcLayer && !leftCollapsed && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {isTalker && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                              Talker
                            </span>
                          )}
                          {isVendor && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Vendor
                            </span>
                          )}
                          {isQuestGiver && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              Quest
                            </span>
                          )}
                          {!hasNpcRole && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400 border border-gray-500/30">
                              Static
                            </span>
                          )}
                        </div>
                      )}
                      {isEnemyLayer && !leftCollapsed && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {enemyRoles.melee && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ENEMY_ROLE_META_LOOKUP.isMelee.badgeClass}`}>
                              {ENEMY_ROLE_META_LOOKUP.isMelee.label}
                            </span>
                          )}
                          {enemyRoles.ranged && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ENEMY_ROLE_META_LOOKUP.isRanged.badgeClass}`}>
                              {ENEMY_ROLE_META_LOOKUP.isRanged.label}
                            </span>
                          )}
                          {enemyRoles.caster && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ENEMY_ROLE_META_LOOKUP.isCaster.badgeClass}`}>
                              {ENEMY_ROLE_META_LOOKUP.isCaster.label}
                            </span>
                          )}
                          {enemyRoles.summoner && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ENEMY_ROLE_META_LOOKUP.isSummoner.badgeClass}`}>
                              {ENEMY_ROLE_META_LOOKUP.isSummoner.label}
                            </span>
                          )}
                          {enemyRoles.boss && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ENEMY_ROLE_META_LOOKUP.isBoss.badgeClass}`}>
                              {ENEMY_ROLE_META_LOOKUP.isBoss.label}
                            </span>
                          )}
                          {enemyRoles.passive && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ENEMY_ROLE_META_LOOKUP.isPassive.badgeClass}`}>
                              {ENEMY_ROLE_META_LOOKUP.isPassive.label}
                            </span>
                          )}
                          {enemyRoles.stationary && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${ENEMY_ROLE_META_LOOKUP.isStationary.badgeClass}`}>
                              {ENEMY_ROLE_META_LOOKUP.isStationary.label}
                            </span>
                          )}
                          {!hasEnemyRole && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400 border border-gray-500/30">
                              Unassigned
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {(isNpcLayer || isEnemyLayer) && (
                      <Tooltip content={isNpcLayer ? 'Drag to the map, or click then click the map to place NPC' : 'Drag to the map, or click then click the map to place enemy'}>
                        <div
                          draggable
                          onDragStart={(event) => onDragStart(event, actor.id)}
                          onDragEnd={onDragEnd}
                          className={`w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors flex-shrink-0 rounded ${armed?.id === actor.id ? 'text-primary ring-1 ring-primary' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={(event) => { event.stopPropagation(); entityPlacement.toggle({ id: actor.id, type: (isNpcLayer ? 'npc' : 'enemy') }); }}
                          data-armed={armed?.id === actor.id ? 'true' : undefined}
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>
                      </Tooltip>
                    )}
                  </div>
                </div>
                </ElementContextMenu>
                </ListItemTooltip>
              );
            })}
          </div>
        )}
      </div>
    )}
  </>
  );
};

export default SidebarActorEntries;

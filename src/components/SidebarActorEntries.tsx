import type { DragEvent } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { GripVertical, HelpCircle, Plus } from 'lucide-react';
import type { MapObject } from '@/types';
import { ENEMY_ROLE_META_LOOKUP } from '@/editor/actorRoles';

type ActorEntriesPanelProps = {
  isNpcLayer: boolean;
  isEnemyLayer: boolean;
  actorEntries: MapObject[];
  leftCollapsed: boolean;
  draggingNpcId: number | null;
  onEditObject: (actorId: number) => void;
  onHover: (position: { x: number; y: number }) => void;
  onHoverEnd: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, actorId: number) => void;
  onDragEnd: () => void;
  onAddNpc: () => void;
  onAddEnemy: () => void;
};

const SidebarActorEntries = ({
  isNpcLayer,
  isEnemyLayer,
  actorEntries,
  leftCollapsed,
  draggingNpcId,
  onEditObject,
  onHover,
  onHoverEnd,
  onDragStart,
  onDragEnd,
  onAddNpc,
  onAddEnemy
}: ActorEntriesPanelProps) => (
  <>
    {(isNpcLayer || isEnemyLayer) && (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {actorEntries.length === 0 ? (
          <div className="h-full border border-dashed border-border rounded-md flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
            {isNpcLayer ? 'No NPCs added yet. Use the Add control to create your first NPC.' : 'No enemies added yet. Use the Add control to place an enemy.'}
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1">
            {actorEntries.map((actor) => {
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
              const portraitPath = actor.properties?.portraitPath;
              const isPlacedOnMap = actor.x >= 0 && actor.y >= 0;

              return (
                <div
                  key={actor.id}
                  className={`rounded-md px-2 py-2 hover:bg-background transition-colors cursor-pointer ${
                    isPlacedOnMap
                      ? 'border-2 border-orange-500 bg-background/50'
                      : 'border border-dashed border-gray-400 dark:border-gray-600 bg-muted/20'
                  } ${draggingNpcId === actor.id ? 'opacity-50' : ''}`}
                  onClick={() => onEditObject(actor.id)}
                  onMouseMove={(event) => onHover({ x: event.clientX, y: event.clientY })}
                  onMouseLeave={onHoverEnd}
                >
                  <div className="flex items-center gap-2">
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
                      <HelpCircle className={`w-5 h-5 text-muted-foreground ${portraitPath ? 'hidden' : ''} ${!isPlacedOnMap ? 'opacity-50' : ''}`} />
                    </div>
                    <div className="space-y-1 text-sm flex-1 min-w-0">
                      <div className={`font-medium ${isPlacedOnMap ? 'text-foreground' : 'text-muted-foreground'}`} title={actor.name || `${actor.type === 'npc' ? 'NPC' : 'Enemy'} #${actor.id}`}>
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
                      <Tooltip content={isNpcLayer ? 'Drag and drop to place NPC on map' : 'Drag and drop to place enemy on map'}>
                        <div
                          draggable
                          onDragStart={(event) => onDragStart(event, actor.id)}
                          onDragEnd={onDragEnd}
                          className="w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}
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
              console.log('[UI] Add NPC button clicked');
              onAddNpc();
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
  </>
);

export default SidebarActorEntries;

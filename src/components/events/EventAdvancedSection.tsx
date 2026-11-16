import React from 'react';
import { Zap } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EventSectionShell from './EventSectionShell';
import type { EventSectionProps } from './eventDialogModel';

type Props = EventSectionProps;

/** Power, map modification, restore, NPC/music/book and advanced flags. */
export default function EventAdvancedSection({ eventData, setEventData, expandedSections, toggleSection }: Props) {
  return (
    <EventSectionShell
      title="Advanced Effects"
      icon={Zap}
      id="advanced-effects"
      isExpanded={expandedSections.advancedEffects}
      onToggle={() => toggleSection('advancedEffects')}
    >
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Advanced Effects</h3>

        {/* Power Effects */}
        <div className="space-y-4 border-t pt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">Power & Spell Effects</Label>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">Power ID</Label>
              <Input
                value={eventData.rewards.power}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, power: e.target.value } }))}
                placeholder="e.g. fireball, heal, lightning"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">Power Path</Label>
              <Input
                value={eventData.rewards.powerPath}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, powerPath: e.target.value } }))}
                placeholder="data1,data2[,hero]"
                className="h-7 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Power Damage</Label>
                <Input
                  type="number"
                  min="0"
                  value={eventData.rewards.powerDamage}
                  onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, powerDamage: Math.max(0, parseInt(e.target.value) || 0) } }))}
                  placeholder="Damage amount"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Power Level</Label>
                <Input
                  value={eventData.rewards.powerLevel}
                  onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, powerLevel: e.target.value } }))}
                  placeholder="1 or hero_level,1"
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">Power Stats</Label>
              <Input
                value={eventData.rewards.powerStats}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, powerStats: e.target.value } }))}
                placeholder="Stat modifications"
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Map Modification */}
        <div className="space-y-4 border-t pt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">Map Modification</Label>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">MapMod</Label>
              <Input
                value={eventData.rewards.mapmod}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, mapmod: e.target.value } }))}
                placeholder="s,data1,data2,data3"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">MapMod Toggle</Label>
              <Input
                value={eventData.rewards.mapmodToggle}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, mapmodToggle: e.target.value } }))}
                placeholder="layer,x,y,tileA,tileB"
                className="h-7 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Requires Tile</Label>
                <Input value={eventData.rewards.requiresTile} onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, requiresTile: e.target.value } }))} placeholder="layer,x,y,tile" className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Requires Not Tile</Label>
                <Input value={eventData.rewards.requiresNotTile} onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, requiresNotTile: e.target.value } }))} placeholder="layer,x,y,tile" className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Spawn Level</Label>
                <Input value={eventData.rewards.spawnLevel} onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, spawnLevel: e.target.value } }))} placeholder="fixed,2 or level,min,max" className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Intermap Id</Label>
                <Input value={eventData.rewards.intermapId} onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, intermapId: e.target.value } }))} className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Procgen File</Label>
                <Input value={eventData.rewards.procgenFilename} onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, procgenFilename: e.target.value } }))} className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Procgen Link</Label>
                <Input value={eventData.rewards.procgenLink} onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, procgenLink: e.target.value } }))} className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground/80">Procgen Door Level</Label>
                <Input value={eventData.rewards.procgenDoorLevel} onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, procgenDoorLevel: e.target.value } }))} className="h-7 text-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Restore */}
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground/80">Restore</Label>
            <Input
              value={eventData.rewards.restore}
              onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, restore: e.target.value } }))}
              placeholder="e.g. hp,mp,stats"
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* NPC, Music, Book */}
        <div className="space-y-4 border-t pt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">NPC / Music / Book</Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">NPC</Label>
              <Input
                value={eventData.rewards.npc}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, npc: e.target.value } }))}
                placeholder="NPC reference"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">Music</Label>
              <Input
                value={eventData.rewards.music}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, music: e.target.value } }))}
                placeholder="Music track"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">Book</Label>
              <Input
                value={eventData.rewards.book}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, book: e.target.value } }))}
                placeholder="Book text"
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Advanced Flags */}
        <div className="space-y-4 border-t pt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">Advanced Flags</Label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Label className="flex items-center gap-2 cursor-pointer font-normal">
                <Checkbox
                  checked={eventData.rewards.respec}
                  onCheckedChange={(value) => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, respec: value === true } }))}
                  className="h-4 w-4"
                />
                <span className="text-xs">Respec (XP/Stats/Powers)</span>
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer font-normal">
                <Checkbox
                  checked={eventData.rewards.showOnMinimap}
                  onCheckedChange={(value) => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, showOnMinimap: value === true } }))}
                  className="h-4 w-4"
                />
                <span className="text-xs">Show on Minimap</span>
              </Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">Parallax Layers</Label>
              <Input
                value={eventData.rewards.parallaxLayers}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, parallaxLayers: e.target.value } }))}
                placeholder="Layer configuration"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground/80">Random Status</Label>
              <Input
                value={eventData.rewards.randomStatus}
                onChange={e => setEventData(prev => ({ ...prev, rewards: { ...prev.rewards, randomStatus: e.target.value } }))}
                placeholder="mode,status_name"
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </EventSectionShell>
  );
}

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { BEHAVIOR_PRESET_IDS, BEHAVIOR_PRESET_META, type BehaviorPresetId } from '@/editor/enemyBehaviorPresets';
import { BEHAVIOR_ICONS, enemyPropertyTooltips } from './enemyModel';
import { Flag, LabelWithTooltip, MoreToggle, EditorSection, enemyInputCls } from './enemyFormPrimitives';

export type EnemyBehaviorSectionProps = {
  behaviorPreset: BehaviorPresetId | null;
  applyBehavior: (id: BehaviorPresetId) => void;
  behaviorMore: boolean; setBehaviorMore: React.Dispatch<React.SetStateAction<boolean>>;
  combatStyle: 'default' | 'aggressive' | 'passive'; setCombatStyle: (v: 'default' | 'aggressive' | 'passive') => void;
  isStationary: boolean; setIsStationary: (v: boolean) => void;
  threatRange: string; setThreatRange: (v: string) => void;
  fleeRange: string; setFleeRange: (v: string) => void;
  chancePursue: string; setChancePursue: (v: string) => void;
  chanceFlee: string; setChanceFlee: (v: string) => void;
  fleeDuration: string; setFleeDuration: (v: string) => void;
  fleeCooldown: string; setFleeCooldown: (v: string) => void;
  turnDelay: string; setTurnDelay: (v: string) => void;
  wanderRadius: string; setWanderRadius: (v: string) => void;
  waypoints: string; setWaypoints: (v: string) => void;
  waypointPause: string; setWaypointPause: (v: string) => void;
  isFacing: boolean; setIsFacing: (v: boolean) => void;
  isFlying: boolean; setIsFlying: (v: boolean) => void;
  isIntangible: boolean; setIsIntangible: (v: boolean) => void;
};

const EnemyBehaviorSection = ({
  behaviorPreset, applyBehavior,
  behaviorMore, setBehaviorMore,
  combatStyle, setCombatStyle,
  isStationary, setIsStationary,
  threatRange, setThreatRange,
  fleeRange, setFleeRange,
  chancePursue, setChancePursue,
  chanceFlee, setChanceFlee,
  fleeDuration, setFleeDuration,
  fleeCooldown, setFleeCooldown,
  turnDelay, setTurnDelay,
  wanderRadius, setWanderRadius,
  waypoints, setWaypoints,
  waypointPause, setWaypointPause,
  isFacing, setIsFacing,
  isFlying, setIsFlying,
  isIntangible, setIsIntangible,
}: EnemyBehaviorSectionProps) => (
    <EditorSection title="Behavior">
      <div className="grid grid-cols-4 gap-1.5">
        {BEHAVIOR_PRESET_IDS.map((id) => {
          const meta = BEHAVIOR_PRESET_META[id];
          const Icon = BEHAVIOR_ICONS[id];
          const active = behaviorPreset === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              onClick={() => applyBehavior(id)}
              className={`h-auto min-w-0 rounded-md border px-2 py-1.5 text-left hover:bg-muted/40 ${active ? 'border-orange-500 bg-muted/40' : 'border-border bg-muted/20'}`}
              aria-pressed={active}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium leading-none truncate">{meta.label}</span>
              </div>
              <div className="h-3.5 mt-1 text-[10px] leading-[14px] text-muted-foreground truncate font-normal">{meta.hint}</div>
            </Button>
          );
        })}
      </div>
      <MoreToggle open={behaviorMore} onToggle={() => setBehaviorMore((v) => !v)}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <LabelWithTooltip field="combatStyle">Combat style</LabelWithTooltip>
            <Select value={combatStyle} onValueChange={(v: 'default' | 'aggressive' | 'passive') => setCombatStyle(v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
                <SelectItem value="passive">Passive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end pb-1">
            <Flag checked={isStationary} onChange={setIsStationary} label="Stationary" tip="stationary — Enemy does not walk." />
          </div>
          <div className="space-y-1"><LabelWithTooltip field="threatRange">Threat range</LabelWithTooltip><Input value={threatRange} onChange={(e) => setThreatRange(e.target.value)} className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="fleeRange">Flee range</LabelWithTooltip><Input value={fleeRange} onChange={(e) => setFleeRange(e.target.value)} className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="chancePursue">Chance pursue %</LabelWithTooltip><Input type="number" value={chancePursue} onChange={(e) => setChancePursue(e.target.value)} className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="chanceFlee">Chance flee %</LabelWithTooltip><Input type="number" value={chanceFlee} onChange={(e) => setChanceFlee(e.target.value)} className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="fleeDuration">Flee duration</LabelWithTooltip><Input value={fleeDuration} onChange={(e) => setFleeDuration(e.target.value)} placeholder="3s" className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="fleeCooldown">Flee cooldown</LabelWithTooltip><Input value={fleeCooldown} onChange={(e) => setFleeCooldown(e.target.value)} placeholder="5s" className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="turnDelay">Turn delay</LabelWithTooltip><Input value={turnDelay} onChange={(e) => setTurnDelay(e.target.value)} placeholder="200ms" className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="wanderRadius">Wander radius</LabelWithTooltip><Input value={wanderRadius} onChange={(e) => setWanderRadius(e.target.value)} className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="waypoints">Waypoints</LabelWithTooltip><Input value={waypoints} onChange={(e) => setWaypoints(e.target.value)} className={enemyInputCls} /></div>
          <div className="space-y-1"><LabelWithTooltip field="waypointPause">Waypoint pause</LabelWithTooltip><Input value={waypointPause} onChange={(e) => setWaypointPause(e.target.value)} className={enemyInputCls} /></div>
        </div>
        <div className="flex flex-wrap gap-4">
          <Flag checked={isFacing} onChange={setIsFacing} label="Faces target" tip={enemyPropertyTooltips.isFacing} />
          <Flag checked={isFlying} onChange={setIsFlying} label="Flying" tip={enemyPropertyTooltips.isFlying} />
          <Flag checked={isIntangible} onChange={setIsIntangible} label="Intangible" tip={enemyPropertyTooltips.isIntangible} />
        </div>
      </MoreToggle>
    </EditorSection>
);

export default EnemyBehaviorSection;

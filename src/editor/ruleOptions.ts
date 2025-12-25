import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Apple,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  Dices,
  Flag,
  Gift,
  Heart,
  MapPin,
  Puzzle,
  RefreshCw,
  Repeat,
  Skull,
  Swords,
  Trash2,
  Timer,
  UserPlus,
  Zap,
  ZapOff
} from 'lucide-react';

type RuleStartType = 'player' | 'game';

interface RuleTriggerOption {
  id: string;
  label: string;
  tooltip: string;
  icon: ComponentType<{ className?: string }>;
  startType: RuleStartType;
}

const PLAYER_TRIGGER_OPTIONS: RuleTriggerOption[] = [
  { id: 'item-used', label: 'Item Used', tooltip: 'When an item is used', icon: Apple, startType: 'player' },
  { id: 'skill-used', label: 'Skill Used', tooltip: 'When a skill is used', icon: Zap, startType: 'player' },
  { id: 'npc-interaction', label: 'NPC Interaction', tooltip: 'When an NPC option is chosen', icon: UserPlus, startType: 'player' }
];

const GAME_TRIGGER_OPTIONS: RuleTriggerOption[] = [
  { id: 'enemy-dies', label: 'Enemy dies', tooltip: 'Enemy dies', icon: Skull, startType: 'game' },
  { id: 'player-enters-area', label: 'Player enters area', tooltip: 'Player enters area', icon: MapPin, startType: 'game' },
  { id: 'combat-starts', label: 'Combat starts', tooltip: 'Combat starts', icon: Swords, startType: 'game' },
  { id: 'player-hit', label: 'Player is hit', tooltip: 'Player is hit', icon: Zap, startType: 'game' },
  { id: 'health-low', label: 'Health very low', tooltip: 'Health very low', icon: Heart, startType: 'game' },
  { id: 'effect-used', label: 'Another effect is used', tooltip: 'Another effect is used', icon: Repeat, startType: 'game' },
  { id: 'after-delay', label: 'After a delay', tooltip: 'After a delay', icon: Clock, startType: 'game' },
  { id: 'repeats-while-active', label: 'Repeats while active', tooltip: 'Repeats while active', icon: RefreshCw, startType: 'game' },
  { id: 'random-chance', label: 'Random chance', tooltip: 'Random chance', icon: Dices, startType: 'game' },
  { id: 'every-x-seconds', label: 'Every X seconds', tooltip: 'Every X seconds', icon: Timer, startType: 'game' }
];

const ALL_RULE_TRIGGER_OPTIONS: RuleTriggerOption[] = [...PLAYER_TRIGGER_OPTIONS, ...GAME_TRIGGER_OPTIONS];
const RULE_TRIGGER_LOOKUP: Record<string, RuleTriggerOption> = ALL_RULE_TRIGGER_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option;
  return acc;
}, {} as Record<string, RuleTriggerOption>);

type IconComponent = LucideIcon;

interface RuleActionGroup {
  id: string;
  title: string;
  tooltip?: string;
  icon: IconComponent;
  actions: Array<{ id: string; label: string; icon: IconComponent }>;
}

const RULE_ACTION_GROUPS: RuleActionGroup[] = [
  {
    id: 'items',
    title: 'Give or Take Items',
    tooltip: 'Give or Take Items',
    icon: Gift,
    actions: [
      { id: 'give-item', label: 'Give Item', icon: Gift },
      { id: 'remove-item', label: 'Remove Item', icon: Trash2 }
    ]
  },
  {
    id: 'flags',
    title: 'Change a game flag',
    tooltip: 'Conditions',
    icon: Flag,
    actions: [
      { id: 'set-flag', label: 'Set Condition', icon: Zap },
      { id: 'clear-flag', label: 'Unset Condition', icon: ZapOff }
    ]
  },
  {
    id: 'quests',
    title: 'Advance a quest',
    tooltip: 'Quest progression',
    icon: CheckCircle,
    actions: [
      { id: 'complete-quest', label: 'Complete Quest', icon: Check },
      { id: 'next-step', label: 'Next Step', icon: ArrowRight }
    ]
  },
  {
    id: 'advanced',
    title: 'Advanced',
    tooltip: 'Custom Action',
    icon: Puzzle,
    actions: []
  }
];

export type { RuleActionGroup, RuleStartType, RuleTriggerOption };
export { ALL_RULE_TRIGGER_OPTIONS, GAME_TRIGGER_OPTIONS, PLAYER_TRIGGER_OPTIONS, RULE_ACTION_GROUPS, RULE_TRIGGER_LOOKUP };

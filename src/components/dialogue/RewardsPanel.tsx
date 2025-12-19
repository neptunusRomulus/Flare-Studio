/**
 * Rewards Panel Component
 * 
 * Handles all event.reward_*, event.remove_*, event.restore attributes
 * with natural language UI showing "what player gains or loses"
 */

import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DialogRewardEffect,
  RewardEffectType,
  XPRewardEffect,
  CurrencyRewardEffect,
  ItemRewardEffect,
  LootRewardEffect,
  RestoreEffect,
  RestoreType,
  createRewardEffect,
  RESTORE_TYPE_LABELS
} from '../../types/dialogueEditor';
import { Plus, X, Coins, Package, Sparkles, Heart, Gift, ChevronDown } from 'lucide-react';

interface RewardsPanelProps {
  rewards: DialogRewardEffect[];
  onChange: (rewards: DialogRewardEffect[]) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

// Reward effect options for the dropdown
const REWARD_OPTIONS: { type: RewardEffectType; label: string; icon: React.ReactNode; isNegative: boolean }[] = [
  { type: 'reward_xp', label: 'Give XP', icon: <Sparkles className="w-3.5 h-3.5" />, isNegative: false },
  { type: 'reward_currency', label: 'Give gold', icon: <Coins className="w-3.5 h-3.5" />, isNegative: false },
  { type: 'remove_currency', label: 'Take gold', icon: <Coins className="w-3.5 h-3.5" />, isNegative: true },
  { type: 'reward_item', label: 'Give item', icon: <Package className="w-3.5 h-3.5" />, isNegative: false },
  { type: 'remove_item', label: 'Take item', icon: <Package className="w-3.5 h-3.5" />, isNegative: true },
  { type: 'reward_loot', label: 'Random loot', icon: <Gift className="w-3.5 h-3.5" />, isNegative: false },
  { type: 'restore', label: 'Heal / Restore', icon: <Heart className="w-3.5 h-3.5" />, isNegative: false },
];

export const RewardsPanel: React.FC<RewardsPanelProps> = ({
  rewards,
  onChange,
  expanded = true,
  onToggleExpand
}) => {
  const [showAddMenu, setShowAddMenu] = React.useState(false);

  const addReward = (type: RewardEffectType) => {
    const newReward = createRewardEffect(type);
    onChange([...rewards, newReward]);
    setShowAddMenu(false);
  };

  const updateReward = (id: string, updates: Partial<DialogRewardEffect>) => {
    onChange(rewards.map(r => r.id === id ? { ...r, ...updates } as DialogRewardEffect : r));
  };

  const removeReward = (id: string) => {
    onChange(rewards.filter(r => r.id !== id));
  };

  const renderRewardEditor = (reward: DialogRewardEffect) => {
    switch (reward.type) {
      case 'reward_xp':
        return (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+</span>
            <Input
              type="number"
              min={0}
              value={(reward as XPRewardEffect).amount}
              onChange={(e) => updateReward(reward.id, { amount: parseInt(e.target.value, 10) || 0 })}
              className="h-7 w-24 text-xs"
            />
            <span className="text-xs text-muted-foreground">XP</span>
          </div>
        );

      case 'reward_currency':
        return (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+</span>
            <Input
              type="number"
              min={0}
              value={(reward as CurrencyRewardEffect).amount}
              onChange={(e) => updateReward(reward.id, { amount: parseInt(e.target.value, 10) || 0 })}
              className="h-7 w-24 text-xs"
            />
            <span className="text-xs text-muted-foreground">gold</span>
          </div>
        );

      case 'remove_currency':
        return (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium text-red-600 dark:text-red-400">−</span>
            <Input
              type="number"
              min={0}
              value={(reward as CurrencyRewardEffect).amount}
              onChange={(e) => updateReward(reward.id, { amount: parseInt(e.target.value, 10) || 0 })}
              className="h-7 w-24 text-xs"
            />
            <span className="text-xs text-muted-foreground">gold</span>
          </div>
        );

      case 'reward_item':
        return (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+</span>
            <Input
              value={(reward as ItemRewardEffect).itemId}
              onChange={(e) => updateReward(reward.id, { itemId: e.target.value })}
              placeholder="Item ID..."
              className="h-7 flex-1 text-xs"
            />
            <span className="text-xs text-muted-foreground">×</span>
            <Input
              type="number"
              min={1}
              value={(reward as ItemRewardEffect).quantity}
              onChange={(e) => updateReward(reward.id, { quantity: parseInt(e.target.value, 10) || 1 })}
              className="h-7 w-16 text-xs"
            />
          </div>
        );

      case 'remove_item':
        return (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium text-red-600 dark:text-red-400">−</span>
            <Input
              value={(reward as ItemRewardEffect).itemId}
              onChange={(e) => updateReward(reward.id, { itemId: e.target.value })}
              placeholder="Item ID..."
              className="h-7 flex-1 text-xs"
            />
            <span className="text-xs text-muted-foreground">×</span>
            <Input
              type="number"
              min={1}
              value={(reward as ItemRewardEffect).quantity}
              onChange={(e) => updateReward(reward.id, { quantity: parseInt(e.target.value, 10) || 1 })}
              className="h-7 w-16 text-xs"
            />
          </div>
        );

      case 'reward_loot':
        return (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <Input
              value={(reward as LootRewardEffect).lootTable}
              onChange={(e) => updateReward(reward.id, { lootTable: e.target.value })}
              placeholder="Loot table..."
              className="h-7 flex-1 min-w-[120px] text-xs"
            />
            <span className="text-xs text-muted-foreground">count:</span>
            <Input
              type="number"
              min={1}
              value={(reward as LootRewardEffect).countMin}
              onChange={(e) => updateReward(reward.id, { countMin: parseInt(e.target.value, 10) || 1 })}
              className="h-7 w-14 text-xs"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              min={1}
              value={(reward as LootRewardEffect).countMax}
              onChange={(e) => updateReward(reward.id, { countMax: parseInt(e.target.value, 10) || 1 })}
              className="h-7 w-14 text-xs"
            />
          </div>
        );

      case 'restore':
        return (
          <div className="flex items-center gap-2 flex-1">
            <select
              value={(reward as RestoreEffect).restoreType}
              onChange={(e) => updateReward(reward.id, { restoreType: e.target.value as RestoreType })}
              className="h-7 px-2 rounded-md border text-xs bg-background flex-1"
            >
              {(Object.keys(RESTORE_TYPE_LABELS) as RestoreType[]).map((type) => (
                <option key={type} value={type}>{RESTORE_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
        );
    }
  };

  const getRewardIcon = (type: RewardEffectType) => {
    const option = REWARD_OPTIONS.find(o => o.type === type);
    return option?.icon || <Gift className="w-3.5 h-3.5" />;
  };

  const isNegativeEffect = (type: RewardEffectType): boolean => {
    return type === 'remove_currency' || type === 'remove_item';
  };

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded-t-md"
      >
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-emerald-500" />
          <span>Rewards & Inventory</span>
          {rewards.length > 0 && (
            <span className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
              {rewards.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            What does the player gain or lose?
          </p>

          {rewards.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No rewards or costs — purely informational
            </p>
          ) : (
            <div className="space-y-1.5">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className={`flex items-center gap-2 p-2 rounded-md border-l-2 ${
                    isNegativeEffect(reward.type) 
                      ? 'bg-red-500/10 border-l-red-500/50' 
                      : 'bg-emerald-500/10 border-l-emerald-500/50'
                  }`}
                >
                  <div className={isNegativeEffect(reward.type) ? 'text-red-500' : 'text-emerald-500'}>
                    {getRewardIcon(reward.type)}
                  </div>
                  {renderRewardEditor(reward)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => removeReward(reward.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add reward menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 w-full"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <Plus className="w-3 h-3" />
              Add Effect
            </Button>

            {showAddMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                <div className="py-1">
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground border-b">
                    Give (positive)
                  </div>
                  {REWARD_OPTIONS.filter(o => !o.isNegative).map((option) => (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => addReward(option.type)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-muted flex items-center gap-2"
                    >
                      <span className="text-emerald-500">{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
                <div className="py-1 border-t">
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground border-b">
                    Take (negative)
                  </div>
                  {REWARD_OPTIONS.filter(o => o.isNegative).map((option) => (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => addReward(option.type)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-muted flex items-center gap-2"
                    >
                      <span className="text-red-500">{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardsPanel;

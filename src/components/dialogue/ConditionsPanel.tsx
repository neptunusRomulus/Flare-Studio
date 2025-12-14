/**
 * Conditions Panel Component
 * 
 * Handles all event.requires_* attributes with natural language UI
 */

import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DialogCondition,
  ConditionType,
  LevelCondition,
  CurrencyCondition,
  ItemCondition,
  StatusCondition,
  ClassCondition,
  createCondition,
  CONDITION_LABELS
} from '../../types/dialogueEditor';
import { Plus, X, Shield, Coins, Package, Tag, Users, ChevronDown } from 'lucide-react';

interface ConditionsPanelProps {
  conditions: DialogCondition[];
  onChange: (conditions: DialogCondition[]) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

// Condition type options for the dropdown
const CONDITION_OPTIONS: { type: ConditionType; label: string; icon: React.ReactNode; category: string }[] = [
  { type: 'requires_level', label: 'Requires level at least', icon: <Shield className="w-3.5 h-3.5" />, category: 'Level' },
  { type: 'requires_not_level', label: 'Hide if level at least', icon: <Shield className="w-3.5 h-3.5" />, category: 'Level' },
  { type: 'requires_currency', label: 'Requires gold at least', icon: <Coins className="w-3.5 h-3.5" />, category: 'Currency' },
  { type: 'requires_not_currency', label: 'Hide if has gold at least', icon: <Coins className="w-3.5 h-3.5" />, category: 'Currency' },
  { type: 'requires_item', label: 'Requires item', icon: <Package className="w-3.5 h-3.5" />, category: 'Item' },
  { type: 'requires_not_item', label: 'Hide if has item', icon: <Package className="w-3.5 h-3.5" />, category: 'Item' },
  { type: 'requires_status', label: 'Requires status', icon: <Tag className="w-3.5 h-3.5" />, category: 'Status' },
  { type: 'requires_not_status', label: 'Hide if has status', icon: <Tag className="w-3.5 h-3.5" />, category: 'Status' },
  { type: 'requires_class', label: 'Only for classes', icon: <Users className="w-3.5 h-3.5" />, category: 'Class' },
  { type: 'requires_not_class', label: 'Hide for classes', icon: <Users className="w-3.5 h-3.5" />, category: 'Class' },
];

export const ConditionsPanel: React.FC<ConditionsPanelProps> = ({
  conditions,
  onChange,
  expanded = true,
  onToggleExpand
}) => {
  const [showAddMenu, setShowAddMenu] = React.useState(false);

  const addCondition = (type: ConditionType) => {
    const newCondition = createCondition(type);
    onChange([...conditions, newCondition]);
    setShowAddMenu(false);
  };

  const updateCondition = (id: string, updates: Partial<DialogCondition>) => {
    onChange(conditions.map(c => c.id === id ? { ...c, ...updates } as DialogCondition : c));
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter(c => c.id !== id));
  };

  const renderConditionEditor = (condition: DialogCondition) => {
    switch (condition.type) {
      case 'requires_level':
      case 'requires_not_level':
        return (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-muted-foreground">
              {condition.type === 'requires_level' ? 'Min level:' : 'Hide if level ≥'}
            </span>
            <Input
              type="number"
              min={1}
              value={(condition as LevelCondition).level}
              onChange={(e) => updateCondition(condition.id, { level: parseInt(e.target.value, 10) || 1 })}
              className="h-7 w-20 text-xs"
            />
          </div>
        );

      case 'requires_currency':
      case 'requires_not_currency':
        return (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-muted-foreground">
              {condition.type === 'requires_currency' ? 'Min gold:' : 'Hide if gold ≥'}
            </span>
            <Input
              type="number"
              min={0}
              value={(condition as CurrencyCondition).amount}
              onChange={(e) => updateCondition(condition.id, { amount: parseInt(e.target.value, 10) || 0 })}
              className="h-7 w-24 text-xs"
            />
          </div>
        );

      case 'requires_item':
      case 'requires_not_item':
        return (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={(condition as ItemCondition).itemId}
              onChange={(e) => updateCondition(condition.id, { itemId: e.target.value })}
              placeholder="Item ID..."
              className="h-7 flex-1 text-xs"
            />
            <span className="text-xs text-muted-foreground">×</span>
            <Input
              type="number"
              min={1}
              value={(condition as ItemCondition).quantity}
              onChange={(e) => updateCondition(condition.id, { quantity: parseInt(e.target.value, 10) || 1 })}
              className="h-7 w-16 text-xs"
            />
          </div>
        );

      case 'requires_status':
      case 'requires_not_status':
        return (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={(condition as StatusCondition).statuses.join(', ')}
              onChange={(e) => updateCondition(condition.id, { 
                statuses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
              })}
              placeholder="Status tags (comma separated)..."
              className="h-7 flex-1 text-xs"
            />
          </div>
        );

      case 'requires_class':
      case 'requires_not_class':
        return (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={(condition as ClassCondition).classes.join(', ')}
              onChange={(e) => updateCondition(condition.id, { 
                classes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
              })}
              placeholder="Class names (comma separated)..."
              className="h-7 flex-1 text-xs"
            />
          </div>
        );
    }
  };

  const getConditionIcon = (type: ConditionType) => {
    const option = CONDITION_OPTIONS.find(o => o.type === type);
    return option?.icon || <Shield className="w-3.5 h-3.5" />;
  };

  const getConditionColor = (type: ConditionType): string => {
    if (type.includes('not')) {
      return 'border-l-red-500/50';
    }
    return 'border-l-blue-500/50';
  };

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded-t-md"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <span>Conditions</span>
          {conditions.length > 0 && (
            <span className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
              {conditions.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Who can see or use this dialogue option?
          </p>

          {conditions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No conditions — option always visible
            </p>
          ) : (
            <div className="space-y-1.5">
              {conditions.map((condition) => (
                <div
                  key={condition.id}
                  className={`flex items-center gap-2 p-2 rounded-md bg-muted/30 border-l-2 ${getConditionColor(condition.type)}`}
                >
                  <div className="text-muted-foreground">
                    {getConditionIcon(condition.type)}
                  </div>
                  {renderConditionEditor(condition)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => removeCondition(condition.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add condition menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 w-full"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <Plus className="w-3 h-3" />
              Add Condition
            </Button>

            {showAddMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                {CONDITION_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => addCondition(option.type)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-muted flex items-center gap-2"
                  >
                    {option.icon}
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConditionsPanel;

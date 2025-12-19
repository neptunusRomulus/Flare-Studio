/**
 * Dialog Node Editor Component
 * 
 * Main component for editing a single dialogue node.
 * Layout: Left panel (Dialog) | Right panel (Effects)
 */

import React from 'react';
import { Button } from '../ui/button';
import { DialogNode } from '../../types/dialogueEditor';
import { generateRawAttributePreview, generateEffectSummary } from '../../utils/dialogueSerializer';
import { DialogTextPanel } from './DialogTextPanel';
import { DialogEffectsPanel } from './DialogEffectsPanel';
import { Code, Eye, EyeOff, Plus, Minus, Check, X } from 'lucide-react';

interface DialogNodeEditorProps {
  node: DialogNode;
  onChange: (node: DialogNode) => void;
  availableNodes?: { id: string; label: string }[];
  onClose?: () => void;
}

export const DialogNodeEditor: React.FC<DialogNodeEditorProps> = ({
  node,
  onChange,
  availableNodes = [],
  onClose
}) => {
  const [showRawAttributes, setShowRawAttributes] = React.useState(false);

  const handleChange = (updates: Partial<DialogNode>) => {
    onChange({ ...node, ...updates });
  };

  const rawAttributes = React.useMemo(() => generateRawAttributePreview(node), [node]);
  const effectSummary = React.useMemo(() => generateEffectSummary(node), [node]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Editing: {node.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowRawAttributes(!showRawAttributes)}
          >
            <Code className="w-3.5 h-3.5" />
            {showRawAttributes ? 'Hide' : 'Show'} Raw
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Effect Summary Bar */}
      {effectSummary.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-muted/10 overflow-x-auto">
          <span className="text-xs text-muted-foreground shrink-0">Effects:</span>
          {effectSummary.map((item, idx) => (
            <span
              key={idx}
              className={`text-xs px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 ${
                item.color === 'green' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                item.color === 'red' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                item.color === 'blue' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}
            >
              {item.icon === 'plus' && <Plus className="w-2.5 h-2.5" />}
              {item.icon === 'minus' && <Minus className="w-2.5 h-2.5" />}
              {item.text}
            </span>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Dialog Content */}
        <div className="w-1/2 border-r overflow-y-auto p-4">
          <div className="text-sm font-medium text-muted-foreground mb-3">Dialog Content</div>
          <DialogTextPanel
            node={node}
            onChange={handleChange}
            availableNodes={availableNodes}
          />
        </div>

        {/* Right Panel - Effects */}
        <div className="w-1/2 overflow-y-auto p-4">
          <DialogEffectsPanel
            node={node}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Raw Attributes Panel (Collapsible) */}
      {showRawAttributes && (
        <div className="border-t">
          <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
            <Code className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium">Raw Flare Attributes (Read-only)</span>
          </div>
          <pre className="p-4 text-xs font-mono bg-muted/10 max-h-48 overflow-auto whitespace-pre-wrap">
            {rawAttributes || '# No attributes generated yet'}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DialogNodeEditor;

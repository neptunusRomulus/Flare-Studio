/**
 * Dialog Text Panel Component
 * 
 * Left side of the dialogue node editor.
 * Handles NPC text, player text, portraits, and responses.
 */

import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import {
  DialogNode,
  DialogResponse
} from '../../types/dialogueEditor';
import { User, UserCircle, Image, MessageSquare, Plus, X, ArrowRight, Move } from 'lucide-react';

interface DialogTextPanelProps {
  node: DialogNode;
  onChange: (updates: Partial<DialogNode>) => void;
  availableNodes?: { id: string; label: string }[]; // For response target selection
}

export const DialogTextPanel: React.FC<DialogTextPanelProps> = ({
  node,
  onChange,
  availableNodes = []
}) => {
  const addResponse = () => {
    const newResponse: DialogResponse = {
      id: `resp_${Date.now()}`,
      text: '',
      targetNodeId: ''
    };
    onChange({ responses: [...node.responses, newResponse] });
  };

  const updateResponse = (id: string, updates: Partial<DialogResponse>) => {
    onChange({
      responses: node.responses.map(r => r.id === id ? { ...r, ...updates } : r)
    });
  };

  const removeResponse = (id: string) => {
    onChange({ responses: node.responses.filter(r => r.id !== id) });
  };

  return (
    <div className="space-y-4">
      {/* NPC Speech Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">NPC Says</span>
          <select
            value={node.npcGender}
            onChange={(e) => onChange({ npcGender: e.target.value as 'him' | 'her' })}
            className="ml-auto h-7 px-2 rounded-md border text-xs bg-background"
          >
            <option value="him">Him (Male)</option>
            <option value="her">Her (Female)</option>
          </select>
        </div>
        <textarea
          value={node.npcText}
          onChange={(e) => onChange({ npcText: e.target.value })}
          placeholder="What the NPC says..."
          className="w-full h-24 px-3 py-2 rounded-md border text-sm bg-background resize-none"
        />
        <div className="flex gap-2">
          <Image className="w-3.5 h-3.5 text-muted-foreground mt-1.5" />
          <Input
            value={node.npcPortrait}
            onChange={(e) => onChange({ npcPortrait: e.target.value })}
            placeholder="NPC portrait (e.g., images/portraits/npc.png)"
            className="h-7 text-xs flex-1"
          />
        </div>
      </div>

      {/* Player Speech Section */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium">Player Says</span>
        </div>
        <textarea
          value={node.playerText}
          onChange={(e) => onChange({ playerText: e.target.value })}
          placeholder="What the player says (optional)..."
          className="w-full h-16 px-3 py-2 rounded-md border text-sm bg-background resize-none"
        />
        <div className="flex gap-2">
          <Image className="w-3.5 h-3.5 text-muted-foreground mt-1.5" />
          <Input
            value={node.playerPortrait}
            onChange={(e) => onChange({ playerPortrait: e.target.value })}
            placeholder="Player portrait (optional)"
            className="h-7 text-xs flex-1"
          />
        </div>
      </div>

      {/* Player Responses Section */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">Player Responses</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {node.responses.length} option{node.responses.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {node.responses.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No responses — dialog will end after this node
          </p>
        ) : (
          <div className="space-y-2">
            {node.responses.map((response, index) => (
              <div
                key={response.id}
                className="p-2 rounded-md border bg-muted/20 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-4">
                    {index + 1}.
                  </span>
                  <Input
                    value={response.text}
                    onChange={(e) => updateResponse(response.id, { text: e.target.value })}
                    placeholder="Response text..."
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => removeResponse(response.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Goes to:</span>
                  {availableNodes.length > 0 ? (
                    <select
                      value={response.targetNodeId}
                      onChange={(e) => updateResponse(response.id, { targetNodeId: e.target.value })}
                      className="h-6 px-2 rounded border text-xs bg-background flex-1"
                    >
                      <option value="">-- Select target --</option>
                      {availableNodes.map(n => (
                        <option key={n.id} value={n.id}>{n.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={response.targetNodeId}
                      onChange={(e) => updateResponse(response.id, { targetNodeId: e.target.value })}
                      placeholder="Target node ID..."
                      className="h-6 text-xs flex-1"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 w-full"
          onClick={addResponse}
        >
          <Plus className="w-3 h-3" />
          Add Response
        </Button>
      </div>

      {/* Options */}
      <div className="pt-2 border-t">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={node.allowMovement}
            onCheckedChange={(checked) => onChange({ allowMovement: checked })}
            className="scale-75"
          />
          <Move className="w-3 h-3" />
          Allow player movement during dialog
        </label>
      </div>
    </div>
  );
};

export default DialogTextPanel;

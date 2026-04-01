import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Plus, Trash2, MessageSquare, ArrowRight, X, Key } from 'lucide-react';

export interface DialogResponse {
  targetId: string;
  text: string;
}

export interface DialogNode {
  id: string;
  speaker: 'him' | 'her' | 'you';
  text: string;
  voice?: string;
  portrait?: string;
  allow_movement?: boolean;
  take_a_party?: boolean;
  responses: DialogResponse[];
  response_only?: DialogResponse[];
}

interface DialogueNodeEditorProps {
  dialogNodesStr: string;
  onChange: (newStr: string) => void;
}

// Minimalistic Master-Detail Node Editor
export const DialogueNodeEditor: React.FC<DialogueNodeEditorProps> = ({ dialogNodesStr, onChange }) => {
  const [nodes, setNodes] = useState<DialogNode[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (dialogNodesStr) {
        // Only set nodes if they actually changed
        const parsedNodes = JSON.parse(dialogNodesStr);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNodes(parsedNodes);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNodes([]);
      }
    } catch (e) {
      console.error("Failed to parse dialog nodes", e);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNodes([]);
    }
  }, [dialogNodesStr]);

  const saveNodes = (newNodes: DialogNode[]) => {
    setNodes(newNodes);
    onChange(JSON.stringify(newNodes));
  };

  const addNode = () => {
    const newNode: DialogNode = {
      id: `node_${nodes.length + 1}`,
      speaker: 'him',
      text: '',
      responses: []
    };
    const newNodes = [...nodes, newNode];
    saveNodes(newNodes);
    setSelectedIndex(newNodes.length - 1);
  };

  const deleteNode = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newNodes = [...nodes];
    newNodes.splice(index, 1);
    saveNodes(newNodes);
    if (selectedIndex === index) setSelectedIndex(null);
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1);
  };

  const updateSelectedNode = (field: keyof DialogNode, value: string | boolean) => {
    if (selectedIndex === null) return;
    const newNodes = [...nodes];
    newNodes[selectedIndex] = { ...newNodes[selectedIndex], [field]: value };
    saveNodes(newNodes);
  };

  const addResponse = (type: 'responses' | 'response_only') => {
    if (selectedIndex === null) return;
    const newNodes = [...nodes];
    const node = newNodes[selectedIndex];
    const targetArr = node[type] || [];
    newNodes[selectedIndex] = { ...node, [type]: [...targetArr, { targetId: '', text: '' }] };
    saveNodes(newNodes);
  };

  const updateResponse = (type: 'responses' | 'response_only', rIndex: number, field: keyof DialogResponse, value: string) => {
    if (selectedIndex === null) return;
    const newNodes = [...nodes];
    const node = [...(newNodes[selectedIndex][type] || [])];
    node[rIndex] = { ...node[rIndex], [field]: value };
    newNodes[selectedIndex] = { ...newNodes[selectedIndex], [type]: node };
    saveNodes(newNodes);
  };

  const removeResponse = (type: 'responses' | 'response_only', rIndex: number) => {
    if (selectedIndex === null) return;
    const newNodes = [...nodes];
    const node = [...newNodes[selectedIndex][type]!];
    node.splice(rIndex, 1);
    newNodes[selectedIndex] = { ...newNodes[selectedIndex], [type]: node };
    saveNodes(newNodes);
  };

  const selectedNode = selectedIndex !== null ? nodes[selectedIndex] : null;

  return (
    <div className="flex border border-blue-500/20 rounded-md overflow-hidden bg-background h-[300px] mt-2 mb-2 w-full max-w-full">
      {/* Master List */}
      <div className="w-1/3 border-r border-blue-500/20 bg-blue-500/5 flex flex-col">
        <div className="px-2 py-1.5 border-b border-blue-500/20 flex justify-between items-center bg-blue-500/10">
          <span className="text-[11px] font-semibold text-blue-700/80 dark:text-blue-400">Dialog Nodes</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-blue-500/20" onClick={addNode}>
            <Plus className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
          {nodes.map((node, i) => (
            <div
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={`flex items-center justify-between px-2 py-1 cursor-pointer rounded text-[11px] group ${
                selectedIndex === i 
                  ? 'bg-blue-500 text-white dark:bg-blue-600' 
                  : 'text-muted-foreground hover:bg-blue-500/10'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate flex-1">
                <MessageSquare className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate">{node.id || 'Unnamed'}</span>
              </div>
              <Trash2 
                className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 ml-1 shrink-0"
                onClick={(e) => deleteNode(i, e)}
              />
            </div>
          ))}
          {nodes.length === 0 && (
            <div className="p-3 text-center text-[10px] text-muted-foreground/60 italic">
              No nodes. Click + to add.
            </div>
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className="w-2/3 flex flex-col bg-background">
        {selectedNode ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Header / ID */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <Key className="h-3 w-3" /> Node ID Component
                </label>
                <Input 
                  className="h-7 text-xs" 
                  value={selectedNode.id} 
                  onChange={(e) => updateSelectedNode('id', e.target.value)} 
                  placeholder="e.g. intro"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Speaker</label>
                <select 
                  className="flex w-full rounded-md border border-input bg-background px-3 h-7 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedNode.speaker}
                  onChange={(e) => updateSelectedNode('speaker', e.target.value)}
                >
                  <option value="him">Him</option>
                  <option value="her">Her</option>
                  <option value="you">You</option>
                </select>
              </div>
            </div>

            {/* Text Content */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Dialog Msg</label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none h-16"
                value={selectedNode.text}
                onChange={(e) => updateSelectedNode('text', e.target.value)}
                placeholder="The text spoken by the NPC or Player..."
              />
            </div>

            {/* Optional Modifiers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Voice File</label>
                <Input 
                  className="h-7 text-xs" 
                  value={selectedNode.voice || ''} 
                  onChange={(e) => updateSelectedNode('voice', e.target.value)} 
                  placeholder="e.g. intro.ogg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Portrait</label>
                <Input 
                  className="h-7 text-xs" 
                  value={selectedNode.portrait || ''} 
                  onChange={(e) => updateSelectedNode('portrait', e.target.value)} 
                  placeholder="e.g. portrait_him"
                />
              </div>
            </div>

            {/* Responses */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> Responses
                </label>
                <Button variant="outline" size="sm" className="h-5 text-[10px] px-2 py-0" onClick={() => addResponse('responses')}>
                  + Add
                </Button>
              </div>
              <div className="space-y-1.5 pb-2">
                {selectedNode.responses?.map((r, i) => (
                  <div key={i} className="flex gap-1 items-start">
                    <Input 
                      className="h-6 text-[10px] w-1/3" 
                      placeholder="Target ID" 
                      value={r.targetId} 
                      onChange={(e) => updateResponse('responses', i, 'targetId', e.target.value)}
                    />
                    <Input 
                      className="h-6 text-[10px] flex-1" 
                      placeholder="Response Text" 
                      value={r.text} 
                      onChange={(e) => updateResponse('responses', i, 'text', e.target.value)}
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-400" onClick={() => removeResponse('responses', i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {!selectedNode.responses?.length && <div className="text-[10px] text-muted-foreground/50 italic">No responses.</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
            <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
            <span className="text-xs font-medium">Select a Node</span>
            <span className="text-[10px] opacity-70 mt-1">Select from the list or add to start.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DialogueNodeEditor;

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlignLeft, ArrowLeft, Check, ChevronDown, ChevronUp, Eye, Gift, MessageSquare, Package, Plus, Save, Tag, User, X, Zap } from 'lucide-react';
import type { DialogueLine, DialogueRequirement, DialogueReward, DialogueWorldEffect, DialogueTree, MapObject } from '@/types';

const DialogueTreeDialog = ({
  showDialogueTreeDialog,
  dialogueTrees = [],
  setDialogueTrees,
  activeDialogueTab,
  setActiveDialogueTab,
  dialogueTabToDelete,
  setDialogueTabToDelete,
  onClose,
  editingObject,
  updateEditingObjectProperty
}: {
  showDialogueTreeDialog: boolean;
  dialogueTrees?: DialogueTree[];
  setDialogueTrees: React.Dispatch<React.SetStateAction<DialogueTree[]>>;
  activeDialogueTab: number;
  setActiveDialogueTab: React.Dispatch<React.SetStateAction<number>>;
  dialogueTabToDelete: number | null;
  setDialogueTabToDelete: React.Dispatch<React.SetStateAction<number | null>>;
  onClose: () => void;
  editingObject: MapObject | null;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
}) => (
<Dialog
  open={showDialogueTreeDialog}
  onOpenChange={(open) => {
    if (!open) {
      onClose();
    }
  }}
>
  <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
    <DialogHeader className="mb-4">
      <DialogTitle className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-500" />
        Dialogue Trees
      </DialogTitle>
    </DialogHeader>
    
    <div className="flex-1 flex gap-4 overflow-hidden">
      {/* Tab sidebar */}
      <div className="w-48 flex flex-col border-r pr-4">
        <div className="flex-1 space-y-1 overflow-y-auto minimal-scroll">
          {dialogueTrees.map((tree, index) => (
            <button
              key={tree.id}
              type="button"
              onContextMenu={(e) => {
                e.preventDefault();
                if (dialogueTrees.length > 1) {
                  setDialogueTabToDelete(index);
                }
              }}
              onClick={() => {
                if (dialogueTabToDelete === index) {
                  setDialogueTabToDelete(null);
                } else {
                  setActiveDialogueTab(index);
                }
              }}
              className={`w-full px-3 py-2 text-left text-sm rounded-md transition-colors ${
                dialogueTabToDelete === index
                  ? 'bg-red-500/20 border border-red-500/50 text-red-600 dark:text-red-400'
                  : activeDialogueTab === index
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                  : 'hover:bg-muted border border-transparent'
              }`}
            >
              {dialogueTabToDelete === index ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs">Delete?</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="p-0.5 rounded hover:bg-red-500/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newTrees = dialogueTrees.filter((_, i) => i !== index);
                        setDialogueTrees(newTrees);
                        setDialogueTabToDelete(null);
                        if (activeDialogueTab >= newTrees.length) {
                          setActiveDialogueTab(Math.max(0, newTrees.length - 1));
                        }
                      }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-0.5 rounded hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDialogueTabToDelete(null);
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <span>Dialogue {index + 1}</span>
              )}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full gap-1"
            onClick={() => {
              const newTree: DialogueTree = {
                id: String(Date.now()),
                topic: '',
                requirements: [],
                dialogues: [],
                rewards: [],
                worldEffects: []
              };
              setDialogueTrees([...dialogueTrees, newTree]);
              setActiveDialogueTab(dialogueTrees.length);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
      </div>
      
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto minimal-scroll pr-2">
        {dialogueTrees[activeDialogueTab] && (
          <div className="space-y-4">
            {/* Topic */}
            <div>
              <label className="text-xs text-muted-foreground font-medium">Topic</label>
              <Input
                value={dialogueTrees[activeDialogueTab].topic}
                onChange={(e) => {
                  const newTrees = [...dialogueTrees];
                  newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], topic: e.target.value };
                  setDialogueTrees(newTrees);
                }}
                placeholder="Enter dialogue topic..."
                className="h-8"
              />
            </div>
            
            {/* Requirements - Expandable */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => {
                  const tree = dialogueTrees[activeDialogueTab];
                  const newTrees = [...dialogueTrees];
                  newTrees[activeDialogueTab] = {
                    ...tree,
                    _reqExpanded: !tree._reqExpanded
                  };
                  setDialogueTrees(newTrees);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>Dialogue is visible when player has ({dialogueTrees[activeDialogueTab].requirements.length})</span>
                </div>
                {dialogueTrees[activeDialogueTab]._reqExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {dialogueTrees[activeDialogueTab]._reqExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {dialogueTrees[activeDialogueTab].requirements.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">Everyone can see this dialogue. Add conditions to restrict it.</p>
                  )}
                  {dialogueTrees[activeDialogueTab].requirements.map((req, reqIndex) => {
                    const reqConfig: Record<DialogueRequirement['type'], { icon: React.ReactNode; label: string; placeholder: string; color: string }> = {
                      status: { icon: <Tag className="w-3.5 h-3.5" />, label: 'Status', placeholder: 'e.g. quest_started', color: 'text-green-400' },
                      not_status: { icon: <Tag className="w-3.5 h-3.5" />, label: 'Missing Status', placeholder: 'e.g. quest_completed', color: 'text-red-400' },
                      item: { icon: <Package className="w-3.5 h-3.5" />, label: 'Item', placeholder: 'Item ID (e.g. 1)', color: 'text-yellow-400' },
                      level: { icon: <Zap className="w-3.5 h-3.5" />, label: 'Min Level', placeholder: 'e.g. 5', color: 'text-cyan-400' },
                      class: { icon: <User className="w-3.5 h-3.5" />, label: 'Class', placeholder: 'e.g. warrior', color: 'text-purple-400' }
                    };
                    const config = reqConfig[req.type];
                    return (
                      <div key={req.id} className="flex gap-2 items-center bg-muted/30 rounded-md p-2">
                        <select
                          value={req.type}
                          onChange={(e) => {
                            const newTrees = [...dialogueTrees];
                            const newReqs = [...newTrees[activeDialogueTab].requirements];
                            newReqs[reqIndex] = { ...newReqs[reqIndex], type: e.target.value as DialogueRequirement['type'], value: '' };
                            newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], requirements: newReqs };
                            setDialogueTrees(newTrees);
                          }}
                          className="h-8 px-2 py-1 rounded border text-[11px] bg-background cursor-pointer hover:border-primary/50 transition-colors min-w-[130px]"
                        >
                          <option value="status">Status</option>
                          <option value="not_status">Missing Status</option>
                          <option value="item">Item</option>
                          <option value="level">Min Level</option>
                          <option value="class">Class</option>
                        </select>
                        <Input
                          value={req.value}
                          onChange={(e) => {
                            const newTrees = [...dialogueTrees];
                            const newReqs = [...newTrees[activeDialogueTab].requirements];
                            newReqs[reqIndex] = { ...newReqs[reqIndex], value: e.target.value };
                            newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], requirements: newReqs };
                            setDialogueTrees(newTrees);
                          }}
                          placeholder={config.placeholder}
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => {
                            const newTrees = [...dialogueTrees];
                            const newReqs = dialogueTrees[activeDialogueTab].requirements.filter((_, i) => i !== reqIndex);
                            newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], requirements: newReqs };
                            setDialogueTrees(newTrees);
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const newTrees = [...dialogueTrees];
                      const newReq: DialogueRequirement = { id: String(Date.now()), type: 'status', value: '' };
                      newTrees[activeDialogueTab] = {
                        ...newTrees[activeDialogueTab],
                        requirements: [...newTrees[activeDialogueTab].requirements, newReq]
                      };
                      setDialogueTrees(newTrees);
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Add Condition
                  </Button>
                </div>
              )}
            </div>
            
            {/* Dialogues - Expandable */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => {
                  const tree = dialogueTrees[activeDialogueTab];
                  const newTrees = [...dialogueTrees];
                  newTrees[activeDialogueTab] = {
                    ...tree,
                    _dlgExpanded: !tree._dlgExpanded
                  };
                  setDialogueTrees(newTrees);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-blue-400" />
                  <span>Dialogues ({dialogueTrees[activeDialogueTab].dialogues.length})</span>
                </div>
                {dialogueTrees[activeDialogueTab]._dlgExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {dialogueTrees[activeDialogueTab]._dlgExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {dialogueTrees[activeDialogueTab].dialogues.map((dlg, dlgIndex) => (
                    <div key={dlg.id} className="flex gap-2 items-start">
                      <button
                        type="button"
                        onClick={() => {
                          const newTrees = [...dialogueTrees];
                          const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                          newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], speaker: dlg.speaker === 'npc' ? 'player' : 'npc' };
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                          setDialogueTrees(newTrees);
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                          dlg.speaker === 'npc'
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50'
                        }`}
                      >
                        {dlg.speaker === 'npc' ? 'NPC' : 'Player'}
                      </button>
                      <Input
                        value={dlg.text}
                        onChange={(e) => {
                          const newTrees = [...dialogueTrees];
                          const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                          newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], text: e.target.value };
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                          setDialogueTrees(newTrees);
                        }}
                        placeholder={dlg.speaker === 'npc' ? 'NPC says...' : 'Player says...'}
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => {
                          const newTrees = [...dialogueTrees];
                          const newDlgs = dialogueTrees[activeDialogueTab].dialogues.filter((_, i) => i !== dlgIndex);
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                          setDialogueTrees(newTrees);
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 flex-1"
                      onClick={() => {
                        const newTrees = [...dialogueTrees];
                        const newDlg: DialogueLine = { id: String(Date.now()), speaker: 'npc', text: '' };
                        newTrees[activeDialogueTab] = {
                          ...newTrees[activeDialogueTab],
                          dialogues: [...newTrees[activeDialogueTab].dialogues, newDlg]
                        };
                        setDialogueTrees(newTrees);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      NPC Line
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 flex-1"
                      onClick={() => {
                        const newTrees = [...dialogueTrees];
                        const newDlg: DialogueLine = { id: String(Date.now()) + 1, speaker: 'player', text: '' };
                        newTrees[activeDialogueTab] = {
                          ...newTrees[activeDialogueTab],
                          dialogues: [...newTrees[activeDialogueTab].dialogues, newDlg]
                        };
                        setDialogueTrees(newTrees);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Player Line
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Rewards - Expandable */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => {
                  const tree = dialogueTrees[activeDialogueTab];
                  const newTrees = [...dialogueTrees];
                  newTrees[activeDialogueTab] = {
                    ...tree,
                    _rewExpanded: !tree._rewExpanded
                  };
                  setDialogueTrees(newTrees);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-500" />
                  <span>Rewards ({dialogueTrees[activeDialogueTab].rewards?.length || 0})</span>
                </div>
                {dialogueTrees[activeDialogueTab]._rewExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {dialogueTrees[activeDialogueTab]._rewExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">What does the player gain or lose?</p>
                  {(dialogueTrees[activeDialogueTab].rewards || []).map((rew, rewIndex) => (
                    <div key={rew.id} className={`flex gap-2 items-center p-2 rounded-md ${
                      rew.type.includes('remove') ? 'bg-red-500/10 border-l-2 border-l-red-500/50' : 'bg-emerald-500/10 border-l-2 border-l-emerald-500/50'
                    }`}>
                      <select
                        value={rew.type}
                        onChange={(e) => {
                          const newTrees = [...dialogueTrees];
                          const newRews = [...(newTrees[activeDialogueTab].rewards || [])];
                          newRews[rewIndex] = { ...newRews[rewIndex], type: e.target.value as DialogueReward['type'] };
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], rewards: newRews };
                          setDialogueTrees(newTrees);
                        }}
                        className="h-8 px-2 py-1 rounded-md border text-[11px] bg-background min-w-[110px] cursor-pointer"
                      >
                        <option value="xp">Give XP</option>
                        <option value="gold">Give Gold</option>
                        <option value="item">Give Item</option>
                        <option value="remove_gold">Take Gold</option>
                        <option value="remove_item">Take Item</option>
                        <option value="restore">Restore HP/MP</option>
                      </select>
                      <Input
                        value={rew.value}
                        onChange={(e) => {
                          const newTrees = [...dialogueTrees];
                          const newRews = [...(newTrees[activeDialogueTab].rewards || [])];
                          newRews[rewIndex] = { ...newRews[rewIndex], value: e.target.value };
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], rewards: newRews };
                          setDialogueTrees(newTrees);
                        }}
                        placeholder={rew.type === 'item' || rew.type === 'remove_item' ? 'Item ID...' : rew.type === 'restore' ? 'hp/mp/all' : 'Amount...'}
                        className="h-7 text-xs flex-1"
                      />
                      {(rew.type === 'item' || rew.type === 'remove_item') && (
                        <>
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            type="number"
                            min={1}
                            value={rew.quantity || 1}
                            onChange={(e) => {
                          const newTrees = [...dialogueTrees];
                          const newRews = [...(newTrees[activeDialogueTab].rewards || [])];
                          newRews[rewIndex] = { ...newRews[rewIndex], quantity: parseInt(e.target.value, 10) || 1 };
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], rewards: newRews };
                          setDialogueTrees(newTrees);
                        }}
                            className="h-7 w-14 text-xs"
                          />
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const newTrees = [...dialogueTrees];
                          const newRews = (dialogueTrees[activeDialogueTab].rewards || []).filter((_, i) => i !== rewIndex);
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], rewards: newRews };
                          setDialogueTrees(newTrees);
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const newTrees = [...dialogueTrees];
                      const newRew: DialogueReward = { id: String(Date.now()), type: 'xp', value: '' };
                      newTrees[activeDialogueTab] = {
                        ...newTrees[activeDialogueTab],
                        rewards: [...(newTrees[activeDialogueTab].rewards || []), newRew]
                      };
                      setDialogueTrees(newTrees);
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Add Reward
                  </Button>
                </div>
              )}
            </div>

            {/* World Effects - Expandable (Advanced) */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => {
                  const tree = dialogueTrees[activeDialogueTab];
                  const newTrees = [...dialogueTrees];
                  newTrees[activeDialogueTab] = {
                    ...tree,
                    _wfExpanded: !tree._wfExpanded
                  };
                  setDialogueTrees(newTrees);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span>World Effects ({dialogueTrees[activeDialogueTab].worldEffects?.length || 0})</span>
                  <span className="text-xs text-muted-foreground">(Advanced)</span>
                </div>
                {dialogueTrees[activeDialogueTab]._wfExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {dialogueTrees[activeDialogueTab]._wfExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">What happens in the world after this?</p>
                  {(dialogueTrees[activeDialogueTab].worldEffects || []).map((wf, wfIndex) => (
                    <div key={wf.id} className="flex gap-2 items-center p-2 rounded-md bg-purple-500/10 border-l-2 border-l-purple-500/50">
                      <select
                        value={wf.type}
                        onChange={(e) => {
                          const newTrees = [...dialogueTrees];
                          const newWfs = [...(newTrees[activeDialogueTab].worldEffects || [])];
                          newWfs[wfIndex] = { ...newWfs[wfIndex], type: e.target.value as DialogueWorldEffect['type'] };
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                          setDialogueTrees(newTrees);
                        }}
                        className="h-8 px-2 py-1 rounded-md border text-[11px] bg-background min-w-[110px] cursor-pointer"
                      >
                        <option value="set_status">Set Status</option>
                        <option value="unset_status">Clear Status</option>
                        <option value="teleport">Teleport</option>
                        <option value="spawn">Spawn Enemy</option>
                        <option value="cutscene">Cutscene</option>
                        <option value="sound">Play Sound</option>
                        <option value="npc">NPC Dialog</option>
                      </select>
                      <Input
                        value={wf.value}
                        onChange={(e) => {
                          const newTrees = [...dialogueTrees];
                          const newWfs = [...(newTrees[activeDialogueTab].worldEffects || [])];
                          newWfs[wfIndex] = { ...newWfs[wfIndex], value: e.target.value };
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                          setDialogueTrees(newTrees);
                        }}
                        placeholder={
                          wf.type === 'set_status' || wf.type === 'unset_status' ? 'Status tag...' :
                          wf.type === 'teleport' ? 'map.txt,x,y' :
                          wf.type === 'spawn' ? 'Enemy category' :
                          wf.type === 'cutscene' ? 'Cutscene file...' :
                          wf.type === 'sound' ? 'Sound file...' :
                          wf.type === 'npc' ? 'NPC file...' : 'Value...'
                        }
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const newTrees = [...dialogueTrees];
                          const newWfs = (dialogueTrees[activeDialogueTab].worldEffects || []).filter((_, i) => i !== wfIndex);
                          newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                          setDialogueTrees(newTrees);
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const newTrees = [...dialogueTrees];
                      const newWf: DialogueWorldEffect = { id: String(Date.now()), type: 'set_status', value: '' };
                      newTrees[activeDialogueTab] = {
                        ...newTrees[activeDialogueTab],
                        worldEffects: [...(newTrees[activeDialogueTab].worldEffects || []), newWf]
                      };
                      setDialogueTrees(newTrees);
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Add Effect
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    
    <DialogFooter className="mt-4">
      <Button variant="outline" size="icon" className="h-9 w-9" onClick={onClose}>
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <Button 
        size="icon" 
        className="h-9 w-9" 
        disabled={!dialogueTrees.some(tree => tree.topic.trim() && tree.dialogues.some(d => d.text.trim()))}
        title={!dialogueTrees.some(tree => tree.topic.trim() && tree.dialogues.some(d => d.text.trim())) 
          ? "Each dialogue needs a topic and at least one dialogue line" 
          : "Save dialogues"}
        onClick={() => {
          // Validate: at least one tree must have topic and at least one dialogue
          const validTrees = dialogueTrees.filter(tree => 
            tree.topic.trim() && tree.dialogues.some(d => d.text.trim())
          );
          
          if (validTrees.length === 0) {
            return; // Button should be disabled anyway
          }
          
          // Save dialogue trees to editing object properties
          if (editingObject) {
            // Clean up expanded state before saving, only save valid trees
            const cleanTrees = validTrees.map(tree => ({
              id: tree.id,
              topic: tree.topic,
              requirements: tree.requirements.filter(r => r.value.trim()), // Only save requirements with values
              dialogues: tree.dialogues.filter(d => d.text.trim()), // Only save dialogues with text
              rewards: (tree.rewards || []).filter(r => r.value.trim()), // Only save rewards with values
              worldEffects: (tree.worldEffects || []).filter(w => w.value.trim()) // Only save effects with values
            }));
            updateEditingObjectProperty('dialogueTrees', JSON.stringify(cleanTrees));
          }
          onClose();
        }}
      >
        <Save className="w-4 h-4" />
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

);

export default DialogueTreeDialog;

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { AlignLeft, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Coins, Eye, EyeOff, Fingerprint, Gift, HelpCircle, Image, Link2, MessageSquare, Package, Plus, Save, Shield, Tag, User, Volume2, X, Zap } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import type { DialogueLine, DialogueRequirement, DialogueReward, DialogueWorldEffect, DialogueTree, MapObject } from '@/types';

/** Generate a short unique dialogue ID like "dlg_a3f9" */
function generateDialogueId(): string {
  return 'dlg_' + Math.random().toString(36).substring(2, 6);
}

/** Requirement type config for labels/placeholders */
const REQ_CONFIG: Record<DialogueRequirement['type'], { label: string; placeholder: string }> = {
  status: { label: 'Has Status', placeholder: 'e.g. quest_started' },
  not_status: { label: 'Missing Status', placeholder: 'e.g. quest_completed' },
  item: { label: 'Has Item', placeholder: 'Item ID:qty (e.g. 1002:1)' },
  not_item: { label: 'Has Not Item', placeholder: 'Item ID:qty (e.g. 1002:1)' },
  level: { label: 'Min Level', placeholder: 'e.g. 5' },
  not_level: { label: 'Max Level', placeholder: 'e.g. 10' },
  currency: { label: 'Min Currency', placeholder: 'e.g. 100' },
  not_currency: { label: 'Max Currency', placeholder: 'e.g. 500' },
  class: { label: 'Has Class', placeholder: 'e.g. warrior' },
  not_class: { label: 'Has Not Class', placeholder: 'e.g. ranger' },
};

/** Visual branching panel: shows arrow connections between nodes */
const BranchingPanel: React.FC<{
  trees: DialogueTree[];
  activeTab: number;
  onNavigate: (index: number) => void;
}> = ({ trees, activeTab, onNavigate }) => {
  // Build links: for each tree that has responses, find target trees
  const links = useMemo(() => {
    const result: { fromIdx: number; fromTopic: string; toIdx: number; toTopic: string; toDialogueId: string }[] = [];
    for (let i = 0; i < trees.length; i++) {
      const responses = trees[i].responses || [];
      for (const respId of responses) {
        if (!respId) continue;
        const targetIdx = trees.findIndex(t => t.dialogueId === respId);
        if (targetIdx !== -1) {
          result.push({
            fromIdx: i,
            fromTopic: trees[i].topic || `Dialogue ${i + 1}`,
            toIdx: targetIdx,
            toTopic: trees[targetIdx].topic || `Dialogue ${targetIdx + 1}`,
            toDialogueId: respId,
          });
        }
      }
    }
    return result;
  }, [trees]);

  // Also find which trees reference the active tab as a response target
  const incomingLinks = useMemo(() => {
    const activeDialogueId = trees[activeTab]?.dialogueId;
    if (!activeDialogueId) return [];
    return links.filter(l => l.toDialogueId === activeDialogueId);
  }, [links, trees, activeTab]);

  const outgoingLinks = useMemo(() => {
    return links.filter(l => l.fromIdx === activeTab);
  }, [links, activeTab]);

  if (links.length === 0) return null;

  return (
    <div className="border rounded-md bg-muted/20 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Link2 className="w-3 h-3" />
        Response Links
      </div>
      {incomingLinks.length > 0 && (
        <div className="space-y-1">
          {incomingLinks.map((link, i) => (
            <button
              key={`in-${i}`}
              type="button"
              onClick={() => onNavigate(link.fromIdx)}
              className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1 rounded hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="text-blue-500 font-medium truncate">{link.fromTopic}</span>
              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">this</span>
            </button>
          ))}
        </div>
      )}
      {outgoingLinks.length > 0 && (
        <div className="space-y-1">
          {outgoingLinks.map((link, i) => (
            <button
              key={`out-${i}`}
              type="button"
              onClick={() => onNavigate(link.toIdx)}
              className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1 rounded hover:bg-muted/50 transition-colors"
            >
              <span className="text-muted-foreground truncate">this</span>
              <ArrowRight className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-500 font-medium truncate">{link.toTopic}</span>
              <span className="text-muted-foreground/60 ml-auto text-[10px] shrink-0">{link.toDialogueId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
}) => {
  const [editingIdIndex, setEditingIdIndex] = useState<number | null>(null);
  const [pendingIdValue, setPendingIdValue] = useState('');
  const [idConfirmShown, setIdConfirmShown] = useState(false);

  // Helper to update a tree at the active tab
  const updateTree = useCallback((index: number, updates: Partial<DialogueTree>) => {
    const newTrees = [...dialogueTrees];
    newTrees[index] = { ...newTrees[index], ...updates };
    setDialogueTrees(newTrees);
  }, [dialogueTrees, setDialogueTrees]);

  const activeTree = dialogueTrees[activeDialogueTab];

  // Collect all dialogueIds for response dropdown
  const allDialogueIds = useMemo(() => {
    return dialogueTrees
      .map((t, i) => ({ dialogueId: t.dialogueId, topic: t.topic, index: i }))
      .filter(t => t.dialogueId);
  }, [dialogueTrees]);

  return (
<Dialog
  open={showDialogueTreeDialog}
  onOpenChange={(open) => {
    if (!open) {
      setEditingIdIndex(null);
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
      <div className="w-52 flex flex-col border-r pr-4">
        <div className="flex-1 space-y-1 overflow-y-auto minimal-scroll">
          {dialogueTrees.map((tree, index) => {
            const hasResponses = (tree.responses || []).length > 0;
            const isResponseOnly = tree.responseOnly;
            const isResponseTarget = dialogueTrees.some(t => (t.responses || []).includes(tree.dialogueId));
            return (
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
                  setEditingIdIndex(null);
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
                        const deletedId = dialogueTrees[index].dialogueId;
                        const newTrees = dialogueTrees.filter((_, i) => i !== index).map(t => ({
                          ...t,
                          responses: (t.responses || []).filter(r => r !== deletedId)
                        }));
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
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{tree.topic || `Dialogue ${index + 1}`}</span>
                    {isResponseOnly && <EyeOff className="w-3 h-3 text-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {tree.dialogueId && (
                      <span className="text-[9px] text-muted-foreground/70 font-mono truncate">{tree.dialogueId}</span>
                    )}
                    {(hasResponses || isResponseTarget) && (
                      <Link2 className="w-2.5 h-2.5 text-blue-400 shrink-0 ml-auto" />
                    )}
                  </div>
                </div>
              )}
            </button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full gap-1"
            onClick={() => {
              const newTree: DialogueTree = {
                id: String(Date.now()),
                dialogueId: generateDialogueId(),
                topic: '',
                group: undefined,
                responseOnly: false,
                responses: [],
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
        {activeTree && (
          <div className="space-y-4">
            {/* ID & Topic row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground font-medium">Topic</label>
                  <Tooltip content="The name of this dialog topic. Displayed to the player when picking a dialog tree.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  value={activeTree.topic}
                  onChange={(e) => updateTree(activeDialogueTab, { topic: e.target.value })}
                  placeholder="Enter dialogue topic..."
                  className="h-8"
                />
              </div>
              <div className="w-20">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground font-medium">Group</label>
                  <Tooltip content="Dialog group. Dialogs in the same group are selected randomly (only one is shown). Leave empty for no grouping.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  value={activeTree.group || ''}
                  onChange={(e) => updateTree(activeDialogueTab, { group: e.target.value || undefined })}
                  placeholder="—"
                  className="h-8 text-xs"
                />
              </div>
              <div className="w-36">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Fingerprint className="w-3 h-3" /> ID
                  </label>
                  <Tooltip content="A unique identifier used to reference this dialog node. Other nodes can link to it via response connections.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                {editingIdIndex === activeDialogueTab ? (
                  <div className="space-y-1">
                    {idConfirmShown && (
                      <div className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                        Changing ID will break existing response links. Are you sure?
                        <div className="flex gap-1 mt-0.5">
                          <button
                            type="button"
                            className="text-[10px] text-emerald-500 hover:underline"
                            onClick={() => {
                              const oldId = activeTree.dialogueId;
                              // Update all trees that reference the old ID
                              const newTrees = dialogueTrees.map((t, i) => {
                                if (i === activeDialogueTab) {
                                  return { ...t, dialogueId: pendingIdValue };
                                }
                                return {
                                  ...t,
                                  responses: (t.responses || []).map(r => r === oldId ? pendingIdValue : r)
                                };
                              });
                              setDialogueTrees(newTrees);
                              setEditingIdIndex(null);
                              setIdConfirmShown(false);
                            }}
                          >Yes, update</button>
                          <button
                            type="button"
                            className="text-[10px] text-muted-foreground hover:underline"
                            onClick={() => { setEditingIdIndex(null); setIdConfirmShown(false); }}
                          >Cancel</button>
                        </div>
                      </div>
                    )}
                    <Input
                      value={pendingIdValue}
                      onChange={(e) => setPendingIdValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && pendingIdValue.trim()) {
                          setIdConfirmShown(true);
                        } else if (e.key === 'Escape') {
                          setEditingIdIndex(null);
                          setIdConfirmShown(false);
                        }
                      }}
                      className="h-8 text-xs font-mono"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIdIndex(activeDialogueTab);
                      setPendingIdValue(activeTree.dialogueId || '');
                      setIdConfirmShown(false);
                    }}
                    className="h-8 w-full px-2 text-xs font-mono text-left border rounded-md bg-background hover:bg-muted/50 truncate"
                    title={activeTree.dialogueId || 'No ID'}
                  >
                    {activeTree.dialogueId || '—'}
                  </button>
                )}
              </div>
            </div>

            {/* Response Only toggle */}
            <div className="flex items-center gap-2">
              <Switch
                checked={activeTree.responseOnly || false}
                onCheckedChange={(checked) => updateTree(activeDialogueTab, { responseOnly: checked })}
                className="scale-75"
              />
              <span className="text-xs text-muted-foreground">
                Response Only
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                — hidden from topic list, only reachable via response link
              </span>
            </div>

            {/* Response Links (outgoing) */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => updateTree(activeDialogueTab, { _respExpanded: !((activeTree as any)._respExpanded) } as any)}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-400" />
                  <span>Player Responses ({(activeTree.responses || []).filter(Boolean).length})</span>
                </div>
                {(activeTree as any)._respExpanded
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {(activeTree as any)._respExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">After this dialog text, show these as clickable player choices:</p>
                  {(activeTree.responses || []).map((respId, respIndex) => (
                    <div key={respIndex} className="flex gap-2 items-center bg-blue-500/5 border-l-2 border-l-blue-500/50 rounded-md p-2">
                      <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />
                      <select
                        value={respId}
                        onChange={(e) => {
                          const newResponses = [...(activeTree.responses || [])];
                          newResponses[respIndex] = e.target.value;
                          updateTree(activeDialogueTab, { responses: newResponses });
                        }}
                        className="h-7 px-2 rounded border text-[11px] bg-background cursor-pointer flex-1"
                      >
                        <option value="">Select target...</option>
                        {allDialogueIds
                          .filter(t => t.index !== activeDialogueTab)
                          .map(t => (
                            <option key={t.dialogueId} value={t.dialogueId}>
                              {t.topic || `Dialogue ${t.index + 1}`} ({t.dialogueId})
                            </option>
                          ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const newResponses = (activeTree.responses || []).filter((_, i) => i !== respIndex);
                          updateTree(activeDialogueTab, { responses: newResponses });
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
                      updateTree(activeDialogueTab, { responses: [...(activeTree.responses || []), ''] });
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Add Response Link
                  </Button>
                </div>
              )}
            </div>

            {/* Visual branching arrows */}
            <BranchingPanel
              trees={dialogueTrees}
              activeTab={activeDialogueTab}
              onNavigate={(idx) => { setActiveDialogueTab(idx); setEditingIdIndex(null); }}
            />
            
            {/* Requirements - Expandable */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => updateTree(activeDialogueTab, { _reqExpanded: !activeTree._reqExpanded })}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>Visibility Conditions ({activeTree.requirements.length})</span>
                </div>
                {activeTree._reqExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeTree._reqExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {activeTree.requirements.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">Everyone can see this dialogue. Add conditions to restrict it.</p>
                  )}
                  {activeTree.requirements.map((req, reqIndex) => {
                    const config = REQ_CONFIG[req.type] || REQ_CONFIG.status;
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
                          <optgroup label="Status">
                            <option value="status">Has Status</option>
                            <option value="not_status">Missing Status</option>
                          </optgroup>
                          <optgroup label="Items">
                            <option value="item">Has Item</option>
                            <option value="not_item">Has Not Item</option>
                          </optgroup>
                          <optgroup label="Level">
                            <option value="level">Min Level</option>
                            <option value="not_level">Max Level</option>
                          </optgroup>
                          <optgroup label="Currency">
                            <option value="currency">Min Currency</option>
                            <option value="not_currency">Max Currency</option>
                          </optgroup>
                          <optgroup label="Class">
                            <option value="class">Has Class</option>
                            <option value="not_class">Has Not Class</option>
                          </optgroup>
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
                onClick={() => updateTree(activeDialogueTab, { _dlgExpanded: !activeTree._dlgExpanded })}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-blue-400" />
                  <span>Dialogues ({activeTree.dialogues.length})</span>
                </div>
                {activeTree._dlgExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeTree._dlgExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {activeTree.dialogues.map((dlg, dlgIndex) => (
                    <div key={dlg.id} className="space-y-1">
                      <div className="flex gap-2 items-start">
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
                      {/* Optional voice/portrait for this line */}
                      {(dlg.voice || dlg.portrait) ? (
                        <div className="flex gap-2 ml-14">
                          <div className="flex items-center gap-1 flex-1">
                            <Volume2 className="w-3 h-3 text-muted-foreground shrink-0" />
                            <Input
                              value={dlg.voice || ''}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                                newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], voice: e.target.value || undefined };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                                setDialogueTrees(newTrees);
                              }}
                              placeholder="Voice file (e.g. intro.ogg)"
                              className="h-6 text-[10px] flex-1"
                            />
                          </div>
                          <div className="flex items-center gap-1 flex-1">
                            <Image className="w-3 h-3 text-muted-foreground shrink-0" />
                            <Input
                              value={dlg.portrait || ''}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                                newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], portrait: e.target.value || undefined };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                                setDialogueTrees(newTrees);
                              }}
                              placeholder="Portrait override"
                              className="h-6 text-[10px] flex-1"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0 text-muted-foreground"
                            onClick={() => {
                              const newTrees = [...dialogueTrees];
                              const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                              newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], voice: undefined, portrait: undefined };
                              newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                              setDialogueTrees(newTrees);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="ml-14 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          onClick={() => {
                            const newTrees = [...dialogueTrees];
                            const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                            newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], voice: '', portrait: '' };
                            newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                            setDialogueTrees(newTrees);
                          }}
                        >
                          + voice / portrait
                        </button>
                      )}
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
                onClick={() => updateTree(activeDialogueTab, { _rewExpanded: !activeTree._rewExpanded })}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-500" />
                  <span>Rewards ({activeTree.rewards?.length || 0})</span>
                </div>
                {activeTree._rewExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeTree._rewExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">What does the player gain or lose?</p>
                  {(activeTree.rewards || []).map((rew, rewIndex) => (
                    <div key={rew.id} className={`flex gap-2 items-center p-2 rounded-md ${
                      rew.type === 'msg' ? 'bg-sky-500/10 border-l-2 border-l-sky-500/50' :
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
                        <option value="msg">Notification</option>
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
                        placeholder={
                          rew.type === 'item' || rew.type === 'remove_item' ? 'Item ID...' :
                          rew.type === 'restore' ? 'hp/mp/all' :
                          rew.type === 'msg' ? 'e.g. Quest added.' :
                          'Amount...'
                        }
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
                onClick={() => updateTree(activeDialogueTab, { _wfExpanded: !activeTree._wfExpanded })}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span>World Effects ({activeTree.worldEffects?.length || 0})</span>
                  <span className="text-xs text-muted-foreground">(Advanced)</span>
                </div>
                {activeTree._wfExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeTree._wfExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">What happens in the world after this?</p>
                  {(activeTree.worldEffects || []).map((wf, wfIndex) => (
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
              dialogueId: tree.dialogueId || '',
              topic: tree.topic,
              group: tree.group || undefined,
              responseOnly: tree.responseOnly || false,
              responses: (tree.responses || []).filter(Boolean),
              requirements: tree.requirements.filter(r => r.value.trim()),
              dialogues: tree.dialogues.filter(d => d.text.trim()).map(d => ({
                id: d.id,
                speaker: d.speaker,
                text: d.text,
                ...(d.voice ? { voice: d.voice } : {}),
                ...(d.portrait ? { portrait: d.portrait } : {}),
              })),
              rewards: (tree.rewards || []).filter(r => r.value.trim()),
              worldEffects: (tree.worldEffects || []).filter(w => w.value.trim())
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
};

export default DialogueTreeDialog;

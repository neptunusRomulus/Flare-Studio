import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { useAppContext } from '@/context/AppContext';
import { cleanDialogueTreesForSave } from '@/editor/dialogueTreesClean';
import type { DialogueTree, MapObject } from '@/types';
import ResizeHandle from '@/components/ResizeHandle';
import MomentChatView from '@/components/dialogue/MomentChatView';
import { otherMoment, type RoleMoment } from '@/editor/roleMoments';

function defaultNpcPortrait(object: MapObject | null): string {
  const value = String(object?.properties?.portraitPath || object?.properties?.portrait || '');
  if (!value || value.startsWith('data:')) return '';
  return value;
}

const DialogueTreeDialog = ({
  showDialogueTreeDialog,
  dialogueTrees = [],
  setDialogueTrees,
  onClose,
  editingObject,
  updateEditingObjectProperty,
  embedded = false,
  visibleDialogueIds,
  selectedMoment,
}: {
  showDialogueTreeDialog: boolean;
  dialogueTrees?: DialogueTree[];
  setDialogueTrees: React.Dispatch<React.SetStateAction<DialogueTree[]>>;
  /** Kept so existing callers can keep passing list-era tab props. */
  activeDialogueTab?: number;
  setActiveDialogueTab?: React.Dispatch<React.SetStateAction<number>>;
  dialogueTabToDelete?: number | null;
  setDialogueTabToDelete?: React.Dispatch<React.SetStateAction<number | null>>;
  onClose: () => void;
  editingObject: MapObject | null;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
  projectMaps?: string[];
  /** Render inside the role center instead of a floating window. */
  embedded?: boolean;
  /** When set, only these topic ids are shown. Other topics stay in the data. */
  visibleDialogueIds?: string[] | null;
  selectedMoment?: RoleMoment | null;
}) => {
  const visibleIndexSet = useMemo(() => {
    if (!visibleDialogueIds) return null;
    const ids = new Set(visibleDialogueIds);
    return new Set(dialogueTrees.map((tree, index) => (ids.has(tree.dialogueId) || ids.has(tree.id) ? index : -1)).filter((index) => index >= 0));
  }, [dialogueTrees, visibleDialogueIds]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { controls } = useAppContext() as any;
  const currentProjectPath = controls?.currentProjectPath ?? null;

  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'dialogue_tree_dialog', initialWidth: 900, initialHeight: 620, minWidth: 700, minHeight: 450 });

  useEffect(() => {
    if (!showDialogueTreeDialog) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showDialogueTreeDialog, onClose]);

  const frame = (
    <div
      ref={dialogRef}
      className={embedded ? 'flex flex-col w-full h-full min-h-0' : 'bg-background border border-border/70 rounded-lg flex flex-col shadow-xl'}
      style={embedded ? { pointerEvents: 'auto' } : {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 50,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!embedded && (
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border cursor-move select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Dialogue Trees</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-6 h-6 p-0 hover:bg-transparent"
            onClick={onClose}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden p-4">
        <MomentChatView
          trees={dialogueTrees}
          visibleTrees={dialogueTrees.filter((tree, index) => !visibleIndexSet || visibleIndexSet.has(index))}
          setTrees={setDialogueTrees}
          moment={selectedMoment || otherMoment()}
          npcName={String(editingObject?.name || '')}
          npcPortrait={defaultNpcPortrait(editingObject)}
          projectPath={currentProjectPath}
        />
      </div>

      {!embedded && (
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <Button
            size="icon"
            className="h-9 w-9"
            disabled={!dialogueTrees.some((tree) => tree.topic.trim() && tree.dialogues.some((d) => d.text.trim()))}
            title={!dialogueTrees.some((tree) => tree.topic.trim() && tree.dialogues.some((d) => d.text.trim()))
              ? 'Each dialogue needs a topic and at least one dialogue line'
              : 'Save dialogues'}
            onClick={() => {
              const cleanTrees = cleanDialogueTreesForSave(dialogueTrees);
              if (cleanTrees.length === 0) return;
              if (editingObject) updateEditingObjectProperty('dialogueTrees', JSON.stringify(cleanTrees));
              onClose();
            }}
          >
            <Save className="w-4 h-4" />
          </Button>
        </div>
      )}

      {!embedded && (
        <ResizeHandle onMouseDown={handleResizeMouseDown} />
      )}
    </div>
  );

  if (embedded) return frame;
  return (
    <>
      {!showDialogueTreeDialog ? null : createPortal(frame, document.body)}
    </>
  );
};

export default DialogueTreeDialog;

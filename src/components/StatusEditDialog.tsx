import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { Save, X, Tag } from 'lucide-react';

type StatusEditDialogProps = {
  open: boolean;
  onClose: () => void;
};

const CATEGORY_OPTIONS = [
  'NPC',
  'Quest',
  'Item',
  'Event',
  'Power',
  'Enemy',
  'World'
];

const relationTypes = ['Quest', 'Item', 'Event', 'Power', 'Enemy', 'World'];

const generateStatusId = (name: string) => {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return normalized || 'status_id';
};

const CollapsibleSection = ({
  title,
  children,
  defaultOpen = true
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 text-left text-sm font-semibold text-foreground"
      >
        <span>{title}</span>
        <span className="text-muted-foreground">{isOpen ? 'Collapse' : 'Expand'}</span>
      </button>
      {isOpen && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
};

const StatusEditDialog = ({ open, onClose }: StatusEditDialogProps) => {
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown
  } = useDraggableResizable({ id: 'status_edit_dialog', initialWidth: 760, initialHeight: 520 });

  const [statusName, setStatusName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const statusId = useMemo(() => generateStatusId(statusName), [statusName]);
  const saveDisabled = !statusName.trim() || !category;

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const flowData = relationTypes.map((relation) => ({
    relation,
    items: [] as string[]
  }));

  return createPortal(
    <div
      ref={dialogRef}
      className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 50,
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center gap-2 cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <Tag className="w-5 h-5 text-orange-500 flex-shrink-0" />
        <h3 className="text-lg font-semibold flex-1">Edit Status</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6 text-foreground/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
        <CollapsibleSection title="Identity" defaultOpen>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Status Name <span className="text-rose-500">*</span></label>
                <Input
                  placeholder="Enter status name"
                  className="h-10"
                  value={statusName}
                  onChange={(event) => setStatusName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Category <span className="text-rose-500">*</span></label>
                <Select value={category} onValueChange={(value) => setCategory(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Autogenerated ID</label>
                <Input value={statusId} disabled className="h-10" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-[120px] w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Flow" defaultOpen={false}>
          <div className="rounded-xl border border-border bg-muted p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Read-only links for this status across quests, items, events, powers, enemies and world logic.
            </p>
            <div className="overflow-hidden rounded-md border border-border bg-background">
              <div className="grid grid-cols-[1.5fr_2.5fr] bg-slate-950/10 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>Relation</span>
                <span>Linked entities</span>
              </div>
              <div className="divide-y divide-border/50">
                {flowData.map(({ relation, items }) => (
                  <div key={relation} className="grid grid-cols-[1.5fr_2.5fr] px-4 py-3 text-sm text-foreground">
                    <div className="font-medium">{relation}</div>
                    <div className="text-sm text-muted-foreground">
                      {items.length > 0 ? items.join(', ') : 'No linked entities'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <div className="border-t border-border/50 px-6 py-3 flex items-center justify-end">
        <Tooltip content="Save Status" side="top">
          <Button
            size="icon"
            variant="default"
            onClick={() => !saveDisabled && onClose()}
            disabled={saveDisabled}
            className="h-10 w-10"
          >
            <Save className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>

      <div
        className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeMouseDown}
      />
    </div>,
    document.body,
  );
};

export default StatusEditDialog;

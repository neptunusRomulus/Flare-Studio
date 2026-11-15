import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { RoleMoment } from '@/editor/roleMoments';

type Props = {
  moments: RoleMoment[];
  other: RoleMoment;
  selectedId: string;
  topicCounts: Record<string, number>;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  /** Optional badge on a moment, e.g. shop-open indicator. */
  badges?: Record<string, string>;
};

const MomentsStrip = ({ moments, other, selectedId, topicCounts, onSelect, onAdd, badges }: Props) => {
  const cards = [...moments, other];
  return (
    <div className="flex items-stretch gap-1.5 min-h-[3.25rem] overflow-x-auto pb-0.5">
      {cards.map((moment) => {
        const selected = moment.id === selectedId;
        const tip = moment.key ? `${moment.requiresStatus.length ? 'requires_status' : 'requires_not_status'}=${moment.key}` : moment.title;
        return (
          <Tooltip key={moment.id} content={tip}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSelect(moment.id)}
              className={`shrink-0 w-32 h-auto rounded-md border px-2 py-1.5 text-left transition-colors ${
                selected ? 'border-blue-500/50 bg-blue-500/10' : 'border-border bg-muted/20 hover:bg-muted/50'
              }`}
            >
              <span className="block w-full text-xs font-semibold truncate">{moment.title}</span>
              <span className="block w-full text-[10px] text-muted-foreground truncate font-normal">
                {badges?.[moment.id] ? badges[moment.id] : `${topicCounts[moment.id] || 0} topics`}
              </span>
            </Button>
          </Tooltip>
        );
      })}
      {onAdd && (
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          className="shrink-0 h-auto px-2 rounded-md border-dashed text-muted-foreground hover:bg-muted/50 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add moment
        </Button>
      )}
    </div>
  );
};

export default MomentsStrip;

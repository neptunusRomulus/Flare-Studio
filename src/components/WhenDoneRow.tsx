import { useState, type ReactNode } from 'react';
import { Coins, Flag, Gift, Package, Plus, Sparkles, X } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { STORY_FLAG_LIST_ID } from '@/editor/powers/storyFlags';
import { joinStatusList, splitStatusList } from '@/editor/questSteps';

export type WhenDoneRewards = {
  set_status?: string;
  reward_xp?: string;
  reward_currency?: string;
  reward_item?: string;
  reward_loot?: string;
};

type Props = {
  completeStatus: string;
  onCompleteStatusChange: (value: string) => void;
  rewards: WhenDoneRewards;
  onRewardsChange: (rewards: WhenDoneRewards) => void;
  items?: Array<{ id: string | number; name?: string }>;
};

type OpenKey = 'flags' | 'items' | 'xp' | 'currency' | 'loot' | null;

const WhenDoneRow = ({ completeStatus, onCompleteStatusChange, rewards, onRewardsChange, items = [] }: Props) => {
  const [open, setOpen] = useState<OpenKey>(null);
  const flags = splitStatusList(completeStatus);
  const setFlags = splitStatusList(rewards.set_status);
  const itemTokens = splitStatusList(rewards.reward_item);
  const toggle = (key: OpenKey) => setOpen((current) => (current === key ? null : key));

  return (
    <div className="relative space-y-1 pt-1 border-t border-border/60">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">When done</div>
      <div className="flex flex-wrap items-center gap-1">
        <IconButton
          label="Story Flags"
          tip="complete_status — the quest is shown as complete when these flags are set. set_status is an event key."
          icon={Flag}
          active={flags.length + setFlags.length > 0}
          onClick={() => toggle('flags')}
        />
        <IconButton label="Items" tip="reward_item" icon={Package} active={itemTokens.length > 0} onClick={() => toggle('items')} />
        <IconButton label="XP" tip="reward_xp" icon={Sparkles} active={!!rewards.reward_xp} onClick={() => toggle('xp')} />
        <IconButton label="Currency" tip="reward_currency" icon={Coins} active={!!rewards.reward_currency} onClick={() => toggle('currency')} />
        <IconButton label="Loot" tip="reward_loot" icon={Gift} active={!!rewards.reward_loot} onClick={() => toggle('loot')} />
      </div>
      {open === 'flags' && (
        <Panel onClose={() => setOpen(null)}>
          <p className="text-[11px] text-muted-foreground">complete_status</p>
          {flags.map((flag, index) => (
            <FlagInput
              key={`c-${index}`}
              value={flag}
              onChange={(value) => onCompleteStatusChange(joinStatusList(flags.map((entry, i) => (i === index ? value : entry))))}
              onRemove={() => onCompleteStatusChange(joinStatusList(flags.filter((_, i) => i !== index)))}
            />
          ))}
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5" onClick={() => onCompleteStatusChange(joinStatusList([...flags, '']))}>
            <Plus className="w-3 h-3" /> Flag
          </button>
          <p className="text-[11px] text-muted-foreground pt-1">set_status</p>
          {setFlags.map((flag, index) => (
            <FlagInput
              key={`s-${index}`}
              value={flag}
              onChange={(value) => onRewardsChange({ ...rewards, set_status: joinStatusList(setFlags.map((entry, i) => (i === index ? value : entry))) })}
              onRemove={() => onRewardsChange({ ...rewards, set_status: joinStatusList(setFlags.filter((_, i) => i !== index)) })}
            />
          ))}
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5" onClick={() => onRewardsChange({ ...rewards, set_status: joinStatusList([...setFlags, '']) })}>
            <Plus className="w-3 h-3" /> Flag
          </button>
        </Panel>
      )}
      {open === 'items' && (
        <Panel onClose={() => setOpen(null)}>
          {itemTokens.map((token, index) => (
            <div key={`i-${index}`} className="flex items-center gap-1">
              <select
                className="h-6 flex-1 rounded border border-input bg-background text-[11px]"
                value={token.split(':')[0]}
                onChange={(e) => {
                  const qty = token.includes(':') ? token.slice(token.indexOf(':')) : '';
                  onRewardsChange({ ...rewards, reward_item: joinStatusList(itemTokens.map((entry, i) => (i === index ? `${e.target.value}${qty}` : entry))) });
                }}
              >
                <option value="">Item</option>
                {items.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.name || item.id}</option>
                ))}
              </select>
              <Input
                className="h-6 w-12 text-[11px]"
                type="number"
                min={1}
                value={token.split(':')[1] || 1}
                onChange={(e) => {
                  const id = token.split(':')[0];
                  const qty = Math.max(1, Number(e.target.value) || 1);
                  onRewardsChange({ ...rewards, reward_item: joinStatusList(itemTokens.map((entry, i) => (i === index ? `${id}:${qty}` : entry))) });
                }}
              />
              <button type="button" aria-label="Remove" onClick={() => onRewardsChange({ ...rewards, reward_item: joinStatusList(itemTokens.filter((_, i) => i !== index)) })}>
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5" onClick={() => onRewardsChange({ ...rewards, reward_item: joinStatusList([...itemTokens, '']) })}>
            <Plus className="w-3 h-3" /> Item
          </button>
        </Panel>
      )}
      {open === 'xp' && (
        <Panel onClose={() => setOpen(null)}>
          <Input className="h-7 text-xs" type="number" min={0} value={rewards.reward_xp || ''} placeholder="XP" onChange={(e) => onRewardsChange({ ...rewards, reward_xp: e.target.value })} />
        </Panel>
      )}
      {open === 'currency' && (
        <Panel onClose={() => setOpen(null)}>
          <Input className="h-7 text-xs" type="number" min={0} value={rewards.reward_currency || ''} placeholder="Currency" onChange={(e) => onRewardsChange({ ...rewards, reward_currency: e.target.value })} />
        </Panel>
      )}
      {open === 'loot' && (
        <Panel onClose={() => setOpen(null)}>
          <Input className="h-7 font-mono text-xs" value={rewards.reward_loot || ''} placeholder="loot/table.txt" onChange={(e) => onRewardsChange({ ...rewards, reward_loot: e.target.value })} />
        </Panel>
      )}
    </div>
  );
};

const FlagInput = ({ value, onChange, onRemove }: { value: string; onChange: (value: string) => void; onRemove: () => void }) => (
  <div className="flex items-center gap-1">
    <Input className="h-6 text-[11px]" list={STORY_FLAG_LIST_ID} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Story Flag" />
    <button type="button" aria-label="Remove" onClick={onRemove}><X className="w-3 h-3 text-muted-foreground" /></button>
  </div>
);

const Panel = ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
  <div className="rounded-md border border-border bg-background p-2 space-y-1 shadow-sm">
    {children}
    <button type="button" className="sr-only" onClick={onClose}>Close</button>
  </div>
);

const IconButton = ({
  label, tip, icon: Icon, active, onClick,
}: {
  label: string;
  tip: string;
  icon: typeof Flag;
  active: boolean;
  onClick: () => void;
}) => (
  <Tooltip content={tip}>
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`h-6 w-6 inline-flex items-center justify-center rounded border ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  </Tooltip>
);

export default WhenDoneRow;

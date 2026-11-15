import React from 'react';
import { Image as ImageIcon, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Tooltip from '@/components/ui/tooltip';
import type { DialogueLine } from '@/types';

const PORTRAIT_KEYS: Array<NonNullable<DialogueLine['portraitKey']>> = [
  'portrait_him',
  'portrait_her',
  'portrait_you',
  'portrait',
];

const ChatLineDetails = ({
  line,
  npc,
  onPatch,
}: {
  line: DialogueLine;
  npc: boolean;
  onPatch: (patch: Partial<DialogueLine>) => void;
}) => {
  const defaultKey = npc ? 'portrait_him' : 'portrait_you';
  const hasMeta = Boolean(line.voice || line.portrait || line.key || (line.portraitKey && line.portraitKey !== defaultKey));

  return (
    <Popover>
      <Tooltip content="Voice and portrait">
        <PopoverTrigger>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-5 w-5 ${hasMeta ? 'text-foreground' : 'text-muted-foreground'}`}
            aria-label="Voice and portrait"
          >
            {line.portrait ? <ImageIcon className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-64 space-y-2 text-left">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`voice-${line.id}`} className="w-16 shrink-0 text-[11px] font-normal text-muted-foreground">Voice</Label>
          <Input
            id={`voice-${line.id}`}
            className="h-6 flex-1 px-1 text-xs"
            value={line.voice || ''}
            placeholder="sound id"
            onChange={(e) => onPatch({ voice: e.target.value || undefined })}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`portrait-${line.id}`} className="w-16 shrink-0 text-[11px] font-normal text-muted-foreground">Portrait</Label>
          <Input
            id={`portrait-${line.id}`}
            className="h-6 flex-1 px-1 text-xs"
            value={line.portrait || ''}
            placeholder="image path"
            onChange={(e) => onPatch({ portrait: e.target.value || undefined })}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="w-16 shrink-0 text-[11px] font-normal text-muted-foreground">Key</Label>
          <Select
            value={line.portraitKey || defaultKey}
            onValueChange={(value) => onPatch({ portraitKey: value as DialogueLine['portraitKey'] })}
          >
            <SelectTrigger className="h-6 flex-1 px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PORTRAIT_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{key}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {npc && (
          <div className="flex items-center gap-2">
            <Switch
              id={`her-${line.id}`}
              checked={line.key === 'her'}
              onCheckedChange={(checked) => onPatch({ key: checked ? 'her' : undefined })}
              className="scale-75"
            />
            <Tooltip content="Flare line key: her instead of the default him">
              <Label htmlFor={`her-${line.id}`} className="text-[11px] font-normal text-muted-foreground">NPC is her</Label>
            </Tooltip>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ChatLineDetails;

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Tooltip from '@/components/ui/tooltip';
import { Check, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import SpriteFrameThumb from '@/components/SpriteFrameThumb';
import {
  enemyLookSelectionProps,
  findEnemyLook,
  resolveEnemyLooks,
  resolveEnemyPortraits,
  type EnemyLookOption,
} from '@/flare/enemyAppearance';
import { portraitSelectionProps, type NpcPortraitOption } from '@/flare/npcAppearance';

type Props = {
  projectPath: string;
  animations: string;
  tilesetPath: string;
  portraitPath: string;
  onSelectLook: (props: Record<string, string | null>) => void;
  onSelectPortrait: (props: Record<string, string | null>) => void;
};

/** Enemy sprite + portrait picker: fantasycore first, then the project's own files. */
const EnemyAppearancePicker = ({
  projectPath,
  animations,
  tilesetPath,
  portraitPath,
  onSelectLook,
  onSelectPortrait,
}: Props) => {
  const [looksExpanded, setLooksExpanded] = useState(true);
  const [portraitsExpanded, setPortraitsExpanded] = useState(false);
  const [looks, setLooks] = useState<EnemyLookOption[]>([]);
  const [portraits, setPortraits] = useState<NpcPortraitOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [nextLooks, nextPortraits] = await Promise.all([
        resolveEnemyLooks(projectPath),
        resolveEnemyPortraits(projectPath),
      ]);
      if (cancelled) return;
      setLooks(nextLooks);
      setPortraits(nextPortraits);
    })();
    return () => { cancelled = true; };
  }, [projectPath]);

  const selectedLook = findEnemyLook(looks, animations, tilesetPath);

  return (
    <div className="border border-border rounded-md bg-muted/20">
      <Collapsible open={looksExpanded} onOpenChange={setLooksExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="w-full h-auto px-3 py-2 justify-start gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md rounded-b-none"
          >
            {looksExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            <span>Sprite</span>
            <Tooltip content="Pick an enemy sprite from fantasycore (or the project). Sets animations on save.">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </Tooltip>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3">
            {looks.length > 0 ? (
              <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
                {looks.map((look) => (
                  <SpriteFrameThumb
                    key={`${look.source}:${look.animation}`}
                    imagePath={look.imagePath}
                    frame={look.frame}
                    alt={look.label}
                    title={look.label}
                    selected={selectedLook?.animation === look.animation}
                    onClick={() => onSelectLook(enemyLookSelectionProps(look))}
                    className="h-16 w-full"
                  />
                ))}
              </div>
            ) : (
              <Tooltip content="Install Flare with fantasycore to see enemy sprites here.">
                <p className="text-xs text-muted-foreground">No sprites yet</p>
              </Tooltip>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={portraitsExpanded} onOpenChange={setPortraitsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="w-full h-auto px-3 py-2 justify-start gap-2 text-sm font-medium hover:bg-muted/50 rounded-none"
          >
            {portraitsExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            <span>Portrait</span>
            <Tooltip content="Optional portrait for this enemy, shown in Studio lists.">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </Tooltip>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3">
            {portraits.length > 0 ? (
              <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1">
                {portraits.map((portrait) => (
                  <NpcAssetThumb
                    key={`${portrait.source}:${portrait.path}`}
                    imagePath={portrait.imagePath}
                    alt={portrait.label}
                    title={portrait.label}
                    selected={portraitPath === portrait.path || portraitPath === portrait.imagePath}
                    onClick={() => onSelectPortrait(portraitSelectionProps(portrait))}
                    className="h-14 w-full"
                  />
                ))}
              </div>
            ) : (
              <Tooltip content="Add portraits to fantasycore or the project to pick one here.">
                <p className="text-xs text-muted-foreground">No portraits yet</p>
              </Tooltip>
            )}
            {portraitPath ? (
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Check className="w-3 h-3 text-green-500" /> {portraitPath}
              </span>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default EnemyAppearancePicker;

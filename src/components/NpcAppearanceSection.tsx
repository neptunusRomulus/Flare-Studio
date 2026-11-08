import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Check, ChevronDown, ChevronUp, HelpCircle, Image, Sparkles, User } from 'lucide-react';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import {
  appearanceSelectionProps,
  looksFromTemplateListing,
  portraitSelectionProps,
  portraitsFromTemplateListing,
  type NpcLookOption,
  type NpcPortraitOption,
} from '@/flare/npcAppearance';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import DirectionField from '@/components/DirectionField';

type Props = {
  projectPath: string | null;
  selectedAnimation: string;
  selectedPortrait: string;
  stanceDirection: string;
  canUseTilesetDialog: boolean;
  hasTilesetPath: boolean;
  onSelectLook: (props: Record<string, string | null>) => void;
  onSelectPortrait: (props: Record<string, string | null>) => void;
  onStanceChange: (value: string | null) => void;
  onImportTileset: () => void;
  onAutoDetect: () => void;
  onBrowsePortrait: () => void;
};

const firstValue = (text: string, key: string): string | null => {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return null;
};

const NpcAppearanceSection = ({
  projectPath,
  selectedAnimation,
  selectedPortrait,
  stanceDirection,
  canUseTilesetDialog,
  hasTilesetPath,
  onSelectLook,
  onSelectPortrait,
  onStanceChange,
  onImportTileset,
  onAutoDetect,
  onBrowsePortrait,
}: Props) => {
  const [looksExpanded, setLooksExpanded] = useState(true);
  const [portraitsExpanded, setPortraitsExpanded] = useState(false);
  const [looks, setLooks] = useState<NpcLookOption[]>([]);
  const [portraits, setPortraits] = useState<NpcPortraitOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const flarePath = getStoredFlarePath();
      const api = window.electronAPI;
      const nextLooks: NpcLookOption[] = [];
      const nextPortraits: NpcPortraitOption[] = [];
      let modDir: string | null = null;

      if (flarePath && api?.listTemplateActors) {
        try {
          const listing = await api.listTemplateActors(flarePath);
          if (listing.ok) {
            modDir = listing.modDir || null;
            nextLooks.push(...looksFromTemplateListing(listing));
            nextPortraits.push(...portraitsFromTemplateListing(listing));
          }
        } catch {
          /* ignore */
        }
      }

      if (projectPath && api?.readDir && api?.readFile) {
        const root = projectPath.replace(/\\/g, '/').replace(/\/$/, '');
        try {
          const animEntries = await api.readDir(`${root}/animations/npcs`);
          for (const entry of animEntries.filter((e) => e.isDirectory === false && /\.txt$/i.test(e.name))) {
            const animation = `animations/npcs/${entry.name}`;
            if (nextLooks.some((l) => l.animation === animation)) continue;
            const text = await api.readFile(`${root}/${animation}`);
            const image = text ? firstValue(text, 'image') : null;
            let imagePath: string | null = null;
            if (image) {
              const projectImg = `${root}/${image}`;
              if (api.fileExists && await api.fileExists(projectImg)) imagePath = projectImg;
              else if (modDir) imagePath = `${modDir.replace(/\\/g, '/')}/${image}`;
            }
            nextLooks.push({
              key: entry.name.replace(/\.txt$/i, ''),
              label: entry.name.replace(/\.txt$/i, ''),
              animation,
              image,
              imagePath,
              source: 'project',
            });
          }
        } catch {
          /* no project animations */
        }
        try {
          const portraitEntries = await api.readDir(`${root}/images/portraits`);
          for (const entry of portraitEntries.filter((e) => e.isDirectory === false && /\.png$/i.test(e.name))) {
            const path = `images/portraits/${entry.name}`;
            if (nextPortraits.some((p) => p.path === path)) continue;
            nextPortraits.push({
              key: entry.name.replace(/\.png$/i, ''),
              label: entry.name.replace(/\.png$/i, ''),
              path,
              imagePath: `${root}/${path}`,
              source: 'project',
            });
          }
        } catch {
          /* no project portraits */
        }
      }

      if (!cancelled) {
        setLooks(nextLooks);
        setPortraits(nextPortraits);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [projectPath]);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-md bg-muted/20">
        <button
          type="button"
          onClick={() => setLooksExpanded(!looksExpanded)}
          className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
        >
          {looksExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          <span>Appearance</span>
          <Tooltip content="Pick a sprite from fantasycore (or the project). Custom imports still work below.">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </Tooltip>
        </button>
        {looksExpanded && (
          <div className="space-y-3 px-3 pb-3">
            {looks.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {looks.map((look) => (
                  <NpcAssetThumb
                    key={`${look.source}:${look.animation}`}
                    imagePath={look.imagePath}
                    alt={look.label}
                    title={look.label}
                    selected={selectedAnimation === look.animation}
                    onClick={() => onSelectLook(appearanceSelectionProps(look))}
                    className="h-16 w-full"
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No NPC animations found. Import a tileset or install Flare with fantasycore.</p>
            )}

            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 gap-1.5"
                  onClick={onImportTileset}
                  disabled={!canUseTilesetDialog}
                >
                  <Image className="w-3.5 h-3.5" />
                  <span className="text-xs">Import Tileset</span>
                </Button>
                {hasTilesetPath && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </span>
                )}
              </div>
              {hasTilesetPath && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                  onClick={onAutoDetect}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs">Auto Detect</span>
                </Button>
              )}
            </div>

            <DirectionField
              value={stanceDirection}
              onChange={onStanceChange}
              label="Stance direction"
              tooltip="direction — The direction to use for this NPC's stance animation. Facing on the map is set separately in Properties."
            />
          </div>
        )}
      </div>

      <div className="border border-border rounded-md bg-muted/20">
        <button
          type="button"
          onClick={() => setPortraitsExpanded(!portraitsExpanded)}
          className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
        >
          {portraitsExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          <span>Portrait</span>
          <Tooltip content="Dialog portrait shown when talking to this NPC.">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </Tooltip>
        </button>
        {portraitsExpanded && (
          <div className="space-y-3 px-3 pb-3">
            {portraits.length > 0 ? (
              <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-1">
                {portraits.map((portrait) => (
                  <NpcAssetThumb
                    key={`${portrait.source}:${portrait.path}`}
                    imagePath={portrait.imagePath}
                    alt={portrait.label}
                    title={portrait.label}
                    selected={selectedPortrait === portrait.path || selectedPortrait === portrait.imagePath}
                    onClick={() => onSelectPortrait(portraitSelectionProps(portrait))}
                    className="h-14 w-full"
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No portraits found in fantasycore or the project.</p>
            )}
            <div className="relative inline-flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1.5"
                onClick={onBrowsePortrait}
                disabled={!canUseTilesetDialog}
              >
                <User className="w-3.5 h-3.5" />
                <span className="text-xs">Import portrait</span>
              </Button>
              {selectedPortrait && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NpcAppearanceSection;

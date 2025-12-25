/**
 * World & Flow Panel Component (Advanced)
 * 
 * Handles teleport, cutscenes, audio, spawn, status changes, and misc advanced attributes.
 * Hidden by default, shown under "Advanced" toggle.
 */

import React from 'react';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import {
  WorldFlowConfig,
  TeleportMode
} from '../../types/dialogueEditor';
import { 
  ChevronDown, 
  MapPin, 
  Film, 
  Volume2, 
  Users, 
  Tag, 
  Book, 
  Box, 
  Settings,
  Zap,
  Save,
  RefreshCw,
  FileCode,
  Map,
  Sparkles
} from 'lucide-react';

interface WorldFlowPanelProps {
  config: WorldFlowConfig;
  onChange: (config: WorldFlowConfig) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const WorldFlowPanel: React.FC<WorldFlowPanelProps> = ({
  config,
  onChange,
  expanded = false,
  onToggleExpand
}) => {
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateTeleport = (updates: Partial<typeof config.teleport>) => {
    onChange({ ...config, teleport: { ...config.teleport, ...updates } });
  };

  const updateSpawn = (updates: Partial<typeof config.spawn>) => {
    onChange({ ...config, spawn: { ...config.spawn, ...updates } });
  };

  const updateAudio = (updates: Partial<typeof config.audio>) => {
    onChange({ ...config, audio: { ...config.audio, ...updates } });
  };

  const updateCutscene = (updates: Partial<typeof config.cutscene>) => {
    onChange({ ...config, cutscene: { ...config.cutscene, ...updates } });
  };

  const updateStatusChange = (updates: Partial<typeof config.statusChange>) => {
    onChange({ ...config, statusChange: { ...config.statusChange, ...updates } });
  };

  const updateNpcInteraction = (updates: Partial<typeof config.npcInteraction>) => {
    onChange({ ...config, npcInteraction: { ...config.npcInteraction, ...updates } });
  };

  const updateBook = (updates: Partial<typeof config.book>) => {
    onChange({ ...config, book: { ...config.book, ...updates } });
  };

  const updateStash = (updates: Partial<typeof config.stash>) => {
    onChange({ ...config, stash: { ...config.stash, ...updates } });
  };

  const updateMapMod = (updates: Partial<typeof config.mapMod>) => {
    onChange({ ...config, mapMod: { ...config.mapMod, ...updates } });
  };

  const updatePower = (updates: Partial<typeof config.power>) => {
    onChange({ ...config, power: { ...config.power, ...updates } });
  };

  const updateAdvanced = (updates: Partial<typeof config.advanced>) => {
    onChange({ ...config, advanced: { ...config.advanced, ...updates } });
  };

  // Count active effects
  const activeCount = [
    config.teleport.enabled,
    config.spawn.enabled,
    config.cutscene.enabled,
    config.audio.soundFx || config.audio.music,
    config.statusChange.setStatuses.length > 0 || config.statusChange.unsetStatuses.length > 0,
    config.npcInteraction.enabled,
    config.book.enabled,
    config.stash.enabled,
    config.mapMod.enabled,
    config.power.enabled,
    config.advanced.chanceExec !== undefined || config.advanced.repeat || config.advanced.saveGame || config.advanced.respec || config.advanced.scriptFile
  ].filter(Boolean).length;

  const renderSection = (
    id: string,
    icon: React.ReactNode,
    title: string,
    enabled: boolean,
    onToggleEnabled: (enabled: boolean) => void,
    children: React.ReactNode
  ) => (
    <div className="border rounded-md">
      <div className="px-3 py-2 flex items-center gap-2">
        <Switch
          checked={enabled}
          onCheckedChange={onToggleEnabled}
          className="scale-75"
        />
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="flex-1 flex items-center gap-2 text-left"
          disabled={!enabled}
        >
          <span className={enabled ? '' : 'opacity-50'}>{icon}</span>
          <span className={`text-xs font-medium ${enabled ? '' : 'opacity-50'}`}>{title}</span>
        </button>
        {enabled && (
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedSections[id] ? 'rotate-180' : ''}`} />
        )}
      </div>
      {enabled && expandedSections[id] && (
        <div className="px-3 pb-3 pt-1 border-t space-y-2">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded-t-md"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-500" />
          <span>World & Flow</span>
          <span className="text-xs text-muted-foreground">(Advanced)</span>
          {activeCount > 0 && (
            <span className="text-xs bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
              {activeCount}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            What happens in the world after this choice?
          </p>

          {/* Teleport */}
          {renderSection(
            'teleport',
            <MapPin className="w-3.5 h-3.5 text-blue-500" />,
            'Teleport Player',
            config.teleport.enabled,
            (enabled) => updateTeleport({ enabled }),
            <>
              <div className="flex gap-2">
                <select
                  value={config.teleport.mode}
                  onChange={(e) => updateTeleport({ mode: e.target.value as TeleportMode })}
                  className="h-7 px-2 rounded-md border text-xs bg-background"
                >
                  <option value="intramap">Same map</option>
                  <option value="intermap">Another map</option>
                  <option value="intermap_random">Random from list</option>
                </select>
              </div>
              {config.teleport.mode === 'intramap' && (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground">X:</span>
                  <Input
                    type="number"
                    value={config.teleport.x ?? ''}
                    onChange={(e) => updateTeleport({ x: parseInt(e.target.value, 10) || undefined })}
                    className="h-7 w-20 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">Y:</span>
                  <Input
                    type="number"
                    value={config.teleport.y ?? ''}
                    onChange={(e) => updateTeleport({ y: parseInt(e.target.value, 10) || undefined })}
                    className="h-7 w-20 text-xs"
                  />
                </div>
              )}
              {config.teleport.mode === 'intermap' && (
                <>
                  <Input
                    value={config.teleport.mapFile ?? ''}
                    onChange={(e) => updateTeleport({ mapFile: e.target.value })}
                    placeholder="Map file (e.g., maps/town.txt)"
                    className="h-7 text-xs"
                  />
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground">X:</span>
                    <Input
                      type="number"
                      value={config.teleport.x ?? ''}
                      onChange={(e) => updateTeleport({ x: parseInt(e.target.value, 10) || undefined })}
                      className="h-7 w-20 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">Y:</span>
                    <Input
                      type="number"
                      value={config.teleport.y ?? ''}
                      onChange={(e) => updateTeleport({ y: parseInt(e.target.value, 10) || undefined })}
                      className="h-7 w-20 text-xs"
                    />
                  </div>
                </>
              )}
              {config.teleport.mode === 'intermap_random' && (
                <Input
                  value={config.teleport.mapFiles?.join(';') ?? ''}
                  onChange={(e) => updateTeleport({ mapFiles: e.target.value.split(';').filter(Boolean) })}
                  placeholder="Map files (semicolon separated)"
                  className="h-7 text-xs"
                />
              )}
            </>
          )}

          {/* Cutscene */}
          {renderSection(
            'cutscene',
            <Film className="w-3.5 h-3.5 text-amber-500" />,
            'Play Cutscene',
            config.cutscene.enabled,
            (enabled) => updateCutscene({ enabled }),
            <Input
              value={config.cutscene.cutsceneFile}
              onChange={(e) => updateCutscene({ cutsceneFile: e.target.value })}
              placeholder="Cutscene file..."
              className="h-7 text-xs"
            />
          )}

          {/* Audio */}
          {renderSection(
            'audio',
            <Volume2 className="w-3.5 h-3.5 text-green-500" />,
            'Audio',
            !!(config.audio.soundFx || config.audio.music || config.audio.shakyCam),
            (enabled) => {
              if (!enabled) {
                updateAudio({ soundFx: undefined, music: undefined, shakyCam: undefined });
              }
            },
            <>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-16">Sound FX:</span>
                <Input
                  value={config.audio.soundFx ?? ''}
                  onChange={(e) => updateAudio({ soundFx: e.target.value || undefined })}
                  placeholder="Sound file..."
                  className="h-7 text-xs flex-1"
                />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-16">Music:</span>
                <Input
                  value={config.audio.music ?? ''}
                  onChange={(e) => updateAudio({ music: e.target.value || undefined })}
                  placeholder="Music file..."
                  className="h-7 text-xs flex-1"
                />
              </div>
              <div className="flex gap-2 items-center">
                <Switch
                  checked={config.audio.shakyCam ?? false}
                  onCheckedChange={(checked) => updateAudio({ shakyCam: checked || undefined })}
                  className="scale-75"
                />
                <span className="text-xs">Shaky camera effect</span>
              </div>
            </>
          )}

          {/* Spawn */}
          {renderSection(
            'spawn',
            <Users className="w-3.5 h-3.5 text-red-500" />,
            'Spawn Enemies',
            config.spawn.enabled,
            (enabled) => updateSpawn({ enabled }),
            <>
              <Input
                value={config.spawn.category}
                onChange={(e) => updateSpawn({ category: e.target.value })}
                placeholder="Enemy category..."
                className="h-7 text-xs"
              />
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">At X:</span>
                <Input
                  type="number"
                  value={config.spawn.x ?? ''}
                  onChange={(e) => updateSpawn({ x: parseInt(e.target.value, 10) || undefined })}
                  className="h-7 w-20 text-xs"
                />
                <span className="text-xs text-muted-foreground">Y:</span>
                <Input
                  type="number"
                  value={config.spawn.y ?? ''}
                  onChange={(e) => updateSpawn({ y: parseInt(e.target.value, 10) || undefined })}
                  className="h-7 w-20 text-xs"
                />
              </div>
            </>
          )}

          {/* Status Changes */}
          {renderSection(
            'status',
            <Tag className="w-3.5 h-3.5 text-blue-500" />,
            'Set / Clear Status',
            config.statusChange.setStatuses.length > 0 || config.statusChange.unsetStatuses.length > 0,
            (enabled) => {
              if (!enabled) {
                updateStatusChange({ setStatuses: [], unsetStatuses: [] });
              }
            },
            <>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Set status flags:</span>
                <Input
                  value={config.statusChange.setStatuses.join(', ')}
                  onChange={(e) => updateStatusChange({ 
                    setStatuses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                  })}
                  placeholder="Status tags (comma separated)..."
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Clear status flags:</span>
                <Input
                  value={config.statusChange.unsetStatuses.join(', ')}
                  onChange={(e) => updateStatusChange({ 
                    unsetStatuses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                  })}
                  placeholder="Status tags (comma separated)..."
                  className="h-7 text-xs"
                />
              </div>
            </>
          )}

          {/* NPC Interaction */}
          {renderSection(
            'npc',
            <Users className="w-3.5 h-3.5 text-orange-500" />,
            'Start Another NPC Dialog',
            config.npcInteraction.enabled,
            (enabled) => updateNpcInteraction({ enabled }),
            <Input
              value={config.npcInteraction.npcFile}
              onChange={(e) => updateNpcInteraction({ npcFile: e.target.value })}
              placeholder="NPC file (e.g., npcs/merchant.txt)"
              className="h-7 text-xs"
            />
          )}

          {/* Book */}
          {renderSection(
            'book',
            <Book className="w-3.5 h-3.5 text-amber-600" />,
            'Show Book/Popup',
            config.book.enabled,
            (enabled) => updateBook({ enabled }),
            <Input
              value={config.book.bookFile}
              onChange={(e) => updateBook({ bookFile: e.target.value })}
              placeholder="Book file..."
              className="h-7 text-xs"
            />
          )}

          {/* Stash */}
          {renderSection(
            'stash',
            <Box className="w-3.5 h-3.5 text-gray-500" />,
            'Open Stash',
            config.stash.enabled,
            (enabled) => updateStash({ enabled }),
            <p className="text-xs text-muted-foreground">Opens the player&apos;s stash/storage.</p>
          )}

          {/* Map Mod */}
          {renderSection(
            'mapmod',
            <Map className="w-3.5 h-3.5 text-teal-500" />,
            'Modify Map',
            config.mapMod.enabled,
            (enabled) => updateMapMod({ enabled }),
            <Input
              value={config.mapMod.mapModFile}
              onChange={(e) => updateMapMod({ mapModFile: e.target.value })}
              placeholder="Map mod file..."
              className="h-7 text-xs"
            />
          )}

          {/* Power */}
          {renderSection(
            'power',
            <Zap className="w-3.5 h-3.5 text-yellow-500" />,
            'Trigger Power/Effect',
            config.power.enabled,
            (enabled) => updatePower({ enabled }),
            <>
              <Input
                value={config.power.powerId ?? ''}
                onChange={(e) => updatePower({ powerId: e.target.value || undefined })}
                placeholder="Power ID..."
                className="h-7 text-xs"
              />
              <Input
                value={config.power.powerPath ?? ''}
                onChange={(e) => updatePower({ powerPath: e.target.value || undefined })}
                placeholder="Power path (optional)..."
                className="h-7 text-xs"
              />
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">Damage:</span>
                <Input
                  type="number"
                  value={config.power.powerDamage ?? ''}
                  onChange={(e) => updatePower({ powerDamage: parseInt(e.target.value, 10) || undefined })}
                  className="h-7 w-24 text-xs"
                />
              </div>
            </>
          )}

          {/* Advanced Misc */}
          <div className="border rounded-md">
            <button
              type="button"
              onClick={() => toggleSection('misc')}
              className="w-full px-3 py-2 flex items-center gap-2 text-left"
            >
              <Sparkles className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium">Misc Options</span>
              <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${expandedSections.misc ? 'rotate-180' : ''}`} />
            </button>
            {expandedSections.misc && (
              <div className="px-3 pb-3 pt-1 border-t space-y-2">
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground w-28">Chance to run:</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={config.advanced.chanceExec ?? 100}
                    onChange={(e) => updateAdvanced({ chanceExec: parseInt(e.target.value, 10) || undefined })}
                    className="h-7 w-20 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs">
                    <Switch
                      checked={config.advanced.repeat ?? false}
                      onCheckedChange={(checked) => updateAdvanced({ repeat: checked || undefined })}
                      className="scale-75"
                    />
                    <RefreshCw className="w-3 h-3" />
                    Allow repeat
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Switch
                      checked={config.advanced.saveGame ?? false}
                      onCheckedChange={(checked) => updateAdvanced({ saveGame: checked || undefined })}
                      className="scale-75"
                    />
                    <Save className="w-3 h-3" />
                    Save game
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Switch
                      checked={config.advanced.respec ?? false}
                      onCheckedChange={(checked) => updateAdvanced({ respec: checked || undefined })}
                      className="scale-75"
                    />
                    Respec
                  </label>
                </div>
                <div className="flex gap-2 items-center">
                  <FileCode className="w-3 h-3 text-muted-foreground" />
                  <Input
                    value={config.advanced.scriptFile ?? ''}
                    onChange={(e) => updateAdvanced({ scriptFile: e.target.value || undefined })}
                    placeholder="Script file (optional)..."
                    className="h-7 text-xs flex-1"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch
                    checked={config.advanced.showOnMinimap ?? false}
                    onCheckedChange={(checked) => updateAdvanced({ showOnMinimap: checked || undefined })}
                    className="scale-75"
                  />
                  Show on minimap
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldFlowPanel;

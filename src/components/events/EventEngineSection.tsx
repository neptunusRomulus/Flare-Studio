import React from 'react';
import { Repeat2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import EventSectionShell from './EventSectionShell';
import type { EventSectionProps } from './eventDialogModel';
import { HintLabel } from '@/components/ui/field-hint';

type Props = EventSectionProps;

/** Chance, auto save and script. */
export default function EventEngineSection({ eventData, setEventData, expandedSections, toggleSection }: Props) {
  return (
    <EventSectionShell
      title="Engine Logic"
      icon={Repeat2}
      id="engine-logic"
      isExpanded={expandedSections.engine}
      onToggle={() => toggleSection('engine')}
    >
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Engine Logic</h3>

        {/* Chance */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HintLabel className="text-xs font-medium text-foreground/80" hint={"Sets a percentage chance for the event to fire"}>Chance (%)</HintLabel>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="range"
              min="0"
              max="100"
              value={eventData.engine.chance}
              onChange={e =>
                setEventData(prev => ({
                  ...prev,
                  engine: { ...prev.engine, chance: parseInt(e.target.value) },
                }))
              }
              className="flex-1"
            />
            <Input
              type="number"
              min="0"
              max="100"
              value={eventData.engine.chance}
              onChange={e =>
                setEventData(prev => ({
                  ...prev,
                  engine: { ...prev.engine, chance: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) },
                }))
              }
              className="h-7 text-xs font-mono w-16"
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
        </div>

        {/* Auto Save */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="autoSave"
            checked={eventData.engine.autoSave}
            onCheckedChange={(value) =>
              setEventData(prev => ({
                ...prev,
                engine: { ...prev.engine, autoSave: value === true },
              }))
            }
            className="h-4 w-4"
          />
          <HintLabel htmlFor="autoSave" className="text-xs font-medium text-foreground/80" hint={"Automatically saves the game and updates the respawn point"}>
            Auto Save Game
          </HintLabel>
        </div>

        {/* Script */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HintLabel className="text-xs font-medium text-foreground/80" hint={"Calls an external script file for complex logic"}>Script File</HintLabel>
          </div>
          <Input
            value={eventData.engine.script}
            onChange={e =>
              setEventData(prev => ({
                ...prev,
                engine: { ...prev.engine, script: e.target.value },
              }))
            }
            placeholder="Script path"
            className="h-7 text-xs"
          />
        </div>
      </div>
    </EventSectionShell>
  );
}

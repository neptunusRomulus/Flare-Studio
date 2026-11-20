import { FieldHint } from '@/components/ui/field-hint';
import { StudioWorldPanel } from './studio/studioEditors';
import WorldEngineFilesPanel from '@/components/WorldEngineFilesPanel';

/** Right-rail World Settings card: cutscenes, parallax, fog of war, procgen, and world engine files. */
export default function SidebarWorldSettingsArea() {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-3">
      <FieldHint hint="Cutscenes, parallax, fog of war and procedural map rules have Load/Write on each block. Gameplay, misc, death penalty, default music and loot live in the other sections and use Save.">
        <div className="text-sm font-semibold">World Settings</div>
      </FieldHint>
      <WorldEngineFilesPanel worldEditors={<StudioWorldPanel />} />
    </div>
  );
}

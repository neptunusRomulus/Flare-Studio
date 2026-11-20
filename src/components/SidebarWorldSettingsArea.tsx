import { FieldHint } from '@/components/ui/field-hint';
import { StudioWorldPanel } from './studio/studioEditors';

/** Right-rail World Settings card: cutscenes, parallax, fog of war and procgen. */
export default function SidebarWorldSettingsArea() {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-3">
      <FieldHint hint="Cutscenes, parallax, fog of war and procedural map rules. Open a project, then use Load/Write on each block.">
        <div className="text-sm font-semibold">World Settings</div>
      </FieldHint>
      <StudioWorldPanel />
    </div>
  );
}

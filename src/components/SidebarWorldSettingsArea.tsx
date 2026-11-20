import { StudioWorldPanel } from './studio/studioEditors';

/** Right-rail World Settings card: cutscenes, language catalog, parallax, fog of war and procgen. */
export default function SidebarWorldSettingsArea() {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-3">
      <div className="text-sm font-semibold">World Settings</div>
      <p className="text-[11px] text-muted-foreground">Cutscenes, language catalog, parallax, fog of war and procedural map rules. Open a project, then use Load/Write on each block.</p>
      <StudioWorldPanel />
    </div>
  );
}

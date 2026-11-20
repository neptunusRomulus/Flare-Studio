import { Button } from '@/components/ui/button';
import { StudioWorldPanel, TileSizeForm } from './studio/studioEditors';
import { openEngineStudio } from '@/components/studio/engineStudio';

/** Right-rail Game Settings card: tile size, world editors, and Engine Studio entry points. */
export default function SidebarGameSettingsArea() {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-3">
      <div className="text-sm font-semibold">Game Settings</div>
      <p className="text-[11px] text-muted-foreground">HUD and menu panels (menus/*.txt) are edited on the canvas. Drag a panel to write its pos=; other keys stay as they are.</p>
      <TileSizeForm />
      <div className="space-y-2">
        <div className="text-xs font-medium">World</div>
        <p className="text-[11px] text-muted-foreground">Cutscenes, language catalog, parallax, fog of war and procedural map rules. Open a project, then use Load/Write on each block.</p>
        <StudioWorldPanel />
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium">Engine data</div>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('files')}>Engine files</Button>
          <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('tree')}>Power tree</Button>
          <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('items')}>Types, qualities, sets</Button>
          <Button type="button" variant="outline" className="h-7 px-2 justify-start text-xs" onClick={() => openEngineStudio('problems')}>Problems</Button>
        </div>
      </div>
    </div>
  );
}

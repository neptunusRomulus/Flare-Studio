import { TileSizeForm } from './studio/studioEditors';
import { openEngineStudio } from '@/components/studio/engineStudio';

/** Left sidebar content for the Game Settings layer; replaces the tileset palette. */
export default function SidebarGameSettingsArea() {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-3">
      <div className="text-sm font-semibold">Game Settings</div>
      <p className="text-[11px] text-muted-foreground">HUD and menu panels (menus/*.txt) are edited on the canvas. Drag a panel to write its pos=; other keys stay as they are.</p>
      <TileSizeForm />
      <div className="space-y-1">
        <div className="text-xs font-medium">Engine data</div>
        <div className="flex flex-col gap-1">
          <button type="button" className="h-7 px-2 rounded border border-border text-xs text-left hover:bg-muted" onClick={() => openEngineStudio('files')}>Engine files</button>
          <button type="button" className="h-7 px-2 rounded border border-border text-xs text-left hover:bg-muted" onClick={() => openEngineStudio('tree')}>Power tree</button>
          <button type="button" className="h-7 px-2 rounded border border-border text-xs text-left hover:bg-muted" onClick={() => openEngineStudio('items')}>Types, qualities, sets</button>
          <button type="button" className="h-7 px-2 rounded border border-border text-xs text-left hover:bg-muted" onClick={() => openEngineStudio('problems')}>Problems</button>
        </div>
      </div>
    </div>
  );
}
